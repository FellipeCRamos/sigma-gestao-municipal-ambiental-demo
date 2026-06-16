import { useEffect, useMemo, useState } from 'react';
import AnimalForm from '../components/AnimalForm';
import CarteiraVacinal from '../components/CarteiraVacinal';
import { createAnimalEvento, getAnimalEventos, getAnimais } from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const INITIAL_FILTERS = {
  busca: '',
  especie: '',
  status: '',
  tutor: '',
  territorio: '',
  sanitario: '',
  qualidade: '',
};

const STATUS_LABELS = {
  ativo: 'Ativo',
  acompanhamento: 'Em acompanhamento',
  tratamento: 'Em tratamento',
  disponivel_adocao: 'Disponível para adoção',
  adotado: 'Adotado',
  inativo: 'Inativo',
};

const ESPECIE_LABELS = {
  canino: 'Canino',
  felino: 'Felino',
};

const INITIAL_EVENT_FORM = {
  tipo: 'observacao',
  titulo: '',
  descricao: '',
  data_evento: '',
};

const EVENT_LABELS = {
  vacina: 'Vacina',
  castracao: 'Castração',
  microchipagem: 'Microchipagem',
  consulta: 'Consulta',
  ocorrencia: 'Ocorrência',
  adocao: 'Adoção',
  obito: 'obito',
  campanha: 'Campanha',
  observacao: 'Observação',
};

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function includesSearch(animal, busca) {
  if (!busca) return true;

  const haystack = [
    animal.nome,
    animal.especie,
    animal.raca,
    animal.status,
    animal.tutor_nome,
    animal.tutor_cpf,
    animal.microchip,
    animal.public_id,
    animal.cor,
    animal.territorio_nome,
    animal.bairro,
    animal.endereco_referencia,
  ]
    .map(normalizeText)
    .join(' ');

  return haystack.includes(busca);
}

function matchesSanitario(animal, sanitario) {
  if (!sanitario) return true;
  if (sanitario === 'castrado') return Boolean(animal.castrado);
  if (sanitario === 'castracao_pendente') return Boolean(animal.castracao_pendente);
  if (sanitario === 'vacinado') return Boolean(animal.vacinado);
  if (sanitario === 'sem_microchip') return !animal.microchip;
  return true;
}

function hasDuplicateAlerts(record) {
  return Array.isArray(record?.duplicidade_alertas) && record.duplicidade_alertas.length > 0;
}

function matchesQualidade(animal, qualidade) {
  if (!qualidade) return true;
  if (qualidade === 'baixa') return animal.confiabilidade_nivel === 'baixo';
  if (qualidade === 'duplicidade') return hasDuplicateAlerts(animal);
  if (qualidade === 'sem_microchip') return !animal.microchip;
  if (qualidade === 'sem_tutor') return !animal.tutor_id;
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

export default function Animais({ usuarioInterno }) {
  const [animais, setAnimais] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [editingAnimal, setEditingAnimal] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [eventForm, setEventForm] = useState(INITIAL_EVENT_FORM);
  const [eventMessage, setEventMessage] = useState('');
  const [eventError, setEventError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canCreate = hasPermission(usuarioInterno, PERMISSIONS.ANIMAIS_CREATE);
  const canUpdate = hasPermission(usuarioInterno, PERMISSIONS.ANIMAIS_UPDATE);
  const canCreateEvent = hasPermission(usuarioInterno, PERMISSIONS.ANIMAIS_EVENT_CREATE);
  const canManageVaccines = hasPermission(usuarioInterno, PERMISSIONS.ANIMAIS_VACINACOES_MANAGE);

  async function loadAnimais() {
    try {
      setLoading(true);
      setError('');

      const response = await getAnimais();
      const data = Array.isArray(response?.data) ? response.data : [];
      setAnimais(data);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os animais.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnimais();
  }, []);

  const filteredAnimais = useMemo(() => {
    const busca = normalizeText(filters.busca);

    return animais.filter((animal) => {
      const matchesBusca = includesSearch(animal, busca);
      const matchesEspecie = !filters.especie || animal.especie === filters.especie;
      const matchesStatus = !filters.status || animal.status === filters.status;
      const matchesTutor =
        !filters.tutor ||
        (filters.tutor === 'com_tutor' && animal.tutor_id) ||
        (filters.tutor === 'sem_tutor' && !animal.tutor_id);
      const territorioAtual = animal.territorio_nome || animal.bairro || '';
      const matchesTerritorio = !filters.territorio || territorioAtual === filters.territorio;
      const matchesSanitarioStatus = matchesSanitario(animal, filters.sanitario);
      const matchesQualidadeStatus = matchesQualidade(animal, filters.qualidade);

      return (
        matchesBusca &&
        matchesEspecie &&
        matchesStatus &&
        matchesTutor &&
        matchesTerritorio &&
        matchesSanitarioStatus &&
        matchesQualidadeStatus
      );
    });
  }, [animais, filters]);

  const territorioOptions = useMemo(() => {
    return Array.from(
      new Set(animais.map((animal) => animal.territorio_nome || animal.bairro).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [animais]);

  async function handleAnimalCreated() {
    await loadAnimais();
  }

  async function handleAnimalSaved() {
    await loadAnimais();
    setEditingAnimal(null);
    setEventos([]);
  }

  async function handleEditAnimal(animal) {
    setEditingAnimal(animal);
    setEventForm(INITIAL_EVENT_FORM);
    setEventMessage('');
    setEventError('');

    try {
      const response = await getAnimalEventos(animal.id);
      setEventos(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setEventError(err.message || 'Não foi possível carregar a linha do tempo.');
    }
  }

  function handleEventFormChange(event) {
    const { name, value } = event.target;
    setEventForm((prev) => ({ ...prev, [name]: value }));
    setEventMessage('');
    setEventError('');
  }

  async function handleCreateEvent(event) {
    event.preventDefault();

    if (!editingAnimal?.id) return;

    try {
      await createAnimalEvento(editingAnimal.id, eventForm);
      setEventForm(INITIAL_EVENT_FORM);
      setEventMessage('Evento registrado na linha do tempo.');
      const response = await getAnimalEventos(editingAnimal.id);
      setEventos(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setEventError(err.message || 'Não foi possível registrar o evento.');
    }
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

  return (
    <div style={styles.page}>
      {canCreate || (editingAnimal && canUpdate) ? (
      <AnimalForm
        key={editingAnimal && canUpdate ? `edit-${editingAnimal.id}` : 'create-animal'}
        animal={canUpdate ? editingAnimal : null}
        mode={editingAnimal && canUpdate ? 'edit' : 'create'}
        onAnimalCreated={handleAnimalCreated}
        onAnimalSaved={handleAnimalSaved}
        onCancel={editingAnimal ? () => { setEditingAnimal(null); setEventos([]); } : undefined}
      />
      ) : null}

      {!canCreate && !editingAnimal ? (
        <section style={styles.section}>
          <p style={styles.subtitle}>Seu perfil permite consultar animais, mas não criar novos cadastros.</p>
        </section>
      ) : null}

      {editingAnimal ? (
        <CarteiraVacinal
          animal={editingAnimal}
          canManage={canManageVaccines}
          onChanged={loadAnimais}
        />
      ) : null}

      {editingAnimal ? (
        <section style={styles.section}>
          <div style={styles.header}>
            <div>
              <h2 style={styles.title}>Linha do tempo</h2>
              <p style={styles.subtitle}>Histórico sanitário e operacional de {editingAnimal.nome}.</p>
            </div>
            <div style={styles.countBadge}>{eventos.length} eventos</div>
          </div>

          {canCreateEvent ? (
          <form onSubmit={handleCreateEvent} style={styles.eventForm}>
            <label style={styles.field}>
              <span style={styles.label}>Tipo</span>
              <select name="tipo" value={eventForm.tipo} onChange={handleEventFormChange} style={styles.input}>
                {Object.entries(EVENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Titulo</span>
              <input name="titulo" value={eventForm.titulo} onChange={handleEventFormChange} style={styles.input} required />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Data</span>
              <input name="data_evento" type="datetime-local" value={eventForm.data_evento} onChange={handleEventFormChange} style={styles.input} />
            </label>
            <label style={styles.fieldWide}>
              <span style={styles.label}>Descrição</span>
              <textarea name="descricao" value={eventForm.descricao} onChange={handleEventFormChange} style={styles.textarea} rows={3} />
            </label>
            <button type="submit" style={styles.actionButton}>Adicionar evento</button>
          </form>
          ) : (
            <p style={styles.subtitle}>Seu perfil não permite criar eventos na linha do tempo.</p>
          )}

          {eventMessage ? <div style={styles.alertSuccess}>{eventMessage}</div> : null}
          {eventError ? <div style={styles.alertError}>{eventError}</div> : null}

          {eventos.length === 0 ? (
            <p>Nenhum evento registrado.</p>
          ) : (
            <div style={styles.timeline}>
              {eventos.map((evento) => (
                <article key={evento.id} style={styles.timelineItem}>
                  <strong>{evento.titulo}</strong>
                  <span>{EVENT_LABELS[evento.tipo] || evento.tipo} - {new Date(evento.data_evento).toLocaleString('pt-BR')}</span>
                  {evento.descricao ? <p>{evento.descricao}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Consulta de animais</h2>
            <p style={styles.subtitle}>
              Busque, filtre e edite os animais cadastrados no sistema.
            </p>
          </div>

          <div style={styles.countBadge}>
            {filteredAnimais.length} de {animais.length} registros
          </div>
        </div>

        <div style={styles.filters}>
          <div style={styles.fieldWide}>
            <label style={styles.label} htmlFor="busca-animal">
              Busca
            </label>
            <input
              id="busca-animal"
              name="busca"
              type="search"
              value={filters.busca}
              onChange={handleFilterChange}
              style={styles.input}
              placeholder="Nome, tutor, microchip, raça ou cor"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="especie-animal">
              Espécie
            </label>
            <select
              id="especie-animal"
              name="especie"
              value={filters.especie}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todas</option>
              <option value="canino">Canino</option>
              <option value="felino">Felino</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="status-animal">
              Status
            </label>
            <select
              id="status-animal"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="tutor-animal">
              Tutor
            </label>
            <select
              id="tutor-animal"
              name="tutor"
              value={filters.tutor}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="com_tutor">Com tutor</option>
              <option value="sem_tutor">Sem tutor</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="territorio-animal">
              Território
            </label>
            <select
              id="territorio-animal"
              name="territorio"
              value={filters.territorio}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              {territorioOptions.map((territorio) => (
                <option key={territorio} value={territorio}>
                  {territorio}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="sanitario-animal">
              Saúde
            </label>
            <select
              id="sanitario-animal"
              name="sanitario"
              value={filters.sanitario}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="castrado">Castrados</option>
              <option value="castracao_pendente">Castração pendente</option>
              <option value="vacinado">Vacinados</option>
              <option value="sem_microchip">Sem microchip</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="qualidade-animal">
              Qualidade
            </label>
            <select
              id="qualidade-animal"
              name="qualidade"
              value={filters.qualidade}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="">Todos</option>
              <option value="baixa">Baixa confiabilidade</option>
              <option value="duplicidade">Possível duplicidade</option>
              <option value="sem_microchip">Sem microchip</option>
              <option value="sem_tutor">Sem tutor</option>
            </select>
          </div>

          <button type="button" onClick={handleClearFilters} style={styles.secondaryButton}>
            Limpar filtros
          </button>
        </div>

        {loading ? <p>Carregando animais...</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}

        {!loading && !error && animais.length === 0 ? (
          <p>Nenhum animal cadastrado atao momento.</p>
        ) : null}

        {!loading && !error && animais.length > 0 && filteredAnimais.length === 0 ? (
          <p>Nenhum animal encontrado com os filtros atuais.</p>
        ) : null}

        {!loading && !error && filteredAnimais.length > 0 ? (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Espécie</th>
                  <th style={styles.th}>Raça</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Tutor</th>
                  <th style={styles.th}>Território</th>
                  <th style={styles.th}>Microchip</th>
                  <th style={styles.th}>identificação animal</th>
                  <th style={styles.th}>Saúde</th>
                  <th style={styles.th}>Qualidade</th>
                  <th style={styles.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnimais.map((animal) => (
                  <tr key={animal.id}>
                    <td style={styles.td}>{animal.nome || '-'}</td>
                    <td style={styles.td}>{ESPECIE_LABELS[animal.especie] || animal.especie || '-'}</td>
                    <td style={styles.td}>{animal.raca || '-'}</td>
                    <td style={styles.td}>{STATUS_LABELS[animal.status] || animal.status || '-'}</td>
                    <td style={styles.td}>{animal.tutor_nome || 'Sem tutor'}</td>
                    <td style={styles.td}>
                      {animal.territorio_nome || animal.bairro || '-'}
                      {animal.territorio_origem && animal.territorio_origem !== 'catalogo' ? (
                        <div style={styles.qualityHint}>{animal.territorio_origem}</div>
                      ) : null}
                    </td>
                    <td style={styles.td}>{animal.microchip || '-'}</td>
                    <td style={styles.td}>{animal.public_id || '-'}</td>
                    <td style={styles.td}>
                      {animal.castrado ? 'Castrado' : animal.castracao_pendente ? 'Castração pendente' : 'Não castrado'}
                      {' / '}
                      {animal.vacinado ? 'Vacinado' : 'Sem vacina'}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.qualityBadge}>{getQualityLabel(animal)}</span>
                      {hasDuplicateAlerts(animal) ? (
                        <div style={styles.qualityWarning}>Possível duplicidade</div>
                      ) : null}
                      {Array.isArray(animal.confiabilidade_pendencias) && animal.confiabilidade_pendencias.length > 0 ? (
                        <div style={styles.qualityHint}>{animal.confiabilidade_pendencias.slice(0, 2).join(' | ')}</div>
                      ) : null}
                    </td>
                    <td style={styles.td}>
                      {canUpdate ? (
                      <button
                        type="button"
                        onClick={() => handleEditAnimal(animal)}
                        style={styles.actionButton}
                      >
                        Editar
                      </button>
                      ) : (
                        <span>Somente leitura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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
  section: {
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
  countBadge: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#374151',
    fontSize: '13px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
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
  eventForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
    gap: '12px',
    alignItems: 'end',
    marginBottom: '16px',
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
  actionButton: {
    border: '1px solid #1f6f43',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#1f6f43',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '8px 12px',
  },
  error: {
    color: '#b91c1c',
  },
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
  timeline: {
    display: 'grid',
    gap: '12px',
  },
  timelineItem: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '14px',
    display: 'grid',
    gap: '6px',
    color: '#374151',
    fontSize: '14px',
  },
};
