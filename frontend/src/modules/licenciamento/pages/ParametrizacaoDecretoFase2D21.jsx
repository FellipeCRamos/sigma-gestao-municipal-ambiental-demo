import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D21Status } from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles } from './shared';

const GROUP_OPTIONS = [
  { value: '', label: 'Todos os grupos' },
  { value: '15', label: 'Grupo 15' },
  { value: '16', label: 'Grupo 16' },
  { value: '17', label: 'Grupo 17' },
];

function badge(text, tone = 'neutral') {
  const colors = {
    neutral: { background: '#eef2ff', color: '#1e3a8a' },
    ok: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
  };

  return <span style={{ ...pageStyles.pill, ...(colors[tone] || colors.neutral) }}>{text}</span>;
}

function hasPendency(item) {
  return item.status_normativo && item.status_normativo !== 'confirmado_decreto_021_2020';
}

export default function ParametrizacaoDecretoFase2D21() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    grupo: '',
    busca: '',
    potencial: '',
    tipo: '',
    normativa: '',
  });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D21Status();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a parametrizacao Fase 2D.2.1.');
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
      const grupo = String(item.codigo || '').split('.')[0];
      const matchesGrupo = !filters.grupo || grupo === filters.grupo;
      const matchesBusca = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nome || '').toLowerCase().includes(query);
      const matchesPotencial = !filters.potencial || item.potencial_poluidor_padrao === filters.potencial;
      const matchesTipo = !filters.tipo || item.tipo_atividade === filters.tipo;
      const matchesNormativa = !filters.normativa || (filters.normativa === 'sim' ? hasPendency(item) : !hasPendency(item));
      return matchesGrupo && matchesBusca && matchesPotencial && matchesTipo && matchesNormativa;
    });
  }, [filters, status]);

  const bloqueiosOk = status?.bloqueios_producao
    && Object.values(status.bloqueios_producao).every(Boolean);
  const release = status?.liberacao_tecnica;
  const preservacao = status?.preservacao_fases_anteriores || {};
  const expected = status?.codigos_esperados_por_grupo || {};
  const registered = status?.codigos_cadastrados_por_grupo || {};

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Parametrizacao Decreto - Fase 2D.2.1</h1>
        <p style={pageStyles.sectionSubtitle}>
          Complementacao normativa auditavel dos Grupos 15, 16 e 17. Esta tela exibe lacunas textuais e pendencias
          normativas sem liberar DAM real, cobranca oficial, protocolo definitivo ou decisao administrativa automatica.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando complementacao normativa...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Status do seed</p>
              <p style={pageStyles.metricValue}>{status.seed_executado ? 'OK' : 'Pendente'}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Codigos cadastrados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.atividades_cadastradas)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Confirmadas</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.atividades_confirmadas)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Pendencia normativa</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.atividades_com_pendencia_normativa)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Lacuna textual</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.atividades_incompletas_por_lacuna_textual)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Documentos</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.documentos_vinculados)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Gate e preservacao</h2>
            <div style={pageStyles.actions}>
              {release ? badge(`Liberacao tecnica: ${release.codigo}`, 'ok') : badge('Liberacao tecnica nao localizada', 'warn')}
              {badge(`Confirmado em ${formatDate(release?.confirmado_em)}`, release ? 'ok' : 'warn')}
              {badge(preservacao.fase2d1?.preservada ? 'Fase 2D.1 preservada' : 'Fase 2D.1 inconsistente', preservacao.fase2d1?.preservada ? 'ok' : 'warn')}
              {badge(preservacao.fase2d2?.preservada ? 'Fase 2D.2 preservada' : 'Fase 2D.2 inconsistente', preservacao.fase2d2?.preservada ? 'ok' : 'warn')}
              {badge(bloqueiosOk ? 'Bloqueios de producao ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'warn')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Codigos esperados e cadastrados</h2>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Grupo</th>
                    <th style={pageStyles.th}>Esperados</th>
                    <th style={pageStyles.th}>Cadastrados</th>
                    <th style={pageStyles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {GROUP_OPTIONS.filter((item) => item.value).map((group) => {
                    const ok = Number(expected[group.value] || 0) === Number(registered[group.value] || 0);
                    return (
                      <tr key={group.value}>
                        <td style={pageStyles.td}>{group.label}</td>
                        <td style={pageStyles.td}>{formatNumber(expected[group.value])}</td>
                        <td style={pageStyles.td}>{formatNumber(registered[group.value])}</td>
                        <td style={pageStyles.td}>{badge(ok ? 'Completo' : 'Incompleto', ok ? 'ok' : 'warn')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {status.divergencias_detectadas?.length ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Divergencias e lacunas</h2>
              <div style={pageStyles.actions}>
                {status.divergencias_detectadas.map((item) => badge(item.codigo ? `${item.codigo} - ${item.tipo}` : `${item.grupo} - ${item.tipo}`, 'warn'))}
              </div>
              <p style={pageStyles.sectionSubtitle}>
                Lacunas permanecem visiveis para conferencia normativa e nao geram taxa ou conclusao automatica.
              </p>
            </section>
          ) : null}

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Atividades complementadas</h2>
            <div style={pageStyles.formGrid}>
              <label style={pageStyles.label}>
                Grupo
                <select style={pageStyles.input} value={filters.grupo} onChange={(event) => setFilters((current) => ({ ...current, grupo: event.target.value }))}>
                  {GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label style={pageStyles.label}>
                Busca
                <input style={pageStyles.input} value={filters.busca} onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))} placeholder="Codigo ou palavra-chave" />
              </label>
              <label style={pageStyles.label}>
                Potencial
                <select style={pageStyles.input} value={filters.potencial} onChange={(event) => setFilters((current) => ({ ...current, potencial: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Medio</option>
                  <option value="alto">Alto</option>
                </select>
              </label>
              <label style={pageStyles.label}>
                Tipo
                <select style={pageStyles.input} value={filters.tipo} onChange={(event) => setFilters((current) => ({ ...current, tipo: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="industrial">Industrial</option>
                  <option value="nao_industrial">Nao industrial</option>
                </select>
              </label>
              <label style={pageStyles.label}>
                Status normativo
                <select style={pageStyles.input} value={filters.normativa} onChange={(event) => setFilters((current) => ({ ...current, normativa: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="sim">Com pendencia</option>
                  <option value="nao">Confirmado</option>
                </select>
              </label>
            </div>

            <div style={{ ...pageStyles.tableWrap, marginTop: 16 }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Codigo</th>
                    <th style={pageStyles.th}>Atividade</th>
                    <th style={pageStyles.th}>Parametro</th>
                    <th style={pageStyles.th}>Tipo</th>
                    <th style={pageStyles.th}>Potencial</th>
                    <th style={pageStyles.th}>Formula</th>
                    <th style={pageStyles.th}>Regras</th>
                    <th style={pageStyles.th}>Documentos</th>
                    <th style={pageStyles.th}>Status normativo</th>
                  </tr>
                </thead>
                <tbody>
                  {atividades.map((item) => (
                    <tr key={item.codigo}>
                      <td style={pageStyles.td}>{item.codigo}</td>
                      <td style={pageStyles.td}>{item.nome}</td>
                      <td style={pageStyles.td}>{item.parametro_principal_label || '-'}</td>
                      <td style={pageStyles.td}>{item.tipo_atividade}</td>
                      <td style={pageStyles.td}>{item.potencial_poluidor_padrao || '-'}</td>
                      <td style={pageStyles.td}>{item.formula_codigo || '-'}</td>
                      <td style={pageStyles.td}>{formatNumber(item.regras)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.documentos)}</td>
                      <td style={pageStyles.td}>{hasPendency(item) ? badge(item.status_normativo, 'warn') : badge('confirmado', 'ok')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
