import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  getGovernancaNormativaHomologacao,
  getGovernancaNormativaStatus,
  getHomologacaoAssistidaRelatorio,
  runHomologacaoAssistidaDiagnostico,
  updateGovernancaNormativaHomologacao,
} from '../services/licenciamentoGovernancaApi';
import { formatDate, pageStyles } from './shared';

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'aprovado_com_observacao', label: 'Aprovado com observacao' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'nao_aplicavel', label: 'Nao aplicavel' },
];

const STATUS_LABELS = STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {
  ok: 'OK',
  bloqueado: 'Bloqueado',
});

const OBS_REQUIRED = new Set(['reprovado', 'aprovado_com_observacao', 'nao_aplicavel']);

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '-';
}

function statusStyle(status) {
  const danger = ['reprovado', 'bloqueado', 'falha'];
  const success = ['aprovado', 'ok'];
  const warning = ['pendente', 'aprovado_com_observacao', 'nao_aplicavel'];

  if (danger.includes(status)) return { ...pageStyles.pill, background: '#fee2e2', color: '#991b1b' };
  if (success.includes(status)) return { ...pageStyles.pill, background: '#dcfce7', color: '#166534' };
  if (warning.includes(status)) return { ...pageStyles.pill, background: '#fef3c7', color: '#92400e' };
  return { ...pageStyles.pill, background: '#e5e7eb', color: '#374151' };
}

function MetricCard({ label, value, tone = 'default' }) {
  const valueColor = tone === 'danger' ? '#991b1b' : tone === 'ok' ? '#166534' : '#0d3f8f';
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{label}</p>
      <p style={{ ...pageStyles.metricValue, color: valueColor }}>{value}</p>
    </div>
  );
}

function groupBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'Sem grupo';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export default function HomologacaoAssistidaLicenciamento({ usuarioInterno }) {
  const [status, setStatus] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [diagnostico, setDiagnostico] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [filters, setFilters] = useState({ grupo: '', status: '', modo: '' });
  const [editing, setEditing] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canManage = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_ASSISTIDA_MANAGE)
    || hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_MANAGE);
  const canRunDiagnostic = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_DIAGNOSTICO_RUN)
    || canManage;
  const canViewReport = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_RELATORIO_VIEW)
    || hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_VIEW);

  const stats = useMemo(() => checklist.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    if (item.obrigatorio && item.status === 'pendente') acc.obrigatorios_pendentes += 1;
    if (item.obrigatorio && item.status === 'reprovado') acc.obrigatorios_reprovados += 1;
    return acc;
  }, {
    total: 0,
    pendente: 0,
    aprovado: 0,
    aprovado_com_observacao: 0,
    reprovado: 0,
    nao_aplicavel: 0,
    obrigatorios_pendentes: 0,
    obrigatorios_reprovados: 0,
  }), [checklist]);

  const grupos = useMemo(() => [...new Set(checklist.map((item) => item.grupo).filter(Boolean))], [checklist]);
  const ready = status?.ready_for_fase2d;

  const filteredChecklist = useMemo(() => checklist.filter((item) => {
    if (filters.grupo && item.grupo !== filters.grupo) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.modo === 'obrigatorios_pendentes' && !(item.obrigatorio && item.status === 'pendente')) return false;
    if (filters.modo === 'reprovados' && item.status !== 'reprovado') return false;
    return true;
  }), [checklist, filters]);

  const groupedChecklist = useMemo(() => groupBy(filteredChecklist, 'grupo'), [filteredChecklist]);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const [statusResponse, checklistResponse] = await Promise.all([
        getGovernancaNormativaStatus(),
        getGovernancaNormativaHomologacao(),
      ]);

      setStatus(statusResponse.data || null);
      setChecklist(checklistResponse.data || []);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a homologacao assistida.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEditing(item) {
    setEditing((prev) => ({
      ...prev,
      [item.id]: {
        status: item.status || 'pendente',
        observacao: item.resultado || '',
        evidencia_textual: item.evidencias_json?.evidencia_textual || '',
      },
    }));
  }

  function updateEditing(id, field, value) {
    setEditing((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  }

  async function saveItem(item) {
    const draft = editing[item.id] || {};
    const nextStatus = draft.status || item.status || 'pendente';
    const observacao = String(draft.observacao || '').trim();

    if (OBS_REQUIRED.has(nextStatus) && !observacao) {
      setMessage('Observacao obrigatoria para reprovado, aprovado com observacao ou nao aplicavel.');
      return;
    }

    setMessage('');
    try {
      await updateGovernancaNormativaHomologacao(item.id, {
        status: nextStatus,
        observacao,
        evidencia_textual: draft.evidencia_textual || '',
        evidencias_json: {
          origem_validacao: 'homologacao_assistida',
        },
      });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await load();
      setMessage('Item de homologacao atualizado com seguranca.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel atualizar o item de homologacao.');
    }
  }

  async function runDiagnostic() {
    setLoading(true);
    setMessage('');
    try {
      const response = await runHomologacaoAssistidaDiagnostico();
      setDiagnostico(response.data || null);
      await load();
      setMessage('Diagnostico automatico parcial executado. Nenhum item manual foi aprovado automaticamente.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel executar o diagnostico automatico parcial.');
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getHomologacaoAssistidaRelatorio();
      setRelatorio(response.data || null);
      setMessage('Relatorio de homologacao assistida gerado.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel gerar o relatorio de homologacao.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Homologacao Assistida - Licenciamento Ambiental</h2>
        <p style={pageStyles.sectionSubtitle}>
          Validacao manual e tecnica da Fase 2C antes da parametrizacao completa do Decreto Municipal n. 021/2020.
        </p>
        <div style={{ ...pageStyles.message, marginTop: 14, background: '#fff8e7' }}>
          A homologacao assistida organiza a validacao manual da Fase 2C. A liberacao para Fase 2D nao libera
          cobranca oficial, DAM real, protocolo definitivo ou decisao administrativa automatica.
        </div>
        {message ? (
          <div style={{ ...pageStyles.message, marginTop: 14, background: '#f8fbff' }}>{message}</div>
        ) : null}
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Status do Checklist</h3>
        <div style={pageStyles.grid3}>
          <MetricCard label="Total de itens" value={stats.total} />
          <MetricCard label="Pendentes" value={stats.pendente || 0} tone={stats.pendente ? 'danger' : 'ok'} />
          <MetricCard label="Aprovados" value={stats.aprovado || 0} tone="ok" />
          <MetricCard label="Aprovados com observacao" value={stats.aprovado_com_observacao || 0} />
          <MetricCard label="Reprovados" value={stats.reprovado || 0} tone={stats.reprovado ? 'danger' : 'ok'} />
          <MetricCard label="Nao aplicaveis" value={stats.nao_aplicavel || 0} />
          <MetricCard label="Obrigatorios pendentes" value={stats.obrigatorios_pendentes || 0} tone={stats.obrigatorios_pendentes ? 'danger' : 'ok'} />
          <MetricCard label="Status Fase 2D" value={ready?.ready ? 'Apta' : 'Bloqueada'} tone={ready?.ready ? 'ok' : 'danger'} />
          <MetricCard label="Bloqueios de producao" value="Ativos" tone="danger" />
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Prontidao para Fase 2D</h3>
        <div style={{ ...pageStyles.message, background: ready?.ready ? '#ecfdf5' : '#fff8e7' }}>
          {ready?.ready
            ? 'A Fase 2C.2 esta homologada. O sistema esta apto a iniciar a Fase 2D, mantendo bloqueados DAM real, cobranca oficial e protocolo definitivo.'
            : 'A Fase 2D ainda nao deve ser iniciada. Existem pendencias obrigatorias, reprovacoes ou validacoes criticas nao concluidas.'}
        </div>
        <div style={pageStyles.tableWrap}>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Criterio</th>
                <th style={pageStyles.th}>Origem</th>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {(ready?.criterios || []).map((criterio) => (
                <tr key={criterio.codigo}>
                  <td style={pageStyles.td}>{criterio.descricao}</td>
                  <td style={pageStyles.td}>{criterio.origem || '-'}</td>
                  <td style={pageStyles.td}><span style={statusStyle(criterio.status)}>{statusLabel(criterio.status)}</span></td>
                  <td style={pageStyles.td}>{criterio.detalhe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Acoes seguras</h3>
        <div style={pageStyles.actions}>
          <button type="button" onClick={() => setFilters({ grupo: '', status: '', modo: 'obrigatorios_pendentes' })} style={pageStyles.buttonSecondary}>
            Mostrar apenas pendentes obrigatorios
          </button>
          <button type="button" onClick={() => setFilters({ grupo: '', status: '', modo: 'reprovados' })} style={pageStyles.buttonSecondary}>
            Mostrar apenas reprovados
          </button>
          <button type="button" onClick={() => setFilters({ grupo: '', status: '', modo: '' })} style={pageStyles.buttonSecondary}>
            Limpar filtros
          </button>
          {canRunDiagnostic ? (
            <button type="button" disabled={loading} onClick={runDiagnostic} style={pageStyles.buttonPrimary}>
              Executar diagnostico automatico
            </button>
          ) : null}
          {canViewReport ? (
            <button type="button" disabled={loading} onClick={generateReport} style={pageStyles.buttonSecondary}>
              Gerar relatorio de homologacao
            </button>
          ) : null}
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Filtros</h3>
        <div style={pageStyles.formGrid}>
          <label style={pageStyles.label}>
            Grupo
            <select
              value={filters.grupo}
              onChange={(event) => setFilters((prev) => ({ ...prev, grupo: event.target.value }))}
              style={pageStyles.input}
            >
              <option value="">Todos</option>
              {grupos.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
            </select>
          </label>
          <label style={pageStyles.label}>
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, modo: '' }))}
              style={pageStyles.input}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Checklist agrupado</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          {Object.entries(groupedChecklist).map(([grupo, itens]) => (
            <div key={grupo} style={pageStyles.tableWrap}>
              <div style={{ padding: 14, background: '#eaf3ff', fontWeight: 900, color: '#0d1b3d' }}>{grupo}</div>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Item</th>
                    <th style={pageStyles.th}>Status</th>
                    <th style={pageStyles.th}>Validacao</th>
                    <th style={pageStyles.th}>Atualizacao</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => {
                    const draft = editing[item.id];
                    return (
                      <tr key={item.id}>
                        <td style={pageStyles.td}>
                          <strong>{item.codigo}</strong>
                          <div>{item.item}</div>
                          <div style={pageStyles.muted}>{item.descricao}</div>
                          <div style={pageStyles.muted}>Rota: {item.rota_relacionada || '-'}</div>
                          <div style={pageStyles.muted}>Obrigatorio: {item.obrigatorio ? 'sim' : 'nao'}</div>
                        </td>
                        <td style={pageStyles.td}><span style={statusStyle(item.status)}>{statusLabel(item.status)}</span></td>
                        <td style={pageStyles.td}>
                          <div>{item.resultado || '-'}</div>
                          <div style={pageStyles.muted}>{item.validado_por || '-'}</div>
                          <div style={pageStyles.muted}>{item.validado_em ? formatDate(item.validado_em) : '-'}</div>
                        </td>
                        <td style={pageStyles.td}>
                          {canManage ? (
                            draft ? (
                              <div style={{ display: 'grid', gap: 8, minWidth: 260 }}>
                                <select
                                  value={draft.status}
                                  onChange={(event) => updateEditing(item.id, 'status', event.target.value)}
                                  style={pageStyles.input}
                                >
                                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <textarea
                                  value={draft.observacao}
                                  onChange={(event) => updateEditing(item.id, 'observacao', event.target.value)}
                                  placeholder="Observacao administrativa"
                                  style={pageStyles.textarea}
                                />
                                <textarea
                                  value={draft.evidencia_textual}
                                  onChange={(event) => updateEditing(item.id, 'evidencia_textual', event.target.value)}
                                  placeholder="Evidencia textual ou referencia"
                                  style={pageStyles.textarea}
                                />
                                <div style={pageStyles.actions}>
                                  <button type="button" onClick={() => saveItem(item)} style={pageStyles.buttonPrimary}>Salvar</button>
                                  <button type="button" onClick={() => updateEditing(item.id, 'status', item.status)} style={pageStyles.buttonSecondary}>Restaurar status</button>
                                  <button
                                    type="button"
                                    onClick={() => setEditing((prev) => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    })}
                                    style={pageStyles.buttonSecondary}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startEditing(item)} style={pageStyles.buttonSecondary}>Atualizar item</button>
                            )
                          ) : 'Sem permissao de edicao'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {!filteredChecklist.length ? <div style={pageStyles.message}>Nenhum item encontrado para os filtros aplicados.</div> : null}
        </div>
      </section>

      {diagnostico ? (
        <section style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Diagnostico automatico parcial</h3>
          <p style={pageStyles.sectionSubtitle}>{diagnostico.recomendacao}</p>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Check</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {(diagnostico.checks || []).map((check) => (
                  <tr key={check.codigo}>
                    <td style={pageStyles.td}>{check.nome}</td>
                    <td style={pageStyles.td}><span style={statusStyle(check.status)}>{statusLabel(check.status)}</span></td>
                    <td style={pageStyles.td}>{check.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {relatorio ? (
        <section style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Relatorio de homologacao</h3>
          <p style={pageStyles.sectionSubtitle}>{relatorio.recomendacao}</p>
          <div style={pageStyles.grid3}>
            <MetricCard label="Gerado em" value={formatDate(relatorio.gerado_em)} />
            <MetricCard label="Obrigatorios pendentes" value={relatorio.resumo_checklist?.obrigatorios_pendentes ?? '-'} />
            <MetricCard label="Obrigatorios reprovados" value={relatorio.resumo_checklist?.obrigatorios_reprovados ?? '-'} />
          </div>
        </section>
      ) : null}

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Bloqueios de producao preservados</h3>
        <div style={pageStyles.grid3}>
          <MetricCard label="DAM real" value="Bloqueado" tone="danger" />
          <MetricCard label="Cobranca oficial" value="Bloqueada" tone="danger" />
          <MetricCard label="Protocolo definitivo" value="Bloqueado" tone="danger" />
          <MetricCard label="Decisao automatica" value="Bloqueada" tone="danger" />
        </div>
      </section>
    </div>
  );
}
