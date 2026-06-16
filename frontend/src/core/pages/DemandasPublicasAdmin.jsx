import { useEffect, useMemo, useState } from 'react';
import {
  assignDemandaPublicaResponsavel,
  closeDemandaPublica,
  createDemandaPublicaMovimentacao,
  getDemandaPublicaAdmin,
  getDemandasPublicasAdmin,
  updateDemandaPublicaStatus,
} from '../api/demandasPublicasApi';
import {
  downloadDemandAnexo,
  getDemandAnexos,
  removeDemandAnexo,
  uploadDemandAnexo,
} from '../api/anexosApi';
import {
  convertDemandaToFiscalizacao,
  getFiscalizacoes,
} from '../api/fiscalizacaoApi';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

const PER_PAGE = 20;

const DEFAULT_FILTERS = {
  status: '',
  categoria: '',
  prioridade: '',
  localidade: '',
  data_inicio: '',
  data_fim: '',
  busca: '',
};

const STATUS_LABELS = {
  recebida: 'Recebida',
  em_triagem: 'Em triagem',
  encaminhada: 'Encaminhada',
  em_atendimento: 'Em atendimento',
  aguardando_informacao: 'Aguardando informacao',
  encerrada_procedente: 'Encerrada procedente',
  encerrada_improcedente: 'Encerrada improcedente',
  encerrada_sem_elementos: 'Encerrada sem elementos',
  arquivada: 'Arquivada',
  em_analise: 'Em analise',
  em_vistoria: 'Em vistoria',
  respondida: 'Respondida',
  cancelada: 'Cancelada',
};

const STATUS_OPTIONS = [
  'recebida',
  'em_triagem',
  'encaminhada',
  'em_atendimento',
  'aguardando_informacao',
  'em_analise',
  'em_vistoria',
  'respondida',
  'cancelada',
];

const CLOSE_STATUS_OPTIONS = [
  'encerrada_procedente',
  'encerrada_improcedente',
  'encerrada_sem_elementos',
  'arquivada',
];

const CLOSING_STATUSES = new Set(CLOSE_STATUS_OPTIONS);

const CATEGORY_LABELS = {
  bem_estar_animal: 'Bem-estar Animal',
  licenciamento: 'Licenciamento Ambiental',
  fiscalizacao: 'Fiscalizacao Ambiental',
  poluicao_residuos: 'Poluicao e Residuos',
  outros: 'Outros assuntos ambientais',
};

const PRIORITY_LABELS = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

const MODULE_LABELS = {
  bem_estar_animal: 'Bem-estar Animal',
  licenciamento: 'Licenciamento',
  fiscalizacao: 'Fiscalizacao',
  triagem_geral: 'Triagem geral',
};

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function displayLabel(value, labels = {}) {
  if (!value) return '-';
  return labels[value] || String(value).replace(/_/g, ' ');
}

function compactError(error, fallback) {
  return error?.message || fallback;
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'anexo';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function DemandasPublicasAdmin({ user, navigateToPage }) {
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: PER_PAGE, total_items: 0, total_pages: 1 });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [statusForm, setStatusForm] = useState({ status: 'em_triagem', modulo_responsavel: '', descricao: '' });
  const [responsavelForm, setResponsavelForm] = useState({ responsavel_id: '', descricao: '' });
  const [movementForm, setMovementForm] = useState({ descricao: '' });
  const [closeForm, setCloseForm] = useState({ status: 'encerrada_sem_elementos', justificativa: '' });
  const [linkedFiscalizacao, setLinkedFiscalizacao] = useState(null);
  const [loadingFiscalizacao, setLoadingFiscalizacao] = useState(false);
  const [showConvertFiscalizacao, setShowConvertFiscalizacao] = useState(false);
  const [convertFiscalizacaoForm, setConvertFiscalizacaoForm] = useState({ justificativa_conversao: '' });
  const [anexos, setAnexos] = useState([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [anexoForm, setAnexoForm] = useState({
    arquivo: null,
    categoria_documental: 'documento',
    descricao: '',
    sensivel: false,
  });
  const canTriar = hasPermission(user, PERMISSIONS.DEMANDAS_PUBLICAS_TRIAGEM);
  const canMovimentar = hasPermission(user, PERMISSIONS.DEMANDAS_PUBLICAS_MANAGE);
  const canAtribuir = hasPermission(user, PERMISSIONS.DEMANDAS_PUBLICAS_ASSIGN);
  const canEncerrar = hasPermission(user, PERMISSIONS.DEMANDAS_PUBLICAS_CLOSE);
  const canViewSensitive = hasPermission(user, PERMISSIONS.DEMANDAS_PUBLICAS_VIEW_SENSITIVE);
  const canViewAnexos = hasPermission(user, PERMISSIONS.ANEXOS_VIEW);
  const canSendAnexos = hasPermission(user, PERMISSIONS.ANEXOS_SEND);
  const canDownloadAnexos = hasPermission(user, PERMISSIONS.ANEXOS_DOWNLOAD);
  const canRemoveAnexos = hasPermission(user, PERMISSIONS.ANEXOS_REMOVE);
  const canViewFiscalizacao = hasPermission(user, PERMISSIONS.FISCALIZACAO_VIEW);
  const canConvertFiscalizacao = hasPermission(user, PERMISSIONS.FISCALIZACAO_CREATE_FROM_DEMANDA);
  const detailClosed = detail?.status ? CLOSING_STATUSES.has(detail.status) : false;

  const metrics = useMemo(() => {
    const total = pagination.total_items || 0;
    const abertas = items.filter((item) => !CLOSING_STATUSES.has(item.status)).length;
    const urgentes = items.filter((item) => item.prioridade === 'urgente' || item.prioridade === 'alta').length;
    const semResponsavel = items.filter((item) => !item.responsavel_id).length;
    return [
      ['Total filtrado', total],
      ['Abertas nesta pagina', abertas],
      ['Alta ou urgente', urgentes],
      ['Sem responsavel', semResponsavel],
    ];
  }, [items, pagination.total_items]);

  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      try {
        setLoadingList(true);
        setError('');
        const response = await getDemandasPublicasAdmin({ ...filters, page, page_size: PER_PAGE });
        if (cancelled) return;
        const data = response.data || {};
        setItems(Array.isArray(data.items) ? data.items : []);
        setPagination(data.pagination || { page, page_size: PER_PAGE, total_items: 0, total_pages: 1 });
      } catch (err) {
        if (!cancelled) {
          setError(compactError(err, 'Nao foi possivel carregar as demandas publicas.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    }

    loadList();

    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return undefined;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        setLoadingDetail(true);
        setActionError('');
        const response = await getDemandaPublicaAdmin(selectedId);
        if (cancelled) return;
        const nextDetail = response.data || null;
        setDetail(nextDetail);
        setStatusForm({
          status: CLOSING_STATUSES.has(nextDetail?.status) ? 'em_triagem' : nextDetail?.status || 'em_triagem',
          modulo_responsavel: nextDetail?.modulo_responsavel || '',
          descricao: '',
        });
        setResponsavelForm({
          responsavel_id: nextDetail?.responsavel_id ? String(nextDetail.responsavel_id) : '',
          descricao: '',
        });
        setMovementForm({ descricao: '' });
        setCloseForm({ status: 'encerrada_sem_elementos', justificativa: '' });
        setShowConvertFiscalizacao(false);
        setConvertFiscalizacaoForm({ justificativa_conversao: '' });
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel carregar o detalhe da demanda.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!detail?.id || !canViewAnexos) {
      setAnexos([]);
      return undefined;
    }

    let cancelled = false;

    async function loadAnexos() {
      try {
        setLoadingAnexos(true);
        const response = await getDemandAnexos(detail.id);
        if (!cancelled) {
          setAnexos(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel carregar anexos da demanda.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingAnexos(false);
        }
      }
    }

    loadAnexos();

    return () => {
      cancelled = true;
    };
  }, [detail?.id, canViewAnexos]);

  useEffect(() => {
    if (!detail?.id || !canViewFiscalizacao) {
      setLinkedFiscalizacao(null);
      return undefined;
    }

    let cancelled = false;

    async function loadLinkedFiscalizacao() {
      try {
        setLoadingFiscalizacao(true);
        const response = await getFiscalizacoes({ demanda_publica_id: detail.id, page_size: 1 });
        if (!cancelled) {
          const records = response.data?.items || [];
          setLinkedFiscalizacao(records[0] || null);
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel consultar fiscalizacao vinculada.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingFiscalizacao(false);
        }
      }
    }

    loadLinkedFiscalizacao();

    return () => {
      cancelled = true;
    };
  }, [detail?.id, canViewFiscalizacao]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }

  function handleFilterSubmit(event) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  async function refreshCurrentDemand() {
    const [listResponse, detailResponse, anexosResponse, fiscalizacaoResponse] = await Promise.all([
      getDemandasPublicasAdmin({ ...filters, page, page_size: PER_PAGE }),
      selectedId ? getDemandaPublicaAdmin(selectedId) : Promise.resolve({ data: null }),
      selectedId && canViewAnexos ? getDemandAnexos(selectedId) : Promise.resolve({ data: [] }),
      selectedId && canViewFiscalizacao
        ? getFiscalizacoes({ demanda_publica_id: selectedId, page_size: 1 })
        : Promise.resolve({ data: { items: [] } }),
    ]);
    const listData = listResponse.data || {};
    setItems(Array.isArray(listData.items) ? listData.items : []);
    setPagination(listData.pagination || pagination);
    setDetail(detailResponse.data || null);
    setAnexos(Array.isArray(anexosResponse.data) ? anexosResponse.data : []);
    setLinkedFiscalizacao(fiscalizacaoResponse.data?.items?.[0] || null);
  }

  async function runAction(action, successMessage) {
    try {
      setActionError('');
      setActionMessage('');
      await action();
      await refreshCurrentDemand();
      setActionMessage(successMessage);
    } catch (err) {
      setActionError(compactError(err, 'Nao foi possivel concluir a acao.'));
    }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    await runAction(
      () => updateDemandaPublicaStatus(detail.id, statusForm),
      'Status atualizado e movimentacao registrada.'
    );
    setStatusForm((current) => ({ ...current, descricao: '' }));
  }

  async function handleResponsavelSubmit(event) {
    event.preventDefault();
    await runAction(
      () => assignDemandaPublicaResponsavel(detail.id, {
        responsavel_id: responsavelForm.responsavel_id || null,
        descricao: responsavelForm.descricao,
      }),
      'Responsavel atualizado e historico registrado.'
    );
    setResponsavelForm((current) => ({ ...current, descricao: '' }));
  }

  async function handleMovementSubmit(event) {
    event.preventDefault();
    await runAction(
      () => createDemandaPublicaMovimentacao(detail.id, movementForm),
      'Movimentacao interna registrada.'
    );
    setMovementForm({ descricao: '' });
  }

  async function handleCloseSubmit(event) {
    event.preventDefault();
    await runAction(
      () => closeDemandaPublica(detail.id, closeForm),
      'Demanda encerrada com justificativa registrada.'
    );
    setCloseForm({ status: 'encerrada_sem_elementos', justificativa: '' });
  }

  async function handleConvertFiscalizacaoSubmit(event) {
    event.preventDefault();
    await runAction(
      () => convertDemandaToFiscalizacao(detail.id, convertFiscalizacaoForm),
      'Demanda convertida em Fiscalizacao Ambiental Interna.'
    );
    setConvertFiscalizacaoForm({ justificativa_conversao: '' });
    setShowConvertFiscalizacao(false);
  }

  async function handleAnexoSubmit(event) {
    event.preventDefault();

    if (!anexoForm.arquivo) {
      setActionError('Selecione um arquivo para upload.');
      return;
    }

    const formData = new FormData();
    formData.append('arquivo', anexoForm.arquivo);
    formData.append('categoria_documental', anexoForm.categoria_documental || 'documento');
    formData.append('descricao', anexoForm.descricao || '');
    formData.append('sensivel', anexoForm.sensivel ? 'true' : 'false');

    await runAction(
      () => uploadDemandAnexo(detail.id, formData),
      'Anexo enviado com metadados e hash registrados.'
    );
    setAnexoForm({ arquivo: null, categoria_documental: 'documento', descricao: '', sensivel: false });
    event.target.reset();
  }

  async function handleDownloadAnexo(anexo) {
    await runAction(async () => {
      const blob = await downloadDemandAnexo(detail.id, anexo.id);
      downloadBlob(blob, anexo.nome_original || `anexo-${anexo.id}`);
    }, 'Download registrado em auditoria.');
  }

  async function handleRemoveAnexo(anexo) {
    const motivo = window.prompt('Informe a justificativa para remover logicamente o anexo:');
    if (!motivo) {
      setActionError('A remocao exige justificativa.');
      return;
    }

    await runAction(
      () => removeDemandAnexo(detail.id, anexo.id, { motivo_remocao: motivo }),
      'Anexo removido logicamente com justificativa.'
    );
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Demandas publicas</h2>
            <p style={styles.subtitle}>
              Triagem administrativa SMAD com dados pessoais minimizados na fila, historico operacional e encerramento justificado.
            </p>
          </div>
          <button type="button" style={styles.secondaryButton} onClick={() => setFilters({ ...filters })}>
            Atualizar
          </button>
        </div>

        {error ? <div style={styles.alertError}>{error}</div> : null}

        <div style={styles.metricsGrid}>
          {metrics.map(([label, value]) => (
            <div key={label} style={styles.metricCard}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <form style={styles.filters} onSubmit={handleFilterSubmit}>
          <Select label="Status" name="status" value={draftFilters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select label="Categoria" name="categoria" value={draftFilters.categoria} onChange={handleFilterChange}>
            <option value="">Todas</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select label="Prioridade" name="prioridade" value={draftFilters.prioridade} onChange={handleFilterChange}>
            <option value="">Todas</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input label="Localidade" name="localidade" value={draftFilters.localidade} onChange={handleFilterChange} />
          <Input label="Inicio" name="data_inicio" type="datetime-local" value={draftFilters.data_inicio} onChange={handleFilterChange} />
          <Input label="Fim" name="data_fim" type="datetime-local" value={draftFilters.data_fim} onChange={handleFilterChange} />
          <Input label="Busca" name="busca" value={draftFilters.busca} onChange={handleFilterChange} placeholder="Protocolo, relato ou local" />
          <div style={styles.filterActions}>
            <button type="submit" style={styles.primaryButton}>Aplicar filtros</button>
            <button type="button" style={styles.secondaryButton} onClick={clearFilters}>Limpar</button>
          </div>
        </form>

        {loadingList ? <p style={styles.subtitle}>Carregando demandas...</p> : null}
        {!loadingList && items.length === 0 ? (
          <p style={styles.subtitle}>Nenhuma demanda encontrada para os filtros informados.</p>
        ) : null}

        {items.length > 0 ? (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Protocolo</th>
                  <th style={styles.th}>Categoria</th>
                  <th style={styles.th}>Localidade</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Prioridade</th>
                  <th style={styles.th}>Responsavel</th>
                  <th style={styles.th}>Recebimento</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    style={selectedId === item.id ? styles.selectedRow : null}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td style={styles.td}>
                      <button type="button" style={styles.linkButton} onClick={() => setSelectedId(item.id)}>
                        {item.protocolo}
                      </button>
                      <span style={styles.mutedLine}>
                        {item.identificacao_tipo === 'identificada' ? 'Identificada' : 'Anonima'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong>{displayLabel(item.categoria, CATEGORY_LABELS)}</strong>
                      <span style={styles.mutedLine}>{displayLabel(item.subcategoria)}</span>
                    </td>
                    <td style={styles.td}>{item.bairro_localidade || '-'}</td>
                    <td style={styles.td}><StatusBadge status={item.status} /></td>
                    <td style={styles.td}><PriorityBadge prioridade={item.prioridade} /></td>
                    <td style={styles.td}>{item.responsavel_nome || (item.responsavel_id ? `Usuario #${item.responsavel_id}` : 'Nao atribuido')}</td>
                    <td style={styles.td}>{formatDateTime(item.data_recebimento)}</td>
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
            Pagina {pagination.page} de {pagination.total_pages} - {pagination.total_items} registro(s)
          </span>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={page >= pagination.total_pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Proxima
          </button>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h3 style={styles.sectionTitle}>Detalhe operacional</h3>
            <p style={styles.subtitle}>Dados completos de comunicante dependem de permissao especifica de acesso sensivel.</p>
          </div>
          {detail ? <StatusBadge status={detail.status} /> : null}
        </div>

        {!selectedId ? <p style={styles.subtitle}>Selecione uma demanda na listagem para iniciar a triagem.</p> : null}
        {loadingDetail ? <p style={styles.subtitle}>Carregando detalhe...</p> : null}
        {actionError ? <div style={styles.alertError}>{actionError}</div> : null}
        {actionMessage ? <div style={styles.alertSuccess}>{actionMessage}</div> : null}

        {detail ? (
          <div style={styles.detailGrid}>
            <div style={styles.detailMain}>
              <InfoRow label="Protocolo" value={detail.protocolo} />
              <InfoRow label="Categoria" value={`${displayLabel(detail.categoria, CATEGORY_LABELS)} / ${displayLabel(detail.subcategoria)}`} />
              <InfoRow label="Modulo sugerido" value={displayLabel(detail.modulo_sugerido, MODULE_LABELS)} />
              <InfoRow label="Modulo responsavel" value={displayLabel(detail.modulo_responsavel, MODULE_LABELS)} />
              <InfoRow label="Prioridade" value={displayLabel(detail.prioridade, PRIORITY_LABELS)} />
              <InfoRow label="Localidade" value={detail.bairro_localidade} />
              <InfoRow label="Endereco ou referencia" value={detail.endereco_referencia} />
              <InfoRow label="Ponto de referencia" value={detail.ponto_referencia} />
              <div style={styles.infoBlock}>
                <span style={styles.label}>Descricao</span>
                <p style={styles.longText}>{detail.descricao}</p>
              </div>
              <div style={styles.infoBlock}>
                <span style={styles.label}>Comunicante</span>
                {detail.identificacao_tipo === 'anonima' ? (
                  <p style={styles.longText}>Demanda registrada como anonima.</p>
                ) : canViewSensitive && !detail.dados_sensiveis_restritos ? (
                  <p style={styles.longText}>
                    {detail.nome_comunicante || '-'} | {detail.telefone_comunicante || '-'} | {detail.email_comunicante || '-'}
                  </p>
                ) : (
                  <p style={styles.longText}>Dados do comunicante restritos por LGPD e permissao interna.</p>
                )}
              </div>
              {detail.motivo_encerramento ? (
                <div style={styles.infoBlock}>
                  <span style={styles.label}>Justificativa de encerramento</span>
                  <p style={styles.longText}>{detail.motivo_encerramento}</p>
                </div>
              ) : null}
            </div>

            <aside style={styles.detailSide}>
              <InfoRow label="Responsavel" value={detail.responsavel_nome || (detail.responsavel_id ? `Usuario #${detail.responsavel_id}` : 'Nao atribuido')} />
              <InfoRow label="Recebida em" value={formatDateTime(detail.data_recebimento)} />
              <InfoRow label="Atualizada em" value={formatDateTime(detail.updated_at)} />
              <InfoRow label="Encerrada em" value={formatDateTime(detail.data_encerramento)} />

              <div style={styles.actionForm}>
                <strong>Fiscalizacao ambiental</strong>
                {loadingFiscalizacao ? <span style={styles.mutedLine}>Verificando vinculo...</span> : null}
                {linkedFiscalizacao ? (
                  <>
                    <span style={styles.mutedLine}>
                      Vinculada a {linkedFiscalizacao.protocolo_fiscalizacao} - {displayLabel(linkedFiscalizacao.status)}
                    </span>
                    <button type="button" style={styles.secondaryButton} onClick={() => navigateToPage?.('fiscalizacao')}>
                      Abrir fiscalizacao
                    </button>
                  </>
                ) : null}
                {!linkedFiscalizacao && canConvertFiscalizacao && !detailClosed ? (
                  <>
                    {!showConvertFiscalizacao ? (
                      <button type="button" style={styles.primaryButton} onClick={() => setShowConvertFiscalizacao(true)}>
                        Converter em fiscalizacao
                      </button>
                    ) : (
                      <form style={styles.inlineForm} onSubmit={handleConvertFiscalizacaoSubmit}>
                        <Textarea
                          label="Justificativa obrigatoria"
                          value={convertFiscalizacaoForm.justificativa_conversao}
                          onChange={(event) => setConvertFiscalizacaoForm({ justificativa_conversao: event.target.value })}
                          required
                        />
                        <div style={styles.filterActions}>
                          <button type="submit" style={styles.primaryButton}>Confirmar conversao</button>
                          <button type="button" style={styles.secondaryButton} onClick={() => setShowConvertFiscalizacao(false)}>Cancelar</button>
                        </div>
                      </form>
                    )}
                  </>
                ) : null}
                {!linkedFiscalizacao && (!canConvertFiscalizacao || detailClosed) ? (
                  <span style={styles.mutedLine}>Conversao indisponivel para este perfil ou status.</span>
                ) : null}
              </div>

              <div style={styles.actionsPanel}>
                <ActionForm title="Alterar status" enabled={canTriar && !detailClosed} onSubmit={handleStatusSubmit}>
                  <Select label="Novo status" name="status" value={statusForm.status} onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{displayLabel(status, STATUS_LABELS)}</option>
                    ))}
                  </Select>
                  <Select label="Modulo responsavel" name="modulo_responsavel" value={statusForm.modulo_responsavel} onChange={(event) => setStatusForm((current) => ({ ...current, modulo_responsavel: event.target.value }))}>
                    <option value="">Manter atual</option>
                    {Object.entries(MODULE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                  <Textarea label="Motivo da movimentacao" value={statusForm.descricao} onChange={(event) => setStatusForm((current) => ({ ...current, descricao: event.target.value }))} required />
                  <button type="submit" style={styles.primaryButton}>Salvar status</button>
                </ActionForm>

                <ActionForm title="Atribuir responsavel" enabled={canAtribuir && !detailClosed} onSubmit={handleResponsavelSubmit}>
                  <Input label="ID do responsavel" name="responsavel_id" value={responsavelForm.responsavel_id} onChange={(event) => setResponsavelForm((current) => ({ ...current, responsavel_id: event.target.value }))} placeholder="Opcional" />
                  <Textarea label="Observacao" value={responsavelForm.descricao} onChange={(event) => setResponsavelForm((current) => ({ ...current, descricao: event.target.value }))} />
                  <button type="submit" style={styles.secondaryButton}>Atualizar responsavel</button>
                </ActionForm>

                <ActionForm title="Movimentacao interna" enabled={canMovimentar && !detailClosed} onSubmit={handleMovementSubmit}>
                  <Textarea label="Registro interno" value={movementForm.descricao} onChange={(event) => setMovementForm({ descricao: event.target.value })} required />
                  <button type="submit" style={styles.secondaryButton}>Registrar movimentacao</button>
                </ActionForm>

                <ActionForm title="Encerramento" enabled={canEncerrar && !detailClosed} onSubmit={handleCloseSubmit}>
                  <Select label="Resultado" name="status" value={closeForm.status} onChange={(event) => setCloseForm((current) => ({ ...current, status: event.target.value }))}>
                    {CLOSE_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{displayLabel(status, STATUS_LABELS)}</option>
                    ))}
                  </Select>
                  <Textarea label="Justificativa obrigatoria" value={closeForm.justificativa} onChange={(event) => setCloseForm((current) => ({ ...current, justificativa: event.target.value }))} required />
                  <button type="submit" style={styles.dangerButton}>Encerrar demanda</button>
                </ActionForm>
              </div>
            </aside>

            <div style={styles.attachmentsPanel}>
              <div style={styles.header}>
                <div>
                  <h4 style={styles.historyTitle}>Anexos</h4>
                  <p style={styles.subtitle}>Arquivos privados vinculados ao protocolo, com download autenticado e auditoria.</p>
                </div>
              </div>

              {canSendAnexos ? (
                <form style={styles.attachmentForm} onSubmit={handleAnexoSubmit}>
                  <label style={styles.field}>
                    <span style={styles.label}>Arquivo</span>
                    <input
                      type="file"
                      style={styles.fileInput}
                      onChange={(event) => setAnexoForm((current) => ({ ...current, arquivo: event.target.files?.[0] || null }))}
                    />
                  </label>
                  <Input
                    label="Categoria documental"
                    name="categoria_documental"
                    value={anexoForm.categoria_documental}
                    onChange={(event) => setAnexoForm((current) => ({ ...current, categoria_documental: event.target.value }))}
                  />
                  <Textarea
                    label="Descricao"
                    value={anexoForm.descricao}
                    onChange={(event) => setAnexoForm((current) => ({ ...current, descricao: event.target.value }))}
                  />
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={anexoForm.sensivel}
                      onChange={(event) => setAnexoForm((current) => ({ ...current, sensivel: event.target.checked }))}
                    />
                    <span>Classificar como sensivel</span>
                  </label>
                  <button type="submit" style={styles.primaryButton}>Enviar anexo</button>
                </form>
              ) : (
                <p style={styles.subtitle}>Seu perfil nao possui permissao para enviar anexos.</p>
              )}

              {loadingAnexos ? <p style={styles.subtitle}>Carregando anexos...</p> : null}
              {!loadingAnexos && anexos.length === 0 ? (
                <p style={styles.subtitle}>Nenhum anexo vinculado a esta demanda.</p>
              ) : null}

              {anexos.length > 0 ? (
                <div style={styles.attachmentsList}>
                  {anexos.map((anexo) => (
                    <div key={anexo.id} style={styles.attachmentItem}>
                      <div>
                        <strong>{anexo.nome_original}</strong>
                        <span style={styles.mutedLine}>
                          {anexo.mime_type} - {formatBytes(anexo.tamanho_bytes)} - {formatDateTime(anexo.criado_em)}
                        </span>
                        <span style={styles.mutedLine}>
                          Hash: {anexo.hash_sha256 ? `${anexo.hash_sha256.slice(0, 16)}...` : '-'}
                          {anexo.sensivel ? ' - sensivel' : ''}
                        </span>
                        <span style={styles.mutedLine}>
                          Enviado por: {anexo.enviado_por_nome || (anexo.enviado_por_id ? `Usuario #${anexo.enviado_por_id}` : '-')}
                        </span>
                      </div>
                      <div style={styles.attachmentActions}>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          disabled={!canDownloadAnexos}
                          onClick={() => handleDownloadAnexo(anexo)}
                        >
                          Baixar
                        </button>
                        <button
                          type="button"
                          style={styles.dangerButton}
                          disabled={!canRemoveAnexos}
                          onClick={() => handleRemoveAnexo(anexo)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={styles.historyPanel}>
              <h4 style={styles.historyTitle}>Historico e movimentacoes</h4>
              {(detail.movimentacoes || []).length === 0 ? (
                <p style={styles.subtitle}>Nenhuma movimentacao registrada.</p>
              ) : (
                <div style={styles.timeline}>
                  {detail.movimentacoes.map((movimentacao) => (
                    <div key={movimentacao.id} style={styles.timelineItem}>
                      <strong>{formatDateTime(movimentacao.created_at)}</strong>
                      <span>
                        {displayLabel(movimentacao.status_anterior, STATUS_LABELS)} para {displayLabel(movimentacao.status_novo, STATUS_LABELS)}
                      </span>
                      <p>{movimentacao.descricao}</p>
                      <small>{movimentacao.usuario_nome || 'Registro publico ou sistema'}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
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

function Textarea({ label, value, onChange, required = false }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <textarea value={value} onChange={onChange} required={required} style={styles.textarea} />
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.label}>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function ActionForm({ title, enabled, children, onSubmit }) {
  return (
    <form style={{ ...styles.actionForm, ...(enabled ? null : styles.actionFormDisabled) }} onSubmit={onSubmit}>
      <strong>{title}</strong>
      {enabled ? children : <span style={styles.mutedLine}>Acao indisponivel para este perfil ou status.</span>}
    </form>
  );
}

function StatusBadge({ status }) {
  const closing = CLOSING_STATUSES.has(status);
  const warning = status === 'aguardando_informacao' || status === 'encaminhada';
  const style = closing ? styles.badgeMuted : warning ? styles.badgeWarning : styles.badgeInfo;
  return <span style={style}>{displayLabel(status, STATUS_LABELS)}</span>;
}

function PriorityBadge({ prioridade }) {
  if (prioridade === 'urgente') return <span style={styles.badgeDanger}>{displayLabel(prioridade, PRIORITY_LABELS)}</span>;
  if (prioridade === 'alta') return <span style={styles.badgeWarning}>{displayLabel(prioridade, PRIORITY_LABELS)}</span>;
  return <span style={styles.badgeInfo}>{displayLabel(prioridade, PRIORITY_LABELS)}</span>;
}

const styles = {
  page: { display: 'grid', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  sectionTitle: { margin: 0, marginBottom: '8px', fontSize: '20px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '14px' },
  metricCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', background: '#f9fafb', display: 'grid', gap: '8px', color: '#374151' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '12px', alignItems: 'end', marginBottom: '18px' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { minHeight: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff', color: '#111827' },
  fileInput: { minHeight: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', background: '#ffffff', color: '#111827' },
  textarea: { minHeight: '96px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', background: '#ffffff', color: '#111827', resize: 'vertical' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontSize: '13px', fontWeight: 700 },
  filterActions: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  primaryButton: { minHeight: '40px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
  secondaryButton: { minHeight: '40px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  dangerButton: { minHeight: '40px', border: '1px solid #991b1b', borderRadius: '8px', background: '#b91c1c', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '980px', background: '#ffffff' },
  th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '13px' },
  td: { padding: '12px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', verticalAlign: 'top', cursor: 'pointer' },
  selectedRow: { background: '#f0fdf4' },
  linkButton: { border: 'none', background: 'transparent', color: '#166534', cursor: 'pointer', padding: 0, fontWeight: 800, textAlign: 'left' },
  mutedLine: { display: 'block', marginTop: '4px', color: '#6b7280', fontSize: '12px', lineHeight: 1.4 },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '16px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '18px' },
  detailMain: { display: 'grid', gap: '12px' },
  detailSide: { display: 'grid', gap: '12px', alignContent: 'start' },
  infoRow: { display: 'grid', gap: '4px', borderBottom: '1px solid #f3f4f6', paddingBottom: '10px', color: '#111827' },
  infoBlock: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', background: '#ffffff', display: 'grid', gap: '6px' },
  longText: { margin: 0, color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap' },
  actionsPanel: { display: 'grid', gap: '12px' },
  actionForm: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', display: 'grid', gap: '10px', background: '#f9fafb' },
  actionFormDisabled: { color: '#6b7280', background: '#f3f4f6' },
  inlineForm: { display: 'grid', gap: '10px' },
  attachmentsPanel: { gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', paddingTop: '18px', display: 'grid', gap: '14px' },
  attachmentForm: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px', alignItems: 'end', background: '#f9fafb' },
  attachmentsList: { display: 'grid', gap: '10px' },
  attachmentItem: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', background: '#ffffff' },
  attachmentActions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  historyPanel: { gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', paddingTop: '18px' },
  historyTitle: { margin: '0 0 12px', color: '#111827', fontSize: '18px' },
  timeline: { display: 'grid', gap: '10px' },
  timelineItem: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'grid', gap: '4px', color: '#374151', background: '#ffffff' },
  badgeInfo: { display: 'inline-block', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', color: '#1d4ed8', padding: '5px 8px', fontWeight: 700 },
  badgeWarning: { display: 'inline-block', border: '1px solid #fde68a', borderRadius: '8px', background: '#fffbeb', color: '#92400e', padding: '5px 8px', fontWeight: 700 },
  badgeDanger: { display: 'inline-block', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '5px 8px', fontWeight: 700 },
  badgeMuted: { display: 'inline-block', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', color: '#4b5563', padding: '5px 8px', fontWeight: 700 },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginBottom: '12px' },
  alertSuccess: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '12px', fontSize: '14px', marginBottom: '12px' },
};
