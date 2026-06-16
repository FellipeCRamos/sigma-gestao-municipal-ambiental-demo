import { useEffect, useMemo, useState } from 'react';
import { getLicenciamentoParametrizacaoFase2D2Status } from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles } from './shared';

const GROUP_OPTIONS = [
  { value: '', label: 'Todos os grupos' },
  { value: '15', label: 'Grupo 15' },
  { value: '16', label: 'Grupo 16' },
  { value: '17', label: 'Grupo 17' },
  { value: '23', label: 'Grupo 23' },
];

function badge(text, tone = 'neutral') {
  const colors = {
    neutral: { background: '#eef2ff', color: '#1e3a8a' },
    ok: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
  };

  return <span style={{ ...pageStyles.pill, ...(colors[tone] || colors.neutral) }}>{text}</span>;
}

function hasNormativePendency(item) {
  return Number(item.regras_com_validacao_normativa || 0) > 0
    || JSON.stringify(item.validacoes_requeridas || []).includes('normativa')
    || String(item.observacoes || '').toLowerCase().includes('normativa');
}

export default function ParametrizacaoDecretoFase2D2() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({
    grupo: '',
    busca: '',
    potencial: '',
    tipo: '',
    validacao: '',
    normativa: '',
  });

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D2Status();
      setStatus(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a parametrizacao Fase 2D.2.');
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
      const requiresValidation = JSON.stringify(item.validacoes_requeridas || []).includes('validacao');
      const hasNormative = hasNormativePendency(item);
      const matchesGrupo = !filters.grupo || grupo === filters.grupo;
      const matchesBusca = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nome || '').toLowerCase().includes(query);
      const matchesPotencial = !filters.potencial || item.potencial_poluidor_padrao === filters.potencial;
      const matchesTipo = !filters.tipo || item.tipo_atividade === filters.tipo;
      const matchesValidacao = !filters.validacao || (filters.validacao === 'sim' ? requiresValidation : !requiresValidation);
      const matchesNormativa = !filters.normativa || (filters.normativa === 'sim' ? hasNormative : !hasNormative);
      return matchesGrupo && matchesBusca && matchesPotencial && matchesTipo && matchesValidacao && matchesNormativa;
    });
  }, [filters, status]);

  const bloqueiosOk = status?.bloqueios_producao
    && Object.values(status.bloqueios_producao).every(Boolean);
  const release = status?.liberacao_tecnica;
  const gruposDetalhados = status?.grupos_detalhados || [];

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Parametrizacao Decreto - Fase 2D.2</h1>
        <p style={pageStyles.sectionSubtitle}>
          Visualizacao administrativa dos grupos 15, 16, 17 e 23 parametrizados para simulacao orientativa. Esta tela
          nao libera DAM real, cobranca oficial, protocolo definitivo ou decisao administrativa automatica.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando parametrizacao controlada...</div> : null}

      {status ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Status do seed</p>
              <p style={pageStyles.metricValue}>{status.seed_executado ? 'OK' : 'Pendente'}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Atividades cadastradas</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.atividades_cadastradas)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Regras</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.regras_cadastradas)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Perguntas publicas</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.perguntas_publicas)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Validacao normativa</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.atividades_com_validacao_normativa)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Documentos vinculados</p>
              <p style={pageStyles.metricValue}>{formatNumber(status.documentos_vinculados)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Gate e bloqueios preservados</h2>
            <div style={pageStyles.actions}>
              {release ? badge(`Liberacao tecnica: ${release.codigo}`, 'ok') : badge('Liberacao tecnica nao localizada', 'warn')}
              {badge(`Confirmado em ${formatDate(release?.confirmado_em)}`, release ? 'ok' : 'warn')}
              {badge(bloqueiosOk ? 'Bloqueios de producao ativos' : 'Bloqueios inconsistentes', bloqueiosOk ? 'ok' : 'warn')}
            </div>
            <p style={pageStyles.sectionSubtitle}>{status.mensagem}</p>
          </section>

          {status.pendencias_normativas?.length ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Pendencias normativas controladas</h2>
              <p style={pageStyles.sectionSubtitle}>
                Itens abaixo permanecem visiveis para conferencia normativa. Eles nao liberam decisao automatica.
              </p>
              <div style={pageStyles.actions}>
                {status.pendencias_normativas.map((item) => badge(`${item.codigo} - ${item.nome}`, 'warn'))}
              </div>
            </section>
          ) : null}

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Grupos cadastrados</h2>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Grupo</th>
                    <th style={pageStyles.th}>Nome</th>
                    <th style={pageStyles.th}>Atividades</th>
                    <th style={pageStyles.th}>Regras</th>
                    <th style={pageStyles.th}>Documentos</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposDetalhados.map((grupo) => (
                    <tr key={grupo.grupo}>
                      <td style={pageStyles.td}>{grupo.grupo}</td>
                      <td style={pageStyles.td}>{grupo.nome}</td>
                      <td style={pageStyles.td}>{formatNumber(grupo.atividades)}</td>
                      <td style={pageStyles.td}>{formatNumber(grupo.regras)}</td>
                      <td style={pageStyles.td}>{formatNumber(grupo.documentos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Atividades do Bloco 2</h2>
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
                Validacao obrigatoria
                <select style={pageStyles.input} value={filters.validacao} onChange={(event) => setFilters((current) => ({ ...current, validacao: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="sim">Com validacao</option>
                  <option value="nao">Sem validacao</option>
                </select>
              </label>
              <label style={pageStyles.label}>
                Status normativo
                <select style={pageStyles.input} value={filters.normativa} onChange={(event) => setFilters((current) => ({ ...current, normativa: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="sim">Com pendencia normativa</option>
                  <option value="nao">Sem pendencia normativa</option>
                </select>
              </label>
            </div>

            <div style={{ ...pageStyles.tableWrap, marginTop: 16 }}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Codigo</th>
                    <th style={pageStyles.th}>Atividade</th>
                    <th style={pageStyles.th}>Grupo</th>
                    <th style={pageStyles.th}>Tipo</th>
                    <th style={pageStyles.th}>Potencial</th>
                    <th style={pageStyles.th}>Formula</th>
                    <th style={pageStyles.th}>Regras</th>
                    <th style={pageStyles.th}>Documentos</th>
                    <th style={pageStyles.th}>Normativa</th>
                  </tr>
                </thead>
                <tbody>
                  {atividades.map((item) => (
                    <tr key={item.codigo}>
                      <td style={pageStyles.td}>{item.codigo}</td>
                      <td style={pageStyles.td}>{item.nome}</td>
                      <td style={pageStyles.td}>{item.categoria}</td>
                      <td style={pageStyles.td}>{item.tipo_atividade}</td>
                      <td style={pageStyles.td}>{item.potencial_poluidor_padrao}</td>
                      <td style={pageStyles.td}>{item.formula_codigo || '-'}</td>
                      <td style={pageStyles.td}>{formatNumber(item.regras)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.documentos)}</td>
                      <td style={pageStyles.td}>{hasNormativePendency(item) ? badge('Pendente', 'warn') : badge('OK', 'ok')}</td>
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
