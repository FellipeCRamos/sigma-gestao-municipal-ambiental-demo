// Consolida as coletas numa matriz unica de oportunidades, calcula indicadores
// de desempenho e o cenario contrafactual "com sistema de gestao".

import { readFile } from 'node:fs/promises';

import { DESCRICAO_STATUS, STATUS, STATUS_PERDIDOS } from './classificacao.mjs';
import { gerarCsv, registrosCsv } from './csv.mjs';
import { formatarMoeda, formatarPercentual, normalizar, paraNumero } from './texto.mjs';

export const COLUNAS_MATRIZ = [
  { chave: 'esfera', titulo: 'esfera' },
  { chave: 'fonte', titulo: 'fonte' },
  { chave: 'tipo', titulo: 'tipo' },
  { chave: 'identificador', titulo: 'identificador' },
  { chave: 'ano', titulo: 'ano' },
  { chave: 'titulo', titulo: 'titulo' },
  { chave: 'concedente', titulo: 'concedente' },
  { chave: 'origem', titulo: 'origem' },
  { chave: 'status', titulo: 'status' },
  { chave: 'valorCaptado', titulo: 'valor_captado', valor: (l) => (l.valorCaptado || 0).toFixed(2).replace('.', ',') },
  { chave: 'valorPerdido', titulo: 'valor_perdido', valor: (l) => (l.valorPerdido || 0).toFixed(2).replace('.', ',') },
  { chave: 'valorPotencial', titulo: 'valor_potencial', valor: (l) => (l.valorPotencial || 0).toFixed(2).replace('.', ',') },
  { chave: 'taxaAprovacao', titulo: 'taxa_aprovacao', valor: (l) => (Number.isFinite(l.taxaAprovacao) ? l.taxaAprovacao.toFixed(3).replace('.', ',') : '') },
  { chave: 'eixos', titulo: 'eixos', valor: (l) => (l.eixos ?? []).join(' / ') },
  { chave: 'ambiental', titulo: 'ambiental', valor: (l) => (l.ambiental ? 'sim' : 'nao') },
  { chave: 'proponenteMunicipal', titulo: 'proponente_municipal', valor: (l) => (l.proponenteMunicipal === false ? 'nao' : 'sim') },
  { chave: 'parlamentares', titulo: 'parlamentares', valor: (l) => (l.parlamentares ?? []).join(' / ') },
  { chave: 'observacao', titulo: 'observacao' },
  { chave: 'link', titulo: 'link' },
];

export const COLUNAS_MANUAIS = ['esfera', 'fonte', 'tipo', 'identificador', 'ano', 'titulo', 'concedente', 'origem', 'status', 'valor_captado', 'valor_perdido', 'valor_potencial', 'taxa_aprovacao', 'eixos', 'observacao', 'link'];

export async function lerJsonOpcional(caminho) {
  try {
    return JSON.parse(await readFile(caminho, 'utf8'));
  } catch (erro) {
    if (erro.code === 'ENOENT') return null;
    throw new Error(`${caminho}: ${erro.message}`);
  }
}

export async function lerManuais(stream) {
  const linhas = [];
  const avisos = [];
  for await (const r of registrosCsv(stream)) {
    if (!Object.values(r).some(Boolean)) continue;
    let status = normalizar(r.STATUS).replace(/\s+/g, '_');
    if (!STATUS[status]) {
      avisos.push(`Status "${r.STATUS}" invalido em "${r.TITULO}"; tratado como INFORMATIVO.`);
      status = STATUS.INFORMATIVO;
    }
    linhas.push({
      esfera: r.ESFERA || 'Nao informada',
      fonte: r.FONTE || 'Levantamento manual',
      tipo: r.TIPO,
      identificador: r.IDENTIFICADOR,
      ano: Number(r.ANO) || null,
      titulo: r.TITULO,
      concedente: r.CONCEDENTE,
      origem: r.ORIGEM,
      status,
      valorCaptado: paraNumero(r.VALOR_CAPTADO),
      valorPerdido: paraNumero(r.VALOR_PERDIDO),
      valorPotencial: paraNumero(r.VALOR_POTENCIAL),
      taxaAprovacao: r.TAXA_APROVACAO ? paraNumero(r.TAXA_APROVACAO) : null,
      eixos: r.EIXOS ? r.EIXOS.split('/').map((e) => e.trim()).filter(Boolean) : [],
      ambiental: true,
      proponenteMunicipal: true,
      observacao: r.OBSERVACAO,
      link: r.LINK,
    });
  }
  return { linhas, avisos };
}

export function montarMatriz({ transferegov, pix, transparencia, ckan, manuais = [] }) {
  const linhas = [];
  const conveniosTransferegov = new Set();

  for (const p of transferegov?.propostas ?? []) {
    if (p.convenio?.numero) conveniosTransferegov.add(String(p.convenio.numero));
    linhas.push({
      esfera: 'Federal',
      fonte: 'Transferegov',
      tipo: p.modalidade || 'Convenio / contrato de repasse',
      identificador: p.convenio?.numero ? `Convenio ${p.convenio.numero}` : `Proposta ${p.numero}`,
      ano: p.ano,
      titulo: p.programasNomes?.[0] || String(p.objeto ?? '').slice(0, 140),
      concedente: p.orgaoSuperior,
      origem: p.origem,
      status: p.status,
      valorCaptado: p.valorCaptado,
      valorPerdido: p.valorPerdido,
      valorPotencial: 0,
      eixos: p.ambiental?.eixos,
      ambiental: p.ambiental?.relevante,
      proponenteMunicipal: p.proponenteMunicipal,
      parlamentares: p.parlamentares,
      observacao: [
        p.proponente,
        p.convenio?.situacao || p.situacaoProposta,
        p.convenio?.valorDesembolsado ? `desembolsado ${formatarMoeda(p.convenio.valorDesembolsado)}` : '',
        p.objeto,
      ].filter(Boolean).join(' | '),
    });
  }

  for (const o of transferegov?.oportunidades ?? []) {
    linhas.push({
      esfera: 'Federal',
      fonte: 'Transferegov',
      tipo: 'Programa (chamamento)',
      identificador: `Programa ${o.codigo || o.id}`,
      ano: o.ano,
      titulo: o.nome,
      concedente: o.orgaoSuperior,
      origem: o.status === STATUS.EMENDA_NAO_OBTIDA ? 'Emenda parlamentar' : 'Proposta voluntaria',
      status: o.status,
      valorCaptado: 0,
      valorPerdido: 0,
      valorPotencial: o.valorPotencial,
      taxaAprovacao: o.taxaAprovacaoUf,
      eixos: o.eixos,
      ambiental: true,
      proponenteMunicipal: true,
      observacao: `${o.propostasNaUf} propostas de ${o.municipiosNaUf} municipios da UF, ${o.aprovadasNaUf} aprovadas; potencial: ${o.baseValorPotencial}`
        + (o.janelaPropostas ? `; janela ${o.janelaPropostas.inicio ?? '?'} a ${o.janelaPropostas.fim ?? '?'}` : ''),
    });
  }

  for (const item of pix?.itens ?? []) {
    const perdida = STATUS_PERDIDOS.has(item.status);
    linhas.push({
      esfera: 'Federal',
      fonte: 'Transferencias especiais',
      tipo: 'Emenda PIX',
      identificador: item.emenda ? `Emenda ${item.emenda}` : '',
      ano: item.ano,
      titulo: `Transferencia especial${item.parlamentar ? ` - ${item.parlamentar}` : ''}`,
      concedente: 'Emenda individual (art. 166-A CF)',
      origem: 'Emenda parlamentar',
      status: item.status,
      valorCaptado: perdida ? 0 : item.valor,
      valorPerdido: perdida ? item.valor : 0,
      valorPotencial: 0,
      eixos: item.ambiental?.eixos,
      ambiental: item.ambiental?.relevante,
      proponenteMunicipal: true,
      parlamentares: item.parlamentar ? [item.parlamentar] : [],
      observacao: item.situacao,
    });
  }

  for (const item of transparencia?.itens ?? []) {
    if (item.numero && conveniosTransferegov.has(String(item.numero))) continue;
    const perdida = STATUS_PERDIDOS.has(item.status);
    linhas.push({
      esfera: 'Federal',
      fonte: 'Portal da Transparencia',
      tipo: 'Convenio',
      identificador: item.numero ? `Convenio ${item.numero}` : '',
      ano: item.ano,
      titulo: String(item.objeto ?? '').slice(0, 140),
      concedente: item.orgao,
      origem: '',
      status: item.status,
      valorCaptado: perdida ? item.valorLiberado : item.valor,
      valorPerdido: perdida ? Math.max(item.valor - item.valorLiberado, 0) : 0,
      valorPotencial: 0,
      eixos: item.ambiental?.eixos,
      ambiental: item.ambiental?.relevante,
      proponenteMunicipal: true,
      observacao: [item.convenente, item.situacao].filter(Boolean).join(' | '),
    });
  }

  for (const recurso of ckan?.recursos ?? []) {
    const somas = Object.entries(recurso.somas ?? {}).map(([coluna, valor]) => `${coluna}=${formatarMoeda(valor)}`).join('; ');
    linhas.push({
      esfera: 'Estadual',
      fonte: recurso.portal,
      tipo: 'Dados abertos',
      identificador: recurso.recurso,
      ano: null,
      titulo: recurso.conjunto,
      concedente: '',
      origem: '',
      status: STATUS.INFORMATIVO,
      valorCaptado: 0,
      valorPerdido: 0,
      valorPotencial: 0,
      eixos: [],
      ambiental: recurso.ambientais > 0,
      proponenteMunicipal: true,
      observacao: `${recurso.total} linhas citam o municipio (${recurso.ambientais} com termos ambientais)${somas ? `; ${somas}` : ''}`,
      link: recurso.pagina,
    });
  }

  linhas.push(...manuais);
  return linhas;
}

function somar(linhas, chave) {
  return linhas.reduce((soma, linha) => soma + (Number(linha[chave]) || 0), 0);
}

export function calcularIndicadores(linhas, alvo, rankingUf = []) {
  const foco = linhas.filter((l) => l.ambiental && l.proponenteMunicipal !== false && l.status !== STATUS.INFORMATIVO);
  const por = (status) => foco.filter((l) => l.status === status);
  const captadas = foco.filter((l) => l.status === STATUS.CAPTADA || l.status === STATUS.RISCO);
  const perdasApresentadas = foco.filter((l) => [STATUS.PERDIDA_REJEITADA, STATUS.PERDIDA_CANCELADA, STATUS.PERDIDA_POS_CELEBRACAO].includes(l.status));
  const apresentadas = foco.filter((l) => l.fonte === 'Transferegov' && l.tipo !== 'Programa (chamamento)');
  const decididas = apresentadas.filter((l) => l.status !== STATUS.EM_ANDAMENTO);
  const aprovadas = decididas.filter((l) => [STATUS.CAPTADA, STATUS.RISCO, STATUS.PERDIDA_POS_CELEBRACAO].includes(l.status));
  const naoPleiteadas = por(STATUS.NAO_PLEITEADA);
  const elegiveis = naoPleiteadas.length + new Set(apresentadas.map((l) => l.titulo)).size;
  const captadoTotal = somar(captadas, 'valorCaptado');
  const captadoEmenda = somar(captadas.filter((l) => /EMENDA/.test(normalizar(l.origem))), 'valorCaptado');

  const conjuntoCaptadas = new Set(captadas);
  const anos = new Map();
  for (const linha of foco) {
    const ano = linha.ano ?? 'sem ano';
    const acc = anos.get(ano) ?? { ano, captado: 0, perdido: 0, potencial: 0, captadas: 0, perdidas: 0, naoPleiteadas: 0 };
    if (conjuntoCaptadas.has(linha)) { acc.captado += linha.valorCaptado || 0; acc.captadas++; }
    if (STATUS_PERDIDOS.has(linha.status)) { acc.perdido += linha.valorPerdido || 0; acc.perdidas++; }
    if (linha.status === STATUS.NAO_PLEITEADA) { acc.potencial += linha.valorPotencial || 0; acc.naoPleiteadas++; }
    anos.set(ano, acc);
  }

  const posicao = rankingUf.findIndex((linha) => normalizar(linha.municipio) === alvo.municipioNormalizado);

  return {
    captadoTotal,
    captadas: captadas.length,
    aderidas: por(STATUS.ADERIDA).length,
    emAndamento: por(STATUS.EM_ANDAMENTO).length,
    emAberto: por(STATUS.EM_ABERTO).length,
    risco: por(STATUS.RISCO).length,
    perdidoApresentadas: somar(perdasApresentadas, 'valorPerdido'),
    perdasApresentadas: perdasApresentadas.length,
    naoPleiteadas: naoPleiteadas.length,
    potencialNaoPleiteado: somar(naoPleiteadas, 'valorPotencial'),
    emendaNaoObtida: por(STATUS.EMENDA_NAO_OBTIDA).length,
    propostasApresentadas: apresentadas.length,
    propostasAprovadas: aprovadas.length,
    taxaSucesso: decididas.length ? aprovadas.length / decididas.length : null,
    taxaAproveitamento: elegiveis ? (elegiveis - naoPleiteadas.length) / elegiveis : null,
    dependenciaEmendas: captadoTotal ? captadoEmenda / captadoTotal : null,
    posicaoRankingUf: posicao >= 0 ? posicao + 1 : null,
    municipiosRankingUf: rankingUf.length,
    porAno: [...anos.values()].sort((a, b) => String(a.ano).localeCompare(String(b.ano))),
  };
}

export function simularCenarios(linhas, indicadores, configCenario) {
  const foco = linhas.filter((l) => l.ambiental && l.proponenteMunicipal !== false);
  const naoPleiteadas = foco.filter((l) => l.status === STATUS.NAO_PLEITEADA);
  const valorEsperado = naoPleiteadas.reduce((soma, l) => {
    const taxa = Number.isFinite(l.taxaAprovacao) && l.taxaAprovacao > 0 ? l.taxaAprovacao : configCenario.taxaAprovacaoPadrao;
    return soma + (l.valorPotencial || 0) * taxa;
  }, 0);
  const perdas = indicadores.perdidoApresentadas;
  return Object.entries(configCenario.cenarios).map(([nome, premissas]) => {
    const ganhoOportunidades = valorEsperado * premissas.cobertura;
    const ganhoPerdasEvitadas = perdas * premissas.reducaoPerdas;
    const total = indicadores.captadoTotal + ganhoOportunidades + ganhoPerdasEvitadas;
    return {
      nome,
      ...premissas,
      ganhoOportunidades,
      ganhoPerdasEvitadas,
      captadoComSistema: total,
      variacao: indicadores.captadoTotal ? total / indicadores.captadoTotal - 1 : null,
    };
  });
}

function tabela(cabecalho, linhas) {
  const escapar = (valor) => String(valor ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  return [
    `| ${cabecalho.join(' | ')} |`,
    `| ${cabecalho.map(() => '---').join(' | ')} |`,
    ...linhas.map((linha) => `| ${linha.map(escapar).join(' | ')} |`),
  ].join('\n');
}

function secaoPortalTp(portalTp) {
  if (!portalTp?.consultas?.length) return [];
  const linhas = [];
  for (const consulta of portalTp.consultas) {
    for (const [ano, dados] of Object.entries(consulta.anos)) {
      if (!dados.doOrgao) continue;
      const somas = Object.entries(dados.somas).map(([campo, valor]) => `${campo}: ${formatarMoeda(valor)}`).join('; ');
      linhas.push([consulta.consulta, ano, dados.porUnidade, dados.doOrgao - dados.porUnidade, somas || '-']);
    }
  }
  return [
    '## Execucao do orgao no portal municipal',
    '',
    `Portal: ${portalTp.portal} - termos: ${portalTp.termos.join(', ')}. "Pela unidade" = registro com unidade/orgao igual ao termo; "so no texto" = o termo aparece em outro campo (ex.: objeto) e precisa de conferencia.`,
    '',
    linhas.length ? tabela(['Consulta', 'Ano', 'Pela unidade', 'So no texto', 'Somas (pela unidade)'], linhas) : '_Nenhum registro do orgao encontrado._',
    '',
  ];
}

export function gerarMarkdown({ alvo, linhas, indicadores, cenarios, avisos, portalTp, configCenario }) {
  const foco = linhas.filter((l) => l.ambiental && l.proponenteMunicipal !== false);
  const top = (status, chave, n) => foco.filter((l) => status.includes(l.status)).sort((a, b) => (b[chave] || 0) - (a[chave] || 0)).slice(0, n);
  const i = indicadores;
  const md = [
    `# Captacao de recursos na area ambiental - ${alvo.municipio}/${alvo.uf}`,
    '',
    `Periodo: ${alvo.desde} a ${new Date().getFullYear()} - gerado em ${new Date().toLocaleString('pt-BR')}.`,
    'Escopo: programas, convenios, emendas, adesoes e compensacoes com relevancia ambiental (eixos do config.json) em que o municipio e o proponente.',
    '',
    '## Indicadores-chave',
    '',
    tabela(['Indicador', 'Valor'], [
      ['Recursos captados (ambientais)', `${formatarMoeda(i.captadoTotal)} em ${i.captadas} iniciativas`],
      ['Adesoes sem repasse direto', i.aderidas],
      ['Propostas apresentadas no Transferegov', i.propostasApresentadas],
      ['Taxa de sucesso das propostas', formatarPercentual(i.taxaSucesso)],
      ['Perdido depois de apresentar (rejeicao, cancelamento, anulacao)', `${formatarMoeda(i.perdidoApresentadas)} em ${i.perdasApresentadas} casos`],
      ['Programas elegiveis nao pleiteados', `${i.naoPleiteadas} (potencial estimado ${formatarMoeda(i.potencialNaoPleiteado)})`],
      ['Taxa de aproveitamento de oportunidades', formatarPercentual(i.taxaAproveitamento)],
      ['Programas so por emenda sem emenda obtida', i.emendaNaoObtida],
      ['Dependencia de emendas no valor captado', formatarPercentual(i.dependenciaEmendas)],
      ['Oportunidades com prazo aberto agora', i.emAberto],
      ['Posicao na UF (valor aprovado em programas ambientais)', i.posicaoRankingUf ? `${i.posicaoRankingUf}a de ${i.municipiosRankingUf}` : 'nao ranqueado'],
    ]),
    '',
    '## Evolucao anual',
    '',
    tabela(['Ano', 'Captado', 'Iniciativas', 'Perdido', 'Perdas', 'Potencial nao pleiteado', 'Nao pleiteadas'],
      i.porAno.map((a) => [a.ano, formatarMoeda(a.captado), a.captadas, formatarMoeda(a.perdido), a.perdidas, formatarMoeda(a.potencial), a.naoPleiteadas])),
    '',
    '## Oportunidades com prazo aberto (acao imediata)',
    '',
    tabela(['Programa', 'Concedente', 'Potencial', 'Observacao'],
      top([STATUS.EM_ABERTO], 'valorPotencial', 30).map((l) => [l.titulo, l.concedente, formatarMoeda(l.valorPotencial), l.observacao])),
    '',
    '## Perdas depois de apresentar a proposta',
    '',
    tabela(['Ano', 'Status', 'Titulo', 'Concedente', 'Valor perdido'],
      top([STATUS.PERDIDA_REJEITADA, STATUS.PERDIDA_CANCELADA, STATUS.PERDIDA_POS_CELEBRACAO], 'valorPerdido', 30)
        .map((l) => [l.ano, l.status, l.titulo, l.concedente, formatarMoeda(l.valorPerdido)])),
    '',
    '## Programas elegiveis nao pleiteados (maior potencial)',
    '',
    tabela(['Ano', 'Programa', 'Concedente', 'Potencial', 'Aprovacao na UF', 'Observacao'],
      top([STATUS.NAO_PLEITEADA], 'valorPotencial', 40)
        .map((l) => [l.ano, l.titulo, l.concedente, formatarMoeda(l.valorPotencial), formatarPercentual(l.taxaAprovacao), l.observacao])),
    '',
    '## Recursos captados',
    '',
    tabela(['Ano', 'Fonte', 'Titulo', 'Origem', 'Valor', 'Parlamentares'],
      top([STATUS.CAPTADA, STATUS.RISCO, STATUS.ADERIDA], 'valorCaptado', 60)
        .map((l) => [l.ano, l.fonte, l.titulo, l.origem, formatarMoeda(l.valorCaptado), (l.parlamentares ?? []).join(', ')])),
    '',
    '## Cenario com sistema de gestao',
    '',
    'Estimativa contrafactual: quanto teria sido captado se a secretaria tivesse monitoramento continuo de editais, banco de projetos, checklist de habilitacao e controle de prazos e pendencias.',
    '',
    tabela(['Cenario', 'Cobertura das oportunidades', 'Perdas evitadas', 'Ganho em oportunidades', 'Ganho em perdas evitadas', 'Captado com sistema', 'Variacao'],
      cenarios.map((c) => [c.nome, formatarPercentual(c.cobertura), formatarPercentual(c.reducaoPerdas), formatarMoeda(c.ganhoOportunidades), formatarMoeda(c.ganhoPerdasEvitadas), formatarMoeda(c.captadoComSistema), formatarPercentual(c.variacao)])),
    '',
    `Premissas: o potencial de cada programa nao pleiteado e a mediana do valor aprovado para municipios (da UF quando ha, senao do Brasil), multiplicada pela taxa de aprovacao observada na UF (ou ${formatarPercentual(configCenario.taxaAprovacaoPadrao)} quando nao ha historico). ${configCenario.$comentario ?? ''}`,
    '',
    ...secaoPortalTp(portalTp),
    '## Legenda de status',
    '',
    tabela(['Status', 'Significado'], Object.entries(DESCRICAO_STATUS)),
    '',
    '## Avisos e limitacoes',
    '',
    ...(avisos.length ? avisos.map((a) => `- ${a}`) : ['- Nenhum aviso de coleta.']),
    '- Programas estaduais por adesao (portarias, editais de fundos estaduais), compensacoes ambientais e acordos judiciais nao tem base unica de dados abertos: registre-os em oportunidades-manuais.csv.',
    '- A classificacao ambiental e por palavras-chave: revise a coluna "ambiental" da matriz antes de divulgar numeros.',
    '',
  ];
  return md.join('\n');
}

export function gerarCsvMatriz(linhas) {
  return gerarCsv(linhas, COLUNAS_MATRIZ);
}
