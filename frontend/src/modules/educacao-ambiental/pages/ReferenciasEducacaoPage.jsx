import { useCallback, useEffect, useState } from 'react';
import ConfiabilidadeBadge from '../components/ConfiabilidadeBadge';
import CuradoriaStatusBadge from '../components/CuradoriaStatusBadge';
import {
  archiveCuradoriaReferencia,
  createCuradoriaReferencia,
  listCuradoriaReferencias,
  updateCuradoriaReferencia,
} from '../services/educacaoAmbientalApi';
import ReferenciaEducacaoForm from './ReferenciaEducacaoForm';
import {
  normalizeReferenciaForm,
  referenciaInitialForm,
} from './referenciaEducacaoFormState';
import { formatDate, styles, toInputValue, unpackList } from './shared';

export default function ReferenciasEducacaoPage() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ q: '', entidade_tipo: '', status: 'ativo' });
  const [form, setForm] = useState(referenciaInitialForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await listCuradoriaReferencias({ ...filters, limit: 50, orderBy: 'updated_at' });
      setItems(unpackList(response.data).items);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar referencias.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setForm(referenciaInitialForm);
  }

  function startEdit(item) {
    setEditing(item);
    setForm({
      ...referenciaInitialForm,
      ...item,
      entidade_id: toInputValue(item.entidade_id),
      fonte_id: toInputValue(item.fonte_id),
      data_acesso: item.data_acesso ? String(item.data_acesso).slice(0, 10) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = normalizeReferenciaForm(form);
      if (editing?.id) {
        await updateCuradoriaReferencia(editing.id, payload);
        setMessage('Referencia atualizada.');
      } else {
        await createCuradoriaReferencia(payload);
        setMessage('Referencia criada.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel salvar referencia.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(item) {
    try {
      setError('');
      await archiveCuradoriaReferencia(item.id);
      setMessage('Referencia arquivada.');
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel arquivar referencia.');
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Referencias e evidencias</h2>
            <p style={styles.sectionSubtitle}>
              Vincule fontes, trechos, paginas, mapas, relatorios e evidencias a conteudos e entidades ambientais.
            </p>
          </div>
          <button type="button" style={styles.buttonSecondary} onClick={resetForm}>Nova referencia</button>
        </div>
        {error ? <p style={styles.error}>{error}</p> : null}
        {message ? <p style={styles.message}>{message}</p> : null}
        <ReferenciaEducacaoForm
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
            <h3 style={styles.sectionTitle}>Evidencias cadastradas</h3>
            <p style={styles.sectionSubtitle}>Use a entidade e o ID para manter rastreabilidade auditavel.</p>
          </div>
          <div style={{ ...styles.filters, minWidth: 'min(620px, 100%)' }}>
            <input
              style={styles.input}
              value={filters.q}
              placeholder="Buscar referencia"
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            />
            <select
              style={styles.input}
              value={filters.entidade_tipo}
              onChange={(event) => setFilters((prev) => ({ ...prev, entidade_tipo: event.target.value }))}
            >
              <option value="">Todas entidades</option>
              <option value="conteudo">Conteudo</option>
              <option value="norma">Norma</option>
              <option value="especie">Especie</option>
              <option value="area_ambiental">Area ambiental</option>
              <option value="programa">Programa</option>
              <option value="material">Material</option>
              <option value="trilha">Trilha</option>
              <option value="faq">FAQ</option>
            </select>
            <select
              style={styles.input}
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </div>
        </div>

        {loading ? <p style={styles.message}>Carregando referencias...</p> : null}
        {!loading && !items.length ? <p style={styles.message}>Nenhuma referencia encontrada.</p> : null}

        {items.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Referencia</th>
                  <th style={styles.th}>Entidade</th>
                  <th style={styles.th}>Fonte</th>
                  <th style={styles.th}>Confiabilidade</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Criada</th>
                  <th style={styles.th}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <strong>{item.titulo_referencia}</strong>
                      <p style={styles.sectionSubtitle}>{item.tipo_evidencia}</p>
                    </td>
                    <td style={styles.td}>{item.entidade_tipo} #{item.entidade_id}</td>
                    <td style={styles.td}>{item.fonte_nome || item.fonte_id || '-'}</td>
                    <td style={styles.td}><ConfiabilidadeBadge value={item.confiabilidade} /></td>
                    <td style={styles.td}><CuradoriaStatusBadge value={item.status} /></td>
                    <td style={styles.td}>{formatDate(item.created_at)}</td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button type="button" style={styles.buttonSecondary} onClick={() => startEdit(item)}>
                          Editar
                        </button>
                        <button type="button" style={styles.buttonDanger} onClick={() => handleArchive(item)}>
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
