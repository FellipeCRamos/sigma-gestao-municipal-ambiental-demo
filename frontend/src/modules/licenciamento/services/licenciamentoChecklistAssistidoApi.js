import {
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from '../../../core/api/httpClient';

const BASE_PATH = '/licenciamento/checklist-assistido';

function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getChecklistAssistidoStatus() {
  return fetchJson(`${BASE_PATH}/status`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getChecklistAssistidoItens(filters = {}) {
  return fetchJson(`${BASE_PATH}/itens${buildQuery(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getChecklistAssistidoPendencias() {
  return fetchJson(`${BASE_PATH}/itens/pendentes`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getChecklistAssistidoItem(id) {
  return fetchJson(`${BASE_PATH}/itens/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getChecklistAssistidoSugestao(id) {
  return fetchJson(`${BASE_PATH}/itens/${id}/sugestao`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function updateChecklistAssistidoItem(id, payload) {
  return fetchJson(`${BASE_PATH}/itens/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export function runChecklistAssistidoDiagnostico() {
  return fetchJson(`${BASE_PATH}/diagnostico`, {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function applyChecklistAssistidoSugestao(id) {
  return fetchJson(`${BASE_PATH}/aplicar-observacao-sugerida/${id}`, {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getChecklistAssistidoRelatorioPendencias() {
  return fetchJson(`${BASE_PATH}/relatorio-pendencias`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}
