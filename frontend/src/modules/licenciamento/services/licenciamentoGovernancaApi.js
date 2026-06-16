import {
  fetchJson,
  getInternalAuthOnlyHeaders,
  getInternalHeaders,
} from '../../../core/api/httpClient';

export async function getGovernancaNormativaStatus() {
  return fetchJson('/licenciamento/governanca-normativa/status', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getGovernancaNormativaNormas() {
  return fetchJson('/licenciamento/governanca-normativa/normas', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getGovernancaNormativaTabelasTaxas() {
  return fetchJson('/licenciamento/governanca-normativa/tabelas-taxas', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getGovernancaNormativaMatrizes() {
  return fetchJson('/licenciamento/governanca-normativa/matrizes', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getGovernancaNormativaDivergencias() {
  return fetchJson('/licenciamento/governanca-normativa/divergencias', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getGovernancaNormativaHomologacao() {
  return fetchJson('/licenciamento/governanca-normativa/homologacao', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function updateGovernancaNormativaHomologacao(id, payload) {
  return fetchJson(`/licenciamento/governanca-normativa/homologacao/${id}`, {
    method: 'PUT',
    headers: getInternalHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function runHomologacaoAssistidaDiagnostico() {
  return fetchJson('/licenciamento/homologacao-assistida/diagnostico', {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getHomologacaoAssistidaRelatorio() {
  return fetchJson('/licenciamento/homologacao-assistida/relatorio', {
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function runGovernancaNormativaSeedFase2C() {
  return fetchJson('/licenciamento/governanca-normativa/seed-fase2c', {
    method: 'POST',
    headers: getInternalAuthOnlyHeaders(),
  });
}

export async function getPublicLicenciamentoLegislacao() {
  return fetchJson('/publico/licenciamento/legislacao');
}

export async function getPublicLicenciamentoAvisosNormativos() {
  return fetchJson('/publico/licenciamento/avisos-normativos');
}
