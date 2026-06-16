import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D4AGrupo19Status } from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  confirmado_decreto_021_2020: 'Confirmado no Decreto',
  requer_validacao_normativa: 'Validacao normativa',
  incompleto_por_lacuna_textual: 'Lacuna textual',
  divergente_do_piloto_existente: 'Divergente do piloto',
  apto_para_parametrizacao_controlada: 'Apto para parametrizacao',
  nao_parametrizar_sem_base_normativa: 'Sem base normativa',
  piloto_preservado_sem_divergencia_material: 'Piloto preservado',
  piloto_ausente: 'Piloto ausente',
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

function statusTone(status) {
  if (status === 'piloto_preservado_sem_divergencia_material') return 'ok';
  if (status === 'apto_para_parametrizacao_controlada') return 'ok';
  if (status === 'confirmado_decreto_021_2020') return 'ok';
  if (status === 'divergente_do_piloto_existente' || status === 'piloto_ausente') return 'danger';
  if (status === 'requer_validacao_normativa' || status === 'incompleto_por_lacuna_textual') return 'warn';
  return 'neutral';
}

export default function ConferenciaNormativaGrupo19Fase2D4A() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ busca: '', status: '' });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D4AGrupo19Status();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a conferencia normativa do Grupo 19.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const codigos = useMemo(() => {
    const query = filters.busca.trim().toLowerCase();
    return (status?.codigos_identificados_decreto || []).filter((item) => {
      const matchesBusca = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nome || '').toLowerCase().includes(query)
        || String(item.parametro_enquadramento || '').toLowerCase().includes(query);
      const matchesStatus = !filters.status || item.status_conferencia === filters.status || item.status_normativo === filters.status;
      return matchesBusca && matchesStatus;
    });
  }, [filters, status]);

  const bloqueiosOk = status?.bloqueios_producao
    && Object.values(status.bloqueios_producao).every(Boolean);
  const preservacao = status?.preservacao_fases_anteriores || {};
  const piloto = status?.piloto_1903;

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Conferencia Normativa Grupo 19 - Fase 2D.4-A</h1>
        <p style={pageStyles.sectionSubtitle}>
          Inventario normativo do Grupo 19 - Energia antes de qualquer seed complementar. Esta tela nao cadastra codigos,
          nao altera taxa, VRTE, matriz ou norma e nao libera efeitos produtivos.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando conferencia normativa do Grupo 19...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos no Decreto</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_identificados?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Existentes no sistema</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_existentes_sistema?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Pendentes</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_pendentes?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Aptos para 2D.4-B</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_aptos_para_parametrizacao?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Lacunas Grupo 19</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_com_lacuna?.length)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Divergencias piloto</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.codigos_divergentes_do_piloto?.length)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Resumo normativo e gate</h2>
            <div style={pageStyles.actions}>
              {badge(`Grupo ${status.grupo_analisado?.numero} - ${status.grupo_analisado?.nome_oficial}`, 'neutral')}
              {badge(status.grupo_analisado?.natureza || 'Diagnostico', 'neutral')}
              {status.liberacao_tecnica ? badge(`Liberacao tecnica: ${status.liberacao_tecnica.codigo}`, 'ok') : badge('Liberacao tecnica nao localizada', 'danger')}
              {badge(`Confirmado em ${formatDate(status.liberacao_tecnica?.confirmado_em)}`, status.liberacao_tecnica ? 'ok' : 'warn')}
              {badge(bloqueiosOk ? 'Bloqueios de producao ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'danger')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.grupo_analisado?.fonte_normativa}</p>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Piloto 19.03</h2>
            <div style={pageStyles.actions}>
              {badge(STATUS_LABELS[piloto?.status] || piloto?.status, statusTone(piloto?.status))}
              {badge(`Regras: ${formatNumber(piloto?.comparacao?.detalhes?.regras)}`, 'neutral')}
              {badge(`Documentos: ${formatNumber(piloto?.comparacao?.detalhes?.documentos_vinculados)}`, 'neutral')}
              {badge(piloto?.divergencia_material ? 'Divergencia material' : 'Sem divergencia material', piloto?.divergencia_material ? 'danger' : 'ok')}
            </div>
            <p style={pageStyles.sectionSubtitle}>
              O piloto permanece funcional e nao foi sobrescrito. Classes e taxa seguem orientativas, preliminares e sujeitas a validacao da SMAD.
            </p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Recomendacao para 2D.4-B</h2>
            <div style={pageStyles.actions}>
              {badge(status.recomendacao_2d4b?.status, status.recomendacao_2d4b?.pode_avancar ? 'ok' : 'warn')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.recomendacao_2d4b?.texto}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Codigos identificados no Grupo 19</h2>
            <div style={pageStyles.formGrid}>
              <label style={pageStyles.label}>
                Busca
                <input style={pageStyles.input} value={filters.busca} onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))} placeholder="Codigo, descricao ou parametro" />
              </label>
              <label style={pageStyles.label}>
                Status
                <select style={pageStyles.input} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Todos</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <div style={{ ...pageStyles.tableWrap, marginTop: 16 }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Codigo</th>
                    <th style={pageStyles.th}>Descricao normativa</th>
                    <th style={pageStyles.th}>Tipo</th>
                    <th style={pageStyles.th}>Parametro</th>
                    <th style={pageStyles.th}>Faixas</th>
                    <th style={pageStyles.th}>Potencial</th>
                    <th style={pageStyles.th}>Limite</th>
                    <th style={pageStyles.th}>Sistema</th>
                    <th style={pageStyles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {codigos.map((item) => (
                    <tr key={item.codigo}>
                      <td style={pageStyles.td}>{item.codigo}</td>
                      <td style={pageStyles.td}>{item.nome}</td>
                      <td style={pageStyles.td}>{item.tipo_normativo} / {item.tipo_atividade}</td>
                      <td style={pageStyles.td}>{item.parametro_enquadramento}</td>
                      <td style={pageStyles.td}>{item.faixas_porte.map((faixa) => `${faixa.porte}: ${faixa.expressao}`).join('; ') || '-'}</td>
                      <td style={pageStyles.td}>{item.potencial_poluidor}</td>
                      <td style={pageStyles.td}>{item.limite_impacto_local}</td>
                      <td style={pageStyles.td}>{item.existe_no_sistema ? badge('Cadastrado', 'ok') : badge('Pendente', 'warn')}</td>
                      <td style={pageStyles.td}>{badge(STATUS_LABELS[item.status_conferencia] || STATUS_LABELS[item.status_normativo] || item.status_conferencia, statusTone(item.status_conferencia || item.status_normativo))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Preservacao e riscos</h2>
            <div style={pageStyles.actions}>
              {badge(preservacao.fase2d1 ? 'Fase 2D.1 preservada' : 'Fase 2D.1 inconsistente', preservacao.fase2d1 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d2 ? 'Fase 2D.2 preservada' : 'Fase 2D.2 inconsistente', preservacao.fase2d2 ? 'ok' : 'danger')}
              {badge(preservacao.fase2d21 ? 'Fase 2D.2.1 preservada' : 'Fase 2D.2.1 inconsistente', preservacao.fase2d21 ? 'ok' : 'danger')}
              {(status.lacunas_preservadas_fases_anteriores || []).map((item) => <span key={item.codigo}>{badge(item.codigo, 'warn')}</span>)}
            </div>
            <div style={pageStyles.actions}>
              {(status.riscos_normativos || []).map((item) => <span key={item}>{badge(item, 'warn')}</span>)}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
