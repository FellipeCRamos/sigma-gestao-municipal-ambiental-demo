import { useEffect, useMemo, useState } from 'react';
import {
  getLicenciamentoPreRequerimento,
  getLicenciamentoPreRequerimentoHistorico,
  getLicenciamentoPreRequerimentos,
  updateLicenciamentoPreRequerimentoDocumento,
  updateLicenciamentoPreRequerimentoMinuta,
  updateLicenciamentoPreRequerimentoStatus,
} from '../services/licenciamentoAdminApi';
import { formatDate, pageStyles, unpackListPayload } from './shared';

const STATUS_OPTIONS = [
  ['pre_requerimento_criado', 'Pre-requerimento criado'],
  ['aguardando_documentos', 'Aguardando documentos'],
  ['em_conferencia', 'Em conferencia'],
  ['apto_para_autuacao', 'Apto para autuacao'],
  ['convertido_em_processo', 'Convertido em processo'],
  ['diligencia', 'Diligencia'],
  ['arquivado', 'Arquivado'],
  ['cancelado', 'Cancelado'],
];

const DOCUMENT_STATUS_OPTIONS = [
  ['pendente', 'Pendente'],
  ['apresentado', 'Apresentado'],
  ['em_conferencia', 'Em conferencia'],
  ['aceito', 'Aceito'],
  ['recusado', 'Recusado'],
  ['dispensado', 'Dispensado'],
  ['nao_se_aplica', 'Nao se aplica'],
];

function badge(text, tone = 'neutral') {
  const colors = {
    neutral: { background: '#eef2ff', color: '#1e3a8a' },
    ok: { background: '#dcfce7', color: '#166534' },
    warn: { background: '#fef3c7', color: '#92400e' },
    danger: { background: '#fee2e2', color: '#991b1b' },
  };

  return <span style={{ ...pageStyles.pill, ...(colors[tone] || colors.neutral) }}>{text}</span>;
}

function toneForStatus(status) {
  if (['apto_para_autuacao', 'convertido_em_processo', 'aceito'].includes(status)) return 'ok';
  if (['arquivado', 'cancelado', 'recusado'].includes(status)) return 'danger';
  if (['aguardando_documentos', 'diligencia', 'pendente'].includes(status)) return 'warn';
  return 'neutral';
}

function ListBlock({ title, items }) {
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{title}</p>
      {items?.length ? (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          {items.map((item) => <li key={String(item)}>{String(item)}</li>)}
        </ul>
      ) : <p style={pageStyles.sectionSubtitle}>Nenhum item registrado.</p>}
    </div>
  );
}

function SidDigital({ sid }) {
  const respostas = sid?.perguntasRespostas || [];
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>SID DIGITAL - SOLICITACAO DE INFORMACOES DA ATIVIDADE</p>
      <p style={pageStyles.sectionSubtitle}>{sid?.aviso}</p>
      <div style={{ ...pageStyles.tableWrap, marginTop: 12 }}>
        <table style={pageStyles.table}>
          <thead>
            <tr>
              <th style={pageStyles.th}>Pergunta</th>
              <th style={pageStyles.th}>Resposta</th>
            </tr>
          </thead>
          <tbody>
            {respostas.map((item) => (
              <tr key={item.pergunta}>
                <td style={pageStyles.td}>{item.pergunta}</td>
                <td style={pageStyles.td}>{item.respostaFormatada}</td>
              </tr>
            ))}
            {!respostas.length ? (
              <tr>
                <td style={pageStyles.td} colSpan={2}>Nenhuma resposta registrada.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LicenciamentoPreRequerimentos() {
  const [filters, setFilters] = useState({ status: '', nivelAtencao: '', busca: '', codigo: '', interessado: '' });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [detail, setDetail] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('em_conferencia');
  const [minuta, setMinuta] = useState('');
  const [documentDrafts, setDocumentDrafts] = useState({});

  async function loadList(nextFilters = filters) {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoPreRequerimentos(nextFilters);
      const unpacked = unpackListPayload(response.data);
      setItems(unpacked.items);
      setPagination(unpacked.pagination);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel listar pre-requerimentos.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id) {
    setMessage('');
    try {
      const [detailResponse, historyResponse] = await Promise.all([
        getLicenciamentoPreRequerimento(id),
        getLicenciamentoPreRequerimentoHistorico(id),
      ]);
      setDetail(detailResponse.data);
      setHistorico(historyResponse.data || []);
      setStatusUpdate(detailResponse.data?.status || 'em_conferencia');
      setMinuta(detailResponse.data?.minutaDespacho || '');
      setDocumentDrafts({});
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar pre-requerimento.');
    }
  }

  useEffect(() => {
    loadList();
    // Carga inicial apenas na abertura; filtros sao aplicados pelo botao.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumo = useMemo(() => ({
    total: pagination?.total ?? items.length,
    pendentes: items.filter((item) => ['pre_requerimento_criado', 'aguardando_documentos'].includes(item.status)).length,
    aptos: items.filter((item) => item.status === 'apto_para_autuacao').length,
  }), [items, pagination]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function handleFilter(event) {
    event.preventDefault();
    await loadList(filters);
  }

  async function handleStatus(event) {
    event.preventDefault();
    if (!detail) return;
    try {
      await updateLicenciamentoPreRequerimentoStatus(detail.id, {
        status: statusUpdate,
        observacao: 'Status atualizado na instrucao preliminar interna.',
      });
      await loadDetail(detail.id);
      await loadList(filters);
      setMessage('Status do pre-requerimento atualizado.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel atualizar status.');
    }
  }

  async function handleMinuta(event) {
    event.preventDefault();
    if (!detail) return;
    try {
      await updateLicenciamentoPreRequerimentoMinuta(detail.id, {
        minutaDespacho: minuta,
        observacao: 'Minuta interna atualizada.',
      });
      await loadDetail(detail.id);
      setMessage('Minuta de despacho salva.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel salvar minuta.');
    }
  }

  async function handleDocumento(documento) {
    if (!detail) return;
    const draft = documentDrafts[documento.codigo] || {};
    try {
      await updateLicenciamentoPreRequerimentoDocumento(detail.id, {
        codigo: documento.codigo,
        status: draft.status || documento.status,
        observacao: draft.observacao ?? documento.observacao ?? '',
      });
      await loadDetail(detail.id);
      setMessage(`Documento ${documento.codigo} atualizado.`);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel atualizar documento.');
    }
  }

  function updateDocumentDraft(codigo, key, value) {
    setDocumentDrafts((current) => ({
      ...current,
      [codigo]: {
        ...(current[codigo] || {}),
        [key]: value,
      },
    }));
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Pre-Requerimentos Ambientais</h1>
        <p style={pageStyles.sectionSubtitle}>
          Registros preliminares oriundos de pre-analises validadas pelo Assistente de Enquadramento Ambiental,
          destinados a conferencia documental e instrucao administrativa interna. Nao ha protocolo eDocs, DAM,
          licenca, dispensa, anuencia, certidao ou ato autorizativo nesta etapa.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}

      <section style={pageStyles.grid3}>
        <div style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Pre-requerimentos</p>
          <p style={pageStyles.metricValue}>{resumo.total}</p>
        </div>
        <div style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Em instrucao inicial</p>
          <p style={pageStyles.metricValue}>{resumo.pendentes}</p>
        </div>
        <div style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Aptos para autuacao</p>
          <p style={pageStyles.metricValue}>{resumo.aptos}</p>
        </div>
      </section>

      <section style={pageStyles.section}>
        <h2 style={pageStyles.sectionTitle}>Filtros</h2>
        <form style={pageStyles.formGrid} onSubmit={handleFilter}>
          <label style={pageStyles.label}>
            Status
            <select style={pageStyles.input} value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={pageStyles.label}>
            Nivel
            <select style={pageStyles.input} value={filters.nivelAtencao} onChange={(event) => updateFilter('nivelAtencao', event.target.value)}>
              <option value="">Todos</option>
              <option value="baixo">Baixo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
            </select>
          </label>
          <label style={pageStyles.label}>
            Codigo
            <input style={pageStyles.input} value={filters.codigo} onChange={(event) => updateFilter('codigo', event.target.value)} placeholder="PR-LA-2026-000001" />
          </label>
          <label style={pageStyles.label}>
            Interessado
            <input style={pageStyles.input} value={filters.interessado} onChange={(event) => updateFilter('interessado', event.target.value)} placeholder="Nome ou email" />
          </label>
          <label style={pageStyles.label}>
            Busca livre
            <input style={pageStyles.input} value={filters.busca} onChange={(event) => updateFilter('busca', event.target.value)} placeholder="Atividade, descricao ou codigo AE" />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" style={pageStyles.buttonPrimary}>Filtrar</button>
          </div>
        </form>
      </section>

      <section style={pageStyles.grid2}>
        <div style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Lista</h2>
          {loading ? <p style={pageStyles.sectionSubtitle}>Carregando...</p> : null}
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Codigo</th>
                  <th style={pageStyles.th}>Data</th>
                  <th style={pageStyles.th}>Interessado</th>
                  <th style={pageStyles.th}>Atividade</th>
                  <th style={pageStyles.th}>Nivel</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={pageStyles.td}>{item.codigoPreRequerimento}</td>
                    <td style={pageStyles.td}>{formatDate(item.criadoEm)}</td>
                    <td style={pageStyles.td}>{item.interessadoNome || item.interessadoEmail || '-'}</td>
                    <td style={pageStyles.td}>{item.atividadeEnquadrada}</td>
                    <td style={pageStyles.td}>{badge(item.nivelAtencao, toneForStatus(item.nivelAtencao === 'alto' ? 'recusado' : 'em_conferencia'))}</td>
                    <td style={pageStyles.td}>{badge(item.status, toneForStatus(item.status))}</td>
                    <td style={pageStyles.td}>
                      <button type="button" style={pageStyles.buttonSecondary} onClick={() => loadDetail(item.id)}>
                        Visualizar
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td style={pageStyles.td} colSpan={7}>Nenhum pre-requerimento encontrado.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Detalhe</h2>
          {!detail ? (
            <p style={pageStyles.sectionSubtitle}>Selecione um pre-requerimento para revisar SID digital, checklist, minuta e historico.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={pageStyles.actions}>
                  {badge(detail.codigoPreRequerimento, 'neutral')}
                  {badge(detail.status, toneForStatus(detail.status))}
                  {badge(`Origem ${detail.codigoAnaliseAssistente || 'AE'}`, 'neutral')}
                </div>
                <h3 style={{ ...pageStyles.sectionTitle, marginTop: 14 }}>{detail.atividadeEnquadrada}</h3>
                <p style={pageStyles.sectionSubtitle}>
                  Interessado: {detail.interessadoNome || '-'} | Email: {detail.interessadoEmail || '-'} | Telefone: {detail.interessadoTelefone || '-'}
                </p>
                <p style={pageStyles.sectionSubtitle}>
                  Tipo de pessoa: {detail.tipoPessoa || '-'} | Tipo de imovel: {detail.tipoImovel || '-'} | Nivel: {detail.nivelAtencao}
                </p>
              </div>

              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Origem e descricao original</p>
                <p style={pageStyles.sectionSubtitle}>
                  Analise {detail.codigoAnaliseAssistente || '-'} criada em {formatDate(detail.criadoEmAnalise)}. Perfil informado: {detail.perfilUsuarioAnalise || '-'}.
                </p>
                <p style={pageStyles.sectionSubtitle}>{detail.descricaoOriginal}</p>
              </div>

              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Resumo tecnico consolidado</p>
                <p style={pageStyles.sectionSubtitle}>{detail.resumoTecnico}</p>
              </div>

              <SidDigital sid={detail.sidDigital} />

              <ListBlock title="Pendencias herdadas" items={detail.pendencias} />

              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Checklist documental controlavel</p>
                <div style={{ ...pageStyles.tableWrap, marginTop: 12 }}>
                  <table style={pageStyles.table}>
                    <thead>
                      <tr>
                        <th style={pageStyles.th}>Documento</th>
                        <th style={pageStyles.th}>Obrigatorio</th>
                        <th style={pageStyles.th}>Status</th>
                        <th style={pageStyles.th}>Observacao</th>
                        <th style={pageStyles.th}>Acao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.documentos || []).map((documento) => {
                        const draft = documentDrafts[documento.codigo] || {};
                        return (
                          <tr key={documento.codigo}>
                            <td style={pageStyles.td}>
                              <strong>{documento.nome}</strong>
                              <p style={pageStyles.sectionSubtitle}>{documento.descricao}</p>
                              <p style={pageStyles.sectionSubtitle}>Atualizado em {formatDate(documento.atualizadoEm)} por {documento.usuarioResponsavel || '-'}</p>
                            </td>
                            <td style={pageStyles.td}>{documento.obrigatorio ? 'Sim' : 'Nao'}</td>
                            <td style={pageStyles.td}>
                              <select style={pageStyles.input} value={draft.status || documento.status} onChange={(event) => updateDocumentDraft(documento.codigo, 'status', event.target.value)}>
                                {DOCUMENT_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </td>
                            <td style={pageStyles.td}>
                              <textarea
                                style={{ ...pageStyles.textarea, minHeight: 72 }}
                                value={draft.observacao ?? documento.observacao ?? ''}
                                onChange={(event) => updateDocumentDraft(documento.codigo, 'observacao', event.target.value)}
                              />
                            </td>
                            <td style={pageStyles.td}>
                              <button type="button" style={pageStyles.buttonSecondary} onClick={() => handleDocumento(documento)}>
                                Salvar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <form style={pageStyles.formGrid} onSubmit={handleStatus}>
                <label style={pageStyles.label}>
                  Atualizar status
                  <select style={pageStyles.input} value={statusUpdate} onChange={(event) => setStatusUpdate(event.target.value)}>
                    {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <div style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
                  <button type="submit" style={pageStyles.buttonPrimary}>Salvar status</button>
                  <button type="button" style={{ ...pageStyles.buttonSecondary, opacity: 0.65 }} disabled>
                    Integracao com eDocs - etapa futura
                  </button>
                </div>
              </form>

              <form style={{ display: 'grid', gap: 12 }} onSubmit={handleMinuta}>
                <label style={pageStyles.label}>
                  Minuta de despacho interno
                  <textarea style={{ ...pageStyles.textarea, minHeight: 260 }} value={minuta} onChange={(event) => setMinuta(event.target.value)} />
                </label>
                <div>
                  <button type="submit" style={pageStyles.buttonPrimary}>Salvar minuta</button>
                </div>
              </form>

              <div>
                <h3 style={pageStyles.sectionTitle}>Historico</h3>
                <div style={pageStyles.actions}>
                  {historico.map((item) => (
                    <span key={item.id}>
                      {badge(`${formatDate(item.criadoEm)} - ${item.acao} (${item.statusAnterior || '-'} -> ${item.statusNovo || '-'})`, 'neutral')}
                    </span>
                  ))}
                  {!historico.length ? badge('Sem historico', 'warn') : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
