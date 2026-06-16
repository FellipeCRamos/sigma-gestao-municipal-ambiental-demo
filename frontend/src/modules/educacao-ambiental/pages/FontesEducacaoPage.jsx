import { useCallback, useEffect, useState } from 'react';
import ConfiabilidadeBadge from '../components/ConfiabilidadeBadge';
import CuradoriaStatusBadge from '../components/CuradoriaStatusBadge';
import {
  createCuradoriaFonte,
  listCuradoriaFontes,
  updateCuradoriaFonte,
  updateCuradoriaFonteStatus,
} from '../services/educacaoAmbientalApi';
import FonteEducacaoForm from './FonteEducacaoForm';
import { fonteInitialForm, normalizeFonteForm } from './fonteEducacaoFormState';
import { formatDate, styles, toInputValue, unpackList } from './shared';

export default function FontesEducacaoPage() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [form, setForm] = useState(fonteInitialForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await listCuradoriaFontes({ ...filters, limit: 50, orderBy: 'nome', orderDirection: 'asc' });
      setItems(unpackList(response.data).items);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar fontes.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setForm(fonteInitialForm);
  }

  function startEdit(item) {
    setEditing(item);
    setForm({
      ...fonteInitialForm,
      ...item,
      temas_relacionados: toInputValue(item.temas_relacionados),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = normalizeFonteForm(form);
      if (editing?.id) {
        await updateCuradoriaFonte(editing.id, payload);
        setMessage('Fonte atualizada.');
      } else {
        await createCuradoriaFonte(payload);
        setMessage('Fonte criada.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel salvar fonte.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(item, status) {
    try {
      setError('');
      await updateCuradoriaFonteStatus(item.id, status);
      setMessage('Status da fonte atualizado.');
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel atualizar status da fonte.');
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Fontes ambientais</h2>
            <p style={styles.sectionSubtitle}>
              Catalogo auditavel de fontes possiveis para curadoria. A presenca aqui nao valida dados locais.
            </p>
          </div>
          <button type="button" style={styles.buttonSecondary} onClick={resetForm}>Nova fonte</button>
        </div>
        {error ? <p style={styles.error}>{error}</p> : null}
        {message ? <p style={styles.message}>{message}</p> : null}
        <FonteEducacaoForm
          form={form}
          editing={editing}
          saving={saving}
          onCancel={resetForm}
          onSubmit={handleSubmit}
          onChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
        />
      </section>

      <section style={styles.section}>
        <div style={styles.headerRow}>
          <div>
            <h3 style={styles.sectionTitle}>Matriz de fontes</h3>
            <p style={styles.sectionSubtitle}>Filtre por nome, orgao, descricao ou status.</p>
          </div>
          <div style={{ ...styles.filters, minWidth: 'min(460px, 100%)' }}>
            <input
              style={styles.input}
              value={filters.q}
              placeholder="Buscar fonte"
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            />
            <select
              style={styles.input}
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Todos os status</option>
              <option value="referencial_para_curadoria">Referencial</option>
              <option value="a_verificar">A verificar</option>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
              <option value="arquivada">Arquivada</option>
            </select>
          </div>
        </div>

        {loading ? <p style={styles.message}>Carregando fontes...</p> : null}
        {!loading && !items.length ? <p style={styles.message}>Nenhuma fonte encontrada.</p> : null}

        {items.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Fonte</th>
                  <th style={styles.th}>Tipo/esfera</th>
                  <th style={styles.th}>Confiabilidade</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Atualizada</th>
                  <th style={styles.th}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <strong>{item.nome}</strong>
                      <p style={styles.sectionSubtitle}>{item.orgao_responsavel || item.descricao || '-'}</p>
                    </td>
                    <td style={styles.td}>{item.tipo_fonte}<br />{item.esfera}</td>
                    <td style={styles.td}><ConfiabilidadeBadge value={item.confiabilidade_padrao} /></td>
                    <td style={styles.td}><CuradoriaStatusBadge value={item.status} /></td>
                    <td style={styles.td}>{formatDate(item.updated_at || item.created_at)}</td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button type="button" style={styles.buttonSecondary} onClick={() => startEdit(item)}>
                          Editar
                        </button>
                        <button type="button" style={styles.buttonSecondary} onClick={() => handleStatus(item, 'ativa')}>
                          Ativar
                        </button>
                        <button type="button" style={styles.buttonDanger} onClick={() => handleStatus(item, 'arquivada')}>
                          Arquivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
