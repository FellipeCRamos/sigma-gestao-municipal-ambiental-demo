import { fetchJson } from './httpClient';

export async function getHealth() {
  return fetchJson('/health');
}
