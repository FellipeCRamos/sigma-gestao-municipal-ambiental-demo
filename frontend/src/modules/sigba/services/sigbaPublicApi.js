import { fetchJson } from '../../../core/api/httpClient';

export async function getPublicIndicadores() {
  return fetchJson('/publico/indicadores');
}

export async function getPublicAnimal(publicId) {
  return fetchJson(`/publico/animais/${encodeURIComponent(publicId)}`);
}

export async function getPublicGovernanca() {
  return fetchJson('/publico/governanca');
}

export async function getPublicTermoUso() {
  return fetchJson('/publico/termo-uso');
}

export async function getPublicPoliticaPrivacidade() {
  return fetchJson('/publico/politica-privacidade');
}

export async function getPublicTerritorios() {
  return fetchJson('/publico/territorios');
}

export async function getCampanhas() {
  return fetchJson('/campanhas');
}
