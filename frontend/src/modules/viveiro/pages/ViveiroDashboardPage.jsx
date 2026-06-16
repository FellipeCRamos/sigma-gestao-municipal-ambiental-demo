import { useEffect, useState } from 'react';
import { getViveiroDashboard } from '../services/viveiroAdminApi';
import { formatDate, formatNumber, pageStyles, statusPill } from './shared';

export default function ViveiroDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');
        const response = await getViveiroDashboard();
        setDashboard(response.data || null);
      } catch (err) {
        setError(err.message || 'Não foi possível carregar o dashboard do Viveiro.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return <p>Carregando dashboard do Viveiro...</p>;
  }

  if (error) {
    return <p style={{ color: '#b91c1c' }}>{error}</p>;
  }

  const totais = dashboard?.totais || {};
  const estoqueCritico = dashboard?.estoque_critico || [];
  const movimentacoes = dashboard?.movimentacoes_recentes || [];
  const statusSolicitacoes = dashboard?.solicitacoes_por_status || [];
  const arvometro = dashboard?.arvometro || {};

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Dashboard do Viveiro</h2>
        <p style={pageStyles.sectionSubtitle}>
          Panorama interno de espécies, estoque, solicitações, entregas e Arvômetro como estimativa técnica.
        </p>
      </section>

      <section style={pageStyles.grid3}>
        {[
          ['Espécies ativas', totais.especies_ativas],
          ['Lotes ativos', totais.lotes_ativos],
          ['Mudas disponíveis', totais.mudas_disponiveis],
          ['Mudas reservadas', totais.mudas_reservadas],
          ['Solicitações pendentes', totais.solicitacoes_pendentes],
          ['Solicitações aprovadas', totais.solicitacoes_aprovadas],
          ['Entregas concluídas', totais.entregas_concluidas],
        ].map(([label, value]) => (
          <article key={label} style={pageStyles.cardMetric}>
            <p style={pageStyles.metricLabel}>{label}</p>
            <p style={pageStyles.metricValue}>{formatNumber(value)}</p>
          </article>
        ))}
      </section>

      <section style={pageStyles.grid2}>
        <article style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Arvômetro (estimativa técnica)</h3>
          <div style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Mudas entregues</p>
              <p style={pageStyles.metricValue}>{formatNumber(arvometro.mudas_entregues)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Árvores equivalentes estimadas</p>
              <p style={pageStyles.metricValue}>{formatNumber(arvometro.arvores_equivalentes)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Área estimada de plantio (m²)</p>
              <p style={pageStyles.metricValue}>{formatNumber(arvometro.area_estimada_m2)}</p>
            </div>
          </div>
          <p style={{ ...pageStyles.sectionSubtitle, marginTop: '12px' }}>
            {arvometro.metodologia || 'Estimativa técnica prudente; não constitui indicador ambiental certificado.'}
          </p>
        </article>

        <article style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Solicitações por status</h3>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {statusSolicitacoes.map((item) => {
                  const pill = statusPill(item.status);

                  return (
                    <tr key={item.status}>
                      <td style={pageStyles.td}>
                        <span style={{ padding: '6px 10px', borderRadius: '999px', background: pill.background, color: pill.color, fontSize: '12px', fontWeight: 700 }}>
                          {pill.label}
                        </span>
                      </td>
                      <td style={pageStyles.td}>{formatNumber(item.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section style={pageStyles.grid2}>
        <article style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Estoque crítico</h3>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Espécie</th>
                  <th style={pageStyles.th}>Físico</th>
                  <th style={pageStyles.th}>Reservado</th>
                  <th style={pageStyles.th}>Disponível</th>
                  <th style={pageStyles.th}>Mínimo</th>
                  <th style={pageStyles.th}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {estoqueCritico.map((item) => (
                  <tr key={item.id}>
                    <td style={pageStyles.td}>{item.nome}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_fisico)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_reservado)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_disponivel)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.estoque_minimo_alerta)}</td>
                    <td style={pageStyles.td}>
                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: item.abaixo_do_minimo ? '#fee2e2' : '#dcfce7',
                          color: item.abaixo_do_minimo ? '#991b1b' : '#166534',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {item.abaixo_do_minimo ? 'Abaixo do mínimo' : 'Adequado'}
                      </span>
                    </td>
                  </tr>
                ))}
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
                  <th style={pageStyles.th}>Espécie</th>
                  <th style={pageStyles.th}>Lote</th>
                  <th style={pageStyles.th}>Quantidade</th>
                  <th style={pageStyles.th}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((item) => (
                  <tr key={item.id}>
                    <td style={pageStyles.td}>{formatDate(item.created_at)}</td>
                    <td style={pageStyles.td}>{item.tipo}</td>
                    <td style={pageStyles.td}>{item.especie_nome}</td>
                    <td style={pageStyles.td}>{item.lote_codigo}</td>
                    <td style={pageStyles.td}>{formatNumber(item.quantidade)}</td>
                    <td style={pageStyles.td}>{formatNumber(item.saldo_posterior)}</td>
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
