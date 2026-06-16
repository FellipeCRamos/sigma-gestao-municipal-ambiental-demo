import { useEffect, useMemo, useState } from 'react';
import {
  cancelAnimalVacinacao,
  createAnimalVacinacao,
  downloadDocumentoCampanhaInterno,
  getAnimalCarteiraVacinal,
  updateAnimalVacinacao,
} from '../services/api';

const INITIAL_FORM = {
  vacina_catalogo_id: '',
  vacina_nome: '',
  dose: '',
  data_aplicacao: '',
  proxima_dose_em: '',
  lote: '',
  fabricante: '',
  origem_registro: 'orgao_ambiental',
  status_registro: 'registrado',
  campanha_id: '',
  campanha_inscriao_id: '',
  documento_id: '',
  observacoes: '',
};

const ORIGEM_LABELS = {
  orgao_ambiental: 'SMAD',
  tutor_declarado: 'Declarada pelo tutor',
  campanha: 'Campanha',
  legado_jsonb: 'Legado importado',
};

const STATUS_LABELS = {
  registrado: 'Registrado',
  comprovado: 'Comprovado',
  pendente_comprovacao: 'Pendente de comprovação',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

const SITUACAO_LABELS = {
  registrada: 'Registro ativo',
  comprovada: 'Comprovada',
  pendente_comprovacao: 'Pendente de comprovação',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
  sem_data_aplicacao: 'Sem data de aplicação',
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getSituacaoTone(situacao) {
  if (situacao === 'vencida' || situacao === 'pendente_comprovacao') return styles.badgeWarning;
  if (situacao === 'cancelada') return styles.badgeNeutral;
  return styles.badgeOk;
}

export default function CarteiraVacinal({ animal, canManage = false, onChanged }) {
  const [carteira, setCarteira] = useState(null);
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, data_aplicacao: getToday() }));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const catalogo = useMemo(() => carteira?.catalogo || [], [carteira]);
  const registros = useMemo(() => carteira?.registros || [], [carteira]);
  const documentos = useMemo(() => carteira?.documentos_disponiveis || [], [carteira]);
  const resumo = carteira?.resumo || {};

  const selectedCatalogItem = useMemo(() => {
    return catalogo.find((item) => String(item.id) === String(form.vacina_catalogo_id));
  }, [catalogo, form.vacina_catalogo_id]);

  async function loadCarteira() {
    if (!animal?.id) return;

    try {
      setLoading(true);
      setError('');
      const response = await getAnimalCarteiraVacinal(animal.id);
      setCarteira(response.data);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar a carteira vacinal.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setCarteira(null);
    setForm({ ...INITIAL_FORM, data_aplicacao: getToday() });
    setEditingId(null);
    setMessage('');
    setError('');
    loadCarteira();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animal?.id]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === 'documento_id') {
        const documento = documentos.find((item) => String(item.id) === String(value));

        return {
          ...prev,
          documento_id: value,
          campanha_id: documento?.campanha_id || prev.campanha_id,
          campanha_inscriao_id: documento?.inscriao_id || prev.campanha_inscriao_id,
        };
      }

      return { ...prev, [name]: value };
    });
    setError('');
    setMessage('');
  }

  function buildPayload() {
    return {
      ...form,
      vacina_catalogo_id: form.vacina_catalogo_id ? Number(form.vacina_catalogo_id) : null,
      vacina_nome: form.vacina_nome.trim() || selectedCatalogItem?.nome_comercial || null,
      campanha_id: form.campanha_id ? Number(form.campanha_id) : null,
      campanha_inscriao_id: form.campanha_inscriao_id ? Number(form.campanha_inscriao_id) : null,
      documento_id: form.documento_id ? Number(form.documento_id) : null,
    };
  }

  function resetForm() {
    setForm({ ...INITIAL_FORM, data_aplicacao: getToday() });
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!animal?.id) return;

    if (!form.vacina_catalogo_id && !form.vacina_nome.trim()) {
      setError('Selecione uma vacina do catálogo ou informe o nome.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const payload = buildPayload();

      if (editingId) {
        await updateAnimalVacinacao(animal.id, editingId, payload);
        setMessage('Registro vacinal atualizado.');
      } else {
        await createAnimalVacinacao(animal.id, payload);
        setMessage('Registro vacinal adicionado.');
      }

      resetForm();
      await loadCarteira();
      if (typeof onChanged === 'function') await onChanged();
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a vacinação.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(vacinacaoId) {
    if (!animal?.id) return;

    try {
      setSaving(true);
      setError('');
      await cancelAnimalVacinacao(animal.id, vacinacaoId);
      setMessage('Registro vacinal cancelado.');
      await loadCarteira();
      if (typeof onChanged === 'function') await onChanged();
    } catch (err) {
      setError(err.message || 'Não foi possível cancelar o registro.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(registro) {
    const origemPermitida = ['orgao_ambiental', 'campanha', 'tutor_declarado'].includes(registro.origem_registro)
      ? registro.origem_registro
      : 'orgao_ambiental';
    const statusPermitido = ['registrado', 'comprovado', 'pendente_comprovacao', 'vencido'].includes(registro.status_registro)
      ? registro.status_registro
      : 'registrado';

    setEditingId(registro.id);
    setForm({
      vacina_catalogo_id: registro.vacina_catalogo_id || '',
      vacina_nome: registro.vacina_catalogo_id ? '' : registro.vacina_nome || '',
      dose: registro.dose || '',
      data_aplicacao: registro.data_aplicacao ? String(registro.data_aplicacao).slice(0, 10) : '',
      proxima_dose_em: registro.proxima_dose_em ? String(registro.proxima_dose_em).slice(0, 10) : '',
      lote: registro.lote || '',
      fabricante: registro.fabricante || '',
      origem_registro: origemPermitida,
      status_registro: statusPermitido,
      campanha_id: registro.campanha_id || '',
      campanha_inscriao_id: registro.campanha_inscriao_id || '',
      documento_id: registro.documento_id || '',
      observacoes: registro.observacoes || '',
    });
    setMessage('');
    setError('');
  }

  function handleCancelEdit() {
    resetForm();
    setMessage('');
    setError('');
  }

  async function handleDownloadDocumento(registro) {
    if (!registro.documento_id) return;

    try {
      setError('');
      const blob = await downloadDocumentoCampanhaInterno(registro.documento_id);
      downloadBlob(blob, registro.documento_nome_original || `comprovante-${registro.documento_id}`);
    } catch (err) {
      setError(err.message || 'Não foi possível baixar o comprovante.');
    }
  }

  if (!animal?.id) return null;

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Carteira vacinal</h2>
          <p style={styles.subtitle}>
            Registros estruturados de vacinação. Declarações sem comprovação ficam identificadas.
          </p>
        </div>
        <div style={styles.countBadge}>{resumo.registros_ativos || 0} registros ativos</div>
      </div>

      {loading ? <p>Carregando carteira vacinal...</p> : null}
      {error ? <div style={styles.alertError}>{error}</div> : null}
      {message ? <div style={styles.alertSuccess}>{message}</div> : null}

      {carteira ? (
        <div style={styles.summaryGrid}>
          <SummaryItem label="Situação" value={resumo.situacao || 'sem_registro_estruturado'} />
          <SummaryItem label="Comprovados" value={resumo.comprovados || 0} />
          <SummaryItem label="Pendentes" value={resumo.pendentes_comprovacao || 0} />
          <SummaryItem label="Vencidos" value={resumo.vencidos || 0} />
        </div>
      ) : null}

      {resumo.observacao ? <p style={styles.hint}>{resumo.observacao}</p> : null}

      {resumo.essenciais_pendentes?.length ? (
        <div style={styles.alertWarning}>
          <strong>Sem registro estruturado para vacinas essenciais:</strong>
          <ul style={styles.list}>
            {resumo.essenciais_pendentes.map((item) => (
              <li key={item.codigo}>{item.nome}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Vacina do catálogo</span>
            <select name="vacina_catalogo_id" value={form.vacina_catalogo_id} onChange={handleChange} style={styles.input}>
              <option value="">Selecionar pelo catálogo</option>
              {catalogo.map((item) => (
                <option key={item.id} value={item.id}>
                  {(item.nome_popular || item.nome_comercial || item.nome_tecnico)} - {item.especie}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Nome livre</span>
            <input name="vacina_nome" value={form.vacina_nome} onChange={handleChange} style={styles.input} placeholder="Use se não estiver no catálogo" />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Data de aplicação</span>
            <input name="data_aplicacao" type="date" value={form.data_aplicacao} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Próxima dose</span>
            <input name="proxima_dose_em" type="date" value={form.proxima_dose_em} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Origem</span>
            <select name="origem_registro" value={form.origem_registro} onChange={handleChange} style={styles.input}>
              <option value="orgao_ambiental">Lancada pela SMAD</option>
              <option value="campanha">Aplicada em campanha</option>
              <option value="tutor_declarado">Declarada pelo tutor</option>
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Status</span>
            <select name="status_registro" value={form.status_registro} onChange={handleChange} style={styles.input}>
              <option value="registrado">Registrado</option>
              <option value="comprovado">Comprovado</option>
              <option value="pendente_comprovacao">Pendente de comprovação</option>
              <option value="vencido">Vencido</option>
            </select>
          </label>

          {documentos.length > 0 ? (
            <label style={styles.field}>
              <span style={styles.label}>Comprovante vinculado</span>
              <select name="documento_id" value={form.documento_id} onChange={handleChange} style={styles.input}>
                <option value="">Sem comprovante vinculado</option>
                {documentos.map((documento) => (
                  <option key={documento.id} value={documento.id}>
                    {documento.nome_original} - {documento.protocolo}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label style={styles.field}>
            <span style={styles.label}>Dose</span>
            <input name="dose" value={form.dose} onChange={handleChange} style={styles.input} placeholder="Ex.: reforco anual" />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Lote</span>
            <input name="lote" value={form.lote} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Fabricante</span>
            <input name="fabricante" value={form.fabricante} onChange={handleChange} style={styles.input} />
          </label>

          <label style={styles.fieldWide}>
            <span style={styles.label}>Observações</span>
            <textarea name="observacoes" value={form.observacoes} onChange={handleChange} style={styles.textarea} rows={3} />
          </label>

          <div style={styles.formActions}>
            <button type="submit" disabled={saving} style={styles.actionButton}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Registrar vacinação'}
            </button>
            {editingId ? (
              <button type="button" disabled={saving} onClick={handleCancelEdit} style={styles.secondaryButton}>
                Cancelar ediao
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p style={styles.hint}>Seu perfil permite visualizar a carteira, mas não registrar vacinação.</p>
      )}

      {registros.length === 0 ? (
        <p>Nenhum registro estruturado de vacinação.</p>
      ) : (
        <div style={styles.records}>
          {registros.map((registro) => (
            <article key={registro.id} style={styles.record}>
              <div style={styles.recordHeader}>
                <div>
                  <strong>{registro.vacina_nome_popular || registro.vacina_nome}</strong>
                  <p style={styles.recordText}>{registro.vacina_nome}</p>
                </div>
                <span style={{ ...styles.badge, ...getSituacaoTone(registro.situacao_calculada) }}>
                  {SITUACAO_LABELS[registro.situacao_calculada] || registro.situacao_calculada}
                </span>
              </div>
              <div style={styles.recordMeta}>
                <span>Aplicação: {formatDate(registro.data_aplicacao)}</span>
                <span>Próxima dose: {formatDate(registro.proxima_dose_em)}</span>
                <span>Origem: {ORIGEM_LABELS[registro.origem_registro] || registro.origem_registro}</span>
                <span>Status: {STATUS_LABELS[registro.status_registro] || registro.status_registro}</span>
                {registro.lote ? <span>Lote: {registro.lote}</span> : null}
                {registro.fabricante ? <span>Fabricante: {registro.fabricante}</span> : null}
                {registro.campanha_nome ? <span>Campanha: {registro.campanha_nome}</span> : null}
                {registro.campanha_protocolo ? <span>Protocolo: {registro.campanha_protocolo}</span> : null}
                {registro.documento_nome_original ? <span>Comprovante: {registro.documento_nome_original}</span> : null}
              </div>
              {registro.observacoes ? <p style={styles.recordText}>{registro.observacoes}</p> : null}
              {canManage && registro.status_registro !== 'cancelado' ? (
                <div style={styles.recordActions}>
                  <button type="button" onClick={() => handleEdit(registro)} disabled={saving} style={styles.secondaryButton}>
                    Editar registro
                  </button>
                  {registro.documento_id ? (
                    <button type="button" onClick={() => handleDownloadDocumento(registro)} disabled={saving} style={styles.secondaryButton}>
                      Baixar comprovante
                    </button>
                  ) : null}
                  <button type="button" onClick={() => handleCancel(registro.id)} disabled={saving} style={styles.secondaryButtonDanger}>
                    Cancelar registro
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.label}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  section: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  hint: { margin: '10px 0', color: '#6b7280', fontSize: '13px', lineHeight: 1.5 },
  countBadge: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 700,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))',
    gap: '12px',
    marginBottom: '14px',
  },
  summaryItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '12px',
    display: 'grid',
    gap: '4px',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
    gap: '12px',
    alignItems: 'end',
    margin: '18px 0',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldWide: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    gridColumn: '1 / -1',
  },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: {
    height: '42px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '0 12px',
    fontSize: '14px',
  },
  textarea: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    resize: 'vertical',
  },
  actionButton: {
    height: '42px',
    border: '1px solid #1f6f43',
    borderRadius: '8px',
    background: '#1f6f43',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0 14px',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  secondaryButton: {
    justifySelf: 'start',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '8px 12px',
  },
  secondaryButtonDanger: {
    justifySelf: 'start',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#b91c1c',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '8px 12px',
  },
  records: { display: 'grid', gap: '12px' },
  record: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '14px',
    display: 'grid',
    gap: '10px',
  },
  recordHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  recordMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
    gap: '8px',
    color: '#4b5563',
    fontSize: '13px',
  },
  recordText: { margin: 0, color: '#4b5563', fontSize: '13px', lineHeight: 1.5 },
  recordActions: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  badge: {
    borderRadius: '8px',
    padding: '6px 8px',
    fontSize: '12px',
    fontWeight: 700,
  },
  badgeOk: { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' },
  badgeWarning: { background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' },
  badgeNeutral: { background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' },
  alertError: {
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '12px',
    fontSize: '14px',
    marginBottom: '12px',
  },
  alertSuccess: {
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    padding: '12px',
    fontSize: '14px',
    marginBottom: '12px',
  },
  alertWarning: {
    border: '1px solid #fdba74',
    borderRadius: '8px',
    background: '#fff7ed',
    color: '#9a3412',
    padding: '12px',
    fontSize: '14px',
    marginBottom: '12px',
  },
  list: { margin: '8px 0 0 18px', padding: 0 },
};
