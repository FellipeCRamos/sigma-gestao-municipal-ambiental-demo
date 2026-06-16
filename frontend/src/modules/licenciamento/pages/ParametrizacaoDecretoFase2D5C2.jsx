import { useEffect, useMemo, useState } from 'react';
import {
  getLicenciamentoParametrizacaoFase2D5C2Grupo21Bancada,
  getLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo,
  getLicenciamentoParametrizacaoFase2D5C2Grupo21Historico,
  updateLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo,
  validarLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo,
} from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles } from './shared';

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  pendente_conferencia: 'Pendente',
  conferido_com_lacunas: 'Com lacuna',
  conferido_integralmente: 'Conferido integralmente',
  bloqueado: 'Bloqueado',
  apto_para_seed_futuro: 'Apto para seed futuro',
};

const STATUS_TONES = {
  rascunho: 'muted',
  pendente_conferencia: 'warn',
  conferido_com_lacunas: 'warn',
  conferido_integralmente: 'ok',
  bloqueado: 'danger',
  apto_para_seed_futuro: 'ok',
};

const OPERATOR_LABELS = {
  menor_que: 'Menor que',
  menor_ou_igual: 'Menor ou igual',
  maior_que: 'Maior que',
  maior_ou_igual: 'Maior ou igual',
  igual: 'Igual',
  entre: 'Entre',
  ate: 'Até',
  acima_de: 'Acima de',
  nao_aplicavel: 'Não aplicável',
  texto_livre_conferido: 'Texto livre conferido',
};

const DEPENDENCIAS = [
  'SEMOB / viabilidade urbanistica',
  'fiscalizacao',
  'recursos hidricos',
  'APP',
  'supressao vegetal',
  'Defesa Civil',
  'orgao estadual',
  'orgao federal',
  'concessionaria ou permissionaria',
  'outro',
];

const codeCardStyle = {
  border: '1px solid #d8e5f2',
  borderRadius: '8px',
  background: '#ffffff',
  padding: '16px',
  display: 'grid',
  gap: '10px',
};

const faixaStyle = {
  border: '1px solid #e7eef7',
  borderRadius: '8px',
  padding: '14px',
  background: '#f7fbff',
  display: 'grid',
  gap: '12px',
};

const warningBoxStyle = {
  border: '1px solid #f7d99a',
  background: '#fffbeb',
  color: '#7c4a03',
  borderRadius: '8px',
  padding: '12px 14px',
  fontSize: '13px',
  fontWeight: 700,
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

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '-';
}

function listText(items = [], fallback = 'Sem registro') {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.map((item) => (typeof item === 'string' ? item : `${item.tipo || item.status || 'item'}: ${item.observacao || item.status || ''}`)).join('; ');
}

function splitLines(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(items = []) {
  return Array.isArray(items) ? items.map((item) => (typeof item === 'string' ? item : item.nome || item.descricao || item.tipo || '')).filter(Boolean).join('\n') : '';
}

function parseNumberOrNull(value) {
  const cleaned = String(value ?? '').trim().replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyFaixa(unidade = '') {
  return {
    ordem: 1,
    operador: 'texto_livre_conferido',
    valorInicial: '',
    valorFinal: '',
    unidade,
    textoNormativo: '',
    porte: '',
    classe: '',
    tipoAto: '',
    limiteImpactoLocal: '',
    observacao: '',
  };
}

function normalizeFaixa(faixa, index, unidade = '') {
  return {
    ordem: faixa.ordem || index + 1,
    operador: OPERATOR_LABELS[faixa.operador] ? faixa.operador : 'texto_livre_conferido',
    valorInicial: faixa.valorInicial ?? faixa.valor_inicial ?? '',
    valorFinal: faixa.valorFinal ?? faixa.valor_final ?? '',
    unidade: faixa.unidade || unidade,
    textoNormativo: faixa.textoNormativo || faixa.texto_normativo || faixa.textoNormativoFaixa || '',
    porte: faixa.porte || '',
    classe: faixa.classe || '',
    tipoAto: faixa.tipoAto || faixa.tipo_ato || '',
    limiteImpactoLocal: faixa.limiteImpactoLocal || faixa.limite_impacto_local || '',
    observacao: faixa.observacao || '',
  };
}

function formFromDetail(detail) {
  const dados = detail?.dadosConferidos || {};
  const evidencia = detail?.evidenciaVisual || detail?.baseDiagnostica?.evidenciaVisual || {};
  const selectedDeps = (detail?.dependenciasSetoriais || [])
    .map((item) => item.tipo || item)
    .filter(Boolean);
  const lacunasAtivas = dados.lacunasAtivas || dados.lacunas_ativas || [];

  return {
    nomeAtividade: detail?.nomeAtividade || '',
    parametroPrincipal: detail?.parametroPrincipal || '',
    unidade: detail?.unidade || '',
    descricaoNormativa: dados.descricaoNormativa || dados.descricao_normativa || '',
    observacaoConferencia: dados.observacaoConferencia || dados.observacao_conferencia || '',
    justificativaFaixasNaoAplicaveis: dados.justificativaFaixasNaoAplicaveis || dados.justificativa_faixas_nao_aplicaveis || '',
    justificativaClasseTipoAto: dados.justificativaClasseTipoAto || dados.justificativa_classe_tipo_ato || '',
    lacunasAtivasTexto: Array.isArray(lacunasAtivas) ? lacunasAtivas.join('\n') : String(lacunasAtivas || ''),
    faixasConferidas: (detail?.faixasConferidas || []).length
      ? detail.faixasConferidas.map((faixa, index) => normalizeFaixa(faixa, index, detail.unidade))
      : [emptyFaixa(detail?.unidade || '')],
    documentosTexto: joinLines(detail?.documentosConferidos || []),
    observacoesTexto: joinLines(detail?.observacoesNormativas || []),
    dependenciasSelecionadas: selectedDeps,
    dependenciasObservacao: '',
    evidenciaPaginaPdf: evidencia.paginaPdf || evidencia.pagina_pdf || '',
    evidenciaTrechoTabela: evidencia.trechoTabela || evidencia.trecho_tabela || '',
    evidenciaObservacao: evidencia.observacao || '',
    fonteNormativa: detail?.fonteNormativa || 'Decreto Municipal n. 021/2020',
    observacaoInterna: detail?.observacaoInterna || '',
    aptoParaSeed: detail?.aptoParaSeedFuturo === true,
  };
}

function buildPayload(form, statusConferencia, aptoParaSeed = false) {
  return {
    nomeAtividade: form.nomeAtividade,
    parametroPrincipal: form.parametroPrincipal,
    unidade: form.unidade,
    dadosConferidos: {
      descricaoNormativa: form.descricaoNormativa,
      observacaoConferencia: form.observacaoConferencia,
      justificativaFaixasNaoAplicaveis: form.justificativaFaixasNaoAplicaveis,
      justificativaClasseTipoAto: form.justificativaClasseTipoAto,
      lacunasAtivas: splitLines(form.lacunasAtivasTexto),
    },
    faixasConferidas: form.faixasConferidas.map((faixa, index) => ({
      ordem: Number(faixa.ordem || index + 1),
      operador: faixa.operador,
      valorInicial: parseNumberOrNull(faixa.valorInicial),
      valorFinal: parseNumberOrNull(faixa.valorFinal),
      unidade: faixa.unidade || form.unidade,
      textoNormativo: faixa.textoNormativo,
      porte: faixa.porte,
      classe: faixa.classe,
      tipoAto: faixa.tipoAto,
      limiteImpactoLocal: faixa.limiteImpactoLocal,
      observacao: faixa.observacao,
    })),
    documentosConferidos: splitLines(form.documentosTexto),
    dependenciasSetoriais: form.dependenciasSelecionadas.map((tipo) => ({
      tipo,
      status: 'registrada_manual',
      observacao: form.dependenciasObservacao,
    })),
    observacoesNormativas: splitLines(form.observacoesTexto),
    evidenciaVisual: {
      paginaPdf: form.evidenciaPaginaPdf,
      trechoTabela: form.evidenciaTrechoTabela,
      observacao: form.evidenciaObservacao,
    },
    statusConferencia,
    aptoParaSeed,
    fonteNormativa: form.fonteNormativa,
    observacaoInterna: form.observacaoInterna,
  };
}

export default function ParametrizacaoDecretoFase2D5C2() {
  const [bancada, setBancada] = useState(null);
  const [selected, setSelected] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [form, setForm] = useState(null);
  const [filters, setFilters] = useState({ busca: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadBancada() {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoParametrizacaoFase2D5C2Grupo21Bancada();
      setBancada(response.data);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a bancada de conferencia.');
    } finally {
      setLoading(false);
    }
  }

  async function openCodigo(codigo) {
    setDetailLoading(true);
    setMessage('');
    try {
      const [detailResponse, historyResponse] = await Promise.all([
        getLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo(codigo),
        getLicenciamentoParametrizacaoFase2D5C2Grupo21Historico(codigo),
      ]);
      setSelected(detailResponse.data);
      setForm(formFromDetail(detailResponse.data));
      setHistorico(historyResponse.data?.historico || []);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel abrir o codigo selecionado.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function reloadSelected(codigo) {
    const [detailResponse, historyResponse] = await Promise.all([
      getLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo(codigo),
      getLicenciamentoParametrizacaoFase2D5C2Grupo21Historico(codigo),
    ]);
    setSelected(detailResponse.data);
    setForm(formFromDetail(detailResponse.data));
    setHistorico(historyResponse.data?.historico || []);
    await loadBancada();
  }

  async function saveDraft() {
    if (!selected || !form) return;
    setSaving(true);
    setMessage('');
    try {
      await updateLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo(
        selected.codigo,
        buildPayload(form, 'rascunho', false)
      );
      await reloadSelected(selected.codigo);
      setMessage('Rascunho salvo com historico de auditoria.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel salvar o rascunho.');
    } finally {
      setSaving(false);
    }
  }

  async function validateConference() {
    if (!selected || !form) return;
    setSaving(true);
    setMessage('');
    try {
      await validarLicenciamentoParametrizacaoFase2D5C2Grupo21Codigo(
        selected.codigo,
        buildPayload(form, 'conferido_integralmente', form.aptoParaSeed)
      );
      await reloadSelected(selected.codigo);
      setMessage('Conferencia validada e registrada em historico.');
    } catch (error) {
      setMessage(error.message || 'Validacao bloqueada por campos obrigatorios pendentes.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadBancada();
  }, []);

  const filteredCodes = useMemo(() => {
    const query = filters.busca.trim().toLowerCase();
    return (bancada?.codigos || []).filter((item) => {
      const matchesStatus = !filters.status || item.statusConferenciaManual === filters.status;
      const matchesQuery = !query
        || String(item.codigo || '').toLowerCase().includes(query)
        || String(item.nomeAtividade || '').toLowerCase().includes(query)
        || String(item.parametroPrincipal || '').toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [bancada, filters]);

  const canEdit = bancada?.permissoes?.editar === true;
  const canValidate = bancada?.permissoes?.validar === true;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFaixa(index, field, value) {
    setForm((current) => ({
      ...current,
      faixasConferidas: current.faixasConferidas.map((faixa, faixaIndex) => (
        faixaIndex === index ? { ...faixa, [field]: value } : faixa
      )),
    }));
  }

  function addFaixa() {
    setForm((current) => ({
      ...current,
      faixasConferidas: [
        ...current.faixasConferidas,
        { ...emptyFaixa(current.unidade), ordem: current.faixasConferidas.length + 1 },
      ],
    }));
  }

  function removeFaixa(index) {
    setForm((current) => ({
      ...current,
      faixasConferidas: current.faixasConferidas
        .filter((_, faixaIndex) => faixaIndex !== index)
        .map((faixa, faixaIndex) => ({ ...faixa, ordem: faixaIndex + 1 })),
    }));
  }

  function toggleDependencia(tipo) {
    setForm((current) => {
      const selectedDeps = current.dependenciasSelecionadas.includes(tipo)
        ? current.dependenciasSelecionadas.filter((item) => item !== tipo)
        : [...current.dependenciasSelecionadas, tipo];
      return { ...current, dependenciasSelecionadas: selectedDeps };
    });
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Fase 2D.5C.2 - Bancada de Conferência Manual Assistida do Grupo 21</h1>
        <p style={pageStyles.sectionSubtitle}>
          Ferramenta interna para converter o diagnóstico visual do Grupo 21 - Obras e Estruturas Diversas em matriz normativa manualmente conferida, auditável e preparada para futura seed controlada.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}
      {loading ? <div style={pageStyles.message}>Carregando bancada de conferência manual...</div> : null}

      {bancada ? (
        <>
          <section style={pageStyles.grid3}>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Total de códigos</p>
              <p style={pageStyles.metricValue}>{formatNumber(bancada.totalCodigos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Em rascunho</p>
              <p style={pageStyles.metricValue}>{formatNumber(bancada.codigosRascunho)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Conferidos</p>
              <p style={pageStyles.metricValue}>{formatNumber(bancada.codigosConferidos)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Com lacuna</p>
              <p style={pageStyles.metricValue}>{formatNumber(bancada.codigosComLacuna)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Bloqueados</p>
              <p style={pageStyles.metricValue}>{formatNumber(bancada.codigosBloqueados)}</p>
            </div>
            <div style={pageStyles.cardMetric}>
              <p style={pageStyles.metricLabel}>Aptos para seed futuro</p>
              <p style={pageStyles.metricValue}>{formatNumber(bancada.codigosAptosSeedFuturo)}</p>
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Resumo geral</h2>
            <div style={pageStyles.actions}>
              {badge(`Grupo ${bancada.grupo} - ${bancada.nomeGrupo}`)}
              {badge(bancada.statusGeral, bancada.statusGeral === 'pronto_para_seed_controlado' ? 'ok' : 'warn')}
              {badge(bancada.aptoParaSeed ? 'Apto para seed futuro' : 'Não apto para seed', bancada.aptoParaSeed ? 'ok' : 'warn')}
              {badge('Sem seed operacional', 'ok')}
            </div>
            <p style={pageStyles.sectionSubtitle}><strong>Fonte:</strong> {bancada.fonte}</p>
            <p style={pageStyles.sectionSubtitle}><strong>Método:</strong> {bancada.metodo}</p>
            <p style={pageStyles.sectionSubtitle}><strong>Próxima etapa segura:</strong> {bancada.recomendacaoProximaFase}</p>
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              {(bancada.alertas || []).map((alerta) => <div key={alerta} style={warningBoxStyle}>{alerta}</div>)}
            </div>
          </section>

          <section style={pageStyles.section}>
            <h2 style={pageStyles.sectionTitle}>Lista de códigos</h2>
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
                <input style={pageStyles.input} value={filters.busca} onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))} placeholder="Código, atividade ou parâmetro" />
              </label>
            </div>
          </section>

          <div style={pageStyles.grid2}>
            {filteredCodes.map((item) => (
              <article key={item.codigo} style={codeCardStyle}>
                <div>
                  <h3 style={{ ...pageStyles.sectionTitle, fontSize: 17, marginBottom: 8 }}>{item.codigo} - {item.nomeAtividade}</h3>
                  <p style={pageStyles.sectionSubtitle}><strong>Parâmetro:</strong> {item.parametroPrincipal}</p>
                  <p style={pageStyles.sectionSubtitle}><strong>Unidade:</strong> {item.unidade}</p>
                </div>
                <div style={pageStyles.actions}>
                  {badge(statusLabel(item.statusConferenciaManual), STATUS_TONES[item.statusConferenciaManual])}
                  {badge(item.aptoParaSeedFuturo ? 'Apto para seed futuro' : 'Não apto para seed', item.aptoParaSeedFuturo ? 'ok' : 'warn')}
                  {badge(item.manualSalvo ? 'Com rascunho salvo' : 'Sem rascunho manual', item.manualSalvo ? 'neutral' : 'muted')}
                </div>
                <p style={pageStyles.sectionSubtitle}>
                  <strong>Evidência:</strong> {item.evidenciaVisual?.paginaPdf || item.baseDiagnostica?.evidenciaVisual?.paginaPdf || '-'} - {item.evidenciaVisual?.trechoTabela || item.baseDiagnostica?.evidenciaVisual?.trechoTabela || '-'}
                </p>
                <button type="button" style={pageStyles.buttonPrimary} onClick={() => openCodigo(item.codigo)}>
                  Conferir
                </button>
              </article>
            ))}
          </div>

          {detailLoading ? <div style={pageStyles.message}>Abrindo código para conferência...</div> : null}

          {selected && form ? (
            <section style={pageStyles.section}>
              <h2 style={pageStyles.sectionTitle}>Conferência manual - {selected.codigo}</h2>
              <div style={pageStyles.actions}>
                {badge(statusLabel(selected.statusConferenciaManual), STATUS_TONES[selected.statusConferenciaManual])}
                {badge(selected.aptoParaSeedFuturo ? 'Apto para seed futuro' : 'Não apto para seed', selected.aptoParaSeedFuturo ? 'ok' : 'warn')}
                {badge(canEdit ? 'Edição permitida' : 'Somente leitura', canEdit ? 'ok' : 'muted')}
              </div>

              <details open style={{ ...codeCardStyle, marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: '#0d1b3d', fontWeight: 850 }}>Dados herdados da 2D.5C.1</summary>
                <p style={pageStyles.sectionSubtitle}><strong>Nome identificado:</strong> {selected.baseDiagnostica?.nomeAtividade}</p>
                <p style={pageStyles.sectionSubtitle}><strong>Parâmetro/unidade:</strong> {selected.baseDiagnostica?.parametroPrincipal} / {selected.baseDiagnostica?.unidade}</p>
                <p style={pageStyles.sectionSubtitle}><strong>Status visual:</strong> {selected.baseDiagnostica?.statusConferencia}</p>
                <p style={pageStyles.sectionSubtitle}><strong>Evidência visual:</strong> {selected.baseDiagnostica?.evidenciaVisual?.paginaPdf} - {selected.baseDiagnostica?.evidenciaVisual?.trechoTabela}</p>
                <p style={pageStyles.sectionSubtitle}><strong>Lacunas:</strong> {listText(selected.baseDiagnostica?.lacunas || [])}</p>
              </details>

              <div style={{ ...pageStyles.formGrid, marginTop: 16 }}>
                <label style={pageStyles.label}>
                  Nome oficial da atividade
                  <textarea style={pageStyles.textarea} value={form.nomeAtividade} onChange={(event) => updateForm('nomeAtividade', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Descrição normativa
                  <textarea style={pageStyles.textarea} value={form.descricaoNormativa} onChange={(event) => updateForm('descricaoNormativa', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Parâmetro principal
                  <input style={pageStyles.input} value={form.parametroPrincipal} onChange={(event) => updateForm('parametroPrincipal', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Unidade
                  <input style={pageStyles.input} value={form.unidade} onChange={(event) => updateForm('unidade', event.target.value)} />
                </label>
              </div>

              <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
                <h3 style={{ ...pageStyles.sectionTitle, fontSize: 17, marginBottom: 0 }}>Faixas de enquadramento</h3>
                {form.faixasConferidas.map((faixa, index) => (
                  <div key={`${selected.codigo}-faixa-${index}`} style={faixaStyle}>
                    <div style={pageStyles.formGrid}>
                      <label style={pageStyles.label}>
                        Ordem
                        <input style={pageStyles.input} value={faixa.ordem} onChange={(event) => updateFaixa(index, 'ordem', event.target.value)} />
                      </label>
                      <label style={pageStyles.label}>
                        Operador
                        <select style={pageStyles.input} value={faixa.operador} onChange={(event) => updateFaixa(index, 'operador', event.target.value)}>
                          {Object.entries(OPERATOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label style={pageStyles.label}>
                        Valor inicial
                        <input style={pageStyles.input} value={faixa.valorInicial} onChange={(event) => updateFaixa(index, 'valorInicial', event.target.value)} />
                      </label>
                      <label style={pageStyles.label}>
                        Valor final
                        <input style={pageStyles.input} value={faixa.valorFinal} onChange={(event) => updateFaixa(index, 'valorFinal', event.target.value)} />
                      </label>
                      <label style={pageStyles.label}>
                        Unidade
                        <input style={pageStyles.input} value={faixa.unidade} onChange={(event) => updateFaixa(index, 'unidade', event.target.value)} />
                      </label>
                      <label style={pageStyles.label}>
                        Porte
                        <input style={pageStyles.input} value={faixa.porte} onChange={(event) => updateFaixa(index, 'porte', event.target.value)} />
                      </label>
                      <label style={pageStyles.label}>
                        Classe
                        <input style={pageStyles.input} value={faixa.classe} onChange={(event) => updateFaixa(index, 'classe', event.target.value)} />
                      </label>
                      <label style={pageStyles.label}>
                        Tipo de ato/licença
                        <input style={pageStyles.input} value={faixa.tipoAto} onChange={(event) => updateFaixa(index, 'tipoAto', event.target.value)} />
                      </label>
                      <label style={pageStyles.label}>
                        Limite de impacto local
                        <input style={pageStyles.input} value={faixa.limiteImpactoLocal} onChange={(event) => updateFaixa(index, 'limiteImpactoLocal', event.target.value)} />
                      </label>
                    </div>
                    <label style={pageStyles.label}>
                      Texto normativo da faixa
                      <textarea style={pageStyles.textarea} value={faixa.textoNormativo} onChange={(event) => updateFaixa(index, 'textoNormativo', event.target.value)} />
                    </label>
                    <label style={pageStyles.label}>
                      Observação da faixa
                      <textarea style={pageStyles.textarea} value={faixa.observacao} onChange={(event) => updateFaixa(index, 'observacao', event.target.value)} />
                    </label>
                    <div style={pageStyles.actions}>
                      <button type="button" style={pageStyles.buttonSecondary} onClick={() => removeFaixa(index)} disabled={form.faixasConferidas.length === 1}>
                        Remover faixa
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" style={pageStyles.buttonSecondary} onClick={addFaixa}>
                  Adicionar faixa
                </button>
              </div>

              <div style={{ ...pageStyles.formGrid, marginTop: 18 }}>
                <label style={pageStyles.label}>
                  Justificativa se faixa não for aplicável
                  <textarea style={pageStyles.textarea} value={form.justificativaFaixasNaoAplicaveis} onChange={(event) => updateForm('justificativaFaixasNaoAplicaveis', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Justificativa para ausência de classe/tipo de ato
                  <textarea style={pageStyles.textarea} value={form.justificativaClasseTipoAto} onChange={(event) => updateForm('justificativaClasseTipoAto', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Documentos mínimos conferidos
                  <textarea style={pageStyles.textarea} value={form.documentosTexto} onChange={(event) => updateForm('documentosTexto', event.target.value)} placeholder="Um documento por linha" />
                </label>
                <label style={pageStyles.label}>
                  Observações normativas
                  <textarea style={pageStyles.textarea} value={form.observacoesTexto} onChange={(event) => updateForm('observacoesTexto', event.target.value)} placeholder="Uma observação por linha" />
                </label>
              </div>

              <div style={{ marginTop: 18 }}>
                <h3 style={{ ...pageStyles.sectionTitle, fontSize: 17 }}>Dependências setoriais</h3>
                <div style={pageStyles.actions}>
                  {DEPENDENCIAS.map((tipo) => (
                    <label key={tipo} style={{ ...pageStyles.pill, background: form.dependenciasSelecionadas.includes(tipo) ? '#dcfce7' : '#e5e7eb', color: form.dependenciasSelecionadas.includes(tipo) ? '#166534' : '#374151', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.dependenciasSelecionadas.includes(tipo)} onChange={() => toggleDependencia(tipo)} style={{ marginRight: 6 }} />
                      {tipo}
                    </label>
                  ))}
                </div>
                <label style={{ ...pageStyles.label, marginTop: 14 }}>
                  Observação das dependências
                  <textarea style={pageStyles.textarea} value={form.dependenciasObservacao} onChange={(event) => updateForm('dependenciasObservacao', event.target.value)} />
                </label>
              </div>

              <div style={{ ...pageStyles.formGrid, marginTop: 18 }}>
                <label style={pageStyles.label}>
                  Página do PDF
                  <input style={pageStyles.input} value={form.evidenciaPaginaPdf} onChange={(event) => updateForm('evidenciaPaginaPdf', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Trecho/tabela
                  <input style={pageStyles.input} value={form.evidenciaTrechoTabela} onChange={(event) => updateForm('evidenciaTrechoTabela', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Fonte normativa
                  <input style={pageStyles.input} value={form.fonteNormativa} onChange={(event) => updateForm('fonteNormativa', event.target.value)} />
                </label>
              </div>
              <div style={{ ...pageStyles.formGrid, marginTop: 14 }}>
                <label style={pageStyles.label}>
                  Observação da evidência visual
                  <textarea style={pageStyles.textarea} value={form.evidenciaObservacao} onChange={(event) => updateForm('evidenciaObservacao', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Observação de conferência
                  <textarea style={pageStyles.textarea} value={form.observacaoConferencia} onChange={(event) => updateForm('observacaoConferencia', event.target.value)} />
                </label>
                <label style={pageStyles.label}>
                  Lacunas ativas
                  <textarea style={pageStyles.textarea} value={form.lacunasAtivasTexto} onChange={(event) => updateForm('lacunasAtivasTexto', event.target.value)} placeholder="Uma lacuna por linha. Deixe vazio para apto futuro." />
                </label>
                <label style={pageStyles.label}>
                  Observação interna do servidor
                  <textarea style={pageStyles.textarea} value={form.observacaoInterna} onChange={(event) => updateForm('observacaoInterna', event.target.value)} />
                </label>
              </div>

              <div style={pageStyles.actions}>
                <label style={{ ...pageStyles.pill, background: form.aptoParaSeed ? '#dcfce7' : '#e5e7eb', color: form.aptoParaSeed ? '#166534' : '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.aptoParaSeed} onChange={(event) => updateForm('aptoParaSeed', event.target.checked)} style={{ marginRight: 6 }} />
                  Apto para seed futuro
                </label>
              </div>

              <div style={pageStyles.actions}>
                <button type="button" style={pageStyles.buttonSecondary} onClick={saveDraft} disabled={!canEdit || saving}>
                  Salvar rascunho
                </button>
                <button type="button" style={pageStyles.buttonPrimary} onClick={validateConference} disabled={!canValidate || saving}>
                  Validar conferência
                </button>
              </div>

              <details open style={{ ...codeCardStyle, marginTop: 18 }}>
                <summary style={{ cursor: 'pointer', color: '#0d1b3d', fontWeight: 850 }}>Histórico</summary>
                {historico.length ? historico.map((item) => (
                  <div key={item.id} style={{ borderTop: '1px solid #e7eef7', paddingTop: 10, marginTop: 10 }}>
                    <p style={pageStyles.sectionSubtitle}><strong>{item.acao}</strong> - {statusLabel(item.statusAnterior)} para {statusLabel(item.statusNovo)}</p>
                    <p style={pageStyles.sectionSubtitle}>{formatDate(item.criadoEm)} por {item.usuarioNome || 'usuario interno'}</p>
                    {item.observacao ? <p style={pageStyles.sectionSubtitle}>{item.observacao}</p> : null}
                  </div>
                )) : <p style={pageStyles.sectionSubtitle}>Sem histórico manual salvo para este código.</p>}
              </details>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
