import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from './httpClient';

export async function listGeoLocalizacoes(filters = {}) {
  return fetchJson(`/geo/localizacoes${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getGeoLocalizacao(id) {
  return fetchJson(`/geo/localizacoes/${encodeURIComponent(id)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createGeoLocalizacao(payload) {
  return fetchJson('/geo/localizacoes', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateGeoLocalizacao(id, payload) {
  return fetchJson(`/geo/localizacoes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function createGeoVinculo(id, payload) {
  return fetchJson(`/geo/localizacoes/${encodeURIComponent(id)}/vinculos`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function listGeoVinculos(id) {
  return fetchJson(`/geo/localizacoes/${encodeURIComponent(id)}/vinculos`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function listGeoCamadas() {
  return fetchJson('/geo/camadas', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function simulateGeoIntersecoes(payload) {
  return fetchJson('/geo/intersecoes/simular', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}
