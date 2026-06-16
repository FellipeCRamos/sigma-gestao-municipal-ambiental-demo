/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import { portalRequerenteLayoutConfig } from '../layout/portalRequerenteLayoutConfig';

const PortalRequerenteAdmin = lazy(() => import('../pages/PortalRequerenteAdmin'));
const PortalRequerenteDashboard = lazy(() => import('../pages/PortalRequerenteDashboard'));

const PAGE_PERMISSIONS = {
  dashboard: PERMISSIONS.PORTAL_REQUERENTE_ADMIN_VISUALIZAR,
};

export const portalRequerenteModuleDefinition = {
  key: 'portal-requerente',
  title: 'Portal do Requerente',
  defaultAdminPage: 'dashboard',
  layoutConfig: portalRequerenteLayoutConfig,
  pagePermissions: PAGE_PERMISSIONS,
  resolveAdminPage(page, user) {
    const requestedPage = page || 'dashboard';
    return !user || hasPermission(user, PAGE_PERMISSIONS[requestedPage]) ? requestedPage : 'dashboard';
  },
  renderAdminPage() {
    return <PortalRequerenteAdmin />;
  },
  renderPublicView({ onOpenAdmin, onOpenPublico }) {
    return <PortalRequerenteDashboard onOpenAdmin={onOpenAdmin} onOpenPublico={onOpenPublico} />;
  },
  renderPortalView({ onOpenAdmin, onOpenPublico }) {
    return <PortalRequerenteDashboard onOpenAdmin={onOpenAdmin} onOpenPublico={onOpenPublico} />;
  },
};
