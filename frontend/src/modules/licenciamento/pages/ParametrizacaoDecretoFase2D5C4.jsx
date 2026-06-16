import { useEffect, useMemo, useState } from 'react';
import {
  getLicenciamentoParametrizacaoFase2D5C4Grupo21PreviaSeed,
  getLicenciamentoParametrizacaoFase2D5C4Grupo21RevisaoNormativa,
} from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const badgeColors = {
  neutral: { background: '#eef2ff', color: '#1e3a8a' },
  ok: { background: '#dcfce7', color: '#166534' },
  warn: { background: '#fef3c7', color: '#92400e' },
  danger: { background: '#fee2e2', color: '#991b1b' },
  info: { background: '#e0f2fe', color: '#075985' },
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

const riskStyle = {
  border: '1px solid #fed7aa',
  background: '#fff7ed',
  color: '#7c2d12',
  borderRadius: '8px',
  padding: '14px 16px',
  display: 'grid',
  gap: '8px',
};

function badge(text, tone = 'neutral') {
  return <span style={{ ...pageStyles.pill, ...(badgeColors[tone] || badgeColors.neutral) }}>{text}</span>;
}

function fieldText(item, field) {
  return item?.enquadramento?.[field]?.texto || '-';
}

function fieldTone(item, field) {
  return item?.enquadramento?.[field]?.naoAplicavel ? 'muted' : 'neutral';
}

function aptidaoTone(value) {
  if (value === 'sim') return 'ok';
  if (value === 'parcial') return 'warn';
  return 'danger';
}

function statusTone(value) {
  if (String(value || '').includes('apto_para_seed')) return 'ok';
  if (String(value || '').includes('parcial')) return 'warn';
  return 'danger';
}

function InlineList({ items = [], empty = 'Sem registro.' }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p style={pageStyles.sectionSubtitle}>{empty}</p>;
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((item) => badge(item, 'neutral'))}
    </div>
  );
}

function TechnicalList({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p style={pageStyles.sectionSubtitle}>Sem pendencia registrada.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((item) => (
        <div key={`${item.codigo || ''}-${item.campo || item.condicao || item}`} style={{ ...cardStyle, padding: '12px 14px' }}>
          <strong>{item.campo || item.condicao || item.parametro || 'Pendencia'}</strong>
          <p style={pageStyles.sectionSubtitle}>{item.descricao || item.motivo || item}</p>
        </div>
      ))}
    </div>
  );
}

export default function ParametrizacaoDecretoFase2D5C4({ navigateToPage }) {
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function load({ resetMessage = true } = {}) {
    setLoading(true);
    if (resetMessage) setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C4Grupo21RevisaoNormativa();
      setStatus(response.data);
      return true;
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a revisao normativa do Grupo 21.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    setPreviewLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C4Grupo21PreviaSeed();
      setPreview(response.data);
      setMessage('Previa de seed revisada carregada em modo dry-run. Nenhum seed operacional foi aplicado.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a previa de seed revisada.');
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const codigos = useMemo(() => (
    [...(status?.resultadoPorCodigo || [])].sort((left, right) => String(left.codigo).localeCompare(String(right.codigo)))
  ), [status]);

  const destaques = useMemo(() => (
    codigos.filter((item) => ['21.01', '21.04', '21.06', '21.09'].includes(item.codigo))
  ), [codigos]);

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Grupo 21 — Revisão Normativa Controlada 2D.5C.4</h1>
        <p style={pageStyles.sectionSubtitle}>
          Releitura tecnica da planilha oficial do Grupo 21, separando campo nao aplicavel, regra residual, dispensa condicionada, limite municipal e lacuna real.
        </p>
        <div style={pageStyles.actions}>
          {badge('Dry-run', 'ok')}
          {badge('Sem seed operacional', 'ok')}
          {badge('Revisao granular', 'info')}
        </div>
        <div style={pageStyles.actions}>
          <button type="button" style={pageStyles.buttonPrimary} onClick={() => load()} disabled={loading}>
            {loading ? 'Atualizando...' : 'Executar diagnostico'}
          </button>
          <button type="button" style={pageStyles.buttonSecondary} onClick={loadPreview} disabled={previewLoading}>
            {previewLoading ? 'Carregando...' : 'Carregar previa de seed'}
          </button>
        </div>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando revisao normativa...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Total de codigos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCodigos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Aptos integrais</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCodigosAptos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Parcialmente aptos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCodigosParcialmenteAptos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Impacto local limitado</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCodigosComImpactoLocalLimitado)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Lacunas reais</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalLacunasReais)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Campos nao aplicaveis</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCamposNaoAplicaveis)}</p>
            </div>
          </section>

          <section style={pageStyles.grid2}>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Resumo Executivo</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <strong>Codigos aptos</strong>
                  <InlineList items={status.codigosAptos} />
                </div>
                <div>
                  <strong>Codigos parcialmente aptos</strong>
                  <InlineList items={status.codigosParcialmenteAptos} />
                </div>
                <div>
                  <strong>Regras condicionais</strong>
                  <InlineList items={status.codigosComRegraCondicional} />
                </div>
                <div>
                  <strong>Bloqueio por impacto local</strong>
                  <InlineList items={status.codigosComImpactoLocalLimitado} />
                </div>
              </div>
            </article>

            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Fonte e Interpretacao</h2>
              <p style={pageStyles.sectionSubtitle}>{status.fonteNormativaAnalisada?.principal}</p>
              <p style={pageStyles.sectionSubtitle}>{status.fonteNormativaAnalisada?.historicoConferido}</p>
              <div style={pageStyles.actions}>
                {badge(`${formatNumber(status.totalCamposTodos)} usos de "Todos"`, 'ok')}
                {badge(`${formatNumber(status.totalCamposDemaisCasos)} regra residual`, 'warn')}
                {badge(`${formatNumber(status.totalCamposNaoAplicaveis)} campos "-"`, 'muted')}
              </div>
            </article>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Matriz Revisada do Grupo 21</h2>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Codigo</th>
                    <th style={pageStyles.th}>Descricao</th>
                    <th style={pageStyles.th}>Parametro</th>
                    <th style={pageStyles.th}>Classe simplificada</th>
                    <th style={pageStyles.th}>Pequeno</th>
                    <th style={pageStyles.th}>Medio</th>
                    <th style={pageStyles.th}>Grande</th>
                    <th style={pageStyles.th}>Potencial</th>
                    <th style={pageStyles.th}>Impacto local</th>
                    <th style={pageStyles.th}>Status revisado</th>
                    <th style={pageStyles.th}>Observacao tecnica</th>
                    <th style={pageStyles.th}>Apto para seed</th>
                  </tr>
                </thead>
                <tbody>
                  {codigos.map((item) => (
                    <tr key={item.codigo}>
                      <td style={pageStyles.td}><strong>{item.codigo}</strong></td>
                      <td style={{ ...pageStyles.td, minWidth: 260 }}>{item.atividade}</td>
                      <td style={pageStyles.td}>
                        <strong>{item.parametro?.sigla}</strong>
                        <p style={pageStyles.sectionSubtitle}>{item.parametro?.nome} ({item.parametro?.unidade})</p>
                      </td>
                      <td style={pageStyles.td}>{badge(fieldText(item, 'classeSimplificada'), fieldTone(item, 'classeSimplificada'))}</td>
                      <td style={pageStyles.td}>{badge(fieldText(item, 'pequeno'), fieldTone(item, 'pequeno'))}</td>
                      <td style={pageStyles.td}>{badge(fieldText(item, 'medio'), fieldTone(item, 'medio'))}</td>
                      <td style={pageStyles.td}>{badge(fieldText(item, 'grande'), fieldTone(item, 'grande'))}</td>
                      <td style={pageStyles.td}>{badge(item.potencialPoluidorDegradador, item.potencialPoluidorDegradador === 'Alto' ? 'danger' : 'neutral')}</td>
                      <td style={pageStyles.td}>{badge(item.impactoLocal?.texto, item.impactoLocal?.tipo === 'limitado' ? 'warn' : 'ok')}</td>
                      <td style={pageStyles.td}>{badge(item.statusRevisado, statusTone(item.statusRevisado))}</td>
                      <td style={{ ...pageStyles.td, minWidth: 260 }}>{item.observacaoTecnica}</td>
                      <td style={pageStyles.td}>{badge(item.aptidaoSeed, aptidaoTone(item.aptidaoSeed))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Destaques Tecnicos</h2>
            <div style={pageStyles.grid2}>
              {destaques.map((item) => (
                <article key={item.codigo} style={cardStyle}>
                  <div style={pageStyles.actions}>
                    {badge(item.codigo, 'neutral')}
                    {badge(item.aptidaoSeed, aptidaoTone(item.aptidaoSeed))}
                  </div>
                  <strong>{item.atividade}</strong>
                  <p style={pageStyles.sectionSubtitle}>{item.observacaoTecnica}</p>
                  <TechnicalList items={[...(item.lacunasReais || []), ...(item.bloqueiosMunicipais || [])]} />
                </article>
              ))}
            </div>
          </section>

          <section style={pageStyles.grid2}>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Lacunas Reais</h2>
              <TechnicalList items={status.lacunasReais} />
            </article>
            <article style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Bloqueios de Impacto Local</h2>
              <TechnicalList items={status.bloqueiosMunicipais} />
            </article>
          </section>

          <section style={riskStyle}>
            <h2 style={{ ...pageStyles.sectionTitle, marginBottom: 0 }}>Riscos Normativos</h2>
            <p style={pageStyles.sectionSubtitle}>Nao inferir competencia municipal fora do limite de impacto local.</p>
            <p style={pageStyles.sectionSubtitle}>Nao converter dispensa em licenca simplificada nem licenca simplificada em dispensa.</p>
            <p style={pageStyles.sectionSubtitle}>Nao tratar "-" como lacuna automatica quando a coluna indicar nao aplicabilidade.</p>
            <p style={pageStyles.sectionSubtitle}>Nao liberar seed operacional para regra condicional ou lacuna real sem fase posterior e confirmacao tecnica.</p>
          </section>

          {preview ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Previa de Seed Revisada</h2>
              <div style={pageStyles.actions}>
                {badge(`${formatNumber(preview.totalCodigosLiberaveisParaSeed)} liberaveis`, 'ok')}
                {badge(`${formatNumber(preview.totalCodigosParciais)} parciais`, 'warn')}
                {badge(preview.seedOperacionalCriado ? 'seed criado' : 'sem seed operacional', preview.seedOperacionalCriado ? 'danger' : 'ok')}
              </div>
              <p style={pageStyles.sectionSubtitle}>{preview.recomendacao}</p>
              <div style={pageStyles.grid2}>
                <div style={cardStyle}>
                  <strong>Codigos liberaveis</strong>
                  <InlineList items={preview.codigosLiberaveisParaSeed} />
                </div>
                <div style={cardStyle}>
                  <strong>Codigos parciais</strong>
                  <InlineList items={preview.codigosParciais} />
                </div>
              </div>
            </section>
          ) : null}

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Atalhos</h2>
            <div style={pageStyles.actions}>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c3b')}>Bloqueio 2D.5C.3-B</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2')}>Bancada 2D.5C.2</button>
              <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('parametrizacao2d5c2a')}>Previa antiga 2D.5C.2-A</button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
