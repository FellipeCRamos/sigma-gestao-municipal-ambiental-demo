#!/usr/bin/env node
// Levantamento de captacao de recursos (federal e estadual) de um municipio na
// area ambiental: o que foi captado, o que foi perdido e o que esta aberto.

import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { gerarCsv } from './lib/csv.mjs';
import { coletarCkan } from './lib/fontes/ckan.mjs';
import { coletarPortalTp } from './lib/fontes/portal-tp.mjs';
import { coletarPortalTransparencia } from './lib/fontes/portal-transparencia.mjs';
import { coletarTransferegov } from './lib/fontes/transferegov.mjs';
import { coletarTransferenciasEspeciais } from './lib/fontes/transferencias-especiais.mjs';
import { avisoDeProxy } from './lib/rede.mjs';
import { calcularIndicadores, gerarCsvMatriz, gerarMarkdown, lerJsonOpcional, lerManuais, montarMatriz, simularCenarios } from './lib/relatorio.mjs';
import { criarCasadorExato, normalizar, normalizarColuna, somenteDigitos } from './lib/texto.mjs';

const PASTA = dirname(fileURLToPath(import.meta.url));

const AJUDA = `Uso: node tools/captacao-recursos/captacao.mjs <comando> [opcoes]

Comandos:
  federal        Transferegov: propostas, convenios, emendas e programas nao pleiteados
  pix            Emendas PIX (transferencias especiais)
  transparencia  Convenios no Portal da Transparencia federal (requer PORTAL_TRANSPARENCIA_CHAVE)
  estadual       Portais CKAN de dados abertos (estado e tribunal de contas)
  portal-tp      Portal da Transparencia municipal (portaltp.com.br): tudo do orgao
  relatorio      Consolida as saidas em matriz CSV + relatorio Markdown
  tudo           federal + pix + transparencia + estadual + relatorio

Opcoes:
  --municipio NOME     nome do municipio (obrigatorio)
  --uf UF              sigla da UF (obrigatorio)
  --ibge CODIGO        codigo IBGE de 7 digitos (obrigatorio para federal/transparencia)
  --cnpj LISTA         CNPJs da prefeitura e fundos, separados por virgula (melhora a precisao)
  --desde ANO          ano inicial (padrao 2016)
  --saida PASTA        pasta de saida (padrao saida-captacao/<municipio>-<uf>)
  --dados-dir PASTA    CSVs/ZIPs do Transferegov ja baixados (siconv_*.csv[.zip])
  --manual ARQUIVO     CSV de oportunidades levantadas manualmente (padrao <saida>/oportunidades-manuais.csv)
  --atualizar          ignora arquivos em cache
  --portal URL         (portal-tp) endereco do portal, ex.: https://municipio-uf.portaltp.com.br
  --orgao TERMOS       (portal-tp) termos da unidade gestora, separados por virgula (padrao "MEIO AMBIENTE")
  --consultas LISTA    (portal-tp) consultas json_* a coletar (padrao: todas as listadas no portal)
`;

export function lerArgumentos(argv) {
  const [comando, ...resto] = argv;
  const opcoes = {};
  for (let i = 0; i < resto.length; i++) {
    const atual = resto[i];
    if (!atual.startsWith('--')) throw new Error(`argumento inesperado: ${atual}`);
    const [nome, valorEmbutido] = atual.slice(2).split(/=(.*)/s);
    if (valorEmbutido !== undefined) opcoes[nome] = valorEmbutido;
    else if (resto[i + 1] === undefined || resto[i + 1].startsWith('--')) opcoes[nome] = true;
    else opcoes[nome] = resto[++i];
  }
  return { comando, opcoes };
}

export function montarAlvo(opcoes) {
  const municipio = typeof opcoes.municipio === 'string' ? opcoes.municipio.trim() : '';
  const uf = normalizar(opcoes.uf);
  if (!municipio || !/^[A-Z]{2}$/.test(uf)) throw new Error('informe --municipio e --uf (ex.: --municipio "Nome do Municipio" --uf ES)');
  const ibge = somenteDigitos(opcoes.ibge);
  if (ibge && ibge.length !== 7) throw new Error('--ibge deve ter 7 digitos');
  const desde = Number(opcoes.desde ?? 2016);
  if (!Number.isInteger(desde) || desde < 2000) throw new Error('--desde deve ser um ano, ex.: 2016');
  return {
    municipio,
    municipioNormalizado: normalizar(municipio),
    uf,
    ibge,
    cnpjs: String(opcoes.cnpj ?? '').split(',').map(somenteDigitos).filter((c) => c.length === 14),
    desde,
    casarMunicipio: criarCasadorExato(municipio),
  };
}

async function carregarConfig() {
  return JSON.parse(await readFile(join(PASTA, 'config.json'), 'utf8'));
}

async function salvarJson(caminho, dados) {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, `${JSON.stringify(dados, (_, valor) => (valor instanceof Set ? [...valor] : valor), 2)}\n`);
}

function exigirIbge(alvo) {
  if (!alvo.ibge) throw new Error('este comando exige --ibge (codigo de 7 digitos)');
}

async function executarFonte(nome, ctx, coletar) {
  ctx.log(`\n== ${nome} ==`);
  const resultado = await coletar(ctx);
  await salvarJson(join(ctx.saida, `${nome}.json`), resultado);
  for (const aviso of resultado.avisos ?? []) ctx.log(`  aviso: ${aviso}`);
  ctx.log(`  salvo em ${join(ctx.saida, `${nome}.json`)}`);
  return resultado;
}

const FONTES = {
  federal: (ctx) => { exigirIbge(ctx.alvo); return executarFonte('transferegov', ctx, coletarTransferegov); },
  pix: (ctx) => executarFonte('transferencias-especiais', ctx, coletarTransferenciasEspeciais),
  transparencia: (ctx) => { exigirIbge(ctx.alvo); return executarFonte('portal-transparencia', ctx, coletarPortalTransparencia); },
  estadual: (ctx) => executarFonte('ckan', ctx, coletarCkan),
};

async function executarPortalTp(ctx, opcoes) {
  if (typeof opcoes.portal !== 'string') throw new Error('informe --portal https://<municipio>-<uf>.portaltp.com.br');
  const termos = String(typeof opcoes.orgao === 'string' ? opcoes.orgao : 'MEIO AMBIENTE').split(',').map((t) => t.trim()).filter(Boolean);
  const consultas = typeof opcoes.consultas === 'string' ? opcoes.consultas.split(',').map((c) => c.trim()).filter(Boolean) : [];
  const resultado = await executarFonte('portal-tp', ctx, (c) => coletarPortalTp(c, { base: opcoes.portal, termos, consultas }));
  for (const consulta of resultado.consultas) {
    if (!consulta.registros.length) continue;
    const chaves = [...new Set(consulta.registros.flatMap((r) => Object.keys(r).filter((k) => typeof r[k] !== 'object' || r[k] === null)))];
    await mkdir(join(ctx.saida, 'portal-tp'), { recursive: true });
    await writeFile(join(ctx.saida, 'portal-tp', `${consulta.consulta}.csv`), gerarCsv(consulta.registros, chaves.map((chave) => ({ chave, titulo: chave }))));
  }
  return resultado;
}

async function gerarRelatorio(ctx, opcoes) {
  ctx.log('\n== relatorio ==');
  const ler = (nome) => lerJsonOpcional(join(ctx.saida, `${nome}.json`));
  const [transferegov, pix, transparencia, ckan, portalTp] = await Promise.all(
    ['transferegov', 'transferencias-especiais', 'portal-transparencia', 'ckan', 'portal-tp'].map(ler),
  );
  const caminhoManual = typeof opcoes.manual === 'string' ? resolve(opcoes.manual) : join(ctx.saida, 'oportunidades-manuais.csv');
  let manuais = { linhas: [], avisos: [] };
  try {
    manuais = await lerManuais(createReadStream(caminhoManual));
  } catch (erro) {
    if (erro.code !== 'ENOENT') throw erro;
  }
  const avisos = [
    ...[transferegov, pix, transparencia, ckan, portalTp].filter(Boolean).map((r) => `Fonte "${r.fonte}" coletada em ${r.geradoEm}.`),
    ...[transferegov, pix, transparencia, ckan, portalTp].flatMap((r) => r?.avisos ?? []),
    ...manuais.avisos,
    ...(transferegov ? [] : ['Coleta federal (Transferegov) ausente: rode o comando "federal".']),
  ];
  const linhas = montarMatriz({ transferegov, pix, transparencia, ckan, manuais: manuais.linhas });
  const indicadores = calcularIndicadores(linhas, ctx.alvo, transferegov?.rankingUf);
  const cenarios = simularCenarios(linhas, indicadores, ctx.config.cenarioSistema);
  await writeFile(join(ctx.saida, 'matriz-oportunidades.csv'), gerarCsvMatriz(linhas));
  await writeFile(join(ctx.saida, 'relatorio-captacao.md'), gerarMarkdown({ alvo: ctx.alvo, linhas, indicadores, cenarios, avisos, portalTp, configCenario: ctx.config.cenarioSistema }));
  await salvarJson(join(ctx.saida, 'indicadores.json'), { alvo: { ...ctx.alvo, casarMunicipio: undefined }, indicadores, cenarios });
  ctx.log(`  ${linhas.length} linhas na matriz; relatorio em ${join(ctx.saida, 'relatorio-captacao.md')}`);
}

export async function main(argv = process.argv.slice(2)) {
  const { comando, opcoes } = lerArgumentos(argv);
  if (!comando || comando === 'ajuda' || opcoes.ajuda || opcoes.help) {
    process.stdout.write(AJUDA);
    return;
  }
  const alvo = montarAlvo(opcoes);
  const config = await carregarConfig();
  const saida = resolve(typeof opcoes.saida === 'string' ? opcoes.saida : join('saida-captacao', `${normalizarColuna(alvo.municipio).toLowerCase()}-${alvo.uf.toLowerCase()}`));
  const ctx = {
    alvo,
    config,
    saida,
    cacheDir: join(saida, '..', '_cache'),
    dadosDir: typeof opcoes['dados-dir'] === 'string' ? resolve(opcoes['dados-dir']) : null,
    atualizar: Boolean(opcoes.atualizar),
    log: (mensagem) => process.stderr.write(`${mensagem}\n`),
  };
  await mkdir(saida, { recursive: true });
  const proxy = avisoDeProxy();
  if (proxy) ctx.log(`aviso: ${proxy}`);

  if (FONTES[comando]) {
    await FONTES[comando](ctx);
  } else if (comando === 'portal-tp') {
    await executarPortalTp(ctx, opcoes);
  } else if (comando === 'relatorio') {
    await gerarRelatorio(ctx, opcoes);
  } else if (comando === 'tudo') {
    for (const [nome, executar] of Object.entries(FONTES)) {
      try {
        await executar(ctx);
        await rm(join(saida, `falha-${nome}.json`), { force: true });
      } catch (erro) {
        ctx.log(`  falhou (${nome}): ${erro.message}`);
        await salvarJson(join(saida, `falha-${nome}.json`), { erro: erro.message, em: new Date().toISOString() });
      }
    }
    await gerarRelatorio(ctx, opcoes);
  } else {
    throw new Error(`comando desconhecido: ${comando}\n\n${AJUDA}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((erro) => {
    process.stderr.write(`erro: ${erro.message}\n`);
    process.exitCode = 1;
  });
}
