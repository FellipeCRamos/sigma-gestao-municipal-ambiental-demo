import { useCallback, useEffect, useState } from 'react';
import RequerenteLinhaTempo from '../components/RequerenteLinhaTempo';
import RequerenteStatusBadge from '../components/RequerenteStatusBadge';
import {
  aceitarPortalRequerentePreProtocolo,
  createPortalRequerenteAdminRequerente,
  devolverPortalRequerentePreProtocolo,
  getPortalRequerenteAdminDashboard,
  getPortalRequerenteAdminPreProtocolo,
  listPortalRequerenteAdminPreProtocolos,
  listPortalRequerenteAdminRequerentes,
  recusarPortalRequerentePreProtocolo,
  triarPortalRequerentePreProtocolo,
} from '../services/portalRequerenteApi';

const EMPTY_REQUERENTE = {
  tipo_pessoa: 'FISICA',
  nome_razao_social: '',
  cpf_cnpj: '',
  email_principal: '',
  telefone: '',
  municipio: 'MunicipioDemo',
  uf: 'ES',
  status: 'ATIVO',
  senha: '',
};

function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

function compactError(error) {
  return error?.message || 'Nao foi possivel concluir a operacao.';
}

export default function PortalRequerenteAdmin() {
  const [dashboard, setDashboard] = useState(null);
  const [items, setItems] = useState([]);
  const [requerentes, setRequerentes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ status: '', tipo_solicitacao: '', distrito: '', requerente: '' });
  const [form, setForm] = useState(EMPTY_REQUERENTE);
  const [devolucao, setDevolucao] = useState('');
  const [recusa, setRecusa] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, list, reqs] = await Promise.all([
        getPortalRequerenteAdminDashboard(),
        listPortalRequerenteAdminPreProtocolos(filters),
        listPortalRequerenteAdminRequerentes({ limit: 20 }),
      ]);
      setDashboard(dash.data);
      setItems(Array.isArray(list.data) ? list.data : []);
      setRequerentes(Array.isArray(reqs.data) ? reqs.data : []);
    } catch (err) {
      setError(compactError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function openItem(item) {
    setError('');
    setMessage('');
    try {
      const response = await getPortalRequerenteAdminPreProtocolo(item.id);
      setSelected(response.data);
    } catch (err) {
      setError(compactError(err));
    }
  }

  async function reloadSelected(id = selected?.id) {
    if (!id) return;
    const response = await getPortalRequerenteAdminPreProtocolo(id);
    setSelected(response.data);
    await load();
  }

  async function submitRequerente(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await createPortalRequerenteAdminRequerente({
        ...form,
        usuario: {
          nome: form.nome_razao_social,
          email: form.email_principal,
          senha: form.senha || 'PortalRequerente2026',
          tipo_usuario: 'REQUERENTE',
          status: 'ATIVO',
        },
      });
      setMessage('Requerente cadastrado.');
      setForm(EMPTY_REQUERENTE);
      await load();
    } catch (err) {
      setError(compactError(err));
    }
  }

  async function runAction(action, success) {
    if (!selected) return;
    setError('');
    setMessage('');
    try {
      await action(selected.id);
      setMessage(success);
      await reloadSelected(selected.id);
    } catch (err) {
      setError(compactError(err));
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Portal do Requerente</h2>
            <p style={styles.subtitle}>Painel interno de homologacao assistida para pre-protocolos externos controlados.</p>
          </div>
        </div>
        <div style={styles.notice}>O portal nao e consulta publica. O aceite interno pode gerar registro de Anuencia Ambiental, sem decisao ou emissao automatica.</div>
        <div style={styles.cards}>
          <Card label="Requerentes" value={dashboard?.total_requerentes || 0} />
          <Card label="Pre-protocolos" value={dashboard?.total_pre_protocolos || 0} />
          <Card label="Pendentes" value={dashboard?.pendentes_triagem || 0} />
          <Card label="Devolvidos" value={dashboard?.devolvidos_complementacao || 0} />
          <Card label="Aceitos" value={dashboard?.aceitos || 0} />
          <Card label="Recusados" value={dashboard?.recusados || 0} />
        </div>
        <form style={styles.filters} onSubmit={(event) => { event.preventDefault(); load(); }}>
          <input style={styles.input} placeholder="Requerente" value={filters.requerente} onChange={(event) => setFilters((prev) => ({ ...prev, requerente: event.target.value }))} />
          <input style={styles.input} placeholder="Distrito" value={filters.distrito} onChange={(event) => setFilters((prev) => ({ ...prev, distrito: event.target.value }))} />
          <select style={styles.input} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">Status</option>
            {['RECEBIDO_PENDENTE_TRIAGEM','EM_TRIAGEM_SMAD','DEVOLVIDO_PARA_COMPLEMENTACAO','COMPLEMENTADO','ACEITO_GEROU_PROCESSO_INTERNO','RECUSADO_FUNDAMENTADO','ARQUIVADO'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
          </select>
          <select style={styles.input} value={filters.tipo_solicitacao} onChange={(event) => setFilters((prev) => ({ ...prev, tipo_solicitacao: event.target.value }))}>
            <option value="">Tipo</option>
            <option value="ANUENCIA_AMBIENTAL">Anuencia Ambiental</option>
            <option value="LICENCIAMENTO_AMBIENTAL">Licenciamento Ambiental</option>
            <option value="OUTRA_SOLICITACAO">Outra solicitacao</option>
          </select>
          <button type="submit" style={styles.secondaryButton}>Filtrar</button>
        </form>
        {error ? <div style={styles.error}>{error}</div> : null}
        {message ? <div style={styles.success}>{message}</div> : null}
      </section>

      <section style={styles.grid}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Pre-protocolos</h3>
          {loading ? <p style={styles.subtitle}>Carregando...</p> : null}
          <div style={styles.list}>
            {items.map((item) => (
              <button type="button" key={item.id} style={styles.listItem} onClick={() => openItem(item)}>
                <span style={styles.listTop}><strong>{item.codigo}</strong><RequerenteStatusBadge status={item.status} /></span>
                <span>{item.finalidade}</span>
                <small>{item.requerente_nome} - {label(item.tipo_solicitacao)}</small>
              </button>
            ))}
            {!items.length && !loading ? <p style={styles.subtitle}>Nenhum pre-protocolo encontrado.</p> : null}
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Detalhe e triagem</h3>
          {selected ? (
            <div style={styles.detail}>
              <div style={styles.detailHeader}>
                <div>
                  <strong>{selected.codigo}</strong>
                  <p>{selected.finalidade}</p>
                </div>
                <RequerenteStatusBadge status={selected.status} />
              </div>
              <div style={styles.infoGrid}>
                <Info label="Requerente" value={selected.requerente_nome} />
                <Info label="Tipo" value={label(selected.tipo_solicitacao)} />
                <Info label="Distrito" value={selected.distrito || '-'} />
                <Info label="Geo" value={selected.geo_localizacao_id ? `GEO #${selected.geo_localizacao_id}` : '-'} />
                <Info label="Anuencia gerada" value={selected.anuencia_id ? `#${selected.anuencia_id}` : 'Nao gerada'} />
                <Info label="Processo" value={selected.numero_processo_gerado || '-'} />
              </div>
              <div style={styles.actions}>
                <button type="button" style={styles.secondaryButton} onClick={() => runAction((id) => triarPortalRequerentePreProtocolo(id), 'Pre-protocolo em triagem.')}>Triar</button>
                <button type="button" style={styles.primaryButton} onClick={() => runAction((id) => aceitarPortalRequerentePreProtocolo(id), 'Pre-protocolo aceito e anuencia gerada.')}>Aceitar e gerar Anuencia</button>
              </div>
              <form style={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); runAction((id) => devolverPortalRequerentePreProtocolo(id, { descricao: devolucao }), 'Pre-protocolo devolvido.'); setDevolucao(''); }}>
                <input style={styles.input} placeholder="Descricao da pendencia" value={devolucao} onChange={(event) => setDevolucao(event.target.value)} required />
                <button type="submit" style={styles.secondaryButton}>Devolver</button>
              </form>
              <form style={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); runAction((id) => recusarPortalRequerentePreProtocolo(id, { fundamentacao: recusa }), 'Pre-protocolo recusado.'); setRecusa(''); }}>
                <input style={styles.input} placeholder="Fundamentacao da recusa" value={recusa} onChange={(event) => setRecusa(event.target.value)} required />
                <button type="submit" style={styles.dangerButton}>Recusar</button>
              </form>
              <h4 style={styles.smallTitle}>Documentos</h4>
              {(selected.documentos || []).map((doc) => (
                <div key={doc.id} style={styles.document}>{doc.tipo_documento} - {doc.nome_original}</div>
              ))}
              <h4 style={styles.smallTitle}>Historico</h4>
              <RequerenteLinhaTempo historico={selected.historico || []} />
            </div>
          ) : (
            <p style={styles.subtitle}>Selecione um pre-protocolo para triar.</p>
          )}
        </div>
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Cadastro controlado de requerente</h3>
        <form style={styles.requerenteForm} onSubmit={submitRequerente}>
          <input style={styles.input} placeholder="Nome/razao social" value={form.nome_razao_social} onChange={(event) => setForm((prev) => ({ ...prev, nome_razao_social: event.target.value }))} required />
          <input style={styles.input} placeholder="Documento" value={form.cpf_cnpj} onChange={(event) => setForm((prev) => ({ ...prev, cpf_cnpj: event.target.value }))} />
          <input style={styles.input} type="email" placeholder="Email de acesso" value={form.email_principal} onChange={(event) => setForm((prev) => ({ ...prev, email_principal: event.target.value }))} required />
          <input style={styles.input} placeholder="Telefone" value={form.telefone} onChange={(event) => setForm((prev) => ({ ...prev, telefone: event.target.value }))} />
          <input style={styles.input} placeholder="Senha temporaria" value={form.senha} onChange={(event) => setForm((prev) => ({ ...prev, senha: event.target.value }))} />
          <button type="submit" style={styles.primaryButton}>Cadastrar requerente</button>
        </form>
        <div style={styles.requerentes}>
          {requerentes.map((item) => <span key={item.id}>{item.nome_razao_social} - {item.status}</span>)}
        </div>
      </section>
    </div>
  );
}

function Card({ label: title, value }) {
  return (
    <article style={styles.card}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Info({ label: title, value }) {
  return (
    <div style={styles.info}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles = {
  page: {
    display: 'grid',
    gap: '18px',
  },
  section: {
    display: 'grid',
    gap: '14px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '18px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '24px',
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#64748b',
  },
  sectionTitle: {
    margin: 0,
    color: '#0f172a',
    fontSize: '18px',
  },
  notice: {
    border: '1px solid #fde68a',
    borderRadius: '8px',
    background: '#fffbeb',
    color: '#92400e',
    padding: '12px',
    fontWeight: 800,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
  },
  card: {
    display: 'grid',
    gap: '4px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#f8fafc',
    padding: '12px',
  },
  filters: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '8px',
  },
  input: {
    minHeight: '38px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '0 10px',
  },
  secondaryButton: {
    minHeight: '38px',
    border: '1px solid #0f766e',
    borderRadius: '6px',
    background: '#ffffff',
    color: '#0f766e',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 12px',
  },
  primaryButton: {
    minHeight: '38px',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 12px',
  },
  dangerButton: {
    minHeight: '38px',
    border: 0,
    borderRadius: '6px',
    background: '#b91c1c',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
    gap: '18px',
  },
  list: {
    display: 'grid',
    gap: '8px',
  },
  listItem: {
    display: 'grid',
    gap: '7px',
    textAlign: 'left',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#ffffff',
    cursor: 'pointer',
    padding: '12px',
  },
  listTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  detail: {
    display: 'grid',
    gap: '12px',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '8px',
  },
  info: {
    display: 'grid',
    gap: '4px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  inlineForm: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '8px',
  },
  smallTitle: {
    margin: '6px 0 0',
    color: '#334155',
  },
  document: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px',
  },
  requerenteForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: '8px',
  },
  requerentes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    color: '#475569',
    fontSize: '13px',
  },
  error: {
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '12px',
    fontWeight: 800,
  },
  success: {
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    padding: '12px',
    fontWeight: 800,
  },
};
