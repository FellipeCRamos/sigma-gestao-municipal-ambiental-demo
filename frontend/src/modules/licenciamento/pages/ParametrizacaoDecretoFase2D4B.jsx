import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D4BGrupo19Status } from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles } from './shared';

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

function statusTone(item) {
  if (!item?.existe_no_sistema) return 'warn';
  if (item?.preservado_2d4b) return 'ok';
  if (item?.novo_cadastrado_2d4b) return 'ok';
  return 'neutral';
}

function formatList(items, fallback = '-') {
  if (!items?.length) return fallback;
  return items.join(', ');
}

export default function ParametrizacaoDecretoFase2D4B() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ busca: '', modo: '' });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D4BGrupo19Status();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a parametrizacao do Grupo 19.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const atividades = useMemo(() => {
    const query = filters.busca.trim().toLowerCase();
    return (status?.atividades || []).filter((item) => {
      const matchesBusca = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nome || '').toLowerCase().includes(query)
        || String(item.parametro_enquadramento || '').toLowerCase().includes(query);
      const matchesModo = !filters.modo
        || (filters.modo === 'novo' && item.novo_cadastrado_2d4b)
        || (filters.modo === 'preservado' && item.preservado_2d4b)
        || (filters.modo === 'pendente' && !item.existe_no_sistema);
      return matchesBusca && matchesModo;
    });
  }, [filters, status]);

  const bloqueiosOk = status?.bloqueios_producao
    && Object.values(status.bloqueios_producao).every(Boolean);
  const preservacao = status?.preservacao_fases_anteriores || {};
  const piloto = status?.status_piloto_1903;

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Parametrizacao Grupo 19 - Fase 2D.4-B</h1>
        <p style={pageStyles.sectionSubtitle}>
          Parametrizacao controlada do Grupo 19 - Energia. Esta tela confirma os codigos novos 19.01, 19.02 e 19.04,
          preserva o piloto 19.03 e mantem bloqueados DAM real, cobranca oficial, protocolo definitivo e decisao automatica.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando parametrizacao do Grupo 19...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos esperados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_esperados?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos cadastrados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_cadastrados?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Novos 2D.4-B</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_novos?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Regras</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_regras)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Perguntas publicas</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_perguntas_publicas)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Documentos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.total_documentos_vinculados)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Resumo, preservacao e bloqueios</h2>
            <div style={pageStyles.actions}>
              {badge(`Grupo ${status.grupo_parametrizado?.numero} - ${status.grupo_parametrizado?.nome}`, 'neutral')}
              {badge(status.seed_executado ? 'Seed executado' : 'Seed pendente', status.seed_executado ? 'ok' : 'warn')}
              {badge(`Piloto ${status.codigo_preservado} preservado`, piloto?.preservado ? 'ok' : 'danger')}
              {badge(bloqueiosOk ? 'Bloqueios produtivos ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'danger')}
              {badge(`Atualizado em ${formatDate(status.atualizado_em)}`, 'neutral')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
            <p style={pageStyles.sectionSubtitle}>{status.grupo_parametrizado?.fonte_normativa}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Piloto 19.03</h2>
            <div style={pageStyles.actions}>
              {badge(piloto?.status || 'sem status', piloto?.preservado ? 'ok' : 'danger')}
              {badge(piloto?.divergencia_material ? 'Divergencia material' : 'Sem divergencia material', piloto?.divergencia_material ? 'danger' : 'ok')}
              {badge(`Regras: ${formatNumber(piloto?.detalhes?.regras)}`, 'neutral')}
              {badge(`Documentos: ${formatNumber(piloto?.detalhes?.documentos_vinculados)}`, 'neutral')}
            </div>
            <p style={pageStyles.sectionSubtitle}>
              {'A Fase 2D.4-B nao sobrescreve o piloto 19.03. Seu limite AIN <= 500.000 m2, regras, perguntas e documentos seguem preservados.'}
            </p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Codigos do Grupo 19</h2>
            <div style={pageStyles.formGrid}>
              <label style={pageStyles.label}>
                Busca
                <input style={pageStyles.input} value={filters.busca} onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))} placeholder="Codigo, descricao ou parametro" />
              </label>
              <label style={pageStyles.label}>
                Modo
                <select style={pageStyles.input} value={filters.modo} onChange={(event) => setFilters((current) => ({ ...current, modo: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="novo">Novos cadastrados</option>
                  <option value="preservado">Preservado</option>
                  <option value="pendente">Pendentes</option>
                </select>
              </label>
            </div>

            <div style={{ ...pageStyles.tableWrap, marginTop: 16 }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Codigo</th>
                    <th style={pageStyles.th}>Descricao normativa</th>
                    <th style={pageStyles.th}>Parametro</th>
                    <th style={pageStyles.th}>Potencial</th>
                    <th style={pageStyles.th}>Limite</th>
                    <th style={pageStyles.th}>Status 2D.4-B</th>
                    <th style={pageStyles.th}>Regras</th>
                    <th style={pageStyles.th}>Perguntas</th>
                    <th style={pageStyles.th}>Docs</th>
                    <th style={pageStyles.th}>Alertas/Bloqueios</th>
                  </tr>
                </thead>
                <tbody>
                  {atividades.map((item) => (
                    <tr key={item.codigo}>
                      <td style={pageStyles.td}>{item.codigo}</td>
                      <td style={pageStyles.td}>{item.nome}</td>
                      <td style={pageStyles.td}>{item.parametro_enquadramento}</td>
                      <td style={pageStyles.td}>{item.potencial_poluidor}</td>
                      <td style={pageStyles.td}>{item.limite_impacto_local}</td>
                      <td style={pageStyles.td}>
                        {item.preservado_2d4b ? badge('Preservado', 'ok') : null}
                        {item.novo_cadastrado_2d4b ? badge('Novo 2D.4-B', 'ok') : null}
                        {!item.existe_no_sistema ? badge('Pendente', 'warn') : null}
                      </td>
                      <td style={pageStyles.td}>{formatNumber(item.dados_sistema?.regras_cadastradas)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.dados_sistema?.perguntas_publicas)}</td>
                      <td style={pageStyles.td}>
                        {formatNumber(item.dados_sistema?.documentos_vinculados)}
                        <p style={pageStyles.sectionSubtitle}>{formatList((item.documentos || []).slice(0, 4))}</p>
                      </td>
                      <td style={pageStyles.td}>
                        {badge(`${formatNumber(item.dados_sistema?.alertas_publicos)} alertas`, statusTone(item))}
                        {badge(`${formatNumber(item.dados_sistema?.bloqueios_logicos)} bloqueios`, statusTone(item))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Lacunas anteriores e preservacao</h2>
            <div style={pageStyles.actions}>
              {badge(preservacao.fase2d1 ? 'Fase 2D.1 preservada' : 'Fase 2D.1 inconsistente', preservacao.fase2d1 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d2 ? 'Fase 2D.2 preservada' : 'Fase 2D.2 inconsistente', preservacao.fase2d2 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d21 ? 'Fase 2D.2.1 preservada' : 'Fase 2D.2.1 inconsistente', preservacao.fase2d21 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d3 ? 'Fase 2D.3 preservada' : 'Fase 2D.3 inconsistente', preservacao.fase2d3 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d4a ? 'Fase 2D.4-A preservada' : 'Fase 2D.4-A inconsistente', preservacao.fase2d4a ? 'ok' : 'danger')}
            </div>
            <div style={pageStyles.actions}>
              {(status.lacunas_normativas_preservadas || []).map((item) => <span key={item.codigo}>{badge(`${item.codigo} preservada`, 'warn')}</span>)}
            </div>
            <p style={pageStyles.sectionSubtitle}>
              As lacunas preservadas nao geram taxa definitiva, classe definitiva, DAM, cobranca, licenca, dispensa, AMA ou decisao automatica.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
