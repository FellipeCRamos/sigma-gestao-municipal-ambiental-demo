import logoMunicipioDemo from '../../assets/logo-municipio-demo-thumbnail.png';
import sigmaPublicHero from '../../assets/sigma-public-hero.png';
import sigmaPublicBg from '../../assets/sigma-public-bg.png';
import sigmaDenunciasBanner from '../../assets/sigma-denuncias-banner.png';
import iconBemEstar from '../../assets/sigma-icon-bem-estar.png';
import iconLicenciamento from '../../assets/sigma-icon-licenciamento.png';
import iconViveiro from '../../assets/sigma-icon-viveiro.png';
import iconFiscalizacao from '../../assets/sigma-icon-fiscalizacao.png';
import iconAnuencia from '../../assets/sigma-icon-anuencia.png';

const MODULE_CARDS = [
  {
    title: 'Bem-estar Animal',
    description:
      'Campanhas, cadastro de animais, portal do tutor, vacinação, castração, microchipagem, ocorrências e consulta pública do Identificação Animal.',
    icon: iconBemEstar,
    tone: '#2e9e4b',
    surface: '#eefaf2',
    target: { view: 'publico', module: 'sigba' },
    prompt: 'Acessar área pública',
  },
  {
    title: 'Licenciamento Ambiental',
    description:
      'Simule enquadramento, consulte legislação ambiental municipal e acompanhe orientações para processos ambientais.',
    icon: iconLicenciamento,
    tone: '#1e5cc8',
    surface: '#eef5ff',
    target: { view: 'publico', module: 'licenciamento' },
    prompt: 'Acessar módulo',
  },
  {
    title: 'Educação Ambiental Demonstrativa',
    description:
      'Centro Municipal de Conhecimento Ambiental com conteúdos educativos, biblioteca normativa, agenda, materiais, trilhas, biodiversidade e FAQ.',
    icon: iconViveiro,
    tone: '#198754',
    surface: '#ecfdf3',
    target: { view: 'publico', module: 'educacao-ambiental' },
    prompt: 'Consultar portal',
  },
  {
    title: 'Viveiro Municipal',
    description:
      'Informações institucionais do Viveiro Municipal. A solicitação externa de mudas ainda não está aberta ao público.',
    icon: iconViveiro,
    tone: '#178447',
    surface: '#eefaf2',
    status: 'Serviço externo indisponível',
    target: { view: 'publico', module: 'viveiro' },
    prompt: 'Consultar informações',
  },
  {
    title: 'Denúncias Ambientais',
    description:
      'Registre denúncias sobre maus-tratos, supressão irregular, corte de árvores, poluição, resíduos, obras irregulares e demais infrações ambientais.',
    icon: iconFiscalizacao,
    tone: '#f97316',
    surface: '#fff3e7',
    target: { view: 'denuncias' },
    prompt: 'Registrar denúncia',
  },
  {
    title: 'Fiscalização Ambiental',
    description:
      'Comunicações de irregularidades, triagem administrativa interna, vistorias preliminares e encaminhamentos assistidos.',
    icon: iconFiscalizacao,
    tone: '#f97316',
    surface: '#fff3e7',
    status: 'Em implantação',
    target: { view: 'denuncias', categoria: 'fiscalizacao' },
    prompt: 'Comunicar irregularidade',
  },
  {
    title: 'Anuência Ambiental',
    description:
      'Solicitações de manifestação ambiental sobre localização, uso do solo, compatibilidade ambiental e orientações preliminares.',
    icon: iconAnuencia,
    tone: '#7c3bd6',
    surface: '#f5efff',
    status: 'Em implantação',
    target: { anchor: 'transparencia' },
    prompt: 'Saiba mais',
  },
];

export default function PainelPublicoSigma({ onNavigate, onOpenAdmin, onOpenDenuncias }) {
  function handleCardOpen(card) {
    if (!card.target) return;

    if (card.target.anchor) {
      document.getElementById(card.target.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    onNavigate?.(card.target);
  }

  return (
    <main
      style={{
        ...styles.page,
        backgroundImage: `linear-gradient(180deg, rgba(246, 251, 255, 0.92) 0%, rgba(255, 255, 255, 0.96) 52%, rgba(239, 250, 242, 0.94) 100%), url(${sigmaPublicBg})`,
      }}
      className="sigma-public-page"
    >
      <header style={styles.header} className="sigma-public-header">
        <a href="#inicio" style={styles.brandLockup} className="sigma-public-brand">
          <img src={logoMunicipioDemo} alt="Município demonstrativo" style={styles.logo} />
          <span style={styles.brandDivider} className="sigma-public-brand-divider" />
          <span style={styles.brandText}>
            <strong>SMAD</strong>
            <span>Plataforma SIGMA</span>
          </span>
        </a>
        <nav style={styles.nav} className="sigma-public-nav" aria-label="Navegação pública SIGMA">
          <a href="#modulos" style={styles.navLink}>Módulos</a>
          <a href="#denuncias" style={styles.navLink}>Denúncias</a>
          <a href="#transparencia" style={styles.navLink}>Transparência</a>
          <button
            type="button"
            style={styles.internalButton}
            className="sigma-public-button"
            onClick={() => onOpenAdmin?.()}
          >
            Acesso interno SMAD
          </button>
        </nav>
      </header>

      <section id="inicio" style={styles.hero} className="sigma-public-hero sigma-public-hero-panel">
        <div style={styles.heroCopy}>
          <span style={styles.badge} className="sigma-public-badge">
            Plataforma SIGMA — Serviços Ambientais Municipais da SMAD
          </span>
          <h1 style={styles.title} className="sigma-public-title">
            Serviços ambientais da SMAD em um só lugar
          </h1>
          <p style={styles.subtitle} className="sigma-public-subtitle">
            Acesse serviços públicos ambientais, consultas, denúncias, informações institucionais e módulos temáticos
            da Secretaria Municipal de Meio Ambiente demonstrativa.
          </p>
          <div style={styles.heroActions}>
            <button
              type="button"
              style={styles.primaryButton}
              className="sigma-public-button"
              onClick={() => onOpenDenuncias?.('')}
            >
              Comunicar irregularidade ambiental
            </button>
            <a href="#modulos" style={styles.secondaryAnchor} className="sigma-public-button">
              Ver módulos
              <span aria-hidden="true" style={styles.arrow}>›</span>
            </a>
          </div>
        </div>

        <div style={styles.heroVisual} className="sigma-public-visual">
          <img src={sigmaPublicHero} alt="" style={styles.heroImage} />
        </div>
      </section>

      <section id="modulos" style={styles.section} className="sigma-public-section">
        <div style={styles.sectionHeader}>
          <span style={styles.sectionIcon} className="sigma-public-section-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <div>
            <h2 style={styles.sectionTitle}>Módulos e serviços públicos</h2>
            <p style={styles.sectionText}>
              Cada área temática possui serviços próprios e utiliza o núcleo compartilhado da Plataforma SIGMA.
            </p>
          </div>
        </div>

        <div style={styles.cardGrid} className="sigma-public-card-grid">
          {MODULE_CARDS.map((card) => (
            <button
              key={card.title}
              style={{ ...styles.moduleCard, borderTop: `5px solid ${card.tone}` }}
              className="sigma-public-module-card"
              type="button"
              onClick={() => handleCardOpen(card)}
              aria-label={`${card.prompt} de ${card.title}`}
            >
              <div style={styles.cardBody}>
                <span style={{ ...styles.iconBubble, background: card.surface }}>
                  <img src={card.icon} alt="" style={styles.cardIcon} />
                </span>
                <div style={styles.cardContent}>
                  <div style={styles.cardHeader} className="sigma-public-card-header">
                    <h3 style={styles.cardTitle}>{card.title}</h3>
                    {card.status ? <span style={styles.statusPill}>{card.status}</span> : null}
                  </div>
                  <p style={styles.cardText}>{card.description}</p>
                </div>
              </div>

              <span style={{ ...styles.cardPrompt, color: card.tone }}>
                {card.prompt}
                <span aria-hidden="true" style={styles.cardPromptArrow}>›</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section
        id="denuncias"
        style={{
          ...styles.highlightSection,
          backgroundImage: `linear-gradient(90deg, rgba(8, 31, 68, 0.98) 0%, rgba(8, 31, 68, 0.9) 52%, rgba(8, 31, 68, 0.74) 100%), url(${sigmaDenunciasBanner})`,
        }}
        className="sigma-public-highlight sigma-public-cta"
      >
        <div style={styles.highlightIcon} aria-hidden="true">
          <span>!</span>
        </div>
        <div style={styles.highlightCopy}>
          <h2 style={styles.highlightTitle}>Encontrou uma possível irregularidade ambiental?</h2>
          <p style={styles.highlightText}>
            Selecione o assunto para direcionar corretamente sua comunicação à SMAD.
          </p>
        </div>
        <button
          type="button"
          style={styles.highlightButton}
          className="sigma-public-button"
          onClick={() => onOpenDenuncias?.('')}
        >
          Comunicar irregularidade ambiental
          <span aria-hidden="true" style={styles.arrow}>›</span>
        </button>
      </section>

      <section id="transparencia" style={styles.section} className="sigma-public-section">
        <div style={styles.sectionHeader}>
          <span style={styles.sectionIcon} className="sigma-public-section-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <div>
            <h2 style={styles.sectionTitle}>Indicadores e transparência</h2>
            <p style={styles.sectionText}>
              Consulte informações públicas, campanhas, indicadores e dados disponibilizados pela SMAD conforme os módulos implantados.
            </p>
          </div>
        </div>

        <div style={styles.utilityGrid} className="sigma-public-utility-grid">
          <button type="button" style={styles.utilityCard} onClick={() => onNavigate?.({ view: 'publico', module: 'sigba' })}>
            <span style={{ ...styles.utilityIcon, background: '#eefaf2' }}>
              <img src={iconBemEstar} alt="" style={styles.utilityImage} />
            </span>
            <span>
              <strong>Indicadores do Bem-estar Animal</strong>
              <small>Acompanhe dados e indicadores públicos.</small>
            </span>
            <span aria-hidden="true" style={styles.utilityArrow}>›</span>
          </button>

          <button type="button" style={styles.utilityCard} onClick={() => onNavigate?.({ view: 'publico' })}>
            <span style={{ ...styles.utilityIcon, background: '#eef5ff' }}>
              <img src={iconLicenciamento} alt="" style={styles.utilityImage} />
            </span>
            <span>
              <strong>Transparência institucional</strong>
              <small>Acesse informações institucionais e dados públicos.</small>
            </span>
            <span aria-hidden="true" style={styles.utilityArrow}>›</span>
          </button>
        </div>
      </section>

      <footer style={styles.footer}>
        <span aria-hidden="true">•</span>
        © 2026 Município demonstrativo — SMAD. Plataforma SIGMA.
      </footer>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f6fbff',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center top',
    backgroundSize: 'cover',
    color: '#0d1b3d',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '18px',
    padding: '18px clamp(18px, 4vw, 52px)',
    background: 'rgba(255, 255, 255, 0.97)',
    border: '1px solid #d8e5f2',
    borderTop: 0,
    borderRadius: '0 0 8px 8px',
    boxShadow: '0 10px 30px rgba(13, 63, 143, 0.08)',
  },
  brandLockup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    color: '#0d1b3d',
    textDecoration: 'none',
    minWidth: 0,
  },
  logo: {
    width: '156px',
    height: 'auto',
  },
  brandDivider: {
    width: '1px',
    alignSelf: 'stretch',
    minHeight: '54px',
    background: '#cfe0f5',
  },
  brandText: {
    display: 'grid',
    gap: '2px',
    fontSize: '18px',
    lineHeight: 1.2,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '28px',
    flexWrap: 'wrap',
  },
  navLink: {
    color: '#0d1b3d',
    textDecoration: 'none',
    fontWeight: 900,
    fontSize: '15px',
  },
  internalButton: {
    minHeight: '48px',
    border: '1px solid #1f7a3f',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#176a36',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 22px',
    boxShadow: '0 8px 18px rgba(23, 106, 54, 0.08)',
  },
  hero: {
    width: 'min(1220px, calc(100% - 48px))',
    margin: '0 auto',
    padding: '48px 0 0',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 620px)',
    gap: '42px',
    alignItems: 'center',
  },
  heroCopy: {
    padding: '14px 0 46px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    background: '#e7f7ec',
    color: '#176a36',
    padding: '11px 16px',
    fontSize: '14px',
    fontWeight: 900,
    marginBottom: '20px',
    border: '1px solid #cbead4',
  },
  title: {
    maxWidth: '620px',
    margin: 0,
    color: '#0d1b3d',
    fontSize: 'clamp(42px, 5vw, 64px)',
    lineHeight: 1.04,
    letterSpacing: 0,
  },
  subtitle: {
    maxWidth: '620px',
    margin: '22px 0 0',
    color: '#41516e',
    lineHeight: 1.62,
    fontSize: '18px',
  },
  heroActions: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginTop: '28px',
  },
  primaryButton: {
    minHeight: '50px',
    border: '1px solid #176a36',
    borderRadius: '8px',
    background: 'linear-gradient(180deg, #2da94f 0%, #16823b 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 24px',
    boxShadow: '0 12px 24px rgba(23, 106, 54, 0.22)',
  },
  secondaryAnchor: {
    minHeight: '50px',
    border: '1px solid #cfe0f5',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#0d3f8f',
    fontWeight: 900,
    padding: '0 22px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '14px',
    textDecoration: 'none',
  },
  arrow: {
    fontSize: '28px',
    lineHeight: 1,
    fontWeight: 900,
  },
  heroVisual: {
    alignSelf: 'end',
    minHeight: '390px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    maxWidth: '650px',
    display: 'block',
    objectFit: 'contain',
    filter: 'drop-shadow(0 18px 34px rgba(13, 63, 143, 0.12))',
  },
  section: {
    width: 'min(1220px, calc(100% - 48px))',
    margin: '0 auto',
    padding: '32px 0',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    marginBottom: '24px',
  },
  sectionIcon: {
    width: '58px',
    height: '58px',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '7px',
    flex: '0 0 auto',
    border: '1px solid #cfead8',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '14px',
    boxShadow: '0 10px 24px rgba(13, 63, 143, 0.08)',
  },
  sectionTitle: {
    margin: 0,
    color: '#0d1b3d',
    fontSize: '30px',
    lineHeight: 1.15,
  },
  sectionText: {
    margin: '7px 0 0',
    color: '#51617c',
    lineHeight: 1.55,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: '18px',
  },
  moduleCard: {
    gridColumn: 'span 2',
    width: '100%',
    minHeight: '256px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '18px',
    background: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid #d8e5f2',
    borderRadius: '8px',
    padding: '22px',
    boxShadow: '0 16px 34px rgba(13, 63, 143, 0.1)',
    color: '#0d1b3d',
    cursor: 'pointer',
    textAlign: 'left',
    appearance: 'none',
  },
  cardBody: {
    display: 'grid',
    gridTemplateColumns: '76px minmax(0, 1fr)',
    gap: '18px',
    alignItems: 'start',
  },
  iconBubble: {
    width: '72px',
    height: '72px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  cardIcon: {
    width: '76px',
    height: '76px',
    objectFit: 'cover',
  },
  cardContent: {
    display: 'grid',
    gap: '8px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
  },
  cardTitle: {
    margin: 0,
    color: '#0d1b3d',
    fontSize: '22px',
    lineHeight: 1.18,
  },
  statusPill: {
    borderRadius: '999px',
    background: '#fff0cc',
    color: '#9a4b00',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  cardText: {
    margin: 0,
    color: '#51617c',
    lineHeight: 1.52,
  },
  cardPrompt: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: '10px',
    minHeight: '38px',
    borderRadius: '999px',
    background: '#f8fbff',
    padding: '0 14px',
    fontWeight: 900,
    border: '1px solid #d8e5f2',
  },
  cardPromptArrow: {
    fontSize: '24px',
    lineHeight: 1,
    fontWeight: 900,
  },
  cardActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '9px',
  },
  cardButton: {
    minHeight: '38px',
    border: '1px solid #cfe0f5',
    borderRadius: '7px',
    background: '#eff6ff',
    color: '#0d3f8f',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 13px',
  },
  cardButtonQuiet: {
    borderColor: '#d7eadc',
    background: '#ffffff',
    color: '#176a36',
  },
  cardButtonHighlight: {
    borderColor: '#ea580c',
    background: 'linear-gradient(180deg, #ff7a1a 0%, #e95400 100%)',
    color: '#ffffff',
    boxShadow: '0 8px 18px rgba(249, 115, 22, 0.18)',
  },
  highlightSection: {
    width: 'min(1220px, calc(100% - 48px))',
    margin: '18px auto 8px',
    display: 'grid',
    gridTemplateColumns: '82px minmax(0, 1fr) minmax(250px, 400px)',
    alignItems: 'center',
    gap: '22px',
    backgroundColor: '#081f44',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '28px 32px',
    boxShadow: '0 18px 42px rgba(8, 31, 68, 0.22)',
  },
  highlightIcon: {
    width: '72px',
    height: '72px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '999px',
    background: 'rgba(46, 169, 79, 0.14)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    fontSize: '34px',
    fontWeight: 900,
  },
  highlightCopy: {
    display: 'grid',
    gap: '4px',
  },
  highlightTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '20px',
    lineHeight: 1.2,
  },
  highlightText: {
    margin: 0,
    color: '#dbeafe',
    lineHeight: 1.5,
  },
  highlightButton: {
    minHeight: '58px',
    border: '1px solid #25a64f',
    borderRadius: '8px',
    background: 'linear-gradient(180deg, #2eb85c 0%, #178447 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 22px',
    justifyContent: 'space-between',
    gap: '14px',
    boxShadow: '0 14px 30px rgba(23, 106, 54, 0.24)',
  },
  utilityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '24px',
  },
  utilityCard: {
    minHeight: '96px',
    display: 'grid',
    gridTemplateColumns: '70px minmax(0, 1fr) 24px',
    alignItems: 'center',
    gap: '18px',
    border: '1px solid #d8e5f2',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.96)',
    color: '#0d1b3d',
    cursor: 'pointer',
    padding: '18px',
    textAlign: 'left',
    boxShadow: '0 12px 28px rgba(13, 63, 143, 0.08)',
  },
  utilityIcon: {
    width: '62px',
    height: '62px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  utilityImage: {
    width: '66px',
    height: '66px',
    objectFit: 'cover',
  },
  utilityArrow: {
    color: '#0d3f8f',
    fontSize: '30px',
    fontWeight: 900,
  },
  footer: {
    marginTop: '26px',
    background: '#08244f',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    textAlign: 'center',
    padding: '20px',
    fontWeight: 800,
  },
};
