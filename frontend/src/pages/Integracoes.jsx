import { useEffect, useState } from 'react';
import {
  createParceiroIntegracao,
  getParceirosIntegracao,
  revokeParceiroIntegracao,
  rotateParceiroIntegracao,
} from '../services/api';
import { hasPermission, PERMISSIONS } from '../utils/permissions';

const INITIAL_FORM = {
  nome: '',
  descricao: '',
  escopos: ['indicadores', 'animais_publicos'],
  expires_at: '',
};

const SCOPE_LABELS = {
  indicadores: 'Indicadores agregados',
  animais_publicos: 'Consulta pública de animais',
};

function toggleScope(scopes, value, checked) {
  if (checked) {
    return scopes.includes(value) ? scopes : [...scopes, value];
  }

  return scopes.filter((scope) => scope !== value);
}

export default function Integracoes({ usuarioInterno }) {
  const [parceiros, setParceiros] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [tokenGerado, setTokenGerado] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const canCreate = hasPermission(usuarioInterno, PERMISSIONS.INTEGRACOES_CREATE);
  const canRotate = hasPermission(usuarioInterno, PERMISSIONS.INTEGRACOES_ROTATE);
  const canRevoke = hasPermission(usuarioInterno, PERMISSIONS.INTEGRACOES_REVOKE);

  async function loadParceiros() {
    try {
      setLoading(true);
      setError('');
      const response = await getParceirosIntegracao();
      setParceiros(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as integrações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParceiros();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
    setMessage('');
  }

  function handleScopeChange(event) {
    const { value, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      escopos: toggleScope(prev.escopos, value, checked),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.nome.trim()) {
      setError('Informe o nome do parceiro.');
      return;
    }

    if (!form.escopos.length) {
      setError('Selecione pelo menos um escopo.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setMessage('');
      const response = await createParceiroIntegracao(form);
      setTokenGerado(response.data?.token || '');
      setMessage('Parceiro criado. Guarde a chave agora, ela não sera exibida novamente.');
      setForm(INITIAL_FORM);
      await loadParceiros();
    } catch (err) {
      setError(err.message || 'Não foi possível criar o parceiro.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id) {
    try {
      setError('');
      setMessage('');
      await revokeParceiroIntegracao(id);
      setMessage('Token do parceiro revogado.');
      await loadParceiros();
    } catch (err) {
      setError(err.message || 'Não foi possível revogar o parceiro.');
    }
  }

  async function handleRotate(id) {
    try {
      setError('');
      setMessage('');
      const response = await rotateParceiroIntegracao(id);
      setTokenGerado(response.data?.token || '');
      setMessage('Token rotacionado. Guarde a nova chave agora.');
      await loadParceiros();
    } catch (err) {
      setError(err.message || 'Não foi possível rotacionar o token.');
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Integrações externas</h2>
            <p style={styles.subtitle}>
              Chaves controladas para parceiros consultarem dados públicos da Plataforma SIGMA.
            </p>
          </div>
          <div style={styles.badge}>{parceiros.length} parceiros</div>
        </div>

        {canCreate ? (
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Nome do parceiro</span>
            <input name="nome" value={form.nome} onChange={handleChange} style={styles.input} required />
          </label>
          <label style={styles.fieldWide}>
            <span style={styles.label}>Descrição</span>
            <textarea name="descricao" value={form.descricao} onChange={handleChange} style={styles.textarea} rows={3} />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Expira em</span>
            <input name="expires_at" type="datetime-local" value={form.expires_at} onChange={handleChange} style={styles.input} />
          </label>
          <div style={styles.scopeGroup}>
            <span style={styles.label}>Escopos</span>
            {Object.entries(SCOPE_LABELS).map(([value, label]) => (
              <label key={value} style={styles.checkbox}>
                <input
                  type="checkbox"
                  value={value}
                  checked={form.escopos.includes(value)}
                  onChange={handleScopeChange}
                />
                {label}
              </label>
            ))}
          </div>
          <button type="submit" disabled={submitting} style={styles.primaryButton}>
            {submitting ? 'Gerando...' : 'Gerar chave de parceiro'}
          </button>
        </form>
        ) : (
          <p style={styles.subtitle}>Seu perfil permite visualizar integrações, mas não criar parceiros.</p>
        )}

        {message ? <div style={styles.alertSuccess}>{message}</div> : null}
        {error ? <div style={styles.alertError}>{error}</div> : null}
        {tokenGerado ? (
          <div style={styles.tokenBox}>
            <span style={styles.label}>Chave gerada</span>
            <code style={styles.token}>{tokenGerado}</code>
          </div>
        ) : null}
      </section>

      <section style={styles.section}>
        <h2 style={styles.title}>Parceiros cadastrados</h2>
        {loading ? <p>Carregando parceiros...</p> : null}
        {!loading && parceiros.length === 0 ? (
          <p style={styles.subtitle}>Nenhum parceiro cadastrado ainda.</p>
        ) : null}
        {!loading && parceiros.length > 0 ? (
          <div style={styles.list}>
            {parceiros.map((parceiro) => (
              <article key={parceiro.id} style={styles.partner}>
                <div>
                  <strong>{parceiro.nome}</strong>
                  <p style={styles.subtitle}>{parceiro.descricao || 'Sem descrição'}</p>
                </div>
                <div style={styles.scopeList}>
                  {(parceiro.escopos || []).map((scope) => (
                    <span key={scope} style={styles.scopeBadge}>
                      {SCOPE_LABELS[scope] || scope}
                    </span>
                  ))}
                </div>
                <span style={styles.status}>{parceiro.status}</span>
                <div style={styles.actions}>
                  <button
                    type="button"
                    onClick={() => handleRotate(parceiro.id)}
                    disabled={parceiro.status !== 'ativo' || !canRotate}
                    style={styles.smallButton}
                  >
                    Rotacionar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(parceiro.id)}
                    disabled={parceiro.status !== 'ativo' || !canRevoke}
                    style={styles.dangerButton}
                  >
                    Revogar
                  </button>
                </div>
                <div style={styles.meta}>
                  <span>Ultimo uso: {parceiro.last_used_at ? new Date(parceiro.last_used_at).toLocaleString('pt-BR') : 'sem uso'}</span>
                  <span>Expira: {parceiro.expires_at ? new Date(parceiro.expires_at).toLocaleString('pt-BR') : 'sem expiraçao'}</span>
                  <span>Rotacionado: {parceiro.rotated_at ? new Date(parceiro.rotated_at).toLocaleString('pt-BR') : 'não'}</span>
                  <span>Revogado: {parceiro.revoked_at ? new Date(parceiro.revoked_at).toLocaleString('pt-BR') : 'não'}</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

const styles = {
  page: {
    display: 'grid',
    gap: '24px',
  },
  section: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '24px',
    display: 'grid',
    gap: '18px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    marginBottom: '8px',
    color: '#111827',
    fontSize: '24px',
  },
  subtitle: {
    margin: 0,
    color: '#4b5563',
    lineHeight: 1.5,
    fontSize: '14px',
  },
  badge: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#374151',
    fontWeight: 700,
    fontSize: '13px',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
    gap: '14px',
    alignItems: 'end',
  },
  field: {
    display: 'grid',
    gap: '6px',
  },
  fieldWide: {
    display: 'grid',
    gap: '6px',
  },
  label: {
    color: '#374151',
    fontSize: '13px',
    fontWeight: 700,
  },
  input: {
    minHeight: '42px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '0 12px',
  },
  textarea: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '12px',
    resize: 'vertical',
  },
  scopeGroup: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '12px',
    display: 'grid',
    gap: '8px',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#374151',
    fontSize: '14px',
  },
  primaryButton: {
    minHeight: '42px',
    border: '1px solid #1f6f43',
    borderRadius: '8px',
    background: '#1f6f43',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0 16px',
  },
  alertSuccess: {
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    padding: '12px',
  },
  alertError: {
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    padding: '12px',
  },
  tokenBox: {
    display: 'grid',
    gap: '8px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '12px',
    background: '#f9fafb',
  },
  token: {
    display: 'block',
    overflowWrap: 'anywhere',
    color: '#111827',
    fontWeight: 700,
  },
  list: {
    display: 'grid',
    gap: '12px',
  },
  partner: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '14px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
    gap: '12px',
    alignItems: 'center',
  },
  scopeList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  scopeBadge: {
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '6px 8px',
    color: '#374151',
    fontSize: '12px',
    fontWeight: 700,
  },
  status: {
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '6px 8px',
    color: '#166534',
    background: '#f0fdf4',
    fontSize: '12px',
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  smallButton: {
    minHeight: '34px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0 10px',
  },
  dangerButton: {
    minHeight: '34px',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0 10px',
  },
  meta: {
    color: '#6b7280',
    display: 'grid',
    gap: '4px',
    fontSize: '12px',
  },
};
