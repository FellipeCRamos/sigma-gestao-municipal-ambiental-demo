// Portal da Transparencia municipal na plataforma portaltp.com.br.
// A plataforma publica as consultas do site em JSON:
//   <portal>/api/transparencia.asmx/json_<consulta>?ano=AAAA[&mes=M]
// e lista as consultas disponiveis em <portal>/api/dadosabertos.aspx.

import { esperar, obterTexto } from '../rede.mjs';
import { normalizar, paraNumero } from '../texto.mjs';

const CAMPO_DE_ORGAO = /unidade|orgao|órgão|secretaria|lotacao|lotação|entidade|setor|departamento/i;
const CAMPO_DE_VALOR = /valor|^vl|empenhad|liquidad|pago|total/i;
// Consultas com dados de pessoas (folha, servidores): guardamos so contagens e somas.
const CONSULTA_PESSOAL = /servidor|folha|cargo|pessoal|remunera|estagiar|terceiriz|pensionist|aposentad/i;
const INTERVALO_MS = 250;

export function extrairConsultas(html) {
  return [...new Set([...String(html).matchAll(/json_[a-z0-9_]+/gi)].map((m) => m[0].toLowerCase()))];
}

function decodificarEntidadesXml(texto) {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCodePoint(Number(codigo)))
    .replace(/&amp;/g, '&');
}

// Servicos .asmx podem devolver JSON puro, {"d": ...} ou JSON dentro de <string> XML.
export function decodificarResposta(texto) {
  let conteudo = String(texto ?? '').trim();
  if (!conteudo) return [];
  if (conteudo.startsWith('<')) {
    const m = conteudo.match(/<string[^>]*>([\s\S]*)<\/string>/i);
    if (!m) return [];
    conteudo = decodificarEntidadesXml(m[1]).trim();
    if (!conteudo) return [];
  }
  let dados = JSON.parse(conteudo);
  if (dados && !Array.isArray(dados) && 'd' in dados) dados = dados.d;
  if (typeof dados === 'string') dados = dados.trim() ? JSON.parse(dados) : [];
  if (Array.isArray(dados)) return dados;
  if (dados && typeof dados === 'object') return Object.values(dados).find(Array.isArray) ?? [dados];
  return [];
}

// Devolve 'unidade' quando o orgao aparece em campo de unidade/orgao, 'texto'
// quando so aparece no restante do registro (ex.: objeto de licitacao) e null.
export function criarFiltroOrgao(termos) {
  const alvos = termos.map(normalizar).filter(Boolean);
  const contem = (valor) => {
    const texto = normalizar(typeof valor === 'object' && valor !== null ? JSON.stringify(valor) : valor);
    return alvos.some((alvo) => texto.includes(alvo));
  };
  return (registro) => {
    const chaves = Object.keys(registro);
    if (chaves.filter((chave) => CAMPO_DE_ORGAO.test(chave)).some((chave) => contem(registro[chave]))) return 'unidade';
    return chaves.some((chave) => contem(registro[chave])) ? 'texto' : null;
  };
}

export function somarValores(registros) {
  const somas = {};
  for (const registro of registros) {
    for (const [chave, valor] of Object.entries(registro)) {
      if (!CAMPO_DE_VALOR.test(chave) || valor === null || typeof valor === 'object') continue;
      const numero = paraNumero(valor);
      if (numero) somas[chave] = (somas[chave] ?? 0) + numero;
    }
  }
  return somas;
}

function faltaMes(erro) {
  return /\bmes\b/i.test(erro?.corpo ?? erro?.message ?? '');
}

async function buscar(base, consulta, parametros, intervaloMs) {
  const url = `${base}/api/transparencia.asmx/${consulta}?${new URLSearchParams(parametros)}`;
  const texto = await obterTexto(url, { tentativas: 3 });
  await esperar(intervaloMs);
  return decodificarResposta(texto);
}

async function buscarAno(base, consulta, ano, porMes, intervaloMs) {
  if (!porMes) return buscar(base, consulta, { ano }, intervaloMs);
  const registros = [];
  const ultimoMes = ano === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
  for (let mes = 1; mes <= ultimoMes; mes++) registros.push(...(await buscar(base, consulta, { ano, mes }, intervaloMs)));
  return registros;
}

export async function coletarPortalTp(ctx, { base, termos, consultas: consultasInformadas = [], intervaloMs = INTERVALO_MS }) {
  const portal = base.replace(/\/+$/, '');
  const avisos = [];
  let consultas = consultasInformadas;
  if (!consultas.length) {
    try {
      consultas = extrairConsultas(await obterTexto(`${portal}/api/dadosabertos.aspx`));
    } catch (erro) {
      avisos.push(`Nao foi possivel listar as consultas em ${portal}/api/dadosabertos.aspx: ${erro.message}`);
    }
  }
  if (!consultas.length) {
    return {
      fonte: 'Portal da Transparencia municipal (portaltp)',
      geradoEm: new Date().toISOString(),
      portal,
      termos,
      consultas: [],
      avisos: [...avisos, 'Nenhuma consulta para coletar: informe --consultas json_x,json_y.'],
    };
  }

  const filtrar = criarFiltroOrgao(termos);
  const anoFinal = new Date().getFullYear();
  const resultado = [];
  for (const consulta of consultas) {
    const pessoal = CONSULTA_PESSOAL.test(consulta);
    const item = { consulta, pessoal, anos: {}, registros: [] };
    let porMes = false;
    ctx.log(`Portal municipal: ${consulta}`);
    for (let ano = ctx.alvo.desde; ano <= anoFinal; ano++) {
      let registros;
      try {
        registros = await buscarAno(portal, consulta, ano, porMes, intervaloMs);
      } catch (erro) {
        if (!porMes && faltaMes(erro)) {
          porMes = true;
          ano--;
          continue;
        }
        avisos.push(`${consulta} ${ano}: ${erro.message}`);
        if (erro.naoRepetir) break;
        continue;
      }
      const doOrgao = registros
        .map((registro) => ({ registro, criterio: filtrar(registro) }))
        .filter((linha) => linha.criterio);
      item.anos[ano] = {
        total: registros.length,
        doOrgao: doOrgao.length,
        porUnidade: doOrgao.filter((linha) => linha.criterio === 'unidade').length,
        somas: somarValores(doOrgao.filter((linha) => linha.criterio === 'unidade').map((linha) => linha.registro)),
      };
      if (!pessoal) item.registros.push(...doOrgao.map(({ registro, criterio }) => ({ ano, criterio, ...registro })));
    }
    resultado.push(item);
  }

  return {
    fonte: 'Portal da Transparencia municipal (portaltp)',
    geradoEm: new Date().toISOString(),
    portal,
    termos,
    consultas: resultado,
    avisos,
  };
}
