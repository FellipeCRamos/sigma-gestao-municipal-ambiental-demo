import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D5C1Grupo21ConferenciaVisual } from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  conferido_integralmente: 'Conferido',
  conferido_com_lacunas: 'Com lacuna',
  duvida_visual: 'Duvida visual',
  bloqueado: 'Bloqueado',
};

const STATUS_TONES = {
  conferido_integralmente: 'ok',
  conferido_com_lacunas: 'warn',
  duvida_visual: 'danger',
  bloqueado: 'danger',
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

function listText(items = [], fallback = 'Nao consta no trecho visual') {
  return items.length ? items.join('; ') : fallback;
}

function statusLabel(value) {
  return STATUS_LABELS[value] || value || '-';
}

const codeCardStyle = {
  border: '1px solid #d8e5f2',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '16px',
};

const rangeStyle = {
  border: '1px solid #e7eef7',
  borderRadius: '8px',
  padding: '12px',
  background: '#f7fbff',
};

export default function ParametrizacaoDecretoFase2D5C1() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ busca: '', status: '' });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C1Grupo21ConferenciaVisual();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a conferencia visual do Grupo 21.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const codigos = useMemo(() => {
    const query = filters.busca.trim().toLowerCase();
    return (status?.codigos || []).filter((item) => {
      const matchesStatus = !filters.status || item.statusConferencia === filters.status;
      const matchesBusca = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nomeAtividade || '').toLowerCase().includes(query)
        || String(item.parametroPrincipal || '').toLowerCase().includes(query);
      return matchesStatus && matchesBusca;
    });
  }, [filters, status]);

  const recomendacao = status?.recomendacao_proxima_fase || {};
  const bloqueiosOk = status?.efeitos_produtivos_bloqueados
    && Object.values(status.efeitos_produtivos_bloqueados).every(Boolean);

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Fase 2D.5C.1 — Conferência Visual do Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Conferencia linha a linha do Grupo 21 — Obras e Estruturas Diversas, com base no PDF oficial do Decreto Municipal nº 21/2020.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando conferencia visual do Grupo 21...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Total de codigos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.totalCodigos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Visualmente conferidos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosVisualmenteConferidos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Conferidos integrais</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosConferidos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Com lacuna</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosComLacuna)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Bloqueados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigosBloqueados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Apto para seed</p>
              <p style={pageStyles.metricValue}>{status.aptoParaSeed ? 'Sim' : 'Nao'}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Resumo geral</h2>
            <div style={pageStyles.actions}>
              {badge(`Grupo ${status.grupo} - ${status.nomeGrupo}`, 'neutral')}
              {badge(status.statusGeral, status.statusGeral === 'pronto_para_seed_controlado' ? 'ok' : 'warn')}
              {badge(status.aptoParaSeed ? 'Apto para seed futuro' : 'Nao apto para seed', status.aptoParaSeed ? 'ok' : 'warn')}
              {badge(bloqueiosOk ? 'Seed e efeitos produtivos bloqueados' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'danger')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
            <p style={pageStyles.sectionSubtitle}><strong>Fonte oficial:</strong> {status.fonte_normativa}</p>
            <p style={pageStyles.sectionSubtitle}><strong>Metodo:</strong> {status.metodo}</p>
            <p style={pageStyles.sectionSubtitle}>
              <strong>Cabecalho visual:</strong> {status.cabecalhoVisual?.pagina_pdf} — {status.cabecalhoVisual?.trecho_tabela}
            </p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Filtros</h2>
            <div style={pageStyles.formGrid}>
              <label style={pageStyles.label}>
                Status
                <select style={pageStyles.input} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label style={pageStyles.label}>
                Busca
                <input style={pageStyles.input} value={filters.busca} onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))} placeholder="Codigo, atividade ou parametro" />
              </label>
            </div>
          </section>

          <div style={pageStyles.grid2}>
            {codigos.map((item) => (
              <details key={item.codigo} open style={codeCardStyle}>
                <summary style={{ cursor: 'pointer', color: '#0d1b3d', fontWeight: 850 }}>
                  {item.codigo} - {item.nomeAtividade}
                </summary>
                <div style={pageStyles.actions}>
                  {badge(statusLabel(item.statusConferencia), STATUS_TONES[item.statusConferencia])}
                  {badge(item.aptoParaSeedFuturo ? 'Apto para seed futuro' : 'Nao apto para seed', item.aptoParaSeedFuturo ? 'ok' : 'warn')}
                  {badge(`Confianca ${item.confianca}`, item.confianca === 'alta' ? 'ok' : 'warn')}
                  {badge(`Potencial ${item.potencialPoluidor}`, 'neutral')}
                </div>

                <div style={{ ...pageStyles.formGrid, marginTop: 14 }}>
                  <p style={pageStyles.sectionSubtitle}><strong>Parametro:</strong> {item.parametroPrincipal}</p>
                  <p style={pageStyles.sectionSubtitle}><strong>Unidade:</strong> {item.unidade}</p>
                  <p style={pageStyles.sectionSubtitle}><strong>Tipo normativo:</strong> {item.tipoNormativo}</p>
                  <p style={pageStyles.sectionSubtitle}><strong>Limite de impacto local:</strong> {item.limiteImpactoLocal}</p>
                </div>

                <p style={pageStyles.sectionSubtitle}><strong>Evidencia visual:</strong> {item.evidenciaVisual?.paginaPdf} — {item.evidenciaVisual?.trechoTabela}</p>
                <p style={pageStyles.sectionSubtitle}><strong>Tipo de ato/licenca:</strong> {item.tipoAtoLicencaObservacao}</p>
                <p style={pageStyles.sectionSubtitle}><strong>Documentos minimos:</strong> {item.documentosObservacao}</p>

                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                  {(item.faixasConferidas || []).map((faixa) => (
                    <div key={`${item.codigo}-${faixa.ordem}`} style={rangeStyle}>
                      <div style={pageStyles.actions}>
                        {badge(faixa.colunaTabela, 'neutral')}
                        {badge(faixa.operador, 'muted')}
                        {badge(faixa.porte || 'Sem porte', faixa.porte === 'Classe Simplificada' ? 'ok' : 'neutral')}
                      </div>
                      <p style={pageStyles.sectionSubtitle}><strong>Faixa:</strong> {faixa.textoNormativoFaixa}</p>
                      <p style={pageStyles.sectionSubtitle}><strong>Classe/tipo de ato:</strong> {faixa.classe || 'Nao consta classe operacional nesta coluna'} / {faixa.tipoAto || 'Nao consta ato especifico'}</p>
                    </div>
                  ))}
                </div>

                <p style={pageStyles.sectionSubtitle}>
                  <strong>Observacoes normativas:</strong> {listText(item.observacoesNormativas)}
                </p>
                <p style={pageStyles.sectionSubtitle}>
                  <strong>Bloqueios normativos:</strong> {listText(item.bloqueiosNormativos)}
                </p>
                <p style={pageStyles.sectionSubtitle}>
                  <strong>Dependencias setoriais:</strong> {listText((item.dependenciasSetoriais || []).map((dep) => `${dep.tipo}: ${dep.status}`))}
                </p>
              </details>
            ))}
          </div>

          <section style={pageStyles.grid2}>
            <div style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Lacunas</h2>
              <div style={pageStyles.actions}>
                {(status.lacunasResumo || []).map((item) => (
                  <span key={item.tipo}>{badge(`${item.tipo}: ${item.prioridade}`, 'warn')}</span>
                ))}
              </div>
              {(status.lacunasResumo || []).map((item) => (
                <p key={item.tipo} style={pageStyles.sectionSubtitle}>{item.descricao}</p>
              ))}
            </div>
            <div style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Proxima fase recomendada</h2>
              <div style={pageStyles.actions}>
                {badge(recomendacao.fase || '2D.5C.2-A', 'neutral')}
                {badge(recomendacao.seed_controlado_recomendado ? 'Seed controlado recomendado' : 'Seed bloqueado', recomendacao.seed_controlado_recomendado ? 'ok' : 'warn')}
              </div>
              <p style={pageStyles.sectionSubtitle}>{recomendacao.justificativa || status.recomendacaoProximaFase}</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
