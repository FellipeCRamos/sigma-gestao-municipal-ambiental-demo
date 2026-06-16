import { useState } from 'react';
import {
  loginUsuarioInterno,
  requestPasswordResetInterno,
  resetPasswordInterno,
} from '../services/api';
import sigmaLogo from '../assets/logo-sigma.png';

const INITIAL_FORM = {
  email: '',
  senha: '',
};

const INITIAL_RESET = {
  email: '',
  token: '',
  nova_senha: '',
};

function getResetTokenFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('reset_token') || '';
  } catch {
    return '';
  }
}

export default function AdminLogin({ onLogin, onOpenSigmaPanel, onOpenLicenciamentoPanel }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [resetForm, setResetForm] = useState(() => ({
    ...INITIAL_RESET,
    token: getResetTokenFromUrl(),
  }));
  const [showReset, setShowReset] = useState(() => Boolean(getResetTokenFromUrl()));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  }

  function handleResetChange(event) {
    const { name, value } = event.target;
    setResetForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      const response = await loginUsuarioInterno(form);
      onLogin(response.data);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset(event) {
    event.preventDefault();

    try {
      setLoading(true);
      const response = await requestPasswordResetInterno({ email: resetForm.email });
      setMessage(response.message || 'Se o email estiver cadastrado, as instrucoes serao enviadas.');
    } catch (err) {
      setError(err.message || 'Não foi possível solicitar recuperaçao.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    try {
      setLoading(true);
      const response = await resetPasswordInterno({
        token: resetForm.token,
        nova_senha: resetForm.nova_senha,
      });
      setMessage(response.message || 'Senha redefinida com sucesso.');
      setResetForm(INITIAL_RESET);
    } catch (err) {
      setError(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <div>
          <img src={sigmaLogo} alt="SIGMA" style={styles.logo} />
          <h1 style={styles.title}>Acesso interno SMAD</h1>
          <p style={styles.subtitle}>
            Entrada restrita a servidores autorizados da Plataforma SIGMA.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>E-mail</span>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              style={styles.input}
              placeholder="usuario.demo@example.local"
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Senha</span>
            <input
              name="senha"
              type="password"
              value={form.senha}
              onChange={handleChange}
              style={styles.input}
              placeholder="Senha"
              required
            />
          </label>

          {error ? <div style={styles.error}>{error}</div> : null}
          {message ? <div style={styles.success}>{message}</div> : null}

          <button type="submit" disabled={loading} style={styles.primaryButton}>
            {loading ? 'Entrando...' : 'Entrar na área interna'}
          </button>
        </form>

        <button type="button" onClick={() => setShowReset((prev) => !prev)} style={styles.textButton}>
          Recuperar ou redefinir senha
        </button>

        {showReset ? (
          <div style={styles.resetBox}>
            <form onSubmit={handleRequestReset} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.label}>E-mail institucional</span>
                <input
                  name="email"
                  type="email"
                  value={resetForm.email}
                  onChange={handleResetChange}
                  style={styles.input}
                  required
                />
              </label>
              <button type="submit" disabled={loading} style={styles.secondaryButton}>
                Solicitar recuperaçao
              </button>
            </form>

            <form onSubmit={handleResetPassword} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.label}>Token recebido</span>
                <input name="token" value={resetForm.token} onChange={handleResetChange} style={styles.input} />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Nova senha</span>
                <input
                  name="nova_senha"
                  type="password"
                  value={resetForm.nova_senha}
                  onChange={handleResetChange}
                  style={styles.input}
                  placeholder="Mínimo 8 caracteres, letras e numeros"
                />
              </label>
              <button type="submit" disabled={loading} style={styles.primaryButton}>
                Redefinir senha
              </button>
            </form>
          </div>
        ) : null}

        <div style={styles.links}>
          <button type="button" onClick={onOpenSigmaPanel} style={styles.secondaryButton}>
            Ir para o painel principal do SIGMA
          </button>
          <button type="button" onClick={onOpenLicenciamentoPanel} style={styles.secondaryButton}>
            Voltar ao painel principal do Licenciamento
          </button>
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
    background: '#f3f4f6',
    padding: '24px',
  },
  resetBox: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '14px',
    display: 'grid',
    gap: '14px',
  },
  panel: {
    width: '100%',
    maxWidth: '440px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '28px',
    display: 'grid',
    gap: '20px',
  },
  logo: {
    display: 'block',
    width: '188px',
    maxWidth: '62%',
    height: 'auto',
    marginBottom: '18px',
  },
  title: { margin: 0, fontSize: '26px', color: '#111827' },
  subtitle: { margin: '8px 0 0', color: '#4b5563', lineHeight: 1.5 },
  form: { display: 'grid', gap: '14px' },
  links: { display: 'grid', gap: '10px' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: {
    height: '42px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '0 12px',
    fontSize: '14px',
  },
  primaryButton: {
    height: '42px',
    border: 'none',
    borderRadius: '8px',
    background: '#1f6f43',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  secondaryButton: {
    minHeight: '42px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '10px 12px',
    lineHeight: 1.2,
    whiteSpace: 'normal',
  },
  textButton: {
    border: 'none',
    background: 'transparent',
    color: '#1f6f43',
    cursor: 'pointer',
    fontWeight: 700,
    justifySelf: 'start',
    padding: 0,
  },
  error: {
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '10px 12px',
    fontSize: '14px',
  },
  success: {
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    padding: '10px 12px',
    fontSize: '14px',
  },
};
