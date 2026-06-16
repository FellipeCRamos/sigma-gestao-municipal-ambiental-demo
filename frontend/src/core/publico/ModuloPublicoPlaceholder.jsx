import logoMunicipioDemo from '../../assets/logo-municipio-demo-thumbnail.png';

export default function ModuloPublicoPlaceholder({
  title,
  eyebrow = 'Plataforma SIGMA',
  description,
  portalTitle,
  portalText,
  statusLabel = 'Em implantação',
  noticeItems = [],
  primaryActionLabel = 'Portal externo',
  secondaryActionLabel = 'Painel Público SIGMA',
  onOpenAdmin,
  onOpenPublico,
  onOpenPortal,
}) {
  return (
    <main style={styles.page} className="sigma-public-page">
      <header style={styles.header} className="sigma-public-header">
        <button type="button" style={styles.brandButton} className="sigma-public-brand" onClick={onOpenPublico}>
          <img src={logoMunicipioDemo} alt="Município demonstrativo" style={styles.logo} />
          <span style={styles.brandText}>
            <strong>SMAD</strong>
            <span>Plataforma SIGMA</span>
          </span>
        </button>
        <button type="button" style={styles.internalButton} className="sigma-public-button" onClick={onOpenAdmin}>
          Acesso interno SMAD
        </button>
      </header>

      <section style={styles.hero} className="sigma-public-hero">
        <div>
          <span style={styles.eyebrow} className="sigma-public-badge">{eyebrow}</span>
          <h1 style={styles.title} className="sigma-public-title">{title}</h1>
          <p style={styles.description} className="sigma-public-subtitle">{description}</p>
          <div style={styles.actions}>
            {onOpenPortal ? (
              <button type="button" style={styles.primaryButton} className="sigma-public-button" onClick={onOpenPortal}>
                {primaryActionLabel}
              </button>
            ) : null}
            {onOpenPublico ? (
              <button type="button" style={styles.secondaryButton} className="sigma-public-button" onClick={onOpenPublico}>
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        </div>
        <aside style={styles.statusCard}>
          <span style={styles.status}>{statusLabel}</span>
          <h2 style={styles.cardTitle}>{portalTitle}</h2>
          <p style={styles.cardText}>{portalText}</p>
          {noticeItems.length ? (
            <ul style={styles.noticeList}>
              {noticeItems.map((item) => (
                <li key={item} style={styles.noticeItem}>{item}</li>
              ))}
            </ul>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #eef6ff 0%, #ffffff 52%, #eef8f0 100%)',
    color: '#0d1b3d',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '18px',
    padding: '18px clamp(16px, 4vw, 32px)',
    background: 'rgba(255, 255, 255, 0.94)',
    borderBottom: '1px solid #d8e5f2',
    boxShadow: '0 8px 24px rgba(13, 63, 143, 0.06)',
  },
  brandButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    border: 'none',
    background: 'transparent',
    color: '#0d1b3d',
    cursor: 'pointer',
    padding: 0,
    minWidth: 0,
  },
  logo: {
    width: '112px',
    height: 'auto',
  },
  brandText: {
    display: 'grid',
    gap: '2px',
    textAlign: 'left',
    fontSize: '14px',
  },
  internalButton: {
    minHeight: '42px',
    border: '1px solid #1f7a3f',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#176a36',
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0 16px',
  },
  hero: {
    width: 'min(1120px, calc(100% - 32px))',
    margin: '0 auto',
    padding: 'clamp(42px, 8vw, 72px) 0',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
    gap: '24px',
    alignItems: 'center',
  },
  eyebrow: {
    display: 'inline-flex',
    borderRadius: '999px',
    background: '#e8f7ed',
    color: '#176a36',
    padding: '8px 12px',
    fontWeight: 900,
    fontSize: '13px',
    marginBottom: '18px',
  },
  title: {
    margin: 0,
    fontSize: 'clamp(34px, 6vw, 52px)',
    lineHeight: 1.05,
    color: '#0d1b3d',
    letterSpacing: 0,
  },
  description: {
    maxWidth: '720px',
    margin: '18px 0 0',
    color: '#4c5f78',
    lineHeight: 1.65,
    fontSize: '18px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '28px',
  },
  primaryButton: {
    minHeight: '44px',
    border: '1px solid #176a36',
    borderRadius: '8px',
    background: '#1f7a3f',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 18px',
  },
  secondaryButton: {
    minHeight: '44px',
    border: '1px solid #cfe0f5',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#0d3f8f',
    cursor: 'pointer',
    fontWeight: 850,
    padding: '0 18px',
  },
  statusCard: {
    border: '1px solid #d8e5f2',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '24px',
    boxShadow: '0 16px 38px rgba(13, 63, 143, 0.1)',
  },
  status: {
    display: 'inline-flex',
    borderRadius: '999px',
    background: '#fef3c7',
    color: '#92400e',
    padding: '6px 10px',
    fontWeight: 900,
    fontSize: '12px',
  },
  cardTitle: {
    margin: '18px 0 8px',
    color: '#0d1b3d',
    fontSize: '22px',
  },
  cardText: {
    margin: 0,
    color: '#5f6f83',
    lineHeight: 1.55,
  },
  noticeList: {
    display: 'grid',
    gap: '8px',
    margin: '16px 0 0',
    padding: '0 0 0 18px',
    color: '#475569',
    lineHeight: 1.45,
    fontSize: '14px',
  },
  noticeItem: {
    paddingLeft: '2px',
  },
};
