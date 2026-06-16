import {
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from '../../../core/api/httpClient';

const BASE_PATH = '/licenciamento/homologacao-fechamento';

export function getFechamentoHomologacaoStatus() {
  return fetchJson(`${BASE_PATH}/status`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getFechamentoHomologacaoPendencias() {
  return fetchJson(`${BASE_PATH}/pendencias`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getFechamentoHomologacaoRoteiro() {
  return fetchJson(`${BASE_PATH}/roteiro`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function updateFechamentoHomologacaoChecklist(id, payload) {
  return fetchJson(`${BASE_PATH}/checklist/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export function runFechamentoHomologacaoDiagnostico() {
  return fetchJson(`${BASE_PATH}/diagnostico`, {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function getFechamentoHomologacaoRelatorio() {
  return fetchJson(`${BASE_PATH}/relatorio`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export function registrarLiberacaoFase2D(payload) {
  return fetchJson(`${BASE_PATH}/registrar-liberacao-fase2d`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}
