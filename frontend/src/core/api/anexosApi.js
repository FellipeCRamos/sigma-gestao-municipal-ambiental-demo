import {
  buildQueryString,
  fetchBlob,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from './httpClient';

export async function getDemandAnexos(demandaId) {
  return fetchJson(`/demandas-publicas/${demandaId}/anexos`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function uploadDemandAnexo(demandaId, formData) {
  return fetchJson(`/demandas-publicas/${demandaId}/anexos`, {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
    body: formData,
  });
}

export async function downloadDemandAnexo(demandaId, anexoId) {
  return fetchBlob(
    `/demandas-publicas/${demandaId}/anexos/${anexoId}/download`,
    {
      headers: getInternalAuthOnlyHeaders(),
    },
    'Erro ao baixar anexo'
  );
}

export async function removeDemandAnexo(demandaId, anexoId, payload) {
  return fetchJson(`/demandas-publicas/${demandaId}/anexos/${anexoId}`, {
    method: 'DELETE',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getAnexos(filters = {}) {
  return fetchJson(`/anexos${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}
