import { useCallback, useEffect, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  cancelViveiroEntrega,
  createViveiroEntrega,
  getViveiroEntregaComprovante,
  getViveiroEntregas,
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
  solicitacao_id: '',
  recebedor_nome: '',
  recebedor_documento: '',
  observacoes: '',
  itens: [],
};

export default function ViveiroEntregasPage({ usuarioInterno }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [entregas, setEntregas] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [cancelTargetId, setCancelTargetId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [comprovante, setComprovante] = useState(null);
  const [comprovanteLoading, setComprovanteLoading] = useState(false);

  const canRegister = hasPermission(usuarioInterno, PERMISSIONS.VIVEIRO_ENTREGAS_REGISTER);
  const canCancel = hasPermission(usuarioInterno, PERMISSIONS.VIVEIRO_ENTREGAS_CANCEL);

  const loadBaseData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [solicitacoesResponse, entregasResponse] = await Promise.all([
        getViveiroSolicitacoes(),
        getViveiroEntregas({
          status: statusFilter,
          busca: search,
          page,
          page_size: 10,
        }),
      ]);

      const solicitacoesPayload = unpackListPayload(solicitacoesResponse.data);
      const entregasPayload = unpackListPayload(entregasResponse.data);

      const solicitacoesData = solicitacoesPayload.items.filter((item) =>
        ['aprovada_total', 'aprovada_parcial', 'entregue'].includes(item.status)
      );

      setSolicitacoes(solicitacoesData);
      setEntregas(entregasPayload.items);
      setPagination(entregasPayload.pagination);

      if (!solicitacoesData.length) {
        setSelectedId('');
        setSelectedDetail(null);
        setForm(INITIAL_FORM);
        return;
      }

      const hasCurrentSelection = solicitacoesData.some((item) => String(item.id) === String(selectedId));
      if (!selectedId || !hasCurrentSelection) {
        setSelectedId(String(solicitacoesData[0].id));
      }
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as entregas do Viveiro.');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedId, statusFilter]);

  async function loadDetail(id) {
    if (!id) {
      setSelectedDetail(null);
      setForm(INITIAL_FORM);
      return;
    }

    try {
      const response = await getViveiroSolicitacaoDetalhe(id);
      const detail = response.data || null;
      setSelectedDetail(detail);
      setForm({
        solicitacao_id: String(detail?.id || ''),
        recebedor_nome: detail?.solicitante_nome || '',
        recebedor_documento: detail?.solicitante_documento || '',
        observacoes: '',
        itens: (detail?.itens || [])
          .filter((item) => Number(item.quantidade_pendente_entrega) > 0 && Number(item.quantidade_reservada) > 0 && item.lote_reservado_id)
          .map((item) => ({
            solicitacao_item_id: item.id,
            lote_id: String(item.lote_reservado_id),
            quantidade_entregue: String(Math.min(Number(item.quantidade_pendente_entrega), Number(item.quantidade_reservada))),
            observacoes: '',
          })),
      });
    } catch (err) {
      setError(err.message || 'Não foi possível carregar a base da entrega.');
    }
  }

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId]);

  function updateItem(index, key, value) {
    setForm((prev) => ({
      ...prev,
      itens: prev.itens.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const itensValidos = form.itens.filter((item) => Number(item.quantidade_entregue) > 0);

      if (!itensValidos.length) {
        throw new Error('Informe ao menos um item com quantidade de entrega maior que zero.');
      }

      await createViveiroEntrega({
        ...form,
        itens: itensValidos,
      });

      setMessage('Entrega registrada com sucesso.');
      await loadBaseData();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err.message || 'Não foi possível registrar a entrega.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelEntrega(event) {
    event.preventDefault();

    if (!cancelTargetId) {
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setError('');

      await cancelViveiroEntrega(cancelTargetId, {
        motivo_cancelamento: cancelReason,
      });

      setMessage('Entrega cancelada com estorno automático do estoque.');
      setCancelTargetId('');
      setCancelReason('');
      await loadBaseData();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err.message || 'Não foi possível cancelar a entrega.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadComprovante(entregaId) {
    try {
      setComprovanteLoading(true);
      setMessage('');
      setError('');
      const response = await getViveiroEntregaComprovante(entregaId);
      setComprovante(response.data || null);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar o comprovante administrativo da entrega.');
    } finally {
      setComprovanteLoading(false);
    }
  }

  function handlePrintComprovante() {
    window.print();
  }

  const blockedItems = (selectedDetail?.itens || []).filter(
    (item) => Number(item.quantidade_pendente_entrega) > 0 && (!item.lote_reservado_id || Number(item.quantidade_reservada) <= 0)
  );

  return (
    <div style={pageStyles.page}>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }

            .viveiro-comprovante-print,
            .viveiro-comprovante-print * {
              visibility: visible !important;
            }

            .viveiro-comprovante-print {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              border: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }

            .viveiro-no-print {
              display: none !important;
            }
          }
        `}
      </style>
      {message ? <div style={{ ...pageStyles.message, background: '#dcfce7', color: '#166534' }}>{message}</div> : null}
      {error ? <div style={{ ...pageStyles.message, background: '#fee2e2', color: '#991b1b' }}>{error}</div> : null}

      <section style={pageStyles.grid2}>
        <article style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Base formal para entrega</h2>
          <p style={pageStyles.sectionSubtitle}>
            A entrega só pode ser registrada a partir de uma solicitação aprovada com reserva formal de estoque.
          </p>
          <label>
            Solicitação
            <select style={pageStyles.input} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Selecione</option>
              {solicitacoes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.protocolo} - {item.solicitante_nome} - {statusPill(item.status).label}
                </option>
              ))}
            </select>
          </label>

          {selectedDetail ? (
            <div style={{ marginTop: '16px' }}>
              <p><strong>Solicitante:</strong> {selectedDetail.solicitante_nome}</p>
              <p><strong>Status:</strong> {statusPill(selectedDetail.status).label}</p>
              <p><strong>Finalidade:</strong> {selectedDetail.finalidade}</p>
              <p><strong>Reserva:</strong> {selectedDetail.reserva?.protocolo || 'Não criada'}</p>
            </div>
          ) : null}
        </article>

        <article style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Entregas registradas</h2>
          <div style={{ ...pageStyles.actions, marginTop: 0, marginBottom: '12px' }}>
            <input
              style={{ ...pageStyles.input, maxWidth: '260px' }}
              placeholder="Buscar protocolo ou recebedor"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <select
              style={{ ...pageStyles.input, maxWidth: '220px' }}
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">Todos os status</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          {loading ? <p>Carregando entregas...</p> : null}
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Protocolo</th>
                  <th style={pageStyles.th}>Solicitação</th>
                  <th style={pageStyles.th}>Recebedor</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Data</th>
                  <th style={pageStyles.th}>Qtd.</th>
                  <th style={pageStyles.th}>Ações internas</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((item) => {
                  const pill = statusPill(item.status);
                  return (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>{item.protocolo}</td>
                      <td style={pageStyles.td}>{item.solicitacao_protocolo}</td>
                      <td style={pageStyles.td}>{item.recebedor_nome}</td>
                      <td style={pageStyles.td}>
                        <span style={{ padding: '6px 10px', borderRadius: '999px', background: pill.background, color: pill.color, fontWeight: 700, fontSize: '12px' }}>
                          {pill.label}
                        </span>
                        {item.cancelado_por_nome ? <div style={pageStyles.sectionSubtitle}>Por {item.cancelado_por_nome}</div> : null}
                      </td>
                      <td style={pageStyles.td}>{formatDate(item.data_entrega)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_total)}</td>
                      <td style={pageStyles.td}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={pageStyles.buttonSecondary}
                            disabled={comprovanteLoading}
                            onClick={() => handleLoadComprovante(item.id)}
                          >
                            Comprovante
                          </button>
                          {item.status === 'concluida' && canCancel ? (
                            <button
                              type="button"
                              style={pageStyles.buttonSecondary}
                              onClick={() => {
                                setCancelTargetId(String(item.id));
                                setCancelReason('');
                              }}
                            >
                              Cancelar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls pagination={pagination} onPageChange={setPage} />

          {canCancel && cancelTargetId ? (
            <form onSubmit={handleCancelEntrega} style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <h3 style={pageStyles.sectionTitle}>Cancelar entrega {cancelTargetId}</h3>
              <label style={{ display: 'block' }}>
                Motivo do cancelamento
                <textarea
                  style={pageStyles.textarea}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </label>
              <div style={pageStyles.actions}>
                <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
                  {saving ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
                <button
                  type="button"
                  style={pageStyles.buttonSecondary}
                  onClick={() => {
                    setCancelTargetId('');
                    setCancelReason('');
                  }}
                >
                  Fechar
                </button>
              </div>
            </form>
          ) : null}
        </article>
      </section>

      {comprovante ? (
        <section className="viveiro-comprovante-print" style={pageStyles.section}>
          <div className="viveiro-no-print" style={{ ...pageStyles.actions, justifyContent: 'space-between', marginTop: 0 }}>
            <div>
              <h3 style={pageStyles.sectionTitle}>Comprovante administrativo de entrega</h3>
              <p style={pageStyles.sectionSubtitle}>
                Visualização interna para impressão. Este documento não abre solicitação pública nem substitui ato administrativo externo.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" style={pageStyles.buttonPrimary} onClick={handlePrintComprovante}>
                Imprimir
              </button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => setComprovante(null)}>
                Fechar
              </button>
            </div>
          </div>

          <div style={{ borderBottom: '2px solid #0f3d2e', paddingBottom: '14px', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: '#176a36', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              SMAD - Plataforma SIGMA / Viveiro Municipal
            </p>
            <h2 style={{ margin: '8px 0 0 0', color: '#0d1b3d', fontSize: '24px' }}>
              Comprovante Administrativo de Entrega de Mudas
            </h2>
            <p style={{ margin: '8px 0 0 0', color: '#475569' }}>
              Protocolo da entrega: <strong>{comprovante.entrega.protocolo}</strong>
            </p>
            <p style={{ margin: '6px 0 0 0', color: '#475569' }}>
              Identificação documental: <strong>{comprovante.guarda_administrativa?.identificador_documental || comprovante.entrega.protocolo}</strong>
              {' '}vinculada à solicitação <strong>{comprovante.solicitacao.protocolo}</strong>
            </p>
          </div>

          <div style={pageStyles.grid3}>
            <div>
              <p style={pageStyles.metricLabel}>Status da entrega</p>
              <p style={{ margin: '6px 0 0 0', fontWeight: 800 }}>
                {statusPill(comprovante.entrega.status).label}
              </p>
            </div>
            <div>
              <p style={pageStyles.metricLabel}>Data da entrega</p>
              <p style={{ margin: '6px 0 0 0', fontWeight: 800 }}>{formatDate(comprovante.entrega.data_entrega)}</p>
            </div>
            <div>
              <p style={pageStyles.metricLabel}>Solicitação vinculada</p>
              <p style={{ margin: '6px 0 0 0', fontWeight: 800 }}>{comprovante.solicitacao.protocolo}</p>
            </div>
          </div>

          <div style={{ ...pageStyles.grid2, marginTop: '18px' }}>
            <div>
              <h4 style={pageStyles.sectionTitle}>Solicitante</h4>
              <p><strong>Nome:</strong> {comprovante.solicitacao.solicitante_nome || '-'}</p>
              <p><strong>Documento:</strong> {comprovante.solicitacao.solicitante_documento || '-'}</p>
              <p><strong>Instituição:</strong> {comprovante.solicitacao.instituicao_nome || '-'}</p>
              <p><strong>Finalidade:</strong> {comprovante.solicitacao.finalidade || '-'}</p>
              <p><strong>Local de plantio:</strong> {comprovante.solicitacao.local_plantio || '-'}</p>
              <p><strong>Território:</strong> {comprovante.solicitacao.territorio_nome || '-'}</p>
            </div>
            <div>
              <h4 style={pageStyles.sectionTitle}>Recebimento</h4>
              <p><strong>Recebedor:</strong> {comprovante.entrega.recebedor_nome || '-'}</p>
              <p><strong>Documento do recebedor:</strong> {comprovante.entrega.recebedor_documento || '-'}</p>
              <p><strong>Responsável interno:</strong> {comprovante.entrega.registrado_por_nome || '-'}</p>
              <p><strong>Observações:</strong> {comprovante.entrega.observacoes || '-'}</p>
              {comprovante.entrega.status === 'cancelada' ? (
                <p><strong>Cancelamento:</strong> {comprovante.entrega.motivo_cancelamento || 'Entrega cancelada.'}</p>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: '18px' }}>
            <h4 style={pageStyles.sectionTitle}>Itens entregues</h4>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Espécie</th>
                    <th style={pageStyles.th}>Lote</th>
                    <th style={pageStyles.th}>Quantidade</th>
                    <th style={pageStyles.th}>Unidade</th>
                    <th style={pageStyles.th}>Reserva</th>
                  </tr>
                </thead>
                <tbody>
                  {comprovante.itens.map((item) => (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>
                        <strong>{item.especie_nome}</strong>
                        {item.nome_cientifico ? <div style={pageStyles.sectionSubtitle}>{item.nome_cientifico}</div> : null}
                      </td>
                      <td style={pageStyles.td}>
                        {item.lote_codigo || '-'}
                        {item.local_armazenamento ? <div style={pageStyles.sectionSubtitle}>{item.local_armazenamento}</div> : null}
                      </td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_entregue)}</td>
                      <td style={pageStyles.td}>{item.unidade_medida || 'unidade'}</td>
                      <td style={pageStyles.td}>{item.reserva_protocolo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...pageStyles.grid3, marginTop: '18px' }}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Total entregue</p>
              <p style={pageStyles.metricValue}>{formatNumber(comprovante.totais.quantidade_entregue)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Arvômetro (estimativa técnica)</p>
              <p style={pageStyles.metricValue}>{formatNumber(comprovante.totais.arvores_equivalentes)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Área estimada (m²)</p>
              <p style={pageStyles.metricValue}>{formatNumber(comprovante.totais.area_estimada_m2)}</p>
            </div>
          </div>

          <div style={{ ...pageStyles.message, background: '#f8fafc', color: '#0f172a', marginTop: '18px' }}>
            {comprovante.ciencia_administrativa}
          </div>

          {comprovante.guarda_administrativa ? (
            <div style={{ ...pageStyles.message, background: '#eef7ff', color: '#0f3d5c', marginTop: '12px' }}>
              <strong>Guarda administrativa:</strong> {comprovante.guarda_administrativa.procedimento_recomendado}
              {' '}A solução atual permanece em HTML imprimível, sem PDF nativo, hash documental ou armazenamento digital próprio.
            </div>
          ) : null}

          <div style={{ ...pageStyles.grid2, marginTop: '28px' }}>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', color: '#475569' }}>
              Ciência administrativa do recebedor
            </div>
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '8px', color: '#475569' }}>
              Responsável interno SMAD
            </div>
          </div>
        </section>
      ) : null}

      {selectedDetail ? (
        <section style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Registrar entrega</h3>
          {blockedItems.length ? (
            <div style={{ ...pageStyles.message, background: '#fef3c7', color: '#92400e', marginBottom: '12px' }}>
              Alguns itens ainda não possuem reserva ativa. Revise a solicitação e complete a reserva antes de registrar a entrega.
            </div>
          ) : null}

          {canRegister && form.itens.length ? (
            <form onSubmit={handleSubmit}>
              <div style={pageStyles.formGrid}>
                <label>
                  Recebedor
                  <input style={pageStyles.input} value={form.recebedor_nome} onChange={(e) => setForm((prev) => ({ ...prev, recebedor_nome: e.target.value }))} />
                </label>
                <label>
                  Documento
                  <input style={pageStyles.input} value={form.recebedor_documento} onChange={(e) => setForm((prev) => ({ ...prev, recebedor_documento: e.target.value }))} />
                </label>
              </div>

              <label style={{ display: 'block', marginTop: '12px' }}>
                Observações
                <textarea style={pageStyles.textarea} value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
              </label>

              <div style={{ marginTop: '16px' }}>
                <h4 style={pageStyles.sectionTitle}>Itens da entrega</h4>
                {(selectedDetail.itens || [])
                  .filter((item) => Number(item.quantidade_pendente_entrega) > 0 && Number(item.quantidade_reservada) > 0 && item.lote_reservado_id)
                  .map((item, index) => (
                    <div key={item.id} style={{ ...pageStyles.formGrid, marginBottom: '10px' }}>
                      <label>
                        Espécie
                        <input style={pageStyles.input} value={item.especie_nome} disabled />
                      </label>
                      <label>
                        Lote reservado
                        <input
                          style={pageStyles.input}
                          value={`${item.lote_reservado_codigo} - reservado ${formatNumber(item.quantidade_reservada)}`}
                          disabled
                        />
                      </label>
                      <label>
                        Pendente aprovado
                        <input style={pageStyles.input} value={formatNumber(item.quantidade_pendente_entrega)} disabled />
                      </label>
                      <label>
                        Quantidade entregue
                        <input
                          style={pageStyles.input}
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={Math.min(Number(item.quantidade_pendente_entrega), Number(item.quantidade_reservada))}
                          value={form.itens[index]?.quantidade_entregue || ''}
                          onChange={(e) => updateItem(index, 'quantidade_entregue', e.target.value)}
                        />
                      </label>
                    </div>
                  ))}
              </div>

              <div style={pageStyles.actions}>
                <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
                  {saving ? 'Registrando entrega...' : 'Registrar entrega'}
                </button>
              </div>
            </form>
          ) : (
            <p style={pageStyles.sectionSubtitle}>
              Nenhum item com reserva pendente de entrega nesta solicitação.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
