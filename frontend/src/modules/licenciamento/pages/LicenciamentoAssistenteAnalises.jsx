import { useEffect, useMemo, useState } from 'react';
import {
  getLicenciamentoAssistenteAnalise,
  getLicenciamentoAssistenteAnaliseHistorico,
  getLicenciamentoAssistenteAnalises,
  converterLicenciamentoAssistenteAnalisePreRequerimento,
  updateLicenciamentoAssistenteAnaliseStatus,
  validarLicenciamentoAssistenteAnalise,
} from '../services/licenciamentoAdminApi';
import { formatDate, pageStyles, unpackListPayload } from './shared';

const STATUS_OPTIONS = [
  ['enviado', 'Enviado'],
  ['em_analise', 'Em analise'],
  ['aguardando_complementacao', 'Aguardando complementacao'],
  ['validado_para_prosseguimento', 'Validado para prosseguimento'],
  ['convertido_em_requerimento', 'Convertido em requerimento'],
  ['arquivado', 'Arquivado'],
  ['indeferido_preliminarmente', 'Indeferido preliminarmente'],
];

const DECISAO_OPTIONS = [
  ['confirmar_enquadramento', 'Confirmar enquadramento'],
  ['alterar_enquadramento', 'Alterar enquadramento'],
  ['solicitar_complementacao', 'Solicitar complementacao'],
  ['encaminhar_semob', 'Encaminhar para SEMOB'],
  ['encaminhar_fiscalizacao', 'Encaminhar para fiscalizacao'],
  ['prosseguir_requerimento', 'Prosseguir para requerimento'],
  ['arquivar', 'Arquivar'],
  ['indeferir_preliminarmente', 'Indeferir preliminarmente'],
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

function attentionTone(level) {
  if (level === 'alto') return 'danger';
  if (level === 'medio') return 'warn';
  return 'ok';
}

function JsonBlock({ title, value }) {
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{title}</p>
      <pre style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap', fontSize: 12, color: '#172033' }}>
        {JSON.stringify(value || {}, null, 2)}
      </pre>
    </div>
  );
}

function ListBlock({ title, items }) {
  return (
    <div style={pageStyles.cardMetric}>
      <p style={pageStyles.metricLabel}>{title}</p>
      {items?.length ? (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          {items.map((item) => <li key={String(item)}>{String(item)}</li>)}
        </ul>
      ) : (
        <p style={pageStyles.sectionSubtitle}>Nenhum item registrado.</p>
      )}
    </div>
  );
}

export default function LicenciamentoAssistenteAnalises({ navigateToPage }) {
  const [filters, setFilters] = useState({ status: '', nivelAtencao: '', busca: '' });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [detail, setDetail] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [conversao, setConversao] = useState({ loading: false, registro: null, erro: '' });
  const [validacao, setValidacao] = useState({
    decisaoValidacao: 'solicitar_complementacao',
    status: 'aguardando_complementacao',
    observacaoValidacao: '',
  });
  const [statusUpdate, setStatusUpdate] = useState('em_analise');

  async function loadList(nextFilters = filters) {
    setLoading(true);
    setMessage('');
    try {
      const response = await getLicenciamentoAssistenteAnalises(nextFilters);
      const unpacked = unpackListPayload(response.data);
      setItems(unpacked.items);
      setPagination(unpacked.pagination);
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel listar as pre-analises.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id) {
    setMessage('');
    try {
      const [detailResponse, historyResponse] = await Promise.all([
        getLicenciamentoAssistenteAnalise(id),
        getLicenciamentoAssistenteAnaliseHistorico(id),
      ]);
      setDetail(detailResponse.data);
      setHistorico(historyResponse.data || []);
      setConversao({ loading: false, registro: null, erro: '' });
      setStatusUpdate(detailResponse.data?.status || 'em_analise');
      setValidacao((current) => ({
        ...current,
        observacaoValidacao: detailResponse.data?.observacaoValidacao || '',
      }));
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel carregar a pre-analise.');
    }
  }

  useEffect(() => {
    loadList();
    // A primeira carga deve ocorrer apenas ao abrir a tela; os filtros sao aplicados pelo botao Filtrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumo = useMemo(() => {
    const total = pagination?.total ?? items.length;
    const altos = items.filter((item) => item.nivelAtencao === 'alto').length;
    const enviados = items.filter((item) => item.status === 'enviado').length;
    return { total, altos, enviados };
  }, [items, pagination]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function handleFilter(event) {
    event.preventDefault();
    await loadList(filters);
  }

  async function handleStatusUpdate(event) {
    event.preventDefault();
    if (!detail) return;
    try {
      await updateLicenciamentoAssistenteAnaliseStatus(detail.id, {
        status: statusUpdate,
        observacao: 'Atualizacao manual de status pela tela interna do assistente.',
      });
      await loadDetail(detail.id);
      await loadList(filters);
      setMessage('Status atualizado com sucesso.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel atualizar o status.');
    }
  }

  async function handleValidacao(event) {
    event.preventDefault();
    if (!detail) return;
    try {
      await validarLicenciamentoAssistenteAnalise(detail.id, validacao);
      await loadDetail(detail.id);
      await loadList(filters);
      setMessage('Validacao tecnica registrada com sucesso.');
    } catch (error) {
      setMessage(error.message || 'Nao foi possivel registrar a validacao.');
    }
  }

  async function handleConverterPreRequerimento() {
    if (!detail || conversao.loading) return;

    setConversao({ loading: true, registro: null, erro: '' });
    try {
      const response = await converterLicenciamentoAssistenteAnalisePreRequerimento(detail.id, {
        observacaoConversao: detail.status === 'enviado'
          ? 'Conversao realizada a partir de pre-analise ainda enviada, para conferencia documental e validacao tecnica interna.'
          : 'Analise convertida em pre-requerimento para conferencia documental e instrucao preliminar.',
        statusInicial: 'pre_requerimento_criado',
      });
      setConversao({ loading: false, registro: response.data, erro: '' });
      await loadDetail(detail.id);
      await loadList(filters);
      setMessage(`Pre-requerimento criado com sucesso: ${response.data.codigoPreRequerimento}.`);
    } catch (error) {
      setConversao({
        loading: false,
        registro: null,
        erro: error.message || 'Nao foi possivel converter a pre-analise em pre-requerimento.',
      });
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <h1 style={pageStyles.sectionTitle}>Analises do Assistente de Enquadramento Ambiental</h1>
        <p style={pageStyles.sectionSubtitle}>
          Pre-analises enviadas pelo modulo publico para validacao tecnica da SMAD. Esta tela nao emite licenca,
          dispensa, autorizacao, DAM, cobranca oficial ou decisao administrativa automatica.
        </p>
      </section>

      {message ? <div style={pageStyles.message}>{message}</div> : null}

      <section style={pageStyles.grid3}>
        <div style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Pre-analises</p>
          <p style={pageStyles.metricValue}>{resumo.total}</p>
        </div>
        <div style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Nivel alto na lista</p>
          <p style={pageStyles.metricValue}>{resumo.altos}</p>
        </div>
        <div style={pageStyles.cardMetric}>
          <p style={pageStyles.metricLabel}>Aguardando primeira leitura</p>
          <p style={pageStyles.metricValue}>{resumo.enviados}</p>
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
            Nivel de atencao
            <select style={pageStyles.input} value={filters.nivelAtencao} onChange={(event) => updateFilter('nivelAtencao', event.target.value)}>
              <option value="">Todos</option>
              <option value="baixo">Baixo</option>
              <option value="medio">Medio</option>
              <option value="alto">Alto</option>
            </select>
          </label>
          <label style={pageStyles.label}>
            Busca
            <input style={pageStyles.input} value={filters.busca} onChange={(event) => updateFilter('busca', event.target.value)} placeholder="Codigo, nome, descricao ou atividade" />
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="submit" style={pageStyles.buttonPrimary}>Filtrar</button>
          </div>
        </form>
      </section>

      <section style={pageStyles.grid2}>
        <div style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Pre-analises recebidas</h2>
          {loading ? <p style={pageStyles.sectionSubtitle}>Carregando...</p> : null}
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Codigo</th>
                  <th style={pageStyles.th}>Data</th>
                  <th style={pageStyles.th}>Interessado</th>
                  <th style={pageStyles.th}>Atividade provavel</th>
                  <th style={pageStyles.th}>Nivel</th>
                  <th style={pageStyles.th}>Status</th>
                  <th style={pageStyles.th}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={pageStyles.td}>{item.codigoPreliminar}</td>
                    <td style={pageStyles.td}>{formatDate(item.criadoEm)}</td>
                    <td style={pageStyles.td}>{item.nomeInteressado || '-'}</td>
                    <td style={pageStyles.td}>
                      <strong>{item.atividadeProvavel}</strong>
                      <p style={pageStyles.sectionSubtitle}>{item.descricaoOriginal}</p>
                    </td>
                    <td style={pageStyles.td}>{badge(item.nivelAtencao, attentionTone(item.nivelAtencao))}</td>
                    <td style={pageStyles.td}>{badge(item.status, item.status === 'enviado' ? 'warn' : 'neutral')}</td>
                    <td style={pageStyles.td}>
                      <button type="button" style={pageStyles.buttonSecondary} onClick={() => loadDetail(item.id)}>
                        Visualizar
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td style={pageStyles.td} colSpan={7}>Nenhuma pre-analise encontrada.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Detalhe e validacao tecnica</h2>
          {!detail ? (
            <p style={pageStyles.sectionSubtitle}>Selecione uma pre-analise para revisar respostas, pendencias, checklist e historico.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={pageStyles.actions}>
                  {badge(detail.codigoPreliminar, 'neutral')}
                  {badge(detail.nivelAtencao, attentionTone(detail.nivelAtencao))}
                  {badge(detail.status, 'neutral')}
                </div>
                <h3 style={{ ...pageStyles.sectionTitle, marginTop: 14 }}>{detail.atividadeProvavel}</h3>
                <p style={pageStyles.sectionSubtitle}>{detail.descricaoOriginal}</p>
                <p style={pageStyles.sectionSubtitle}>Perfil: {detail.perfilUsuario} | Confianca simulada: {detail.confianca ?? '-'}</p>
              </div>

              <div style={pageStyles.grid2}>
                <ListBlock title="Palavras-chave" items={detail.palavrasChaveDetectadas} />
                <ListBlock title="Pendencias" items={detail.pendencias} />
                <ListBlock title="Checklist documental" items={detail.checklistDocumental} />
                <JsonBlock title="Respostas do SID dinamico" value={detail.respostasFormulario} />
              </div>

              <div style={pageStyles.grid2}>
                <div style={pageStyles.cardMetric}>
                  <p style={pageStyles.metricLabel}>Resumo cidadao</p>
                  <p style={pageStyles.sectionSubtitle}>{detail.resumoCidadao}</p>
                </div>
                <div style={pageStyles.cardMetric}>
                  <p style={pageStyles.metricLabel}>Resumo tecnico</p>
                  <p style={pageStyles.sectionSubtitle}>{detail.resumoTecnico}</p>
                </div>
              </div>

              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Recomendacao de tramitacao</p>
                <p style={pageStyles.sectionSubtitle}>{detail.recomendacaoTramitacao}</p>
              </div>

              <div style={pageStyles.cardMetric}>
                <p style={pageStyles.metricLabel}>Pre-requerimento ambiental instruido</p>
                <p style={pageStyles.sectionSubtitle}>
                  Converta esta pre-analise em um registro administrativo preliminar para conferencia documental,
                  SID digital, minuta interna e historico. Nao gera protocolo oficial, eDocs, DAM ou ato autorizativo.
                </p>
                {detail.status === 'enviado' ? (
                  <div style={{ ...pageStyles.message, marginTop: 10 }}>
                    A analise ainda esta com status enviado. A conversao sera registrada como instrucao preliminar e ainda exigira validacao tecnica.
                  </div>
                ) : null}
                <div style={pageStyles.actions}>
                  <button
                    type="button"
                    style={pageStyles.buttonPrimary}
                    onClick={handleConverterPreRequerimento}
                    disabled={conversao.loading || detail.status === 'convertido_em_requerimento'}
                  >
                    {conversao.loading ? 'Convertendo...' : 'Converter em pre-requerimento'}
                  </button>
                  {conversao.registro ? (
                    <button type="button" style={pageStyles.buttonSecondary} onClick={() => navigateToPage?.('preRequerimentos')}>
                      Abrir Pre-Requerimentos
                    </button>
                  ) : null}
                </div>
                {conversao.registro ? (
                  <p style={pageStyles.sectionSubtitle}>
                    Pre-requerimento criado: {conversao.registro.codigoPreRequerimento}.
                  </p>
                ) : null}
                {conversao.erro ? <div style={{ ...pageStyles.message, marginTop: 10 }}>{conversao.erro}</div> : null}
              </div>

              <form style={pageStyles.formGrid} onSubmit={handleStatusUpdate}>
                <label style={pageStyles.label}>
                  Atualizar status
                  <select style={pageStyles.input} value={statusUpdate} onChange={(event) => setStatusUpdate(event.target.value)}>
                    {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <button type="submit" style={pageStyles.buttonSecondary}>Salvar status</button>
                </div>
              </form>

              <form style={{ display: 'grid', gap: 14 }} onSubmit={handleValidacao}>
                <div style={pageStyles.formGrid}>
                  <label style={pageStyles.label}>
                    Decisao de validacao
                    <select style={pageStyles.input} value={validacao.decisaoValidacao} onChange={(event) => setValidacao((current) => ({ ...current, decisaoValidacao: event.target.value }))}>
                      {DECISAO_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label style={pageStyles.label}>
                    Status resultante
                    <select style={pageStyles.input} value={validacao.status} onChange={(event) => setValidacao((current) => ({ ...current, status: event.target.value }))}>
                      {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
                <label style={pageStyles.label}>
                  Observacao tecnica
                  <textarea
                    style={pageStyles.textarea}
                    value={validacao.observacaoValidacao}
                    onChange={(event) => setValidacao((current) => ({ ...current, observacaoValidacao: event.target.value }))}
                    placeholder="Registre a justificativa tecnica, pendencias ou encaminhamento."
                  />
                </label>
                <div>
                  <button type="submit" style={pageStyles.buttonPrimary}>Registrar validacao tecnica</button>
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
