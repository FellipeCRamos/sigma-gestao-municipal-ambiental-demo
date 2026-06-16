import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
} from './httpClient';

export async function getComunicacaoResumo(filters = {}) {
  return fetchJson(`/comunicacao/resumo${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getComunicacaoEntregas(filters = {}) {
  return fetchJson(`/comunicacao/entregas${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getComunicacaoEventos() {
  return fetchJson('/comunicacao/eventos', {
    headers: getInternalAuthOnlyHeaders(),
  });
}
