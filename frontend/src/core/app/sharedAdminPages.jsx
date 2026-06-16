/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

const Comunicacao = lazy(() => import('../pages/Comunicacao'));
const DemandasPublicasAdmin = lazy(() => import('../pages/DemandasPublicasAdmin'));
const CentralProtocolos = lazy(() => import('../pages/CentralProtocolos'));
const FiscalizacaoAmbiental = lazy(() => import('../pages/FiscalizacaoAmbiental'));
const VistoriasAmbientais = lazy(() => import('../pages/VistoriasAmbientais'));
const GeoambientalAdmin = lazy(() => import('../pages/GeoambientalAdmin'));

export const SHARED_ADMIN_NAVIGATION = [
  { key: 'demandas-publicas', label: 'Demandas publicas', permission: PERMISSIONS.DEMANDAS_PUBLICAS_VIEW },
  { key: 'fiscalizacao', label: 'Fiscalizacao', permission: PERMISSIONS.FISCALIZACAO_VIEW },
  { key: 'vistorias', label: 'Vistorias', permission: PERMISSIONS.VISTORIA_VIEW },
  { key: 'geoambiental', label: 'Geoambiental', permission: PERMISSIONS.GEOAMBIENTAL_VISUALIZAR },
  { key: 'protocolos', label: 'Protocolos', permission: PERMISSIONS.PROTOCOLOS_VIEW },
  { key: 'comunicacao', label: 'Comunicacao', permission: PERMISSIONS.COMUNICACAO_VIEW },
];

const SHARED_PAGE_PERMISSIONS = {
  'demandas-publicas': PERMISSIONS.DEMANDAS_PUBLICAS_VIEW,
  fiscalizacao: PERMISSIONS.FISCALIZACAO_VIEW,
  vistorias: PERMISSIONS.VISTORIA_VIEW,
  geoambiental: PERMISSIONS.GEOAMBIENTAL_VISUALIZAR,
  protocolos: PERMISSIONS.PROTOCOLOS_VIEW,
  comunicacao: PERMISSIONS.COMUNICACAO_VIEW,
};

export function isSharedAdminPage(page) {
  return Boolean(SHARED_PAGE_PERMISSIONS[page]);
}

export function resolveSharedAdminPage(page, user) {
  if (!isSharedAdminPage(page)) return null;
  return hasPermission(user, SHARED_PAGE_PERMISSIONS[page]) ? page : null;
}

export function renderSharedAdminPage({ page, user, navigateToPage }) {
  if (page === 'demandas-publicas') {
    return <DemandasPublicasAdmin user={user} navigateToPage={navigateToPage} />;
  }

  if (page === 'fiscalizacao') {
    return <FiscalizacaoAmbiental user={user} navigateToPage={navigateToPage} />;
  }

  if (page === 'vistorias') {
    return <VistoriasAmbientais user={user} navigateToPage={navigateToPage} />;
  }

  if (page === 'geoambiental') {
    return <GeoambientalAdmin user={user} navigateToPage={navigateToPage} />;
  }

  if (page === 'protocolos') {
    return <CentralProtocolos navigateToPage={navigateToPage} />;
  }

  if (page === 'comunicacao') {
    return <Comunicacao />;
  }

  return null;
}
