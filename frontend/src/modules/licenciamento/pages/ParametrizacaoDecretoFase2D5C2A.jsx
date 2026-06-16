import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D5C2AGrupo21PreviaSeed } from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  sem_codigo_apto: 'Sem código apto',
  parcial_apto_com_bloqueios: 'Parcial com bloqueios',
  todos_aptos_para_seed_controlado: 'Todos aptos para seed controlado',
  bloqueado_por_inconsistencias: 'Bloqueado por inconsistências',
};

const STATUS_TONES = {
  sem_codigo_apto: 'warn',
  parcial_apto_com_bloqueios: 'warn',
  todos_aptos_para_seed_controlado: 'ok',
  bloqueado_por_inconsistencias: 'danger',
};

const cardStyle = {
  border: '1px solid #d8e5f2',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '16px',
  display: 'grid',
  gap: '10px',
};

const dryRunStyle = {
  border: '1px solid #f7d99a',
  background: '#fffbeb',
  color: '#7c4a03',
  borderRadius: '8px',
  padding: '14px 16px',
  fontSize: '14px',
  fontWeight: 800,
};

function badge(text, tone = 'neutral') {
  const colors = {
    neutral: { background: '#eef2ff', color: '#1e3a8a' },
    ok: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
    danger: { background: '#fee2e2', color: '#991b1b' },
    muted: { background: '#e5e7eb', color: '#374151' },
  };

  return <span style={{ ...pageStyles.pill, ...(colors[tone] || colors.neutral) }}>{text}</span>;
}

function statusLabel(value) {
  return STATUS_LABELS[value] || value || '-';
}

function listText(items = [], fallback = 'Sem registro') {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.join('; ');
}

export default function ParametrizacaoDecretoFase2D5C2A() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C2AGrupo21PreviaSeed();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a previa de seed do Grupo 21.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sortedBloqueios = useMemo(() => (
    [...(status?.bloqueios || [])].sort((left, right) => String(left.codigo).localeCompare(String(right.codigo)))
  ), [status]);

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Fase 2D.5C.2-A - Prévia de Seed e Relatório de Prontidão do Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Simulação técnica de parametrização futura do Grupo 21 - Obras e Estruturas Diversas a partir da bancada manual assistida.
        </p>
      </section>

      <div style={dryRunStyle}>
        Esta tela é apenas uma prévia em modo dry-run. Nenhum dado é inserido na base operacional.
      </div>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando relatório de prontidão...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Total de códigos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCodigosGrupo)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Conferidos integralmente</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosConferidosIntegralmente)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Aptos para seed</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosAptosParaSeed)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Bloqueados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosBloqueados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Prontidão</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.percentualProntidao)}%</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Modo</p>
              <p style={pageStyles.metricValue}>{status.modo}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Resumo de prontidão</h2>
            <div style={pageStyles.actions}>
              {badge(`Grupo ${status.grupo} - ${status.nomeGrupo}`)}
              {badge(statusLabel(status.statusGeral), STATUS_TONES[status.statusGeral])}
              {badge(status.geraSeed ? 'Gera seed' : 'Não gera seed', status.geraSeed ? 'danger' : 'ok')}
              {badge('Base operacional preservada', 'ok')}
            </div>
            {(status.alertas || []).map((alerta) => (
              <p key={alerta} style={pageStyles.sectionSubtitle}>{alerta}</p>
            ))}
            {status.mensagemInstitucional ? (
              <div style={{ ...dryRunStyle, marginTop: 14 }}>
                {status.mensagemInstitucional}
              </div>
            ) : null}
            <p style={pageStyles.sectionSubtitle}><strong>Recomendação:</strong> {status.recomendacaoProximaFase}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Códigos aptos para prévia de seed</h2>
            {status.previasSeed?.length ? (
              <div style={pageStyles.grid2}>
                {status.previasSeed.map((item) => (
                  <article key={item.codigo} style={cardStyle}>
                    <div style={pageStyles.actions}>
                      {badge(item.codigo, 'ok')}
                      {badge('Dry-run', 'neutral')}
                    </div>
                    <h3 style={{ ...pageStyles.sectionTitle, fontSize: 17, marginBottom: 0 }}>{item.nomeAtividade}</h3>
                    <p style={pageStyles.sectionSubtitle}><strong>Parâmetro:</strong> {item.parametroPrincipal} ({item.unidade})</p>
                    <p style={pageStyles.sectionSubtitle}><strong>Classe:</strong> {item.classe || 'Justificada na conferência'}</p>
                    <p style={pageStyles.sectionSubtitle}><strong>Tipo de ato:</strong> {item.tipoAto || 'Justificado na conferência'}</p>
                    <p style={pageStyles.sectionSubtitle}><strong>Faixas:</strong> {formatNumber(item.faixas?.length || 0)}</p>
                    <p style={pageStyles.sectionSubtitle}>{item.observacaoSeed}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p style={pageStyles.sectionSubtitle}>
                Nenhum código do Grupo 21 está apto para seed controlado. É necessário concluir a conferência manual assistida antes de prosseguir.
              </p>
            )}
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Bloqueios</h2>
            {sortedBloqueios.length ? (
              <div style={pageStyles.grid2}>
                {sortedBloqueios.map((item) => (
                  <article key={`${item.codigo}-${item.origemConferenciaId || 'sem-registro'}`} style={cardStyle}>
                    <div style={pageStyles.actions}>
                      {badge(item.codigo, 'warn')}
                      {badge(item.statusConferencia, 'muted')}
                      {badge(item.aptoParaSeed ? 'Marcado apto' : 'Não apto', item.aptoParaSeed ? 'danger' : 'warn')}
                    </div>
                    <h3 style={{ ...pageStyles.sectionTitle, fontSize: 16, marginBottom: 0 }}>{item.nomeAtividade || 'Registro manual pendente'}</h3>
                    <p style={pageStyles.sectionSubtitle}><strong>Motivos:</strong> {listText(item.motivos)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p style={pageStyles.sectionSubtitle}>Sem bloqueios registrados.</p>
            )}
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Inconsistências</h2>
            {status.inconsistencias?.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {status.inconsistencias.map((item) => (
                  <article key={item.id} style={cardStyle}>
                    <div style={pageStyles.actions}>
                      {badge(item.codigo || 'sem código', 'danger')}
                      {badge(item.tipo, 'danger')}
                      {item.faixaOrdem ? badge(`Faixa ${item.faixaOrdem}`, 'neutral') : null}
                    </div>
                    <p style={pageStyles.sectionSubtitle}>{item.mensagem}</p>
                    {item.campo ? <p style={pageStyles.sectionSubtitle}><strong>Campo:</strong> {item.campo}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p style={pageStyles.sectionSubtitle}>Nenhuma inconsistência estrutural detectada nos registros lidos.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
