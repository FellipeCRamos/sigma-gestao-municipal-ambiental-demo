import { useEffect, useMemo, useState } from 'react';
import {
  getLicenciamentoParametrizacaoFase2D5C3BGrupo21BloqueioNormativo,
  registrarLicenciamentoParametrizacaoFase2D5C3BGrupo21Bloqueio,
} from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const badgeColors = {
  neutral: { background: '#eef2ff', color: '#1e3a8a' },
  ok: { background: '#dcfce7', color: '#166534' },
  warn: { background: '#fef3c7', color: '#92400e' },
  danger: { background: '#fee2e2', color: '#991b1b' },
  muted: { background: '#e5e7eb', color: '#374151' },
};

const cardStyle = {
  border: '1px solid #d8e5f2',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '16px',
  display: 'grid',
  gap: '10px',
};

const alertStyle = {
  border: '1px solid #fecaca',
  background: '#fff7f7',
  color: '#7f1d1d',
  borderRadius: '8px',
  padding: '14px 16px',
  fontSize: '14px',
  fontWeight: 800,
};

function badge(text, tone = 'neutral') {
  return <span style={{ ...pageStyles.pill, ...(badgeColors[tone] || badgeColors.neutral) }}>{text}</span>;
}

function list(items = []) {
  if (!Array.isArray(items) || items.length === 0) return <p style={pageStyles.sectionSubtitle}>Sem registro.</p>;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((item) => (
        <div key={item} style={{ ...cardStyle, padding: '12px 14px' }}>
          <p style={{ ...pageStyles.sectionSubtitle, margin: 0 }}>{item}</p>
        </div>
      ))}
    </div>
  );
}

export default function ParametrizacaoDecretoFase2D5C3B({ navigateToPage }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justificativa, setJustificativa] = useState(
    'Encerramento tecnico provisorio do Grupo 21 por insuficiencia de fonte municipal segura, mantendo bloqueio para seed operacional ate saneamento documental.'
  );

  async function load({ resetMessage = true } = {}) {
    setLoading(true);
    if (resetMessage) {
      setMessage('');
    }
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C3BGrupo21BloqueioNormativo();
      setStatus(response.data);
      return true;
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar o bloqueio normativo do Grupo 21.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const codigos = useMemo(() => (
    [...(status?.resultadoPorCodigo || [])].sort((left, right) => String(left.codigo).localeCompare(String(right.codigo)))
  ), [status]);

  async function handleRegistrarBloqueio() {
    setSubmitting(true);
    setMessage('');
    try {
      const response = await registrarLicenciamentoParametrizacaoFase2D5C3BGrupo21Bloqueio({ justificativa });
      const reloaded = await load({ resetMessage: false });
      if (reloaded) {
        setMessage(`Bloqueio normativo registrado no historico de ${formatNumber(response.data?.registrosHistoricoCriados)} codigos.`);
      }
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel registrar o bloqueio normativo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Fase 2D.5C.3-B - Bloqueio Normativo do Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Encerramento técnico provisório e formalização do bloqueio normativo do Grupo 21 - Obras e Estruturas Diversas.
        </p>
        <div style={pageStyles.actions}>
          {badge('Bloqueado por insuficiência de fonte municipal segura', 'danger')}
          {badge('Sem seed', 'ok')}
          {badge('Histórico preservado', 'neutral')}
        </div>
      </section>

      <div style={alertStyle}>
        Enquanto o bloqueio estiver ativo, o Grupo 21 não deve ser parametrizado operacionalmente.
      </div>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando bloqueio normativo...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Total de códigos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCodigos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Códigos com lacuna</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosComLacuna)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Lacunas remanescentes</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.lacunasRemanescentes)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Códigos aptos para seed</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosAptosParaSeed)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Atividades 21.%</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.atividadesOperacionaisGrupo21)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Seed permitido</p>
              <p style={pageStyles.metricValue}>{status.seedPermitido ? 'sim' : 'não'}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Motivo do Bloqueio</h2>
            <p style={pageStyles.sectionSubtitle}>{status.motivoBloqueio}</p>
            <div style={pageStyles.actions}>
              {badge(status.statusGeral, 'danger')}
              {badge(status.seedPermitido ? 'seed permitido' : 'seed não permitido', status.seedPermitido ? 'danger' : 'ok')}
              {badge(`${formatNumber(status.registrosAtivosBancada)} registros ativos na bancada`, 'neutral')}
            </div>
          </section>

          <section style={pageStyles.grid2}>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Fontes Necessárias</h2>
              {list(status.fontesNecessarias)}
            </article>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Encaminhamentos Recomendados</h2>
              {list(status.encaminhamentosRecomendados)}
            </article>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Minuta de Solicitação de Fonte Oficial Complementar</h2>
            <div style={{ ...cardStyle, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {status.minutaSolicitacaoFonte}
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Registro Formal do Bloqueio</h2>
            <label style={pageStyles.label}>
              Justificativa
              <textarea
                style={pageStyles.textarea}
                value={justificativa}
                onChange={(event) => setJustificativa(event.target.value)}
              />
            </label>
            <div style={pageStyles.actions}>
              <button
                type="button"
                style={pageStyles.buttonPrimary}
                onClick={handleRegistrarBloqueio}
                disabled={submitting || !status.permissoes?.registrarBloqueio}
              >
                {submitting ? 'Registrando...' : 'Registrar bloqueio normativo'}
              </button>
              {!status.permissoes?.registrarBloqueio ? badge('sem permissão para registrar', 'muted') : null}
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Situação por Código</h2>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Código</th>
                    <th style={pageStyles.th}>Status</th>
                    <th style={pageStyles.th}>Lacunas</th>
                    <th style={pageStyles.th}>Seed</th>
                  </tr>
                </thead>
                <tbody>
                  {codigos.map((item) => (
                    <tr key={item.codigo}>
                      <td style={pageStyles.td}>
                        <strong>{item.codigo}</strong>
                        <p style={pageStyles.sectionSubtitle}>{item.nomeAtividade}</p>
                      </td>
                      <td style={pageStyles.td}>{badge(item.statusConferencia, 'warn')}</td>
                      <td style={pageStyles.td}>
                        <strong>{formatNumber(item.lacunasRemanescentes)}</strong>
                        <p style={pageStyles.sectionSubtitle}>{(item.camposComLacuna || []).join('; ') || 'Sem detalhamento'}</p>
                      </td>
                      <td style={pageStyles.td}>{item.aptoParaSeed ? badge('apto', 'danger') : badge('não apto', 'ok')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Atalhos</h2>
            <div style={pageStyles.actions}>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2')}>Bancada 2D.5C.2</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2a')}>Prévia dry_run 2D.5C.2-A</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2b')}>Importação 2D.5C.2-B</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c3a')}>Conferência Complementar 2D.5C.3-A</button>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Próxima Ação Técnica</h2>
            <p style={pageStyles.sectionSubtitle}>{status.proximaAcaoTecnica}</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
