import SidebarButton from '../../components/SidebarButton';
import { hasPermission } from '../../utils/permissions';
import { SHARED_ADMIN_NAVIGATION } from '../app/sharedAdminPages';

export default function AdminPlatformLayout({
  currentPage,
  onSelectPage,
  children,
  user,
  onLogout,
  onOpenPortal,
  onOpenPublico,
  shellConfig,
  availableModules = [],
  currentModuleKey = '',
  onSelectModule,
}) {
  const theme = shellConfig?.theme || {};
  const userLabel = user?.nome || user?.email || 'Usuário interno';
  const visibleItems = [...(shellConfig?.menuItems || []), ...SHARED_ADMIN_NAVIGATION].filter((item) =>
    hasPermission(user, item.permission)
  );
  const themeVars = {
    '--admin-nav-active-bg': theme.navActiveBackground || '#111827',
    '--admin-nav-active-border': theme.navActiveBorder || theme.navActiveBackground || '#111827',
    '--admin-nav-active-color': theme.navActiveColor || '#ffffff',
    '--admin-nav-active-shadow': theme.navActiveShadow || 'none',
    '--admin-nav-bg': theme.navBackground || '#ffffff',
    '--admin-nav-border': theme.navBorder || '#e5e7eb',
    '--admin-nav-color': theme.navColor || '#111827',
  };

  return (
    <div
      className="sigma-admin-shell sigba-admin-shell"
      style={{
        ...styles.app,
        ...themeVars,
        background: theme.appBackground || styles.app.background,
      }}
    >
      <aside
        className="sigma-admin-sidebar sigba-admin-sidebar"
        style={{
          ...styles.sidebar,
          background: theme.sidebarBackground || styles.sidebar.background,
          borderRight: `1px solid ${theme.sidebarBorder || '#e5e7eb'}`,
          boxShadow: theme.sidebarShadow || styles.sidebar.boxShadow,
        }}
      >
        <div style={styles.brandBox}>
          <p
            style={{
              ...styles.platformLabel,
              color: theme.platformLabelColor || styles.platformLabel.color,
            }}
          >
            {shellConfig?.platformName || 'Plataforma SIGMA'}
          </p>
          <div
            style={{
              ...styles.brandBadge,
              background: theme.brandBackground || styles.brandBadge.background,
              color: theme.brandColor || styles.brandBadge.color,
              boxShadow: theme.brandShadow || styles.brandBadge.boxShadow,
            }}
          >
            {shellConfig?.brandBadge || 'SMAD'}
          </div>
          <p
            style={{
              ...styles.brandSub,
              color: theme.brandSubColor || styles.brandSub.color,
            }}
          >
            {shellConfig?.brandSub || 'Plataforma institucional'}
          </p>
        </div>

        <nav className="sigma-admin-nav sigba-admin-nav" style={styles.nav}>
          {visibleItems.map((item) => (
            <SidebarButton
              key={item.key}
              label={item.label}
              active={currentPage === item.key}
              onClick={() => onSelectPage(item.key)}
            />
          ))}
        </nav>

        <div
          style={{
            ...styles.sidebarFooter,
            borderTop: `1px solid ${theme.sidebarDivider || '#e5e7eb'}`,
          }}
        >
          <small
            style={{
              ...styles.footerText,
              color: theme.footerColor || styles.footerText.color,
            }}
          >
            {shellConfig?.footerText || 'SMAD'}
          </small>
        </div>
      </aside>

      <div
        style={{
          ...styles.mainWrapper,
          background: theme.mainBackground || styles.mainWrapper.background,
        }}
      >
        <header
          className="sigma-admin-header sigba-admin-header"
          style={{
            ...styles.header,
            background: theme.headerBackground || styles.header.background,
            borderBottom: `1px solid ${theme.headerBorder || '#e5e7eb'}`,
            boxShadow: theme.headerShadow || styles.header.boxShadow,
          }}
        >
          <div>
            <h1
              style={{
                ...styles.pageTitle,
                color: theme.titleColor || styles.pageTitle.color,
              }}
            >
              {shellConfig?.pageTitle || 'SMAD'}
            </h1>
            <p
              style={{
                ...styles.pageSubtitle,
                color: theme.subtitleColor || styles.pageSubtitle.color,
              }}
            >
              {shellConfig?.pageSubtitle || 'Plataforma institucional'}
            </p>
          </div>

          <div className="sigma-admin-actions sigba-admin-actions" style={styles.headerActions}>
            <div
              style={{
                ...styles.headerInfo,
                background: theme.infoBackground || styles.headerInfo.background,
                border: `1px solid ${theme.infoBorder || '#e5e7eb'}`,
              }}
            >
              <div
                style={{
                  ...styles.statusDot,
                  background: theme.accent || styles.statusDot.background,
                }}
              />
              <span
                style={{
                  ...styles.statusText,
                  color: theme.infoColor || styles.statusText.color,
                }}
              >
                {shellConfig?.environmentLabel || 'Área interna SMAD'}
              </span>
            </div>
            <span
              style={{
                ...styles.userBadge,
                background: theme.controlBackground || styles.userBadge.background,
                border: `1px solid ${theme.controlBorder || '#d1d5db'}`,
                color: theme.controlColor || styles.userBadge.color,
              }}
            >
              {userLabel}
            </span>
            {availableModules.length > 1 ? (
              <label
                style={{
                  ...styles.moduleSelectWrapper,
                  background: theme.controlBackground || styles.moduleSelectWrapper.background,
                  border: `1px solid ${theme.controlBorder || '#d1d5db'}`,
                }}
              >
                <span style={styles.moduleSelectLabel}>Módulo</span>
                <select
                  style={styles.moduleSelect}
                  value={currentModuleKey}
                  onChange={(event) => onSelectModule?.(event.target.value)}
                >
                  {availableModules.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {onOpenPortal && shellConfig?.showPortalShortcut !== false ? (
              <button
                type="button"
                onClick={onOpenPortal}
                style={{
                  ...styles.headerButton,
                  background: theme.controlBackground || styles.headerButton.background,
                  border: `1px solid ${theme.controlBorder || '#cbd5e1'}`,
                  color: theme.controlColor || styles.headerButton.color,
                }}
              >
                {shellConfig?.portalButtonLabel || 'Portal'}
              </button>
            ) : null}
            {onOpenPublico && shellConfig?.showPublicShortcut !== false ? (
              <button
                type="button"
                onClick={onOpenPublico}
                style={{
                  ...styles.headerButton,
                  background: theme.controlBackground || styles.headerButton.background,
                  border: `1px solid ${theme.controlBorder || '#cbd5e1'}`,
                  color: theme.controlColor || styles.headerButton.color,
                }}
              >
                {shellConfig?.publicButtonLabel || 'Painel público'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              style={{
                ...styles.headerButton,
                background: theme.controlBackground || styles.headerButton.background,
                border: `1px solid ${theme.controlBorder || '#cbd5e1'}`,
                color: theme.controlColor || styles.headerButton.color,
              }}
            >
              {shellConfig?.logoutButtonLabel || 'Sair'}
            </button>
          </div>
        </header>

        <main
          className="sigma-admin-content sigba-admin-content"
          style={{
            ...styles.content,
            background: theme.contentBackground || styles.content.background,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

const styles = {
  app: {
    display: 'grid',
    minHeight: '100vh',
    background: '#f3f4f6',
  },
  sidebar: {
    background: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    padding: '24px 18px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: 'none',
  },
  brandBox: {
    marginBottom: '24px',
  },
  platformLabel: {
    margin: '0 0 8px 0',
    color: '#6b7280',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  brandBadge: {
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#111827',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '15px',
    marginBottom: '12px',
    boxShadow: 'none',
  },
  brandSub: {
    margin: 0,
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  sidebarFooter: {
    paddingTop: '20px',
    borderTop: '1px solid #e5e7eb',
    marginTop: '20px',
  },
  footerText: {
    color: '#6b7280',
    fontSize: '12px',
  },
  mainWrapper: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    background: 'transparent',
  },
  header: {
    height: '84px',
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    boxShadow: 'none',
  },
  pageTitle: {
    margin: 0,
    fontSize: '22px',
    color: '#111827',
  },
  pageSubtitle: {
    margin: '4px 0 0 0',
    color: '#6b7280',
    fontSize: '13px',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '999px',
    padding: '8px 12px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  userBadge: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    color: '#374151',
    background: '#ffffff',
    padding: '8px 10px',
    fontSize: '13px',
    fontWeight: 700,
  },
  moduleSelectWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '6px 10px',
  },
  moduleSelectLabel: {
    fontSize: '13px',
    color: '#475569',
    fontWeight: 600,
  },
  moduleSelect: {
    border: 'none',
    background: 'transparent',
    color: '#111827',
    fontWeight: 700,
    fontSize: '13px',
  },
  headerButton: {
    height: '38px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0 12px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    background: '#22c55e',
  },
  statusText: {
    fontSize: '13px',
    color: '#374151',
    fontWeight: 500,
  },
  content: {
    padding: '24px',
    background: 'transparent',
  },
};
