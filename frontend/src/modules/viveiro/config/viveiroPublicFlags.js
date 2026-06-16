export const VIVEIRO_PUBLIC_PORTAL_FLAG = 'VITE_VIVEIRO_PUBLIC_PORTAL_ENABLED';

const ENABLED_VALUES = new Set(['1', 'true', 'sim', 'yes', 'enabled', 'ativo']);

export function isViveiroPublicPortalEnabled(env = import.meta.env) {
  const rawValue = String(env?.[VIVEIRO_PUBLIC_PORTAL_FLAG] || '').trim().toLowerCase();
  return ENABLED_VALUES.has(rawValue);
}
