import { useEffect, useMemo, useState } from 'react';
import {
  assignOperacaoResponsavel,
  createOperacaoObservacao,
  getOperacaoFila,
  getOperacaoHistorico,
  getOperacaoNotificacoes,
  getOperacaoResponsaveis,
  getTerritorios,
  updateOperacaoPrazo,
} from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const TIPO_LABELS = {
  campanha_inscriao: 'Campanha',
  ocorrencia: 'Ocorrência',
};

const CRITICIDADE_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const SLA_LABELS = {
  no_prazo: 'No prazo',
  atencao: 'Em atenção',
  vencido: 'Vencido',
  finalizado: 'Finalizado',
};

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatDateTimeInput(value) {
  if (!value) return '';
  return String(value).slice(0, 16);
}

function itemKey(item) {
  return `${item.tipo_item}-${item.id}`;
}

export default function Operacao({ usuarioInterno, onOpenCampanhas, onOpenOcorrencias }) {
  const [items, setItems] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [territorios, setTerritorios] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [historicos, setHistoricos] = useState({});
  const [filters, setFilters] = useState({
    tipo: '',
    criticidade: '',
    fila: '',
    responsavel_id: '',
    sla_situacao: '',
    pendencia: '',
    territorio_id: '',
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canView = hasPermission(usuarioInterno, PERMISSIONS.OPERACAO_FILA_VIEW);
  const canAssign = hasPermission(usuarioInterno, PERMISSIONS.OPERACAO_RESPONSAVEL_ASSIGN);
  const canUpdatePrazo = hasPermission(usuarioInterno, PERMISSIONS.OPERACAO_PRAZO_UPDATE);
  const canViewHistorico = hasPermission(usuarioInterno, PERMISSIONS.OPERACAO_HISTORICO_VIEW);
  const canCreateObservacao = hasPermission(usuarioInterno, PERMISSIONS.OPERACAO_OBSERVACAO_CREATE);
  const canViewNotificacoes = hasPermission(usuarioInterno, PERMISSIONS.OPERACAO_NOTIFICACOES_VIEW);

  function buildDrafts(nextItems) {
    return nextItems.reduce((acc, item) => {
      acc[itemKey(item)] = {
        responsavel_interno_id: item.responsavel_interno_id || '',
        prazo_limite_operacional: formatDateTimeInput(item.prazo_limite_operacional || item.prazo_limite),
        observacao: '',
      };
      return acc;
    }, {});
  }

  async function loadData(nextFilters = filters) {
    try {
      setLoading(true);
      setError('');

      const requests = [
        getOperacaoFila(nextFilters),
        getOperacaoResponsaveis(),
        getTerritorios().catch(() => ({ data: [] })),
        canViewNotificacoes ? getOperacaoNotificacoes() : Promise.resolve({ data: [] }),
      ];
      const [filaResponse, responsaveisResponse, territoriosResponse, notificacoesResponse] = await Promise.all(requests);
      const nextItems = Array.isArray(filaResponse.data) ? filaResponse.data : [];

      setItems(nextItems);
      setResponsaveis(Array.isArray(responsaveisResponse.data) ? responsaveisResponse.data : []);
      setTerritorios(Array.isArray(territoriosResponse.data) ? territoriosResponse.data : []);
      setNotificacoes(Array.isArray(notificacoesResponse.data) ? notificacoesResponse.data : []);
      setDrafts(buildDrafts(nextItems));
    } catch (err) {
      setError(err.message || 'Não foi possível carregar a fila operacional.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError('');

        const initialFilters = {
          tipo: '',
          criticidade: '',
          fila: '',
          responsavel_id: '',
          sla_situacao: '',
          pendencia: '',
          territorio_id: '',
        };
        const requests = [
          getOperacaoFila(initialFilters),
          getOperacaoResponsaveis(),
          getTerritorios().catch(() => ({ data: [] })),
          canViewNotificacoes ? getOperacaoNotificacoes() : Promise.resolve({ data: [] }),
        ];
        const [filaResponse, responsaveisResponse, territoriosResponse, notificacoesResponse] = await Promise.all(requests);
        const nextItems = Array.isArray(filaResponse.data) ? filaResponse.data : [];

        setItems(nextItems);
        setResponsaveis(Array.isArray(responsaveisResponse.data) ? responsaveisResponse.data : []);
        setTerritorios(Array.isArray(territoriosResponse.data) ? territoriosResponse.data : []);
        setNotificacoes(Array.isArray(notificacoesResponse.data) ? notificacoesResponse.data : []);
        setDrafts(buildDrafts(nextItems));
      } catch (err) {
        setError(err.message || 'Não foi possível carregar a fila operacional.');
      } finally {
        setLoading(false);
      }
    }

    if (canView) {
      loadInitialData();
    }
  }, [canView, canViewNotificacoes]);

  const resumo = useMemo(() => ({
    total: items.length,
    campanhas: items.filter((item) => item.tipo_item === 'campanha_inscriao').length,
    ocorrencias: items.filter((item) => item.tipo_item === 'ocorrencia').length,
    alta: items.filter((item) => item.criticidade === 'alta').length,
    pendencias: items.filter((item) => item.pendencia_aberta).length,
    vencidos: items.filter((item) => item.sla_situacao === 'vencido').length,
    atencao: items.filter((item) => item.sla_situacao === 'atencao').length,
    semResponsavel: items.filter((item) => !item.responsavel_interno_id).length,
  }), [items]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    const nextFilters = { ...filters, [name]: value };
    setFilters(nextFilters);
    loadData(nextFilters);
  }

  function handleDraftChange(key, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
    setMessage('');
    setError('');
  }

  function handleOpenItem(item) {
    if (item.tipo_item === 'campanha_inscriao') {
      onOpenCampanhas?.();
      return;
    }

    onOpenOcorrencias?.();
  }

  async function handleAssign(item) {
    const key = itemKey(item);
    const draft = drafts[key] || {};

    try {
      await assignOperacaoResponsavel(item.tipo_item, item.id, {
        responsavel_interno_id: draft.responsavel_interno_id ? Number(draft.responsavel_interno_id) : null,
        observacao: draft.observacao || null,
      });
      setMessage('Responsável operacional atualizado.');
      await loadData(filters);
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar o responsável.');
    }
  }

  async function handlePrazo(item) {
    const key = itemKey(item);
    const draft = drafts[key] || {};

    try {
      await updateOperacaoPrazo(item.tipo_item, item.id, {
        prazo_limite_operacional: draft.prazo_limite_operacional || null,
        observacao: draft.observacao || null,
      });
      setMessage('Prazo operacional atualizado.');
      await loadData(filters);
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar o prazo.');
    }
  }

  async function handleObservacao(item) {
    const key = itemKey(item);
    const draft = drafts[key] || {};

    try {
      await createOperacaoObservacao(item.tipo_item, item.id, {
        observacao: draft.observacao || null,
      });
      setMessage('Observação operacional registrada.');
      await loadData(filters);
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a observação.');
    }
  }

  async function handleToggleHistorico(item) {
    const key = itemKey(item);

    if (historicos[key]) {
      setHistoricos((prev) => ({ ...prev, [key]: null }));
      return;
    }

    try {
      const response = await getOperacaoHistorico(item.tipo_item, item.id);
      setHistoricos((prev) => ({
        ...prev,
        [key]: Array.isArray(response.data) ? response.data : [],
      }));
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o histórico operacional.');
    }
  }

  if (!canView) {
    return (
      <section style={styles.section}>
        <p style={styles.subtitle}>Seu perfil não permite visualizar a fila operacional.</p>
      </section>
    );
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Fila operacional SMAD</h2>
            <p style={styles.subtitle}>Responsaveis, prazos, pendências e histórico de trabalho ativo.</p>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={() => loadData()}>
            Atualizar fila
          </button>
        </div>

        <div style={styles.grid4}>
          <Metric title="Itens na fila" value={resumo.total} />
          <Metric title="Alta criticidade" value={resumo.alta} />
          <Metric title="Vencidos" value={resumo.vencidos} danger />
          <Metric title="Em atenção" value={resumo.atencao} />
          <Metric title="Sem responsável" value={resumo.semResponsavel} />
          <Metric title="Pendências abertas" value={resumo.pendencias} />
        </div>

        {notificacoes.length > 0 ? (
          <div style={styles.notificationBox}>
            <strong>Notificações recentes</strong>
            {notificacoes.slice(0, 3).map((notificacao) => (
              <span key={notificacao.id}>{notificacao.titulo}: {notificacao.mensagem}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section style={styles.section}>
        <div style={styles.filters}>
          <Select label="Tipo" name="tipo" value={filters.tipo} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="campanha_inscriao">Campanhas</option>
            <option value="ocorrencia">Ocorrências</option>
          </Select>
          <Select label="Responsável" name="responsavel_id" value={filters.responsavel_id} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="sem_responsavel">Sem responsável</option>
            {responsaveis.map((responsavel) => (
              <option key={responsavel.id} value={responsavel.id}>{responsavel.nome}</option>
            ))}
          </Select>
          <Select label="SLA" name="sla_situacao" value={filters.sla_situacao} onChange={handleFilterChange}>
            <option value="">Todos</option>
            <option value="vencido">Vencidos</option>
            <option value="atencao">Em atenção</option>
            <option value="no_prazo">No prazo</option>
          </Select>
          <Select label="Pendência" name="pendencia" value={filters.pendencia} onChange={handleFilterChange}>
            <option value="">Todas</option>
            <option value="true">Com pendência</option>
            <option value="false">Sem pendência</option>
          </Select>
          <Select label="Território" name="territorio_id" value={filters.territorio_id} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {territorios.map((territorio) => (
              <option key={territorio.id} value={territorio.id}>
                {territorio.nome}
              </option>
            ))}
          </Select>
          <Select label="Criticidade" name="criticidade" value={filters.criticidade} onChange={handleFilterChange}>
            <option value="">Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </Select>
          <Input label="Fila" name="fila" value={filters.fila} onChange={handleFilterChange} placeholder="triagem, pendência, atendimento..." />
        </div>

        {message ? <div style={styles.alertSuccess}>{message}</div> : null}
        {error ? <div style={styles.alertError}>{error}</div> : null}
        {loading ? <p>Carregando fila operacional...</p> : null}

        {!loading && items.length === 0 ? (
          <p>Nenhum item ativo na fila com os filtros informados.</p>
        ) : (
          <div style={styles.cards}>
            {items.map((item) => {
              const key = itemKey(item);
              const draft = drafts[key] || {};
              const historico = historicos[key];

              return (
                <article key={key} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <strong style={styles.protocol}>{item.identificador}</strong>
                      <p style={styles.subtitle}>
                        {TIPO_LABELS[item.tipo_item] || item.tipo_item} - {item.status_label || item.status}
                      </p>
                    </div>
                    <div style={styles.badgeRow}>
                      <span style={item.criticidade === 'alta' ? styles.alertBadge : styles.statusBadge}>
                        {CRITICIDADE_LABELS[item.criticidade] || item.criticidade}
                      </span>
                      <span style={item.sla_situacao === 'vencido' ? styles.alertBadge : styles.statusBadge}>
                        {SLA_LABELS[item.sla_situacao] || item.sla_situacao}
                      </span>
                    </div>
                  </div>

                  <div style={styles.detailsGrid}>
                    <Info label="Titulo" value={item.titulo || '-'} />
                    <Info label="Pessoa" value={item.pessoa_nome || '-'} />
                    <Info label="Animal" value={item.animal_nome || '-'} />
                    <Info label="Território" value={item.territorio_nome || item.bairro || '-'} />
                    <Info label="Fila" value={item.fila || '-'} />
                    <Info label="Responsável" value={item.responsavel_nome || 'Sem responsável'} />
                    <Info label="Aberto ha" value={`${item.antiguidade_dias || 0} dia(s)`} />
                    <Info label="Prazo" value={formatDateTime(item.prazo_limite)} />
                    <Info label="Atualizado" value={formatDateTime(item.status_operacional_updated_at || item.updated_at)} />
                  </div>

                  {item.pendencia_aberta ? (
                    <div style={styles.pendingBox}>
                      <strong>Pendência aberta</strong>
                      <span>{item.pendencia_descricao || item.pendencia_tipo || 'Sem detalhe informado.'}</span>
                    </div>
                  ) : null}

                  <p style={styles.nextStep}>{item.proximo_passo}</p>

                  <div style={styles.actionGrid}>
                    <Select
                      label="Responsável"
                      value={draft.responsavel_interno_id || ''}
                      onChange={(event) => handleDraftChange(key, 'responsavel_interno_id', event.target.value)}
                    >
                      <option value="">Sem responsável</option>
                      {responsaveis.map((responsavel) => (
                        <option key={responsavel.id} value={responsavel.id}>{responsavel.nome}</option>
                      ))}
                    </Select>
                    <Input
                      label="Prazo manual"
                      type="datetime-local"
                      value={draft.prazo_limite_operacional || ''}
                      onChange={(event) => handleDraftChange(key, 'prazo_limite_operacional', event.target.value)}
                    />
                    <Input
                      label="Observação"
                      value={draft.observacao || ''}
                      onChange={(event) => handleDraftChange(key, 'observacao', event.target.value)}
                      placeholder="Motivo, nota operacional ou justificativa"
                    />
                  </div>

                  <div style={styles.buttonRow}>
                    <button type="button" onClick={() => handleOpenItem(item)} style={styles.primaryButton}>
                      Abrir módulo
                    </button>
                    {canAssign ? (
                      <button type="button" onClick={() => handleAssign(item)} style={styles.secondaryButton}>
                        Salvar responsável
                      </button>
                    ) : null}
                    {canUpdatePrazo ? (
                      <button type="button" onClick={() => handlePrazo(item)} style={styles.secondaryButton}>
                        Salvar prazo
                      </button>
                    ) : null}
                    {canCreateObservacao ? (
                      <button type="button" onClick={() => handleObservacao(item)} style={styles.secondaryButton}>
                        Registrar observação
                      </button>
                    ) : null}
                    {canViewHistorico ? (
                      <button type="button" onClick={() => handleToggleHistorico(item)} style={styles.secondaryButton}>
                        {historico ? 'Ocultar histórico' : 'Ver histórico'}
                      </button>
                    ) : null}
                  </div>

                  {Array.isArray(historico) ? (
                    <div style={styles.historyBox}>
                      <strong>Histórico operacional</strong>
                      {historico.length === 0 ? (
                        <span>Sem histórico operacional estruturado para este item.</span>
                      ) : (
                        historico.map((entry) => (
                          <div key={entry.id} style={styles.historyItem}>
                            <span>{formatDateTime(entry.created_at)} - {entry.evento}</span>
                            <small>
                              {entry.status_anterior || '-'} {'->'} {entry.status_novo || '-'}
                              {entry.created_by_nome ? ` | ${entry.created_by_nome}` : ''}
                            </small>
                            {entry.observacao ? <small>{entry.observacao}</small> : null}
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ title, value, danger = false }) {
  return (
    <div style={danger ? styles.metricCardDanger : styles.metricCard}>
      <span>{title}</span>
      <strong>{value}</strong>
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

function Info({ label, value }) {
  return (
    <div style={styles.infoLine}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: '14px' },
  metricCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', background: '#f9fafb', display: 'grid', gap: '8px', color: '#374151' },
  metricCardDanger: { border: '1px solid #fdba74', borderRadius: '8px', padding: '16px', background: '#fff7ed', display: 'grid', gap: '8px', color: '#9a3412' },
  notificationBox: { marginTop: '14px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', display: 'grid', gap: '6px', color: '#374151', fontSize: '13px' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', marginBottom: '18px' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { height: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff' },
  cards: { display: 'grid', gap: '14px' },
  card: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'grid', gap: '14px', background: '#ffffff' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' },
  protocol: { color: '#111827', fontSize: '16px' },
  badgeRow: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  statusBadge: { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 8px', color: '#334155', fontSize: '12px', fontWeight: 700 },
  alertBadge: { border: '1px solid #fdba74', borderRadius: '8px', padding: '6px 8px', color: '#9a3412', background: '#fff7ed', fontSize: '12px', fontWeight: 700 },
  detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  infoLine: { display: 'grid', gap: '4px', color: '#4b5563', fontSize: '13px' },
  pendingBox: { border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', background: '#fffbeb', color: '#92400e', display: 'grid', gap: '6px', fontSize: '14px' },
  nextStep: { margin: 0, color: '#374151', fontSize: '14px', lineHeight: 1.5 },
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px' },
  buttonRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  primaryButton: { height: '40px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
  secondaryButton: { height: '40px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  historyBox: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'grid', gap: '10px', background: '#f9fafb', color: '#374151', fontSize: '13px' },
  historyItem: { borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', display: 'grid', gap: '4px' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginBottom: '12px' },
  alertSuccess: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '12px', fontSize: '14px', marginBottom: '12px' },
};
