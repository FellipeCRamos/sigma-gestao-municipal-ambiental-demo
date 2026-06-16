import { useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import { getGovernancaNormativaHomologacao } from '../services/licenciamentoGovernancaApi';
import {
  getFechamentoHomologacaoPendencias,
  getFechamentoHomologacaoRelatorio,
  getFechamentoHomologacaoRoteiro,
  getFechamentoHomologacaoStatus,
  registrarLiberacaoFase2D,
  runFechamentoHomologacaoDiagnostico,
  updateFechamentoHomologacaoChecklist,
} from '../services/licenciamentoHomologacaoFechamentoApi';
import { formatDate, pageStyles } from './shared';

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'aprovado_com_observacao', label: 'Aprovado com observacao' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'nao_aplicavel', label: 'Nao aplicavel' },
];

const OBS_REQUIRED = new Set(['reprovado', 'aprovado_com_observacao', 'nao_aplicavel']);

function statusStyle(status) {
  if (['reprovado', 'falha', 'bloqueado'].includes(status)) {
    return { ...pageStyles.pill, background: '#fee2e2', color: '#991b1b' };
  }
  if (['aprovado', 'ok', 'apta'].includes(status)) {
    return { ...pageStyles.pill, background: '#dcfce7', color: '#166534' };
  }
  return { ...pageStyles.pill, background: '#fef3c7', color: '#92400e' };
}

function MetricCard({ label, value, tone = 'default' }) {
  const color = tone === 'danger' ? '#991b1b' : tone === 'ok' ? '#166534' : '#0d3f8f';
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{label}</p>
      <p style={{ ...pageStyles.metricValue, color }}>{value}</p>
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

function openValidationRoute(route) {
  if (!route) return;
  if (route.startsWith('http')) {
    window.open(route, '_blank', 'noopener,noreferrer');
    return;
  }
  if (route.startsWith('?')) {
    window.open(`${window.location.origin}/${route}`, '_blank', 'noopener,noreferrer');
    return;
  }
  window.open(`${window.location.origin}${route.startsWith('/') ? route : `/${route}`}`, '_blank', 'noopener,noreferrer');
}

export default function FechamentoHomologacaoLicenciamento({ usuarioInterno }) {
  const [status, setStatus] = useState(null);
  const [pendencias, setPendencias] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [roteiro, setRoteiro] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [editing, setEditing] = useState({});
  const [confirmacao, setConfirmacao] = useState({
    explicita: false,
    texto: '',
    observacao: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canManage = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_MANAGE)
    || hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_ASSISTIDA_MANAGE);
  const canRelease = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_LIBERAR_FASE2D);
  const ready = status?.ready_for_fase2d;
  const totais = ready?.totais || {};

  const concluded = useMemo(
    () => checklist.filter((item) => ['aprovado', 'aprovado_com_observacao', 'nao_aplicavel'].includes(item.status)),
    [checklist]
  );
  const groupedPendencias = useMemo(() => groupBy(pendencias, 'grupo'), [pendencias]);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const [statusResponse, pendenciasResponse, roteiroResponse, checklistResponse] = await Promise.all([
        getFechamentoHomologacaoStatus(),
        getFechamentoHomologacaoPendencias(),
        getFechamentoHomologacaoRoteiro(),
        getGovernancaNormativaHomologacao(),
      ]);
      setStatus(statusResponse.data || null);
      setPendencias(pendenciasResponse.data || []);
      setRoteiro(roteiroResponse.data || null);
      setChecklist(checklistResponse.data || []);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar o fechamento de homologacao.');
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
        observacao: item.resultado || item.observacao_sugerida || '',
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

    setLoading(true);
    setMessage('');
    try {
      await updateFechamentoHomologacaoChecklist(item.id, {
        status: nextStatus,
        observacao,
        evidencia_textual: draft.evidencia_textual || '',
        evidencias_json: {
          tipo_validacao: item.tipo_validacao,
          fase_relacionada: '2C.3',
        },
      });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await load();
      setMessage('Item atualizado no fechamento de homologacao.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel atualizar o item.');
    } finally {
      setLoading(false);
    }
  }

  async function runDiagnostic() {
    setLoading(true);
    setMessage('');
    try {
      const response = await runFechamentoHomologacaoDiagnostico();
      setDiagnostico(response.data || null);
      await load();
      setMessage('Diagnostico automatico final executado. Nenhum item manual foi aprovado automaticamente.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel executar o diagnostico final.');
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getFechamentoHomologacaoRelatorio();
      setRelatorio(response.data || null);
      setMessage(response.data?.resultado?.ready_for_fase2d
        ? 'Relatorio de liberacao tecnica gerado.'
        : 'Relatorio de bloqueio gerado. A Fase 2D ainda nao deve ser iniciada.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel gerar o relatorio.');
    } finally {
      setLoading(false);
    }
  }

  async function releaseFase2D() {
    setLoading(true);
    setMessage('');
    try {
      const response = await registrarLiberacaoFase2D(confirmacao);
      setRelatorio(response.data?.relatorio || null);
      setMessage(response.data?.mensagem || 'Liberacao tecnica registrada.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Liberacao tecnica bloqueada pelo gate.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Fechamento de Homologacao - Fase 2C.3</h2>
        <p style={pageStyles.sectionSubtitle}>
          Conclusao guiada do checklist obrigatorio antes da parametrizacao completa do Decreto Municipal n. 021/2020.
        </p>
        <div style={{ ...pageStyles.message, marginTop: 14, background: '#fff8e7' }}>
          Esta tela nao libera DAM real, cobranca oficial, protocolo definitivo ou decisao administrativa automatica.
          A liberacao se refere apenas ao inicio tecnico da Fase 2D.
        </div>
        {message ? <div style={{ ...pageStyles.message, marginTop: 14 }}>{message}</div> : null}
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Resumo do Gate</h3>
        <div style={pageStyles.grid3}>
          <MetricCard label="Ready para Fase 2D" value={ready?.ready ? 'Sim' : 'Nao'} tone={ready?.ready ? 'ok' : 'danger'} />
          <MetricCard label="Obrigatorios pendentes" value={totais.obrigatorios_pendentes || 0} tone={totais.obrigatorios_pendentes ? 'danger' : 'ok'} />
          <MetricCard label="Obrigatorios reprovados" value={totais.obrigatorios_reprovados || 0} tone={totais.obrigatorios_reprovados ? 'danger' : 'ok'} />
          <MetricCard label="Aprovados" value={totais.aprovados || 0} tone="ok" />
          <MetricCard label="Aprovados com observacao" value={totais.aprovados_com_observacao || 0} />
          <MetricCard label="Nao aplicaveis" value={totais.nao_aplicaveis || 0} />
          <MetricCard label="Diagnostico automatico" value={status?.diagnostico_status || '-'} tone={status?.diagnostico_status === 'ok' ? 'ok' : 'danger'} />
          <MetricCard label="Bloqueios de producao" value="Ativos" tone="danger" />
          <MetricCard label="Relatorio de liberacao" value={status?.relatorio_liberacao || 'indisponivel'} />
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Bloqueios para Fechamento</h3>
        {ready?.ready ? (
          <div style={{ ...pageStyles.message, background: '#ecfdf5' }}>
            Fase 2C.3 homologada. Sistema apto a iniciar a Fase 2D, mantendo bloqueados DAM real, cobranca oficial,
            protocolo definitivo e decisao administrativa automatica.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {(ready?.bloqueios || []).map((bloqueio) => (
              <div key={bloqueio} style={{ ...pageStyles.message, background: '#fff8e7' }}>{bloqueio}</div>
            ))}
            {!ready?.bloqueios?.length ? (
              <div style={pageStyles.message}>Carregando avaliacao do gate.</div>
            ) : null}
          </div>
        )}
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Roteiro de Conclusao</h3>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          {(roteiro?.passos || []).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Acoes do Gate</h3>
        <div style={pageStyles.actions}>
          <button type="button" style={pageStyles.buttonPrimary} onClick={runDiagnostic} disabled={loading}>
            Executar diagnostico final
          </button>
          <button type="button" style={pageStyles.buttonSecondary} onClick={generateReport} disabled={loading}>
            Gerar relatorio de homologacao
          </button>
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Pendencias Obrigatorias</h3>
        {Object.entries(groupedPendencias).map(([grupo, items]) => (
          <div key={grupo} style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 10px', color: '#0d1b3d' }}>{grupo}</h4>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Item</th>
                    <th style={pageStyles.th}>Validacao</th>
                    <th style={pageStyles.th}>Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const draft = editing[item.id];
                    return (
                      <tr key={item.id}>
                        <td style={pageStyles.td}>
                          <strong>{item.codigo}</strong>
                          <p style={{ margin: '6px 0' }}>{item.item}</p>
                          <span style={statusStyle(item.status)}>{item.status}</span>
                          <p style={pageStyles.sectionSubtitle}>Rota: {item.rota_validacao || item.rota_relacionada || '-'}</p>
                          <p style={pageStyles.sectionSubtitle}>{item.motivo_pendencia}</p>
                        </td>
                        <td style={pageStyles.td}>
                          <p><strong>Tipo:</strong> {item.tipo_validacao}</p>
                          <p><strong>Esperado:</strong> {item.resultado_esperado}</p>
                          <p><strong>Sugestao:</strong> {item.observacao_sugerida}</p>
                        </td>
                        <td style={pageStyles.td}>
                          <p>{item.acao_recomendada}</p>
                          <div style={pageStyles.actions}>
                            <button type="button" style={pageStyles.buttonSecondary} onClick={() => startEditing(item)} disabled={!canManage}>
                              Validar item
                            </button>
                            {item.rota_validacao || item.rota_relacionada ? (
                              <button type="button" style={pageStyles.buttonSecondary} onClick={() => openValidationRoute(item.rota_validacao || item.rota_relacionada)}>
                                Abrir rota
                              </button>
                            ) : null}
                            <button
                              type="button"
                              style={pageStyles.buttonSecondary}
                              onClick={() => {
                                startEditing(item);
                                updateEditing(item.id, 'observacao', item.observacao_sugerida || '');
                              }}
                              disabled={!canManage}
                            >
                              Copiar observacao sugerida
                            </button>
                          </div>

                          {draft ? (
                            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                              <label style={pageStyles.label}>
                                Status
                                <select
                                  value={draft.status}
                                  onChange={(event) => updateEditing(item.id, 'status', event.target.value)}
                                  style={pageStyles.input}
                                >
                                  {STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label style={pageStyles.label}>
                                Observacao
                                <textarea
                                  value={draft.observacao}
                                  onChange={(event) => updateEditing(item.id, 'observacao', event.target.value)}
                                  style={pageStyles.textarea}
                                />
                              </label>
                              <label style={pageStyles.label}>
                                Evidencia textual
                                <textarea
                                  value={draft.evidencia_textual}
                                  onChange={(event) => updateEditing(item.id, 'evidencia_textual', event.target.value)}
                                  style={pageStyles.textarea}
                                />
                              </label>
                              <button type="button" style={pageStyles.buttonPrimary} onClick={() => saveItem(item)} disabled={loading || !canManage}>
                                Salvar validacao
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {pendencias.length === 0 ? (
          <div style={{ ...pageStyles.message, background: '#ecfdf5' }}>Nao ha pendencias obrigatorias no momento.</div>
        ) : null}
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Itens Concluidos</h3>
        <div style={pageStyles.tableWrap}>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Codigo</th>
                <th style={pageStyles.th}>Grupo</th>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Validado em</th>
              </tr>
            </thead>
            <tbody>
              {concluded.map((item) => (
                <tr key={item.id}>
                  <td style={pageStyles.td}>{item.codigo}</td>
                  <td style={pageStyles.td}>{item.grupo}</td>
                  <td style={pageStyles.td}><span style={statusStyle(item.status)}>{item.status}</span></td>
                  <td style={pageStyles.td}>{formatDate(item.validado_em)}</td>
                </tr>
              ))}
              {concluded.length === 0 ? (
                <tr>
                  <td style={pageStyles.td} colSpan={4}>Nenhum item concluido ainda.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {diagnostico ? (
        <section style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Diagnostico Final</h3>
          <p style={pageStyles.sectionSubtitle}>Status: <strong>{diagnostico.status}</strong></p>
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Check</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {(diagnostico.checks || []).map((item) => (
                  <tr key={item.codigo}>
                    <td style={pageStyles.td}>{item.descricao}</td>
                    <td style={pageStyles.td}><span style={statusStyle(item.status)}>{item.status}</span></td>
                    <td style={pageStyles.td}>{item.evidencia_textual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {relatorio ? (
        <section style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Relatorio de Fechamento</h3>
          <p><strong>Resultado:</strong> {relatorio.resultado?.homologada ? 'Homologada' : 'Nao homologada'}</p>
          <p><strong>Recomendacao:</strong> {relatorio.conclusao}</p>
          <p><strong>Checks OK:</strong> {relatorio.diagnostico_automatico?.checks_ok} de {relatorio.diagnostico_automatico?.total_checks}</p>
        </section>
      ) : null}

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Liberacao Formal da Fase 2D</h3>
        <div style={{ ...pageStyles.message, background: ready?.ready ? '#ecfdf5' : '#fff8e7' }}>
          {ready?.ready
            ? 'O gate esta apto. A liberacao continua limitada ao inicio tecnico da Fase 2D.'
            : 'Botao bloqueado: conclua pendencias obrigatorias ou corrija reprovacoes antes de registrar a liberacao.'}
        </div>
        <label style={{ ...pageStyles.label, marginTop: 14 }}>
          <span>
            <input
              type="checkbox"
              checked={confirmacao.explicita}
              onChange={(event) => setConfirmacao((current) => ({ ...current, explicita: event.target.checked }))}
            />{' '}
            Confirmo que a homologacao obrigatoria foi concluida e que a liberacao se refere apenas ao inicio tecnico
            da Fase 2D, mantendo bloqueados DAM real, cobranca oficial, protocolo definitivo e decisao administrativa automatica.
          </span>
        </label>
        <label style={pageStyles.label}>
          Texto de confirmacao
          <textarea
            value={confirmacao.texto}
            onChange={(event) => setConfirmacao((current) => ({ ...current, texto: event.target.value }))}
            placeholder="Confirmo a liberacao tecnica para Fase 2D, mantendo bloqueados DAM real, cobranca oficial, protocolo definitivo e decisao administrativa automatica."
            style={pageStyles.textarea}
          />
        </label>
        <label style={pageStyles.label}>
          Observacao complementar
          <textarea
            value={confirmacao.observacao}
            onChange={(event) => setConfirmacao((current) => ({ ...current, observacao: event.target.value }))}
            style={pageStyles.textarea}
          />
        </label>
        <button
          type="button"
          style={{
            ...pageStyles.buttonPrimary,
            opacity: ready?.ready && canRelease ? 1 : 0.55,
            cursor: ready?.ready && canRelease ? 'pointer' : 'not-allowed',
          }}
          onClick={releaseFase2D}
          disabled={!ready?.ready || !canRelease || loading}
        >
          Registrar liberacao tecnica para Fase 2D
        </button>
      </section>
    </div>
  );
}
