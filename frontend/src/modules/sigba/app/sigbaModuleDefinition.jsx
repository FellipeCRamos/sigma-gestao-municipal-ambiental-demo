/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import Publico from '../../../pages/Publico';
import PortalTutor from '../../../pages/PortalTutor';
import { sigbaLayoutConfig } from '../layout/sigbaLayoutConfig';

const Dashboard = lazy(() => import('../../../pages/Dashboard'));
const Animais = lazy(() => import('../../../pages/Animais'));
const Tutores = lazy(() => import('../../../pages/Tutores'));
const Campanhas = lazy(() => import('../../../pages/Campanhas'));
const Ocorrencias = lazy(() => import('../../../pages/Ocorrencias'));
const Integracoes = lazy(() => import('../../../pages/Integracoes'));
const Saneamento = lazy(() => import('../../../pages/Saneamento'));
const Operacao = lazy(() => import('../../../pages/Operacao'));
const Territorios = lazy(() => import('../../../pages/Territorios'));

const PAGE_PERMISSIONS = {
  dashboard: PERMISSIONS.DASHBOARD_VIEW,
  operacao: PERMISSIONS.OPERACAO_FILA_VIEW,
  saneamento: PERMISSIONS.QUALIDADE_VIEW,
  territorios: PERMISSIONS.TERRITORIOS_VIEW,
  animais: PERMISSIONS.ANIMAIS_VIEW,
  tutores: PERMISSIONS.TUTORES_VIEW,
  campanhas: PERMISSIONS.CAMPANHAS_VIEW,
  ocorrencias: PERMISSIONS.OCORRENCIAS_VIEW,
  integracoes: PERMISSIONS.INTEGRACOES_VIEW,
};

function renderAdminPage(page, user, navigateToPage) {
  switch (page) {
    case 'dashboard':
      return <Dashboard />;
    case 'operacao':
      return (
        <Operacao
          usuarioInterno={user}
          onOpenCampanhas={() => navigateToPage('campanhas')}
          onOpenOcorrencias={() => navigateToPage('ocorrencias')}
        />
      );
    case 'saneamento':
      return <Saneamento usuarioInterno={user} />;
    case 'territorios':
      return <Territorios usuarioInterno={user} />;
    case 'animais':
      return <Animais usuarioInterno={user} />;
    case 'tutores':
      return <Tutores usuarioInterno={user} />;
    case 'campanhas':
      return <Campanhas usuarioInterno={user} />;
    case 'ocorrencias':
      return <Ocorrencias usuarioInterno={user} />;
    case 'integracoes':
      return <Integracoes usuarioInterno={user} />;
    default:
      return <Dashboard />;
  }
}

export const sigbaModuleDefinition = {
  key: 'sigba',
  title: 'Bem-estar Animal',
  defaultAdminPage: 'dashboard',
  layoutConfig: sigbaLayoutConfig,
  pagePermissions: PAGE_PERMISSIONS,
  resolveAdminPage(page, user) {
    const requestedPage = page || 'dashboard';

    if (!user) {
      return requestedPage;
    }

    return hasPermission(user, PAGE_PERMISSIONS[requestedPage]) ? requestedPage : 'dashboard';
  },
  renderAdminPage({ page, user, navigateToPage }) {
    return renderAdminPage(page, user, navigateToPage);
  },
  renderPublicView({ onOpenAdmin, onOpenPortal }) {
    return <Publico onOpenAdmin={onOpenAdmin} onOpenPortal={onOpenPortal} />;
  },
  renderPortalView({ onOpenAdmin, onOpenPublico }) {
    return <PortalTutor onOpenAdmin={onOpenAdmin} onOpenPublico={onOpenPublico} />;
  },
};
