import {
  buildQueryString,
  fetchBlob,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from '../../../core/api/httpClient';

export async function loginUsuarioInterno(payload) {
  return fetchJson('/usuarios-internos/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordResetInterno(payload) {
  return fetchJson('/usuarios-internos/password-reset/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function resetPasswordInterno(payload) {
  return fetchJson('/usuarios-internos/password-reset/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getUsuarioInternoMe() {
  return fetchJson('/usuarios-internos/me', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getParceirosIntegracao() {
  return fetchJson('/integracoes/parceiros', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createParceiroIntegracao(payload) {
  return fetchJson('/integracoes/parceiros', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function revokeParceiroIntegracao(id) {
  return fetchJson(`/integracoes/parceiros/${id}/revogar`, {
    method: 'PATCH',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function rotateParceiroIntegracao(id) {
  return fetchJson(`/integracoes/parceiros/${id}/rotacionar`, {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getDashboard() {
  return fetchJson('/dashboard', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getDashboardGerencial() {
  return fetchJson('/dashboard/gerencial', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getDashboardVacinacao() {
  return fetchJson('/dashboard/vacinacao', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getDashboardQualidadeCadastral() {
  return fetchJson('/dashboard/qualidade-cadastral', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getDashboardBiTerritorial() {
  return fetchJson('/dashboard/bi-territorial', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getTerritorios(options = {}) {
  return fetchJson(`/territorios${buildQueryString(options)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getTerritorioGestaoResumo() {
  return fetchJson('/territorios/gestao/resumo', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getQualidadeTerritorial() {
  return fetchJson('/territorios/qualidade', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createTerritorio(payload) {
  return fetchJson('/territorios', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTerritorio(id, payload) {
  return fetchJson(`/territorios/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTerritorioStatus(id, status) {
  return fetchJson(`/territorios/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function createTerritorioAlias(territorioId, payload) {
  return fetchJson(`/territorios/${territorioId}/aliases`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTerritorioAlias(aliasId, payload) {
  return fetchJson(`/territorios/aliases/${aliasId}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTerritorioAliasStatus(aliasId, status) {
  return fetchJson(`/territorios/aliases/${aliasId}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function getTerritorioLegado(filters = {}) {
  return fetchJson(`/territorios/legado${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function reviewTerritorioLegado(payload) {
  return fetchJson('/territorios/legado/revisoes', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getOperacaoFila(filters = {}) {
  return fetchJson(`/operacao/fila${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getOperacaoResumo() {
  return fetchJson('/operacao/resumo', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getOperacaoResponsaveis() {
  return fetchJson('/operacao/responsaveis', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getOperacaoNotificacoes() {
  return fetchJson('/operacao/notificacoes', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getOperacaoHistorico(tipo, id) {
  return fetchJson(`/operacao/itens/${encodeURIComponent(tipo)}/${id}/historico`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function assignOperacaoResponsavel(tipo, id, payload) {
  return fetchJson(`/operacao/itens/${encodeURIComponent(tipo)}/${id}/responsavel`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateOperacaoPrazo(tipo, id, payload) {
  return fetchJson(`/operacao/itens/${encodeURIComponent(tipo)}/${id}/prazo`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function createOperacaoObservacao(tipo, id, payload) {
  return fetchJson(`/operacao/itens/${encodeURIComponent(tipo)}/${id}/observacoes`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getSaneamentoCasos(filters = {}) {
  return fetchJson(`/saneamento-cadastral/casos${buildQueryString(filters, { truthyOnly: true })}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getSaneamentoCaso(id) {
  return fetchJson(`/saneamento-cadastral/casos/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function reviewSaneamentoCaso(id, payload) {
  return fetchJson(`/saneamento-cadastral/casos/${id}/revisao`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function mergeTutorSaneamentoCaso(id, payload) {
  return fetchJson(`/saneamento-cadastral/casos/${id}/merge/tutores`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getAnimais() {
  return fetchJson('/animais', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getAnimalById(id) {
  return fetchJson(`/animais/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createAnimal(payload) {
  return fetchJson('/animais', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAnimal(id, payload) {
  return fetchJson(`/animais/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteAnimal(id) {
  return fetchJson(`/animais/${id}`, {
    method: 'DELETE',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getAnimalEventos(id) {
  return fetchJson(`/animais/${id}/eventos`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createAnimalEvento(id, payload) {
  return fetchJson(`/animais/${id}/eventos`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getVacinaCatalogo(especie = '') {
  const query = especie ? `?especie=${encodeURIComponent(especie)}` : '';
  return fetchJson(`/animais/vacinas/catalogo${query}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getAnimalCarteiraVacinal(id) {
  return fetchJson(`/animais/${id}/vacinacoes`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createAnimalVacinacao(id, payload) {
  return fetchJson(`/animais/${id}/vacinacoes`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateAnimalVacinacao(id, vacinacaoId, payload) {
  return fetchJson(`/animais/${id}/vacinacoes/${vacinacaoId}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function cancelAnimalVacinacao(id, vacinacaoId) {
  return fetchJson(`/animais/${id}/vacinacoes/${vacinacaoId}`, {
    method: 'DELETE',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getOcorrencias() {
  return fetchJson('/ocorrencias', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createOcorrenciaInterna(payload) {
  return fetchJson('/ocorrencias', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateOcorrenciaStatus(id, payload) {
  return fetchJson(`/ocorrencias/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getTutores() {
  return fetchJson('/tutores', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getTutorById(id) {
  return fetchJson(`/tutores/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createTutor(payload) {
  return fetchJson('/tutores', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTutor(id, payload) {
  return fetchJson(`/tutores/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteTutor(id) {
  return fetchJson(`/tutores/${id}`, {
    method: 'DELETE',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getCampanhaInscricoes() {
  return fetchJson('/campanhas/inscricoes', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getCampanhaAgenda() {
  return fetchJson('/campanhas/agenda', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function downloadCampanhaInscricoesCsv() {
  return fetchBlob('/campanhas/relatorios/inscricoes.csv', {
    headers: getInternalAuthOnlyHeaders(),
  }, 'Erro ao baixar relatorio');
}

export async function downloadDocumentoCampanhaInterno(id) {
  return fetchBlob(`/campanhas/admin/documentos/${id}/download`, {
    headers: getInternalAuthOnlyHeaders(),
  }, 'Erro ao baixar documento');
}

export async function updateCampanhaInscricaoStatus(id, payload) {
  return fetchJson(`/campanhas/inscricoes/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}
