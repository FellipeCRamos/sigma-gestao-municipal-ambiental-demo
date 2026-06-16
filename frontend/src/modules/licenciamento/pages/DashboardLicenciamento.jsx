import { useEffect, useState } from 'react';
import { getLicenciamentoResumo } from '../services/licenciamentoAdminApi';
import { formatNumber, LICENCIAMENTO_STATUS_LABELS, pageStyles } from './shared';

export default function DashboardLicenciamento({ navigateToPage }) {
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadResumo() {
      setLoading(true);
      setError('');

      try {
        const response = await getLicenciamentoResumo();
        if (mounted) {
          setResumo(response.data);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || 'Erro ao carregar resumo.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadResumo();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Dashboard do Licenciamento</h2>
            <p style={pageStyles.sectionSubtitle}>
              Visão inicial dos processos ambientais cadastrados na Plataforma SIGMA.
            </p>
          </div>
          <button type="button" style={pageStyles.buttonPrimary} onClick={() => navigateToPage?.('novo')}>
            Novo processo
          </button>
        </div>
      </section>

      {error ? (
        <div style={{ ...pageStyles.message, ...pageStyles.dangerText }}>{error}</div>
      ) : null}

      <section style={pageStyles.grid3}>
        <MetricCard label="Processos cadastrados" value={loading ? '...' : resumo?.total_processos} />
        <MetricCard label="Processos ativos" value={loading ? '...' : resumo?.processos_ativos} />
        <MetricCard label="Em diligência" value={loading ? '...' : resumo?.em_diligencia} />
        <MetricCard label="Em análise técnica" value={loading ? '...' : resumo?.em_analise_tecnica} />
        <MetricCard label="Pendências abertas" value={loading ? '...' : resumo?.pendencias_abertas} />
        <MetricCard label="Licenças emitidas" value={loading ? '...' : resumo?.licencas_emitidas} />
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Distribuição por status</h3>
        <div style={pageStyles.tableWrap}>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(resumo?.por_status || []).length > 0 ? (
                resumo.por_status.map((item) => (
                  <tr key={item.status}>
                    <td style={pageStyles.td}>{LICENCIAMENTO_STATUS_LABELS[item.status] || item.status}</td>
                    <td style={pageStyles.td}>{formatNumber(item.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={pageStyles.td} colSpan={2}>
                    {loading ? 'Carregando...' : 'Nenhum processo cadastrado ainda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <article style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{label}</p>
      <p style={pageStyles.metricValue}>{value === undefined || value === null ? '0' : formatNumber(value)}</p>
    </article>
  );
}
