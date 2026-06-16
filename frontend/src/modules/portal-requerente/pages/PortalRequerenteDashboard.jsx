import { useCallback, useEffect, useMemo, useState } from 'react';
import RequerenteTermoAceite from '../components/RequerenteTermoAceite';
import {
  aceitarPortalRequerenteTermos,
  addMeuRequerimentoDocumento,
  clearPortalRequerenteSession,
  createMeuRequerimento,
  enviarMeuRequerimento,
  getMeuRequerimento,
  getPortalRequerenteMe,
  getPortalRequerenteSession,
  getPortalRequerenteTermos,
  listMeusRequerimentos,
  responderMeuRequerimentoPendencia,
} from '../services/portalRequerenteApi';
import PortalRequerenteDetalhe from './PortalRequerenteDetalhe';
import PortalRequerenteLogin from './PortalRequerenteLogin';
import PortalRequerenteNovoRequerimento from './PortalRequerenteNovoRequerimento';
import PortalRequerenteRequerimentos from './PortalRequerenteRequerimentos';

function compactError(error) {
  return error?.message || 'Nao foi possivel concluir a operacao.';
}

export default function PortalRequerenteDashboard({ onOpenAdmin, onOpenPublico }) {
  const [session, setSession] = useState(() => getPortalRequerenteSession());
  const [me, setMe] = useState(null);
  const [termos, setTermos] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('inicio');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = session?.token || '';

  const resumo = useMemo(() => {
    const counts = items.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    return {
      total: items.length,
      pendentes: counts.RECEBIDO_PENDENTE_TRIAGEM || 0,
      devolvidos: counts.DEVOLVIDO_PARA_COMPLEMENTACAO || 0,
      aceitos: counts.ACEITO_GEROU_PROCESSO_INTERNO || 0,
    };
  }, [items]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [meResponse, termosResponse, listResponse] = await Promise.all([
        getPortalRequerenteMe(token),
        getPortalRequerenteTermos(token),
        listMeusRequerimentos(token),
      ]);
      setMe(meResponse.data);
      setTermos(termosResponse.data?.obrigatorios || []);
      setItems(Array.isArray(listResponse.data) ? listResponse.data : []);
    } catch (err) {
      setError(compactError(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function openDetail(item) {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await getMeuRequerimento(token, item.id);
      setSelected(response.data);
      setView('detalhe');
    } catch (err) {
      setError(compactError(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshSelected(id = selected?.id) {
    if (!id) return;
    const response = await getMeuRequerimento(token, id);
    setSelected(response.data);
    await loadData();
  }

  async function aceitarTermos(tipos) {
    setError('');
    setMessage('');
    try {
      await aceitarPortalRequerenteTermos(token, { tipos, versao_termo: '4C-2026-05' });
      setMessage('Termos aceitos.');
      await loadData();
    } catch (err) {
      setError(compactError(err));
    }
  }

  async function saveRequerimento(payload, options = {}) {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const created = await createMeuRequerimento(token, payload);
      if (options.enviar) {
        await enviarMeuRequerimento(token, created.data.id);
        setMessage('Requerimento enviado para triagem.');
      } else {
        setMessage('Rascunho salvo.');
      }
      await loadData();
      setView('requerimentos');
    } catch (err) {
      setError(compactError(err));
    } finally {
      setLoading(false);
    }
  }

  async function enviar(id) {
    setError('');
    setMessage('');
    try {
      await enviarMeuRequerimento(token, id);
      setMessage('Requerimento enviado para triagem.');
      await refreshSelected(id);
    } catch (err) {
      setError(compactError(err));
    }
  }

  async function upload(id, payload) {
    setError('');
    setMessage('');
    try {
      await addMeuRequerimentoDocumento(token, id, payload);
      setMessage('Documento anexado.');
      await refreshSelected(id);
    } catch (err) {
      setError(compactError(err));
    }
  }

  async function responder(id, pendenciaId, resposta) {
    setError('');
    setMessage('');
    try {
      await responderMeuRequerimentoPendencia(token, id, pendenciaId, { resposta });
      setMessage('Pendencia respondida.');
      await refreshSelected(id);
    } catch (err) {
      setError(compactError(err));
    }
  }

  function logout() {
    clearPortalRequerenteSession();
    setSession(null);
    setMe(null);
    setItems([]);
    setSelected(null);
  }

  if (!session?.token) {
    return <PortalRequerenteLogin onLogin={setSession} onOpenAdmin={onOpenAdmin} onOpenPublico={onOpenPublico} />;
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <span style={styles.badge}>Portal do Requerente</span>
          <h1 style={styles.title}>{me?.requerente?.nome_razao_social || 'Requerente'}</h1>
          <p style={styles.text}>Ambiente autenticado para requerimentos proprios e pre-protocolo externo controlado.</p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryButton} onClick={onOpenPublico}>Painel SIGMA</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenAdmin}>Area interna</button>
          <button type="button" style={styles.logoutButton} onClick={logout}>Sair</button>
        </div>
      </header>

      <section style={styles.alert}>Este envio constitui pre-protocolo eletronico em ambiente controlado. A formalizacao administrativa dependera de conferencia e aceite pela SMAD.</section>
      <section style={styles.alertBlue}>Modulo interno em homologacao assistida. A analise geoambiental possui carater preliminar e nao substitui a avaliacao tecnica do corpo tecnico da SMAD.</section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <nav style={styles.nav}>
        <button type="button" style={view === 'inicio' ? styles.navActive : styles.navButton} onClick={() => setView('inicio')}>Inicio</button>
        <button type="button" style={view === 'requerimentos' ? styles.navActive : styles.navButton} onClick={() => setView('requerimentos')}>Meus Requerimentos</button>
        <button type="button" style={view === 'novo' ? styles.navActive : styles.navButton} onClick={() => setView('novo')}>Novo Requerimento</button>
      </nav>

      <section style={styles.content}>
        {view === 'inicio' ? (
          <div style={styles.home}>
            <div style={styles.cards}>
              <Card label="Total" value={resumo.total} />
              <Card label="Pendentes de triagem" value={resumo.pendentes} />
              <Card label="Devolvidos" value={resumo.devolvidos} />
              <Card label="Aceitos" value={resumo.aceitos} />
            </div>
            <RequerenteTermoAceite termos={termos} onAceitar={aceitarTermos} loading={loading} />
            <PortalRequerenteRequerimentos requerimentos={items.slice(0, 5)} onSelect={openDetail} onNew={() => setView('novo')} />
          </div>
        ) : null}
        {view === 'requerimentos' ? <PortalRequerenteRequerimentos requerimentos={items} onSelect={openDetail} onNew={() => setView('novo')} /> : null}
        {view === 'novo' ? <PortalRequerenteNovoRequerimento onSave={saveRequerimento} onCancel={() => setView('requerimentos')} saving={loading} /> : null}
        {view === 'detalhe' ? (
          <PortalRequerenteDetalhe
            requerimento={selected}
            onBack={() => setView('requerimentos')}
            onEnviar={enviar}
            onUpload={upload}
            onResponder={responder}
            loading={loading}
          />
        ) : null}
      </section>
    </main>
  );
}

function Card({ label, value }) {
  return (
    <article style={styles.card}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    padding: '24px',
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '18px',
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: '1180px',
    margin: '0 auto 18px',
  },
  badge: {
    color: '#0f766e',
    fontWeight: 900,
    textTransform: 'uppercase',
    fontSize: '12px',
  },
  title: {
    margin: '4px 0 0',
    fontSize: '30px',
  },
  text: {
    margin: '4px 0 0',
    color: '#64748b',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  secondaryButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    minHeight: '38px',
    cursor: 'pointer',
    color: '#334155',
    fontWeight: 800,
    padding: '0 12px',
  },
  logoutButton: {
    border: 0,
    borderRadius: '6px',
    background: '#334155',
    minHeight: '38px',
    cursor: 'pointer',
    color: '#ffffff',
    fontWeight: 800,
    padding: '0 12px',
  },
  alert: {
    maxWidth: '1180px',
    margin: '0 auto 10px',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    background: '#fffbeb',
    color: '#92400e',
    padding: '12px',
    fontWeight: 800,
  },
  alertBlue: {
    maxWidth: '1180px',
    margin: '0 auto 14px',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    background: '#eff6ff',
    color: '#1e3a8a',
    padding: '12px',
    fontWeight: 800,
  },
  error: {
    maxWidth: '1180px',
    margin: '0 auto 10px',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '12px',
    fontWeight: 800,
  },
  success: {
    maxWidth: '1180px',
    margin: '0 auto 10px',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    padding: '12px',
    fontWeight: 800,
  },
  nav: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    maxWidth: '1180px',
    margin: '0 auto 14px',
  },
  navButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    minHeight: '38px',
    cursor: 'pointer',
    color: '#334155',
    fontWeight: 800,
    padding: '0 12px',
  },
  navActive: {
    border: '1px solid #0f766e',
    borderRadius: '6px',
    background: '#0f766e',
    minHeight: '38px',
    cursor: 'pointer',
    color: '#ffffff',
    fontWeight: 900,
    padding: '0 12px',
  },
  content: {
    maxWidth: '1180px',
    margin: '0 auto',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '18px',
  },
  home: {
    display: 'grid',
    gap: '16px',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
  },
  card: {
    display: 'grid',
    gap: '4px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#f8fafc',
    padding: '14px',
  },
};
