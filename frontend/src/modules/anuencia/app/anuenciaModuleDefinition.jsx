/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import ModuloPublicoPlaceholder from '../../../core/publico/ModuloPublicoPlaceholder';
import { anuenciaLayoutConfig } from '../layout/anuenciaLayoutConfig';

const AnuenciaAmbientalAdmin = lazy(() => import('../pages/AnuenciaAmbientalAdmin'));

const PAGE_PERMISSIONS = {
  dashboard: PERMISSIONS.ANUENCIA_VISUALIZAR,
};

export const anuenciaModuleDefinition = {
  key: 'anuencia',
  title: 'Anuencia Ambiental',
  defaultAdminPage: 'dashboard',
  layoutConfig: anuenciaLayoutConfig,
  pagePermissions: PAGE_PERMISSIONS,
  resolveAdminPage(page, user) {
    const requestedPage = page || 'dashboard';
    return !user || hasPermission(user, PAGE_PERMISSIONS[requestedPage]) ? requestedPage : 'dashboard';
  },
  renderAdminPage({ user }) {
    return <AnuenciaAmbientalAdmin usuarioInterno={user} />;
  },
  renderPublicView({ onOpenAdmin, onOpenPublico }) {
    return (
      <ModuloPublicoPlaceholder
        title="Anuencia Ambiental"
        eyebrow="Modulo interno"
        description="O Modulo de Anuencia Ambiental esta restrito a uso interno e homologacao assistida pela SMAD."
        portalTitle="Portal externo nao habilitado"
        portalText="A abertura externa depende de sprint futura, validacao juridica, LGPD e protocolo controlado."
        primaryActionLabel="Painel Publico SIGMA"
        secondaryActionLabel="Area interna"
        onOpenAdmin={onOpenAdmin}
        onOpenPublico={onOpenPublico}
      />
    );
  },
  renderPortalView({ onOpenAdmin, onOpenPublico }) {
    return (
      <ModuloPublicoPlaceholder
        title="Anuencia Ambiental"
        eyebrow="Modulo interno"
        description="O Portal do Requerente para Anuencia Ambiental sera tratado em sprint futura com protocolo externo controlado."
        portalTitle="Portal externo nao habilitado"
        portalText="A funcionalidade permanece restrita a area interna da SMAD."
        primaryActionLabel="Painel Publico SIGMA"
        secondaryActionLabel="Area interna"
        onOpenAdmin={onOpenAdmin}
        onOpenPublico={onOpenPublico}
      />
    );
  },
};
