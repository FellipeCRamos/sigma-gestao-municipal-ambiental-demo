import { PERMISSIONS } from '../../../utils/permissions';

export const sigbaAdminNavigation = [
  { key: 'dashboard', label: 'Dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
  { key: 'operacao', label: 'Operação', permission: PERMISSIONS.OPERACAO_FILA_VIEW },
  { key: 'saneamento', label: 'Saneamento', permission: PERMISSIONS.QUALIDADE_VIEW },
  { key: 'territorios', label: 'Territórios', permission: PERMISSIONS.TERRITORIOS_VIEW },
  { key: 'animais', label: 'Animais', permission: PERMISSIONS.ANIMAIS_VIEW },
  { key: 'tutores', label: 'Tutores', permission: PERMISSIONS.TUTORES_VIEW },
  { key: 'campanhas', label: 'Campanhas', permission: PERMISSIONS.CAMPANHAS_VIEW },
  { key: 'ocorrencias', label: 'Ocorrências', permission: PERMISSIONS.OCORRENCIAS_VIEW },
  { key: 'integracoes', label: 'Integrações', permission: PERMISSIONS.INTEGRACOES_VIEW },
];

export const sigbaLayoutConfig = {
  moduleKey: 'sigba',
  platformName: 'Plataforma SIGMA',
  brandBadge: 'SIGMA',
  brandSub: 'Sistema Integrado de Gestão Municipal Ambiental',
  pageTitle: 'Bem-estar Animal',
  pageSubtitle: 'Módulo de gestão municipal de bem-estar animal',
  environmentLabel: 'Área interna SMAD',
  portalButtonLabel: 'Portal do Tutor',
  publicButtonLabel: 'Painel público',
  logoutButtonLabel: 'Sair',
  footerText: 'SMAD - Plataforma SIGMA',
  menuItems: sigbaAdminNavigation,
};
