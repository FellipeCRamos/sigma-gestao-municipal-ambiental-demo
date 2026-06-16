import {
  buildQueryString,
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from '../../../core/api/httpClient';

export async function getLicenciamentoResumo() {
  return fetchJson('/licenciamento/resumo', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoProcessos(filters = {}) {
  return fetchJson(`/licenciamento/processos${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createLicenciamentoProcesso(payload) {
  return fetchJson('/licenciamento/processos', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoProcesso(id) {
  return fetchJson(`/licenciamento/processos/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function updateLicenciamentoProcesso(id, payload) {
  return fetchJson(`/licenciamento/processos/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoHistorico(id) {
  return fetchJson(`/licenciamento/processos/${id}/historico`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametros(resource, filters = {}) {
  return fetchJson(`/licenciamento/${resource}${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createLicenciamentoParametro(resource, payload) {
  return fetchJson(`/licenciamento/${resource}`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateLicenciamentoParametro(resource, id, payload) {
  return fetchJson(`/licenciamento/${resource}/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteLicenciamentoParametro(resource, id) {
  return fetchJson(`/licenciamento/${resource}/${id}`, {
    method: 'DELETE',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoStatus() {
  return fetchJson('/licenciamento/parametrizacao/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D1Status() {
  return fetchJson('/licenciamento/parametrizacao/fase2d1/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D2Status() {
  return fetchJson('/licenciamento/parametrizacao/fase2d2/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D21Status() {
  return fetchJson('/licenciamento/parametrizacao/fase2d21/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D3MapaStatus() {
  return fetchJson('/licenciamento/parametrizacao/fase2d3/mapa-decreto/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D4AGrupo19Status() {
  return fetchJson('/licenciamento/parametrizacao/fase2d4a/grupo19/conferencia/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D4BGrupo19Status() {
  return fetchJson('/licenciamento/parametrizacao/fase2d4b/grupo19/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5AMapaStatus() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5a/mapa-decreto/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5BComplementacaoStatus() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5b/complementacao-grupos/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5CGrupo21Status() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c/grupo21/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C1Grupo21ConferenciaVisual() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c1/grupo21/conferencia-visual', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2Grupo21Bancada() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2/grupo21/bancada', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo(codigo) {
  return fetchJson(`/licenciamento/parametrizacao/fase2d5c2/grupo21/bancada/${encodeURIComponent(codigo)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function updateLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo(codigo, payload) {
  return fetchJson(`/licenciamento/parametrizacao/fase2d5c2/grupo21/bancada/${encodeURIComponent(codigo)}`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function validarLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo(codigo, payload) {
  return fetchJson(`/licenciamento/parametrizacao/fase2d5c2/grupo21/bancada/${encodeURIComponent(codigo)}/validar`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2Grupo21Historico(codigo) {
  return fetchJson(`/licenciamento/parametrizacao/fase2d5c2/grupo21/bancada/${encodeURIComponent(codigo)}/historico`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2AGrupo21PreviaSeed() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2a/grupo21/previa-seed', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2BGrupo21ModeloJson() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2b/grupo21/modelo-json', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function validarLicenciamentoParametrizacaoFase2D5C2BGrupo21Importacao(payload) {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2b/grupo21/validar-importacao', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function aplicarLicenciamentoParametrizacaoFase2D5C2BGrupo21Importacao(payload) {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2b/grupo21/aplicar-importacao', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2BGrupo21HistoricoImportacoes() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2b/grupo21/importacoes/historico', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2CGrupo21PreparacaoMatrizReal() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2c/grupo21/preparacao-matriz-real', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C2CGrupo21ModeloOficialReal() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2c/grupo21/modelo-oficial-real', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function limparLicenciamentoParametrizacaoFase2D5C2CGrupo21RascunhosHomologacao(payload) {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c2c/grupo21/limpar-rascunhos-homologacao', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C3AGrupo21ConferenciaComplementar() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c3a/grupo21/conferencia-complementar', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function aplicarLicenciamentoParametrizacaoFase2D5C3AGrupo21Complementacao(payload) {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c3a/grupo21/aplicar-complementacao', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C3BGrupo21BloqueioNormativo() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c3b/grupo21/bloqueio-normativo', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function registrarLicenciamentoParametrizacaoFase2D5C3BGrupo21Bloqueio(payload) {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c3b/grupo21/registrar-bloqueio', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C4Grupo21RevisaoNormativa() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c4/grupo21/revisao-normativa', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C4Grupo21PreviaSeed() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c4/grupo21/previa-seed', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoParametrizacaoFase2D5C5Grupo21PreviaSeedControlado() {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c5/grupo21/previa-seed-controlado', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function aplicarLicenciamentoParametrizacaoFase2D5C5Grupo21SeedControlado(payload) {
  return fetchJson('/licenciamento/parametrizacao/fase2d5c5/grupo21/aplicar-seed-controlado', {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoAssistenteAnalises(filters = {}) {
  return fetchJson(`/licenciamento/assistente/analises${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoAssistenteAnalise(id) {
  return fetchJson(`/licenciamento/assistente/analises/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function updateLicenciamentoAssistenteAnaliseStatus(id, payload) {
  return fetchJson(`/licenciamento/assistente/analises/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function validarLicenciamentoAssistenteAnalise(id, payload) {
  return fetchJson(`/licenciamento/assistente/analises/${id}/validacao`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function converterLicenciamentoAssistenteAnalisePreRequerimento(id, payload = {}) {
  return fetchJson(`/licenciamento/assistente/analises/${id}/converter-pre-requerimento`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoAssistenteAnaliseHistorico(id) {
  return fetchJson(`/licenciamento/assistente/analises/${id}/historico`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoPreRequerimentos(filters = {}) {
  return fetchJson(`/licenciamento/pre-requerimentos${buildQueryString(filters)}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getLicenciamentoPreRequerimento(id) {
  return fetchJson(`/licenciamento/pre-requerimentos/${id}`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function updateLicenciamentoPreRequerimentoStatus(id, payload) {
  return fetchJson(`/licenciamento/pre-requerimentos/${id}/status`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateLicenciamentoPreRequerimentoMinuta(id, payload) {
  return fetchJson(`/licenciamento/pre-requerimentos/${id}/minuta-despacho`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateLicenciamentoPreRequerimentoDocumento(id, payload) {
  return fetchJson(`/licenciamento/pre-requerimentos/${id}/documentos`, {
    method: 'PATCH',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getLicenciamentoPreRequerimentoHistorico(id) {
  return fetchJson(`/licenciamento/pre-requerimentos/${id}/historico`, {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function createLicenciamentoNormaVinculo(normaId, payload) {
  return fetchJson(`/licenciamento/normas/${normaId}/vinculos`, {
    method: 'POST',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteLicenciamentoNormaVinculo(vinculoId) {
  return fetchJson(`/licenciamento/normas-vinculos/${vinculoId}`, {
    method: 'DELETE',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getPublicLicenciamentoAtividades(filters = {}) {
  return fetchJson(`/publico/licenciamento/atividades${buildQueryString(filters)}`);
}

export async function getPublicLicenciamentoNormas(filters = {}) {
  return fetchJson(`/publico/licenciamento/normas${buildQueryString(filters)}`);
}

export async function simulatePublicLicenciamento(payload) {
  return fetchJson('/publico/licenciamento/simular-enquadramento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function createPublicLicenciamentoAssistenteAnalise(payload) {
  return fetchJson('/publico/licenciamento/assistente/analises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getPublicLicenciamentoSimulacao(protocolo) {
  return fetchJson(`/publico/licenciamento/simulacoes/${encodeURIComponent(protocolo)}`);
}
