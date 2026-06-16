import {
  buildQueryString,
  fetchBlob,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from './httpClient';

export async function getVistorias(filters = {}) {
  return fetchJson(`/vistorias${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getVistoria(id) {
  return fetchJson(`/vistorias/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getFiscalizacaoVistorias(fiscalizacaoId) {
  return fetchJson(`/fiscalizacoes/${fiscalizacaoId}/vistorias`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createVistoria(fiscalizacaoId, payload) {
  return fetchJson(`/fiscalizacoes/${fiscalizacaoId}/vistorias`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateVistoriaStatus(id, payload) {
  return fetchJson(`/vistorias/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function assignVistoriaResponsavel(id, payload) {
  return fetchJson(`/vistorias/${id}/responsavel`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function createVistoriaMovimentacao(id, payload) {
  return fetchJson(`/vistorias/${id}/movimentacoes`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function registerVistoriaRealizacao(id, payload) {
  return fetchJson(`/vistorias/${id}/registrar-realizacao`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function cancelVistoria(id, payload) {
  return fetchJson(`/vistorias/${id}/cancelar`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getVistoriaAnexos(id) {
  return fetchJson(`/vistorias/${id}/anexos`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function uploadVistoriaAnexo(id, formData) {
  return fetchJson(`/vistorias/${id}/anexos`, {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
    body: formData,
  });
}

export async function downloadVistoriaAnexo(vistoriaId, anexoId) {
  return fetchBlob(`/vistorias/${vistoriaId}/anexos/${anexoId}/download`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getRelatoriosPreliminares(filters = {}) {
  return fetchJson(`/relatorios-preliminares${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getRelatorioPreliminar(id) {
  return fetchJson(`/relatorios-preliminares/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createRelatorioPreliminar(vistoriaId, payload) {
  return fetchJson(`/vistorias/${vistoriaId}/relatorios-preliminares`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateRelatorioPreliminar(id, payload) {
  return fetchJson(`/relatorios-preliminares/${id}`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateRelatorioPreliminarStatus(id, payload) {
  return fetchJson(`/relatorios-preliminares/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function createRelatorioPreliminarMovimentacao(id, payload) {
  return fetchJson(`/relatorios-preliminares/${id}/movimentacoes`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}
