import { fetchJson, getInternalAuthOnlyHeaders, getInternalHeaders } from '../api/httpClient';

export async function createDemandaPublica(payload) {
  return fetchJson('/publico/demandas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getDemandasPublicas(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return fetchJson(`/demandas-publicas${query ? `?${query}` : ''}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function updateDemandaPublicaStatus(id, payload) {
  return fetchJson(`/demandas-publicas/${id}/status`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}
