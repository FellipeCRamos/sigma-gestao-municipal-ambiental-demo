import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D5CGrupo21Status } from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  conferido: 'Conferido',
  pendente_conferencia_visual: 'Conferencia visual',
  lacuna_normativa: 'Lacuna normativa',
  bloqueado_para_seed: 'Bloqueado',
};

const STATUS_TONES = {
  conferido: 'ok',
  pendente_conferencia_visual: 'warn',
  lacuna_normativa: 'danger',
  bloqueado_para_seed: 'danger',
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

function coverage(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function listText(items = [], fallback = 'Nao identificado com seguranca') {
  return items.length ? items.join(', ') : fallback;
}

const codeCardStyle = {
  border: '1px solid #d8e5f2',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '16px',
};

export default function ParametrizacaoDecretoFase2D5C() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ busca: '', status: '' });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5CGrupo21Status();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a conferencia normativa do Grupo 21.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const detalhes = useMemo(() => {
    const query = filters.busca.trim().toLowerCase();
    return (status?.detalhes || []).filter((item) => {
      const matchesStatus = !filters.status || item.statusConferencia === filters.status;
      const matchesBusca = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nomeAtividade || '').toLowerCase().includes(query)
        || String(item.parametroPrincipal || '').toLowerCase().includes(query);
      return matchesStatus && matchesBusca;
    });
  }, [filters, status]);

  const bloqueiosOk = status?.efeitos_produtivos_bloqueados
    && Object.values(status.efeitos_produtivos_bloqueados).every(Boolean);
  const recomendacao = status?.recomendacao_proxima_fase || {};

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Conferencia Normativa - Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Fase 2D.5C para Obras e Estruturas Diversas. Esta tela estrutura a conferencia normativa,
          mas nao cria seed definitivo, nao altera taxa, VRTE, matriz, norma ou fluxo de ato autorizativo.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando conferencia do Grupo 21...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos esperados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_codigos_esperados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos identificados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_codigos_identificados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos conferidos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_codigos_conferidos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Pendentes</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_codigos_pendentes)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Conferencia</p>
              <p style={pageStyles.metricValue}>{coverage(status.percentual_conferencia)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Apto para seed</p>
              <p style={pageStyles.metricValue}>{coverage(status.percentual_apto_para_seed)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Resumo da fase</h2>
            <div style={pageStyles.actions}>
              {badge(status.nomeGrupo || status.nome_grupo, 'neutral')}
              {badge(status.status_geral, 'warn')}
              {badge(status.apto_para_seed ? 'Apto para seed' : 'Nao apto para seed', status.apto_para_seed ? 'ok' : 'warn')}
              {badge(status.seed_operacional_criado ? 'Seed criado' : 'Sem seed operacional', status.seed_operacional_criado ? 'danger' : 'ok')}
              {badge(bloqueiosOk ? 'Bloqueios produtivos ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'danger')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
            <p style={pageStyles.sectionSubtitle}>{status.fonte}</p>
            <p style={pageStyles.sectionSubtitle}>{status.metodo_conferencia}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Codigos do Grupo 21</h2>
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

            <div style={{ ...pageStyles.grid2, marginTop: 16 }}>
              {detalhes.map((item) => (
                <details key={item.codigo} open style={codeCardStyle}>
                  <summary style={{ cursor: 'pointer', color: '#0d1b3d', fontWeight: 850 }}>
                    {item.codigo} - {item.nomeAtividade}
                  </summary>
                  <div style={pageStyles.actions}>
                    {badge(STATUS_LABELS[item.statusConferencia] || item.statusConferencia, STATUS_TONES[item.statusConferencia])}
                    {badge(item.aptoParaSeed ? 'Apto para seed' : 'Bloqueado para seed', item.aptoParaSeed ? 'ok' : 'warn')}
                    {badge(`Confianca ${item.grau_confianca || item.confianca}`, item.grau_confianca === 'alta' ? 'ok' : 'warn')}
                  </div>
                  <div style={{ ...pageStyles.formGrid, marginTop: 14 }}>
                    <p style={pageStyles.sectionSubtitle}><strong>Parametro:</strong> {item.parametroPrincipal || item.parametro_principal}</p>
                    <p style={pageStyles.sectionSubtitle}><strong>Unidade:</strong> {item.unidade || '-'}</p>
                    <p style={pageStyles.sectionSubtitle}><strong>Classe/tipo de ato:</strong> Nao identificado com seguranca</p>
                    <p style={pageStyles.sectionSubtitle}><strong>Documentos:</strong> {item.documentosObservacao || item.documentos_observacao}</p>
                  </div>
                  <p style={pageStyles.sectionSubtitle}><strong>Descricao normativa:</strong> {item.descricaoNormativa || item.descricao_normativa}</p>
                  <p style={pageStyles.sectionSubtitle}>
                    <strong>Faixas OCR:</strong> {listText((item.faixas || []).map((faixa) => faixa.expressao))}
                  </p>
                  <p style={pageStyles.sectionSubtitle}>
                    <strong>Dependencias:</strong> {listText((item.dependencias || []).map((dependencia) => `${dependencia.tipo}: ${dependencia.status}`))}
                  </p>
                  <p style={pageStyles.sectionSubtitle}><strong>Bloqueio:</strong> {item.bloqueioSeed || item.bloqueio_seed}</p>
                </details>
              ))}
            </div>
          </section>

          <section style={pageStyles.grid2}>
            <div style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Lacunas</h2>
              <div style={pageStyles.actions}>
                {(status.lacunas_resumo || []).map((item) => badge(`${item.tipo}: ${item.prioridade}`, 'warn'))}
              </div>
              {(status.lacunas_resumo || []).map((item) => (
                <p key={item.tipo} style={pageStyles.sectionSubtitle}>{item.descricao}</p>
              ))}
            </div>
            <div style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Proxima acao</h2>
              <div style={pageStyles.actions}>
                {badge(recomendacao.fase || '2D.5C.1', 'neutral')}
                {badge(recomendacao.proximo_passo || 'conferencia_visual_pdf', 'warn')}
                {badge(recomendacao.seed_direto_recomendado ? 'Seed direto' : 'Sem seed direto', recomendacao.seed_direto_recomendado ? 'danger' : 'ok')}
              </div>
              <p style={pageStyles.sectionSubtitle}>{recomendacao.justificativa}</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
