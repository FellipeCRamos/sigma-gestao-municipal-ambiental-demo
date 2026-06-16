import { Component, Suspense, useEffect, useMemo, useState } from 'react';
import AdminLogin from '../../pages/AdminLogin';
import AdminPlatformLayout from '../layout/AdminPlatformLayout';
import PainelPublicoSigma from '../publico/PainelPublicoSigma';
import DenunciasAmbientais from '../publico/DenunciasAmbientais';
import { getUsuarioInternoMe } from '../../services/api';
import {
  DEFAULT_MODULE_KEY,
  getModuleDefinition,
  getRegisteredModules,
  normalizeModuleKey,
  resolveAuthorizedModuleKey,
} from './moduleRegistry';
import {
  renderSharedAdminPage,
  resolveSharedAdminPage,
} from './sharedAdminPages';
import {
  clearInternalSession,
  getInitialShellState,
  persistInternalSession,
  syncShellLocation,
} from './viewState';

export default function SigmaAppShell() {
  const [initialShellState] = useState(() => getInitialShellState());
  const [internalSession, setInternalSession] = useState(initialShellState.internalSession);
  const [moduleKey, setModuleKey] = useState(initialShellState.moduleKey);
  const [publicModuleKey, setPublicModuleKey] = useState(initialShellState.publicModuleKey);
  const [denunciaCategoria, setDenunciaCategoria] = useState(initialShellState.denunciaCategoria);
  const [view, setView] = useState(initialShellState.view);
  const moduleDefinition = useMemo(() => getModuleDefinition(moduleKey), [moduleKey]);
  const publicModuleDefinition = useMemo(
    () => (publicModuleKey ? getModuleDefinition(publicModuleKey) : null),
    [publicModuleKey]
  );
  const defaultPublicModuleDefinition = useMemo(() => getModuleDefinition(DEFAULT_MODULE_KEY), []);
  const registeredModules = useMemo(() => getRegisteredModules(internalSession?.user), [internalSession?.user]);
  const [page, setPage] = useState(() => moduleDefinition.defaultAdminPage);

  const sharedPage = resolveSharedAdminPage(page, internalSession?.user);
  const effectivePage = sharedPage || moduleDefinition.resolveAdminPage(page, internalSession?.user);

  useEffect(() => {
    syncShellLocation({ moduleKey, publicModuleKey, view, denunciaCategoria });
  }, [moduleKey, publicModuleKey, view, denunciaCategoria]);

  useEffect(() => {
    setPage(moduleDefinition.defaultAdminPage);
  }, [moduleDefinition]);

  useEffect(() => {
    if (!internalSession?.user) {
      return;
    }

    const authorizedModuleKey = resolveAuthorizedModuleKey(moduleKey, internalSession.user);

    if (authorizedModuleKey !== moduleKey) {
      setModuleKey(authorizedModuleKey);
    }
  }, [internalSession?.user, moduleKey]);

  useEffect(() => {
    let cancelled = false;

    async function validateInternalSession() {
      if (!internalSession?.token) {
        return;
      }

      try {
        const response = await getUsuarioInternoMe();

        if (!cancelled) {
          setInternalSession((prev) => ({
            ...prev,
            user: response.data,
          }));
        }
      } catch {
        if (!cancelled) {
          clearInternalSession();
          setInternalSession(null);
        }
      }
    }

    validateInternalSession();

    return () => {
      cancelled = true;
    };
  }, [internalSession?.token]);

  function handleInternalLogin(nextSession) {
    persistInternalSession(nextSession);
    setInternalSession(nextSession);
    setModuleKey(resolveAuthorizedModuleKey(moduleKey, nextSession?.user));
    setView('admin');
  }

  function handleInternalLogout() {
    clearInternalSession();
    setInternalSession(null);
    setPage(moduleDefinition.defaultAdminPage);
  }

  function openAdmin(nextModuleKey = moduleKey) {
    const normalized = normalizeModuleKey(nextModuleKey) || DEFAULT_MODULE_KEY;
    setModuleKey(resolveAuthorizedModuleKey(normalized, internalSession?.user));
    setView('admin');
  }

  function openPublico(nextModuleKey = null) {
    const normalized = normalizeModuleKey(nextModuleKey);
    setPublicModuleKey(normalized || null);
    setView('publico');
  }

  function openPortal(nextModuleKey = DEFAULT_MODULE_KEY) {
    const normalized = normalizeModuleKey(nextModuleKey) || DEFAULT_MODULE_KEY;
    setPublicModuleKey(normalized);
    setView('portal');
  }

  function openDenuncias(categoria = '') {
    setDenunciaCategoria(categoria || '');
    setView('denuncias');
  }

  function handlePublicPanelNavigation(action) {
    if (action.view === 'admin') {
      openAdmin(action.module);
      return;
    }

    if (action.view === 'portal') {
      openPortal(action.module);
      return;
    }

    if (action.view === 'denuncias') {
      openDenuncias(action.categoria || '');
      return;
    }

    openPublico(action.module || null);
  }

  if (view === 'publico') {
    return (
      <PublicRouteErrorBoundary
        resetKey={`publico-${publicModuleKey || 'sigma'}`}
        onOpenPublico={() => openPublico(null)}
      >
        <Suspense fallback={<ShellLoading />}>
          {publicModuleKey && publicModuleDefinition?.renderPublicView ? (
            publicModuleDefinition.renderPublicView({
              onOpenAdmin: () => openAdmin(publicModuleKey),
              onOpenPortal: () => openPortal(publicModuleKey),
              onOpenPublico: () => openPublico(null),
            })
          ) : (
            <PainelPublicoSigma
              onNavigate={handlePublicPanelNavigation}
              onOpenAdmin={() => openAdmin()}
              onOpenDenuncias={openDenuncias}
            />
          )}
        </Suspense>
      </PublicRouteErrorBoundary>
    );
  }

  if (view === 'portal') {
    const portalModuleDefinition = publicModuleDefinition || defaultPublicModuleDefinition;
    const portalModuleKey = publicModuleKey || DEFAULT_MODULE_KEY;

    return (
      <PublicRouteErrorBoundary
        resetKey={`portal-${portalModuleKey}`}
        onOpenPublico={() => openPublico(null)}
      >
        <Suspense fallback={<ShellLoading />}>
          {portalModuleDefinition.renderPortalView({
            onOpenAdmin: () => openAdmin(portalModuleKey),
            onOpenPublico: () => openPublico(portalModuleKey),
            onOpenPainelPublico: () => openPublico(null),
          })}
        </Suspense>
      </PublicRouteErrorBoundary>
    );
  }

  if (view === 'denuncias') {
    return (
      <PublicRouteErrorBoundary
        resetKey={`denuncias-${denunciaCategoria}`}
        onOpenPublico={() => openPublico(null)}
      >
        <Suspense fallback={<ShellLoading />}>
          <DenunciasAmbientais
            initialCategoria={denunciaCategoria}
            onOpenPublico={() => openPublico(null)}
            onOpenAdmin={() => openAdmin()}
          />
        </Suspense>
      </PublicRouteErrorBoundary>
    );
  }

  if (!internalSession?.token) {
    return (
      <AdminLogin
        onLogin={handleInternalLogin}
        onOpenSigmaPanel={() => openPublico(null)}
        onOpenLicenciamentoPanel={() => openPublico('licenciamento')}
      />
    );
  }

  return (
    <AdminPlatformLayout
      currentPage={effectivePage}
      onSelectPage={setPage}
      user={internalSession.user}
      onLogout={handleInternalLogout}
      onOpenPortal={() => openPortal(moduleKey)}
      onOpenPublico={() => openPublico(null)}
      shellConfig={moduleDefinition.layoutConfig}
      availableModules={registeredModules}
              currentModuleKey={moduleKey}
              onSelectModule={(nextModuleKey) =>
                setModuleKey(resolveAuthorizedModuleKey(nextModuleKey, internalSession?.user))
              }
            >
      <Suspense fallback={<ShellLoading />}>
        {sharedPage
          ? renderSharedAdminPage({ page: effectivePage, user: internalSession.user, navigateToPage: setPage })
          : moduleDefinition.renderAdminPage({
              page: effectivePage,
              user: internalSession.user,
              navigateToPage: setPage,
            })}
      </Suspense>
    </AdminPlatformLayout>
  );
}

class PublicRouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={errorStyles.page}>
          <section style={errorStyles.card}>
            <h1 style={errorStyles.title}>Não foi possível carregar esta área no momento.</h1>
            <p style={errorStyles.text}>
              Retorne ao Painel Público SIGMA ou tente novamente. Se o problema continuar, a SMAD poderá verificar a rota pública.
            </p>
            <button type="button" style={errorStyles.button} onClick={this.props.onOpenPublico}>
              Voltar ao Painel Público SIGMA
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function ShellLoading() {
  return (
    <div style={loadingStyles.box}>
      <span style={loadingStyles.dot} />
      <span>Carregando...</span>
    </div>
  );
}

const loadingStyles = {
  box: {
    minHeight: '220px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    color: '#334155',
    fontWeight: 700,
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    background: '#1f6f43',
  },
};

const errorStyles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: 'linear-gradient(180deg, #eef6ff 0%, #ffffff 100%)',
    color: '#0d1b3d',
  },
  card: {
    width: 'min(560px, 100%)',
    border: '1px solid #d8e5f2',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '24px',
    boxShadow: '0 16px 38px rgba(13, 63, 143, 0.1)',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(24px, 5vw, 32px)',
    lineHeight: 1.15,
  },
  text: {
    color: '#4c5f78',
    lineHeight: 1.6,
  },
  button: {
    minHeight: '44px',
    border: '1px solid #176a36',
    borderRadius: '8px',
    background: '#1f7a3f',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 18px',
  },
};
