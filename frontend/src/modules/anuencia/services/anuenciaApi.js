import { buildQueryString, fetchJson, getInternalAuthOnlyHeaders, getInternalHeaders } from '../../../core/api/httpClient';

export function getAnuenciaDashboard() {
  return fetchJson('/anuencias/dashboard/resumo', { headers: getInternalAuthOnlyHeaders() });
}

export function listAnuencias(filters = {}) {
  return fetchJson(`/anuencias${buildQueryString(filters, { truthyOnly: true })}`, { headers: getInternalAuthOnlyHeaders() });
}

export function getAnuencia(id) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}`, { headers: getInternalAuthOnlyHeaders() });
}

export function createAnuencia(payload) {
  return fetchJson('/anuencias', { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function updateAnuencia(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}`, { method: 'PATCH', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function addAnuenciaInteressado(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/interessados`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function listAnuenciaInteressados(id) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/interessados`, { headers: getInternalAuthOnlyHeaders() });
}

export function addAnuenciaDocumento(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/documentos`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function listAnuenciaDocumentos(id) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/documentos`, { headers: getInternalAuthOnlyHeaders() });
}

export function conferirAnuenciaDocumento(id, documentoId, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/documentos/${encodeURIComponent(documentoId)}/conferencia`, { method: 'PATCH', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function addAnuenciaAnalise(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/analises`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function listAnuenciaAnalises(id) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/analises`, { headers: getInternalAuthOnlyHeaders() });
}

export function addAnuenciaPendencia(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/pendencias`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function updateAnuenciaPendencia(id, pendenciaId, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/pendencias/${encodeURIComponent(pendenciaId)}`, { method: 'PATCH', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function addAnuenciaCondicionante(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/condicionantes`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function listAnuenciaCondicionantes(id) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/condicionantes`, { headers: getInternalAuthOnlyHeaders() });
}

export function addAnuenciaDecisao(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/decisao`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function emitirAnuencia(id, payload) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/emissao`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function listAnuenciaHistorico(id) {
  return fetchJson(`/anuencias/${encodeURIComponent(id)}/historico`, { headers: getInternalAuthOnlyHeaders() });
}
