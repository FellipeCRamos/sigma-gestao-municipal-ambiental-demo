import { useEffect, useMemo, useState } from 'react';
import heroBackground from '../assets/hero-bg-bem-estar.png';
import logoBemEstarAnimal from '../assets/logo-bem-estar-animal-transparent.png';
import logoBemEstarAnimalSelo from '../assets/logo-bem-estar-animal-corel.png';
import logoMunicipioDemo from '../assets/logo-municipio-demo-thumbnail.png';
import { getPublicAnimal, getPublicGovernanca, getPublicIndicadores } from '../services/api';

const COLORS = {
  blue: '#1e5cc8',
  navy: '#0d1b3d',
  green: '#2e9e4b',
  orange: '#ff7a00',
  yellow: '#ffc400',
  surfaceBlue: '#eef4ff',
  surface: '#ffffff',
  neutral: '#f1f3f5',
  border: '#dbe5f3',
  text: '#0d1b3d',
  muted: '#5b667d',
};

const EMPTY_DATA = {
  indicadores: {},
  campanhas_ativas: [],
  territorial: [],
  ocorrencias: [],
  series_historicas: [],
  cobertura_vacinal: {},
  demanda_reprimida: {},
  metodologia_publica: null,
  atualizado_em: null,
};

const SPECIES_LABELS = {
  canino: 'Canino',
  felino: 'Felino',
};

const EVENT_LABELS = {
  vacina: 'Vacina',
  castracao: 'Castração',
  microchipagem: 'Microchipagem',
  campanha: 'Campanha',
  observacao: 'Observação',
};

const STATUS_LABELS = {
  ativo: 'Ativo',
  acompanhamento: 'Em acompanhamento',
  tratamento: 'Em tratamento',
  disponivel_adocao: 'Disponível para adoção',
  adotado: 'Adotado',
  inativo: 'Inativo',
};

const VACINA_STATUS_LABELS = {
  registrado: 'Registrada',
  comprovado: 'Comprovada',
  pendente_comprovacao: 'Pendente de comprovação',
  vencido: 'Vencida',
};

const NAV_ITEMS = [
  { label: 'Início', href: '#inicio', icon: 'home', active: true },
  { label: 'Campanhas', href: '#campanhas', icon: 'calendar' },
  { label: 'Ocorrências', href: '#ocorrencias', icon: 'alert' },
  { label: 'Indicadores', href: '#indicadores', icon: 'chart' },
  { label: 'Transparência', href: '#governanca', icon: 'shield' },
  { label: 'Perguntas frequentes', href: '#consulta-identificacao', icon: 'help' },
];

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatShortDate(value) {
  if (!value) return 'Data a confirmar';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatPublicLabel(value) {
  const text = String(value ?? '').trim();
  const labels = {
    MunicipioDemo: 'Município demonstrativo',
    'MunicipioDemo sede/outras localidades': 'Município demonstrativo sede/outras localidades',
    'Nao informado': 'Não informado',
    nao: 'Não',
    sim: 'Sim',
  };
  return labels[text] || text;
}

function formatOccurrenceType(value) {
  const text = String(value || 'Ocorrência').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatCountText(total, singular, plural) {
  const count = Number(total || 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function Publico({ onOpenAdmin, onOpenPortal }) {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publicId, setPublicId] = useState('');
  const [animal, setAnimal] = useState(null);
  const [animalError, setAnimalError] = useState('');
  const [animalLoading, setAnimalLoading] = useState(false);
  const [governanca, setGovernanca] = useState(null);

  const indicadores = data.indicadores || {};
  const coberturaVacinal = data.cobertura_vacinal || {};
  const demandaReprimida = data.demanda_reprimida || {};
  const demandasAtivas = (demandaReprimida.campanha_inscricoes_pendentes || 0)
    + (demandaReprimida.ocorrencias_ativas || 0);

  const ocorrenciasResumo = useMemo(() => {
    return (data.ocorrencias || []).reduce((acc, item) => {
      const key = item.tipo || 'outros';
      acc[key] = (acc[key] || 0) + Number(item.total || 0);
      return acc;
    }, {});
  }, [data.ocorrencias]);

  const metricCards = [
    {
      label: 'Animais cadastrados',
      value: indicadores.animais,
      icon: 'paw',
      tone: COLORS.green,
      background: '#e9f7ec',
    },
    {
      label: 'Castrados',
      value: indicadores.castrados,
      icon: 'heart',
      tone: '#0d9b84',
      background: '#e7f8f4',
    },
    {
      label: 'Vacinados',
      value: indicadores.vacinados,
      icon: 'shieldCheck',
      tone: COLORS.orange,
      background: '#fff0df',
    },
    {
      label: 'Microchipados',
      value: indicadores.microchipados,
      icon: 'chip',
      tone: COLORS.blue,
      background: '#edf4ff',
    },
    {
      label: 'Carteira vacinal estruturada',
      value: coberturaVacinal.animais_com_vacinacao_estruturada,
      icon: 'card',
      tone: '#7c3bd6',
      background: '#f1eaff',
    },
    {
      label: 'Demandas em acompanhamento',
      value: demandasAtivas,
      icon: 'headset',
      tone: '#df4a16',
      background: '#fff0e9',
    },
  ];

  const readingCards = [
    {
      label: 'Animais com carteira estruturada',
      value: coberturaVacinal.animais_com_vacinacao_estruturada ?? 0,
      icon: 'card',
      tone: COLORS.green,
      background: '#e9f7ec',
    },
    {
      label: 'Percentual da base cadastrada',
      value: `${coberturaVacinal.percentual_base_cadastrada ?? 0}%`,
      icon: 'target',
      tone: COLORS.green,
      background: '#eef9f1',
    },
    {
      label: 'Registros vacinais ativos',
      value: coberturaVacinal.registros_ativos ?? 0,
      icon: 'pin',
      tone: COLORS.blue,
      background: '#edf4ff',
    },
    {
      label: 'Inscrições pendentes',
      value: demandaReprimida.campanha_inscricoes_pendentes ?? 0,
      icon: 'bell',
      tone: COLORS.orange,
      background: '#fff4e6',
    },
    {
      label: 'Ocorrências ativas',
      value: demandaReprimida.ocorrencias_ativas ?? 0,
      icon: 'alert',
      tone: '#dc2626',
      background: '#fff1f1',
    },
  ];

  async function loadIndicadores() {
    try {
      setLoading(true);
      setError('');
      const [response, governanceResponse] = await Promise.all([
        getPublicIndicadores(),
        getPublicGovernanca().catch(() => null),
      ]);
      setData(response?.data || EMPTY_DATA);
      setGovernanca(governanceResponse?.data || null);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os indicadores públicos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIndicadores();
  }, []);

  async function handleAnimalSearch(event) {
    event.preventDefault();
    const normalized = publicId.trim();

    if (!normalized) {
      setAnimal(null);
      setAnimalError('Informe o identificação animal.');
      return;
    }

    try {
      setAnimalLoading(true);
      setAnimalError('');
      const response = await getPublicAnimal(normalized);
      setAnimal(response.data);
    } catch (err) {
      setAnimal(null);
      setAnimalError(err.message || 'Não foi possível consultar o animal.');
    } finally {
      setAnimalLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <a href="#inicio" style={styles.brandLockup} aria-label="SIGMA público">
          <img src={logoMunicipioDemo} alt="Município demonstrativo" style={styles.logoMunicipio} />
          <span style={styles.brandDivider} />
          <span style={styles.animalBrand}>
            <img src={logoBemEstarAnimalSelo} alt="" style={styles.logoAnimalSmall} />
            <span style={styles.animalBrandText}>
              <strong>Setor de Bem-estar Animal</strong>
              <span>SIGMA público</span>
            </span>
          </span>
        </a>

        <div style={styles.navArea}>
          <nav style={styles.nav} aria-label="Navegação pública">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{ ...styles.navLink, ...(item.active ? styles.navLinkActive : {}) }}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <button type="button" onClick={onOpenAdmin} style={styles.loginButton}>
            <Icon name="user" size={20} />
            Entrar
          </button>
        </div>
      </header>

      <section id="inicio" style={styles.hero}>
        <div style={styles.heroCopy}>
          <h1 style={styles.title}>
            Bem-estar animal
            <span style={styles.titleAccent}> em Município demonstrativo</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Indicadores, campanhas e consulta pública do identificação animal municipal.
          </p>
          <div style={styles.actions}>
            <button type="button" onClick={onOpenPortal} style={styles.primaryButton}>
              <Icon name="paw" size={20} />
              Portal do Tutor
            </button>
            <button type="button" onClick={onOpenAdmin} style={styles.secondaryButton}>
              <Icon name="building" size={20} />
              Área interna SMAD
            </button>
          </div>
        </div>

        <div style={styles.heroVisual}>
          <img
            src={logoBemEstarAnimal}
            alt="Setor de Bem-estar Animal da SMAD, Município demonstrativo"
            style={styles.heroLogo}
          />
        </div>
      </section>

      {loading ? <section style={styles.loadingCard}>Carregando indicadores...</section> : null}
      {error ? <section style={styles.alertError}>{error}</section> : null}

      {!loading && !error ? (
        <div style={styles.content}>
          <section id="indicadores" style={styles.metricsGrid} aria-label="Indicadores públicos">
            {metricCards.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </section>

          <section id="consulta-identificacao" style={styles.searchPanel}>
            <div style={styles.searchTitle}>
              <IconBadge icon="consult" tone={COLORS.green} background="#e9f7ec" />
              <div>
                <h2 style={styles.sectionTitle}>Consultar identificação animal</h2>
                <p style={styles.subtitle}>
                  Use o código público do cadastro, como SIGMA-ANIMAL-1.
                </p>
              </div>
            </div>

            <form onSubmit={handleAnimalSearch} style={styles.searchForm}>
              <input
                type="search"
                value={publicId}
                onChange={(event) => {
                  setPublicId(event.target.value);
                  setAnimalError('');
                }}
                style={styles.input}
                placeholder="SIGMA-ANIMAL-1"
                aria-label="identificação animal"
              />
              <button type="submit" disabled={animalLoading} style={styles.primaryButton}>
                <Icon name="search" size={20} />
                {animalLoading ? 'Consultando...' : 'Consultar'}
              </button>
            </form>
          </section>

          {animalError ? <div style={styles.alertError}>{animalError}</div> : null}
          {animal ? <AnimalResult animal={animal} /> : null}

          <section style={styles.featureGrid}>
            <DashboardCard
              id="campanhas"
              title="Campanhas ativas"
              icon="megaphone"
              tone={COLORS.blue}
              action="Ver todas"
            >
              {data.campanhas_ativas?.length ? (
                <div style={styles.list}>
                  {data.campanhas_ativas.map((campanha) => (
                    <article key={campanha.id} style={styles.highlightItem}>
                      <strong>{campanha.nome}</strong>
                      <span>{campanha.descricao || 'Campanha em andamento'}</span>
                      <span style={styles.metaLine}>
                        <Icon name="calendar" size={16} />
                        {formatShortDate(campanha.data_inicio)}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p style={styles.subtitle}>Nenhuma campanha ativa no momento.</p>
              )}
            </DashboardCard>

            <DashboardCard
              id="ocorrencias"
              title="Ocorrências públicas"
              icon="alert"
              tone={COLORS.orange}
              action="Ver todas"
            >
              {Object.keys(ocorrenciasResumo).length ? (
                <div style={styles.list}>
                  {Object.entries(ocorrenciasResumo).map(([tipo, total]) => (
                    <div key={tipo} style={styles.eventRow}>
                      <strong>{formatOccurrenceType(tipo)}</strong>
                      <span>{formatCountText(total, 'ocorrência', 'ocorrências')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.subtitle}>Nenhuma ocorrência registrada.</p>
              )}
            </DashboardCard>

            <DashboardCard
              title="Mapa territorial inicial"
              icon="map"
              tone={COLORS.green}
            >
              <CompactTable
                rows={(data.territorial || []).slice(0, 5)}
                columns={[
                  { key: 'bairro', label: 'Localidade', render: (item) => formatPublicLabel(item.bairro) },
                  { key: 'animais', label: 'Animais' },
                  { key: 'campanha_inscricoes', label: 'Inscrições', render: (item) => item.campanha_inscricoes ?? 0 },
                  { key: 'campanha_atendidas', label: 'Atendimentos', render: (item) => item.campanha_atendidas ?? 0 },
                  { key: 'ocorrencias', label: 'Ocorrências', render: (item) => item.ocorrencias ?? 0 },
                ]}
              />
            </DashboardCard>
          </section>

          <section style={styles.lowerGrid}>
            <DashboardCard title="Evolução histórica" icon="chart" tone={COLORS.blue}>
              <CompactTable
                rows={data.series_historicas || []}
                columns={[
                  { key: 'periodo', label: 'Período' },
                  { key: 'campanha_inscricoes', label: 'Inscrições', render: (item) => item.campanha_inscricoes ?? 0 },
                  { key: 'campanha_atendimentos', label: 'Atendimentos', render: (item) => item.campanha_atendimentos ?? 0 },
                  { key: 'vacinacoes_estruturadas', label: 'Vacinas', render: (item) => item.vacinacoes_estruturadas ?? 0 },
                  { key: 'ocorrencias_registradas', label: 'Ocorrências', render: (item) => item.ocorrencias_registradas ?? 0 },
                ]}
              />
            </DashboardCard>

            <DashboardCard title="Leitura pública do dado" icon="analytics" tone={COLORS.green}>
              <div style={styles.readingGrid}>
                {readingCards.map((item) => (
                  <MiniStat key={item.label} {...item} />
                ))}
              </div>
              <p style={styles.note}>
                <Icon name="info" size={16} />
                {data.metodologia_publica?.escopo || 'Indicadores representam a base cadastrada no SIGMA.'}
              </p>
              <p style={styles.note}>
                <Icon name="shield" size={16} />
                {data.metodologia_publica?.privacidade || 'Dados pessoais não são exibidos nesta visão.'}
              </p>
              {data.metodologia_publica?.territorio ? (
                <p style={styles.note}>
                  <Icon name="map" size={16} />
                  {data.metodologia_publica.territorio}
                </p>
              ) : null}
            </DashboardCard>
          </section>

          <section id="governanca" style={styles.governanceGrid}>
            <GovernanceCard
              icon="document"
              title="Termo de uso"
              value={governanca?.documentos?.termo_uso_versao || 'Minuta técnica'}
            />
            <GovernanceCard
              icon="shield"
              title="Política de privacidade"
              value={governanca?.documentos?.politica_privacidade_versao || 'Minuta técnica'}
            />
            <GovernanceCard
              icon="building"
              title="Contato institucional"
              value={governanca?.contato_institucional || 'A definir pela SMAD'}
              tone={COLORS.orange}
            />
          </section>

          <footer style={styles.footer}>
            <Icon name="paw" size={18} />
            <span>© 2026 Município demonstrativo - SMAD. Todos os direitos reservados.</span>
          </footer>
        </div>
      ) : null}
    </main>
  );
}

function Metric({ label, value, icon, tone, background }) {
  return (
    <article style={styles.metric}>
      <IconBadge icon={icon} tone={tone} background={background} />
      <span style={styles.metricLabel}>{label}</span>
      <strong style={{ ...styles.metricValue, color: tone }}>{value ?? 0}</strong>
    </article>
  );
}

function DashboardCard({ id, title, icon, tone, action, children }) {
  return (
    <section id={id} style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitleRow}>
          <IconBadge icon={icon} tone={tone} background={`${tone}14`} size={38} />
          <h2 style={styles.cardTitle}>{title}</h2>
        </div>
        {action ? <a href="#inicio" style={styles.cardAction}>{action}</a> : null}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value, icon, tone, background }) {
  return (
    <div style={styles.miniStat}>
      <IconBadge icon={icon} tone={tone} background={background} size={36} />
      <span>{label}</span>
      <strong style={{ color: tone }}>{value}</strong>
    </div>
  );
}

function GovernanceCard({ icon, title, value, tone = COLORS.blue }) {
  return (
    <article style={styles.governanceCard}>
      <IconBadge icon={icon} tone={tone} background={`${tone}12`} size={44} />
      <div>
        <h3 style={styles.governanceTitle}>{title}</h3>
        <p style={styles.governanceValue}>{value}</p>
        <a href="#governanca" style={styles.documentLink}>Ler documento</a>
      </div>
    </article>
  );
}

function AnimalResult({ animal }) {
  return (
    <article style={styles.animalPanel}>
      <div>
        <span style={styles.label}>identificação animal</span>
        <h3 style={styles.animalTitle}>{animal.public_id}</h3>
        <p style={styles.subtitle}>{animal.nome || 'Nome não informado'}</p>
      </div>
      <div style={styles.animalGrid}>
        <Info label="Espécie" value={SPECIES_LABELS[animal.especie] || animal.especie} />
        <Info label="Raça" value={animal.raca || '-'} />
        <Info label="Sexo" value={animal.sexo || '-'} />
        <Info label="Status" value={STATUS_LABELS[animal.status] || animal.status} />
        <Info label="Bairro" value={formatPublicLabel(animal.bairro) || '-'} />
        <Info label="Microchip" value={animal.microchipado ? 'Identificado' : 'Não informado'} />
        <Info label="Castração" value={animal.castrado ? 'Castrado' : 'Não informado'} />
        <Info label="Vacinação" value={animal.vacinado ? 'Registrada' : 'Não informada'} />
      </div>

      <div style={styles.timelineGrid}>
        <Timeline title="Carteira vacinal pública">
          {animal.carteira_vacinal?.length ? (
            animal.carteira_vacinal.map((vacina, index) => (
              <div key={`${vacina.vacina_nome}-${vacina.data_aplicacao}-${index}`} style={styles.timelineItem}>
                <strong>{vacina.vacina_nome_popular || vacina.vacina_nome}</strong>
                <span>{VACINA_STATUS_LABELS[vacina.status_registro] || vacina.status_registro}</span>
                <span>Aplicação: {formatDate(vacina.data_aplicacao)}</span>
              </div>
            ))
          ) : (
            <p style={styles.subtitle}>Nenhum registro vacinal público estruturado.</p>
          )}
        </Timeline>

        <Timeline title="Linha do tempo pública">
          {animal.eventos?.length ? (
            animal.eventos.map((evento, index) => (
              <div key={`${evento.tipo}-${evento.data_evento}-${index}`} style={styles.timelineItem}>
                <strong>{evento.titulo}</strong>
                <span>{EVENT_LABELS[evento.tipo] || evento.tipo} - {formatDate(evento.data_evento)}</span>
                {evento.descricao ? <p>{evento.descricao}</p> : null}
              </div>
            ))
          ) : (
            <p style={styles.subtitle}>Nenhum evento público registrado.</p>
          )}
        </Timeline>
      </div>
    </article>
  );
}

function Timeline({ title, children }) {
  return (
    <div style={styles.timeline}>
      <span style={styles.label}>{title}</span>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.label}>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function CompactTable({ rows, columns }) {
  if (!rows?.length) {
    return <p style={styles.subtitle}>Sem dados públicos disponíveis no momento.</p>;
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={styles.th}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.bairro || row.periodo || index}-${index}`}>
              {columns.map((column) => (
                <td key={column.key} style={styles.td}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconBadge({ icon, tone, background, size = 54 }) {
  return (
    <span
      style={{
        ...styles.iconBadge,
        width: size,
        height: size,
        color: tone,
        background,
      }}
    >
      <Icon name={icon} size={Math.max(18, Math.round(size * 0.52))} />
    </span>
  );
}

function Icon({ name, size = 22 }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      {renderIcon(name, common)}
    </svg>
  );
}

function renderIcon(name, common) {
  switch (name) {
    case 'home':
      return (
        <>
          <path {...common} d="M3 11.5 12 4l9 7.5" />
          <path {...common} d="M5.5 10.5V20h13v-9.5" />
          <path {...common} d="M9.5 20v-6h5v6" />
        </>
      );
    case 'calendar':
      return (
        <>
          <rect {...common} x="4" y="5" width="16" height="15" rx="2" />
          <path {...common} d="M8 3v4M16 3v4M4 10h16" />
        </>
      );
    case 'alert':
      return (
        <>
          <path {...common} d="M12 4 21 20H3L12 4Z" />
          <path {...common} d="M12 9v5M12 17h.01" />
        </>
      );
    case 'chart':
    case 'analytics':
      return (
        <>
          <path {...common} d="M4 19V5" />
          <path {...common} d="M4 19h16" />
          <rect {...common} x="7" y="12" width="3" height="5" rx="1" />
          <rect {...common} x="12" y="9" width="3" height="8" rx="1" />
          <rect {...common} x="17" y="6" width="3" height="11" rx="1" />
        </>
      );
    case 'shield':
      return <path {...common} d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />;
    case 'shieldCheck':
      return (
        <>
          <path {...common} d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
          <path {...common} d="m9 12 2 2 4-5" />
        </>
      );
    case 'help':
      return (
        <>
          <circle {...common} cx="12" cy="12" r="9" />
          <path {...common} d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-.9.7-1.9 1.2-1.9 2.6" />
          <path {...common} d="M12 17h.01" />
        </>
      );
    case 'user':
      return (
        <>
          <circle {...common} cx="12" cy="8" r="3.5" />
          <path {...common} d="M5 20a7 7 0 0 1 14 0" />
        </>
      );
    case 'paw':
      return (
        <>
          <circle cx="7.2" cy="9" r="1.8" fill="currentColor" />
          <circle cx="11" cy="6.8" r="1.8" fill="currentColor" />
          <circle cx="15" cy="9" r="1.8" fill="currentColor" />
          <circle cx="17.3" cy="13" r="1.6" fill="currentColor" />
          <path {...common} d="M7.5 17.5c.7-3.5 3-5.2 4.7-5.2 1.8 0 4 1.7 4.5 5.2.3 1.8-1.3 3-3 2.2-.9-.4-2.1-.4-3 0-1.8.8-3.5-.4-3.2-2.2Z" />
        </>
      );
    case 'heart':
      return <path {...common} d="M20.5 8.5c0 5.3-8.5 10.5-8.5 10.5S3.5 13.8 3.5 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 2.5Z" />;
    case 'chip':
      return (
        <>
          <rect {...common} x="7" y="7" width="10" height="10" rx="2" />
          <path {...common} d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
        </>
      );
    case 'card':
      return (
        <>
          <rect {...common} x="4" y="6" width="16" height="12" rx="2" />
          <path {...common} d="M4 10h16M8 14h4M15 14h1" />
        </>
      );
    case 'headset':
      return (
        <>
          <path {...common} d="M5 13v-1a7 7 0 0 1 14 0v1" />
          <path {...common} d="M5 13h3v5H6a1 1 0 0 1-1-1v-4ZM19 13h-3v5h2a1 1 0 0 0 1-1v-4Z" />
          <path {...common} d="M16 18c-.5 2-2 3-4 3" />
        </>
      );
    case 'consult':
    case 'search':
      return (
        <>
          <circle {...common} cx="10.5" cy="10.5" r="6" />
          <path {...common} d="m15 15 5 5" />
        </>
      );
    case 'megaphone':
      return (
        <>
          <path {...common} d="M4 13h3l9 4V7L7 11H4v2Z" />
          <path {...common} d="M7 13v5" />
          <path {...common} d="M18.5 9.5c1 .8 1.5 1.6 1.5 2.5s-.5 1.7-1.5 2.5" />
        </>
      );
    case 'map':
      return (
        <>
          <path {...common} d="M9 18 4 20V6l5-2 6 2 5-2v14l-5 2-6-2Z" />
          <path {...common} d="M9 4v14M15 6v14" />
        </>
      );
    case 'target':
      return (
        <>
          <circle {...common} cx="12" cy="12" r="8" />
          <circle {...common} cx="12" cy="12" r="3" />
          <path {...common} d="M12 2v3M22 12h-3M12 22v-3M2 12h3" />
        </>
      );
    case 'pin':
      return (
        <>
          <path {...common} d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
          <circle {...common} cx="12" cy="10" r="2.2" />
        </>
      );
    case 'bell':
      return (
        <>
          <path {...common} d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2Z" />
          <path {...common} d="M10 20a2 2 0 0 0 4 0" />
        </>
      );
    case 'document':
      return (
        <>
          <path {...common} d="M6 3h8l4 4v14H6V3Z" />
          <path {...common} d="M14 3v5h4M9 13h6M9 17h6" />
        </>
      );
    case 'building':
      return (
        <>
          <path {...common} d="M4 20h16M6 20V9l6-4 6 4v11" />
          <path {...common} d="M9 20v-5h6v5M9 11h.01M12 11h.01M15 11h.01" />
        </>
      );
    case 'info':
      return (
        <>
          <circle {...common} cx="12" cy="12" r="9" />
          <path {...common} d="M12 11v5M12 8h.01" />
        </>
      );
    default:
      return <circle {...common} cx="12" cy="12" r="8" />;
  }
}

const styles = {
  page: {
    minHeight: '100vh',
    background: COLORS.surfaceBlue,
    color: COLORS.text,
    display: 'grid',
    alignContent: 'start',
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
  },
  topbar: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(520px, 100%), 1fr))',
    alignItems: 'center',
    gap: '18px',
    padding: '14px clamp(18px, 3vw, 40px)',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '0 0 8px 8px',
    boxShadow: '0 8px 28px rgba(13, 27, 61, 0.08)',
  },
  brandLockup: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '18px',
    minWidth: 0,
    color: 'inherit',
    textDecoration: 'none',
  },
  logoMunicipio: {
    width: 'clamp(210px, 22vw, 310px)',
    height: 'auto',
    objectFit: 'contain',
  },
  brandDivider: {
    width: 1,
    alignSelf: 'stretch',
    minHeight: 58,
    background: COLORS.border,
  },
  animalBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  logoAnimalSmall: {
    width: 64,
    height: 64,
    objectFit: 'contain',
    borderRadius: '8px',
  },
  animalBrandText: {
    display: 'grid',
    gap: '2px',
    lineHeight: 1.1,
    textTransform: 'uppercase',
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: 800,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '4px',
  },
  navArea: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '14px',
  },
  navLink: {
    minHeight: 42,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    padding: '0 10px',
    borderRadius: '8px',
    color: '#4f5c73',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    color: COLORS.green,
    background: '#eaf7ed',
    boxShadow: `inset 0 -3px 0 ${COLORS.green}`,
  },
  loginButton: {
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: `1px solid ${COLORS.green}`,
    borderRadius: '8px',
    background: COLORS.surface,
    color: COLORS.green,
    fontWeight: 800,
    padding: '0 18px',
    cursor: 'pointer',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
    alignItems: 'center',
    gap: '32px',
    minHeight: 420,
    padding: 'clamp(38px, 5vw, 72px) clamp(28px, 6vw, 84px) clamp(52px, 6vw, 86px)',
    backgroundColor: COLORS.surfaceBlue,
    backgroundImage: `linear-gradient(90deg, rgba(238, 244, 255, 0.72) 0%, rgba(255, 255, 255, 0.42) 45%, rgba(255, 255, 255, 0.08) 100%), url(${heroBackground})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center bottom',
    backgroundSize: 'cover',
    borderBottom: `1px solid ${COLORS.border}`,
    overflow: 'hidden',
  },
  heroCopy: {
    display: 'grid',
    gap: '16px',
    maxWidth: 560,
  },
  title: {
    margin: 0,
    color: COLORS.navy,
    fontSize: 'clamp(44px, 5vw, 66px)',
    lineHeight: 1.08,
    letterSpacing: 0,
    fontWeight: 900,
  },
  titleAccent: {
    display: 'block',
    color: COLORS.green,
  },
  heroSubtitle: {
    margin: 0,
    color: COLORS.muted,
    fontSize: 'clamp(17px, 2vw, 21px)',
    lineHeight: 1.45,
    maxWidth: 470,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
    marginTop: '4px',
  },
  primaryButton: {
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '9px',
    border: `1px solid ${COLORS.green}`,
    borderRadius: '8px',
    background: COLORS.green,
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0 22px',
    boxShadow: '0 10px 22px rgba(46, 158, 75, 0.22)',
    whiteSpace: 'nowrap',
  },
  secondaryButton: {
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '9px',
    border: `1px solid ${COLORS.green}`,
    borderRadius: '8px',
    background: COLORS.surface,
    color: COLORS.green,
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0 22px',
    whiteSpace: 'nowrap',
  },
  heroVisual: {
    display: 'grid',
    justifyItems: 'center',
    alignItems: 'center',
    minHeight: 260,
  },
  heroLogo: {
    width: '100%',
    maxWidth: 560,
    maxHeight: 330,
    objectFit: 'contain',
    filter: 'drop-shadow(0 18px 28px rgba(13, 27, 61, 0.08))',
  },
  loadingCard: {
    margin: '24px clamp(18px, 3vw, 42px)',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: 20,
    boxShadow: '0 8px 24px rgba(13, 27, 61, 0.06)',
  },
  content: {
    display: 'grid',
    gap: '18px',
    padding: '0 clamp(18px, 3vw, 42px) 0',
    marginTop: '-34px',
    position: 'relative',
    zIndex: 1,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
    gap: '18px',
  },
  metric: {
    display: 'grid',
    gridTemplateColumns: '52px minmax(0, 1fr)',
    gridTemplateRows: 'auto auto',
    columnGap: '14px',
    alignItems: 'center',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    minHeight: 124,
    padding: '16px 18px',
    boxShadow: '0 8px 24px rgba(13, 27, 61, 0.07)',
  },
  iconBadge: {
    gridRow: '1 / span 2',
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: '999px',
    flex: '0 0 auto',
  },
  metricLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.18,
    overflowWrap: 'normal',
  },
  metricValue: {
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 900,
  },
  searchPanel: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
    alignItems: 'center',
    gap: '18px',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '16px 20px',
    boxShadow: '0 8px 24px rgba(13, 27, 61, 0.06)',
  },
  searchTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  sectionTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: COLORS.muted,
    lineHeight: 1.5,
    fontSize: 14,
  },
  searchForm: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 1fr) auto',
    gap: '14px',
  },
  input: {
    minHeight: 44,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '0 14px',
    background: COLORS.surface,
    color: COLORS.text,
    fontSize: 15,
  },
  alertError: {
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fff1f1',
    color: '#b91c1c',
    padding: '12px 14px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
    gap: '18px',
    alignItems: 'stretch',
  },
  lowerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
    gap: '18px',
    alignItems: 'stretch',
  },
  card: {
    display: 'grid',
    alignContent: 'start',
    gap: '16px',
    minHeight: 0,
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '18px',
    boxShadow: '0 8px 24px rgba(13, 27, 61, 0.06)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cardTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 900,
  },
  cardAction: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: 800,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  list: {
    display: 'grid',
    gap: '12px',
  },
  highlightItem: {
    display: 'grid',
    gap: '8px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    background: '#f8fbff',
    padding: '16px',
    color: COLORS.muted,
    fontSize: 14,
  },
  metaLine: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: COLORS.muted,
    fontWeight: 700,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    background: '#ffffff',
    padding: '14px',
    color: COLORS.text,
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    borderBottom: `1px solid ${COLORS.border}`,
    padding: '9px 8px',
    whiteSpace: 'nowrap',
    color: COLORS.text,
    fontWeight: 900,
    background: '#f8fbff',
  },
  td: {
    borderBottom: '1px solid #edf2f9',
    padding: '9px 8px',
    color: COLORS.text,
    verticalAlign: 'top',
  },
  readingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
    gap: '12px',
  },
  miniStat: {
    display: 'grid',
    gap: '7px',
    alignContent: 'start',
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: 700,
  },
  note: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    margin: 0,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 1.45,
  },
  governanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '18px',
  },
  governanceCard: {
    display: 'grid',
    gridTemplateColumns: '48px minmax(0, 1fr)',
    gap: '16px',
    alignItems: 'center',
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '18px',
    boxShadow: '0 8px 24px rgba(13, 27, 61, 0.06)',
  },
  governanceTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 900,
  },
  governanceValue: {
    margin: '4px 0 8px',
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 1.4,
  },
  documentLink: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: 800,
    textDecoration: 'none',
  },
  animalPanel: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '18px',
    display: 'grid',
    gap: '16px',
    background: COLORS.surface,
    boxShadow: '0 8px 24px rgba(13, 27, 61, 0.06)',
  },
  animalTitle: {
    margin: '4px 0',
    color: COLORS.text,
    fontSize: 22,
  },
  animalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  infoItem: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '12px',
    display: 'grid',
    gap: '4px',
    background: '#f8fbff',
  },
  label: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: 800,
  },
  timelineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '14px',
  },
  timeline: {
    display: 'grid',
    gap: '10px',
  },
  timelineItem: {
    borderLeft: `4px solid ${COLORS.green}`,
    background: '#f8fbff',
    padding: '10px 12px',
    display: 'grid',
    gap: '4px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '4px',
    padding: '18px',
    borderRadius: '8px 8px 0 0',
    background: COLORS.navy,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 700,
  },
};
