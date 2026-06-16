import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from './httpClient';

export async function getFiscalizacoes(filters = {}) {
  return fetchJson(`/fiscalizacoes${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getFiscalizacao(id) {
  return fetchJson(`/fiscalizacoes/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function convertDemandaToFiscalizacao(demandaId, payload) {
  return fetchJson(`/fiscalizacoes/converter-demanda/${demandaId}`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateFiscalizacaoStatus(id, payload) {
  return fetchJson(`/fiscalizacoes/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function assignFiscalizacaoResponsavel(id, payload) {
  return fetchJson(`/fiscalizacoes/${id}/responsavel`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function createFiscalizacaoMovimentacao(id, payload) {
  return fetchJson(`/fiscalizacoes/${id}/movimentacoes`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function closeFiscalizacaoPreliminarmente(id, payload) {
  return fetchJson(`/fiscalizacoes/${id}/encerrar-preliminarmente`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getFiscalizacaoAnexos(id) {
  return fetchJson(`/fiscalizacoes/${id}/anexos`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}
