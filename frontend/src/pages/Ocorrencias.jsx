import { useEffect, useMemo, useState } from 'react';
import { createOcorrenciaInterna, getOcorrencias, getTerritorios, updateOcorrenciaStatus } from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const INITIAL_FORM = {
  tipo: 'perda',
  titulo: '',
  descricao: '',
  territorio_id: '',
  bairro: '',
  endereco_referencia: '',
  contato_nome: '',
  contato_telefone: '',
  contato_email: '',
};

const TIPO_LABELS = {
  perda: 'Animal perdido',
  encontro: 'Animal encontrado',
  adocao: 'Adoção',
  obito: 'obito',
  zoonose: 'Zoonose',
  maus_tratos: 'Maus-tratos',
  outros: 'Outros',
};

const STATUS_LABELS = {
  aberta: 'Recebida',
  em_analise: 'Em análise',
  pendente_informacao: 'Pendente de informação',
  em_atendimento: 'Em atendimento',
  encaminhada: 'Encaminhada',
  resolvida: 'Concluída/resolvida',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada',
};

function getWorkflowOptions(item) {
  const workflowOptions = item.workflow?.opcoes_status;
  if (Array.isArray(workflowOptions) && workflowOptions.length > 0) {
    return workflowOptions;
  }

  return Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

export default function Ocorrencias({ usuarioInterno }) {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [filters, setFilters] = useState({ busca: '', status: '', tipo: '', territorio: '' });
  const [territorios, setTerritorios] = useState([]);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canCreate = hasPermission(usuarioInterno, PERMISSIONS.OCORRENCIAS_CREATE);
  const canUpdateStatus = hasPermission(usuarioInterno, PERMISSIONS.OCORRENCIAS_UPDATE_STATUS);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [response, territoriosResponse] = await Promise.all([
        getOcorrencias(),
        getTerritorios().catch(() => ({ data: [] })),
      ]);
      const data = Array.isArray(response.data) ? response.data : [];
      setOcorrencias(data);
      setTerritorios(Array.isArray(territoriosResponse.data) ? territoriosResponse.data : []);
      setStatusDrafts(
        data.reduce((acc, item) => {
          acc[item.id] = {
            status: item.status,
            resolucao: item.resolucao || '',
            pendencia_tipo: item.pendencia_tipo || '',
            pendencia_descricao: item.pendencia_descricao || '',
            desfecho: item.desfecho || '',
            motivo_desfecho: item.motivo_desfecho || '',
          };
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err.message || 'Não foi possível carregar ocorrências.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredOcorrencias = useMemo(() => {
    const term = normalizeText(filters.busca);

    return ocorrencias.filter((item) => {
      const haystack = [
        item.titulo,
        item.descricao,
        item.territorio_nome,
        item.bairro,
        item.endereco_referencia,
        item.contato_nome,
        item.contato_telefone,
        item.animal_nome,
      ].map(normalizeText).join(' ');

      return (
        (!term || haystack.includes(term)) &&
        (!filters.status || item.status === filters.status) &&
        (!filters.tipo || item.tipo === filters.tipo) &&
        (!filters.territorio || (item.territorio_nome || item.bairro || '') === filters.territorio)
      );
    });
  }, [filters, ocorrencias]);

  const territorioOptions = useMemo(() => {
    return territorios.map((territorio) => ({
      value: String(territorio.id),
      label: territorio.categoria ? `${territorio.nome} (${territorio.categoria})` : territorio.nome,
      nome: territorio.nome,
    }));
  }, [territorios]);

  const territorioFilterOptions = useMemo(() => {
    return Array.from(
      new Set(ocorrencias.map((item) => item.territorio_nome || item.bairro).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [ocorrencias]);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setMessage('');
    setError('');
  }

  function handleTerritorioChange(event) {
    const { value } = event.target;
    const selected = territorioOptions.find((option) => option.value === value);

    setForm((prev) => ({
      ...prev,
      territorio_id: value,
      bairro: selected?.nome || prev.bairro,
    }));
    setMessage('');
    setError('');
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleStatusDraftChange(id, field, value) {
    setStatusDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
    setMessage('');
    setError('');
  }

  async function handleCreate(event) {
    event.preventDefault();

    try {
      await createOcorrenciaInterna(form);
      setForm(INITIAL_FORM);
      setMessage('Ocorrência registrada.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível registrar ocorrência.');
    }
  }

  async function handleUpdateStatus(id) {
    const draft = statusDrafts[id];

    try {
      await updateOcorrenciaStatus(id, {
        status: draft.status,
        resolucao: draft.resolucao || null,
        pendencia_tipo: draft.pendencia_tipo || null,
        pendencia_descricao: draft.pendencia_descricao || null,
        desfecho: draft.desfecho || null,
        motivo_desfecho: draft.motivo_desfecho || null,
      });
      setMessage('Ocorrência atualizada.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar ocorrência.');
    }
  }

  return (
    <div style={styles.page}>
      {canCreate ? (
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Ocorrências territoriais</h2>
            <p style={styles.subtitle}>Perda, encontro, zoonoses, maus-tratos e acompanhamento em campo.</p>
          </div>
          <span style={styles.countBadge}>{filteredOcorrencias.length} registros</span>
        </div>

        <form onSubmit={handleCreate} style={styles.form}>
          <div style={styles.grid}>
            <Select label="Tipo" name="tipo" value={form.tipo} onChange={handleFormChange}>
              {Object.entries(TIPO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input label="Titulo" name="titulo" value={form.titulo} onChange={handleFormChange} required />
            <Select label="Bairro/localidade controlado" name="territorio_id" value={form.territorio_id} onChange={handleTerritorioChange}>
              <option value="">Sem classificação controlada</option>
              {territorioOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <Input label="Bairro textual / legado" name="bairro" value={form.bairro} onChange={handleFormChange} />
            <Input label="Contato" name="contato_nome" value={form.contato_nome} onChange={handleFormChange} />
            <Input label="Telefone" name="contato_telefone" value={form.contato_telefone} onChange={handleFormChange} />
            <Input label="Email" name="contato_email" type="email" value={form.contato_email} onChange={handleFormChange} />
          </div>
          <Textarea label="Endereço de referência" name="endereco_referencia" value={form.endereco_referencia} onChange={handleFormChange} />
          <Textarea label="Descrição" name="descricao" value={form.descricao} onChange={handleFormChange} required />
          <button type="submit" style={styles.primaryButton}>Registrar ocorrência</button>
        </form>
      </section>
      ) : (
        <section style={styles.section}>
          <p style={styles.subtitle}>Seu perfil permite consultar ocorrências, mas não registrar novas ocorrências internas.</p>
        </section>
      )}

      <section style={styles.section}>
        <div style={styles.filters}>
          <Input label="Busca" name="busca" type="search" value={filters.busca} onChange={handleFilterChange} />
          <Select label="Status" name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select label="Tipo" name="tipo" value={filters.tipo} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select label="Território" name="territorio" value={filters.territorio} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {territorioFilterOptions.map((territorio) => (
              <option key={territorio} value={territorio}>{territorio}</option>
            ))}
          </Select>
        </div>

        {message ? <div style={styles.alertSuccess}>{message}</div> : null}
        {error ? <div style={styles.alertError}>{error}</div> : null}
        {loading ? <p>Carregando ocorrências...</p> : null}

        {!loading && filteredOcorrencias.length === 0 ? (
          <p>Nenhuma ocorrência encontrada.</p>
        ) : (
          <div style={styles.cards}>
            {filteredOcorrencias.map((item) => {
              const draft = statusDrafts[item.id] || {};
              const statusOptions = getWorkflowOptions(item);

              return (
                <article key={item.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <strong>{item.titulo}</strong>
                      <p style={styles.subtitle}>
                        {TIPO_LABELS[item.tipo] || item.tipo} - {item.workflow?.status_label || STATUS_LABELS[item.status] || item.status}
                      </p>
                    </div>
                    <span style={styles.countBadge}>{item.territorio_nome || item.bairro || 'Bairro não informado'}</span>
                  </div>
                  <p>{item.descricao}</p>
                  <div style={styles.grid}>
                    <Info label="Endereço" value={item.endereco_referencia || '-'} />
                    <Info label="Contato" value={item.contato_nome || item.usuario_nome || '-'} />
                    <Info label="Telefone" value={item.contato_telefone || item.usuario_telefone || '-'} />
                    <Info label="Animal" value={item.animal_nome || '-'} />
                    <Info label="Fila" value={item.workflow?.fila || '-'} />
                    <Info label="Proximo passo" value={item.workflow?.proximo_passo || '-'} />
                  </div>
                  <div style={styles.grid}>
                    <Select label="Status" value={draft.status || item.status} onChange={(event) => handleStatusDraftChange(item.id, 'status', event.target.value)}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                    <Textarea label="Resolução" value={draft.resolucao || ''} onChange={(event) => handleStatusDraftChange(item.id, 'resolucao', event.target.value)} />
                  </div>
                  {(draft.status === 'pendente_informacao' || item.pendencia_aberta) ? (
                    <div style={styles.pendingBox}>
                      <Input
                        label="Tipo de pendência"
                        value={draft.pendencia_tipo || ''}
                        onChange={(event) => handleStatusDraftChange(item.id, 'pendencia_tipo', event.target.value)}
                      />
                      <Textarea
                        label="Descrição da pendência"
                        value={draft.pendencia_descricao || ''}
                        onChange={(event) => handleStatusDraftChange(item.id, 'pendencia_descricao', event.target.value)}
                      />
                    </div>
                  ) : null}
                  {['resolvida', 'cancelada', 'arquivada'].includes(draft.status) ? (
                    <div style={styles.grid}>
                      <Input
                        label="Desfecho"
                        value={draft.desfecho || ''}
                        onChange={(event) => handleStatusDraftChange(item.id, 'desfecho', event.target.value)}
                      />
                      <Input
                        label="Motivo do desfecho"
                        value={draft.motivo_desfecho || ''}
                        onChange={(event) => handleStatusDraftChange(item.id, 'motivo_desfecho', event.target.value)}
                      />
                    </div>
                  ) : null}
                  {canUpdateStatus ? (
                  <button type="button" onClick={() => handleUpdateStatus(item.id)} style={styles.secondaryButton}>
                    Atualizar status
                  </button>
                  ) : (
                    <p style={styles.subtitle}>Seu perfil não permite alterar status de ocorrências.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Input({ label, name, value, onChange, type = 'text', required = false }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} required={required} style={styles.input} />
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

function Textarea({ label, name, value, onChange, required = false }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <textarea name={name} value={value} onChange={onChange} required={required} style={styles.textarea} rows={3} />
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.info}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', display: 'grid', gap: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  form: { display: 'grid', gap: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '12px' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { height: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff' },
  textarea: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', fontSize: '14px', resize: 'vertical', background: '#ffffff' },
  primaryButton: { justifySelf: 'start', height: '42px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
  secondaryButton: { justifySelf: 'start', height: '40px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  countBadge: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px', color: '#374151', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' },
  cards: { display: 'grid', gap: '14px' },
  card: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'grid', gap: '14px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' },
  info: { display: 'grid', gap: '4px', color: '#4b5563', fontSize: '13px' },
  pendingBox: { border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', background: '#fffbeb', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px' },
  alertSuccess: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '12px', fontSize: '14px' },
};
