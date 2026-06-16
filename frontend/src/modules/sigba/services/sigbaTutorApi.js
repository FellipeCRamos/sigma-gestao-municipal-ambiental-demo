import {
  buildQueryString,
  fetchBlob,
  fetchJson,
  getBearerHeaders,
  getTutorAuthHeaders,
} from '../../../core/api/httpClient';

export async function registerUsuarioExterno(payload) {
  return fetchJson('/usuarios-externos/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function loginUsuarioExterno(payload) {
  return fetchJson('/usuarios-externos/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordResetExterno(payload) {
  return fetchJson('/usuarios-externos/password-reset/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function resetPasswordExterno(payload) {
  return fetchJson('/usuarios-externos/password-reset/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getMinhasInscricoesCampanha(token) {
  return fetchJson('/campanhas/minhas-inscricoes', {
    headers: getBearerHeaders(token),
  });
}

export async function getPortalTutorResumo(token) {
  return fetchJson('/usuarios-externos/me/mobile', {
    headers: getBearerHeaders(token),
  });
}

export async function getPortalTutorDocumentos(token) {
  return fetchJson('/usuarios-externos/me/mobile/documentos', {
    headers: getBearerHeaders(token),
  });
}

export async function getPortalTutorAnimalDetalhe(token, animalId) {
  return fetchJson(`/usuarios-externos/me/mobile/animais/${animalId}`, {
    headers: getBearerHeaders(token),
  });
}

export async function getPortalTutorCarteiraDetalhada(token, animalId, filters = {}) {
  return fetchJson(
    `/usuarios-externos/me/mobile/animais/${animalId}/carteira${buildQueryString(filters)}`,
    {
      headers: getBearerHeaders(token),
    }
  );
}

export async function getPortalTutorInscricaoDetalhe(token, inscriaoId) {
  return fetchJson(`/usuarios-externos/me/mobile/inscricoes/${inscriaoId}`, {
    headers: getBearerHeaders(token),
  });
}

export async function getPortalTutorOcorrenciaDetalhe(token, ocorrenciaId) {
  return fetchJson(`/usuarios-externos/me/mobile/ocorrencias/${ocorrenciaId}`, {
    headers: getBearerHeaders(token),
  });
}

export async function getPortalTutorPreferencias(token) {
  return fetchJson('/usuarios-externos/me/mobile/preferencias', {
    headers: getBearerHeaders(token),
  });
}

export async function getPortalTutorNotificacoes(token, filters = {}) {
  return fetchJson(`/usuarios-externos/me/mobile/notificacoes${buildQueryString(filters)}`, {
    headers: getBearerHeaders(token),
  });
}

export async function markTodasNotificacoesLidas(token) {
  return fetchJson('/usuarios-externos/me/mobile/notificacoes/lidas', {
    method: 'PATCH',
    headers: getBearerHeaders(token),
  });
}

export async function updatePortalTutorPreferencias(token, preferencias) {
  return fetchJson('/usuarios-externos/me/mobile/preferencias', {
    method: 'PUT',
    headers: getTutorAuthHeaders(token),
    body: JSON.stringify({ preferencias }),
  });
}

export async function registerPortalTutorPushSubscription(token, subscription) {
  return fetchJson('/usuarios-externos/me/mobile/web-push/subscriptions', {
    method: 'POST',
    headers: getTutorAuthHeaders(token),
    body: JSON.stringify({ subscription }),
  });
}

export async function revokePortalTutorPushSubscription(token, endpoint = '') {
  return fetchJson('/usuarios-externos/me/mobile/web-push/subscriptions', {
    method: 'DELETE',
    headers: getTutorAuthHeaders(token),
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  });
}

export async function sendPortalTutorPushTeste(token) {
  return fetchJson('/usuarios-externos/me/mobile/web-push/teste', {
    method: 'POST',
    headers: getBearerHeaders(token),
  });
}

export async function getMeusDocumentosCampanha(token, inscriaoId) {
  return fetchJson(`/campanhas/inscricoes/${inscriaoId}/documentos`, {
    headers: getBearerHeaders(token),
  });
}

export async function uploadDocumentoCampanha(token, inscriaoId, tipo, file) {
  const formData = new FormData();
  formData.append('tipo', tipo);
  formData.append('documento', file);

  return fetchJson(`/campanhas/inscricoes/${inscriaoId}/documentos`, {
    method: 'POST',
    headers: getBearerHeaders(token),
    body: formData,
  });
}

export async function downloadMeuDocumentoCampanha(token, id) {
  return fetchBlob(`/campanhas/documentos/${id}/download`, {
    headers: getBearerHeaders(token),
  }, 'Erro ao baixar documento');
}

export async function getMinhasNotificacoes(token) {
  return fetchJson('/campanhas/notificacoes', {
    headers: getBearerHeaders(token),
  });
}

export async function markNotificacaoLida(token, id) {
  return fetchJson(`/campanhas/notificacoes/${id}/lida`, {
    method: 'PATCH',
    headers: getBearerHeaders(token),
  });
}

export async function getMinhaCarteiraAnimal(token, animalId) {
  return fetchJson(`/usuarios-externos/me/animais/${animalId}/vacinacoes`, {
    headers: getBearerHeaders(token),
  });
}

export async function createCampanhaInscricao(token, payload) {
  return fetchJson('/campanhas/inscricoes', {
    method: 'POST',
    headers: getTutorAuthHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function getMinhasOcorrencias(token) {
  return fetchJson('/ocorrencias/minhas', {
    headers: getBearerHeaders(token),
  });
}

export async function createMinhaOcorrencia(token, payload) {
  return fetchJson('/ocorrencias/minhas', {
    method: 'POST',
    headers: getTutorAuthHeaders(token),
    body: JSON.stringify(payload),
  });
}
