import { useState } from 'react';
import { searchProtocolos } from '../api/protocolosApi';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function compactError(error) {
  return error?.message || 'Nao foi possivel consultar protocolos.';
}

function displayLabel(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

export default function CentralProtocolos({ navigateToPage }) {
  const [protocolo, setProtocolo] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const response = await searchProtocolos({ protocolo });
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(compactError(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Central de protocolos</h2>
            <p style={styles.subtitle}>
              Consulta interna consolidada por protocolo para Demandas Publicas, Fiscalizacao Ambiental, Vistorias e Relatorios Tecnicos Preliminares.
            </p>
          </div>
        </div>

        <form style={styles.searchForm} onSubmit={handleSubmit}>
          <label style={styles.field}>
            <span style={styles.label}>Protocolo</span>
            <input
              value={protocolo}
              onChange={(event) => setProtocolo(event.target.value)}
              style={styles.input}
              placeholder="SIGMA-DEN-2026-000001"
              required
            />
          </label>
          <button type="submit" style={styles.primaryButton}>Consultar</button>
        </form>

        {error ? <div style={styles.alertError}>{error}</div> : null}
        {loading ? <p style={styles.subtitle}>Consultando protocolos...</p> : null}
        {searched && !loading && items.length === 0 && !error ? (
          <p style={styles.subtitle}>Nenhum registro encontrado para o protocolo informado.</p>
        ) : null}
      </section>

      {items.length > 0 ? (
        <section style={styles.section}>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Protocolo</th>
                  <th style={styles.th}>Modulo</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Criado em</th>
                  <th style={styles.th}>Responsavel</th>
                  <th style={styles.th}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.modulo_origem}-${item.entidade_id}`}>
                    <td style={styles.td}>
                      <strong>{item.protocolo}</strong>
                      <span style={styles.mutedLine}>{displayLabel(item.categoria)} / {displayLabel(item.subcategoria)}</span>
                    </td>
                    <td style={styles.td}>{item.modulo_label || displayLabel(item.modulo_origem)}</td>
                    <td style={styles.td}><span style={styles.badgeInfo}>{displayLabel(item.status)}</span></td>
                    <td style={styles.td}>{formatDateTime(item.criado_em)}</td>
                    <td style={styles.td}>{item.responsavel_nome || (item.responsavel_id ? `Usuario #${item.responsavel_id}` : 'Nao atribuido')}</td>
                    <td style={styles.td}>
                      {item.acao?.pagina ? (
                        <button type="button" style={styles.secondaryButton} onClick={() => navigateToPage?.(item.acao.pagina)}>
                          Abrir modulo
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '24px' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  searchForm: { display: 'grid', gridTemplateColumns: 'minmax(min(360px, 100%), 1fr) auto', gap: '12px', alignItems: 'end' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 700 },
  input: { minHeight: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff', color: '#111827' },
  primaryButton: { minHeight: '42px', border: 'none', borderRadius: '8px', background: '#1f6f43', color: '#ffffff', cursor: 'pointer', fontWeight: 700, padding: '0 16px' },
  secondaryButton: { minHeight: '38px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, padding: '0 12px' },
  tableWrapper: { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '860px', background: '#ffffff' },
  th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '13px' },
  td: { padding: '12px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: '13px', verticalAlign: 'top' },
  mutedLine: { display: 'block', marginTop: '4px', color: '#6b7280', fontSize: '12px', lineHeight: 1.4 },
  badgeInfo: { display: 'inline-block', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff', color: '#1d4ed8', padding: '5px 8px', fontWeight: 700 },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginBottom: '12px' },
};
