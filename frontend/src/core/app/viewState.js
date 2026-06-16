import { DEFAULT_MODULE_KEY, isSupportedModuleKey, normalizeModuleKey } from './moduleRegistry';

const INTERNAL_SESSION_STORAGE_KEY = 'sigbaInternalSession';

export function parseInternalSession() {
  try {
    const raw = localStorage.getItem(INTERNAL_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistInternalSession(nextSession) {
  localStorage.setItem(INTERNAL_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
}

export function clearInternalSession() {
  localStorage.removeItem(INTERNAL_SESSION_STORAGE_KEY);
}

export function getInitialView(hasInternalToken) {
  try {
    const view = new URLSearchParams(window.location.search).get('view');

    if (['admin', 'portal', 'publico', 'denuncias'].includes(view)) {
      return view;
    }
  } catch {
    // Mantem fallback local quando a URL nao estiver disponivel.
  }

  return hasInternalToken ? 'admin' : 'publico';
}

export function getInitialModuleKey() {
  try {
    const moduleKey = new URLSearchParams(window.location.search).get('module');
    const normalized = normalizeModuleKey(moduleKey);
    return isSupportedModuleKey(normalized) ? normalized : DEFAULT_MODULE_KEY;
  } catch {
    return DEFAULT_MODULE_KEY;
  }
}

export function getInitialPublicModuleKey() {
  try {
    const params = new URLSearchParams(window.location.search);

    if (!params.has('module')) {
      return null;
    }

    const normalized = normalizeModuleKey(params.get('module'));
    return isSupportedModuleKey(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function getInitialDenunciaCategoria() {
  try {
    return new URLSearchParams(window.location.search).get('categoria') || '';
  } catch {
    return '';
  }
}

export function getInitialShellState() {
  const internalSession = parseInternalSession();

  return {
    internalSession,
    moduleKey: getInitialModuleKey(),
    publicModuleKey: getInitialPublicModuleKey(),
    denunciaCategoria: getInitialDenunciaCategoria(),
    view: getInitialView(Boolean(internalSession?.token)),
  };
}

export function syncShellLocation({ moduleKey, publicModuleKey = null, view, denunciaCategoria = '' }) {
  try {
    const url = new URL(window.location.href);

    if (view === 'admin' && moduleKey) {
      url.searchParams.set('module', moduleKey);
    } else if (['publico', 'portal'].includes(view) && publicModuleKey) {
      url.searchParams.set('module', publicModuleKey);
    } else {
      url.searchParams.delete('module');
    }

    if (view) {
      url.searchParams.set('view', view);
    }

    if (view === 'denuncias' && denunciaCategoria) {
      url.searchParams.set('categoria', denunciaCategoria);
    } else {
      url.searchParams.delete('categoria');
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  } catch {
    // Mantem compatibilidade quando a URL nao estiver disponivel.
  }
}
