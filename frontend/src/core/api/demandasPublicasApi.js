import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from './httpClient';

export async function getDemandasPublicasAdmin(filters = {}) {
  return fetchJson(`/demandas-publicas${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getDemandaPublicaAdmin(id) {
  return fetchJson(`/demandas-publicas/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function updateDemandaPublicaStatus(id, payload) {
  return fetchJson(`/demandas-publicas/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function assignDemandaPublicaResponsavel(id, payload) {
  return fetchJson(`/demandas-publicas/${id}/responsavel`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function createDemandaPublicaMovimentacao(id, payload) {
  return fetchJson(`/demandas-publicas/${id}/movimentacoes`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function closeDemandaPublica(id, payload) {
  return fetchJson(`/demandas-publicas/${id}/encerrar`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}
