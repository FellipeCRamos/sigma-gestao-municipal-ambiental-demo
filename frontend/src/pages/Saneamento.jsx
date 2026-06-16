import { useEffect, useMemo, useState } from 'react';
import {
  getSaneamentoCasos,
  mergeTutorSaneamentoCaso,
  reviewSaneamentoCaso,
} from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const INITIAL_FILTERS = {
  status: '',
  entidade: '',
  tipo: '',
  criticidade: '',
};

const STATUS_LABELS = {
  pendente: 'Pendente',
  em_revisao: 'Em revisao',
  revisar_depois: 'Revisar depois',
  resolvido_sem_merge: 'Resolvido sem merge',
  aprovado_para_merge: 'Aprovado para merge',
  mesclado: 'Mesclado',
  falso_positivo: 'Falso positivo',
};

const TIPO_LABELS = {
  duplicidade_tutor: 'Duplicidade de tutor',
  duplicidade_animal: 'Duplicidade de animal',
  baixa_confiabilidade_tutor: 'Baixa confiabilidade de tutor',
  baixa_confiabilidade_animal: 'Baixa confiabilidade de animal',
  conflito_forte_legado_tutor: 'Conflito forte legado de tutor',
  conflito_forte_legado_animal: 'Conflito forte legado de animal',
};

const CRITICIDADE_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Critica',
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

function normalizeMotivos(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function describeRecord(record, entidade) {
  if (!record) return 'Sem registro relacionado';

  if (entidade === 'animal') {
    return [
      record.nome,
      record.especie,
      record.microchip ? `microchip ${record.microchip}` : '',
      record.tutor_nome ? `tutor ${record.tutor_nome}` : '',
    ].filter(Boolean).join(' - ');
  }

  return [
    record.nome,
    record.cpf ? `Documento ${record.cpf}` : '',
    record.email || '',
    record.telefone ? `tel. ${record.telefone}` : '',
  ].filter(Boolean).join(' - ');
}

function getScoreLabel(record) {
  if (!record) return '-';
  return `${record.confiabilidade_nivel || 'baixo'} (${record.confiabilidade_score ?? 0})`;
}

export default function Saneamento({ usuarioInterno }) {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [reviewStatus, setReviewStatus] = useState('em_revisao');
  const [observacao, setObservacao] = useState('');
  const [principalId, setPrincipalId] = useState('');
  const [incorporadoId, setIncorporadoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const canReview = hasPermission(usuarioInterno, PERMISSIONS.QUALIDADE_REVIEW);
  const canMerge = hasPermission(usuarioInterno, PERMISSIONS.QUALIDADE_MERGE);

  async function loadCases() {
    try {
      setLoading(true);
      setError('');
      const response = await getSaneamentoCasos({
        status: filters.status,
        entidade: filters.entidade,
        tipo: filters.tipo,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setCases(data);
      setSelectedCaseId((current) => current || data[0]?.id || null);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar a fila de saneamento.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.entidade, filters.tipo]);

  const visibleCases = useMemo(() => {
    return cases.filter((item) => !filters.criticidade || item.criticidade === filters.criticidade);
  }, [cases, filters.criticidade]);

  const selectedCase = useMemo(() => {
    return visibleCases.find((item) => item.id === selectedCaseId) || visibleCases[0] || null;
  }, [selectedCaseId, visibleCases]);

  useEffect(() => {
    if (!selectedCase) return;
    setReviewStatus(selectedCase.status === 'pendente' ? 'em_revisao' : selectedCase.status);
    setObservacao(selectedCase.observacao || '');
    setPrincipalId(String(selectedCase.entidade_principal?.id || ''));
    setIncorporadoId(String(selectedCase.entidade_relacionada?.id || ''));
  }, [selectedCase]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setMessage('');
    setError('');
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
  }

  async function handleReview(status = reviewStatus) {
    if (!selectedCase || !canReview) return;

    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      const response = await reviewSaneamentoCaso(selectedCase.id, {
        status,
        decisao: status,
        observacao,
      });
      setMessage('Decisão registrada no caso de saneamento.');
      await loadCases();
      setSelectedCaseId(response.data?.id || selectedCase.id);
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a revisao.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMergeTutor() {
    if (!selectedCase || !canMerge) return;

    try {
      setActionLoading(true);
      setError('');
      setMessage('');
      const response = await mergeTutorSaneamentoCaso(selectedCase.id, {
        principal_id: Number(principalId),
        incorporado_id: Number(incorporadoId),
        observacao,
      });
      setMessage(`Merge de tutor concluido. Referencias reapontadas: ${JSON.stringify(response.data?.referencias_reapontadas || {})}`);
      await loadCases();
      setSelectedCaseId(response.data?.caso?.id || selectedCase.id);
    } catch (err) {
      setError(err.message || 'Não foi possível executar o merge de tutor.');
    } finally {
      setActionLoading(false);
    }
  }

  const mergeAvailable =
    selectedCase?.entidade === 'tutor' &&
    selectedCase?.entidade_relacionada?.id &&
    selectedCase?.status !== 'mesclado';

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Saneamento cadastral</h2>
            <p style={styles.subtitle}>Fila operacional de duplicidades, baixa confiabilidade e revisao assistida.</p>
          </div>
          <div style={styles.countBadge}>{visibleCases.length} casos</div>
        </div>

        <div style={styles.filters}>
          <FilterSelect name="status" label="Status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </FilterSelect>

          <FilterSelect name="entidade" label="Entidade" value={filters.entidade} onChange={handleFilterChange}>
            <option value="">Todas</option>
            <option value="tutor">Tutor</option>
            <option value="animal">Animal</option>
          </FilterSelect>

          <FilterSelect name="tipo" label="Tipo" value={filters.tipo} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </FilterSelect>

          <FilterSelect name="criticidade" label="Criticidade" value={filters.criticidade} onChange={handleFilterChange}>
            <option value="">Todas</option>
            {Object.entries(CRITICIDADE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </FilterSelect>

          <button type="button" onClick={clearFilters} style={styles.secondaryButton}>Limpar filtros</button>
        </div>

        {loading ? <p>Carregando fila...</p> : null}
        {error ? <div style={styles.alertError}>{error}</div> : null}
        {message ? <div style={styles.alertSuccess}>{message}</div> : null}

        {!loading && visibleCases.length === 0 ? (
          <p>Nenhum caso encontrado para os filtros atuais.</p>
        ) : null}
      </section>

      {visibleCases.length > 0 ? (
        <div style={styles.layout}>
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Fila</h3>
            <div style={styles.caseList}>
              {visibleCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedCaseId(item.id)}
                  style={{
                    ...styles.caseButton,
                    ...(selectedCase?.id === item.id ? styles.caseButtonActive : {}),
                  }}
                >
                  <strong>#{item.id} - {TIPO_LABELS[item.tipo] || item.tipo}</strong>
                  <span>{STATUS_LABELS[item.status] || item.status} | {CRITICIDADE_LABELS[item.criticidade] || item.criticidade}</span>
                  <span>{describeRecord(item.entidade_principal, item.entidade)}</span>
                </button>
              ))}
            </div>
          </section>

          {selectedCase ? (
            <section style={styles.section}>
              <div style={styles.header}>
                <div>
                  <h3 style={styles.sectionTitle}>Caso #{selectedCase.id}</h3>
                  <p style={styles.subtitle}>
                    {TIPO_LABELS[selectedCase.tipo] || selectedCase.tipo} | {STATUS_LABELS[selectedCase.status] || selectedCase.status}
                  </p>
                </div>
                <span style={styles.riskBadge}>{CRITICIDADE_LABELS[selectedCase.criticidade] || selectedCase.criticidade}</span>
              </div>

              <div style={styles.compareGrid}>
                <RecordCard title="Registro principal" record={selectedCase.entidade_principal} entidade={selectedCase.entidade} />
                <RecordCard title="Registro relacionado" record={selectedCase.entidade_relacionada} entidade={selectedCase.entidade} />
              </div>

              <div style={styles.detailBlock}>
                <h4 style={styles.smallTitle}>Motivos</h4>
                {normalizeMotivos(selectedCase.motivos).length === 0 ? (
                  <p style={styles.subtitle}>Sem motivo estruturado registrado.</p>
                ) : (
                  <ul style={styles.list}>
                    {normalizeMotivos(selectedCase.motivos).map((motivo, index) => (
                      <li key={`${selectedCase.id}-motivo-${index}`}>
                        {typeof motivo === 'string' ? motivo : motivo.mensagem || motivo.tipo || JSON.stringify(motivo)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={styles.detailBlock}>
                <h4 style={styles.smallTitle}>Decisão administrativa</h4>
                <div style={styles.reviewGrid}>
                  <FilterSelect name="reviewStatus" label="Status" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
                    <option value="em_revisao">Em revisao</option>
                    <option value="revisar_depois">Revisar depois</option>
                    <option value="resolvido_sem_merge">Resolvido sem merge</option>
                    <option value="falso_positivo">Falso positivo</option>
                    {selectedCase.entidade === 'tutor' ? <option value="aprovado_para_merge">Aprovado para merge</option> : null}
                  </FilterSelect>

                  <label style={styles.fieldWide}>
                    <span style={styles.label}>Observação</span>
                    <textarea
                      value={observacao}
                      onChange={(event) => setObservacao(event.target.value)}
                      rows={3}
                      style={styles.textarea}
                      placeholder="Justificativa ou observação administrativa"
                    />
                  </label>
                </div>

                <div style={styles.actions}>
                  <button type="button" disabled={!canReview || actionLoading} onClick={() => handleReview()} style={styles.actionButton}>
                    Registrar decisão
                  </button>
                  <button type="button" disabled={!canReview || actionLoading} onClick={() => handleReview('falso_positivo')} style={styles.secondaryButton}>
                    Marcar falso positivo
                  </button>
                  <button type="button" disabled={!canReview || actionLoading} onClick={() => handleReview('resolvido_sem_merge')} style={styles.secondaryButton}>
                    Manter separado
                  </button>
                </div>
              </div>

              {mergeAvailable ? (
                <div style={styles.detailBlock}>
                  <h4 style={styles.smallTitle}>Merge transacional de tutor</h4>
                  <p style={styles.subtitle}>Disponível apenas para tutor. O tutor incorporado sera marcado como mesclado e não sera apagado.</p>
                  <div style={styles.reviewGrid}>
                    <FilterSelect name="principalId" label="Tutor principal" value={principalId} onChange={(event) => setPrincipalId(event.target.value)}>
                      <option value={selectedCase.entidade_principal?.id || ''}>{describeRecord(selectedCase.entidade_principal, 'tutor')}</option>
                      <option value={selectedCase.entidade_relacionada?.id || ''}>{describeRecord(selectedCase.entidade_relacionada, 'tutor')}</option>
                    </FilterSelect>
                    <FilterSelect name="incorporadoId" label="Tutor incorporado" value={incorporadoId} onChange={(event) => setIncorporadoId(event.target.value)}>
                      <option value={selectedCase.entidade_relacionada?.id || ''}>{describeRecord(selectedCase.entidade_relacionada, 'tutor')}</option>
                      <option value={selectedCase.entidade_principal?.id || ''}>{describeRecord(selectedCase.entidade_principal, 'tutor')}</option>
                    </FilterSelect>
                  </div>

                  <div style={styles.actions}>
                    <button type="button" disabled={!canMerge || actionLoading} onClick={handleMergeTutor} style={styles.dangerButton}>
                      Executar merge de tutor
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.alertInfo}>
                  Merge de animal não esta habilitado nesta subfase. Casos de animal ficam apenas para revisao e classificação.
                </div>
              )}

              <div style={styles.meta}>
                Criado em {formatDate(selectedCase.created_at)} | Atualizado em {formatDate(selectedCase.updated_at)}
                {selectedCase.responsavel_nome ? ` | Responsavel: ${selectedCase.responsavel_nome}` : ''}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({ name, label, value, onChange, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select name={name} value={value} onChange={onChange} style={styles.input}>
        {children}
      </select>
    </label>
  );
}

function RecordCard({ title, record, entidade }) {
  return (
    <article style={styles.recordCard}>
      <h4 style={styles.smallTitle}>{title}</h4>
      {!record ? (
        <p style={styles.subtitle}>Sem registro relacionado.</p>
      ) : (
        <div style={styles.recordBody}>
          <strong>{describeRecord(record, entidade)}</strong>
          <span>ID: {record.id || '-'}</span>
          <span>Score: {getScoreLabel(record)}</span>
          <span>Status cadastral: {record.status_cadastral || 'ativo'}</span>
          {Array.isArray(record.confiabilidade_pendencias) && record.confiabilidade_pendencias.length > 0 ? (
            <span>Pendências: {record.confiabilidade_pendencias.slice(0, 3).join(' | ')}</span>
          ) : null}
        </div>
      )}
    </article>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  sectionTitle: { margin: 0, marginBottom: '12px', fontSize: '18px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', alignItems: 'end' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldWide: { display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { height: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff' },
  textarea: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', fontSize: '14px', resize: 'vertical' },
  countBadge: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px', color: '#374151', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' },
  riskBadge: { border: '1px solid #fdba74', borderRadius: '8px', background: '#fff7ed', color: '#9a3412', padding: '8px 10px', fontSize: '13px', fontWeight: 700 },
  layout: { display: 'grid', gridTemplateColumns: 'minmax(min(340px, 100%), 0.9fr) minmax(min(520px, 100%), 1.6fr)', gap: '24px', alignItems: 'start' },
  caseList: { display: 'grid', gap: '10px', maxHeight: '680px', overflowY: 'auto' },
  caseButton: { textAlign: 'left', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff', padding: '12px', cursor: 'pointer', display: 'grid', gap: '6px', color: '#334155' },
  caseButtonActive: { border: '1px solid #1f6f43', background: '#f0fdf4' },
  compareGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '16px', marginBottom: '18px' },
  recordCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', background: '#f9fafb' },
  recordBody: { display: 'grid', gap: '8px', color: '#374151', fontSize: '14px' },
  detailBlock: { borderTop: '1px solid #e5e7eb', paddingTop: '18px', marginTop: '18px' },
  smallTitle: { margin: 0, marginBottom: '10px', fontSize: '15px', color: '#111827' },
  list: { margin: '0 0 0 18px', padding: 0, color: '#374151', fontSize: '14px', lineHeight: 1.6 },
  reviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px', marginTop: '12px' },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' },
  actionButton: { height: '42px', border: '1px solid #1f6f43', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  secondaryButton: { height: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  dangerButton: { height: '42px', border: '1px solid #b91c1c', borderRadius: '8px', background: '#b91c1c', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginTop: '14px' },
  alertSuccess: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '12px', fontSize: '14px', marginTop: '14px' },
  alertInfo: { border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', color: '#1d4ed8', padding: '12px', fontSize: '14px', marginTop: '18px' },
  meta: { marginTop: '18px', color: '#64748b', fontSize: '12px' },
};
