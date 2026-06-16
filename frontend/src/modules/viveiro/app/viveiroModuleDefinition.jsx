/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import { viveiroLayoutConfig } from '../layout/viveiroLayoutConfig';

const ViveiroDashboardPage = lazy(() => import('../pages/ViveiroDashboardPage'));
const ViveiroEspeciesPage = lazy(() => import('../pages/ViveiroEspeciesPage'));
const ViveiroLotesPage = lazy(() => import('../pages/ViveiroLotesPage'));
const ViveiroEstoquePage = lazy(() => import('../pages/ViveiroEstoquePage'));
const ViveiroSolicitacoesPage = lazy(() => import('../pages/ViveiroSolicitacoesPage'));
const ViveiroEntregasPage = lazy(() => import('../pages/ViveiroEntregasPage'));
const ViveiroPublicPortalPage = lazy(() => import('../pages/ViveiroPublicPortalPage'));

const PAGE_PERMISSIONS = {
  dashboard: PERMISSIONS.VIVEIRO_DASHBOARD_VIEW,
  especies: PERMISSIONS.VIVEIRO_ESPECIES_VIEW,
  lotes: PERMISSIONS.VIVEIRO_LOTES_VIEW,
  estoque: PERMISSIONS.VIVEIRO_ESTOQUE_VIEW,
  solicitacoes: PERMISSIONS.VIVEIRO_SOLICITACOES_VIEW,
  entregas: PERMISSIONS.VIVEIRO_ENTREGAS_VIEW,
};

function renderAdminPage(page, user) {
  switch (page) {
    case 'dashboard':
      return <ViveiroDashboardPage usuarioInterno={user} />;
    case 'especies':
      return <ViveiroEspeciesPage usuarioInterno={user} />;
    case 'lotes':
      return <ViveiroLotesPage usuarioInterno={user} />;
    case 'estoque':
      return <ViveiroEstoquePage usuarioInterno={user} />;
    case 'solicitacoes':
      return <ViveiroSolicitacoesPage usuarioInterno={user} />;
    case 'entregas':
      return <ViveiroEntregasPage usuarioInterno={user} />;
    default:
      return <ViveiroDashboardPage usuarioInterno={user} />;
  }
}

export const viveiroModuleDefinition = {
  key: 'viveiro',
  title: 'Viveiro Municipal',
  defaultAdminPage: 'dashboard',
  layoutConfig: viveiroLayoutConfig,
  pagePermissions: PAGE_PERMISSIONS,
  resolveAdminPage(page, user) {
    const requestedPage = page || 'dashboard';

    if (!user) {
      return requestedPage;
    }

    return hasPermission(user, PAGE_PERMISSIONS[requestedPage]) ? requestedPage : 'dashboard';
  },
  renderAdminPage({ page, user }) {
    return renderAdminPage(page, user);
  },
  renderPublicView({ onOpenAdmin, onOpenPublico, onOpenPortal }) {
    return (
      <ViveiroPublicPortalPage
        onOpenAdmin={onOpenAdmin}
        onOpenPublico={onOpenPublico}
        onOpenPainelPublico={onOpenPortal ? () => onOpenPublico?.() : undefined}
      />
    );
  },
  renderPortalView({ onOpenAdmin, onOpenPublico, onOpenPainelPublico }) {
    return (
      <ViveiroPublicPortalPage
        onOpenAdmin={onOpenAdmin}
        onOpenPublico={onOpenPublico}
        onOpenPainelPublico={onOpenPainelPublico}
      />
    );
  },
};
