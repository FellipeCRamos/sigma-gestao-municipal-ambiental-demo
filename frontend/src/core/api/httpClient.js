const configuredApiBaseUrl = import.meta.env?.VITE_API_BASE_URL;

export const API_BASE_URL = String(configuredApiBaseUrl || '/api').replace(/\/+$/, '') || '/api';

export async function handleResponse(response) {
  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Resposta invalida da API: ${text}`);
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || `Erro na requisicao (${response.status}).`);
  }

  return data;
}

export async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  return handleResponse(response);
}

export async function fetchBlob(path, options = {}, fallbackMessage = 'Erro ao baixar arquivo') {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${fallbackMessage} (${response.status}).`);
  }

  return response.blob();
}

export function getBearerHeaders(token = '') {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getTutorAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...getBearerHeaders(token),
  };
}

export function getInternalToken() {
  try {
    const raw = localStorage.getItem('sigbaInternalSession');
    const session = raw ? JSON.parse(raw) : null;
    return session?.token || '';
  } catch {
    return '';
  }
}

export function getInternalAuthOnlyHeaders() {
  return getBearerHeaders(getInternalToken());
}

export function getInternalHeaders() {
  return {
    'Content-Type': 'application/json',
    ...getInternalAuthOnlyHeaders(),
  };
}

export function buildQueryString(values = {}, options = {}) {
  const { truthyOnly = false } = options;
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (truthyOnly) {
      if (value) {
        params.set(key, String(value));
      }
      return;
    }

    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}
