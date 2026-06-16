import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D5BComplementacaoStatus } from '../services/licenciamentoAdminApi';
import { formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  parametrizado_integralmente: 'Integral',
  parametrizado_parcialmente: 'Parcial',
  possui_lacuna_normativa: 'Com lacuna',
  fonte_oficial_confirmada_sem_parametrizacao: 'Fonte confirmada',
  requer_conferencia_pdf: 'Conferir PDF',
  nao_parametrizado: 'Nao parametrizado',
};

const STATUS_TONES = {
  parametrizado_integralmente: 'ok',
  parametrizado_parcialmente: 'warn',
  possui_lacuna_normativa: 'warn',
  fonte_oficial_confirmada_sem_parametrizacao: 'warn',
  requer_conferencia_pdf: 'warn',
  nao_parametrizado: 'muted',
};

const PRIORITY_LABELS = {
  alta: 'Alta',
  media: 'Media',
  baixa: 'Baixa',
  concluido: 'Concluido',
  concluido_com_ressalvas: 'Com ressalvas',
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

function compactCodes(codes = []) {
  if (!codes.length) return '-';
  const preview = codes.slice(0, 10).join(', ');
  return codes.length > 10 ? `${preview} +${codes.length - 10}` : preview;
}

export default function ParametrizacaoDecretoFase2D5B() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ grupo: '', status: '', prioridade: '', busca: '' });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5BComplementacaoStatus();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a complementacao controlada da Fase 2D.5B.');
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
      const matchesGrupo = !filters.grupo || String(item.grupo) === filters.grupo;
      const matchesStatus = !filters.status || item.status === filters.status;
      const matchesPrioridade = !filters.prioridade || item.prioridade_recomendada === filters.prioridade;
      const matchesBusca = !query
        || String(item.grupo || '').includes(query)
        || String(item.nome || '').toLowerCase().includes(query)
        || (item.codigos_esperados || []).some((code) => String(code).toLowerCase().includes(query))
        || (item.codigos_pendentes || []).some((code) => String(code).toLowerCase().includes(query));
      return matchesGrupo && matchesStatus && matchesPrioridade && matchesBusca;
    });
  }, [filters, status]);

  const statusOptions = Object.keys(STATUS_LABELS);
  const priorityOptions = Object.keys(PRIORITY_LABELS);
  const bloqueiosOk = status?.efeitos_produtivos_bloqueados
    && Object.values(status.efeitos_produtivos_bloqueados).every(Boolean);
  const recomendacao = status?.recomendacao_bloco4 || {};

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Complementacao Controlada - Fase 2D.5B</h1>
        <p style={pageStyles.sectionSubtitle}>
          Saneamento diagnostico do mapa mestre com nomes e codigos confirmados no Decreto Municipal n. 021/2020.
          A fase nao cria seed de novos grupos, nao altera taxa, VRTE, matriz ou norma e nao libera efeitos produtivos.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando complementacao controlada...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Grupos identificados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_grupos_identificados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Cobertura por grupo</p>
              <p style={pageStyles.metricValue}>{coverage(status.percentual_geral_cobertura_por_grupo)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Cobertura de codigos</p>
              <p style={pageStyles.metricValue}>{coverage(status.percentual_cobertura_codigos_confirmados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Fonte oficial sem seed</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.grupos_com_fonte_oficial_confirmada_sem_seed)}</p>
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
            <h2 style={pageStyles.sectionTitle}>Estado controlado</h2>
            <div style={pageStyles.actions}>
              {badge(`Grupo 19: ${STATUS_LABELS[status.grupo19?.status] || status.grupo19?.status}`, status.grupo19?.status === 'parametrizado_integralmente' ? 'ok' : 'warn')}
              {badge(`Grupo 20: ${STATUS_LABELS[status.grupo20?.status] || status.grupo20?.status}`, status.grupo20?.status === 'parametrizado_integralmente' ? 'ok' : 'warn')}
              {badge(status.seed_parametrizacao_novos_grupos_criado ? 'Seed criado' : 'Sem seed de novos grupos', status.seed_parametrizacao_novos_grupos_criado ? 'danger' : 'ok')}
              {badge(bloqueiosOk ? 'Bloqueios produtivos ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'danger')}
              {badge(`Sem nome oficial: ${formatNumber(status.grupos_sem_nome_oficial)}`, status.grupos_sem_nome_oficial === 0 ? 'ok' : 'warn')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Recomendacao do Bloco 4</h2>
            <div style={pageStyles.actions}>
              {badge(recomendacao.bloco || 'Bloco 4', 'neutral')}
              {badge(recomendacao.titulo || recomendacao.grupo_recomendado || 'Grupo 21', 'warn')}
              {badge(recomendacao.proximo_passo || 'conferencia_normativa_detalhada', 'warn')}
              {badge(recomendacao.seed_direto_recomendado ? 'Seed direto' : 'Sem seed direto', recomendacao.seed_direto_recomendado ? 'danger' : 'ok')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{recomendacao.justificativa}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Grupos e cobertura</h2>
            <div style={pageStyles.formGrid}>
              <label style={pageStyles.label}>
                Grupo
                <select style={pageStyles.input} value={filters.grupo} onChange={(event) => setFilters((current) => ({ ...current, grupo: event.target.value }))}>
                  <option value="">Todos</option>
                  {(status.grupos || []).map((item) => <option key={item.grupo} value={String(item.grupo)}>Grupo {item.grupo}</option>)}
                </select>
              </label>
              <label style={pageStyles.label}>
                Status
                <select style={pageStyles.input} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Todos</option>
                  {statusOptions.map((option) => <option key={option} value={option}>{STATUS_LABELS[option]}</option>)}
                </select>
              </label>
              <label style={pageStyles.label}>
                Prioridade
                <select style={pageStyles.input} value={filters.prioridade} onChange={(event) => setFilters((current) => ({ ...current, prioridade: event.target.value }))}>
                  <option value="">Todas</option>
                  {priorityOptions.map((option) => <option key={option} value={option}>{PRIORITY_LABELS[option]}</option>)}
                </select>
              </label>
              <label style={pageStyles.label}>
                Busca
                <input style={pageStyles.input} value={filters.busca} onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))} placeholder="Grupo, nome ou codigo" />
              </label>
            </div>

            <div style={{ ...pageStyles.tableWrap, marginTop: 16 }}>
              <table style={{ ...pageStyles.table, minWidth: 1120 }}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Grupo</th>
                    <th style={{ ...pageStyles.th, minWidth: 230 }}>Nome oficial</th>
                    <th style={pageStyles.th}>Esperados</th>
                    <th style={pageStyles.th}>Cadastrados</th>
                    <th style={pageStyles.th}>Pendentes</th>
                    <th style={pageStyles.th}>Cobertura</th>
                    <th style={pageStyles.th}>Status</th>
                    <th style={pageStyles.th}>Prioridade</th>
                    <th style={{ ...pageStyles.th, minWidth: 280 }}>Observacao</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((item) => (
                    <tr key={item.grupo}>
                      <td style={pageStyles.td}>Grupo {item.grupo}</td>
                      <td style={pageStyles.td}>{item.nome}</td>
                      <td style={pageStyles.td}>
                        {formatNumber(item.total_codigos_esperados)}
                        <p style={pageStyles.sectionSubtitle}>{compactCodes(item.codigos_esperados)}</p>
                      </td>
                      <td style={pageStyles.td}>{formatNumber(item.total_codigos_cadastrados)}</td>
                      <td style={pageStyles.td}>
                        {formatNumber(item.total_codigos_pendentes)}
                        <p style={pageStyles.sectionSubtitle}>{compactCodes(item.codigos_pendentes)}</p>
                      </td>
                      <td style={pageStyles.td}>{coverage(item.percentual_cobertura)}</td>
                      <td style={pageStyles.td}>{badge(STATUS_LABELS[item.status] || item.status, STATUS_TONES[item.status])}</td>
                      <td style={pageStyles.td}>{badge(PRIORITY_LABELS[item.prioridade_recomendada] || item.prioridade_recomendada, item.prioridade_recomendada === 'alta' ? 'warn' : 'neutral')}</td>
                      <td style={pageStyles.td}>
                        <p style={pageStyles.sectionSubtitle}>{item.bloqueio_tecnico || item.recomendacao_prioridade}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={pageStyles.grid2}>
            <div style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Lacunas preservadas</h2>
              <div style={pageStyles.actions}>
                {(status.lacunas_normativas || []).map((item) => badge(`${item.codigo} preservada`, 'warn'))}
                {status.lacunas_normativas?.length ? null : badge('Sem lacuna retornada', 'muted')}
              </div>
            </div>
            <div style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Riscos remanescentes</h2>
              <div style={pageStyles.actions}>
                {(status.riscos_remanescentes || []).map((item) => badge(item, 'warn'))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
