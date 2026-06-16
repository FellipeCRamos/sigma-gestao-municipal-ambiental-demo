import { fetchJson } from '../../../core/api/httpClient';

export async function getViveiroPublicStatus() {
  return fetchJson('/publico/viveiro/status');
}

export async function getViveiroPublicEspecies() {
  return fetchJson('/publico/viveiro/especies');
}

export async function createViveiroPublicSolicitacao(payload) {
  return fetchJson('/publico/viveiro/solicitacoes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
