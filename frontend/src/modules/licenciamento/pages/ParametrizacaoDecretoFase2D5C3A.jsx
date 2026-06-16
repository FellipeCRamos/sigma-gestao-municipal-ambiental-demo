import { useEffect, useMemo, useState } from 'react';
import {
  aplicarLicenciamentoParametrizacaoFase2D5C3AGrupo21Complementacao,
  getLicenciamentoParametrizacaoFase2D5C3AGrupo21ConferenciaComplementar,
} from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  sem_complementacao_normativa_segura: 'Sem complementação segura',
  complementacoes_seguras_identificadas_para_aplicacao_controlada: 'Complementações seguras identificadas',
};

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
  border: '1px solid #f7d99a',
  background: '#fffbeb',
  color: '#7c4a03',
  borderRadius: '8px',
  padding: '14px 16px',
  fontSize: '14px',
  fontWeight: 800,
};

const blockedStyle = {
  border: '1px solid #fecaca',
  background: '#fff7f7',
  color: '#7f1d1d',
  borderRadius: '8px',
  padding: '14px 16px',
  fontSize: '14px',
  fontWeight: 750,
};

function badge(text, tone = 'neutral') {
  return <span style={{ ...pageStyles.pill, ...(badgeColors[tone] || badgeColors.neutral) }}>{text}</span>;
}

function listText(items = [], fallback = 'Sem registro') {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.join('; ');
}

function statusLabel(value) {
  return STATUS_LABELS[value] || value || '-';
}

function sourceTone(source) {
  if (source?.natureza === 'normativa_principal') return 'ok';
  if (source?.grauConfianca?.includes('baixo')) return 'danger';
  return 'warn';
}

export default function ParametrizacaoDecretoFase2D5C3A({ navigateToPage }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C3AGrupo21ConferenciaComplementar();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a conferencia complementar do Grupo 21.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const codigosOrdenados = useMemo(() => (
    [...(status?.resultadoPorCodigo || [])].sort((left, right) => String(left.codigo).localeCompare(String(right.codigo)))
  ), [status]);

  const complementacoesSeguras = status?.complementacoesSeguras || [];

  async function handleAplicarComplementacao() {
    if (!status || complementacoesSeguras.length === 0) return;
    setApplying(true);
    setMessage('');

    try {
      const fonteNormativa = status.fontesConsultadas?.find((item) => item.natureza === 'normativa_principal')
        || status.fontesConsultadas?.[0];
      await aplicarLicenciamentoParametrizacaoFase2D5C3AGrupo21Complementacao({
        confirmarAplicacaoComplementacao: true,
        justificativa: 'Aplicacao controlada de complementacoes seguras identificadas no diagnostico 2D.5C.3-A.',
        fonteNormativaComplementar: {
          titulo: fonteNormativa?.titulo,
          natureza: fonteNormativa?.natureza,
          grauConfianca: fonteNormativa?.grauConfianca,
          evidencia: fonteNormativa?.escopo || fonteNormativa?.resultado,
        },
        complementacoes: complementacoesSeguras,
      });
      setMessage('Complementacao aplicada somente na bancada manual auditavel.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel aplicar a complementacao.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Fase 2D.5C.3-A - Conferência Complementar do Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Diagnóstico complementar de tipo de ato, limites, classes e documentos mínimos para Obras e Estruturas Diversas.
        </p>
        <div style={pageStyles.actions}>
          {badge('Grupo 21', 'neutral')}
          {badge('Sem seed', 'ok')}
          {badge('Bancada manual auditável', 'neutral')}
          {status ? badge(statusLabel(status.statusGeral), status.statusGeral?.includes('seguras') ? 'warn' : 'danger') : null}
        </div>
      </section>

      <div style={alertStyle}>
        Esta fase não cria seed, não cadastra atividade definitiva e não altera motor, taxa, VRTE, eDocs ou ato autorizativo.
      </div>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando conferência complementar...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Códigos analisados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosAnalisados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Lacunas originais</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.lacunasOriginais)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Lacunas preenchidas</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.lacunasPreenchidas)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Lacunas remanescentes</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.lacunasRemanescentes)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Aptos para seed</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosAptosParaSeed)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Bloqueados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosBloqueados)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Situação Antes da Complementação</h2>
            <div style={pageStyles.actions}>
              {badge(`${formatNumber(status.situacaoAntesComplementacao?.registrosAtivosBancada)} registros ativos`, 'neutral')}
              {badge(`${formatNumber(status.situacaoAntesComplementacao?.statusConferidoComLacunas)} com lacunas`, 'warn')}
              {badge(`${formatNumber(status.situacaoAntesComplementacao?.aptosParaSeed)} aptos`, status.situacaoAntesComplementacao?.aptosParaSeed ? 'warn' : 'ok')}
              {badge(`${formatNumber(status.situacaoAntesComplementacao?.atividadesOperacionaisGrupo21)} atividades 21.%`, status.situacaoAntesComplementacao?.atividadesOperacionaisGrupo21 ? 'danger' : 'ok')}
            </div>
            <p style={pageStyles.sectionSubtitle}>
              Prévia dry-run 2D.5C.2-A: {formatNumber(status.situacaoAntesComplementacao?.previaDryRun?.codigosAptosParaSeed)} aptos,
              {' '}{formatNumber(status.situacaoAntesComplementacao?.previaDryRun?.codigosBloqueados)} bloqueados e
              {' '}{formatNumber(status.situacaoAntesComplementacao?.previaDryRun?.inconsistencias)} inconsistências.
            </p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Fontes Consultadas</h2>
            <div style={pageStyles.grid2}>
              {(status.fontesConsultadas || []).map((fonte) => (
                <article key={fonte.id || fonte.titulo} style={cardStyle}>
                  <div style={pageStyles.actions}>
                    {badge(fonte.natureza || 'fonte', sourceTone(fonte))}
                    {badge(fonte.grauConfianca || 'sem grau', fonte.grauConfianca?.includes('baixo') ? 'danger' : 'neutral')}
                  </div>
                  <h3 style={{ ...pageStyles.sectionTitle, fontSize: 16, marginBottom: 0 }}>{fonte.titulo}</h3>
                  <p style={pageStyles.sectionSubtitle}><strong>Escopo:</strong> {fonte.escopo || '-'}</p>
                  <p style={pageStyles.sectionSubtitle}><strong>Resultado:</strong> {fonte.resultado || '-'}</p>
                  <p style={pageStyles.sectionSubtitle}><strong>Limitação:</strong> {fonte.limitacao || '-'}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Complementações Propostas</h2>
            {complementacoesSeguras.length ? (
              <div style={pageStyles.actions}>
                {badge(`${formatNumber(complementacoesSeguras.length)} complementações seguras`, 'warn')}
                <button
                  type="button"
                  style={pageStyles.buttonPrimary}
                  onClick={handleAplicarComplementacao}
                  disabled={applying}
                >
                  {applying ? 'Aplicando...' : 'Aplicar complementação'}
                </button>
              </div>
            ) : (
              <div style={blockedStyle}>
                Nenhuma complementação segura foi identificada nas fontes oficiais ou institucionais disponíveis. Os códigos seguem bloqueados para seed futuro.
              </div>
            )}
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Lacunas por Código</h2>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Código</th>
                    <th style={pageStyles.th}>Status</th>
                    <th style={pageStyles.th}>Campos com lacuna</th>
                    <th style={pageStyles.th}>Fonte</th>
                    <th style={pageStyles.th}>Confiança</th>
                    <th style={pageStyles.th}>Seed</th>
                  </tr>
                </thead>
                <tbody>
                  {codigosOrdenados.map((item) => (
                    <tr key={item.codigo}>
                      <td style={pageStyles.td}>
                        <strong>{item.codigo}</strong>
                        <p style={pageStyles.sectionSubtitle}>{item.nomeAtividade}</p>
                      </td>
                      <td style={pageStyles.td}>
                        <div style={pageStyles.actions}>
                          {badge(item.statusAtual, item.statusAtual === 'conferido_integralmente' ? 'ok' : 'warn')}
                          {item.bloqueado ? badge('bloqueado', 'danger') : badge('liberado', 'ok')}
                        </div>
                      </td>
                      <td style={pageStyles.td}>
                        <strong>{formatNumber(item.lacunasRemanescentes)}</strong>
                        <p style={pageStyles.sectionSubtitle}>{listText(item.camposComLacuna)}</p>
                        <p style={pageStyles.sectionSubtitle}>{listText(item.lacunasAtivas)}</p>
                      </td>
                      <td style={pageStyles.td}>{item.fonteJustificadora || 'Sem fonte complementar segura'}</td>
                      <td style={pageStyles.td}>{item.grauConfianca || '-'}</td>
                      <td style={pageStyles.td}>
                        {item.aptoParaSeedPretendido ? badge('apto futuro', 'ok') : badge('não apto', 'warn')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Bloqueios e Próxima Fase</h2>
            <p style={pageStyles.sectionSubtitle}><strong>Recomendação:</strong> {status.recomendacaoProximaFase}</p>
            <div style={pageStyles.grid2}>
              {codigosOrdenados.map((item) => (
                <article key={`${item.codigo}-bloqueio`} style={cardStyle}>
                  <div style={pageStyles.actions}>
                    {badge(item.codigo, 'neutral')}
                    {badge(item.aptoParaSeedPretendido ? 'apto' : 'não apto', item.aptoParaSeedPretendido ? 'ok' : 'warn')}
                  </div>
                  <p style={pageStyles.sectionSubtitle}><strong>Motivos:</strong> {listText(item.motivosBloqueio)}</p>
                  <p style={pageStyles.sectionSubtitle}>{item.observacaoTecnica}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Atalhos da Parametrização</h2>
            <div style={pageStyles.actions}>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2')}>Bancada 2D.5C.2</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2b')}>Importação 2D.5C.2-B</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2a')}>Prévia dry-run 2D.5C.2-A</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2c')}>Preparação 2D.5C.2-C</button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
