import { sigbaModuleDefinition } from '../../modules/sigba/app/sigbaModuleDefinition';
import { viveiroModuleDefinition } from '../../modules/viveiro/app/viveiroModuleDefinition';
import { licenciamentoModuleDefinition } from '../../modules/licenciamento/app/licenciamentoModuleDefinition';
import { educacaoAmbientalModuleDefinition } from '../../modules/educacao-ambiental/app/educacaoAmbientalModuleDefinition';
import { anuenciaModuleDefinition } from '../../modules/anuencia/app/anuenciaModuleDefinition';
import { portalRequerenteModuleDefinition } from '../../modules/portal-requerente/app/portalRequerenteModuleDefinition';
import { hasPermission } from '../../utils/permissions';

export const DEFAULT_MODULE_KEY = 'sigba';
export const FUTURE_MODULE_SLOTS = [];

const MODULE_ALIASES = {
  'bem-estar-animal': DEFAULT_MODULE_KEY,
  bem_estar_animal: DEFAULT_MODULE_KEY,
  educacao_ambiental: 'educacao-ambiental',
  educacaoambiental: 'educacao-ambiental',
  anuencia_ambiental: 'anuencia',
  portal_requerente: 'portal-requerente',
  portalrequerente: 'portal-requerente',
};

const MODULE_REGISTRY = {
  [DEFAULT_MODULE_KEY]: sigbaModuleDefinition,
  viveiro: viveiroModuleDefinition,
  licenciamento: licenciamentoModuleDefinition,
  'educacao-ambiental': educacaoAmbientalModuleDefinition,
  anuencia: anuenciaModuleDefinition,
  'portal-requerente': portalRequerenteModuleDefinition,
};

export function normalizeModuleKey(moduleKey) {
  const normalized = String(moduleKey || '').trim().toLowerCase();

  if (!normalized) return '';

  return MODULE_ALIASES[normalized] || normalized;
}

export function isSupportedModuleKey(moduleKey) {
  const normalized = normalizeModuleKey(moduleKey);
  return Boolean(normalized && MODULE_REGISTRY[normalized]);
}

export function getModuleDefinition(moduleKey) {
  return MODULE_REGISTRY[normalizeModuleKey(moduleKey)] || MODULE_REGISTRY[DEFAULT_MODULE_KEY];
}

function getModulePermissions(moduleDefinition) {
  return Object.values(moduleDefinition.pagePermissions || {}).filter(Boolean);
}

export function canAccessModule(moduleKey, user) {
  const normalized = normalizeModuleKey(moduleKey);
  const moduleDefinition = MODULE_REGISTRY[normalized];

  if (!moduleDefinition) return false;
  if (!user) return true;

  const permissions = getModulePermissions(moduleDefinition);

  if (!permissions.length) return true;

  return permissions.some((permission) => hasPermission(user, permission));
}

export function resolveAuthorizedModuleKey(moduleKey, user) {
  const normalized = normalizeModuleKey(moduleKey);

  if (canAccessModule(normalized, user)) {
    return normalized;
  }

  return getRegisteredModules(user)[0]?.key || DEFAULT_MODULE_KEY;
}

export function getRegisteredModuleKeys(user = null) {
  return getRegisteredModules(user).map((moduleDefinition) => moduleDefinition.key);
}

export function getRegisteredModules(user = null) {
  return Object.values(MODULE_REGISTRY)
    .filter((moduleDefinition) => canAccessModule(moduleDefinition.key, user))
    .map((moduleDefinition) => ({
      key: moduleDefinition.key,
      title: moduleDefinition.title,
    }));
}
