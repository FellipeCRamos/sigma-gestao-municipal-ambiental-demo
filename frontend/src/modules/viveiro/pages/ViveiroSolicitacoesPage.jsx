import { useEffect, useMemo, useState } from 'react';
import { getTerritorios } from '../../../services/api';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  analyzeViveiroSolicitacao,
  createViveiroSolicitacao,
  getViveiroEspecies,
  getViveiroLotes,
  getViveiroSolicitacaoDetalhe,
  getViveiroSolicitacoes,
} from '../services/viveiroAdminApi';
import {
  formatDate,
  formatNumber,
  pageStyles,
  statusPill,
  unpackListPayload,
} from './shared';
import PaginationControls from './PaginationControls';

const INITIAL_FORM = {
  solicitante_nome: '',
  solicitante_documento: '',
  solicitante_email: '',
  solicitante_telefone: '',
  tipo_solicitante: 'cidadao',
  instituicao_nome: '',
  finalidade: '',
  local_plantio: '',
  territorio_id: '',
  observacoes: '',
  itens: [
    {
      especie_id: '',
      quantidade_solicitada: '',
      observacoes: '',
    },
  ],
};

function buildAnalysisDraft(detail) {
  const reservaMap = new Map(
    (detail?.reserva?.itens || []).map((item) => [Number(item.solicitacao_item_id), item])
  );

  return Object.fromEntries(
    (detail?.itens || []).map((item) => {
      const reservaItem = reservaMap.get(Number(item.id));
      return [
        item.id,
        {
          quantidade_aprovada: String(item.quantidade_aprovada ?? 0),
          lote_id: reservaItem?.lote_id ? String(reservaItem.lote_id) : String(item.lote_reservado_id || ''),
          observacoes: reservaItem?.observacoes || '',
        },
      ];
    })
  );
}

function normalizeAnalysisValue(draft, itemId, key, fallback = '') {
  return draft?.[itemId]?.[key] ?? fallback;
}

export default function ViveiroSolicitacoesPage({ usuarioInterno }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [especies, setEspecies] = useState([]);
  const [territorios, setTerritorios] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [requestForm, setRequestForm] = useState(INITIAL_FORM);
  const [analysisDraft, setAnalysisDraft] = useState({});
  const [analysisNote, setAnalysisNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canCreate = hasPermission(usuarioInterno, PERMISSIONS.VIVEIRO_SOLICITACOES_CREATE);
  const canAnalyze = hasPermission(usuarioInterno, PERMISSIONS.VIVEIRO_SOLICITACOES_ANALISE);

  const lotesBySpecies = useMemo(() => {
    return lotes.reduce((acc, item) => {
      const key = String(item.especie_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [lotes]);

  async function loadBaseData({ nextStatus = statusFilter, nextSearch = search, nextPage = page } = {}) {
    try {
      setLoading(true);
      setError('');
      const [solicitacoesResponse, especiesResponse, territoriosResponse, lotesResponse] = await Promise.all([
        getViveiroSolicitacoes({
          status: nextStatus,
          busca: nextSearch,
          page: nextPage,
          page_size: 10,
        }),
        getViveiroEspecies(),
        getTerritorios(),
        getViveiroLotes({ status: 'ativo' }),
      ]);

      const solicitacoesPayload = unpackListPayload(solicitacoesResponse.data);
      const lotesPayload = unpackListPayload(lotesResponse.data);

      setSolicitacoes(solicitacoesPayload.items);
      setPagination(solicitacoesPayload.pagination);
      setEspecies(Array.isArray(especiesResponse.data) ? especiesResponse.data : []);
      setTerritorios(Array.isArray(territoriosResponse.data) ? territoriosResponse.data : []);
      setLotes(lotesPayload.items);

      if (!solicitacoesPayload.items.length) {
        setSelectedId('');
        setSelectedDetail(null);
        return;
      }

      const hasCurrentSelection = solicitacoesPayload.items.some(
        (item) => String(item.id) === String(selectedId)
      );

      if (!selectedId || !hasCurrentSelection) {
        setSelectedId(String(solicitacoesPayload.items[0].id));
      }
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as solicitações do Viveiro.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id) {
    if (!id) {
      setSelectedDetail(null);
      return;
    }

    try {
      const response = await getViveiroSolicitacaoDetalhe(id);
      const detail = response.data || null;
      setSelectedDetail(detail);
      setAnalysisDraft(buildAnalysisDraft(detail));
      setAnalysisNote(detail?.observacao_analise || '');
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o detalhe da solicitação.');
    }
  }

  useEffect(() => {
    loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search, page]);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId]);

  function updateRequestItem(index, key, value) {
    setRequestForm((prev) => ({
      ...prev,
      itens: prev.itens.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function getPendingReserveForItem(item) {
    const approved = Number(normalizeAnalysisValue(analysisDraft, item.id, 'quantidade_aprovada', item.quantidade_aprovada ?? 0) || 0);
    return Math.max(0, approved - Number(item.quantidade_entregue || 0));
  }

  function updateAnalysisItem(itemId, key, value) {
    setAnalysisDraft((prev) => ({
      ...prev,
      [itemId]: {
        quantidade_aprovada: normalizeAnalysisValue(prev, itemId, 'quantidade_aprovada', '0'),
        lote_id: normalizeAnalysisValue(prev, itemId, 'lote_id', ''),
        observacoes: normalizeAnalysisValue(prev, itemId, 'observacoes', ''),
        [key]: value,
      },
    }));
  }

  async function handleCreateSolicitacao(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      setError('');
      const response = await createViveiroSolicitacao({
        ...requestForm,
        territorio_id: requestForm.territorio_id || null,
      });
      const created = response.data || null;
      setMessage('Solicitação registrada com sucesso.');
      setRequestForm(INITIAL_FORM);
      setPage(1);
      await loadBaseData({ nextPage: 1 });
      if (created?.id) {
        setSelectedId(String(created.id));
      }
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a solicitação.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze(event) {
    event.preventDefault();

    if (!selectedDetail) return;

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const reservas = [];

      for (const item of selectedDetail.itens || []) {
        const pendingReserve = getPendingReserveForItem(item);
        const loteId = normalizeAnalysisValue(analysisDraft, item.id, 'lote_id', '');

        if (pendingReserve > 0 && !loteId) {
          throw new Error(`Selecione o lote reservado para ${item.especie_nome}.`);
        }

        if (pendingReserve > 0) {
          reservas.push({
            solicitacao_item_id: item.id,
            lote_id: Number(loteId),
            quantidade_reservada: pendingReserve,
            observacoes: normalizeAnalysisValue(analysisDraft, item.id, 'observacoes', ''),
          });
        }
      }

      await analyzeViveiroSolicitacao(selectedDetail.id, {
        observacao_analise: analysisNote,
        itens: (selectedDetail.itens || []).map((item) => ({
          solicitacao_item_id: item.id,
          quantidade_aprovada: normalizeAnalysisValue(analysisDraft, item.id, 'quantidade_aprovada', 0),
        })),
        reservas,
      });

      setMessage('Análise registrada com sucesso.');
      await loadBaseData();
      await loadDetail(selectedDetail.id);
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a análise.');
    } finally {
      setSaving(false);
    }
  }

  const approvedSummary = useMemo(() => {
    if (!selectedDetail?.itens) return { solicitada: 0, aprovada: 0, entregue: 0, reservada: 0 };

    return selectedDetail.itens.reduce(
      (acc, item) => {
        acc.solicitada += Number(item.quantidade_solicitada || 0);
        acc.aprovada += Number(item.quantidade_aprovada || 0);
        acc.entregue += Number(item.quantidade_entregue || 0);
        acc.reservada += Number(item.quantidade_reservada || 0);
        return acc;
      },
      { solicitada: 0, aprovada: 0, entregue: 0, reservada: 0 }
    );
  }, [selectedDetail]);

  return (
    <div style={pageStyles.page}>
      {message ? <div style={{ ...pageStyles.message, background: '#dcfce7', color: '#166534' }}>{message}</div> : null}
      {error ? <div style={{ ...pageStyles.message, background: '#fee2e2', color: '#991b1b' }}>{error}</div> : null}

      <section style={pageStyles.grid2}>
        {canCreate ? (
          <article style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Nova solicitação de mudas</h2>
            <form onSubmit={handleCreateSolicitacao}>
              <div style={pageStyles.formGrid}>
                <label>
                  Solicitante
                  <input style={pageStyles.input} value={requestForm.solicitante_nome} onChange={(e) => setRequestForm((prev) => ({ ...prev, solicitante_nome: e.target.value }))} />
                </label>
                <label>
                  Documento
                  <input style={pageStyles.input} value={requestForm.solicitante_documento} onChange={(e) => setRequestForm((prev) => ({ ...prev, solicitante_documento: e.target.value }))} />
                </label>
                <label>
                  Email
                  <input style={pageStyles.input} value={requestForm.solicitante_email} onChange={(e) => setRequestForm((prev) => ({ ...prev, solicitante_email: e.target.value }))} />
                </label>
                <label>
                  Telefone
                  <input style={pageStyles.input} value={requestForm.solicitante_telefone} onChange={(e) => setRequestForm((prev) => ({ ...prev, solicitante_telefone: e.target.value }))} />
                </label>
                <label>
                  Tipo
                  <select style={pageStyles.input} value={requestForm.tipo_solicitante} onChange={(e) => setRequestForm((prev) => ({ ...prev, tipo_solicitante: e.target.value }))}>
                    <option value="cidadao">Cidadão</option>
                    <option value="instituicao">Instituição</option>
                    <option value="orgao_publico">Órgão público</option>
                    <option value="escola">Escola</option>
                    <option value="ong">ONG</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </label>
                <label>
                  Instituição
                  <input style={pageStyles.input} value={requestForm.instituicao_nome} onChange={(e) => setRequestForm((prev) => ({ ...prev, instituicao_nome: e.target.value }))} />
                </label>
                <label>
                  Território
                  <select style={pageStyles.input} value={requestForm.territorio_id} onChange={(e) => setRequestForm((prev) => ({ ...prev, territorio_id: e.target.value }))}>
                    <option value="">Não informado</option>
                    {territorios.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Local de plantio
                  <input style={pageStyles.input} value={requestForm.local_plantio} onChange={(e) => setRequestForm((prev) => ({ ...prev, local_plantio: e.target.value }))} />
                </label>
              </div>

              <label style={{ display: 'block', marginTop: '12px' }}>
                Finalidade
                <textarea style={pageStyles.textarea} value={requestForm.finalidade} onChange={(e) => setRequestForm((prev) => ({ ...prev, finalidade: e.target.value }))} />
              </label>

              <label style={{ display: 'block', marginTop: '12px' }}>
                Observações
                <textarea style={pageStyles.textarea} value={requestForm.observacoes} onChange={(e) => setRequestForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
              </label>

              <div style={{ marginTop: '18px' }}>
                <h3 style={pageStyles.sectionTitle}>Itens solicitados</h3>
                {requestForm.itens.map((item, index) => (
                  <div key={index} style={{ ...pageStyles.formGrid, marginBottom: '10px' }}>
                    <label>
                      Espécie
                      <select style={pageStyles.input} value={item.especie_id} onChange={(e) => updateRequestItem(index, 'especie_id', e.target.value)}>
                        <option value="">Selecione</option>
                        {especies.map((especie) => (
                          <option key={especie.id} value={especie.id}>
                            {especie.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantidade
                      <input style={pageStyles.input} type="number" min="0.01" step="0.01" value={item.quantidade_solicitada} onChange={(e) => updateRequestItem(index, 'quantidade_solicitada', e.target.value)} />
                    </label>
                    <label>
                      Observações do item
                      <input style={pageStyles.input} value={item.observacoes} onChange={(e) => updateRequestItem(index, 'observacoes', e.target.value)} />
                    </label>
                  </div>
                ))}
                <div style={pageStyles.actions}>
                  <button
                    type="button"
                    style={pageStyles.buttonSecondary}
                    onClick={() =>
                      setRequestForm((prev) => ({
                        ...prev,
                        itens: [...prev.itens, { especie_id: '', quantidade_solicitada: '', observacoes: '' }],
                      }))
                    }
                  >
                    Adicionar item
                  </button>
                  {requestForm.itens.length > 1 ? (
                    <button
                      type="button"
                      style={pageStyles.buttonSecondary}
                      onClick={() =>
                        setRequestForm((prev) => ({
                          ...prev,
                          itens: prev.itens.slice(0, -1),
                        }))
                      }
                    >
                      Remover último item
                    </button>
                  ) : null}
                </div>
              </div>

              <div style={pageStyles.actions}>
                <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
                  {saving ? 'Registrando...' : 'Registrar solicitação'}
                </button>
              </div>
            </form>
          </article>
        ) : null}

        <article style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Solicitações registradas</h2>
          <div style={{ ...pageStyles.actions, marginTop: 0, marginBottom: '12px' }}>
            <input
              style={{ ...pageStyles.input, maxWidth: '260px' }}
              placeholder="Buscar protocolo ou solicitante"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <select
              style={{ ...pageStyles.input, maxWidth: '240px' }}
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovada_total">Aprovada total</option>
              <option value="aprovada_parcial">Aprovada parcial</option>
              <option value="rejeitada">Rejeitada</option>
              <option value="entregue">Entregue</option>
            </select>
          </div>
          {loading ? <p>Carregando solicitações...</p> : null}
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Protocolo</th>
                  <th style={pageStyles.th}>Solicitante</th>
                  <th style={pageStyles.th}>Origem</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Reservado</th>
                  <th style={pageStyles.th}>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.map((item) => {
                  const pill = statusPill(item.status);
                  return (
                    <tr key={item.id} onClick={() => setSelectedId(String(item.id))} style={{ cursor: 'pointer', background: String(item.id) === String(selectedId) ? '#f8fafc' : '#ffffff' }}>
                      <td style={pageStyles.td}>{item.protocolo}</td>
                      <td style={pageStyles.td}>
                        {item.solicitante_nome}
                        {item.instituicao_nome ? <div style={pageStyles.sectionSubtitle}>{item.instituicao_nome}</div> : null}
                      </td>
                      <td style={pageStyles.td}>
                        {item.origem_solicitacao === 'portal_publico' ? 'Portal público' : 'Interna'}
                      </td>
                      <td style={pageStyles.td}>
                        <span style={{ padding: '6px 10px', borderRadius: '999px', background: pill.background, color: pill.color, fontWeight: 700, fontSize: '12px' }}>
                          {pill.label}
                        </span>
                      </td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_reservada_total)}</td>
                      <td style={pageStyles.td}>{formatDate(item.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls pagination={pagination} onPageChange={setPage} />
        </article>
      </section>

      {selectedDetail ? (
        <section style={pageStyles.grid2}>
          <article style={pageStyles.section}>
            <h3 style={pageStyles.sectionTitle}>Detalhe da solicitação</h3>
            <div style={pageStyles.grid3}>
              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Solicitado</p>
                <p style={pageStyles.metricValue}>{formatNumber(approvedSummary.solicitada)}</p>
              </div>
              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Aprovado</p>
                <p style={pageStyles.metricValue}>{formatNumber(approvedSummary.aprovada)}</p>
              </div>
              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Reservado</p>
                <p style={pageStyles.metricValue}>{formatNumber(approvedSummary.reservada)}</p>
              </div>
              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Entregue</p>
                <p style={pageStyles.metricValue}>{formatNumber(approvedSummary.entregue)}</p>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <p><strong>Solicitante:</strong> {selectedDetail.solicitante_nome}</p>
              <p><strong>Origem:</strong> {selectedDetail.origem_solicitacao === 'portal_publico' ? 'Portal público' : 'Interna'}</p>
              <p><strong>Triagem:</strong> {statusPill(selectedDetail.status).label}</p>
              <p><strong>Finalidade:</strong> {selectedDetail.finalidade}</p>
              <p><strong>Território:</strong> {selectedDetail.territorio_nome || 'Não informado'}</p>
              <p><strong>Status:</strong> {statusPill(selectedDetail.status).label}</p>
              <p><strong>Reserva:</strong> {selectedDetail.reserva?.protocolo || 'Ainda não criada'}{selectedDetail.reserva?.status ? ` - ${statusPill(selectedDetail.reserva.status).label}` : ''}</p>
            </div>

            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Espécie</th>
                    <th style={pageStyles.th}>Solicitada</th>
                    <th style={pageStyles.th}>Aprovada</th>
                    <th style={pageStyles.th}>Reservada</th>
                    <th style={pageStyles.th}>Entregue</th>
                    <th style={pageStyles.th}>Lote reservado</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDetail.itens || []).map((item) => (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>{item.especie_nome}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_solicitada)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_aprovada)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_reservada)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_entregue)}</td>
                      <td style={pageStyles.td}>{item.lote_reservado_codigo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {canAnalyze ? (
            <article style={pageStyles.section}>
              <h3 style={pageStyles.sectionTitle}>Análise interna e reserva de estoque</h3>
              <form onSubmit={handleAnalyze}>
                {(selectedDetail.itens || []).map((item) => {
                  const pendingReserve = getPendingReserveForItem(item);
                  const lotesDaEspecie = lotesBySpecies[String(item.especie_id)] || [];

                  return (
                    <div key={item.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '12px' }}>
                      <div style={pageStyles.formGrid}>
                        <label>
                          Espécie
                          <input style={pageStyles.input} value={item.especie_nome} disabled />
                        </label>
                        <label>
                          Solicitada
                          <input style={pageStyles.input} value={formatNumber(item.quantidade_solicitada)} disabled />
                        </label>
                        <label>
                          Já entregue
                          <input style={pageStyles.input} value={formatNumber(item.quantidade_entregue)} disabled />
                        </label>
                        <label>
                          Aprovar
                          <input
                            style={pageStyles.input}
                            type="number"
                            min="0"
                            step="0.01"
                            value={normalizeAnalysisValue(analysisDraft, item.id, 'quantidade_aprovada', '')}
                            onChange={(e) => updateAnalysisItem(item.id, 'quantidade_aprovada', e.target.value)}
                          />
                        </label>
                        <label>
                          Reserva calculada
                          <input style={pageStyles.input} value={formatNumber(pendingReserve)} disabled />
                        </label>
                        <label>
                          Lote reservado
                          <select
                            style={pageStyles.input}
                            value={normalizeAnalysisValue(analysisDraft, item.id, 'lote_id', '')}
                            onChange={(e) => updateAnalysisItem(item.id, 'lote_id', e.target.value)}
                            disabled={pendingReserve <= 0}
                          >
                            <option value="">{pendingReserve > 0 ? 'Selecione' : 'Sem reserva'}</option>
                            {lotesDaEspecie.map((lote) => (
                              <option key={lote.id} value={lote.id}>
                                {lote.codigo} - livre {formatNumber(lote.quantidade_livre)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {pendingReserve > 0 ? (
                        <label style={{ display: 'block', marginTop: '8px' }}>
                          Observações da reserva
                          <input
                            style={pageStyles.input}
                            value={normalizeAnalysisValue(analysisDraft, item.id, 'observacoes', '')}
                            onChange={(e) => updateAnalysisItem(item.id, 'observacoes', e.target.value)}
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}

                <label style={{ display: 'block', marginTop: '12px' }}>
                  Observação da análise
                  <textarea style={pageStyles.textarea} value={analysisNote} onChange={(e) => setAnalysisNote(e.target.value)} />
                </label>

                <div style={pageStyles.actions}>
                  <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
                    {saving ? 'Salvando análise...' : 'Salvar análise'}
                  </button>
                </div>
              </form>
            </article>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
