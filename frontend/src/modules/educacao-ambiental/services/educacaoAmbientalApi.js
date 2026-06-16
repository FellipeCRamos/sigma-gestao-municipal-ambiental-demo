import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from '../../../core/api/httpClient';

const ADMIN_BASE = '/educacao-ambiental/admin';
const PUBLIC_BASE = '/publico/educacao-ambiental';

export async function getEducacaoDashboard() {
  return fetchJson(`${ADMIN_BASE}/dashboard`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getEducacaoCategorias() {
  return fetchJson(`${ADMIN_BASE}/categorias`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getCuradoriaDashboard() {
  return fetchJson(`${ADMIN_BASE}/curadoria/dashboard`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function listCuradoriaPendencias(filters = {}) {
  return fetchJson(`${ADMIN_BASE}/curadoria/pendencias${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function listCuradoriaFontes(filters = {}) {
  return fetchJson(`${ADMIN_BASE}/curadoria/fontes${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createCuradoriaFonte(payload) {
  return fetchJson(`${ADMIN_BASE}/curadoria/fontes`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateCuradoriaFonte(id, payload) {
  return fetchJson(`${ADMIN_BASE}/curadoria/fontes/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateCuradoriaFonteStatus(id, status) {
  return fetchJson(`${ADMIN_BASE}/curadoria/fontes/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function listCuradoriaReferencias(filters = {}) {
  return fetchJson(`${ADMIN_BASE}/curadoria/referencias${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createCuradoriaReferencia(payload) {
  return fetchJson(`${ADMIN_BASE}/curadoria/referencias`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateCuradoriaReferencia(id, payload) {
  return fetchJson(`${ADMIN_BASE}/curadoria/referencias/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function archiveCuradoriaReferencia(id) {
  return fetchJson(`${ADMIN_BASE}/curadoria/referencias/${id}/arquivar`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({}),
  });
}

export async function updateConteudoStatusCuradoria(id, payload) {
  return fetchJson(`${ADMIN_BASE}/curadoria/conteudos/${id}/status-curadoria`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function validarConteudoTecnicamente(id, payload = {}) {
  return fetchJson(`${ADMIN_BASE}/curadoria/conteudos/${id}/validacao-tecnica`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function validarConteudoJuridicamente(id, payload = {}) {
  return fetchJson(`${ADMIN_BASE}/curadoria/conteudos/${id}/validacao-juridica`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function setConteudoAptoIa(id, apto = true) {
  return fetchJson(`${ADMIN_BASE}/curadoria/conteudos/${id}/apto-ia`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({ apto_para_ia: apto }),
  });
}

export async function setConteudoAptoPortal(id, apto = true) {
  return fetchJson(`${ADMIN_BASE}/curadoria/conteudos/${id}/apto-portal`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({ apto_para_portal_publico: apto }),
  });
}

export async function getBaseConhecimentoValidada() {
  return fetchJson(`${ADMIN_BASE}/curadoria/base-conhecimento-validada`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function listEducacaoEntity(entityPath, filters = {}) {
  return fetchJson(`${ADMIN_BASE}/${entityPath}${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createEducacaoEntity(entityPath, payload) {
  return fetchJson(`${ADMIN_BASE}/${entityPath}`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateEducacaoEntity(entityPath, id, payload) {
  return fetchJson(`${ADMIN_BASE}/${entityPath}/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateEducacaoEntityStatus(entityPath, id, status) {
  return fetchJson(`${ADMIN_BASE}/${entityPath}/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function archiveEducacaoConteudo(id) {
  return fetchJson(`${ADMIN_BASE}/conteudos/${id}/arquivar`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({}),
  });
}

export async function createTrilhaAula(trilhaId, payload) {
  return fetchJson(`${ADMIN_BASE}/trilhas/${trilhaId}/aulas`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getEducacaoPublicHome() {
  return fetchJson(`${PUBLIC_BASE}/home`);
}

export async function listEducacaoPublicEntity(entityPath, filters = {}) {
  return fetchJson(`${PUBLIC_BASE}/${entityPath}${buildQueryString(filters)}`);
}
