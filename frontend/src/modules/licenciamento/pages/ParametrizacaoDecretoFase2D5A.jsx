import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D5AMapaStatus } from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  parametrizado_integralmente: 'Integral',
  parametrizado_parcialmente: 'Parcial',
  possui_lacuna_normativa: 'Com lacuna',
  requer_conferencia_pdf: 'Conferir PDF',
  nao_parametrizado: 'Nao parametrizado',
};

const STATUS_TONES = {
  parametrizado_integralmente: 'ok',
  parametrizado_parcialmente: 'warn',
  possui_lacuna_normativa: 'warn',
  requer_conferencia_pdf: 'warn',
  nao_parametrizado: 'muted',
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

export default function ParametrizacaoDecretoFase2D5A() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ status: '', busca: '' });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5AMapaStatus();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar o mapa pos-Grupo 19.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grupos = useMemo(() => {
    const query = filters.busca.trim().toLowerCase();
    return (status?.grupos || []).filter((item) => {
      const matchesStatus = !filters.status || item.status === filters.status;
      const matchesBusca = !query
        || String(item.grupo || '').includes(query)
        || String(item.nome || '').toLowerCase().includes(query)
        || (item.codigos_cadastrados || []).some((code) => code.toLowerCase().includes(query))
        || (item.codigos_pendentes || []).some((code) => code.toLowerCase().includes(query));
      return matchesStatus && matchesBusca;
    });
  }, [filters, status]);

  const bloqueiosOk = status?.bloqueios_producao
    && Object.values(status.bloqueios_producao).every(Boolean);
  const grupo19 = status?.grupo19 || {};
  const recomendacao = status?.recomendacao_bloco4 || status?.recomendacao_proximo_bloco || {};

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Mapa Mestre Pos-Grupo 19 - Fase 2D.5-A</h1>
        <p style={pageStyles.sectionSubtitle}>
          Atualizacao diagnostica do mapa mestre apos a Fase 2D.4-B. A tela nao cria seed de novos grupos,
          nao altera taxa, VRTE, matriz ou norma e nao libera efeitos produtivos.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando mapa mestre pos-Grupo 19...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Grupos identificados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_grupos_identificados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Cobertura geral</p>
              <p style={pageStyles.metricValue}>{coverage(status.percentual_geral_cobertura)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Cobertura dos codigos</p>
              <p style={pageStyles.metricValue}>{coverage(status.percentual_cobertura_codigos_confirmados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Grupos integrais</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.grupos_parametrizados_integralmente)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos cadastrados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_codigos_cadastrados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos pendentes</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_codigos_pendentes)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Grupo 19 e bloqueios</h2>
            <div style={pageStyles.actions}>
              {badge(`Grupo 19: ${STATUS_LABELS[grupo19.status] || grupo19.status}`, grupo19.status === 'parametrizado_integralmente' ? 'ok' : 'warn')}
              {badge('19.01 cadastrado', grupo19.codigos_cadastrados?.includes('19.01') ? 'ok' : 'danger')}
              {badge('19.02 cadastrado', grupo19.codigos_cadastrados?.includes('19.02') ? 'ok' : 'danger')}
              {badge('19.03 preservado', grupo19.piloto_1903_preservado ? 'ok' : 'danger')}
              {badge('19.04 cadastrado', grupo19.codigos_cadastrados?.includes('19.04') ? 'ok' : 'danger')}
              {badge(bloqueiosOk ? 'Bloqueios produtivos ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'danger')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Recomendacao do Bloco 4</h2>
            <div style={pageStyles.actions}>
              {badge(recomendacao.bloco || 'Bloco 4', 'neutral')}
              {badge(recomendacao.titulo || recomendacao.grupo_recomendado || 'Conferencia normativa', 'warn')}
              {badge(recomendacao.proximo_passo || 'conferencia_normativa', 'warn')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{recomendacao.justificativa}</p>
            <p style={pageStyles.sectionSubtitle}>
              Seed direto: {recomendacao.seed_direto_recomendado ? 'sim' : 'nao'}.
            </p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Lacunas normativas preservadas</h2>
            <div style={pageStyles.actions}>
              {(status.lacunas_normativas || []).map((item) => badge(`${item.codigo} preservada`, 'warn'))}
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Cobertura por grupo</h2>
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
                <input style={pageStyles.input} value={filters.busca} onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))} placeholder="Grupo, nome ou codigo" />
              </label>
            </div>

            <div style={{ ...pageStyles.tableWrap, marginTop: 16 }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Grupo</th>
                    <th style={pageStyles.th}>Nome</th>
                    <th style={pageStyles.th}>Esperados</th>
                    <th style={pageStyles.th}>Cadastrados</th>
                    <th style={pageStyles.th}>Pendentes</th>
                    <th style={pageStyles.th}>Cobertura</th>
                    <th style={pageStyles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((item) => (
                    <tr key={item.grupo}>
                      <td style={pageStyles.td}>Grupo {item.grupo}</td>
                      <td style={pageStyles.td}>{item.nome}</td>
                      <td style={pageStyles.td}>{formatNumber(item.total_codigos_esperados)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.total_codigos_cadastrados)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.total_codigos_pendentes)}</td>
                      <td style={pageStyles.td}>{coverage(item.percentual_cobertura)}</td>
                      <td style={pageStyles.td}>{badge(STATUS_LABELS[item.status] || item.status, STATUS_TONES[item.status])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {status.riscos_remanescentes?.length ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Riscos remanescentes</h2>
              <div style={pageStyles.actions}>
                {status.riscos_remanescentes.map((item) => badge(item, 'warn'))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
