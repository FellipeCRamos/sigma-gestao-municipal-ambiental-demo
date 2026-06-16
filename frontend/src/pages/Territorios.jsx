import { useEffect, useMemo, useState } from 'react';
import {
  createTerritorio,
  createTerritorioAlias,
  getTerritorioGestaoResumo,
  getTerritorioLegado,
  getTerritorios,
  reviewTerritorioLegado,
  updateTerritorio,
  updateTerritorioAlias,
  updateTerritorioAliasStatus,
  updateTerritorioStatus,
} from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const INITIAL_TERRITORIO_FORM = {
  nome: '',
  categoria: 'bairro',
  status: 'ativo',
  origem: 'manual',
  ordem_exibicao: '',
  homologado: false,
  observacoes: '',
};

const INITIAL_ALIAS_FORM = {
  alias: '',
  status: 'ativo',
  observacoes: '',
};

const MODULOS = [
  ['animal', 'Animais'],
  ['tutor', 'Tutores'],
  ['ocorrencia', 'Ocorrências'],
  ['campanha_inscriao', 'Inscrições de campanha'],
];

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

function territorioLabel(territorio) {
  if (!territorio) return '-';
  return territorio.categoria ? `${territorio.nome} (${territorio.categoria})` : territorio.nome;
}

export default function Territorios({ usuarioInterno }) {
  const [territorios, setTerritorios] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [legado, setLegado] = useState([]);
  const [selectedTerritorioId, setSelectedTerritorioId] = useState('');
  const [editingTerritorioId, setEditingTerritorioId] = useState('');
  const [territorioForm, setTerritorioForm] = useState(INITIAL_TERRITORIO_FORM);
  const [aliasForm, setAliasForm] = useState(INITIAL_ALIAS_FORM);
  const [editingAliasId, setEditingAliasId] = useState('');
  const [reviewModulo, setReviewModulo] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canManage = hasPermission(usuarioInterno, PERMISSIONS.TERRITORIOS_MANAGE);
  const canManageAlias = hasPermission(usuarioInterno, PERMISSIONS.TERRITORIOS_ALIAS_MANAGE);
  const canReview = hasPermission(usuarioInterno, PERMISSIONS.TERRITORIOS_REVIEW);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [territoriosResponse, resumoResponse, legadoResponse] = await Promise.all([
        getTerritorios({ incluir_inativos: true }),
        getTerritorioGestaoResumo(),
        canReview ? getTerritorioLegado({ modulo: reviewModulo, limit: 200 }) : Promise.resolve({ data: [] }),
      ]);
      const territoriosData = Array.isArray(territoriosResponse.data) ? territoriosResponse.data : [];
      setTerritorios(territoriosData);
      setResumo(resumoResponse.data || null);
      setLegado(Array.isArray(legadoResponse.data) ? legadoResponse.data : []);
      setSelectedTerritorioId((current) => current || String(territoriosData[0]?.id || ''));
    } catch (err) {
      setError(err.message || 'Não foi possível carregar a gestão territorial.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewModulo]);

  const selectedTerritorio = useMemo(() => {
    return territorios.find((item) => String(item.id) === String(selectedTerritorioId)) || null;
  }, [selectedTerritorioId, territorios]);

  const territoriosAtivos = useMemo(() => {
    return territorios.filter((item) => item.status === 'ativo');
  }, [territorios]);

  function resetTerritorioForm() {
    setEditingTerritorioId('');
    setTerritorioForm(INITIAL_TERRITORIO_FORM);
  }

  function startEditTerritorio(territorio) {
    setEditingTerritorioId(String(territorio.id));
    setSelectedTerritorioId(String(territorio.id));
    setTerritorioForm({
      nome: territorio.nome || '',
      categoria: territorio.categoria || 'bairro',
      status: territorio.status || 'ativo',
      origem: territorio.origem || 'manual',
      ordem_exibicao: territorio.ordem_exibicao ?? '',
      homologado: Boolean(territorio.homologado),
      observacoes: territorio.observacoes || '',
    });
    setMessage('');
    setError('');
  }

  function startEditAlias(alias) {
    setEditingAliasId(String(alias.id));
    setAliasForm({
      alias: alias.alias || '',
      status: alias.status || 'ativo',
      observacoes: alias.observacoes || '',
    });
    setMessage('');
    setError('');
  }

  function handleTerritorioFormChange(event) {
    const { name, value, type, checked } = event.target;
    setTerritorioForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleAliasFormChange(event) {
    const { name, value } = event.target;
    setAliasForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleReviewDraftChange(key, field, value) {
    setReviewDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }));
  }

  async function handleSubmitTerritorio(event) {
    event.preventDefault();
    if (!canManage) return;

    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      const payload = {
        ...territorioForm,
        ordem_exibicao: territorioForm.ordem_exibicao === '' ? null : Number(territorioForm.ordem_exibicao),
      };
      const response = editingTerritorioId
        ? await updateTerritorio(editingTerritorioId, payload)
        : await createTerritorio(payload);
      setMessage(editingTerritorioId ? 'Território atualizado.' : 'Território criado.');
      setSelectedTerritorioId(String(response.data?.id || selectedTerritorioId || ''));
      resetTerritorioForm();
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar o território.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleTerritorioStatus(territorio) {
    if (!canManage) return;

    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      const nextStatus = territorio.status === 'ativo' ? 'inativo' : 'ativo';
      await updateTerritorioStatus(territorio.id, nextStatus);
      setMessage(nextStatus === 'ativo' ? 'Território ativado.' : 'Território inativado.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível alterar o status do território.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitAlias(event) {
    event.preventDefault();
    if (!canManageAlias || !selectedTerritorio) return;

    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      if (editingAliasId) {
        await updateTerritorioAlias(editingAliasId, aliasForm);
        setMessage('Alias atualizado.');
      } else {
        await createTerritorioAlias(selectedTerritorio.id, aliasForm);
        setMessage('Alias criado.');
      }
      setAliasForm(INITIAL_ALIAS_FORM);
      setEditingAliasId('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar o alias.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleAliasStatus(alias) {
    if (!canManageAlias) return;

    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      const nextStatus = alias.status === 'ativo' ? 'inativo' : 'ativo';
      await updateTerritorioAliasStatus(alias.id, nextStatus);
      setMessage(nextStatus === 'ativo' ? 'Alias ativado.' : 'Alias inativado.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível alterar o status do alias.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReview(item, decisao) {
    if (!canReview) return;
    const key = `${item.modulo}-${item.registro_id}`;
    const draft = reviewDrafts[key] || {};

    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      await reviewTerritorioLegado({
        modulo: item.modulo,
        registro_id: item.registro_id,
        decisao,
        territorio_id: decisao === 'classificado' ? Number(draft.territorio_id) : null,
        alias_id: draft.alias_id ? Number(draft.alias_id) : null,
        observacao: draft.observacao || '',
      });
      setMessage(decisao === 'classificado' ? 'Registro legado classificado.' : 'Decisão registrada sem classificação automática.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível revisar o legado territorial.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <p>Carregando gestão territorial...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Gestão territorial</h2>
            <p style={styles.subtitle}>Catálogo controlado, aliases homologados e revisão assistida do legado textual.</p>
          </div>
          <span style={styles.countBadge}>{territorios.length} territórios</span>
        </div>

        {error ? <div style={styles.alertError}>{error}</div> : null}
        {message ? <div style={styles.alertSuccess}>{message}</div> : null}

        <div style={styles.grid4}>
          <Metric title="Territórios ativos" value={resumo?.territorios?.ativos ?? 0} subtitle={`${resumo?.territorios?.homologados ?? 0} homologados`} />
          <Metric title="Aliases ativos" value={resumo?.aliases?.ativos ?? 0} subtitle={`${resumo?.aliases?.inativos ?? 0} inativos`} />
          <Metric title="Legado pendente" value={resumo?.revisoes?.pendentes_legado ?? 0} subtitle={`${resumo?.revisoes?.classificados ?? 0} revisoes classificadas`} />
          <Metric title="Normalizacao" value={`${resumo?.progresso_normalizacao_percentual ?? 0}%`} subtitle="Registros com território controlado" />
        </div>
      </section>

      <div style={styles.layout}>
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Catálogo</h3>

          {canManage ? (
            <form style={styles.form} onSubmit={handleSubmitTerritorio}>
              <Input label="Nome oficial" name="nome" value={territorioForm.nome} onChange={handleTerritorioFormChange} />
              <Select label="Categoria" name="categoria" value={territorioForm.categoria} onChange={handleTerritorioFormChange}>
                <option value="bairro">Bairro</option>
                <option value="localidade">Localidade</option>
                <option value="distrito">Distrito</option>
                <option value="rural">Rural</option>
                <option value="outro">Outro</option>
              </Select>
              <Select label="Status" name="status" value={territorioForm.status} onChange={handleTerritorioFormChange}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
              <Select label="Origem" name="origem" value={territorioForm.origem} onChange={handleTerritorioFormChange}>
                <option value="manual">Manual</option>
                <option value="oficial">Oficial</option>
                <option value="legado_importado">Legado importado</option>
              </Select>
              <Input label="Ordem de exibicao" name="ordem_exibicao" value={territorioForm.ordem_exibicao} onChange={handleTerritorioFormChange} type="number" />
              <label style={styles.checkboxField}>
                <input type="checkbox" name="homologado" checked={territorioForm.homologado} onChange={handleTerritorioFormChange} />
                <span>Homologado pela SMAD</span>
              </label>
              <label style={styles.fieldWide}>
                <span style={styles.label}>Observações</span>
                <textarea name="observacoes" value={territorioForm.observacoes} onChange={handleTerritorioFormChange} style={styles.textarea} rows={3} />
              </label>
              <div style={styles.actions}>
                <button type="submit" disabled={actionLoading} style={styles.primaryButton}>
                  {editingTerritorioId ? 'Salvar alterações' : 'Criar território'}
                </button>
                {editingTerritorioId ? (
                  <button type="button" onClick={resetTerritorioForm} style={styles.secondaryButton}>Cancelar ediao</button>
                ) : null}
              </div>
            </form>
          ) : (
            <p style={styles.subtitle}>Seu perfil pode visualizar o catálogo, mas não administrar territórios.</p>
          )}

          <div style={styles.list}>
            {territorios.map((territorio) => (
              <button
                key={territorio.id}
                type="button"
                onClick={() => setSelectedTerritorioId(String(territorio.id))}
                style={{
                  ...styles.listButton,
                  ...(String(territorio.id) === String(selectedTerritorioId) ? styles.listButtonActive : {}),
                }}
              >
                <strong>{territorioLabel(territorio)}</strong>
                <span>{territorio.status} | {territorio.homologado ? 'homologado' : 'não homologado'}</span>
                <span>{territorio.aliases_controlados?.length || 0} aliases controlados</span>
              </button>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.headerCompact}>
            <div>
              <h3 style={styles.sectionTitle}>Aliases controlados</h3>
              <p style={styles.subtitle}>{selectedTerritorio ? territorioLabel(selectedTerritorio) : 'Selecione um território'}</p>
            </div>
            {selectedTerritorio && canManage ? (
              <button type="button" onClick={() => startEditTerritorio(selectedTerritorio)} style={styles.secondaryButton}>
                Editar território
              </button>
            ) : null}
          </div>

          {selectedTerritorio && canManage ? (
            <button type="button" onClick={() => handleToggleTerritorioStatus(selectedTerritorio)} style={styles.secondaryButton}>
              {selectedTerritorio.status === 'ativo' ? 'Inativar território' : 'Ativar território'}
            </button>
          ) : null}

          {selectedTerritorio && canManageAlias ? (
            <form style={styles.formInline} onSubmit={handleSubmitAlias}>
              <Input label="Alias/sinonimo" name="alias" value={aliasForm.alias} onChange={handleAliasFormChange} />
              <Select label="Status" name="status" value={aliasForm.status} onChange={handleAliasFormChange}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
              <Input label="Observações" name="observacoes" value={aliasForm.observacoes} onChange={handleAliasFormChange} />
              <div style={styles.actions}>
                <button type="submit" disabled={actionLoading} style={styles.primaryButton}>
                  {editingAliasId ? 'Salvar alias' : 'Adicionar alias'}
                </button>
                {editingAliasId ? (
                  <button type="button" onClick={() => { setEditingAliasId(''); setAliasForm(INITIAL_ALIAS_FORM); }} style={styles.secondaryButton}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          <div style={styles.aliasList}>
            {(selectedTerritorio?.aliases_controlados || []).length === 0 ? (
              <p style={styles.subtitle}>Nenhum alias controlado para este território.</p>
            ) : (
              selectedTerritorio.aliases_controlados.map((alias) => (
                <article key={alias.id} style={styles.aliasCard}>
                  <div>
                    <strong>{alias.alias}</strong>
                    <p style={styles.meta}>{alias.status} | atualizado em {formatDate(alias.updated_at)}</p>
                  </div>
                  {canManageAlias ? (
                    <div style={styles.actionsRight}>
                      <button type="button" onClick={() => startEditAlias(alias)} style={styles.secondaryButton}>Editar</button>
                      <button type="button" onClick={() => handleToggleAliasStatus(alias)} style={styles.secondaryButton}>
                        {alias.status === 'ativo' ? 'Inativar' : 'Ativar'}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section style={styles.section}>
        <div style={styles.headerCompact}>
          <div>
            <h3 style={styles.sectionTitle}>Revisao assistida de legado</h3>
            <p style={styles.subtitle}>Classifique manualmente registros `legado_textual` apenas quando houver correspondência segura.</p>
          </div>
          <Select label="Módulo" name="reviewMódulo" value={reviewModulo} onChange={(event) => setReviewModulo(event.target.value)}>
            <option value="">Todos</option>
            {MODULOS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        {!canReview ? (
          <p style={styles.subtitle}>Seu perfil não possui permissao para revisar legado territorial.</p>
        ) : legado.length === 0 ? (
          <p style={styles.subtitle}>Nenhum legado textual pendente encontrado para o filtro atual.</p>
        ) : (
          <div style={styles.reviewList}>
            {legado.map((item) => {
              const key = `${item.modulo}-${item.registro_id}`;
              const draft = reviewDrafts[key] || {};
              const selected = territoriosAtivos.find((territorio) => String(territorio.id) === String(draft.territorio_id));
              const aliases = selected?.aliases_controlados?.filter((alias) => alias.status === 'ativo') || [];

              return (
                <article key={key} style={styles.reviewCard}>
                  <div>
                    <strong>{item.modulo} #{item.registro_id} - {item.titulo || '-'}</strong>
                    <p style={styles.subtitle}>Valor legado: {item.valor_legado || 'Sem valor textual direto'}</p>
                    <p style={styles.meta}>Ultima revisao: {formatDate(item.ultima_revisao_em)}</p>
                  </div>

                  <div style={styles.reviewControls}>
                    <Select
                      label="Território controlado"
                      name="territorio_id"
                      value={draft.territorio_id || ''}
                      onChange={(event) => handleReviewDraftChange(key, 'territorio_id', event.target.value)}
                    >
                      <option value="">Selecionar território</option>
                      {territoriosAtivos.map((territorio) => (
                        <option key={territorio.id} value={territorio.id}>{territorioLabel(territorio)}</option>
                      ))}
                    </Select>
                    <Select
                      label="Alias usado"
                      name="alias_id"
                      value={draft.alias_id || ''}
                      onChange={(event) => handleReviewDraftChange(key, 'alias_id', event.target.value)}
                    >
                      <option value="">Sem alias associado</option>
                      {aliases.map((alias) => (
                        <option key={alias.id} value={alias.id}>{alias.alias}</option>
                      ))}
                    </Select>
                    <Input
                      label="Observação"
                      name="observacao"
                      value={draft.observacao || ''}
                      onChange={(event) => handleReviewDraftChange(key, 'observacao', event.target.value)}
                    />
                    <div style={styles.actions}>
                      <button
                        type="button"
                        disabled={actionLoading || !draft.territorio_id}
                        onClick={() => handleReview(item, 'classificado')}
                        style={styles.primaryButton}
                      >
                        Classificar
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleReview(item, 'mantido_legado')}
                        style={styles.secondaryButton}
                      >
                        Manter legado
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Qualidade territorial por módulo</h3>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Módulo</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Catálogo</th>
                <th style={styles.th}>Legado</th>
                <th style={styles.th}>Não informado</th>
                <th style={styles.th}>% catálogo</th>
              </tr>
            </thead>
            <tbody>
              {(resumo?.qualidade || []).map((row) => (
                <tr key={row.modulo}>
                  <td style={styles.td}>{row.modulo}</td>
                  <td style={styles.td}>{row.total}</td>
                  <td style={styles.td}>{row.controlado}</td>
                  <td style={styles.td}>{row.legado_textual}</td>
                  <td style={styles.td}>{row.nao_informado}</td>
                  <td style={styles.td}>{row.percentual_controlado}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input {...props} style={styles.input} />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select {...props} style={styles.input}>{children}</select>
    </label>
  );
}

function Metric({ title, value, subtitle }) {
  return (
    <article style={styles.metricCard}>
      <span style={styles.metricTitle}>{title}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricSubtitle}>{subtitle}</span>
    </article>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' },
  headerCompact: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-end', marginBottom: '18px', flexWrap: 'wrap' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  sectionTitle: { margin: 0, marginBottom: '8px', fontSize: '18px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '16px' },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(min(420px, 100%), 1fr) minmax(min(460px, 100%), 1fr)', gap: '24px', alignItems: 'start' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '12px', marginBottom: '18px' },
  formInline: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', marginTop: '16px', marginBottom: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldWide: { display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' },
  checkboxField: { display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '14px', fontWeight: 700, paddingTop: '25px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { minHeight: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff' },
  textarea: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', fontSize: '14px', resize: 'vertical' },
  countBadge: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px', color: '#374151', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' },
  metricCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'grid', gap: '8px' },
  metricTitle: { fontSize: '13px', color: '#6b7280', fontWeight: 700 },
  metricValue: { fontSize: '26px', color: '#111827', lineHeight: 1 },
  metricSubtitle: { fontSize: '13px', color: '#4b5563' },
  list: { display: 'grid', gap: '10px', maxHeight: '540px', overflowY: 'auto' },
  listButton: { textAlign: 'left', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', padding: '12px', cursor: 'pointer', display: 'grid', gap: '6px', color: '#334155' },
  listButtonActive: { border: '1px solid #1f6f43', background: '#f0fdf4' },
  aliasList: { display: 'grid', gap: '10px', marginTop: '16px' },
  aliasCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  reviewList: { display: 'grid', gap: '12px' },
  reviewCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'grid', gridTemplateColumns: 'minmax(min(260px, 100%), 0.9fr) minmax(min(420px, 100%), 1.5fr)', gap: '16px' },
  reviewControls: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', alignItems: 'end' },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' },
  actionsRight: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  primaryButton: { minHeight: '42px', border: '1px solid #1f6f43', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  secondaryButton: { minHeight: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginBottom: '14px' },
  alertSuccess: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '12px', fontSize: '14px', marginBottom: '14px' },
  meta: { margin: '4px 0 0', color: '#64748b', fontSize: '12px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid #e5e7eb', fontSize: '14px', whiteSpace: 'nowrap' },
  td: { padding: '12px', borderBottom: '1px solid #f3f4f6', fontSize: '14px' },
};
