import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from '../../../core/api/httpClient';

export async function getViveiroDashboard() {
  return fetchJson('/viveiro/dashboard', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getViveiroEspecies(filters = {}) {
  return fetchJson(`/viveiro/especies${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createViveiroEspecie(payload) {
  return fetchJson('/viveiro/especies', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateViveiroEspecie(id, payload) {
  return fetchJson(`/viveiro/especies/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getViveiroLotes(filters = {}) {
  return fetchJson(`/viveiro/lotes${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createViveiroLote(payload) {
  return fetchJson('/viveiro/lotes', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateViveiroLote(id, payload) {
  return fetchJson(`/viveiro/lotes/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getViveiroEstoque() {
  return fetchJson('/viveiro/estoque', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getViveiroMovimentacoes(filters = {}) {
  return fetchJson(`/viveiro/movimentacoes${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createViveiroMovimentacaoAjuste(payload) {
  return fetchJson('/viveiro/movimentacoes', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getViveiroSolicitacoes(filters = {}) {
  return fetchJson(`/viveiro/solicitacoes${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getViveiroSolicitacaoDetalhe(id) {
  return fetchJson(`/viveiro/solicitacoes/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createViveiroSolicitacao(payload) {
  return fetchJson('/viveiro/solicitacoes', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function analyzeViveiroSolicitacao(id, payload) {
  return fetchJson(`/viveiro/solicitacoes/${id}/analise`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getViveiroEntregas(filters = {}) {
  return fetchJson(`/viveiro/entregas${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getViveiroEntregaComprovante(id) {
  return fetchJson(`/viveiro/entregas/${id}/comprovante`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createViveiroEntrega(payload) {
  return fetchJson('/viveiro/entregas', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function cancelViveiroEntrega(id, payload) {
  return fetchJson(`/viveiro/entregas/${id}/cancelamento`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}
