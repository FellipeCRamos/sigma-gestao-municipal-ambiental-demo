import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  archiveEducacaoConteudo,
  createEducacaoEntity,
  listEducacaoEntity,
  updateEducacaoEntity,
  updateEducacaoEntityStatus,
} from '../services/educacaoAmbientalApi';
import {
  formatDate,
  labelStatus,
  normalizeFormPayload,
  statusBadgeStyle,
  styles,
  toInputValue,
  unpackList,
} from './shared';

function buildInitialForm(fields) {
  return fields.reduce((acc, field) => {
    acc[field.name] = field.type === 'checkbox' ? Boolean(field.defaultValue) : field.defaultValue || '';
    return acc;
  }, {});
}

function FieldControl({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <select style={styles.input} value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione</option>
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        style={styles.textarea}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '42px' }}>
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{field.checkboxLabel || 'Sim'}</span>
      </label>
    );
  }

  return (
    <input
      style={styles.input}
      type={field.type || 'text'}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export default function EducacaoCrudPage({ config }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => buildInitialForm(config.fields));

  const statusField = config.statusField || 'status';
  const fieldMap = useMemo(() => new Map(config.fields.map((field) => [field.name, field])), [config.fields]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const query = {
        q: filters.q,
        limit: 20,
        orderBy: config.orderBy || 'created_at',
        ...(filters.status ? { [statusField]: filters.status, status: filters.status } : {}),
      };
      const response = await listEducacaoEntity(config.entityPath, query);
      const payload = unpackList(response.data);
      setItems(payload.items);
      setPagination(payload.pagination);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar os registros.');
    } finally {
      setLoading(false);
    }
  }, [config.entityPath, config.orderBy, filters.q, filters.status, statusField]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setForm(buildInitialForm(config.fields));
  }

  function startEdit(item) {
    setEditing(item);
    setForm(
      config.fields.reduce((acc, field) => {
        acc[field.name] = field.type === 'checkbox' ? Boolean(item[field.name]) : toInputValue(item[field.name]);
        return acc;
      }, {})
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = normalizeFormPayload(config.fields, form);
      if (editing?.id) {
        await updateEducacaoEntity(config.entityPath, editing.id, payload);
        setMessage('Registro atualizado.');
      } else {
        await createEducacaoEntity(config.entityPath, payload);
        setMessage('Registro criado.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel salvar o registro.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(item, status) {
    try {
      setError('');
      setMessage('');
      await updateEducacaoEntityStatus(config.entityPath, item.id, status);
      setMessage(`Status atualizado para ${labelStatus(status)}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel atualizar o status.');
    }
  }

  async function handleArchive(item) {
    try {
      setError('');
      setMessage('');
      if (config.entityPath === 'conteudos') {
        await archiveEducacaoConteudo(item.id);
      } else {
        await updateEducacaoEntityStatus(config.entityPath, item.id, 'arquivado');
      }
      setMessage('Registro arquivado.');
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel arquivar o registro.');
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>{config.title}</h2>
            <p style={styles.sectionSubtitle}>{config.description}</p>
          </div>
          <button type="button" style={styles.buttonSecondary} onClick={resetForm}>
            Novo registro
          </button>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}
        {message ? <p style={styles.message}>{message}</p> : null}

        <form onSubmit={handleSubmit} style={{ marginTop: '18px' }}>
          <div style={styles.formGrid}>
            {config.fields.map((field) => (
              <label
                key={field.name}
                style={{
                  ...styles.label,
                  gridColumn: field.full ? '1 / -1' : undefined,
                }}
              >
                {field.label}
                <FieldControl
                  field={field}
                  value={form[field.name]}
                  onChange={(value) => setForm((prev) => ({ ...prev, [field.name]: value }))}
                />
              </label>
            ))}
          </div>
          <div style={styles.actions}>
            <button type="submit" style={styles.buttonPrimary} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Criar registro'}
            </button>
            {editing ? (
              <button type="button" style={styles.buttonSecondary} onClick={resetForm}>
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section style={styles.section}>
        <div style={styles.headerRow}>
          <div>
            <h3 style={styles.sectionTitle}>Registros</h3>
            <p style={styles.sectionSubtitle}>
              Consulta administrativa com busca simples e acoes de status auditadas.
            </p>
          </div>
          <div style={{ ...styles.filters, minWidth: 'min(460px, 100%)' }}>
            <input
              style={styles.input}
              value={filters.q}
              placeholder="Buscar"
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            />
            <select
              style={styles.input}
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Todos os status</option>
              {(fieldMap.get(statusField)?.options || fieldMap.get('status')?.options || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="button" style={styles.buttonSecondary} onClick={load}>
              Filtrar
            </button>
          </div>
        </div>

        {loading ? <p style={styles.message}>Carregando registros...</p> : null}

        {!loading && !items.length ? (
          <p style={styles.message}>Nenhum registro encontrado. Base em estruturacao.</p>
        ) : null}

        {items.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {(config.columns || []).map((column) => (
                    <th key={column.key} style={styles.th}>{column.label}</th>
                  ))}
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Atualizado</th>
                  <th style={styles.th}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {(config.columns || []).map((column) => (
                      <td key={column.key} style={styles.td}>
                        {column.type === 'date' ? formatDate(item[column.key]) : String(item[column.key] ?? '-')}
                      </td>
                    ))}
                    <td style={styles.td}>
                      <span style={statusBadgeStyle(item[statusField] || item.status)}>
                        {labelStatus(item[statusField] || item.status)}
                      </span>
                    </td>
                    <td style={styles.td}>{formatDate(item.updated_at || item.created_at)}</td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button type="button" style={styles.buttonSecondary} onClick={() => startEdit(item)}>
                          Editar
                        </button>
                        {config.quickStatuses?.map((status) => (
                          <button
                            key={status}
                            type="button"
                            style={styles.buttonSecondary}
                            onClick={() => handleStatus(item, status)}
                          >
                            {labelStatus(status)}
                          </button>
                        ))}
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

        {pagination ? (
          <p style={styles.sectionSubtitle}>
            Total: {pagination.total_items} registros. Pagina {pagination.page} de {pagination.total_pages}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
