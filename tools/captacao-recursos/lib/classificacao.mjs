// Regras de classificacao compartilhadas entre as fontes e o relatorio.

import { criarCasador, normalizar } from './texto.mjs';

export const STATUS = Object.freeze({
  CAPTADA: 'CAPTADA',
  ADERIDA: 'ADERIDA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  EM_ABERTO: 'EM_ABERTO',
  RISCO: 'RISCO',
  PERDIDA_REJEITADA: 'PERDIDA_REJEITADA',
  PERDIDA_CANCELADA: 'PERDIDA_CANCELADA',
  PERDIDA_POS_CELEBRACAO: 'PERDIDA_POS_CELEBRACAO',
  NAO_PLEITEADA: 'NAO_PLEITEADA',
  EMENDA_NAO_OBTIDA: 'EMENDA_NAO_OBTIDA',
  INFORMATIVO: 'INFORMATIVO',
});

export const DESCRICAO_STATUS = Object.freeze({
  CAPTADA: 'Recurso contratado ou recebido',
  ADERIDA: 'Adesao formalizada (sem repasse direto ou repasse a confirmar)',
  EM_ANDAMENTO: 'Proposta em analise ou em complementacao',
  EM_ABERTO: 'Oportunidade com prazo vigente: acao imediata',
  RISCO: 'Captada, mas com prestacao de contas rejeitada ou inadimplencia',
  PERDIDA_REJEITADA: 'Perdida: proposta rejeitada',
  PERDIDA_CANCELADA: 'Perdida: proposta cancelada ou desistencia',
  PERDIDA_POS_CELEBRACAO: 'Perdida apos celebracao: convenio anulado, rescindido ou cancelado',
  NAO_PLEITEADA: 'Perdida: municipio elegivel nao apresentou proposta',
  EMENDA_NAO_OBTIDA: 'Programa acessivel so por emenda parlamentar: nenhuma emenda obtida',
  INFORMATIVO: 'Registro encontrado, sem classificacao automatica',
});

export const STATUS_PERDIDOS = new Set([
  STATUS.PERDIDA_REJEITADA,
  STATUS.PERDIDA_CANCELADA,
  STATUS.PERDIDA_POS_CELEBRACAO,
  STATUS.NAO_PLEITEADA,
]);

// Situacao da proposta no Transferegov -> status.
export function classificarProposta(situacao) {
  const texto = normalizar(situacao);
  if (/REJEITAD|REPROVAD|INDEFERID/.test(texto)) return STATUS.PERDIDA_REJEITADA;
  if (/CANCELAD|DESISTEN|EXCLUID|ANULAD/.test(texto)) return STATUS.PERDIDA_CANCELADA;
  if (/APROVAD|CELEBRAD|ASSINAD|CONTRATAD/.test(texto)) return STATUS.CAPTADA;
  return STATUS.EM_ANDAMENTO;
}

// Situacao do convenio no Transferegov -> status.
export function classificarConvenio(situacao) {
  const texto = normalizar(situacao);
  if (/ANULAD|RESCIN|CANCELAD|EXTINT|DISTRAT/.test(texto)) return STATUS.PERDIDA_POS_CELEBRACAO;
  if (/REJEITAD|INADIMPL|TOMADA DE CONTAS/.test(texto)) return STATUS.RISCO;
  return STATUS.CAPTADA;
}

// Casador de relevancia ambiental a partir dos eixos do config.
export function criarClassificadorAmbiental(config) {
  const eixos = Object.entries(config.eixosAmbientais ?? {}).map(([eixo, termos]) => ({ eixo, casar: criarCasador(termos) }));
  const exclusoes = (config.expressoesExcluidas ?? []).map(normalizar).filter(Boolean);
  return (...textos) => {
    let alvo = normalizar(textos.filter(Boolean).join(' | '));
    for (const expressao of exclusoes) alvo = alvo.split(expressao).join(' ');
    const encontrados = [];
    const termos = new Set();
    for (const { eixo, casar } of eixos) {
      const achados = casar(alvo);
      if (achados.length) {
        encontrados.push(eixo);
        achados.forEach((termo) => termos.add(termo));
      }
    }
    return { relevante: encontrados.length > 0, eixos: encontrados, termos: [...termos] };
  };
}
