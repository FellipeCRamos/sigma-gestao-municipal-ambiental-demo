import { useEffect, useMemo, useState } from 'react';
import {
  downloadCampanhaInscricoesCsv,
  downloadDocumentoCampanhaInterno,
  getCampanhaAgenda,
  getCampanhaInscricoes,
  getCampanhas,
  getVacinaCatalogo,
  updateCampanhaInscricaoStatus,
} from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const STATUS_OPTIONS = [
  { value: 'em_analise', label: 'Em análise' },
  { value: 'pendente_documentacao', label: 'Pendente de informação/documento' },
  { value: 'pre_selecionado', label: 'Apto para agendamento' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'atendido', label: 'Atendido' },
  { value: 'indeferido', label: 'Inapto/indeferido' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'cancelado', label: 'Cancelado' },
];

const SERVICO_LABELS = {
  castracao_microchipagem: 'Castração e microchipagem',
  vacinacao: 'Vacinação',
};

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function getWorkflowOptions(inscriao) {
  const workflowOptions = inscriao.workflow?.opcoes_status;
  if (Array.isArray(workflowOptions) && workflowOptions.length > 0) {
    return workflowOptions;
  }

  return STATUS_OPTIONS;
}

function formatDateTime(value) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleString('pt-BR');
}

function formatDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
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

export default function Campanhas({ usuarioInterno }) {
  const [campanhas, setCampanhas] = useState([]);
  const [inscricoes, setInscricoes] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [catalogoVacinas, setCatalogoVacinas] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [territorioFilter, setTerritorioFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canExport = hasPermission(usuarioInterno, PERMISSIONS.CAMPANHAS_EXPORT);
  const canTriage =
    hasPermission(usuarioInterno, PERMISSIONS.CAMPANHAS_STATUS_UPDATE) ||
    hasPermission(usuarioInterno, PERMISSIONS.CAMPANHAS_TRIAGE);
  const canDownloadDocuments = hasPermission(usuarioInterno, PERMISSIONS.CAMPANHAS_DOWNLOAD_DOCUMENTS);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [campanhasResponse, inscricoesResponse, agendaResponse, catalogoResponse] = await Promise.all([
        getCampanhas(),
        getCampanhaInscricoes(),
        getCampanhaAgenda(),
        getVacinaCatalogo(),
      ]);

      const nextCampanhas = Array.isArray(campanhasResponse?.data)
        ? campanhasResponse.data
        : [];
      const nextInscricoes = Array.isArray(inscricoesResponse?.data)
        ? inscricoesResponse.data
        : [];
      const nextAgenda = Array.isArray(agendaResponse?.data) ? agendaResponse.data : [];
      const nextCatalogo = Array.isArray(catalogoResponse?.data) ? catalogoResponse.data : [];

      setCampanhas(nextCampanhas);
      setInscricoes(nextInscricoes);
      setAgenda(nextAgenda);
      setCatalogoVacinas(nextCatalogo);
      setDrafts(
        nextInscricoes.reduce((acc, inscriao) => {
          acc[inscriao.id] = {
            status: inscriao.status,
            agendamento_data: inscriao.agendamento_data
              ? String(inscriao.agendamento_data).slice(0, 16)
              : '',
            observacoes_tecnicas: inscriao.observacoes_tecnicas || '',
            resultado_operacional: inscriao.resultado_operacional || '',
            pendencia_tipo: inscriao.pendencia_tipo || '',
            pendencia_descricao: inscriao.pendencia_descricao || '',
            desfecho: inscriao.desfecho || '',
            motivo_desfecho: inscriao.motivo_desfecho || '',
            vacinacoes_aplicadas: Array.isArray(inscriao.vacinacoes_aplicadas)
              ? inscriao.vacinacoes_aplicadas.map((item) => ({
                id: item.id || null,
                vacina_catalogo_id: item.vacina_catalogo_id || '',
                dose: item.dose || '',
                data_aplicacao: formatDateOnly(item.data_aplicacao) || getToday(),
                proxima_dose_em: formatDateOnly(item.proxima_dose_em),
                lote: item.lote || '',
                fabricante: item.fabricante || '',
                documento_id: item.documento_id || '',
                observacoes: item.observacoes || '',
              }))
              : [],
          };
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err.message || 'Não foi possível carregar campanhas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredInscricoes = useMemo(() => {
    const term = normalizeText(search);

    return inscricoes.filter((inscriao) => {
      const haystack = [
        inscriao.protocolo,
        inscriao.usuario_nome,
        inscriao.usuario_cpf,
        inscriao.usuario_email,
        inscriao.usuario_telefone,
        inscriao.animal_nome,
        inscriao.animal_especie,
        inscriao.animal_sexo,
        inscriao.criterio_prioridade,
        inscriao.servico_desejado,
        inscriao.territorio_nome,
      ]
        .map(normalizeText)
        .join(' ');

      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus = !statusFilter || inscriao.status === statusFilter;
      const matchesTerritorio =
        !territorioFilter || (inscriao.territorio_nome || inscriao.bairro || '') === territorioFilter;

      return matchesSearch && matchesStatus && matchesTerritorio;
    });
  }, [inscricoes, search, statusFilter, territorioFilter]);

  const territorioOptions = useMemo(() => {
    return Array.from(
      new Set(inscricoes.map((inscriao) => inscriao.territorio_nome || inscriao.bairro).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [inscricoes]);

  function handleDraftChange(id, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
    setMessage('');
    setError('');
  }

  function getVacinasForInscricao(inscriao) {
    return catalogoVacinas.filter((item) => (
      item.especie === 'ambos' || item.especie === inscriao.animal_especie
    ));
  }

  function buildEmptyVacinacao(inscriao) {
    const documentos = Array.isArray(inscriao.documentos) ? inscriao.documentos : [];

    return {
      id: null,
      vacina_catalogo_id: '',
      dose: '',
      data_aplicacao: getToday(),
      proxima_dose_em: '',
      lote: '',
      fabricante: '',
      documento_id: documentos[0]?.id || '',
      observacoes: '',
    };
  }

  function handleAddVacinacao(inscriao) {
    setDrafts((prev) => ({
      ...prev,
      [inscriao.id]: {
        ...prev[inscriao.id],
        vacinacoes_aplicadas: [
          ...(prev[inscriao.id]?.vacinacoes_aplicadas || []),
          buildEmptyVacinacao(inscriao),
        ],
      },
    }));
    setMessage('');
    setError('');
  }

  function handleVacinacaoChange(inscriaoId, index, field, value) {
    setDrafts((prev) => {
      const draft = prev[inscriaoId] || {};
      const items = [...(draft.vacinacoes_aplicadas || [])];
      items[index] = { ...items[index], [field]: value };

      return {
        ...prev,
        [inscriaoId]: {
          ...draft,
          vacinacoes_aplicadas: items,
        },
      };
    });
    setMessage('');
    setError('');
  }

  function handleRemoveVacinacao(inscriaoId, index) {
    setDrafts((prev) => {
      const draft = prev[inscriaoId] || {};
      const items = [...(draft.vacinacoes_aplicadas || [])];
      items.splice(index, 1);

      return {
        ...prev,
        [inscriaoId]: {
          ...draft,
          vacinacoes_aplicadas: items,
        },
      };
    });
    setMessage('');
    setError('');
  }

  async function handleUpdateStatus(id) {
    const draft = drafts[id];
    const inscriao = inscricoes.find((item) => item.id === id);
    const isAtendimentoVacinal =
      inscriao?.servico_desejado === 'vacinacao' && draft.status === 'atendido';

    if (isAtendimentoVacinal) {
      const vacinacoes = draft.vacinacoes_aplicadas || [];

      if (vacinacoes.length === 0) {
        setError('Informe pelo menos uma vacina aplicada antes de marcar a inscrição como atendida.');
        return;
      }

      if (vacinacoes.some((item) => !item.vacina_catalogo_id)) {
        setError('Selecione a vacina aplicada em todos os itens do atendimento.');
        return;
      }
    }

    try {
      const payload = {
        status: draft.status,
        agendamento_data: draft.agendamento_data || null,
        observacoes_tecnicas: draft.observacoes_tecnicas || null,
        resultado_operacional: draft.resultado_operacional || null,
        pendencia_tipo: draft.pendencia_tipo || null,
        pendencia_descricao: draft.pendencia_descricao || null,
        desfecho: draft.desfecho || null,
        motivo_desfecho: draft.motivo_desfecho || null,
      };

      if (isAtendimentoVacinal) {
        payload.vacinacoes_aplicadas = draft.vacinacoes_aplicadas.map((item) => ({
          ...item,
          vacina_catalogo_id: Number(item.vacina_catalogo_id),
          documento_id: item.documento_id ? Number(item.documento_id) : null,
        }));
      }

      await updateCampanhaInscricaoStatus(id, payload);
      setMessage('Status atualizado e auditado com sucesso.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar o status.');
    }
  }

  async function handleDownloadCsv() {
    try {
      const blob = await downloadCampanhaInscricoesCsv();
      downloadBlob(blob, 'sigba-campanha-inscrições.csv');
    } catch (err) {
      setError(err.message || 'Não foi possível baixar o relatorio.');
    }
  }

  async function handleDownloadDocumento(documento) {
    try {
      const blob = await downloadDocumentoCampanhaInterno(documento.id);
      downloadBlob(blob, documento.nome_original || `documento-${documento.id}`);
    } catch (err) {
      setError(err.message || 'Não foi possível baixar o documento.');
    }
  }

  const activeCampanha = campanhas[0];

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Campanhas</h2>
            <p style={styles.subtitle}>
              Retaguarda interna da SMAD para triagem, status e agendamentos.
            </p>
          </div>
          <div style={styles.headerActions}>
            {canExport ? (
            <button type="button" onClick={handleDownloadCsv} style={styles.secondaryButton}>
              Baixar CSV
            </button>
            ) : null}
            <span style={styles.badge}>Área interna</span>
          </div>
        </div>

        {activeCampanha ? (
          <div style={styles.summary}>
            <div>
              <span style={styles.label}>Campanha ativa</span>
              <strong style={styles.summaryTitle}>{activeCampanha.nome}</strong>
              <p style={styles.summaryText}>{activeCampanha.descricao}</p>
            </div>
            <div style={styles.summaryGrid}>
              <InfoPill label="Caninos fêmeas" value={activeCampanha.vagas_config?.canino_femea || 0} />
              <InfoPill label="Caninos machos" value={activeCampanha.vagas_config?.canino_macho || 0} />
              <InfoPill label="Felinos fêmeas" value={activeCampanha.vagas_config?.felino_femea || 0} />
              <InfoPill label="Felinos machos" value={activeCampanha.vagas_config?.felino_macho || 0} />
            </div>
          </div>
        ) : null}
      </section>

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Agenda operacional</h2>
            <p style={styles.subtitle}>Inscrições com data e horário de atendimento definidos.</p>
          </div>
          <span style={styles.countBadge}>{agenda.length} agendamentos</span>
        </div>

        {agenda.length === 0 ? (
          <p>Nenhum atendimento agendado.</p>
        ) : (
          <div style={styles.agendaGrid}>
            {agenda.map((item) => (
              <article key={item.id} style={styles.agendaCard}>
                <strong>{formatDateTime(item.agendamento_data)}</strong>
                <span>{item.protocolo}</span>
                <span>{item.animal_nome} - {item.animal_especie} / {item.animal_sexo}</span>
                <span>{item.usuario_nome} ({item.usuario_telefone || item.usuario_email})</span>
                <span>{getStatusLabel(item.status)}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Inscrições recebidas</h2>
            <p style={styles.subtitle}>
              Atualize status, agendamento e observações técnicas. Cada alteraçao gera auditoria.
            </p>
          </div>
          <span style={styles.countBadge}>{filteredInscricoes.length} registros</span>
        </div>

        <div style={styles.filters}>
          <label style={styles.field}>
            <span style={styles.label}>Busca</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={styles.input}
              placeholder="Protocolo, tutor, animal, telefone..."
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={styles.input}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Território</span>
            <select
              value={territorioFilter}
              onChange={(event) => setTerritorioFilter(event.target.value)}
              style={styles.input}
            >
              <option value="">Todos</option>
              {territorioOptions.map((territorio) => (
                <option key={territorio} value={territorio}>
                  {territorio}
                </option>
              ))}
            </select>
          </label>
        </div>

        {message ? <div style={styles.alertSuccess}>{message}</div> : null}
        {error ? <div style={styles.alertError}>{error}</div> : null}
        {loading ? <p>Carregando inscrições...</p> : null}

        {!loading && !error && filteredInscricoes.length === 0 ? (
          <p>Nenhuma inscrição encontrada.</p>
        ) : null}

        {!loading && filteredInscricoes.length > 0 ? (
          <div style={styles.cards}>
            {filteredInscricoes.map((inscriao) => {
              const draft = drafts[inscriao.id] || {};
              const statusOptions = getWorkflowOptions(inscriao);

              return (
                <article key={inscriao.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <strong style={styles.protocol}>{inscriao.protocolo}</strong>
                      <p style={styles.cardText}>
                        {inscriao.animal_nome} - {inscriao.animal_especie} / {inscriao.animal_sexo}
                      </p>
                    </div>
                    <span style={styles.statusBadge}>
                      {inscriao.workflow?.status_label || getStatusLabel(inscriao.status)}
                    </span>
                  </div>

                  <div style={styles.detailsGrid}>
                    <InfoLine label="Tutor" value={`${inscriao.usuario_nome} (${inscriao.usuario_telefone || inscriao.usuario_email})`} />
                    <InfoLine label="Servico" value={SERVICO_LABELS[inscriao.servico_desejado] || inscriao.servico_desejado} />
                    <InfoLine label="Território" value={inscriao.territorio_nome || inscriao.bairro || 'Não informado'} />
                    <InfoLine label="Prioridade" value={inscriao.criterio_prioridade || 'Sem prioridade'} />
                    <InfoLine label="Peso" value={inscriao.peso_kg ? `${inscriao.peso_kg} kg` : 'Não informado'} />
                    <InfoLine label="Documentos" value={`${inscriao.documentos_total || 0} anexos`} />
                    <InfoLine label="Carteira vacinal" value={`${inscriao.vacinacoes_total || 0} registros estruturados`} />
                    <InfoLine
                      label="Cadastro oficial"
                      value={inscriao.animal_id ? `Animal #${inscriao.animal_id} / Tutor #${inscriao.tutor_id}` : 'Não vinculado'}
                    />
                    <InfoLine label="Fila" value={inscriao.workflow?.fila || '-'} />
                    <InfoLine label="Proximo passo" value={inscriao.workflow?.proximo_passo || '-'} />
                  </div>

                  <div style={styles.workflowGrid}>
                    <label style={styles.field}>
                      <span style={styles.label}>Status</span>
                      <select
                        value={draft.status || inscriao.status}
                        onChange={(event) => handleDraftChange(inscriao.id, 'status', event.target.value)}
                        style={styles.input}
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Agendamento</span>
                      <input
                        type="datetime-local"
                        value={draft.agendamento_data || ''}
                        onChange={(event) => handleDraftChange(inscriao.id, 'agendamento_data', event.target.value)}
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <label style={styles.field}>
                    <span style={styles.label}>Observações técnicas</span>
                    <textarea
                      value={draft.observacoes_tecnicas || ''}
                      onChange={(event) => handleDraftChange(inscriao.id, 'observacoes_tecnicas', event.target.value)}
                      style={styles.textarea}
                      rows={3}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Resultado operacional</span>
                    <textarea
                      value={draft.resultado_operacional || ''}
                      onChange={(event) => handleDraftChange(inscriao.id, 'resultado_operacional', event.target.value)}
                      style={styles.textarea}
                      rows={3}
                      placeholder="Atendimento realizado, documentos pendentes ou orientações ao tutor"
                    />
                  </label>

                  {(draft.status === 'pendente_documentacao' || inscriao.pendencia_aberta) ? (
                    <div style={styles.pendingBox}>
                      <label style={styles.field}>
                        <span style={styles.label}>Tipo de pendência</span>
                        <input
                          value={draft.pendencia_tipo || ''}
                          onChange={(event) => handleDraftChange(inscriao.id, 'pendencia_tipo', event.target.value)}
                          style={styles.input}
                          placeholder="documento, contato, informação técnica"
                        />
                      </label>
                      <label style={styles.fieldWide}>
                        <span style={styles.label}>Descrição da pendência</span>
                        <textarea
                          value={draft.pendencia_descricao || ''}
                          onChange={(event) => handleDraftChange(inscriao.id, 'pendencia_descricao', event.target.value)}
                          style={styles.textarea}
                          rows={2}
                          placeholder="Explique o que falta para o atendimento seguir."
                        />
                      </label>
                    </div>
                  ) : null}

                  {['atendido', 'indeferido', 'cancelado'].includes(draft.status) ? (
                    <div style={styles.workflowGrid}>
                      <label style={styles.field}>
                        <span style={styles.label}>Desfecho</span>
                        <input
                          value={draft.desfecho || ''}
                          onChange={(event) => handleDraftChange(inscriao.id, 'desfecho', event.target.value)}
                          style={styles.input}
                          placeholder={draft.status}
                        />
                      </label>
                      <label style={styles.field}>
                        <span style={styles.label}>Motivo do desfecho</span>
                        <input
                          value={draft.motivo_desfecho || ''}
                          onChange={(event) => handleDraftChange(inscriao.id, 'motivo_desfecho', event.target.value)}
                          style={styles.input}
                          placeholder="Resumo administrativo do encerramento"
                        />
                      </label>
                    </div>
                  ) : null}

                  {inscriao.servico_desejado === 'vacinacao' ? (
                    <div style={styles.vacinacaoBox}>
                      <div style={styles.inlineHeader}>
                        <div>
                          <span style={styles.label}>Vacinas aplicadas no atendimento</span>
                          <p style={styles.helperText}>
                            Use esta lista quando o status for Atendido. Cada item gera um registro estruturado na carteira vacinal.
                          </p>
                        </div>
                        {canTriage ? (
                          <button
                            type="button"
                            onClick={() => handleAddVacinacao(inscriao)}
                            style={styles.secondaryButton}
                          >
                            Adicionar vacina
                          </button>
                        ) : null}
                      </div>

                      {(draft.vacinacoes_aplicadas || []).length === 0 ? (
                        <p style={styles.helperText}>Nenhuma vacina estruturada informada para este atendimento.</p>
                      ) : (
                        <div style={styles.vacinacaoList}>
                          {(draft.vacinacoes_aplicadas || []).map((item, index) => (
                            <div key={item.id || index} style={styles.vacinacaoItem}>
                              <label style={styles.field}>
                                <span style={styles.label}>Vacina</span>
                                <select
                                  value={item.vacina_catalogo_id || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'vacina_catalogo_id', event.target.value)}
                                  style={styles.input}
                                  disabled={!canTriage}
                                >
                                  <option value="">Selecionar</option>
                                  {getVacinasForInscricao(inscriao).map((vacina) => (
                                    <option key={vacina.id} value={vacina.id}>
                                      {(vacina.nome_popular || vacina.nome_comercial || vacina.nome_tecnico)} - {vacina.especie}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Data</span>
                                <input
                                  type="date"
                                  value={item.data_aplicacao || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'data_aplicacao', event.target.value)}
                                  style={styles.input}
                                  disabled={!canTriage}
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Dose</span>
                                <input
                                  value={item.dose || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'dose', event.target.value)}
                                  style={styles.input}
                                  placeholder="Ex.: reforco anual"
                                  disabled={!canTriage}
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Próxima dose</span>
                                <input
                                  type="date"
                                  value={item.proxima_dose_em || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'proxima_dose_em', event.target.value)}
                                  style={styles.input}
                                  disabled={!canTriage}
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Lote</span>
                                <input
                                  value={item.lote || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'lote', event.target.value)}
                                  style={styles.input}
                                  disabled={!canTriage}
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Fabricante</span>
                                <input
                                  value={item.fabricante || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'fabricante', event.target.value)}
                                  style={styles.input}
                                  disabled={!canTriage}
                                />
                              </label>

                              <label style={styles.field}>
                                <span style={styles.label}>Comprovante</span>
                                <select
                                  value={item.documento_id || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'documento_id', event.target.value)}
                                  style={styles.input}
                                  disabled={!canTriage}
                                >
                                  <option value="">Sem comprovante vinculado</option>
                                  {(inscriao.documentos || []).map((documento) => (
                                    <option key={documento.id} value={documento.id}>
                                      {documento.nome_original}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label style={styles.fieldWide}>
                                <span style={styles.label}>Observações da vacina</span>
                                <textarea
                                  value={item.observacoes || ''}
                                  onChange={(event) => handleVacinacaoChange(inscriao.id, index, 'observacoes', event.target.value)}
                                  style={styles.textarea}
                                  rows={2}
                                  disabled={!canTriage}
                                />
                              </label>

                              {canTriage ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVacinacao(inscriao.id, index)}
                                  style={styles.dangerButton}
                                >
                                  Remover vacina
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {Array.isArray(inscriao.documentos) && inscriao.documentos.length > 0 ? (
                    <div style={styles.documentList}>
                      <span style={styles.label}>Anexos enviados</span>
                      {inscriao.documentos.map((documento) => (
                        <button
                          key={documento.id}
                          type="button"
                          onClick={() => canDownloadDocuments ? handleDownloadDocumento(documento) : undefined}
                          style={styles.documentButton}
                          disabled={!canDownloadDocuments}
                        >
                          {documento.nome_original}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {canTriage ? (
                  <button type="button" onClick={() => handleUpdateStatus(inscriao.id)} style={styles.primaryButton}>
                    Salvar triagem/status
                  </button>
                  ) : (
                    <p style={styles.subtitle}>Seu perfil permite visualizar inscrições, mas não alterar triagem/status.</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div style={styles.infoPill}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div style={styles.infoLine}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '20px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  badge: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '8px 10px', fontSize: '13px', fontWeight: 700 },
  headerActions: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  secondaryButton: { height: '40px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  summary: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '20px', alignItems: 'start' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  summaryTitle: { display: 'block', marginTop: '6px', color: '#111827', fontSize: '18px' },
  summaryText: { margin: '8px 0 0', color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' },
  infoPill: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#374151' },
  countBadge: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 10px', color: '#374151', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px', marginBottom: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldWide: { display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' },
  input: { height: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff' },
  textarea: { border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', fontSize: '14px', resize: 'vertical', background: '#ffffff' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginBottom: '12px' },
  alertSuccess: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '12px', fontSize: '14px', marginBottom: '12px' },
  agendaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '12px' },
  agendaCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', display: 'grid', gap: '6px', color: '#374151', fontSize: '14px', background: '#ffffff' },
  cards: { display: 'grid', gap: '16px' },
  card: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'grid', gap: '14px', background: '#ffffff' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' },
  protocol: { color: '#111827', fontSize: '16px' },
  cardText: { margin: '4px 0 0', color: '#4b5563', fontSize: '14px' },
  statusBadge: { border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 8px', color: '#334155', fontSize: '12px', fontWeight: 700 },
  detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
  infoLine: { display: 'grid', gap: '4px', color: '#4b5563', fontSize: '13px' },
  workflowGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' },
  pendingBox: { border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', background: '#fffbeb', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px' },
  documentList: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' },
  documentButton: { minHeight: '34px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 12px', fontSize: '13px' },
  vacinacaoBox: { border: '1px solid #dbeafe', borderRadius: '8px', padding: '14px', display: 'grid', gap: '12px', background: '#eff6ff' },
  inlineHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' },
  helperText: { margin: '4px 0 0', color: '#475569', fontSize: '13px', lineHeight: 1.5 },
  vacinacaoList: { display: 'grid', gap: '12px' },
  vacinacaoItem: { border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '10px', background: '#ffffff' },
  dangerButton: { justifySelf: 'start', minHeight: '38px', border: '1px solid #fecaca', borderRadius: '8px', background: '#ffffff', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, padding: '0 12px' },
  primaryButton: { justifySelf: 'start', height: '40px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
};
