// Transferegov (antigo SICONV / Plataforma +Brasil): programas, propostas,
// convenios e emendas. Cruza o que o municipio pleiteou com todos os programas
// a que ele era elegivel para apontar oportunidades aproveitadas e perdidas.

import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { STATUS, classificarConvenio, classificarProposta, criarClassificadorAmbiental } from '../classificacao.mjs';
import { registrosCsv } from '../csv.mjs';
import { baixarArquivo } from '../rede.mjs';
import { anoDe, campo, mediana, normalizar, paraDataIso, paraNumero, somenteDigitos } from '../texto.mjs';
import { abrirCsvDoZip } from '../zip.mjs';

// Nomes de coluna conhecidos (normalizados). Varios candidatos toleram mudancas de layout.
const C = {
  programa: {
    id: ['ID_PROGRAMA'],
    codigo: ['COD_PROGRAMA'],
    nome: ['NOME_PROGRAMA'],
    orgaoSuperior: ['DESC_ORGAO_SUP_PROGRAMA', 'DESC_ORGAO_SUPERIOR_PROGRAMA', 'DESC_ORGAO_SUP'],
    orgao: ['DESC_ORGAO_PROGRAMA', 'DESC_ORGAO'],
    situacao: ['SIT_PROGRAMA', 'SITUACAO_PROGRAMA'],
    ano: ['ANO_DISPONIBILIZACAO'],
    dataDisponibilizacao: ['DATA_DISPONIBILIZACAO'],
    inicioPropostas: ['DT_PROG_INI_RECEB_PROP'],
    fimPropostas: ['DT_PROG_FIM_RECEB_PROP'],
    inicioEmendas: ['DT_PROG_INI_EMENDA_PAR'],
    fimEmendas: ['DT_PROG_FIM_EMENDA_PAR'],
    inicioBeneficiario: ['DT_PROG_INI_BENEF_ESP'],
    fimBeneficiario: ['DT_PROG_FIM_BENEF_ESP'],
    natureza: ['NATUREZA_JURIDICA_PROGRAMA'],
    uf: ['UF_PROGRAMA'],
    acao: ['ACAO_ORCAMENTARIA'],
    modalidade: ['MODALIDADE_PROGRAMA'],
  },
  programaProposta: {
    programa: ['ID_PROGRAMA'],
    proposta: ['ID_PROPOSTA'],
  },
  proposta: {
    id: ['ID_PROPOSTA'],
    uf: ['UF_PROPONENTE'],
    municipio: ['MUNIC_PROPONENTE', 'MUNICIPIO_PROPONENTE'],
    ibge: ['COD_MUNIC_IBGE', 'COD_MUNICIPIO_IBGE'],
    natureza: ['NATUREZA_JURIDICA'],
    numero: ['NR_PROPOSTA'],
    ano: ['ANO_PROP'],
    data: ['DIA_PROP', 'DIA_PROPOSTA'],
    orgaoSuperior: ['DESC_ORGAO_SUP'],
    orgao: ['DESC_ORGAO'],
    modalidade: ['MODALIDADE'],
    documento: ['IDENTIF_PROPONENTE'],
    proponente: ['NM_PROPONENTE'],
    situacao: ['SIT_PROPOSTA'],
    objeto: ['OBJETO_PROPOSTA'],
    valorGlobal: ['VL_GLOBAL_PROP'],
    valorRepasse: ['VL_REPASSE_PROP'],
    valorContrapartida: ['VL_CONTRAPARTIDA_PROP'],
  },
  convenio: {
    numero: ['NR_CONVENIO'],
    proposta: ['ID_PROPOSTA'],
    assinatura: ['DIA_ASSIN_CONV'],
    situacao: ['SIT_CONVENIO'],
    subsituacao: ['SUBSITUACAO_CONV'],
    fimVigencia: ['DIA_FIM_VIGENC_CONV'],
    valorGlobal: ['VL_GLOBAL_CONV'],
    valorRepasse: ['VL_REPASSE_CONV'],
    valorDesembolsado: ['VL_DESEMBOLSADO_CONV'],
    saldoDevolvido: ['VL_SALDO_REMAN_TESOURO'],
  },
  emenda: {
    proposta: ['ID_PROPOSTA'],
    numero: ['NR_EMENDA'],
    parlamentar: ['NOME_PARLAMENTAR'],
    tipo: ['TIPO_PARLAMENTAR'],
    impositiva: ['IND_IMPOSITIVO'],
    valor: ['VALOR_REPASSE_PROPOSTA_EMENDA', 'VALOR_REPASSE_EMENDA'],
  },
};

const hojeIso = () => new Date().toISOString().slice(0, 10);

async function localizarArquivo(nomeArquivo, ctx) {
  if (ctx.dadosDir) {
    const nomes = await readdir(ctx.dadosDir).catch(() => []);
    const base = nomeArquivo.replace(/\.zip$/i, '').replace(/\.csv$/i, '');
    const encontrado = nomes.find((nome) => nome.toLowerCase() === `${base}.csv`)
      ?? nomes.find((nome) => nome.toLowerCase() === `${base}.csv.zip`)
      ?? nomes.find((nome) => nome.toLowerCase() === `${base}.zip`);
    if (encontrado) return join(ctx.dadosDir, encontrado);
    throw new Error(`arquivo ${base}.csv(.zip) nao encontrado em ${ctx.dadosDir}`);
  }
  const url = new URL(nomeArquivo, ctx.config.transferegov.base).toString();
  return baixarArquivo(url, join(ctx.cacheDir, 'transferegov', nomeArquivo), { forcar: ctx.atualizar, log: ctx.log });
}

async function* lerTabela(chave, ctx) {
  const caminho = await localizarArquivo(ctx.config.transferegov.arquivos[chave], ctx);
  ctx.log(`  lendo ${caminho}`);
  const stream = /\.zip$/i.test(caminho) ? await abrirCsvDoZip(caminho) : createReadStream(caminho);
  let total = 0;
  for await (const registro of registrosCsv(stream)) {
    total++;
    if (total % 500_000 === 0) ctx.log(`    ${total.toLocaleString('pt-BR')} linhas...`);
    yield registro;
  }
}

function listaDeUfs(texto) {
  return normalizar(texto).split(/[^A-Z]+/).filter((sigla) => sigla.length === 2);
}

function propostaDoMunicipio(registro, alvo) {
  const ibge = somenteDigitos(campo(registro, C.proposta.ibge));
  if (ibge && alvo.ibge) return ibge.slice(0, 6) === alvo.ibge.slice(0, 6);
  return normalizar(campo(registro, C.proposta.uf)) === alvo.uf
    && normalizar(campo(registro, C.proposta.municipio)) === alvo.municipioNormalizado;
}

function proponentePublicoMunicipal(registro, alvo) {
  const documento = somenteDigitos(campo(registro, C.proposta.documento));
  if (alvo.cnpjs.length && documento) return alvo.cnpjs.includes(documento);
  return /MUNICIP/.test(normalizar(campo(registro, C.proposta.natureza)));
}

function janela(inicio, fim) {
  const i = paraDataIso(inicio);
  const f = paraDataIso(fim);
  return i || f ? { inicio: i, fim: f } : null;
}

// Consolida as linhas de programa (o arquivo pode repetir o programa por UF/natureza).
async function carregarProgramas(ctx, classificar) {
  const programas = new Map();
  for await (const r of lerTabela('programa', ctx)) {
    const id = campo(r, C.programa.id);
    if (!id) continue;
    let p = programas.get(id);
    if (!p) {
      const nome = campo(r, C.programa.nome);
      const orgaoSuperior = campo(r, C.programa.orgaoSuperior);
      const acao = campo(r, C.programa.acao);
      p = {
        id,
        codigo: campo(r, C.programa.codigo),
        nome,
        orgaoSuperior,
        orgao: campo(r, C.programa.orgao),
        situacao: campo(r, C.programa.situacao),
        ano: anoDe(campo(r, C.programa.ano), campo(r, C.programa.dataDisponibilizacao), campo(r, C.programa.inicioPropostas)),
        propostas: janela(campo(r, C.programa.inicioPropostas), campo(r, C.programa.fimPropostas)),
        emendas: janela(campo(r, C.programa.inicioEmendas), campo(r, C.programa.fimEmendas)),
        beneficiario: janela(campo(r, C.programa.inicioBeneficiario), campo(r, C.programa.fimBeneficiario)),
        naturezas: new Set(),
        ufs: new Set(),
        ambiental: classificar(nome, acao, orgaoSuperior),
      };
      programas.set(id, p);
    }
    const natureza = normalizar(campo(r, C.programa.natureza));
    if (natureza) p.naturezas.add(natureza);
    listaDeUfs(campo(r, C.programa.uf)).forEach((uf) => p.ufs.add(uf));
  }
  return programas;
}

function programaElegivel(programa, alvo) {
  const naturezaOk = !programa.naturezas.size || [...programa.naturezas].some((n) => /MUNICIP/.test(n));
  const ufOk = !programa.ufs.size || programa.ufs.has(alvo.uf);
  return naturezaOk && ufOk && (programa.ano ?? 0) >= alvo.desde;
}

function novoAcumulador() {
  return { propostasUf: 0, aprovadasUf: 0, valoresUf: [], valoresBrasil: [], municipiosUf: new Set() };
}

export async function coletarTransferegov(ctx) {
  const { alvo } = ctx;
  const classificar = criarClassificadorAmbiental(ctx.config);
  const avisos = [];

  ctx.log('Transferegov: programas');
  const programas = await carregarProgramas(ctx, classificar);
  const monitorados = new Set([...programas.values()]
    .filter((p) => p.ambiental.relevante && programaElegivel(p, alvo))
    .map((p) => p.id));
  ctx.log(`  ${programas.size} programas; ${monitorados.size} ambientais elegiveis desde ${alvo.desde}`);

  ctx.log('Transferegov: vinculo programa x proposta');
  const programaDaProposta = new Map();
  for await (const r of lerTabela('programaProposta', ctx)) {
    const idPrograma = campo(r, C.programaProposta.programa);
    if (!monitorados.has(idPrograma)) continue;
    const idProposta = campo(r, C.programaProposta.proposta);
    const lista = programaDaProposta.get(idProposta);
    if (lista) lista.push(idPrograma);
    else programaDaProposta.set(idProposta, [idPrograma]);
  }

  ctx.log('Transferegov: propostas');
  const proprias = new Map();
  const estatisticas = new Map([...monitorados].map((id) => [id, novoAcumulador()]));
  const rankingUf = new Map();
  for await (const r of lerTabela('proposta', ctx)) {
    const id = campo(r, C.proposta.id);
    const ano = anoDe(campo(r, C.proposta.ano), campo(r, C.proposta.data));
    if (ano && ano < alvo.desde) continue;
    const doMunicipio = propostaDoMunicipio(r, alvo);
    if (doMunicipio) {
      proprias.set(id, {
        id,
        numero: campo(r, C.proposta.numero),
        ano,
        data: paraDataIso(campo(r, C.proposta.data)),
        proponente: campo(r, C.proposta.proponente),
        documento: somenteDigitos(campo(r, C.proposta.documento)),
        proponenteMunicipal: proponentePublicoMunicipal(r, alvo),
        orgaoSuperior: campo(r, C.proposta.orgaoSuperior),
        orgao: campo(r, C.proposta.orgao),
        modalidade: campo(r, C.proposta.modalidade),
        situacaoProposta: campo(r, C.proposta.situacao),
        objeto: campo(r, C.proposta.objeto),
        valorGlobal: paraNumero(campo(r, C.proposta.valorGlobal)),
        valorRepasse: paraNumero(campo(r, C.proposta.valorRepasse)),
        valorContrapartida: paraNumero(campo(r, C.proposta.valorContrapartida)),
        programas: programaDaProposta.get(id) ?? [],
      });
    }

    const vinculados = programaDaProposta.get(id);
    if (!vinculados || !/MUNICIP/.test(normalizar(campo(r, C.proposta.natureza)))) continue;
    const mesmaUf = normalizar(campo(r, C.proposta.uf)) === alvo.uf;
    const aprovada = classificarProposta(campo(r, C.proposta.situacao)) === STATUS.CAPTADA;
    const valor = paraNumero(campo(r, C.proposta.valorRepasse));
    for (const idPrograma of vinculados) {
      const acc = estatisticas.get(idPrograma);
      if (aprovada) acc.valoresBrasil.push(valor);
      if (!mesmaUf) continue;
      acc.propostasUf++;
      acc.municipiosUf.add(normalizar(campo(r, C.proposta.municipio)));
      if (aprovada) {
        acc.aprovadasUf++;
        acc.valoresUf.push(valor);
      }
    }
    if (mesmaUf) {
      const municipio = campo(r, C.proposta.municipio);
      const chave = normalizar(municipio);
      const linha = rankingUf.get(chave) ?? { municipio, propostas: 0, aprovadas: 0, valorAprovado: 0 };
      linha.propostas++;
      if (aprovada) {
        linha.aprovadas++;
        linha.valorAprovado += valor;
      }
      rankingUf.set(chave, linha);
    }
  }
  ctx.log(`  ${proprias.size} propostas do municipio desde ${alvo.desde}`);

  const semPrograma = [...proprias.values()].filter((p) => !p.programas.length);
  if (semPrograma.length) {
    const ids = new Set(semPrograma.map((p) => p.id));
    for await (const r of lerTabela('programaProposta', ctx)) {
      const idProposta = campo(r, C.programaProposta.proposta);
      if (ids.has(idProposta)) proprias.get(idProposta).programas.push(campo(r, C.programaProposta.programa));
    }
  }

  ctx.log('Transferegov: convenios');
  for await (const r of lerTabela('convenio', ctx)) {
    const proposta = proprias.get(campo(r, C.convenio.proposta));
    if (!proposta) continue;
    proposta.convenio = {
      numero: campo(r, C.convenio.numero),
      assinatura: paraDataIso(campo(r, C.convenio.assinatura)),
      situacao: campo(r, C.convenio.situacao),
      subsituacao: campo(r, C.convenio.subsituacao),
      fimVigencia: paraDataIso(campo(r, C.convenio.fimVigencia)),
      valorGlobal: paraNumero(campo(r, C.convenio.valorGlobal)),
      valorRepasse: paraNumero(campo(r, C.convenio.valorRepasse)),
      valorDesembolsado: paraNumero(campo(r, C.convenio.valorDesembolsado)),
      saldoDevolvido: paraNumero(campo(r, C.convenio.saldoDevolvido)),
    };
  }

  ctx.log('Transferegov: emendas');
  for await (const r of lerTabela('emenda', ctx)) {
    const proposta = proprias.get(campo(r, C.emenda.proposta));
    if (!proposta) continue;
    proposta.emendas ??= [];
    proposta.emendas.push({
      numero: campo(r, C.emenda.numero),
      parlamentar: campo(r, C.emenda.parlamentar),
      tipo: campo(r, C.emenda.tipo),
      impositiva: campo(r, C.emenda.impositiva),
      valor: paraNumero(campo(r, C.emenda.valor)),
    });
  }

  const propostas = [...proprias.values()].map((p) => classificarPropostaPropria(p, programas, classificar));
  const oportunidades = avaliarProgramas(programas, monitorados, estatisticas, propostas, alvo);

  if (!proprias.size) avisos.push('Nenhuma proposta do municipio encontrada: confira --ibge, --municipio e --uf.');
  return {
    fonte: 'Transferegov (dados abertos SICONV)',
    geradoEm: new Date().toISOString(),
    propostas,
    oportunidades,
    rankingUf: [...rankingUf.values()].sort((a, b) => b.valorAprovado - a.valorAprovado),
    avisos,
  };
}

function classificarPropostaPropria(p, programas, classificar) {
  const nomesProgramas = p.programas.map((id) => programas.get(id)?.nome).filter(Boolean);
  const ambiental = classificar(p.objeto, ...nomesProgramas, p.orgaoSuperior);
  let status = classificarProposta(p.situacaoProposta);
  let valorCaptado = 0;
  let valorPerdido = 0;
  if (p.convenio) {
    status = classificarConvenio(p.convenio.situacao);
    if (status === STATUS.PERDIDA_POS_CELEBRACAO) {
      // O que chegou a ser desembolsado costuma ser devolvido; nao conta como captado.
      valorPerdido = Math.max(p.convenio.valorRepasse - p.convenio.valorDesembolsado, 0);
    } else {
      valorCaptado = p.convenio.valorRepasse || p.valorRepasse;
    }
  } else if (status === STATUS.CAPTADA) {
    valorCaptado = p.valorRepasse;
  } else if (status === STATUS.PERDIDA_REJEITADA || status === STATUS.PERDIDA_CANCELADA) {
    valorPerdido = p.valorRepasse;
  }
  const emendas = p.emendas ?? [];
  return {
    ...p,
    programasNomes: nomesProgramas,
    ambiental,
    status,
    origem: emendas.length ? 'Emenda parlamentar' : 'Proposta voluntaria',
    parlamentares: [...new Set(emendas.map((e) => e.parlamentar).filter(Boolean))],
    valorEmendas: emendas.reduce((soma, e) => soma + e.valor, 0),
    valorCaptado,
    valorPerdido,
  };
}

function avaliarProgramas(programas, monitorados, estatisticas, propostas, alvo) {
  const hoje = hojeIso();
  const pleiteados = new Set(propostas.filter((p) => p.proponenteMunicipal).flatMap((p) => p.programas));
  const resultado = [];
  for (const id of monitorados) {
    const p = programas.get(id);
    if (pleiteados.has(id)) continue;
    const acc = estatisticas.get(id);
    const potencialUf = mediana(acc.valoresUf);
    const potencial = potencialUf || mediana(acc.valoresBrasil);
    const abertoAgora = [p.propostas, p.emendas, p.beneficiario].some((j) => j && (!j.fim || j.fim >= hoje) && (!j.inicio || j.inicio <= hoje));
    let status;
    if (abertoAgora) status = STATUS.EM_ABERTO;
    else if (p.propostas) status = STATUS.NAO_PLEITEADA;
    else if (p.emendas || p.beneficiario) status = STATUS.EMENDA_NAO_OBTIDA;
    else continue;
    resultado.push({
      id,
      codigo: p.codigo,
      nome: p.nome,
      orgaoSuperior: p.orgaoSuperior,
      ano: p.ano,
      janelaPropostas: p.propostas,
      janelaEmendas: p.emendas,
      eixos: p.ambiental.eixos,
      status,
      valorPotencial: potencial,
      baseValorPotencial: potencialUf ? `mediana aprovada na UF (${acc.valoresUf.length})` : acc.valoresBrasil.length ? `mediana aprovada no Brasil (${acc.valoresBrasil.length})` : 'sem referencia',
      propostasNaUf: acc.propostasUf,
      aprovadasNaUf: acc.aprovadasUf,
      municipiosNaUf: acc.municipiosUf.size,
      taxaAprovacaoUf: acc.propostasUf ? acc.aprovadasUf / acc.propostasUf : null,
    });
  }
  return resultado.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0) || b.valorPotencial - a.valorPotencial);
}
