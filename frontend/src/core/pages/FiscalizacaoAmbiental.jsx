import { useEffect, useMemo, useState } from 'react';
import {
  assignFiscalizacaoResponsavel,
  closeFiscalizacaoPreliminarmente,
  createFiscalizacaoMovimentacao,
  getFiscalizacao,
  getFiscalizacaoAnexos,
  getFiscalizacoes,
  updateFiscalizacaoStatus,
} from '../api/fiscalizacaoApi';
import { createVistoria, getFiscalizacaoVistorias } from '../api/vistoriasApi';
import { downloadDemandAnexo } from '../api/anexosApi';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

const PER_PAGE = 20;

const DEFAULT_FILTERS = {
  protocolo: '',
  status: '',
  categoria: '',
  prioridade: '',
  responsavel_id: '',
  data_inicio: '',
  data_fim: '',
  busca: '',
};

const STATUS_LABELS = {
  aberta: 'Aberta',
  em_analise: 'Em analise',
  vistoria_planejada: 'Vistoria planejada',
  vistoria_realizada: 'Vistoria realizada',
  aguardando_informacao: 'Aguardando informacao',
  encaminhada_para_providencias: 'Encaminhada para providencias',
  encerrada_sem_elementos: 'Encerrada sem elementos',
  encerrada_preliminarmente: 'Encerrada preliminarmente',
  arquivada: 'Arquivada',
};

const STATUS_OPTIONS = [
  'aberta',
  'em_analise',
  'vistoria_planejada',
  'vistoria_realizada',
  'aguardando_informacao',
  'encaminhada_para_providencias',
];

const CLOSE_STATUS_OPTIONS = ['encerrada_sem_elementos', 'encerrada_preliminarmente', 'arquivada'];
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

export default function FiscalizacaoAmbiental({ user, navigateToPage }) {
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: PER_PAGE, total_items: 0, total_pages: 1 });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [anexos, setAnexos] = useState([]);
  const [vistorias, setVistorias] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [loadingVistorias, setLoadingVistorias] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [statusForm, setStatusForm] = useState({ status: 'em_analise', descricao: '' });
  const [responsavelForm, setResponsavelForm] = useState({ responsavel_id: '', descricao: '' });
  const [movementForm, setMovementForm] = useState({ descricao: '' });
  const [closeForm, setCloseForm] = useState({ status: 'encerrada_preliminarmente', justificativa_encerramento_preliminar: '' });
  const [vistoriaForm, setVistoriaForm] = useState({
    finalidade: '',
    prioridade: 'normal',
    data_planejada: '',
    equipe_responsavel: '',
    responsavel_id: '',
    objetivo: '',
    metodologia_resumida: '',
    observacoes_internas: '',
  });

  const canUpdateStatus = hasPermission(user, PERMISSIONS.FISCALIZACAO_UPDATE_STATUS);
  const canAssign = hasPermission(user, PERMISSIONS.FISCALIZACAO_ASSIGN);
  const canMove = hasPermission(user, PERMISSIONS.FISCALIZACAO_MOVE);
  const canClose = hasPermission(user, PERMISSIONS.FISCALIZACAO_CLOSE_PRELIMINAR);
  const canCreateVistoria = hasPermission(user, PERMISSIONS.VISTORIA_CREATE);
  const canViewVistorias = hasPermission(user, PERMISSIONS.VISTORIA_VIEW);
  const canViewAnexos = hasPermission(user, PERMISSIONS.FISCALIZACAO_VIEW_ANEXOS) && hasPermission(user, PERMISSIONS.ANEXOS_VIEW);
  const canDownloadAnexos = hasPermission(user, PERMISSIONS.ANEXOS_DOWNLOAD);
  const detailClosed = detail?.status ? CLOSING_STATUSES.has(detail.status) : false;

  const metrics = useMemo(() => {
    const total = pagination.total_items || 0;
    const abertas = items.filter((item) => !CLOSING_STATUSES.has(item.status)).length;
    const vistoria = items.filter((item) => item.status === 'vistoria_planejada' || item.status === 'vistoria_realizada').length;
    const semResponsavel = items.filter((item) => !item.responsavel_id).length;
    return [
      ['Total filtrado', total],
      ['Abertas nesta pagina', abertas],
      ['Com vistoria', vistoria],
      ['Sem responsavel', semResponsavel],
    ];
  }, [items, pagination.total_items]);

  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      try {
        setLoadingList(true);
        setError('');
        const response = await getFiscalizacoes({ ...filters, page, page_size: PER_PAGE });
        if (cancelled) return;
        const data = response.data || {};
        setItems(Array.isArray(data.items) ? data.items : []);
        setPagination(data.pagination || { page, page_size: PER_PAGE, total_items: 0, total_pages: 1 });
      } catch (err) {
        if (!cancelled) {
          setError(compactError(err, 'Nao foi possivel carregar fiscalizacoes ambientais.'));
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
      setAnexos([]);
      setVistorias([]);
      return undefined;
    }

    let cancelled = false;

    async function loadDetail() {
      try {
        setLoadingDetail(true);
        setActionError('');
        const response = await getFiscalizacao(selectedId);
        if (cancelled) return;
        const nextDetail = response.data || null;
        setDetail(nextDetail);
        setStatusForm({
          status: CLOSING_STATUSES.has(nextDetail?.status) ? 'em_analise' : nextDetail?.status || 'em_analise',
          descricao: '',
        });
        setResponsavelForm({
          responsavel_id: nextDetail?.responsavel_id ? String(nextDetail.responsavel_id) : '',
          descricao: '',
        });
        setMovementForm({ descricao: '' });
        setCloseForm({ status: 'encerrada_preliminarmente', justificativa_encerramento_preliminar: '' });
        setVistoriaForm({
          finalidade: 'Vistoria ambiental interna preliminar',
          prioridade: nextDetail?.prioridade || 'normal',
          data_planejada: '',
          equipe_responsavel: '',
          responsavel_id: nextDetail?.responsavel_id ? String(nextDetail.responsavel_id) : '',
          objetivo: nextDetail?.descricao_resumida ? `Verificar em campo: ${nextDetail.descricao_resumida}` : '',
          metodologia_resumida: 'Vistoria tecnica in loco com registro de constatacoes, evidencias e anexos, sem ato sancionatorio automatico.',
          observacoes_internas: '',
        });
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel carregar o detalhe da fiscalizacao.'));
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
    if (!selectedId || !canViewVistorias) {
      setVistorias([]);
      return undefined;
    }

    let cancelled = false;

    async function loadVistorias() {
      try {
        setLoadingVistorias(true);
        const response = await getFiscalizacaoVistorias(selectedId);
        if (!cancelled) {
          setVistorias(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel carregar vistorias da fiscalizacao.'));
        }
      } finally {
        if (!cancelled) {
          setLoadingVistorias(false);
        }
      }
    }

    loadVistorias();

    return () => {
      cancelled = true;
    };
  }, [selectedId, canViewVistorias]);

  useEffect(() => {
    if (!selectedId || !canViewAnexos) {
      setAnexos([]);
      return undefined;
    }

    let cancelled = false;

    async function loadAnexos() {
      try {
        setLoadingAnexos(true);
        const response = await getFiscalizacaoAnexos(selectedId);
        if (!cancelled) {
          setAnexos(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(compactError(err, 'Nao foi possivel carregar anexos herdados da demanda.'));
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
    const [listResponse, detailResponse, anexosResponse, vistoriasResponse] = await Promise.all([
      getFiscalizacoes({ ...filters, page, page_size: PER_PAGE }),
      selectedId ? getFiscalizacao(selectedId) : Promise.resolve({ data: null }),
      selectedId && canViewAnexos ? getFiscalizacaoAnexos(selectedId) : Promise.resolve({ data: [] }),
      selectedId && canViewVistorias ? getFiscalizacaoVistorias(selectedId) : Promise.resolve({ data: [] }),
    ]);
    const listData = listResponse.data || {};
    setItems(Array.isArray(listData.items) ? listData.items : []);
    setPagination(listData.pagination || pagination);
    setDetail(detailResponse.data || null);
    setAnexos(Array.isArray(anexosResponse.data) ? anexosResponse.data : []);
    setVistorias(Array.isArray(vistoriasResponse.data) ? vistoriasResponse.data : []);
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
    await runAction(
      () => updateFiscalizacaoStatus(detail.id, statusForm),
      'Status atualizado e historico registrado.'
    );
    setStatusForm((current) => ({ ...current, descricao: '' }));
  }

  async function handleResponsavelSubmit(event) {
    event.preventDefault();
    await runAction(
      () => assignFiscalizacaoResponsavel(detail.id, {
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
      () => createFiscalizacaoMovimentacao(detail.id, movementForm),
      'Movimentacao interna registrada.'
    );
    setMovementForm({ descricao: '' });
  }

  async function handleCloseSubmit(event) {
    event.preventDefault();
    await runAction(
      () => closeFiscalizacaoPreliminarmente(detail.id, closeForm),
      'Fiscalizacao encerrada preliminarmente com justificativa.'
    );
    setCloseForm({ status: 'encerrada_preliminarmente', justificativa_encerramento_preliminar: '' });
  }

  async function handleVistoriaSubmit(event) {
    event.preventDefault();
    await runAction(
      () => createVistoria(detail.id, {
        ...vistoriaForm,
        responsavel_id: vistoriaForm.responsavel_id || null,
      }),
      'Vistoria ambiental interna criada e vinculada a fiscalizacao.'
    );
    setVistoriaForm((current) => ({
      ...current,
      data_planejada: '',
      observacoes_internas: '',
    }));
  }

  async function handleDownloadAnexo(anexo) {
    await runAction(async () => {
      const blob = await downloadDemandAnexo(detail.demanda_publica_id, anexo.id);
      downloadBlob(blob, anexo.nome_original || `anexo-${anexo.id}`);
    }, 'Download registrado em auditoria.');
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Fiscalizacao ambiental</h2>
            <p style={styles.subtitle}>
              Fluxo interno preparatorio derivado de Demandas Publicas, sem autos, notificacoes, multas, embargos ou decisao administrativa final.
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
          <Input label="Protocolo" name="protocolo" value={draftFilters.protocolo} onChange={handleFilterChange} placeholder="SIGMA-FISC ou SIGMA-DEN" />
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
          <Input label="Responsavel ID" name="responsavel_id" value={draftFilters.responsavel_id} onChange={handleFilterChange} />
          <Input label="Inicio" name="data_inicio" type="datetime-local" value={draftFilters.data_inicio} onChange={handleFilterChange} />
          <Input label="Fim" name="data_fim" type="datetime-local" value={draftFilters.data_fim} onChange={handleFilterChange} />
          <Input label="Busca" name="busca" value={draftFilters.busca} onChange={handleFilterChange} placeholder="Assunto, local ou protocolo" />
          <div style={styles.filterActions}>
            <button type="submit" style={styles.primaryButton}>Aplicar filtros</button>
            <button type="button" style={styles.secondaryButton} onClick={clearFilters}>Limpar</button>
          </div>
        </form>

        {loadingList ? <p style={styles.subtitle}>Carregando fiscalizacoes...</p> : null}
        {!loadingList && items.length === 0 ? (
          <p style={styles.subtitle}>Nenhuma fiscalizacao encontrada para os filtros informados.</p>
        ) : null}

        {items.length > 0 ? (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Fiscalizacao</th>
                  <th style={styles.th}>Demanda origem</th>
                  <th style={styles.th}>Categoria</th>
                  <th style={styles.th}>Localidade</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Prioridade</th>
                  <th style={styles.th}>Responsavel</th>
                  <th style={styles.th}>Criacao</th>
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
                        {item.protocolo_fiscalizacao}
                      </button>
                      <span style={styles.mutedLine}>{item.assunto || '-'}</span>
                    </td>
                    <td style={styles.td}>{item.protocolo_demanda}</td>
                    <td style={styles.td}>
                      <strong>{displayLabel(item.categoria, CATEGORY_LABELS)}</strong>
                      <span style={styles.mutedLine}>{displayLabel(item.subcategoria)}</span>
                    </td>
                    <td style={styles.td}>{item.localidade || '-'}</td>
                    <td style={styles.td}><StatusBadge status={item.status} /></td>
                    <td style={styles.td}><PriorityBadge prioridade={item.prioridade} /></td>
                    <td style={styles.td}>{item.responsavel_nome || (item.responsavel_id ? `Usuario #${item.responsavel_id}` : 'Nao atribuido')}</td>
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
            <h3 style={styles.sectionTitle}>Detalhe fiscalizatorio interno</h3>
            <p style={styles.subtitle}>Registro preparatorio. Nao representa sancao, auto, notificacao formal ou decisao final.</p>
          </div>
          {detail ? <StatusBadge status={detail.status} /> : null}
        </div>

        {!selectedId ? <p style={styles.subtitle}>Selecione uma fiscalizacao na listagem.</p> : null}
        {loadingDetail ? <p style={styles.subtitle}>Carregando detalhe...</p> : null}
        {actionError ? <div style={styles.alertError}>{actionError}</div> : null}
        {actionMessage ? <div style={styles.alertSuccess}>{actionMessage}</div> : null}

        {detail ? (
          <div style={styles.detailGrid}>
            <div style={styles.detailMain}>
              <InfoRow label="Protocolo da fiscalizacao" value={detail.protocolo_fiscalizacao} />
              <InfoRow label="Demanda originaria" value={detail.protocolo_demanda} />
              <InfoRow label="Categoria" value={`${displayLabel(detail.categoria, CATEGORY_LABELS)} / ${displayLabel(detail.subcategoria)}`} />
              <InfoRow label="Prioridade" value={displayLabel(detail.prioridade, PRIORITY_LABELS)} />
              <InfoRow label="Localidade" value={detail.localidade} />
              <InfoRow label="Endereco ou referencia" value={detail.endereco_referencia} />
              <InfoRow label="Ponto de referencia" value={detail.ponto_referencia} />
              <div style={styles.infoBlock}>
                <span style={styles.label}>Descricao resumida</span>
                <p style={styles.longText}>{detail.descricao_resumida}</p>
              </div>
              <div style={styles.infoBlock}>
                <span style={styles.label}>Justificativa da conversao</span>
                <p style={styles.longText}>{detail.justificativa_conversao}</p>
              </div>
              {detail.justificativa_encerramento_preliminar ? (
                <div style={styles.infoBlock}>
                  <span style={styles.label}>Justificativa do encerramento preliminar</span>
                  <p style={styles.longText}>{detail.justificativa_encerramento_preliminar}</p>
                </div>
              ) : null}
            </div>

            <aside style={styles.detailSide}>
              <InfoRow label="Responsavel" value={detail.responsavel_nome || (detail.responsavel_id ? `Usuario #${detail.responsavel_id}` : 'Nao atribuido')} />
              <InfoRow label="Criada por" value={detail.criado_por_nome || (detail.criado_por_id ? `Usuario #${detail.criado_por_id}` : '-')} />
              <InfoRow label="Data de conversao" value={formatDateTime(detail.data_conversao)} />
              <InfoRow label="Atualizada em" value={formatDateTime(detail.updated_at)} />
              <InfoRow label="Encerrada em" value={formatDateTime(detail.data_encerramento_preliminar)} />
              <button type="button" style={styles.secondaryButton} onClick={() => navigateToPage?.('demandas-publicas')}>
                Abrir demandas
              </button>
              <button type="button" style={styles.secondaryButton} onClick={() => navigateToPage?.('vistorias')}>
                Abrir vistorias
              </button>

              <div style={styles.actionsPanel}>
                <ActionForm title="Alterar status" enabled={canUpdateStatus && !detailClosed} onSubmit={handleStatusSubmit}>
                  <Select label="Novo status" name="status" value={statusForm.status} onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{displayLabel(status, STATUS_LABELS)}</option>
                    ))}
                  </Select>
                  <Textarea label="Motivo da movimentacao" value={statusForm.descricao} onChange={(event) => setStatusForm((current) => ({ ...current, descricao: event.target.value }))} required />
                  <button type="submit" style={styles.primaryButton}>Salvar status</button>
                </ActionForm>

                <ActionForm title="Atribuir responsavel" enabled={canAssign && !detailClosed} onSubmit={handleResponsavelSubmit}>
                  <Input label="ID do responsavel" name="responsavel_id" value={responsavelForm.responsavel_id} onChange={(event) => setResponsavelForm((current) => ({ ...current, responsavel_id: event.target.value }))} placeholder="Opcional" />
                  <Textarea label="Observacao" value={responsavelForm.descricao} onChange={(event) => setResponsavelForm((current) => ({ ...current, descricao: event.target.value }))} />
                  <button type="submit" style={styles.secondaryButton}>Atualizar responsavel</button>
                </ActionForm>

                <ActionForm title="Movimentacao interna" enabled={canMove && !detailClosed} onSubmit={handleMovementSubmit}>
                  <Textarea label="Registro interno" value={movementForm.descricao} onChange={(event) => setMovementForm({ descricao: event.target.value })} required />
                  <button type="submit" style={styles.secondaryButton}>Registrar movimentacao</button>
                </ActionForm>

                <ActionForm title="Encerramento preliminar" enabled={canClose && !detailClosed} onSubmit={handleCloseSubmit}>
                  <Select label="Resultado" name="status" value={closeForm.status} onChange={(event) => setCloseForm((current) => ({ ...current, status: event.target.value }))}>
                    {CLOSE_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{displayLabel(status, STATUS_LABELS)}</option>
                    ))}
                  </Select>
                  <Textarea
                    label="Justificativa obrigatoria"
                    value={closeForm.justificativa_encerramento_preliminar}
                    onChange={(event) => setCloseForm((current) => ({ ...current, justificativa_encerramento_preliminar: event.target.value }))}
                    required
                  />
                  <button type="submit" style={styles.dangerButton}>Encerrar preliminarmente</button>
                </ActionForm>
              </div>
            </aside>

            <div style={styles.attachmentsPanel}>
              <div style={styles.header}>
                <div>
                  <h4 style={styles.historyTitle}>Vistorias vinculadas</h4>
                  <p style={styles.subtitle}>Planejamento e registros tecnicos internos, sem autos, notificacoes, multas, embargos ou decisao final.</p>
                </div>
              </div>

              {!canViewVistorias ? <p style={styles.subtitle}>Seu perfil nao possui permissao para visualizar vistorias.</p> : null}
              {loadingVistorias ? <p style={styles.subtitle}>Carregando vistorias...</p> : null}
              {canViewVistorias && !loadingVistorias && vistorias.length === 0 ? (
                <p style={styles.subtitle}>Nenhuma vistoria vinculada a esta fiscalizacao.</p>
              ) : null}

              {vistorias.length > 0 ? (
                <div style={styles.attachmentsList}>
                  {vistorias.map((vistoria) => (
                    <div key={vistoria.id} style={styles.attachmentItem}>
                      <div>
                        <strong>{vistoria.protocolo_vistoria}</strong>
                        <span style={styles.mutedLine}>
                          {displayLabel(vistoria.status)} - {displayLabel(vistoria.prioridade, PRIORITY_LABELS)} - {formatDateTime(vistoria.created_at)}
                        </span>
                        <span style={styles.mutedLine}>
                          Relatorio: {vistoria.protocolo_relatorio || 'nao iniciado'}
                        </span>
                      </div>
                      <button type="button" style={styles.secondaryButton} onClick={() => navigateToPage?.('vistorias')}>
                        Abrir
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <ActionForm title="Criar vistoria interna" enabled={canCreateVistoria && !detailClosed} onSubmit={handleVistoriaSubmit}>
                <div style={styles.formGrid}>
                  <Input label="Finalidade" name="finalidade" value={vistoriaForm.finalidade} onChange={(event) => setVistoriaForm((current) => ({ ...current, finalidade: event.target.value }))} />
                  <Select label="Prioridade" name="prioridade" value={vistoriaForm.prioridade} onChange={(event) => setVistoriaForm((current) => ({ ...current, prioridade: event.target.value }))}>
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                  <Input label="Data planejada" name="data_planejada" type="datetime-local" value={vistoriaForm.data_planejada} onChange={(event) => setVistoriaForm((current) => ({ ...current, data_planejada: event.target.value }))} />
                  <Input label="Responsavel ID" name="responsavel_id" value={vistoriaForm.responsavel_id} onChange={(event) => setVistoriaForm((current) => ({ ...current, responsavel_id: event.target.value }))} />
                  <Input label="Equipe responsavel" name="equipe_responsavel" value={vistoriaForm.equipe_responsavel} onChange={(event) => setVistoriaForm((current) => ({ ...current, equipe_responsavel: event.target.value }))} />
                  <Textarea label="Objetivo" value={vistoriaForm.objetivo} onChange={(event) => setVistoriaForm((current) => ({ ...current, objetivo: event.target.value }))} required />
                  <Textarea label="Metodologia resumida" value={vistoriaForm.metodologia_resumida} onChange={(event) => setVistoriaForm((current) => ({ ...current, metodologia_resumida: event.target.value }))} />
                  <Textarea label="Observacoes internas" value={vistoriaForm.observacoes_internas} onChange={(event) => setVistoriaForm((current) => ({ ...current, observacoes_internas: event.target.value }))} />
                </div>
                <button type="submit" style={styles.primaryButton}>Criar vistoria</button>
              </ActionForm>
            </div>

            <div style={styles.attachmentsPanel}>
              <div style={styles.header}>
                <div>
                  <h4 style={styles.historyTitle}>Anexos herdados da demanda</h4>
                  <p style={styles.subtitle}>Arquivos continuam vinculados ao protocolo de origem, sem duplicacao fisica.</p>
                </div>
              </div>

              {!canViewAnexos ? <p style={styles.subtitle}>Seu perfil nao possui permissao para visualizar anexos da fiscalizacao.</p> : null}
              {loadingAnexos ? <p style={styles.subtitle}>Carregando anexos...</p> : null}
              {canViewAnexos && !loadingAnexos && anexos.length === 0 ? (
                <p style={styles.subtitle}>Nenhum anexo vinculado a demanda originaria.</p>
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
                          Hash: {anexo.hash_sha256 ? `${anexo.hash_sha256.slice(0, 16)}...` : 'restrito'}
                          {anexo.sensivel ? ' - sensivel' : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        disabled={!canDownloadAnexos || anexo.dados_sensiveis_restritos}
                        onClick={() => handleDownloadAnexo(anexo)}
                      >
                        Baixar
                      </button>
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
  const closing = CLOSING_STATUSES.has(status);
  const warning = status === 'aguardando_informacao' || status === 'vistoria_planejada';
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
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '12px' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { minHeight: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff', color: '#111827' },
  textarea: { minHeight: '96px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', background: '#ffffff', color: '#111827', resize: 'vertical' },
  filterActions: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  primaryButton: { minHeight: '40px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
  secondaryButton: { minHeight: '40px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  dangerButton: { minHeight: '40px', border: '1px solid #991b1b', borderRadius: '8px', background: '#b91c1c', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 14px' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '1080px', background: '#ffffff' },
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
  attachmentsPanel: { gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', paddingTop: '18px', display: 'grid', gap: '14px' },
  attachmentsList: { display: 'grid', gap: '10px' },
  attachmentItem: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', background: '#ffffff' },
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
