import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
} from './httpClient';

export async function searchProtocolos(filters = {}) {
  return fetchJson(`/protocolos${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getProtocolo(protocolo) {
  return fetchJson(`/protocolos/${encodeURIComponent(protocolo)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}
