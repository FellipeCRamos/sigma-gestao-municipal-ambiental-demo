import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D3MapaStatus } from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  parametrizado_integralmente: 'Integral',
  parametrizado_parcialmente: 'Parcial',
  nao_parametrizado: 'Nao parametrizado',
  possui_lacuna_normativa: 'Com lacuna',
  requer_conferencia_pdf: 'Conferir PDF',
  fora_do_escopo_atual: 'Fora do escopo',
};

const STATUS_TONES = {
  parametrizado_integralmente: 'ok',
  parametrizado_parcialmente: 'warn',
  nao_parametrizado: 'muted',
  possui_lacuna_normativa: 'warn',
  requer_conferencia_pdf: 'warn',
  fora_do_escopo_atual: 'muted',
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

export default function ParametrizacaoDecretoFase2D3() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    grupo: '',
    status: '',
    busca: '',
  });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D3MapaStatus();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar o mapa mestre da Fase 2D.3.');
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
      const matchesBusca = !query
        || String(item.grupo || '').includes(query)
        || String(item.nome || '').toLowerCase().includes(query)
        || (item.codigos_cadastrados || []).some((code) => String(code).toLowerCase().includes(query))
        || (item.codigos_pendentes || []).some((code) => String(code).toLowerCase().includes(query));
      return matchesGrupo && matchesStatus && matchesBusca;
    });
  }, [filters, status]);

  const bloqueiosOk = status?.bloqueios_producao
    && Object.values(status.bloqueios_producao).every(Boolean);
  const preservacao = status?.preservacao_fases_anteriores || {};
  const statusOptions = Object.keys(STATUS_LABELS);

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Mapa Mestre do Decreto - Fase 2D.3</h1>
        <p style={pageStyles.sectionSubtitle}>
          Inventario auditavel da cobertura do Decreto Municipal n. 021/2020 no modulo Licenciamento Ambiental.
          Esta etapa nao cadastra novos grupos e nao libera DAM real, cobranca oficial, protocolo definitivo ou decisao automatica.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando mapa mestre do Decreto...</div> : null}

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
              <p style={pageStyles.metricLabel}>Codigos confirmados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_codigos_cadastrados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Grupos integrais</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.grupos_parametrizados_integralmente)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Com lacuna</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.grupos_com_lacuna_normativa)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Conferir PDF</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.grupos_requerem_conferencia_pdf)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Gate, preservacao e bloqueios</h2>
            <div style={pageStyles.actions}>
              {status.liberacao_tecnica ? badge(`Liberacao tecnica: ${status.liberacao_tecnica.codigo}`, 'ok') : badge('Liberacao tecnica nao localizada', 'danger')}
              {badge(`Confirmado em ${formatDate(status.liberacao_tecnica?.confirmado_em)}`, status.liberacao_tecnica ? 'ok' : 'warn')}
              {badge(preservacao.fase2d1 ? 'Fase 2D.1 preservada' : 'Fase 2D.1 inconsistente', preservacao.fase2d1 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d2 ? 'Fase 2D.2 preservada' : 'Fase 2D.2 inconsistente', preservacao.fase2d2 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d21 ? 'Fase 2D.2.1 preservada' : 'Fase 2D.2.1 inconsistente', preservacao.fase2d21 ? 'ok' : 'danger')}
              {badge(bloqueiosOk ? 'Bloqueios de producao ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'danger')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
            <p style={pageStyles.sectionSubtitle}>{status.observacao_contagem}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Recomendacao do Bloco 3</h2>
            <div style={pageStyles.actions}>
              {badge(status.recomendacao_proximo_bloco?.bloco || 'Bloco 3', 'neutral')}
              {badge(status.recomendacao_proximo_bloco?.titulo || 'Grupo pendente', 'warn')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.recomendacao_proximo_bloco?.justificativa}</p>
            <p style={pageStyles.sectionSubtitle}>{status.recomendacao_proximo_bloco?.restricao}</p>
          </section>

          {status.lacunas_normativas?.length ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Lacunas normativas preservadas</h2>
              <div style={pageStyles.tableWrap}>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Codigo</th>
                      <th style={pageStyles.th}>Atividade</th>
                      <th style={pageStyles.th}>Lacuna</th>
                      <th style={pageStyles.th}>Risco controlado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.lacunas_normativas.map((item) => (
                      <tr key={item.codigo}>
                        <td style={pageStyles.td}>{item.codigo}</td>
                        <td style={pageStyles.td}>{item.atividade || '-'}</td>
                        <td style={pageStyles.td}>{item.descricao}</td>
                        <td style={pageStyles.td}>{item.risco}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Cobertura por grupo</h2>
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
                    <th style={pageStyles.th}>Lacunas</th>
                    <th style={pageStyles.th}>Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((item) => (
                    <tr key={item.grupo}>
                      <td style={pageStyles.td}>Grupo {item.grupo}</td>
                      <td style={pageStyles.td}>{item.nome}</td>
                      <td style={pageStyles.td}>
                        {formatNumber(item.total_codigos_esperados)}
                        {item.codigos_pendentes_descricao ? <p style={pageStyles.sectionSubtitle}>{item.codigos_pendentes_descricao}</p> : null}
                      </td>
                      <td style={pageStyles.td}>{formatNumber(item.total_codigos_cadastrados)}</td>
                      <td style={pageStyles.td}>
                        {formatNumber(item.total_codigos_pendentes)}
                        {item.codigos_pendentes?.length ? <p style={pageStyles.sectionSubtitle}>{item.codigos_pendentes.join(', ')}</p> : null}
                      </td>
                      <td style={pageStyles.td}>{coverage(item.percentual_cobertura)}</td>
                      <td style={pageStyles.td}>{badge(STATUS_LABELS[item.status] || item.status, STATUS_TONES[item.status])}</td>
                      <td style={pageStyles.td}>
                        {item.lacunas_normativas?.length
                          ? item.lacunas_normativas.map((code) => <span key={code}>{badge(code, 'warn')}</span>)
                          : badge('Sem lacuna ativa', 'ok')}
                      </td>
                      <td style={pageStyles.td}>
                        {badge(item.prioridade_recomendada || 'media', item.prioridade_recomendada === 'alta' ? 'warn' : 'neutral')}
                        <p style={pageStyles.sectionSubtitle}>{item.recomendacao_prioridade}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {status.riscos?.length ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Riscos remanescentes</h2>
              <div style={pageStyles.actions}>
                {status.riscos.map((item) => badge(item, 'warn'))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
