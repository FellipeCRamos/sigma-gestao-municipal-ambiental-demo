import { useEffect, useMemo, useState } from 'react';
import {
  assignVistoriaResponsavel,
  cancelVistoria,
  createRelatorioPreliminar,
  createRelatorioPreliminarMovimentacao,
  createVistoriaMovimentacao,
  downloadVistoriaAnexo,
  getRelatorioPreliminar,
  getVistoria,
  getVistoriaAnexos,
  getVistorias,
  registerVistoriaRealizacao,
  updateRelatorioPreliminar,
  updateRelatorioPreliminarStatus,
  updateVistoriaStatus,
  uploadVistoriaAnexo,
} from '../api/vistoriasApi';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

const PER_PAGE = 20;

const DEFAULT_FILTERS = {
  protocolo: '',
  status: '',
  prioridade: '',
  fiscalizacao_id: '',
  responsavel_id: '',
  localidade: '',
  data_inicio: '',
  data_fim: '',
  busca: '',
};

const VISTORIA_STATUS_LABELS = {
  planejada: 'Planejada',
  agendada: 'Agendada',
  em_execucao: 'Em execucao',
  realizada: 'Realizada',
  relatorio_em_elaboracao: 'Relatorio em elaboracao',
  relatorio_emitido: 'Relatorio emitido',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada',
};

const VISTORIA_STATUS_OPTIONS = [
  'planejada',
  'agendada',
  'em_execucao',
  'realizada',
  'relatorio_em_elaboracao',
  'relatorio_emitido',
  'arquivada',
];

const REPORT_STATUS_LABELS = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisao',
  revisado: 'Revisado',
  emitido_preliminarmente: 'Emitido preliminarmente',
  arquivado: 'Arquivado',
};

const REPORT_STATUS_OPTIONS = ['rascunho', 'em_revisao', 'revisado', 'emitido_preliminarmente', 'arquivado'];

const PRIORITY_LABELS = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

const EMPTY_REPORT_FORM = {
  introducao: '',
  historico: '',
  caracterizacao_area: '',
  caracterizacao_demanda: '',
  metodologia: '',
  constatacoes_tecnicas: '',
  analise_tecnica_preliminar: '',
  registros_fotograficos_descricao: '',
  conclusao_preliminar: '',
  recomendacoes: '',
  encaminhamentos_sugeridos: '',
  limitacoes: 'Relatorio tecnico preliminar interno, sem efeito sancionador automatico e sem decisao administrativa final.',
  observacoes_internas: '',
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
  anchor.download = filename || 'anexo-vistoria';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function reportFormFromDetail(relatorio) {
  return Object.keys(EMPTY_REPORT_FORM).reduce((acc, key) => {
    acc[key] = relatorio?.[key] || EMPTY_REPORT_FORM[key] || '';
    return acc;
  }, {});
}

export default function VistoriasAmbientais({ user, navigateToPage }) {
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: PER_PAGE, total_items: 0, total_pages: 1 });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [anexos, setAnexos] = useState({ herdados: [], proprios: [] });
  const [relatorio, setRelatorio] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [statusForm, setStatusForm] = useState({ status: 'agendada', descricao: '' });
  const [responsavelForm, setResponsavelForm] = useState({ responsavel_id: '', descricao: '' });
  const [movementForm, setMovementForm] = useState({ descricao: '' });
  const [realizacaoForm, setRealizacaoForm] = useState({
    data_realizada: '',
    objetivo: '',
    metodologia_resumida: '',
    constatacoes: '',
    evidencias_observadas: '',
    riscos_identificados: '',
    providencias_recomendadas: '',
  });
  const [cancelForm, setCancelForm] = useState({ justificativa_cancelamento: '' });
  const [reportForm, setReportForm] = useState(EMPTY_REPORT_FORM);
  const [reportStatusForm, setReportStatusForm] = useState({ status: 'em_revisao', descricao: '' });
  const [reportMovementForm, setReportMovementForm] = useState({ descricao: '' });
  const [uploadForm, setUploadForm] = useState({ categoria_documental: 'evidencia_vistoria', descricao: '', sensivel: false });
  const [uploadFile, setUploadFile] = useState(null);

  const canUpdateStatus = hasPermission(user, PERMISSIONS.VISTORIA_UPDATE_STATUS);
  const canAssign = hasPermission(user, PERMISSIONS.VISTORIA_ASSIGN);
  const canMove = hasPermission(user, PERMISSIONS.VISTORIA_MOVE);
  const canRegister = hasPermission(user, PERMISSIONS.VISTORIA_REGISTER);
  const canCancel = hasPermission(user, PERMISSIONS.VISTORIA_CANCEL);
  const canViewAnexos = hasPermission(user, PERMISSIONS.VISTORIA_VIEW_ANEXOS) && hasPermission(user, PERMISSIONS.ANEXOS_VIEW);
  const canSendAnexos = hasPermission(user, PERMISSIONS.ANEXOS_SEND);
  const canDownloadAnexos = hasPermission(user, PERMISSIONS.ANEXOS_DOWNLOAD);
  const canCreateReport = hasPermission(user, PERMISSIONS.RELATORIO_PRELIMINAR_CREATE);
  const canEditReport = hasPermission(user, PERMISSIONS.RELATORIO_PRELIMINAR_EDIT);
  const canUpdateReportStatus = hasPermission(user, PERMISSIONS.RELATORIO_PRELIMINAR_UPDATE_STATUS);
  const canMoveReport = hasPermission(user, PERMISSIONS.RELATORIO_PRELIMINAR_MOVE);
  const detailClosed = detail?.status === 'cancelada' || detail?.status === 'arquivada';

  const metrics = useMemo(() => {
    const total = pagination.total_items || 0;
    const abertas = items.filter((item) => item.status !== 'cancelada' && item.status !== 'arquivada').length;
    const realizadas = items.filter((item) => item.status === 'realizada' || item.status === 'relatorio_emitido').length;
    const comRelatorio = items.filter((item) => item.relatorio_id).length;
    return [
      ['Total filtrado', total],
      ['Abertas nesta pagina', abertas],
      ['Realizadas', realizadas],
      ['Com relatorio', comRelatorio],
    ];
  }, [items, pagination.total_items]);

  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      try {
        setLoadingList(true);
        setError('');
        const response = await getVistorias({ ...filters, page, page_size: PER_PAGE });
        if (cancelled) return;
        const data = response.data || {};
        setItems(Array.isArray(data.items) ? data.items : []);
        setPagination(data.pagination || { page, page_size: PER_PAGE, total_items: 0, total_pages: 1 });
      } catch (err) {
        if (!cancelled) {
          setError(compactError(err, 'Nao foi possivel carregar vistorias ambientais.'));
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
      setAnexos({ herdados: [], proprios: [] });
      setRelatorio(null);
      setReportForm(EMPTY_REPORT_FORM);
      return undefined;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        setLoadingDetail(true);
        setActionError('');
        const response = await getVistoria(selectedId);
        if (cancelled) return;
        const nextDetail = response.data || null;
        setDetail(nextDetail);
        setStatusForm({ status: nextDetail?.status === 'cancelada' ? 'agendada' : nextDetail?.status || 'agendada', descricao: '' });
        setResponsavelForm({ responsavel_id: nextDetail?.responsavel_id ? String(nextDetail.responsavel_id) : '', descricao: '' });
        setMovementForm({ descricao: '' });
        setRealizacaoForm({
          data_realizada: '',
          objetivo: nextDetail?.objetivo || '',
          metodologia_resumida: nextDetail?.metodologia_resumida || '',
          constatacoes: nextDetail?.constatacoes || '',
          evidencias_observadas: nextDetail?.evidencias_observadas || '',
          riscos_identificados: nextDetail?.riscos_identificados || '',
          providencias_recomendadas: nextDetail?.providencias_recomendadas || '',
        });
        setCancelForm({ justificativa_cancelamento: '' });

        const firstReport = nextDetail?.relatorios?.[0];
        if (firstReport?.id) {
          const reportResponse = await getRelatorioPreliminar(firstReport.id);
          if (!cancelled) {
            setRelatorio(reportResponse.data || null);
            setReportForm(reportFormFromDetail(reportResponse.data || null));
            setReportStatusForm({ status: reportResponse.data?.status || 'em_revisao', descricao: '' });
          }
        } else {
          setRelatorio(null);
          setReportForm({
            ...EMPTY_REPORT_FORM,
            historico: nextDetail
              ? `Vistoria ${nextDetail.protocolo_vistoria} vinculada a fiscalizacao ${nextDetail.protocolo_fiscalizacao}.`
              : EMPTY_REPORT_FORM.historico,
            caracterizacao_area: nextDetail?.localidade || '',
            caracterizacao_demanda: nextDetail?.assunto || '',
            metodologia: nextDetail?.metodologia_resumida || '',
            constatacoes_tecnicas: nextDetail?.constatacoes || '',
          });
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel carregar o detalhe da vistoria.'));
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
    if (!selectedId || !canViewAnexos) {
      setAnexos({ herdados: [], proprios: [] });
      return undefined;
    }

    let cancelled = false;

    async function loadAnexos() {
      try {
        setLoadingAnexos(true);
        const response = await getVistoriaAnexos(selectedId);
        if (!cancelled) {
          setAnexos(response.data || { herdados: [], proprios: [] });
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel carregar anexos da vistoria.'));
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
  }, [selectedId, canViewAnexos]);

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

  async function refreshCurrent() {
    const [listResponse, detailResponse, anexosResponse] = await Promise.all([
      getVistorias({ ...filters, page, page_size: PER_PAGE }),
      selectedId ? getVistoria(selectedId) : Promise.resolve({ data: null }),
      selectedId && canViewAnexos ? getVistoriaAnexos(selectedId) : Promise.resolve({ data: { herdados: [], proprios: [] } }),
    ]);
    const listData = listResponse.data || {};
    const nextDetail = detailResponse.data || null;
    setItems(Array.isArray(listData.items) ? listData.items : []);
    setPagination(listData.pagination || pagination);
    setDetail(nextDetail);
    setAnexos(anexosResponse.data || { herdados: [], proprios: [] });

    const firstReport = nextDetail?.relatorios?.[0];
    if (firstReport?.id) {
      const reportResponse = await getRelatorioPreliminar(firstReport.id);
      setRelatorio(reportResponse.data || null);
      setReportForm(reportFormFromDetail(reportResponse.data || null));
    }
  }

  async function runAction(action, successMessage) {
    try {
      setActionError('');
      setActionMessage('');
      await action();
      await refreshCurrent();
      setActionMessage(successMessage);
    } catch (err) {
      setActionError(compactError(err, 'Nao foi possivel concluir a acao.'));
    }
  }

  async function handleStatusSubmit(event) {
    event.preventDefault();
    await runAction(() => updateVistoriaStatus(detail.id, statusForm), 'Status da vistoria atualizado e auditado.');
    setStatusForm((current) => ({ ...current, descricao: '' }));
  }

  async function handleResponsavelSubmit(event) {
    event.preventDefault();
    await runAction(
      () => assignVistoriaResponsavel(detail.id, {
        responsavel_id: responsavelForm.responsavel_id || null,
        descricao: responsavelForm.descricao,
      }),
      'Responsavel da vistoria atualizado.'
    );
    setResponsavelForm((current) => ({ ...current, descricao: '' }));
  }

  async function handleMovementSubmit(event) {
    event.preventDefault();
    await runAction(() => createVistoriaMovimentacao(detail.id, movementForm), 'Movimentacao da vistoria registrada.');
    setMovementForm({ descricao: '' });
  }

  async function handleRealizacaoSubmit(event) {
    event.preventDefault();
    await runAction(() => registerVistoriaRealizacao(detail.id, realizacaoForm), 'Realizacao da vistoria registrada.');
  }

  async function handleCancelSubmit(event) {
    event.preventDefault();
    await runAction(() => cancelVistoria(detail.id, cancelForm), 'Vistoria cancelada com justificativa registrada.');
    setCancelForm({ justificativa_cancelamento: '' });
  }

  async function handleReportSubmit(event) {
    event.preventDefault();
    await runAction(async () => {
      if (relatorio?.id) {
        await updateRelatorioPreliminar(relatorio.id, reportForm);
        return;
      }
      await createRelatorioPreliminar(detail.id, reportForm);
    }, relatorio?.id ? 'Relatorio preliminar atualizado.' : 'Relatorio preliminar criado em rascunho.');
  }

  async function handleReportStatusSubmit(event) {
    event.preventDefault();
    await runAction(
      () => updateRelatorioPreliminarStatus(relatorio.id, reportStatusForm),
      'Status do relatorio preliminar atualizado.'
    );
    setReportStatusForm((current) => ({ ...current, descricao: '' }));
  }

  async function handleReportMovementSubmit(event) {
    event.preventDefault();
    await runAction(
      () => createRelatorioPreliminarMovimentacao(relatorio.id, reportMovementForm),
      'Movimentacao do relatorio preliminar registrada.'
    );
    setReportMovementForm({ descricao: '' });
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();
    if (!uploadFile) {
      setActionError('Selecione um arquivo para anexar a vistoria.');
      return;
    }

    const form = new FormData();
    form.append('arquivo', uploadFile);
    form.append('categoria_documental', uploadForm.categoria_documental);
    form.append('descricao', uploadForm.descricao);
    form.append('sensivel', uploadForm.sensivel ? 'true' : 'false');

    await runAction(() => uploadVistoriaAnexo(detail.id, form), 'Anexo proprio da vistoria enviado com metadados.');
    setUploadFile(null);
    setUploadForm({ categoria_documental: 'evidencia_vistoria', descricao: '', sensivel: false });
  }

  async function handleDownloadAnexo(anexo) {
    await runAction(async () => {
      if (anexo.origem_vinculo !== 'vistoria_ambiental') {
        throw new Error('Baixe anexos herdados pelo modulo de Demandas Publicas ou Fiscalizacao.');
      }
      const blob = await downloadVistoriaAnexo(detail.id, anexo.id);
      downloadBlob(blob, anexo.nome_original || `anexo-vistoria-${anexo.id}`);
    }, 'Download do anexo da vistoria registrado em auditoria.');
  }

  function updateReportField(field, value) {
    setReportForm((current) => ({ ...current, [field]: value }));
  }

  const allAnexos = [...(anexos.herdados || []), ...(anexos.proprios || [])];

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Vistorias ambientais</h2>
            <p style={styles.subtitle}>
              Registro tecnico interno vinculado a Fiscalizacao Ambiental. Nao cria auto, notificacao formal, multa, embargo, apreensao ou decisao administrativa final.
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
          <Input label="Protocolo" name="protocolo" value={draftFilters.protocolo} onChange={handleFilterChange} placeholder="SIGMA-VIST, SIGMA-FISC ou SIGMA-DEN" />
          <Select label="Status" name="status" value={draftFilters.status} onChange={handleFilterChange}>
            <option value="">Todos</option>
            {Object.entries(VISTORIA_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select label="Prioridade" name="prioridade" value={draftFilters.prioridade} onChange={handleFilterChange}>
            <option value="">Todas</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input label="Fiscalizacao ID" name="fiscalizacao_id" value={draftFilters.fiscalizacao_id} onChange={handleFilterChange} />
          <Input label="Responsavel ID" name="responsavel_id" value={draftFilters.responsavel_id} onChange={handleFilterChange} />
          <Input label="Localidade" name="localidade" value={draftFilters.localidade} onChange={handleFilterChange} />
          <Input label="Inicio" name="data_inicio" type="datetime-local" value={draftFilters.data_inicio} onChange={handleFilterChange} />
          <Input label="Fim" name="data_fim" type="datetime-local" value={draftFilters.data_fim} onChange={handleFilterChange} />
          <Input label="Busca" name="busca" value={draftFilters.busca} onChange={handleFilterChange} placeholder="Objetivo, local ou protocolo" />
          <div style={styles.filterActions}>
            <button type="submit" style={styles.primaryButton}>Aplicar filtros</button>
            <button type="button" style={styles.secondaryButton} onClick={clearFilters}>Limpar</button>
          </div>
        </form>

        {loadingList ? <p style={styles.subtitle}>Carregando vistorias...</p> : null}
        {!loadingList && items.length === 0 ? (
          <p style={styles.subtitle}>Nenhuma vistoria encontrada para os filtros informados.</p>
        ) : null}

        {items.length > 0 ? (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Vistoria</th>
                  <th style={styles.th}>Fiscalizacao</th>
                  <th style={styles.th}>Localidade</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Prioridade</th>
                  <th style={styles.th}>Responsavel</th>
                  <th style={styles.th}>Relatorio</th>
                  <th style={styles.th}>Criacao</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={selectedId === item.id ? styles.selectedRow : null} onClick={() => setSelectedId(item.id)}>
                    <td style={styles.td}>
                      <button type="button" style={styles.linkButton} onClick={() => setSelectedId(item.id)}>
                        {item.protocolo_vistoria}
                      </button>
                      <span style={styles.mutedLine}>{item.finalidade || item.tipo_vistoria}</span>
                    </td>
                    <td style={styles.td}>
                      {item.protocolo_fiscalizacao}
                      <span style={styles.mutedLine}>{item.protocolo_demanda || '-'}</span>
                    </td>
                    <td style={styles.td}>{item.localidade || '-'}</td>
                    <td style={styles.td}><StatusBadge status={item.status} /></td>
                    <td style={styles.td}><PriorityBadge prioridade={item.prioridade} /></td>
                    <td style={styles.td}>{item.responsavel_nome || (item.responsavel_id ? `Usuario #${item.responsavel_id}` : 'Nao atribuido')}</td>
                    <td style={styles.td}>
                      {item.protocolo_relatorio || 'Sem relatorio'}
                      {item.relatorio_status ? <span style={styles.mutedLine}>{displayLabel(item.relatorio_status, REPORT_STATUS_LABELS)}</span> : null}
                    </td>
                    <td style={styles.td}>{formatDateTime(item.created_at)}</td>
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
            <h3 style={styles.sectionTitle}>Detalhe da vistoria e relatorio preliminar</h3>
            <p style={styles.subtitle}>Peca tecnica interna de instrucao, sem assinatura digital e sem envio externo.</p>
          </div>
          {detail ? <StatusBadge status={detail.status} /> : null}
        </div>

        {!selectedId ? <p style={styles.subtitle}>Selecione uma vistoria na listagem.</p> : null}
        {loadingDetail ? <p style={styles.subtitle}>Carregando detalhe...</p> : null}
        {actionError ? <div style={styles.alertError}>{actionError}</div> : null}
        {actionMessage ? <div style={styles.alertSuccess}>{actionMessage}</div> : null}

        {detail ? (
          <div style={styles.detailGrid}>
            <div style={styles.detailMain}>
              <InfoRow label="Protocolo da vistoria" value={detail.protocolo_vistoria} />
              <InfoRow label="Fiscalizacao vinculada" value={detail.protocolo_fiscalizacao} />
              <InfoRow label="Demanda originaria" value={detail.protocolo_demanda} />
              <InfoRow label="Finalidade" value={detail.finalidade} />
              <InfoRow label="Tipo" value={displayLabel(detail.tipo_vistoria)} />
              <InfoRow label="Localidade" value={detail.localidade} />
              <InfoRow label="Endereco ou referencia" value={detail.endereco_referencia} />
              <InfoRow label="Data planejada" value={formatDateTime(detail.data_planejada)} />
              <InfoRow label="Data realizada" value={formatDateTime(detail.data_realizada)} />
              <div style={styles.infoBlock}>
                <span style={styles.label}>Objetivo</span>
                <p style={styles.longText}>{detail.objetivo}</p>
              </div>
              {detail.constatacoes ? (
                <div style={styles.infoBlock}>
                  <span style={styles.label}>Constatacoes</span>
                  <p style={styles.longText}>{detail.constatacoes}</p>
                </div>
              ) : null}
            </div>

            <aside style={styles.detailSide}>
              <InfoRow label="Responsavel" value={detail.responsavel_nome || (detail.responsavel_id ? `Usuario #${detail.responsavel_id}` : 'Nao atribuido')} />
              <InfoRow label="Criada por" value={detail.criado_por_nome || (detail.criado_por_id ? `Usuario #${detail.criado_por_id}` : '-')} />
              <InfoRow label="Criada em" value={formatDateTime(detail.created_at)} />
              <InfoRow label="Atualizada em" value={formatDateTime(detail.updated_at)} />
              <button type="button" style={styles.secondaryButton} onClick={() => navigateToPage?.('fiscalizacao')}>
                Abrir fiscalizacao
              </button>

              <div style={styles.actionsPanel}>
                <ActionForm title="Alterar status" enabled={canUpdateStatus && !detailClosed} onSubmit={handleStatusSubmit}>
                  <Select label="Novo status" name="status" value={statusForm.status} onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}>
                    {VISTORIA_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{displayLabel(status, VISTORIA_STATUS_LABELS)}</option>
                    ))}
                  </Select>
                  <Textarea label="Motivo da movimentacao" value={statusForm.descricao} onChange={(event) => setStatusForm((current) => ({ ...current, descricao: event.target.value }))} required />
                  <button type="submit" style={styles.primaryButton}>Salvar status</button>
                </ActionForm>

                <ActionForm title="Atribuir responsavel" enabled={canAssign && !detailClosed} onSubmit={handleResponsavelSubmit}>
                  <Input label="ID do responsavel" name="responsavel_id" value={responsavelForm.responsavel_id} onChange={(event) => setResponsavelForm((current) => ({ ...current, responsavel_id: event.target.value }))} />
                  <Textarea label="Observacao" value={responsavelForm.descricao} onChange={(event) => setResponsavelForm((current) => ({ ...current, descricao: event.target.value }))} />
                  <button type="submit" style={styles.secondaryButton}>Atualizar responsavel</button>
                </ActionForm>

                <ActionForm title="Movimentacao interna" enabled={canMove && !detailClosed} onSubmit={handleMovementSubmit}>
                  <Textarea label="Registro interno" value={movementForm.descricao} onChange={(event) => setMovementForm({ descricao: event.target.value })} required />
                  <button type="submit" style={styles.secondaryButton}>Registrar movimentacao</button>
                </ActionForm>
              </div>
            </aside>

            <div style={styles.fullPanel}>
              <h4 style={styles.historyTitle}>Registro de realizacao</h4>
              <ActionForm title="Registrar realizacao da vistoria" enabled={canRegister && !detailClosed} onSubmit={handleRealizacaoSubmit}>
                <div style={styles.formGrid}>
                  <Input label="Data realizada" name="data_realizada" type="datetime-local" value={realizacaoForm.data_realizada} onChange={(event) => setRealizacaoForm((current) => ({ ...current, data_realizada: event.target.value }))} />
                  <Textarea label="Objetivo" value={realizacaoForm.objetivo} onChange={(event) => setRealizacaoForm((current) => ({ ...current, objetivo: event.target.value }))} />
                  <Textarea label="Metodologia resumida" value={realizacaoForm.metodologia_resumida} onChange={(event) => setRealizacaoForm((current) => ({ ...current, metodologia_resumida: event.target.value }))} />
                  <Textarea label="Constatacoes" value={realizacaoForm.constatacoes} onChange={(event) => setRealizacaoForm((current) => ({ ...current, constatacoes: event.target.value }))} />
                  <Textarea label="Evidencias observadas" value={realizacaoForm.evidencias_observadas} onChange={(event) => setRealizacaoForm((current) => ({ ...current, evidencias_observadas: event.target.value }))} />
                  <Textarea label="Riscos identificados" value={realizacaoForm.riscos_identificados} onChange={(event) => setRealizacaoForm((current) => ({ ...current, riscos_identificados: event.target.value }))} />
                  <Textarea label="Providencias recomendadas" value={realizacaoForm.providencias_recomendadas} onChange={(event) => setRealizacaoForm((current) => ({ ...current, providencias_recomendadas: event.target.value }))} />
                </div>
                <button type="submit" style={styles.primaryButton}>Registrar realizacao</button>
              </ActionForm>

              <ActionForm title="Cancelar vistoria" enabled={canCancel && !detailClosed} onSubmit={handleCancelSubmit}>
                <Textarea label="Justificativa obrigatoria" value={cancelForm.justificativa_cancelamento} onChange={(event) => setCancelForm({ justificativa_cancelamento: event.target.value })} required />
                <button type="submit" style={styles.dangerButton}>Cancelar vistoria</button>
              </ActionForm>
            </div>

            <div style={styles.fullPanel}>
              <div style={styles.header}>
                <div>
                  <h4 style={styles.historyTitle}>Anexos da vistoria</h4>
                  <p style={styles.subtitle}>Anexos herdados da demanda e anexos proprios da vistoria sao controlados por RBAC.</p>
                </div>
              </div>

              {!canViewAnexos ? <p style={styles.subtitle}>Seu perfil nao possui permissao para visualizar anexos.</p> : null}
              {loadingAnexos ? <p style={styles.subtitle}>Carregando anexos...</p> : null}
              {canViewAnexos && !loadingAnexos && allAnexos.length === 0 ? <p style={styles.subtitle}>Nenhum anexo vinculado.</p> : null}

              {allAnexos.length > 0 ? (
                <div style={styles.attachmentsList}>
                  {allAnexos.map((anexo) => (
                    <div key={`${anexo.origem_vinculo}-${anexo.id}`} style={styles.attachmentItem}>
                      <div>
                        <strong>{anexo.nome_original}</strong>
                        <span style={styles.mutedLine}>
                          {displayLabel(anexo.origem_vinculo)} - {anexo.mime_type} - {formatBytes(anexo.tamanho_bytes)}
                        </span>
                        <span style={styles.mutedLine}>
                          Hash: {anexo.hash_sha256 ? `${anexo.hash_sha256.slice(0, 16)}...` : 'restrito'}
                          {anexo.sensivel ? ' - sensivel' : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        disabled={!canDownloadAnexos || anexo.dados_sensiveis_restritos || anexo.origem_vinculo !== 'vistoria_ambiental'}
                        onClick={() => handleDownloadAnexo(anexo)}
                      >
                        Baixar
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <ActionForm title="Enviar anexo proprio" enabled={canSendAnexos && !detailClosed} onSubmit={handleUploadSubmit}>
                <div style={styles.formGrid}>
                  <Input label="Categoria documental" name="categoria_documental" value={uploadForm.categoria_documental} onChange={(event) => setUploadForm((current) => ({ ...current, categoria_documental: event.target.value }))} />
                  <Textarea label="Descricao" value={uploadForm.descricao} onChange={(event) => setUploadForm((current) => ({ ...current, descricao: event.target.value }))} />
                  <label style={styles.field}>
                    <span style={styles.label}>Arquivo</span>
                    <input type="file" style={styles.input} onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
                  </label>
                  <label style={styles.checkField}>
                    <input type="checkbox" checked={uploadForm.sensivel} onChange={(event) => setUploadForm((current) => ({ ...current, sensivel: event.target.checked }))} />
                    <span>Anexo sensivel</span>
                  </label>
                </div>
                <button type="submit" style={styles.primaryButton}>Enviar anexo</button>
              </ActionForm>
            </div>

            <div style={styles.fullPanel}>
              <div style={styles.header}>
                <div>
                  <h4 style={styles.historyTitle}>Relatorio Tecnico Preliminar</h4>
                  <p style={styles.subtitle}>
                    Estrutura SMAD interna: introducao, historico, caracterizacao, metodologia, constatacoes, analise, recomendacoes, encaminhamentos, conclusao e limitacoes.
                  </p>
                </div>
                {relatorio ? <span style={styles.badgeInfo}>{relatorio.protocolo_relatorio}</span> : null}
              </div>

              <ActionForm title={relatorio ? 'Editar relatorio' : 'Criar relatorio'} enabled={(relatorio ? canEditReport : canCreateReport) && !detailClosed} onSubmit={handleReportSubmit}>
                <div style={styles.reportGrid}>
                  {Object.keys(EMPTY_REPORT_FORM).map((field) => (
                    <Textarea
                      key={field}
                      label={displayLabel(field)}
                      value={reportForm[field]}
                      onChange={(event) => updateReportField(field, event.target.value)}
                    />
                  ))}
                </div>
                <p style={styles.notice}>
                  Observacao obrigatoria: o relatorio tecnico preliminar e peca interna de instrucao e nao constitui auto de infracao, notificacao formal, multa, embargo, apreensao ou decisao administrativa final.
                </p>
                <button type="submit" style={styles.primaryButton}>{relatorio ? 'Salvar rascunho' : 'Criar rascunho'}</button>
              </ActionForm>

              {relatorio ? (
                <div style={styles.actionsPanel}>
                  <ActionForm title="Alterar status do relatorio" enabled={canUpdateReportStatus} onSubmit={handleReportStatusSubmit}>
                    <Select label="Novo status" name="status" value={reportStatusForm.status} onChange={(event) => setReportStatusForm((current) => ({ ...current, status: event.target.value }))}>
                      {REPORT_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{displayLabel(status, REPORT_STATUS_LABELS)}</option>
                      ))}
                    </Select>
                    <Textarea label="Motivo da alteracao" value={reportStatusForm.descricao} onChange={(event) => setReportStatusForm((current) => ({ ...current, descricao: event.target.value }))} required />
                    <button type="submit" style={styles.secondaryButton}>Atualizar status</button>
                  </ActionForm>

                  <ActionForm title="Movimentacao do relatorio" enabled={canMoveReport} onSubmit={handleReportMovementSubmit}>
                    <Textarea label="Registro interno" value={reportMovementForm.descricao} onChange={(event) => setReportMovementForm({ descricao: event.target.value })} required />
                    <button type="submit" style={styles.secondaryButton}>Registrar movimentacao</button>
                  </ActionForm>
                </div>
              ) : null}
            </div>

            <div style={styles.historyPanel}>
              <h4 style={styles.historyTitle}>Historico da vistoria</h4>
              {(detail.movimentacoes || []).length === 0 ? (
                <p style={styles.subtitle}>Nenhuma movimentacao registrada.</p>
              ) : (
                <div style={styles.timeline}>
                  {detail.movimentacoes.map((movimentacao) => (
                    <div key={movimentacao.id} style={styles.timelineItem}>
                      <strong>{formatDateTime(movimentacao.created_at)}</strong>
                      <span>{displayLabel(movimentacao.status_anterior, VISTORIA_STATUS_LABELS)} para {displayLabel(movimentacao.status_novo, VISTORIA_STATUS_LABELS)}</span>
                      <p>{movimentacao.descricao}</p>
                      <small>{displayLabel(movimentacao.tipo)} - {movimentacao.usuario_nome || 'Sistema'}</small>
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
  if (status === 'cancelada' || status === 'arquivada') {
    return <span style={styles.badgeMuted}>{displayLabel(status, VISTORIA_STATUS_LABELS)}</span>;
  }
  if (status === 'realizada' || status === 'relatorio_emitido') {
    return <span style={styles.badgeSuccess}>{displayLabel(status, VISTORIA_STATUS_LABELS)}</span>;
  }
  return <span style={styles.badgeInfo}>{displayLabel(status, VISTORIA_STATUS_LABELS)}</span>;
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
  notice: { margin: 0, color: '#374151', fontSize: '13px', lineHeight: 1.5, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '8px', padding: '10px' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '14px' },
  metricCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', background: '#f9fafb', display: 'grid', gap: '8px', color: '#374151' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '12px', alignItems: 'end', marginBottom: '18px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '12px' },
  reportGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '12px' },
  field: { display: 'grid', gap: '6px' },
  checkField: { display: 'flex', gap: '8px', alignItems: 'center', color: '#374151', fontSize: '14px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { minHeight: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff', color: '#111827' },
  textarea: { minHeight: '96px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', background: '#ffffff', color: '#111827', resize: 'vertical' },
  filterActions: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  primaryButton: { minHeight: '40px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
  secondaryButton: { minHeight: '40px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  dangerButton: { minHeight: '40px', border: '1px solid #991b1b', borderRadius: '8px', background: '#b91c1c', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '1060px', background: '#ffffff' },
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
  fullPanel: { gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', paddingTop: '18px', display: 'grid', gap: '14px' },
  attachmentsList: { display: 'grid', gap: '10px' },
  attachmentItem: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', background: '#ffffff' },
  historyPanel: { gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', paddingTop: '18px' },
  historyTitle: { margin: '0 0 12px', color: '#111827', fontSize: '18px' },
  timeline: { display: 'grid', gap: '10px' },
  timelineItem: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'grid', gap: '4px', color: '#374151', background: '#ffffff' },
  badgeInfo: { display: 'inline-block', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', color: '#1d4ed8', padding: '5px 8px', fontWeight: 700 },
  badgeSuccess: { display: 'inline-block', border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '5px 8px', fontWeight: 700 },
  badgeWarning: { display: 'inline-block', border: '1px solid #fde68a', borderRadius: '8px', background: '#fffbeb', color: '#92400e', padding: '5px 8px', fontWeight: 700 },
  badgeDanger: { display: 'inline-block', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '5px 8px', fontWeight: 700 },
  badgeMuted: { display: 'inline-block', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', color: '#4b5563', padding: '5px 8px', fontWeight: 700 },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginBottom: '12px' },
  alertSuccess: { border: '1px solid #bbf7d0', borderRadius: '8px', background: '#f0fdf4', color: '#166534', padding: '12px', fontSize: '14px', marginBottom: '12px' },
};
