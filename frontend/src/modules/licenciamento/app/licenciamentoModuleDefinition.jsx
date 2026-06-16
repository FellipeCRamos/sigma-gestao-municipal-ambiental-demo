/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import ModuloPublicoPlaceholder from '../../../core/publico/ModuloPublicoPlaceholder';
import { licenciamentoLayoutConfig } from '../layout/licenciamentoLayoutConfig';

const DashboardLicenciamento = lazy(() => import('../pages/DashboardLicenciamento'));
const ListaProcessosLicenciamento = lazy(() => import('../pages/ListaProcessosLicenciamento'));
const FormProcessoLicenciamento = lazy(() => import('../pages/FormProcessoLicenciamento'));
const ParametrosLicenciamento = lazy(() => import('../pages/ParametrosLicenciamento'));
const GovernancaNormativaLicenciamento = lazy(() => import('../pages/GovernancaNormativaLicenciamento'));
const HomologacaoAssistidaLicenciamento = lazy(() => import('../pages/HomologacaoAssistidaLicenciamento'));
const FechamentoHomologacaoLicenciamento = lazy(() => import('../pages/FechamentoHomologacaoLicenciamento'));
const PreenchimentoAssistidoChecklistLicenciamento = lazy(() => import('../pages/PreenchimentoAssistidoChecklistLicenciamento'));
const ParametrizacaoDecretoFase2D1 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D1'));
const ParametrizacaoDecretoFase2D2 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D2'));
const ParametrizacaoDecretoFase2D21 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D21'));
const ParametrizacaoDecretoFase2D3 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D3'));
const ConferenciaNormativaGrupo19Fase2D4A = lazy(() => import('../pages/ConferenciaNormativaGrupo19Fase2D4A'));
const ParametrizacaoDecretoFase2D4B = lazy(() => import('../pages/ParametrizacaoDecretoFase2D4B'));
const ParametrizacaoDecretoFase2D5A = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5A'));
const ParametrizacaoDecretoFase2D5B = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5B'));
const ParametrizacaoDecretoFase2D5C = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C'));
const ParametrizacaoDecretoFase2D5C1 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C1'));
const ParametrizacaoDecretoFase2D5C2 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C2'));
const ParametrizacaoDecretoFase2D5C2A = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C2A'));
const ParametrizacaoDecretoFase2D5C2B = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C2B'));
const ParametrizacaoDecretoFase2D5C2C = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C2C'));
const ParametrizacaoDecretoFase2D5C3A = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C3A'));
const ParametrizacaoDecretoFase2D5C3B = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C3B'));
const ParametrizacaoDecretoFase2D5C4 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C4'));
const ParametrizacaoDecretoFase2D5C5 = lazy(() => import('../pages/ParametrizacaoDecretoFase2D5C5'));
const LicenciamentoAssistenteAnalises = lazy(() => import('../pages/LicenciamentoAssistenteAnalises'));
const LicenciamentoPreRequerimentos = lazy(() => import('../pages/LicenciamentoPreRequerimentos'));
const LicenciamentoPublico = lazy(() => import('../pages/LicenciamentoPublico'));

const PAGE_PERMISSIONS = {
  dashboard: PERMISSIONS.LICENCIAMENTO_DASHBOARD_VIEW,
  processos: PERMISSIONS.LICENCIAMENTO_PROCESSOS_VIEW,
  novo: PERMISSIONS.LICENCIAMENTO_PROCESSOS_CREATE,
  parametros: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  governanca: PERMISSIONS.LICENCIAMENTO_GOVERNANCA_NORMATIVA_VIEW,
  homologacao: PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_ASSISTIDA_VIEW,
  fechamento: PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_VIEW,
  checklist: PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_VIEW,
  parametrizacao2d1: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d2: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d21: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d3: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d4a: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d4b: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d5a: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d5b: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d5c: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d5c1: PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW,
  parametrizacao2d5c2: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW,
  parametrizacao2d5c2a: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW,
  parametrizacao2d5c2b: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_VIEW,
  parametrizacao2d5c2c: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW,
  parametrizacao2d5c3a: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW,
  parametrizacao2d5c3b: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW,
  parametrizacao2d5c4: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW,
  parametrizacao2d5c5: PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW,
  assistenteAnalises: PERMISSIONS.LICENCIAMENTO_ASSISTENTE_VIEW,
  preRequerimentos: PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_VIEW,
};

function renderAdminPage(page, user, navigateToPage) {
  switch (page) {
    case 'dashboard':
      return <DashboardLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'processos':
      return <ListaProcessosLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'novo':
      return <FormProcessoLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametros':
      return <ParametrosLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'governanca':
      return <GovernancaNormativaLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'homologacao':
      return <HomologacaoAssistidaLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'fechamento':
      return <FechamentoHomologacaoLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'checklist':
      return <PreenchimentoAssistidoChecklistLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d1':
      return <ParametrizacaoDecretoFase2D1 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d2':
      return <ParametrizacaoDecretoFase2D2 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d21':
      return <ParametrizacaoDecretoFase2D21 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d3':
      return <ParametrizacaoDecretoFase2D3 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d4a':
      return <ConferenciaNormativaGrupo19Fase2D4A usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d4b':
      return <ParametrizacaoDecretoFase2D4B usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5a':
      return <ParametrizacaoDecretoFase2D5A usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5b':
      return <ParametrizacaoDecretoFase2D5B usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c':
      return <ParametrizacaoDecretoFase2D5C usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c1':
      return <ParametrizacaoDecretoFase2D5C1 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c2':
      return <ParametrizacaoDecretoFase2D5C2 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c2a':
      return <ParametrizacaoDecretoFase2D5C2A usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c2b':
      return <ParametrizacaoDecretoFase2D5C2B usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c2c':
      return <ParametrizacaoDecretoFase2D5C2C usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c3a':
      return <ParametrizacaoDecretoFase2D5C3A usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c3b':
      return <ParametrizacaoDecretoFase2D5C3B usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c4':
      return <ParametrizacaoDecretoFase2D5C4 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'parametrizacao2d5c5':
      return <ParametrizacaoDecretoFase2D5C5 usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'assistenteAnalises':
      return <LicenciamentoAssistenteAnalises usuarioInterno={user} navigateToPage={navigateToPage} />;
    case 'preRequerimentos':
      return <LicenciamentoPreRequerimentos usuarioInterno={user} navigateToPage={navigateToPage} />;
    default:
      return <DashboardLicenciamento usuarioInterno={user} navigateToPage={navigateToPage} />;
  }
}

export const licenciamentoModuleDefinition = {
  key: 'licenciamento',
  title: 'Licenciamento Ambiental',
  defaultAdminPage: 'dashboard',
  layoutConfig: licenciamentoLayoutConfig,
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
  renderPublicView({ onOpenAdmin, onOpenPublico, onOpenPainelPublico, onOpenPortal }) {
    return (
      <LicenciamentoPublico
        onOpenAdmin={onOpenAdmin}
        onOpenPainelPublico={onOpenPainelPublico || onOpenPublico}
        onOpenPortal={onOpenPortal}
      />
    );
  },
  renderPortalView({ onOpenAdmin, onOpenPublico, onOpenPainelPublico }) {
    return (
      <ModuloPublicoPlaceholder
        title="Portal do Requerente"
        eyebrow="Licenciamento Ambiental"
        description="Portal do Requerente em implantação. Em etapa futura, o requerente poderá salvar simulações, iniciar requerimentos, anexar documentos, responder diligências e acompanhar processos."
        portalTitle="Portal do Requerente em implantação"
        portalText="A funcionalidade será integrada ao núcleo SIGMA, mantendo login externo por perfil público e a autenticação interna única da SMAD."
        primaryActionLabel="Área pública do Licenciamento"
        secondaryActionLabel="Painel Público SIGMA"
        onOpenAdmin={onOpenAdmin}
        onOpenPublico={onOpenPainelPublico || onOpenPublico}
        onOpenPortal={onOpenPublico}
      />
    );
  },
};
