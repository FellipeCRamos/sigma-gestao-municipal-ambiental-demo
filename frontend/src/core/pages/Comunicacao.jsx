import { useEffect, useMemo, useState } from 'react';
import {
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_DELIVERY_STATUS_LABELS,
  COMMUNICATION_PRIORITY_LABELS,
  NOTIFICATION_TYPE_LABELS,
  displayLabel,
} from '../../utils/displayLabels';
import {
  getComunicacaoEntregas,
  getComunicacaoEventos,
  getComunicacaoResumo,
} from '../api/comunicacaoApi';

const DEFAULT_FILTERS = {
  canal: '',
  status: '',
  tipo: '',
  prioridade: '',
  data_inicio: '',
  data_fim: '',
};

const PER_PAGE = 25;

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function compactError(error) {
  return error?.message || 'Não foi possível carregar a comunicação institucional.';
}

export default function Comunicacao() {
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [resumo, setResumo] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: PER_PAGE, total: 0, total_pages: 1 });
  const [eventos, setEventos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError('');

        const [resumoResponse, entregasResponse, eventosResponse] = await Promise.all([
          getComunicacaoResumo(filters),
          getComunicacaoEntregas({ ...filters, page, per_page: PER_PAGE }),
          getComunicacaoEventos(),
        ]);

        if (cancelled) return;

        setResumo(resumoResponse.data || null);
        setEntregas(Array.isArray(entregasResponse.data?.items) ? entregasResponse.data.items : []);
        setPagination(entregasResponse.data?.pagination || {
          page,
          per_page: PER_PAGE,
          total: 0,
          total_pages: 1,
        });
        setEventos(eventosResponse.data?.eventos || null);
      } catch (err) {
        if (!cancelled) {
          setError(compactError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  const metricas = useMemo(() => {
    const entregasResumo = resumo?.entregas || {};
    return [
      ['Total na fila', entregasResumo.total || 0],
      ['Pendentes', entregasResumo.pendentes || 0],
      ['Entregues', entregasResumo.entregues || 0],
      ['Falhas temporárias', entregasResumo.erros || 0],
      ['Falhas permanentes', entregasResumo.falhas_permanentes || 0],
      ['Exigem ação', entregasResumo.requer_acao || 0],
    ];
  }, [resumo]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function handleFilterSubmit(event) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function handleClearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Comunicação institucional</h2>
            <p style={styles.subtitle}>
              Visão operacional da fila de comunicação, entregas, falhas e eventos notificáveis.
            </p>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={() => setFilters({ ...filters })}>
            Atualizar
          </button>
        </div>

        {error ? <div style={styles.alertError}>{error}</div> : null}

        <div style={styles.metricsGrid}>
          {metricas.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))}
        </div>

        <div style={styles.statusGrid}>
          <InfoBlock
            title="Web Push"
            lines={[
              resumo?.web_push?.enabled ? 'Habilitado no ambiente' : 'Preparado, mas condicionado por ambiente',
              resumo?.web_push?.observacao || 'Sem informação de ambiente.',
            ]}
          />
          <InfoBlock
            title="Assinaturas"
            lines={[
              `${resumo?.subscriptions?.ativas || 0} ativas`,
              `${resumo?.subscriptions?.ativas_com_falha || 0} ativas com falha recente`,
              `Último sucesso: ${formatDateTime(resumo?.subscriptions?.ultimo_sucesso)}`,
            ]}
          />
          <InfoBlock
            title="Preferências"
            lines={[
              `${resumo?.preferencias?.usuarios_externos || 0} tutores ativos`,
              `${resumo?.preferencias?.web_push_opt_in || 0} com Web Push autorizado`,
              `${resumo?.preferencias?.email_opt_in || 0} com preferência de e-mail registrada`,
            ]}
          />
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.sectionTitle}>Entregas e falhas</h3>
            <p style={styles.subtitle}>
              Filtros de leitura. Esta tela não dispara mensagens nem altera histórico.
            </p>
          </div>
        </div>

        <form style={styles.filters} onSubmit={handleFilterSubmit}>
          <Select label="Canal" name="canal" value={draftFilters.canal} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="portal">Portal</option>
            <option value="web_push">Web Push</option>
            <option value="email">E-mail</option>
          </Select>
          <Select label="Status" name="status" value={draftFilters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="entregue">Entregue</option>
            <option value="erro">Falha temporária</option>
            <option value="falha_permanente">Falha permanente</option>
            <option value="ignorada">Ignorada</option>
          </Select>
          <Input label="Tipo" name="tipo" value={draftFilters.tipo} onChange={handleFilterChange} placeholder="operacional, campanha..." />
          <Select label="Prioridade" name="prioridade" value={draftFilters.prioridade} onChange={handleFilterChange}>
            <option value="">Todas</option>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </Select>
          <Input label="Início" name="data_inicio" type="datetime-local" value={draftFilters.data_inicio} onChange={handleFilterChange} />
          <Input label="Fim" name="data_fim" type="datetime-local" value={draftFilters.data_fim} onChange={handleFilterChange} />
          <div style={styles.filterActions}>
            <button type="submit" style={styles.primaryButton}>Aplicar filtros</button>
            <button type="button" style={styles.secondaryButton} onClick={handleClearFilters}>Limpar</button>
          </div>
        </form>

        {loading ? <p style={styles.subtitle}>Carregando comunicação...</p> : null}

        {!loading && entregas.length === 0 ? (
          <p style={styles.subtitle}>Nenhuma entrega encontrada com os filtros informados.</p>
        ) : null}

        {entregas.length > 0 ? (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Criada em</th>
                  <th style={styles.th}>Canal</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Notificação</th>
                  <th style={styles.th}>Tentativas</th>
                  <th style={styles.th}>Última tentativa</th>
                  <th style={styles.th}>Falha</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((entrega) => (
                  <tr key={entrega.id}>
                    <td style={styles.td}>{formatDateTime(entrega.created_at)}</td>
                    <td style={styles.td}>{displayLabel(entrega.canal, COMMUNICATION_CHANNEL_LABELS)}</td>
                    <td style={styles.td}>
                      <span style={getStatusStyle(entrega.status)}>{displayLabel(entrega.status, COMMUNICATION_DELIVERY_STATUS_LABELS)}</span>
                    </td>
                    <td style={styles.td}>
                      <strong>{entrega.notificacao?.titulo || '-'}</strong>
                      <span style={styles.mutedLine}>
                        {displayLabel(entrega.notificacao?.tipo, NOTIFICATION_TYPE_LABELS)} · {displayLabel(entrega.notificacao?.prioridade, COMMUNICATION_PRIORITY_LABELS)}
                        {entrega.notificacao?.requer_acao ? ' · requer ação' : ''}
                      </span>
                      <span style={styles.mutedLine}>
                        Ref.: {entrega.notificacao?.ref_tipo || '-'} #{entrega.notificacao?.ref_id || '-'}
                      </span>
                    </td>
                    <td style={styles.td}>{entrega.tentativa_count}</td>
                    <td style={styles.td}>{formatDateTime(entrega.ultima_tentativa_em)}</td>
                    <td style={styles.td}>
                      {entrega.erro_codigo || entrega.erro_mensagem ? (
                        <>
                          <strong>{entrega.erro_codigo || 'Erro'}</strong>
                          <span style={styles.mutedLine}>{entrega.erro_mensagem || '-'}</span>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div style={styles.pagination}>
          <button type="button" style={styles.secondaryButton} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Anterior
          </button>
          <span style={styles.subtitle}>
            Página {pagination.page} de {pagination.total_pages} · {pagination.total} registro(s)
          </span>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={page >= pagination.total_pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.sectionTitle}>Eventos notificáveis</h3>
            <p style={styles.subtitle}>
              Catálogo de governança da Fase 4A: ativos, preparados e adiados.
            </p>
          </div>
        </div>

        <div style={styles.eventGrid}>
          <EventColumn title="Ativos" items={eventos?.ativos || []} />
          <EventColumn title="Preparados" items={eventos?.preparados || []} />
          <EventColumn title="Adiados" items={eventos?.adiados || []} />
          <EventColumn title="Fora do escopo" items={eventos?.fora_escopo || []} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoBlock({ title, lines }) {
  return (
    <div style={styles.infoBlock}>
      <strong>{title}</strong>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

function EventColumn({ title, items }) {
  return (
    <div style={styles.eventColumn}>
      <strong>{title}</strong>
      {items.length === 0 ? <span style={styles.mutedLine}>Nenhum evento.</span> : null}
      {items.map((event) => (
        <div key={event.key} style={styles.eventItem}>
          <span>{event.label}</span>
          <small>{event.descricao}</small>
        </div>
      ))}
    </div>
  );
}

function Input({ label, name, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} style={styles.input} />
    </label>
  );
}

function Select({ label, name, value, onChange, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select name={name} value={value} onChange={onChange} style={styles.input}>
        {children}
      </select>
    </label>
  );
}

function getStatusStyle(status) {
  if (status === 'entregue') return styles.badgeSuccess;
  if (status === 'erro') return styles.badgeWarning;
  if (status === 'falha_permanente') return styles.badgeDanger;
  if (status === 'ignorada') return styles.badgeMuted;
  return styles.badgeInfo;
}

const styles = {
  page: { display: 'grid', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  sectionTitle: { margin: 0, marginBottom: '8px', fontSize: '20px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '14px' },
  metricCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', background: '#f9fafb', display: 'grid', gap: '8px', color: '#374151' },
  statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '14px', marginTop: '16px' },
  infoBlock: { border: '1px solid #dbeafe', borderRadius: '8px', padding: '14px', background: '#eff6ff', display: 'grid', gap: '6px', color: '#1e3a8a', fontSize: '13px' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '12px', alignItems: 'end', marginBottom: '18px' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { height: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff' },
  filterActions: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  primaryButton: { height: '40px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
  secondaryButton: { height: '40px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '980px', background: '#ffffff' },
  th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '13px' },
  td: { padding: '12px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', verticalAlign: 'top' },
  mutedLine: { display: 'block', marginTop: '4px', color: '#6b7280', fontSize: '12px', lineHeight: 1.4 },
  badgeInfo: { display: 'inline-block', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', color: '#1d4ed8', padding: '5px 8px', fontWeight: 700 },
  badgeSuccess: { display: 'inline-block', border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '5px 8px', fontWeight: 700 },
  badgeWarning: { display: 'inline-block', border: '1px solid #fde68a', borderRadius: '8px', background: '#fffbeb', color: '#92400e', padding: '5px 8px', fontWeight: 700 },
  badgeDanger: { display: 'inline-block', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '5px 8px', fontWeight: 700 },
  badgeMuted: { display: 'inline-block', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', color: '#4b5563', padding: '5px 8px', fontWeight: 700 },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '16px' },
  eventGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '14px' },
  eventColumn: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', display: 'grid', gap: '10px', background: '#ffffff' },
  eventItem: { borderTop: '1px solid #f3f4f6', paddingTop: '10px', display: 'grid', gap: '4px', color: '#374151' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginBottom: '12px' },
};
