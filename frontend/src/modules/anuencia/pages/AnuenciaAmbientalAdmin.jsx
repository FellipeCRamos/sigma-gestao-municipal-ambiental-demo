import { useCallback, useEffect, useState } from 'react';
import GeoLocationField from '../../../core/components/GeoLocationField';
import { listGeoLocalizacoes } from '../../../core/api/geoambientalApi';
import {
  addAnuenciaAnalise,
  addAnuenciaCondicionante,
  addAnuenciaDecisao,
  addAnuenciaDocumento,
  addAnuenciaInteressado,
  addAnuenciaPendencia,
  conferirAnuenciaDocumento,
  createAnuencia,
  emitirAnuencia,
  getAnuencia,
  getAnuenciaDashboard,
  listAnuenciaAnalises,
  listAnuenciaCondicionantes,
  listAnuenciaDocumentos,
  listAnuenciaHistorico,
  listAnuenciaInteressados,
  listAnuencias,
  updateAnuencia,
  updateAnuenciaPendencia,
} from '../services/anuenciaApi';

const EMPTY_FORM = {
  tipo_anuencia: 'ANUENCIA_LOCALIZACAO',
  finalidade: '',
  descricao_solicitacao: '',
  numero_processo: '',
  numero_protocolo: '',
  status: 'RASCUNHO',
  prioridade: 'NORMAL',
  geo_localizacao_id: '',
  justificativa_ausencia_geo: '',
  distrito: '',
  bairro_localidade: '',
  zona_urbana_rural: 'NAO_INFORMADA',
  fundamentacao_preliminar: '',
  observacoes_internas: '',
};

const TABS = ['Dados Gerais', 'Interessado', 'Localização Geoambiental', 'Documentos', 'Análise Técnica', 'Pendências', 'Condicionantes', 'Decisão', 'Emissão', 'Histórico'];

function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

function compactError(error) {
  return error?.message || 'Nao foi possivel concluir a operacao.';
}

function MiniForm({ children, onSubmit, button, disabled }) {
  return (
    <form style={styles.miniForm} onSubmit={onSubmit}>
      {children}
      <button type="submit" style={styles.secondaryButton} disabled={disabled}>{button}</button>
    </form>
  );
}

export default function AnuenciaAmbientalAdmin() {
  const [dashboard, setDashboard] = useState(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [geoOptions, setGeoOptions] = useState([]);
  const [tab, setTab] = useState(TABS[0]);
  const [filters, setFilters] = useState({ status: '', tipo_anuencia: '', distrito: '', processo: '', protocolo: '', interessado: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [related, setRelated] = useState({ interessados: [], documentos: [], analises: [], pendencias: [], condicionantes: [], historico: [] });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, list, geos] = await Promise.all([
        getAnuenciaDashboard(),
        listAnuencias(filters),
        listGeoLocalizacoes({ limit: 100 }),
      ]);
      setDashboard(dash.data);
      setItems(Array.isArray(list.data) ? list.data : []);
      setGeoOptions(Array.isArray(geos.data) ? geos.data : []);
    } catch (err) {
      setError(compactError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  async function loadRelated(id) {
    const [interessados, documentos, analises, condicionantes, historico] = await Promise.all([
      listAnuenciaInteressados(id),
      listAnuenciaDocumentos(id),
      listAnuenciaAnalises(id),
      listAnuenciaCondicionantes(id),
      listAnuenciaHistorico(id),
    ]);
    setRelated({
      interessados: interessados.data || [],
      documentos: documentos.data || [],
      analises: analises.data || [],
      pendencias: (historico.data || []).filter((item) => item.tipo_evento?.includes('pendencia')),
      condicionantes: condicionantes.data || [],
      historico: historico.data || [],
    });
  }

  async function openItem(item) {
    setError('');
    setMessage('');
    const response = await getAnuencia(item.id);
    setSelected(response.data);
    setForm({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(response.data || {}).map(([key, value]) => [key, value ?? ''])) });
    await loadRelated(item.id);
  }

  function startNew() {
    setSelected(null);
    setForm(EMPTY_FORM);
    setRelated({ interessados: [], documentos: [], analises: [], pendencias: [], condicionantes: [], historico: [] });
    setTab(TABS[0]);
  }

  async function saveGeneral(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const payload = { ...form, geo_localizacao_id: form.geo_localizacao_id || null };
      const response = selected?.id ? await updateAnuencia(selected.id, payload) : await createAnuencia(payload);
      setSelected(response.data);
      setMessage(selected?.id ? 'Anuencia atualizada.' : 'Anuencia criada.');
      await loadList();
      await loadRelated(response.data.id);
    } catch (err) {
      setError(compactError(err));
    }
  }

  async function submitAndReload(action, success) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await loadRelated(selected.id);
      await openItem(selected);
    } catch (err) {
      setError(compactError(err));
    }
  }

  useEffect(() => {
    loadList();
  }, [loadList]);

  const selectedGeo = geoOptions.find((item) => Number(item.id) === Number(form.geo_localizacao_id)) || selected?.geo_localizacao;

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Anuencia Ambiental Municipal</h2>
            <p style={styles.subtitle}>Modulo interno em homologacao assistida. A analise geoambiental possui carater preliminar e nao substitui a avaliacao tecnica do corpo tecnico da SMAD.</p>
          </div>
          <button type="button" style={styles.primaryButton} onClick={startNew}>Nova anuencia</button>
        </div>
        <div style={styles.cards}>
          {[
            ['Total', dashboard?.total || 0],
            ['Pendentes', dashboard?.pendentes || 0],
            ['Em analise', dashboard?.em_analise_tecnica || 0],
            ['Deferidas', dashboard?.deferidas || 0],
            ['Condicionadas', dashboard?.deferidas_com_condicionantes || 0],
            ['Indeferidas', dashboard?.indeferidas || 0],
          ].map(([name, value]) => (
            <div key={name} style={styles.card}><span>{name}</span><strong>{value}</strong></div>
          ))}
        </div>
        <form style={styles.filters} onSubmit={(event) => { event.preventDefault(); loadList(); }}>
          <input style={styles.input} placeholder="Processo" value={filters.processo} onChange={(event) => setFilters((prev) => ({ ...prev, processo: event.target.value }))} />
          <input style={styles.input} placeholder="Protocolo" value={filters.protocolo} onChange={(event) => setFilters((prev) => ({ ...prev, protocolo: event.target.value }))} />
          <input style={styles.input} placeholder="Distrito" value={filters.distrito} onChange={(event) => setFilters((prev) => ({ ...prev, distrito: event.target.value }))} />
          <input style={styles.input} placeholder="Interessado" value={filters.interessado} onChange={(event) => setFilters((prev) => ({ ...prev, interessado: event.target.value }))} />
          <select style={styles.input} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">Status</option>
            {['RASCUNHO','PROTOCOLADA','EM_TRIAGEM','AGUARDANDO_COMPLEMENTACAO','EM_ANALISE_TECNICA','AGUARDANDO_DECISAO','DEFERIDA','DEFERIDA_COM_CONDICIONANTES','INDEFERIDA','ARQUIVADA'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
          </select>
          <button type="submit" style={styles.secondaryButton}>Filtrar</button>
        </form>
        {error ? <div style={styles.alertError}>{error}</div> : null}
        {message ? <div style={styles.alertInfo}>{message}</div> : null}
      </section>

      <section style={styles.grid}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Anuencias</h3>
          {loading ? <p style={styles.subtitle}>Carregando...</p> : null}
          <div style={styles.list}>
            {items.map((item) => (
              <button type="button" key={item.id} style={styles.listItem} onClick={() => openItem(item)}>
                <strong>{item.codigo}</strong>
                <span>{item.finalidade}</span>
                <small>{label(item.status)} - {label(item.tipo_anuencia)}</small>
              </button>
            ))}
            {!items.length && !loading ? <p style={styles.subtitle}>Nenhuma anuencia cadastrada.</p> : null}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.tabs}>
            {TABS.map((item) => <button key={item} type="button" style={tab === item ? styles.tabActive : styles.tab} onClick={() => setTab(item)}>{item}</button>)}
          </div>

          {tab === 'Dados Gerais' ? (
            <form style={styles.form} onSubmit={saveGeneral}>
              <div style={styles.twoCols}>
                <select style={styles.input} value={form.tipo_anuencia} onChange={(event) => setForm((prev) => ({ ...prev, tipo_anuencia: event.target.value }))}>
                  {['ANUENCIA_LOCALIZACAO','ANUENCIA_OBRA_INTERVENCAO','ANUENCIA_INFRAESTRUTURA','ANUENCIA_SANEAMENTO','ANUENCIA_DRENAGEM','ANUENCIA_ORGAO_EXTERNO','ANUENCIA_USO_AREA','ANUENCIA_REGULARIZACAO','ANUENCIA_OUTRA'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
                <select style={styles.input} value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                  {['RASCUNHO','PROTOCOLADA','EM_TRIAGEM','AGUARDANDO_COMPLEMENTACAO','EM_ANALISE_TECNICA','MINUTA_EM_ELABORACAO','AGUARDANDO_DECISAO','DEFERIDA','DEFERIDA_COM_CONDICIONANTES','INDEFERIDA','ARQUIVADA','CANCELADA','SUBSTITUIDA'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
              </div>
              <input style={styles.input} placeholder="Finalidade" value={form.finalidade} onChange={(event) => setForm((prev) => ({ ...prev, finalidade: event.target.value }))} required />
              <div style={styles.twoCols}>
                <input style={styles.input} placeholder="Numero do processo" value={form.numero_processo} onChange={(event) => setForm((prev) => ({ ...prev, numero_processo: event.target.value }))} />
                <input style={styles.input} placeholder="Numero do protocolo" value={form.numero_protocolo} onChange={(event) => setForm((prev) => ({ ...prev, numero_protocolo: event.target.value }))} />
              </div>
              <textarea style={styles.textarea} placeholder="Descricao da solicitacao" value={form.descricao_solicitacao} onChange={(event) => setForm((prev) => ({ ...prev, descricao_solicitacao: event.target.value }))} />
              <div style={styles.twoCols}>
                <input style={styles.input} placeholder="Distrito" value={form.distrito} onChange={(event) => setForm((prev) => ({ ...prev, distrito: event.target.value }))} />
                <input style={styles.input} placeholder="Bairro/localidade" value={form.bairro_localidade} onChange={(event) => setForm((prev) => ({ ...prev, bairro_localidade: event.target.value }))} />
              </div>
              <textarea style={styles.textarea} placeholder="Fundamentacao preliminar" value={form.fundamentacao_preliminar} onChange={(event) => setForm((prev) => ({ ...prev, fundamentacao_preliminar: event.target.value }))} />
              <button type="submit" style={styles.primaryButton}>Salvar dados gerais</button>
            </form>
          ) : null}

          {tab === 'Interessado' && selected ? (
            <MiniForm button="Adicionar interessado" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              submitAndReload(() => addAnuenciaInteressado(selected.id, Object.fromEntries(data)), 'Interessado registrado.');
              event.currentTarget.reset();
            }}>
              <input name="nome_razao_social" style={styles.input} placeholder="Nome ou razao social" required />
              <input name="documento_mascarado" style={styles.input} placeholder="Documento mascarado" />
              <input name="email" style={styles.input} placeholder="E-mail" />
              <List items={related.interessados} render={(item) => `${item.nome_razao_social} - ${item.documento_mascarado || 'sem documento'}`} />
            </MiniForm>
          ) : null}

          {tab === 'Localização Geoambiental' ? (
            <form style={styles.form} onSubmit={saveGeneral}>
              <GeoLocationField value={selectedGeo} helperText="A analise geoambiental e preliminar/interna e nao substitui a avaliacao tecnica." />
              <select style={styles.input} value={form.geo_localizacao_id} onChange={(event) => setForm((prev) => ({ ...prev, geo_localizacao_id: event.target.value }))}>
                <option value="">Selecionar localizacao geoambiental</option>
                {geoOptions.map((item) => <option key={item.id} value={item.id}>{item.codigo} - {item.titulo}</option>)}
              </select>
              <textarea style={styles.textarea} placeholder="Justificativa tecnica de ausencia de localizacao" value={form.justificativa_ausencia_geo} onChange={(event) => setForm((prev) => ({ ...prev, justificativa_ausencia_geo: event.target.value }))} />
              <button type="submit" style={styles.primaryButton} disabled={!selected}>Vincular localizacao</button>
            </form>
          ) : null}

          {tab === 'Documentos' && selected ? <Documents selected={selected} related={related} submitAndReload={submitAndReload} /> : null}
          {tab === 'Análise Técnica' && selected ? <Analise selected={selected} related={related} submitAndReload={submitAndReload} /> : null}
          {tab === 'Pendências' && selected ? <Pendencias selected={selected} related={related} submitAndReload={submitAndReload} /> : null}
          {tab === 'Condicionantes' && selected ? <Condicionantes selected={selected} related={related} submitAndReload={submitAndReload} /> : null}
          {tab === 'Decisão' && selected ? <Decisao selected={selected} submitAndReload={submitAndReload} /> : null}
          {tab === 'Emissão' && selected ? <Emissao selected={selected} submitAndReload={submitAndReload} /> : null}
          {tab === 'Histórico' && selected ? <List items={related.historico} render={(item) => `${label(item.tipo_evento)} - ${item.descricao}`} /> : null}
          {!selected && tab !== 'Dados Gerais' ? <p style={styles.subtitle}>Selecione ou crie uma anuencia para acessar esta aba.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Documents({ selected, related, submitAndReload }) {
  return <MiniForm button="Registrar documento" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); submitAndReload(() => addAnuenciaDocumento(selected.id, data), 'Documento registrado.'); event.currentTarget.reset(); }}>
    <input name="tipo_documento" style={styles.input} placeholder="Tipo de documento" required />
    <input name="referencia_documental" style={styles.input} placeholder="Referencia documental interna" />
    <textarea name="descricao" style={styles.textarea} placeholder="Descricao" />
    <List items={related.documentos} render={(item) => `${item.tipo_documento} - ${label(item.status_conferencia)}`} action={(item) => <button type="button" style={styles.smallButton} onClick={() => submitAndReload(() => conferirAnuenciaDocumento(selected.id, item.id, { status_conferencia: 'CONFERIDO' }), 'Documento conferido.')}>Conferir</button>} />
  </MiniForm>;
}

function Analise({ selected, related, submitAndReload }) {
  return <MiniForm button="Registrar analise" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); submitAndReload(() => addAnuenciaAnalise(selected.id, data), 'Analise tecnica registrada.'); event.currentTarget.reset(); }}>
    <textarea name="parecer_resumido" style={styles.textarea} placeholder="Parecer resumido" required />
    <textarea name="fundamentacao_tecnica" style={styles.textarea} placeholder="Fundamentacao tecnica" required />
    <select name="conclusao_tecnica" style={styles.input}><option value="FAVORAVEL">Favoravel</option><option value="FAVORAVEL_COM_CONDICIONANTES">Favoravel com condicionantes</option><option value="DESFAVORAVEL">Desfavoravel</option><option value="NECESSITA_COMPLEMENTACAO">Necessita complementacao</option></select>
    <List items={related.analises} render={(item) => `${label(item.conclusao_tecnica)} - ${item.parecer_resumido}`} />
  </MiniForm>;
}

function Pendencias({ selected, related, submitAndReload }) {
  return <MiniForm button="Criar pendencia" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); submitAndReload(() => addAnuenciaPendencia(selected.id, data), 'Pendencia registrada.'); event.currentTarget.reset(); }}>
    <textarea name="descricao" style={styles.textarea} placeholder="Descricao da pendencia" required />
    <List items={related.historico.filter((item) => item.tipo_evento?.includes('pendencia'))} render={(item) => item.descricao} action={(item) => item.dados?.pendencia_id ? <button type="button" style={styles.smallButton} onClick={() => submitAndReload(() => updateAnuenciaPendencia(selected.id, item.dados.pendencia_id, { status: 'RESOLVIDA', resposta: 'Resolvida em homologacao assistida.' }), 'Pendencia resolvida.')}>Resolver</button> : null} />
  </MiniForm>;
}

function Condicionantes({ selected, related, submitAndReload }) {
  return <MiniForm button="Adicionar condicionante" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); submitAndReload(() => addAnuenciaCondicionante(selected.id, data), 'Condicionante registrada.'); event.currentTarget.reset(); }}>
    <textarea name="descricao" style={styles.textarea} placeholder="Descricao da condicionante" required />
    <input name="prazo" style={styles.input} placeholder="Prazo" />
    <List items={related.condicionantes} render={(item) => `${item.descricao} - ${item.prazo || 'sem prazo'}`} />
  </MiniForm>;
}

function Decisao({ selected, submitAndReload }) {
  return <MiniForm button="Registrar decisao" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); submitAndReload(() => addAnuenciaDecisao(selected.id, data), 'Decisao registrada.'); }}>
    <select name="decisao" style={styles.input}><option value="DEFERIDA">Deferida</option><option value="DEFERIDA_COM_CONDICIONANTES">Deferida com condicionantes</option><option value="INDEFERIDA">Indeferida</option><option value="ARQUIVADA">Arquivada</option></select>
    <textarea name="fundamentacao_decisao" style={styles.textarea} placeholder="Fundamentacao da decisao" required />
    <input name="autoridade_responsavel" style={styles.input} placeholder="Autoridade responsavel" required />
  </MiniForm>;
}

function Emissao({ selected, submitAndReload }) {
  const [texto, setTexto] = useState('');
  return <MiniForm button="Gerar emissao textual interna" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); submitAndReload(async () => { const response = await emitirAnuencia(selected.id, data); setTexto(response.data.texto_emissao); }, 'Emissao textual interna registrada.'); }}>
    <input name="autoridade_responsavel" style={styles.input} placeholder="Autoridade responsavel" />
    {texto ? <pre style={styles.pre}>{texto}</pre> : <p style={styles.subtitle}>Nao gera PDF assinado nesta sprint.</p>}
  </MiniForm>;
}

function List({ items = [], render, action }) {
  return <div style={styles.list}>{items.length ? items.map((item) => <div key={item.id} style={styles.listBox}><span>{render(item)}</span>{action?.(item)}</div>) : <p style={styles.subtitle}>Sem registros.</p>}</div>;
}

const styles = {
  page: { display: 'grid', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #d8efe9', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '16px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#134e4a' },
  sectionTitle: { margin: '0 0 12px', fontSize: '18px', color: '#134e4a' },
  subtitle: { margin: 0, color: '#475569', lineHeight: 1.5, fontSize: '14px' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(110px, 1fr))', gap: '10px', marginBottom: '16px' },
  card: { display: 'grid', gap: '6px', border: '1px solid #ccfbf1', borderRadius: '8px', background: '#f0fdfa', padding: '12px', color: '#134e4a' },
  filters: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(110px, 1fr))', gap: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(300px, 0.85fr) minmax(520px, 1.3fr)', gap: '24px', alignItems: 'start' },
  list: { display: 'grid', gap: '10px', marginTop: '12px' },
  listItem: { display: 'grid', gap: '4px', textAlign: 'left', border: '1px solid #d8efe9', borderRadius: '8px', background: '#f8fffd', padding: '12px', color: '#134e4a', cursor: 'pointer' },
  listBox: { display: 'flex', justifyContent: 'space-between', gap: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', color: '#334155' },
  form: { display: 'grid', gap: '12px' },
  miniForm: { display: 'grid', gap: '12px', marginTop: '14px' },
  tabs: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
  tab: { border: '1px solid #99f6e4', borderRadius: '8px', background: '#ffffff', color: '#0f766e', padding: '8px 10px', cursor: 'pointer', fontWeight: 700 },
  tabActive: { border: '1px solid #0f766e', borderRadius: '8px', background: '#0f766e', color: '#ffffff', padding: '8px 10px', cursor: 'pointer', fontWeight: 800 },
  input: { minHeight: '42px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', color: '#0f172a', background: '#ffffff' },
  textarea: { minHeight: '90px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', color: '#0f172a', background: '#ffffff', resize: 'vertical' },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  primaryButton: { minHeight: '42px', border: 'none', borderRadius: '8px', background: '#0f766e', color: '#ffffff', cursor: 'pointer', fontWeight: 800, padding: '0 14px' },
  secondaryButton: { minHeight: '42px', border: '1px solid #0f766e', borderRadius: '8px', background: '#ffffff', color: '#0f766e', cursor: 'pointer', fontWeight: 800, padding: '0 14px' },
  smallButton: { border: '1px solid #0f766e', borderRadius: '8px', background: '#ffffff', color: '#0f766e', cursor: 'pointer', fontWeight: 800, padding: '6px 10px' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', marginTop: '12px' },
  alertInfo: { border: '1px solid #99f6e4', borderRadius: '8px', background: '#f0fdfa', color: '#115e59', padding: '12px', marginTop: '12px' },
  pre: { whiteSpace: 'pre-wrap', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', background: '#f8fafc', color: '#0f172a' },
};
