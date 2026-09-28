// Portais de dados abertos CKAN (estado, tribunal de contas): busca conjuntos
// de dados por tema, baixa os CSVs e extrai as linhas que citam o municipio.

import { createReadStream } from 'node:fs';
import { join } from 'node:path';

import { criarClassificadorAmbiental } from '../classificacao.mjs';
import { registrosCsv } from '../csv.mjs';
import { baixarArquivo, obterJson } from '../rede.mjs';
import { nomeDoEnte, normalizarColuna, paraNumero } from '../texto.mjs';
import { abrirCsvDoZip } from '../zip.mjs';

const LIMITE_LINHAS_POR_RECURSO = 5000;
const COLUNA_DE_VALOR = /VALOR|^VL_|_VL_|EMPENHAD|LIQUIDAD|PAGO|REPASSE|ARRECAD/;
const COLUNA_DE_ENTE = /MUNICIPIO|(?:^|_)ENTE(?:_|$)|BENEFICIARIO|CONVENENTE|FAVORECIDO|PROPONENTE/;

// Com coluna de municipio/beneficiario, compara o nome exato; senao, busca no texto.
export function linhaDoMunicipio(registro, alvo) {
  const colunas = Object.keys(registro).filter((coluna) => COLUNA_DE_ENTE.test(coluna) && !/COD|CNPJ|CPF|UF$/.test(coluna));
  if (colunas.length) return colunas.some((coluna) => nomeDoEnte(registro[coluna]) === alvo.municipioNormalizado);
  return alvo.casarMunicipio(Object.values(registro).join(' | '));
}

export function anosCitados(texto) {
  return [...String(texto ?? '').matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
}

export function recursoEhCsv(recurso) {
  const formato = String(recurso.format ?? '').toLowerCase();
  const url = String(recurso.url ?? '').toLowerCase().split('?')[0];
  return formato === 'csv' || url.endsWith('.csv') || (formato.includes('csv') && url.endsWith('.zip'));
}

export async function filtrarLinhasDoMunicipio(stream, alvo, classificar) {
  const linhas = [];
  const somas = {};
  let total = 0;
  let ambientais = 0;
  for await (const registro of registrosCsv(stream)) {
    if (!linhaDoMunicipio(registro, alvo)) continue;
    const texto = Object.values(registro).join(' | ');
    total++;
    if (classificar(texto).relevante) ambientais++;
    for (const [coluna, valor] of Object.entries(registro)) {
      if (COLUNA_DE_VALOR.test(coluna)) somas[coluna] = (somas[coluna] ?? 0) + paraNumero(valor);
    }
    if (linhas.length < LIMITE_LINHAS_POR_RECURSO) linhas.push(registro);
  }
  return { linhas, somas, total, ambientais };
}

export async function coletarCkan(ctx) {
  const { portais, resultadosPorConsulta, tamanhoMaximoMb } = ctx.config.ckan;
  const classificar = criarClassificadorAmbiental(ctx.config);
  const recursos = [];
  const avisos = [];

  for (const portal of portais) {
    const vistos = new Set();
    for (const consulta of portal.consultas) {
      let resposta;
      try {
        resposta = await obterJson(`${portal.base}/api/3/action/package_search?q=${encodeURIComponent(consulta)}&rows=${resultadosPorConsulta}`);
      } catch (erro) {
        avisos.push(`${portal.nome} (${consulta}): ${erro.message}`);
        // Sem resposta HTTP o portal esta inacessivel: nao insiste nas demais consultas.
        if (!erro.status) break;
        continue;
      }
      for (const pacote of resposta?.result?.results ?? []) {
        for (const recurso of pacote.resources ?? []) {
          if (vistos.has(recurso.id) || !recursoEhCsv(recurso)) continue;
          vistos.add(recurso.id);
          const anos = anosCitados(`${recurso.name} ${recurso.url}`);
          if (anos.length && Math.max(...anos) < ctx.alvo.desde) continue;

          const extensao = String(recurso.url).toLowerCase().split('?')[0].endsWith('.zip') ? '.zip' : '.csv';
          const destino = join(ctx.cacheDir, 'ckan', normalizarColuna(portal.nome).toLowerCase(), `${recurso.id}${extensao}`);
          try {
            await baixarArquivo(recurso.url, destino, { forcar: ctx.atualizar, maxBytes: tamanhoMaximoMb * 1e6, log: ctx.log });
            const stream = extensao === '.zip' ? await abrirCsvDoZip(destino) : createReadStream(destino);
            const resultado = await filtrarLinhasDoMunicipio(stream, ctx.alvo, classificar);
            if (!resultado.total) continue;
            ctx.log(`  ${portal.nome}: ${resultado.total} linhas em "${pacote.title} / ${recurso.name}"`);
            recursos.push({
              portal: portal.nome,
              consulta,
              conjunto: pacote.title,
              recurso: recurso.name,
              url: recurso.url,
              pagina: `${portal.base}/dataset/${pacote.name}`,
              ...resultado,
            });
          } catch (erro) {
            avisos.push(`${portal.nome} / ${recurso.name}: ${erro.message}`);
          }
        }
      }
    }
  }

  return {
    fonte: 'Portais CKAN de dados abertos',
    geradoEm: new Date().toISOString(),
    recursos,
    avisos,
  };
}
