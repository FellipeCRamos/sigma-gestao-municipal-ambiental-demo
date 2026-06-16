import { useEffect, useMemo, useState } from 'react';
import {
  createViveiroMovimentacaoAjuste,
  getViveiroEstoque,
  getViveiroMovimentacoes,
} from '../services/viveiroAdminApi';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import { formatDate, formatNumber, pageStyles, statusPill, unpackListPayload } from './shared';

const INITIAL_FORM = {
  lote_id: '',
  tipo: 'ajuste_positivo',
  quantidade: '',
  observacoes: '',
};

export default function ViveiroEstoquePage({ usuarioInterno }) {
  const [estoque, setEstoque] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canManage = hasPermission(usuarioInterno, PERMISSIONS.VIVEIRO_MOVIMENTACOES_MANAGE);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [estoqueResponse, movimentacoesResponse] = await Promise.all([
        getViveiroEstoque(),
        getViveiroMovimentacoes({ page: 1, page_size: 20 }),
      ]);
      setEstoque(estoqueResponse.data || null);
      setMovimentacoes(unpackListPayload(movimentacoesResponse.data).items);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar o estoque do Viveiro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const lotesDisponiveis = useMemo(() => estoque?.lotes || [], [estoque]);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError('');
      setMessage('');
      await createViveiroMovimentacaoAjuste(form);
      setMessage('Ajuste de estoque registrado com sucesso.');
      setForm(INITIAL_FORM);
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível registrar o ajuste.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Carregando estoque do Viveiro...</p>;
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Estoque consolidado</h2>
        <p style={pageStyles.sectionSubtitle}>
          Controle de disponibilidade física, reserva operacional e histórico de movimentações.
        </p>
      </section>

      <section style={pageStyles.grid3}>
        <article style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Mudas disponíveis</p>
          <p style={pageStyles.metricValue}>{formatNumber(estoque?.totais?.mudas_disponiveis)}</p>
        </article>
        <article style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Mudas reservadas</p>
          <p style={pageStyles.metricValue}>{formatNumber(estoque?.totais?.mudas_reservadas)}</p>
        </article>
        <article style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Lotes disponíveis</p>
          <p style={pageStyles.metricValue}>{formatNumber(estoque?.totais?.lotes_disponiveis)}</p>
        </article>
        <article style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Mudas entregues</p>
          <p style={pageStyles.metricValue}>{formatNumber(estoque?.totais?.mudas_entregues)}</p>
        </article>
        <article style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Espécies abaixo do mínimo</p>
          <p style={pageStyles.metricValue}>{formatNumber(estoque?.totais?.especies_abaixo_minimo)}</p>
        </article>
      </section>

      {message ? <div style={{ ...pageStyles.message, background: '#dcfce7', color: '#166534' }}>{message}</div> : null}
      {error ? <div style={{ ...pageStyles.message, background: '#fee2e2', color: '#991b1b' }}>{error}</div> : null}

      <section style={pageStyles.grid2}>
        <article style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Disponibilidade por espécie</h3>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Espécie</th>
                  <th style={pageStyles.th}>Físico</th>
                  <th style={pageStyles.th}>Reservado</th>
                  <th style={pageStyles.th}>Disponível</th>
                  <th style={pageStyles.th}>Mínimo</th>
                  <th style={pageStyles.th}>Lotes</th>
                  <th style={pageStyles.th}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {(estoque?.por_especie || []).map((item) => (
                  <tr key={item.id}>
                    <td style={pageStyles.td}>{item.nome}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_fisico)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_reservado)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_disponivel)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_minimo_alerta)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.lotes_ativos)}</td>
                    <td style={pageStyles.td}>
                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: item.abaixo_do_minimo ? '#fee2e2' : '#dcfce7',
                          color: item.abaixo_do_minimo ? '#991b1b' : '#166534',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}
                      >
                        {item.abaixo_do_minimo ? 'Abaixo do mínimo' : 'Estável'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        {canManage ? (
          <article style={pageStyles.section}>
            <h3 style={pageStyles.sectionTitle}>Registrar ajuste manual</h3>
            <form onSubmit={handleSubmit}>
              <div style={pageStyles.formGrid}>
                <label>
                  Lote
                  <select style={pageStyles.input} value={form.lote_id} onChange={(e) => setForm((prev) => ({ ...prev, lote_id: e.target.value }))}>
                    <option value="">Selecione</option>
                    {lotesDisponiveis.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.codigo} - {item.especie_nome} ({formatNumber(item.quantidade_livre)} livres)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo
                  <select style={pageStyles.input} value={form.tipo} onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}>
                    <option value="ajuste_positivo">Ajuste positivo</option>
                    <option value="ajuste_negativo">Ajuste negativo</option>
                  </select>
                </label>
                <label>
                  Quantidade
                  <input style={pageStyles.input} type="number" min="0.01" step="0.01" value={form.quantidade} onChange={(e) => setForm((prev) => ({ ...prev, quantidade: e.target.value }))} />
                </label>
              </div>

              <label style={{ display: 'block', marginTop: '12px' }}>
                Observações
                <textarea style={pageStyles.textarea} value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
              </label>

              <div style={pageStyles.actions}>
                <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
                  {saving ? 'Registrando...' : 'Registrar ajuste'}
                </button>
              </div>
            </form>
          </article>
        ) : null}
      </section>

      <section style={pageStyles.grid2}>
        <article style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Lotes</h3>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Código</th>
                  <th style={pageStyles.th}>Espécie</th>
                  <th style={pageStyles.th}>Físico</th>
                  <th style={pageStyles.th}>Reservado</th>
                  <th style={pageStyles.th}>Livre</th>
                  <th style={pageStyles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(estoque?.lotes || []).map((item) => {
                  const pill = statusPill(item.status);
                  return (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>{item.codigo}</td>
                      <td style={pageStyles.td}>{item.especie_nome}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_disponivel)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_reservada)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_livre)}</td>
                      <td style={pageStyles.td}>
                        <span style={{ padding: '6px 10px', borderRadius: '999px', background: pill.background, color: pill.color, fontWeight: 700, fontSize: '12px' }}>
                          {pill.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Movimentações recentes</h3>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Data</th>
                  <th style={pageStyles.th}>Tipo</th>
                  <th style={pageStyles.th}>Lote</th>
                  <th style={pageStyles.th}>Espécie</th>
                  <th style={pageStyles.th}>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((item) => (
                  <tr key={item.id}>
                    <td style={pageStyles.td}>{formatDate(item.created_at)}</td>
                    <td style={pageStyles.td}>{item.tipo}</td>
                    <td style={pageStyles.td}>{item.lote_codigo}</td>
                    <td style={pageStyles.td}>{item.especie_nome}</td>
                    <td style={pageStyles.td}>{formatNumber(item.quantidade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
