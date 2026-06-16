import { buildQueryString, fetchJson, getBearerHeaders, getInternalAuthOnlyHeaders, getInternalHeaders } from '../../../core/api/httpClient';

const STORAGE_KEY = 'sigmaPortalRequerente';

export function getPortalRequerenteSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPortalRequerenteSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearPortalRequerenteSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getPortalHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...getBearerHeaders(token),
  };
}

export function getPortalAuthOnlyHeaders(token) {
  return getBearerHeaders(token);
}

export async function loginPortalRequerente(payload) {
  return fetchJson('/usuarios-externos/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function getPortalRequerenteMe(token) {
  return fetchJson('/portal-requerente/me', { headers: getPortalAuthOnlyHeaders(token) });
}

export function getPortalRequerenteTermos(token) {
  return fetchJson('/portal-requerente/me/termos', { headers: getPortalAuthOnlyHeaders(token) });
}

export function aceitarPortalRequerenteTermos(token, payload) {
  return fetchJson('/portal-requerente/me/termos/aceitar', { method: 'POST', headers: getPortalHeaders(token), body: JSON.stringify(payload) });
}

export function listMeusRequerimentos(token, filters = {}) {
  return fetchJson(`/portal-requerente/me/requerimentos${buildQueryString(filters, { truthyOnly: true })}`, { headers: getPortalAuthOnlyHeaders(token) });
}

export function getMeuRequerimento(token, id) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}`, { headers: getPortalAuthOnlyHeaders(token) });
}

export function createMeuRequerimento(token, payload) {
  return fetchJson('/portal-requerente/me/requerimentos', { method: 'POST', headers: getPortalHeaders(token), body: JSON.stringify(payload) });
}

export function updateMeuRequerimento(token, id, payload) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}`, { method: 'PATCH', headers: getPortalHeaders(token), body: JSON.stringify(payload) });
}

export function enviarMeuRequerimento(token, id) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}/enviar`, { method: 'POST', headers: getPortalAuthOnlyHeaders(token) });
}

export function addMeuRequerimentoDocumento(token, id, payload) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}/documentos`, { method: 'POST', headers: getPortalHeaders(token), body: JSON.stringify(payload) });
}

export function listMeuRequerimentoDocumentos(token, id) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}/documentos`, { headers: getPortalAuthOnlyHeaders(token) });
}

export function listMeuRequerimentoPendencias(token, id) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}/pendencias`, { headers: getPortalAuthOnlyHeaders(token) });
}

export function responderMeuRequerimentoPendencia(token, id, pendenciaId, payload) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}/pendencias/${encodeURIComponent(pendenciaId)}/responder`, {
    method: 'POST',
    headers: getPortalHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function listMeuRequerimentoHistorico(token, id) {
  return fetchJson(`/portal-requerente/me/requerimentos/${encodeURIComponent(id)}/historico`, { headers: getPortalAuthOnlyHeaders(token) });
}

export function getPortalRequerenteAdminDashboard() {
  return fetchJson('/portal-requerente/admin/dashboard/resumo', { headers: getInternalAuthOnlyHeaders() });
}

export function listPortalRequerenteAdminRequerentes(filters = {}) {
  return fetchJson(`/portal-requerente/admin/requerentes${buildQueryString(filters, { truthyOnly: true })}`, { headers: getInternalAuthOnlyHeaders() });
}

export function createPortalRequerenteAdminRequerente(payload) {
  return fetchJson('/portal-requerente/admin/requerentes', { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function updatePortalRequerenteAdminRequerente(id, payload) {
  return fetchJson(`/portal-requerente/admin/requerentes/${encodeURIComponent(id)}`, { method: 'PATCH', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function listPortalRequerenteAdminPreProtocolos(filters = {}) {
  return fetchJson(`/portal-requerente/admin/pre-protocolos${buildQueryString(filters, { truthyOnly: true })}`, { headers: getInternalAuthOnlyHeaders() });
}

export function getPortalRequerenteAdminPreProtocolo(id) {
  return fetchJson(`/portal-requerente/admin/pre-protocolos/${encodeURIComponent(id)}`, { headers: getInternalAuthOnlyHeaders() });
}

export function triarPortalRequerentePreProtocolo(id, payload = {}) {
  return fetchJson(`/portal-requerente/admin/pre-protocolos/${encodeURIComponent(id)}/triar`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function devolverPortalRequerentePreProtocolo(id, payload = {}) {
  return fetchJson(`/portal-requerente/admin/pre-protocolos/${encodeURIComponent(id)}/devolver`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function aceitarPortalRequerentePreProtocolo(id, payload = {}) {
  return fetchJson(`/portal-requerente/admin/pre-protocolos/${encodeURIComponent(id)}/aceitar`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}

export function recusarPortalRequerentePreProtocolo(id, payload = {}) {
  return fetchJson(`/portal-requerente/admin/pre-protocolos/${encodeURIComponent(id)}/recusar`, { method: 'POST', headers: getInternalHeaders(), body: JSON.stringify(payload) });
}
