import { useEffect, useMemo, useState } from 'react';
import { createTutor, getTerritorios, getTutores } from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const INITIAL_FORM = {
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  bairro: '',
  territorio_id: '',
  endereco: '',
};

const INITIAL_FILTERS = {
  busca: '',
  cpf: '',
  contato: '',
  territorio: '',
  qualidade: '',
};

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function validateTutorForm(form) {
  const errors = {};

  if (!form.nome.trim() || form.nome.trim().length < 2) {
    errors.nome = 'Informe o nome do tutor.';
  }

  if (form.cpf.trim()) {
    const cpfDigits = form.cpf.replace(/\D/g, '');

    if (cpfDigits.length !== 11) {
      errors.cpf = 'Documento deve conter 11 digitos.';
    }
  }

  if (form.telefone.trim().length > 20) {
    errors.telefone = 'Telefone deve ter no máximo 20 caracteres.';
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Informe um email valido.';
  }

  if (form.endereco.trim().length > 500) {
    errors.endereco = 'Endereço deve ter no máximo 500 caracteres.';
  }

  if (form.bairro.trim().length > 160) {
    errors.bairro = 'Bairro deve ter no máximo 160 caracteres.';
  }

  return errors;
}

function buildTutorPayload(form) {
  return {
    nome: form.nome.trim(),
    cpf: form.cpf.trim() || null,
    telefone: form.telefone.trim() || null,
    email: form.email.trim() || null,
    bairro: form.bairro.trim() || null,
    territorio_id: form.territorio_id ? Number(form.territorio_id) : null,
    endereco: form.endereco.trim() || null,
  };
}

function tutorMatchesSearch(tutor, busca) {
  if (!busca) return true;

  const haystack = [
    tutor.nome,
    tutor.cpf,
    tutor.telefone,
    tutor.email,
    tutor.territorio_nome,
    tutor.bairro,
    tutor.endereco,
  ]
    .map(normalizeText)
    .join(' ');

  return haystack.includes(busca);
}

function hasDuplicateAlerts(record) {
  return Array.isArray(record?.duplicidade_alertas) && record.duplicidade_alertas.length > 0;
}

function matchesQualidade(tutor, qualidade) {
  if (!qualidade) return true;
  if (qualidade === 'baixa') return tutor.confiabilidade_nivel === 'baixo';
  if (qualidade === 'duplicidade') return hasDuplicateAlerts(tutor);
  if (qualidade === 'sem_contato') return !tutor.telefone && !tutor.email;
  return true;
}

function getQualityLabel(record) {
  const score = record?.confiabilidade_score ?? 0;
  const nivel = record?.confiabilidade_nivel || 'baixo';
  const labels = {
    baixo: 'Baixa',
    medio: 'Média',
    alto: 'Alta',
  };

  return `${labels[nivel] || nivel} (${score})`;
}

export default function Tutores({ usuarioInterno }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [tutores, setTutores] = useState([]);
  const [territorios, setTerritorios] = useState([]);
  const [territoriosError, setTerritoriosError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canCreate = hasPermission(usuarioInterno, PERMISSIONS.TUTORES_CREATE);

  async function loadTutores() {
    try {
      setLoading(true);
      setError('');

      const [res, territoriosResponse] = await Promise.all([
        getTutores(),
        getTerritorios().catch((territorioError) => {
          setTerritoriosError(territorioError.message || 'Não foi possível carregar territórios.');
          return { data: [] };
        }),
      ]);
      setTutores(Array.isArray(res.data) ? res.data : []);
      setTerritorios(Array.isArray(territoriosResponse.data) ? territoriosResponse.data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar tutores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTutores();
  }, []);

  const filteredTutores = useMemo(() => {
    const busca = normalizeText(filters.busca);

    return tutores.filter((tutor) => {
      const matchesBusca = tutorMatchesSearch(tutor, busca);
      const matchesCpf =
        !filters.cpf ||
        (filters.cpf === 'com_cpf' && tutor.cpf) ||
        (filters.cpf === 'sem_cpf' && !tutor.cpf);
      const matchesContato =
        !filters.contato ||
        (filters.contato === 'com_telefone' && tutor.telefone) ||
        (filters.contato === 'sem_telefone' && !tutor.telefone) ||
        (filters.contato === 'com_email' && tutor.email) ||
        (filters.contato === 'sem_email' && !tutor.email);
      const territorioAtual = tutor.territorio_nome || tutor.bairro || '';
      const matchesTerritorio = !filters.territorio || territorioAtual === filters.territorio;
      const matchesQualidadeStatus = matchesQualidade(tutor, filters.qualidade);

      return matchesBusca && matchesCpf && matchesContato && matchesTerritorio && matchesQualidadeStatus;
    });
  }, [filters, tutores]);

  const territorioOptions = useMemo(() => {
    const catalogo = territorios.map((territorio) => ({
      value: String(territorio.id),
      label: territorio.categoria ? `${territorio.nome} (${territorio.categoria})` : territorio.nome,
      nome: territorio.nome,
    }));

    return catalogo;
  }, [territorios]);

  const territorioFilterOptions = useMemo(() => {
    return Array.from(
      new Set(tutores.map((tutor) => tutor.territorio_nome || tutor.bairro).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [tutores]);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setFormErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
    setSubmitError('');
    setSuccessMessage('');
  }

  function handleTerritorioChange(event) {
    const { value } = event.target;
    const selected = territorioOptions.find((option) => option.value === value);

    setForm((prev) => ({
      ...prev,
      territorio_id: value,
      bairro: selected?.nome || prev.bairro,
    }));

    setFormErrors((prev) => ({
      ...prev,
      territorio_id: '',
      bairro: '',
    }));
    setSubmitError('');
    setSuccessMessage('');
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleClearFilters() {
    setFilters(INITIAL_FILTERS);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validateTutorForm(form);
    setFormErrors(errors);
    setSubmitError('');
    setSuccessMessage('');

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await createTutor(buildTutorPayload(form));
      const alerts = response?.data?.duplicidade_alertas || [];
      const pendencias = response?.data?.confiabilidade_pendencias || [];
      const qualitySuffix = alerts.length > 0
        ? ' Possível duplicidade sinalizada para revisao.'
        : pendencias.length > 0
          ? ` Pendencias: ${pendencias.slice(0, 2).join(' | ')}.`
          : '';

      setSuccessMessage(`Tutor cadastrado com sucesso.${qualitySuffix}`);
      setForm(INITIAL_FORM);
      await loadTutores();
    } catch (err) {
      setSubmitError(err.message || 'Erro ao cadastrar tutor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      {canCreate ? (
      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Cadastro de tutor</h2>
            <p style={styles.subtitle}>Registre os responsaveis pelos animais cadastrados.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="nome-tutor">
                Nome *
              </label>
              <input
                id="nome-tutor"
                name="nome"
                type="text"
                value={form.nome}
                onChange={handleFormChange}
                style={styles.input}
                placeholder="Ex.: Maria Silva"
              />
              {formErrors.nome ? <span style={styles.errorSmall}>{formErrors.nome}</span> : null}
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="cpf-tutor">
                Documento
              </label>
              <input
                id="cpf-tutor"
                name="cpf"
                type="text"
                value={form.cpf}
                onChange={handleFormChange}
                style={styles.input}
                placeholder="Somente numeros ou formatado"
              />
              {formErrors.cpf ? <span style={styles.errorSmall}>{formErrors.cpf}</span> : null}
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="telefone-tutor">
                Telefone
              </label>
              <input
                id="telefone-tutor"
                name="telefone"
                type="text"
                value={form.telefone}
                onChange={handleFormChange}
                style={styles.input}
                placeholder="Ex.: (11) 99999-9999"
              />
              {formErrors.telefone ? (
                <span style={styles.errorSmall}>{formErrors.telefone}</span>
              ) : null}
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="email-tutor">
                Email
              </label>
              <input
                id="email-tutor"
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                style={styles.input}
                placeholder="email@exemplo.com"
              />
              {formErrors.email ? <span style={styles.errorSmall}>{formErrors.email}</span> : null}
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="territorio-tutor">
                Bairro/localidade controlado
              </label>
              <select
                id="territorio-tutor"
                name="territorio_id"
                value={form.territorio_id}
                onChange={handleTerritorioChange}
                style={styles.input}
              >
                <option value="">Sem classificação controlada</option>
                {territorioOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {territoriosError ? <span style={styles.errorSmall}>{territoriosError}</span> : null}
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="bairro-tutor">
                Bairro textual / legado
              </label>
              <input
                id="bairro-tutor"
                name="bairro"
                type="text"
                value={form.bairro}
                onChange={handleFormChange}
                style={styles.input}
                placeholder="Ex.: Centro"
              />
              {formErrors.bairro ? <span style={styles.errorSmall}>{formErrors.bairro}</span> : null}
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="endereco-tutor">
              Endereço
            </label>
            <textarea
              id="endereco-tutor"
              name="endereco"
              value={form.endereco}
              onChange={handleFormChange}
              style={styles.textarea}
              rows={4}
              placeholder="Rua, numero, bairro e complemento"
            />
            {formErrors.endereco ? (
              <span style={styles.errorSmall}>{formErrors.endereco}</span>
            ) : null}
          </div>

          {submitError ? <div style={styles.alertError}>{submitError}</div> : null}
          {successMessage ? <div style={styles.alertSuccess}>{successMessage}</div> : null}

          <div style={styles.actions}>
            <button type="submit" disabled={submitting} style={styles.button}>
              {submitting ? 'Salvando...' : 'Cadastrar tutor'}
            </button>
          </div>
        </form>
      </section>
      ) : (
        <section style={styles.card}>
          <p style={styles.subtitle}>Seu perfil permite consultar tutores, mas não criar novos cadastros.</p>
        </section>
      )}

      <section style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Consulta de tutores</h2>
            <p style={styles.subtitle}>Busque e filtre tutores cadastrados.</p>
          </div>

          <div style={styles.countBadge}>
            {filteredTutores.length} de {tutores.length} registros
          </div>
        </div>

        <div style={styles.filters}>
          <div style={styles.fieldWide}>
            <label style={styles.label} htmlFor="busca-tutor">
              Busca
            </label>
            <input
              id="busca-tutor"
              name="busca"
              type="search"
              value={filters.busca}
              onChange={handleFilterChange}
              style={styles.input}
              placeholder="Nome, Documento, telefone, email ou endereço"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="cpf-filter">
              Documento
            </label>
            <select
              id="cpf-filter"
              name="cpf"
              value={filters.cpf}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="com_cpf">Com Documento</option>
              <option value="sem_cpf">Sem Documento</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="contato-filter">
              Contato
            </label>
            <select
              id="contato-filter"
              name="contato"
              value={filters.contato}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="com_telefone">Com telefone</option>
              <option value="sem_telefone">Sem telefone</option>
              <option value="com_email">Com email</option>
              <option value="sem_email">Sem email</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="territorio-filter">
              Território
            </label>
            <select
              id="territorio-filter"
              name="territorio"
              value={filters.territorio}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              {territorioFilterOptions.map((territorio) => (
                <option key={territorio} value={territorio}>
                  {territorio}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="qualidade-filter">
              Qualidade
            </label>
            <select
              id="qualidade-filter"
              name="qualidade"
              value={filters.qualidade}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="baixa">Baixa confiabilidade</option>
              <option value="duplicidade">Possível duplicidade</option>
              <option value="sem_contato">Sem contato mínimo</option>
            </select>
          </div>

          <button type="button" onClick={handleClearFilters} style={styles.secondaryButton}>
            Limpar filtros
          </button>
        </div>

        {loading && <p>Carregando...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && tutores.length === 0 && <p>Nenhum tutor cadastrado.</p>}

        {!loading && !error && tutores.length > 0 && filteredTutores.length === 0 && (
          <p>Nenhum tutor encontrado com os filtros atuais.</p>
        )}

        {!loading && !error && filteredTutores.length > 0 && (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Documento</th>
                  <th style={styles.th}>Telefone</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Território</th>
                  <th style={styles.th}>Endereço</th>
                  <th style={styles.th}>Qualidade</th>
                </tr>
              </thead>
              <tbody>
                {filteredTutores.map((tutor) => (
                  <tr key={tutor.id}>
                    <td style={styles.td}>{tutor.nome || '-'}</td>
                    <td style={styles.td}>{tutor.cpf || '-'}</td>
                    <td style={styles.td}>{tutor.telefone || '-'}</td>
                    <td style={styles.td}>{tutor.email || '-'}</td>
                    <td style={styles.td}>
                      {tutor.territorio_nome || tutor.bairro || '-'}
                      {tutor.territorio_origem && tutor.territorio_origem !== 'catalogo' ? (
                        <div style={styles.qualityHint}>{tutor.territorio_origem}</div>
                      ) : null}
                    </td>
                    <td style={styles.td}>{tutor.endereco || '-'}</td>
                    <td style={styles.td}>
                      <span style={styles.qualityBadge}>{getQualityLabel(tutor)}</span>
                      {hasDuplicateAlerts(tutor) ? (
                        <div style={styles.qualityWarning}>Possível duplicidade</div>
                      ) : null}
                      {Array.isArray(tutor.confiabilidade_pendencias) && tutor.confiabilidade_pendencias.length > 0 ? (
                        <div style={styles.qualityHint}>{tutor.confiabilidade_pendencias.slice(0, 2).join(' | ')}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    marginBottom: '8px',
    fontSize: '24px',
  },
  subtitle: {
    margin: 0,
    color: '#4b5563',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
    gap: '12px',
    alignItems: 'end',
    marginBottom: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldWide: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#374151',
    fontSize: '13px',
    fontWeight: 700,
  },
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
  countBadge: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    height: '42px',
    border: 'none',
    borderRadius: '8px',
    background: '#1f6f43',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0 16px',
  },
  secondaryButton: {
    height: '42px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0 14px',
  },
  tableWrapper: {
    overflowX: 'auto',
    marginTop: '16px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '14px',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  error: {
    color: '#b91c1c',
  },
  errorSmall: {
    color: '#b91c1c',
    fontSize: '12px',
  },
  alertError: {
    padding: '12px 14px',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
    fontSize: '14px',
  },
  alertSuccess: {
    padding: '12px 14px',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    fontSize: '14px',
  },
  qualityBadge: {
    display: 'inline-flex',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    background: '#f8fafc',
  },
  qualityWarning: {
    marginTop: '6px',
    color: '#9a3412',
    fontSize: '12px',
    fontWeight: 700,
  },
  qualityHint: {
    marginTop: '6px',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.4,
  },
};
