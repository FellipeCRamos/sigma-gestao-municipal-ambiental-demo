/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import { educacaoAmbientalLayoutConfig } from '../layout/educacaoAmbientalLayoutConfig';

const EducacaoAmbientalDashboard = lazy(() => import('../pages/EducacaoAmbientalDashboard'));
const ConteudosEducacaoPage = lazy(() => import('../pages/ConteudosEducacaoPage'));
const CuradoriaEducacaoPage = lazy(() => import('../pages/CuradoriaEducacaoPage'));
const FontesEducacaoPage = lazy(() => import('../pages/FontesEducacaoPage'));
const ReferenciasEducacaoPage = lazy(() => import('../pages/ReferenciasEducacaoPage'));
const NormasAmbientaisPage = lazy(() => import('../pages/NormasAmbientaisPage'));
const AgendaAmbientalPage = lazy(() => import('../pages/AgendaAmbientalPage'));
const MateriaisEducativosPage = lazy(() => import('../pages/MateriaisEducativosPage'));
const TrilhasEducativasPage = lazy(() => import('../pages/TrilhasEducativasPage'));
const BiodiversidadeEspeciesPage = lazy(() => import('../pages/BiodiversidadeEspeciesPage'));
const AreasAmbientaisPage = lazy(() => import('../pages/AreasAmbientaisPage'));
const ProgramasMetasPage = lazy(() => import('../pages/ProgramasMetasPage'));
const FaqEducacaoPage = lazy(() => import('../pages/FaqEducacaoPage'));
const BaseConhecimentoValidadaPage = lazy(() => import('../pages/BaseConhecimentoValidadaPage'));
const EducacaoAmbientalPublico = lazy(() => import('../pages/EducacaoAmbientalPublico'));

const PAGE_PERMISSIONS = {
  dashboard: PERMISSIONS.EDUCACAO_AMBIENTAL_VISUALIZAR,
  conteudos: PERMISSIONS.EDUCACAO_AMBIENTAL_VISUALIZAR,
  curadoria: PERMISSIONS.EDUCACAO_AMBIENTAL_CURADORIA_VISUALIZAR,
  fontes: PERMISSIONS.EDUCACAO_AMBIENTAL_FONTES_GERENCIAR,
  referencias: PERMISSIONS.EDUCACAO_AMBIENTAL_REFERENCIAS_GERENCIAR,
  normas: PERMISSIONS.EDUCACAO_AMBIENTAL_NORMAS_GERENCIAR,
  agenda: PERMISSIONS.EDUCACAO_AMBIENTAL_AGENDA_GERENCIAR,
  materiais: PERMISSIONS.EDUCACAO_AMBIENTAL_MATERIAIS_GERENCIAR,
  trilhas: PERMISSIONS.EDUCACAO_AMBIENTAL_TRILHAS_GERENCIAR,
  especies: PERMISSIONS.EDUCACAO_AMBIENTAL_BIODIVERSIDADE_GERENCIAR,
  areas: PERMISSIONS.EDUCACAO_AMBIENTAL_AREAS_GERENCIAR,
  programas: PERMISSIONS.EDUCACAO_AMBIENTAL_PROGRAMAS_GERENCIAR,
  faq: PERMISSIONS.EDUCACAO_AMBIENTAL_EDITAR,
  base_ia: PERMISSIONS.EDUCACAO_AMBIENTAL_CURADORIA_VISUALIZAR,
};

function renderAdminPage(page, user) {
  switch (page) {
    case 'dashboard':
      return <EducacaoAmbientalDashboard usuarioInterno={user} />;
    case 'conteudos':
      return <ConteudosEducacaoPage usuarioInterno={user} />;
    case 'curadoria':
      return <CuradoriaEducacaoPage usuarioInterno={user} />;
    case 'fontes':
      return <FontesEducacaoPage usuarioInterno={user} />;
    case 'referencias':
      return <ReferenciasEducacaoPage usuarioInterno={user} />;
    case 'normas':
      return <NormasAmbientaisPage usuarioInterno={user} />;
    case 'agenda':
      return <AgendaAmbientalPage usuarioInterno={user} />;
    case 'materiais':
      return <MateriaisEducativosPage usuarioInterno={user} />;
    case 'trilhas':
      return <TrilhasEducativasPage usuarioInterno={user} />;
    case 'especies':
      return <BiodiversidadeEspeciesPage usuarioInterno={user} />;
    case 'areas':
      return <AreasAmbientaisPage usuarioInterno={user} />;
    case 'programas':
      return <ProgramasMetasPage usuarioInterno={user} />;
    case 'faq':
      return <FaqEducacaoPage usuarioInterno={user} />;
    case 'base_ia':
      return <BaseConhecimentoValidadaPage usuarioInterno={user} />;
    default:
      return <EducacaoAmbientalDashboard usuarioInterno={user} />;
  }
}

export const educacaoAmbientalModuleDefinition = {
  key: 'educacao-ambiental',
  title: 'Educacao Ambiental',
  defaultAdminPage: 'dashboard',
  layoutConfig: educacaoAmbientalLayoutConfig,
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
  renderPublicView({ onOpenAdmin, onOpenPublico, onOpenPainelPublico }) {
    return (
      <EducacaoAmbientalPublico
        onOpenAdmin={onOpenAdmin}
        onOpenPainelPublico={onOpenPainelPublico || onOpenPublico}
      />
    );
  },
  renderPortalView({ onOpenAdmin, onOpenPublico, onOpenPainelPublico }) {
    return (
      <EducacaoAmbientalPublico
        onOpenAdmin={onOpenAdmin}
        onOpenPainelPublico={onOpenPainelPublico || onOpenPublico}
      />
    );
  },
};
