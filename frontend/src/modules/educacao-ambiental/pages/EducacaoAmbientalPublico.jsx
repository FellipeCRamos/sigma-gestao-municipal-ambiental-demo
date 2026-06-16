import { useEffect, useMemo, useState } from 'react';
import {
  BrandMark,
  EducacaoHeroIllustration,
  EnvironmentalBackground,
  PublicIcon,
} from '../components/PublicPortalVisuals';
import {
  getEducacaoPublicHome,
  listEducacaoPublicEntity,
} from '../services/educacaoAmbientalApi';
import { formatDate, labelStatus, statusBadgeStyle, unpackList } from './shared';

const INSTITUTIONAL_NOTICE =
  'A base pública de educação ambiental está em estruturação pela SMAD. Os conteúdos serão publicados após curadoria e validação técnica.';

const TABS = [
  { key: 'conteudos', label: 'Conteúdos', icon: 'file', endpoint: 'conteudos', titleField: 'titulo', textField: 'resumo' },
  { key: 'normas', label: 'Biblioteca normativa', icon: 'book', endpoint: 'normas', titleField: 'titulo', textField: 'resumo_cidadao' },
  { key: 'agenda', label: 'Agenda', icon: 'calendar', endpoint: 'agenda', titleField: 'titulo', textField: 'descricao' },
  { key: 'materiais', label: 'Materiais', icon: 'folder', endpoint: 'materiais', titleField: 'titulo', textField: 'descricao' },
  { key: 'trilhas', label: 'Trilhas', icon: 'route', endpoint: 'trilhas', titleField: 'titulo', textField: 'descricao' },
  { key: 'especies', label: 'Biodiversidade', icon: 'leaf', endpoint: 'especies', titleField: 'nome_popular', textField: 'descricao' },
  { key: 'areas', label: 'Áreas protegidas', icon: 'shield', endpoint: 'areas', titleField: 'nome', textField: 'descricao' },
  { key: 'programas', label: 'Programas', icon: 'target', endpoint: 'programas', titleField: 'nome', textField: 'descricao' },
  { key: 'faq', label: 'FAQ', icon: 'faq', endpoint: 'faq', titleField: 'pergunta', textField: 'resposta' },
];

const METRIC_ITEMS = [
  { label: 'Conteúdos', key: 'conteudos', icon: 'file', description: 'Materiais educativos validados.' },
  { label: 'Normas', key: 'normas', icon: 'book', description: 'Biblioteca normativa em curadoria.' },
  { label: 'Agenda', key: 'agenda', icon: 'calendar', description: 'Datas e campanhas ambientais.' },
  { label: 'Materiais', key: 'materiais', icon: 'folder', description: 'Cartilhas, guias e referências.' },
  { label: 'Trilhas', key: 'trilhas', icon: 'route', description: 'Percursos formativos.' },
  { label: 'FAQ', key: 'faq', icon: 'faq', description: 'Perguntas frequentes.' },
];

const GOVERNANCE_CARDS = [
  {
    title: 'Conteúdos em elaboração pela SMAD',
    icon: 'clipboard',
    text: 'Os materiais serão organizados por tema, público e nível de linguagem.',
  },
  {
    title: 'Base pública de consulta com curadoria manual',
    icon: 'check',
    text: 'Cada conteúdo deve possuir fonte, referência e status de validação.',
  },
  {
    title: 'Informações sujeitas à validação técnica',
    icon: 'shield',
    text: 'Informações locais específicas dependem de análise técnica da SMAD.',
  },
  {
    title: 'Orientação educativa não emite licença, autorização ou decisão administrativa',
    icon: 'alert',
    text: 'O portal tem finalidade educativa e não substitui processo administrativo formal.',
  },
];

function PublicCard({ item, tab }) {
  const title = item[tab.titleField] || item.titulo || item.nome || item.pergunta || 'Registro educativo';
  const text =
    item[tab.textField] ||
    item.resumo ||
    item.descricao ||
    item.resposta ||
    'Informações sujeitas à validação técnica.';
  const status = item.status_vigencia || item.status_publicacao || item.status;
  const meta = item.categoria || item.esfera || item.tipo_agenda || item.tipo_material || item.grupo_biologico;

  return (
    <article className="sigma-educacao-result-card">
      <div className="sigma-educacao-result-card-header">
        <span className="sigma-educacao-icon-badge sigma-educacao-icon-badge-soft">
          <PublicIcon name={tab.icon} size={22} />
        </span>
        <div className="sigma-educacao-result-card-title-group">
          <h3 className="sigma-educacao-result-card-title">{title}</h3>
          {status ? <span style={statusBadgeStyle(status)}>{labelStatus(status)}</span> : null}
        </div>
      </div>
      <p className="sigma-educacao-result-card-text">{text}</p>
      <div className="sigma-educacao-result-card-meta">
        {meta ? <span>{meta}</span> : null}
        {item.data_inicio ? <span>Data: {formatDate(item.data_inicio)}</span> : null}
      </div>
    </article>
  );
}

export default function EducacaoAmbientalPublico({ onOpenAdmin, onOpenPainelPublico }) {
  const [home, setHome] = useState(null);
  const [activeTab, setActiveTab] = useState('conteudos');
  const [tabItems, setTabItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState('');
  const [tabError, setTabError] = useState('');
  const activeTabConfig = useMemo(() => TABS.find((tab) => tab.key === activeTab) || TABS[0], [activeTab]);

  useEffect(() => {
    async function loadHome() {
      try {
        setLoading(true);
        setError('');
        const response = await getEducacaoPublicHome();
        setHome(response.data || null);
      } catch (err) {
        setError(err.message || 'Não foi possível carregar o Educação Ambiental Demonstrativa.');
      } finally {
        setLoading(false);
      }
    }

    loadHome();
  }, []);

  useEffect(() => {
    async function loadTab() {
      try {
        setTabLoading(true);
        setTabError('');
        const response = await listEducacaoPublicEntity(activeTabConfig.endpoint, { limit: 12 });
        const payload = unpackList(response.data);
        setTabItems(payload.items);
      } catch (err) {
        setTabError(err.message || 'Não foi possível consultar esta área.');
      } finally {
        setTabLoading(false);
      }
    }

    loadTab();
  }, [activeTabConfig]);

  function selectTabAndScroll(tabKey) {
    setActiveTab(tabKey);
    window.setTimeout(() => {
      document.getElementById('biblioteca')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  const indicadores = home?.indicadores || {};

  return (
    <main className="sigma-public-page sigma-educacao-public-page">
      <EnvironmentalBackground />
      <div className="sigma-educacao-public-content">
        <header className="sigma-public-header sigma-educacao-public-header">
          <button
            type="button"
            className="sigma-educacao-public-brand"
            onClick={() => onOpenPainelPublico?.()}
            aria-label="Abrir portal público SIGMA"
          >
            <BrandMark />
            <span className="sigma-educacao-public-brand-text">
              <strong>SMAD demonstrativa</strong>
              <small>Secretaria Municipal de Meio Ambiente demonstrativa</small>
            </span>
          </button>
          <nav className="sigma-public-nav sigma-educacao-public-nav" aria-label="Navegação do Educação Ambiental Demonstrativa">
            <a href="#territorio" className="sigma-educacao-public-nav-link">
              <PublicIcon name="map" size={20} />
              <span>Território</span>
            </a>
            <a href="#biblioteca" className="sigma-educacao-public-nav-link" onClick={() => setActiveTab('normas')}>
              <PublicIcon name="book" size={20} />
              <span>Biblioteca</span>
            </a>
            <a href="#biblioteca" className="sigma-educacao-public-nav-link" onClick={() => setActiveTab('agenda')}>
              <PublicIcon name="calendar" size={20} />
              <span>Agenda</span>
            </a>
            <a href="#trilhas" className="sigma-educacao-public-nav-link">
              <PublicIcon name="route" size={20} />
              <span>Trilhas</span>
            </a>
            <a href="#biblioteca" className="sigma-educacao-public-nav-link" onClick={() => setActiveTab('faq')}>
              <PublicIcon name="faq" size={20} />
              <span>FAQ</span>
            </a>
            <button type="button" className="sigma-educacao-public-admin-button" onClick={() => onOpenAdmin?.()}>
              <PublicIcon name="lock" size={18} />
              <span>Acesso interno</span>
            </button>
          </nav>
        </header>

        <section className="sigma-public-hero-panel sigma-educacao-public-hero">
          <div className="sigma-educacao-public-hero-copy">
            <span className="sigma-public-badge sigma-educacao-public-badge">
              <PublicIcon name="sprout" size={18} />
              Centro Municipal de Conhecimento Ambiental
            </span>
            <h1 className="sigma-educacao-public-title">Educação Ambiental Demonstrativa</h1>
            <p className="sigma-public-subtitle sigma-educacao-public-subtitle">
              Base pública de consulta da SMAD para conteúdos ambientais, normas em linguagem cidadã, agenda
              educativa, materiais, trilhas e perguntas frequentes.
            </p>
            <div className="sigma-educacao-public-hero-actions">
              <button type="button" className="sigma-educacao-public-primary-button" onClick={() => selectTabAndScroll('conteudos')}>
                <PublicIcon name="leaf" size={19} />
                <span>Explorar conteúdos</span>
              </button>
              <button type="button" className="sigma-educacao-public-secondary-button" onClick={() => selectTabAndScroll('normas')}>
                <PublicIcon name="book" size={19} />
                <span>Acessar biblioteca normativa</span>
              </button>
            </div>
            <div className="sigma-educacao-public-hero-alert" role="note">
              <PublicIcon name="info" size={20} />
              <p>Os conteúdos educativos não substituem análise técnica formal da SMAD.</p>
            </div>
          </div>
          <div className="sigma-public-visual sigma-educacao-public-visual">
            <EducacaoHeroIllustration />
          </div>
        </section>

        <section className="sigma-educacao-public-notice" aria-label="Aviso institucional">
          <span className="sigma-educacao-icon-badge">
            <PublicIcon name="info" size={23} />
          </span>
          <p>{INSTITUTIONAL_NOTICE}</p>
        </section>

        {loading ? <p className="sigma-educacao-public-message">Carregando base pública...</p> : null}
        {error ? <p className="sigma-educacao-public-error">{error}</p> : null}

        <section id="territorio" className="sigma-public-section sigma-educacao-public-section sigma-educacao-public-section-split">
          <div className="sigma-educacao-section-heading sigma-educacao-section-heading-side">
            <span className="sigma-educacao-section-icon">
              <PublicIcon name="map" size={30} />
            </span>
            <h2>Conheça o território ambiental de Município demonstrativo</h2>
            <p>
              Conteúdos em elaboração pela SMAD. As informações estão sujeitas à validação técnica antes de
              serem tratadas como referência institucional.
            </p>
          </div>
          <div className="sigma-educacao-metric-grid">
            {METRIC_ITEMS.map((metric) => (
              <article key={metric.key} className="sigma-educacao-metric-card">
                <span className="sigma-educacao-icon-badge sigma-educacao-icon-badge-soft">
                  <PublicIcon name={metric.icon} size={25} />
                </span>
                <strong>{Number(indicadores[metric.key] || 0).toLocaleString('pt-BR')}</strong>
                <h3>{metric.label}</h3>
                <p>{metric.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="biblioteca" className="sigma-public-section sigma-educacao-public-section">
          <div className="sigma-educacao-section-heading">
            <span className="sigma-educacao-section-icon">
              <PublicIcon name="leaf" size={30} />
            </span>
            <h2>Biodiversidade, clima, relevo, água e normas</h2>
            <p>
              A biblioteca normativa e ambiental está em estruturação. Normas não verificadas não devem ser
              utilizadas como base definitiva.
            </p>
          </div>
          <div className="sigma-educacao-topic-pills" role="tablist" aria-label="Áreas de consulta">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`sigma-educacao-topic-pill${activeTab === tab.key ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <PublicIcon name={tab.icon} size={19} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {tabLoading ? <p className="sigma-educacao-public-message">Carregando consulta...</p> : null}
          {tabError ? <p className="sigma-educacao-public-error">{tabError}</p> : null}

          {!tabLoading && !tabItems.length ? (
            <div className="sigma-educacao-empty-state" role="status" aria-live="polite">
              <span className="sigma-educacao-empty-icon">
                <PublicIcon name={activeTabConfig.icon} size={34} />
              </span>
              <div>
                <h3>Esta seção está em curadoria.</h3>
                <p>Os conteúdos serão exibidos após validação técnica.</p>
              </div>
            </div>
          ) : null}

          {tabItems.length ? (
            <div className="sigma-educacao-result-grid">
              {tabItems.map((item) => (
                <PublicCard key={`${activeTab}-${item.id}`} item={item} tab={activeTabConfig} />
              ))}
            </div>
          ) : null}
        </section>

        <section id="trilhas" className="sigma-public-section sigma-educacao-public-section">
          <div className="sigma-educacao-section-heading">
            <span className="sigma-educacao-section-icon">
              <PublicIcon name="graduation" size={30} />
            </span>
            <h2>Trilhas, materiais, programas e perguntas frequentes</h2>
            <p>
              As trilhas educativas públicas serão disponibilizadas somente quando houver conteúdo validado. A
              futura IA educadora deverá responder apenas com base nessa curadoria.
            </p>
          </div>
          <div className="sigma-educacao-governance-grid">
            {GOVERNANCE_CARDS.map((item) => (
              <article key={item.title} className="sigma-educacao-governance-card">
                <span className="sigma-educacao-icon-badge sigma-educacao-icon-badge-soft">
                  <PublicIcon name={item.icon} size={25} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer className="sigma-educacao-public-footer">
        <div className="sigma-educacao-public-footer-inner">
          <div>
            <div className="sigma-educacao-footer-brand">
              <BrandMark />
              <div>
                <strong>SMAD demonstrativa</strong>
                <p>Secretaria Municipal de Meio Ambiente demonstrativa</p>
              </div>
            </div>
          </div>
          <div>
            <h2>Educação Ambiental Demonstrativa</h2>
            <p>Centro Municipal de Conhecimento Ambiental</p>
          </div>
          <nav aria-label="Links institucionais do portal">
            <h2>Links úteis</h2>
            <a href="#biblioteca" onClick={() => setActiveTab('normas')}>Biblioteca normativa</a>
            <a href="#biblioteca" onClick={() => setActiveTab('agenda')}>Agenda ambiental</a>
            <a href="#trilhas">Trilhas educativas</a>
            <a href="#biblioteca" onClick={() => setActiveTab('faq')}>FAQ</a>
            <button type="button" onClick={() => onOpenAdmin?.()}>Acesso interno</button>
          </nav>
          <div>
            <h2>Aviso institucional</h2>
            <p>Conteúdos públicos sujeitos à curadoria, validação técnica e revisão institucional.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
