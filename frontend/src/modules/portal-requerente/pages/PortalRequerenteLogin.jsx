import { useState } from 'react';
import { loginPortalRequerente, setPortalRequerenteSession } from '../services/portalRequerenteApi';

export default function PortalRequerenteLogin({ onLogin, onOpenAdmin, onOpenPublico }) {
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await loginPortalRequerente(form);
      const session = { token: response.data.token, user: response.data.user };
      setPortalRequerenteSession(session);
      onLogin?.(session);
    } catch (err) {
      setError(err.message || 'Nao foi possivel acessar o portal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <span style={styles.badge}>Portal do Requerente</span>
        <h1 style={styles.title}>Acesso controlado</h1>
        <p style={styles.text}>Area autenticada para acompanhamento de requerimentos proprios, pre-protocolo e resposta a exigencias administrativas.</p>
        <div style={styles.alert}>Este envio constitui pre-protocolo eletronico em ambiente controlado. A formalizacao administrativa dependera de conferencia e aceite pela SMAD.</div>
        <form style={styles.form} onSubmit={submit}>
          <input style={styles.input} type="email" placeholder="Email cadastrado" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
          <input style={styles.input} type="password" placeholder="Senha" value={form.senha} onChange={(event) => setForm((prev) => ({ ...prev, senha: event.target.value }))} required />
          {error ? <div style={styles.error}>{error}</div> : null}
          <button type="submit" style={styles.button} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div style={styles.actions}>
          <button type="button" style={styles.linkButton} onClick={onOpenPublico}>Painel SIGMA</button>
          <button type="button" style={styles.linkButton} onClick={onOpenAdmin}>Area interna</button>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #f8fafc 46%, #ecfdf5 100%)',
    padding: '24px',
  },
  panel: {
    width: 'min(520px, 100%)',
    display: 'grid',
    gap: '16px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.12)',
  },
  badge: {
    color: '#0f766e',
    fontWeight: 900,
    textTransform: 'uppercase',
    fontSize: '12px',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '34px',
  },
  text: {
    margin: 0,
    color: '#475569',
    lineHeight: 1.55,
  },
  alert: {
    border: '1px solid #fde68a',
    borderRadius: '8px',
    background: '#fffbeb',
    color: '#92400e',
    padding: '12px',
    fontWeight: 700,
    lineHeight: 1.45,
  },
  form: {
    display: 'grid',
    gap: '10px',
  },
  input: {
    minHeight: '44px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '0 12px',
    fontSize: '15px',
  },
  button: {
    minHeight: '44px',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 900,
  },
  linkButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#fff',
    minHeight: '36px',
    cursor: 'pointer',
    color: '#334155',
    fontWeight: 800,
    padding: '0 12px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  error: {
    color: '#b91c1c',
    fontWeight: 800,
  },
};
