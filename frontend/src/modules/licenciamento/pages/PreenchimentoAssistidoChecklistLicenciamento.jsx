import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import {
  applyChecklistAssistidoSugestao,
  getChecklistAssistidoItens,
  getChecklistAssistidoRelatorioPendencias,
  getChecklistAssistidoStatus,
  runChecklistAssistidoDiagnostico,
  updateChecklistAssistidoItem,
} from '../services/licenciamentoChecklistAssistidoApi';
import { pageStyles } from './shared';

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'aprovado_com_observacao', label: 'Aprovado com observacao' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'nao_aplicavel', label: 'Nao aplicavel' },
];

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendentes', label: 'Obrigatorios pendentes' },
  { value: 'reprovados', label: 'Obrigatorios reprovados' },
  { value: 'sem_evidencia', label: 'Sem evidencia' },
  { value: 'com_diagnostico', label: 'Com diagnostico relacionado' },
  { value: 'com_observacao_sugerida', label: 'Com observacao sugerida' },
];

const OBS_REQUIRED = new Set(['reprovado', 'aprovado_com_observacao', 'nao_aplicavel']);

function statusStyle(status) {
  if (['reprovado', 'falha', 'bloqueada'].includes(status)) {
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

function groupBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || 'Sem grupo';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function buildFilters(activeFilter, group, type) {
  const filters = {};

  if (activeFilter === 'pendentes') {
    filters.pendentes = 'true';
  }
  if (activeFilter === 'reprovados') {
    filters.status = 'reprovado';
    filters.obrigatorio = 'true';
  }
  if (activeFilter === 'sem_evidencia') {
    filters.sem_evidencia = 'true';
  }
  if (activeFilter === 'com_diagnostico') {
    filters.com_diagnostico = 'true';
  }
  if (activeFilter === 'com_observacao_sugerida') {
    filters.com_observacao_sugerida = 'true';
  }
  if (group) filters.grupo = group;
  if (type) filters.tipo_validacao = type;

  return filters;
}

export default function PreenchimentoAssistidoChecklistLicenciamento({ usuarioInterno, navigateToPage }) {
  const [status, setStatus] = useState(null);
  const [items, setItems] = useState([]);
  const [diagnostico, setDiagnostico] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({
    status: 'pendente',
    observacao: '',
    evidencia_textual: '',
  });
  const [activeFilter, setActiveFilter] = useState('pendentes');
  const [groupFilter, setGroupFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const canManage = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_MANAGE)
    || hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_ASSISTIDA_MANAGE);
  const canRunDiagnostic = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_DIAGNOSTICO)
    || hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_DIAGNOSTICO_RUN);
  const canViewReport = hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_RELATORIO)
    || hasPermission(usuarioInterno, PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_RELATORIO_VIEW);

  const groupedItems = useMemo(() => groupBy(items, 'grupo'), [items]);
  const groups = useMemo(() => [...new Set(items.map((item) => item.grupo).filter(Boolean))].sort(), [items]);
  const types = useMemo(() => [...new Set(items.map((item) => item.tipo_validacao).filter(Boolean))].sort(), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const filters = buildFilters(activeFilter, groupFilter, typeFilter);
      const [statusResponse, itemsResponse] = await Promise.all([
        getChecklistAssistidoStatus(),
        getChecklistAssistidoItens(filters),
      ]);
      setStatus(statusResponse.data || null);
      setItems(itemsResponse.data || []);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar o checklist assistido.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, groupFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function startValidation(item) {
    setSelected(item);
    setDraft({
      status: item.status || 'pendente',
      observacao: item.resultado || item.observacao_sugerida || '',
      evidencia_textual: item.evidencias_json?.evidencia_textual || item.evidencia_sugerida?.evidencia_textual || '',
    });
  }

  async function applySuggestion(item) {
    setLoading(true);
    setMessage('');
    try {
      const response = await applyChecklistAssistidoSugestao(item.id);
      await load();
      setMessage(response.data?.mensagem || 'Observacao sugerida aplicada sem alterar o status.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel aplicar a observacao sugerida.');
    } finally {
      setLoading(false);
    }
  }

  async function runDiagnostic() {
    setLoading(true);
    setMessage('');
    try {
      const response = await runChecklistAssistidoDiagnostico();
      setDiagnostico(response.data || null);
      await load();
      setMessage('Diagnostico assistido executado. Nenhum item foi aprovado automaticamente.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel executar o diagnostico assistido.');
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getChecklistAssistidoRelatorioPendencias();
      setRelatorio(response.data || null);
      setMessage('Relatorio de pendencias gerado.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel gerar relatorio de pendencias.');
    } finally {
      setLoading(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    const observacao = String(draft.observacao || '').trim();
    const evidenciaTextual = String(draft.evidencia_textual || '').trim();

    if (OBS_REQUIRED.has(draft.status) && !observacao) {
      setMessage('Observacao obrigatoria para reprovado, aprovado com observacao ou nao aplicavel.');
      return;
    }

    if (draft.status === 'aprovado' && selected.requer_evidencia_para_aprovacao && !observacao && !evidenciaTextual) {
      setMessage('Item obrigatorio aprovado exige observacao ou evidencia textual.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await updateChecklistAssistidoItem(selected.id, {
        status: draft.status,
        observacao,
        evidencia_textual: evidenciaTextual,
        evidencias_json: {
          tipo_validacao: selected.tipo_validacao,
          evidencia_sugerida: selected.evidencia_sugerida,
        },
      });
      setSelected(null);
      await load();
      setMessage('Item atualizado no checklist assistido.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel atualizar o item.');
    } finally {
      setLoading(false);
    }
  }

  const total = status || {};
  const ready = status?.ready_for_fase2d;

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Preenchimento Assistido do Checklist - Fase 2C.4</h2>
        <p style={pageStyles.sectionSubtitle}>
          Validacao institucional guiada dos itens obrigatorios pendentes antes da Fase 2D.
        </p>
        <div style={{ ...pageStyles.message, marginTop: 14, background: '#fff8e7' }}>
          Esta tela auxilia o preenchimento do checklist, mas nao aprova automaticamente a homologacao nem libera DAM real,
          cobranca oficial, protocolo definitivo ou decisao administrativa automatica.
        </div>
        {message ? <div style={{ ...pageStyles.message, marginTop: 14 }}>{message}</div> : null}
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Resumo</h3>
        <div style={pageStyles.grid3}>
          <MetricCard label="Total de itens" value={total.total || 0} />
          <MetricCard label="Obrigatorios pendentes" value={total.obrigatorios_pendentes || 0} tone={total.obrigatorios_pendentes ? 'danger' : 'ok'} />
          <MetricCard label="Obrigatorios reprovados" value={total.obrigatorios_reprovados || 0} tone={total.obrigatorios_reprovados ? 'danger' : 'ok'} />
          <MetricCard label="Aprovados" value={total.aprovados || 0} tone="ok" />
          <MetricCard label="Aprovados com observacao" value={total.aprovados_com_observacao || 0} />
          <MetricCard label="Nao aplicaveis" value={total.nao_aplicaveis || 0} />
          <MetricCard label="Diagnostico tecnico" value={total.diagnostico_tecnico || '-'} tone={total.diagnostico_tecnico === 'ok' ? 'ok' : 'danger'} />
          <MetricCard label="Ready para Fase 2D" value={ready?.ready ? 'Sim' : 'Nao'} tone={ready?.ready ? 'ok' : 'danger'} />
          <MetricCard label="Fase 2D" value={total.fase2d || 'bloqueada'} tone={ready?.ready ? 'ok' : 'danger'} />
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Orientacao</h3>
        <p style={pageStyles.sectionSubtitle}>
          Valide cada item obrigatorio pendente. Use a observacao sugerida quando ela refletir a evidencia verificada.
          Itens que dependem de analise visual ou institucional devem ser marcados apenas apos conferencia manual.
        </p>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Filtros e Acoes</h3>
        <div style={{ ...pageStyles.grid3, alignItems: 'end' }}>
          <label style={pageStyles.label}>
            Filtro principal
            <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} style={pageStyles.input}>
              {FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label style={pageStyles.label}>
            Grupo
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} style={pageStyles.input}>
              <option value="">Todos</option>
              {groups.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
            </select>
          </label>
          <label style={pageStyles.label}>
            Tipo de validacao
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={pageStyles.input}>
              <option value="">Todos</option>
              {types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        </div>
        <div style={{ ...pageStyles.actions, marginTop: 16 }}>
          <button type="button" style={pageStyles.buttonPrimary} onClick={runDiagnostic} disabled={loading || !canRunDiagnostic}>
            Executar diagnostico assistido
          </button>
          <button type="button" style={pageStyles.buttonSecondary} onClick={generateReport} disabled={loading || !canViewReport}>
            Gerar relatorio de pendencias
          </button>
          <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('fechamento')}>
            Voltar para Fechamento
          </button>
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Itens do Checklist</h3>
        {Object.entries(groupedItems).map(([grupo, groupItems]) => (
          <div key={grupo} style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 10px', color: '#0d1b3d' }}>{grupo}</h4>
            <div style={pageStyles.tableWrap}>
              <table style={pageStyles.table}>
                <thead>
                  <tr>
                    <th style={pageStyles.th}>Item</th>
                    <th style={pageStyles.th}>Orientacao</th>
                    <th style={pageStyles.th}>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {groupItems.map((item) => (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>
                        <strong>{item.codigo}</strong>
                        <p style={{ margin: '6px 0' }}>{item.item}</p>
                        <span style={statusStyle(item.status)}>{item.status}</span>{' '}
                        <span style={pageStyles.pill}>{item.obrigatorio ? 'obrigatorio' : 'opcional'}</span>{' '}
                        <span style={pageStyles.pill}>{item.tipo_validacao}</span>
                        {item.diagnostico_relacionado ? <span style={pageStyles.pill}>diagnostico</span> : null}
                        <p style={pageStyles.sectionSubtitle}>Rota: {item.rota_validacao || item.rota_relacionada || '-'}</p>
                      </td>
                      <td style={pageStyles.td}>
                        <p><strong>Resultado esperado:</strong> {item.resultado_esperado}</p>
                        <p><strong>Acao recomendada:</strong> {item.acao_recomendada}</p>
                        <p><strong>Observacao sugerida:</strong> {item.observacao_sugerida}</p>
                        <p><strong>Evidencia sugerida:</strong> {item.evidencia_sugerida?.evidencia_textual || item.evidencia_sugerida?.orientacao || item.evidencia_sugerida?.tipo}</p>
                      </td>
                      <td style={pageStyles.td}>
                        <div style={pageStyles.actions}>
                          {item.rota_validacao || item.rota_relacionada ? (
                            <button type="button" style={pageStyles.buttonSecondary} onClick={() => openValidationRoute(item.rota_validacao || item.rota_relacionada)}>
                              Abrir rota
                            </button>
                          ) : null}
                          <button
                            type="button"
                            style={pageStyles.buttonSecondary}
                            onClick={() => navigator.clipboard?.writeText(item.observacao_sugerida || '')}
                          >
                            Copiar observacao
                          </button>
                          <button type="button" style={pageStyles.buttonSecondary} onClick={() => applySuggestion(item)} disabled={loading || !canManage}>
                            Aplicar observacao
                          </button>
                          <button type="button" style={pageStyles.buttonPrimary} onClick={() => startValidation(item)} disabled={!canManage}>
                            Validar item
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {!items.length && !loading ? (
          <div style={pageStyles.message}>Nenhum item encontrado para os filtros selecionados.</div>
        ) : null}
      </section>

      {selected ? (
        <section style={{ ...pageStyles.section, border: '2px solid #0d3f8f' }}>
          <h3 style={pageStyles.sectionTitle}>Validar item</h3>
          <p><strong>{selected.codigo}</strong> - {selected.item}</p>
          <p style={pageStyles.sectionSubtitle}>{selected.acao_recomendada}</p>
          <p style={pageStyles.message}>Confirme manualmente antes de aprovar. A acao registrada aqui nao libera Fase 2D diretamente.</p>
          <div style={pageStyles.grid2}>
            <label style={pageStyles.label}>
              Status
              <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} style={pageStyles.input}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={pageStyles.label}>
              Diagnostico relacionado
              <input value={selected.diagnostico_relacionado || 'Sem diagnostico automatico relacionado'} readOnly style={pageStyles.input} />
            </label>
          </div>
          <label style={pageStyles.label}>
            Observacao
            <textarea value={draft.observacao} onChange={(event) => setDraft((current) => ({ ...current, observacao: event.target.value }))} style={pageStyles.textarea} />
          </label>
          <label style={pageStyles.label}>
            Evidencia textual
            <textarea value={draft.evidencia_textual} onChange={(event) => setDraft((current) => ({ ...current, evidencia_textual: event.target.value }))} style={pageStyles.textarea} />
          </label>
          <div style={pageStyles.actions}>
            <button type="button" style={pageStyles.buttonPrimary} onClick={saveSelected} disabled={loading || !canManage}>
              Salvar validacao
            </button>
            <button type="button" style={pageStyles.buttonSecondary} onClick={() => setSelected(null)}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {diagnostico ? (
        <section style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Diagnostico Assistido</h3>
          <p>Status: <strong>{diagnostico.status}</strong></p>
          <p style={pageStyles.sectionSubtitle}>O diagnostico gera evidencias sugeridas, mas nao aprova itens automaticamente.</p>
        </section>
      ) : null}

      {relatorio ? (
        <section style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Relatorio de Pendencias</h3>
          <p><strong>Recomendacao:</strong> {relatorio.recomendacao}</p>
          <p>
            Pendentes obrigatorios: {relatorio.resumo?.obrigatorios_pendentes || 0} | Reprovados obrigatorios: {relatorio.resumo?.obrigatorios_reprovados || 0}
          </p>
        </section>
      ) : null}
    </div>
  );
}
