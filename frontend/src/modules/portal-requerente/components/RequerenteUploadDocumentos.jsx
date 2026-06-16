import { useState } from 'react';

const TIPOS = [
  'REQUERIMENTO',
  'DOCUMENTO_PESSOAL',
  'CNPJ',
  'COMPROVANTE_ENDERECO',
  'PROCURACAO',
  'RESPONSABILIDADE_TECNICA',
  'PLANTA_MAPA',
  'MEMORIAL_DESCRITIVO',
  'OUTRO',
];

function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

export default function RequerenteUploadDocumentos({ documentos = [], onUpload, disabled = false }) {
  const [form, setForm] = useState({ tipo_documento: 'REQUERIMENTO', nome_original: '', referencia_documental: '', mime_type: 'application/pdf' });

  function submit(event) {
    event.preventDefault();
    onUpload?.(form);
    setForm({ tipo_documento: 'REQUERIMENTO', nome_original: '', referencia_documental: '', mime_type: 'application/pdf' });
  }

  return (
    <section style={styles.box}>
      <h3 style={styles.title}>Documentos</h3>
      <form style={styles.form} onSubmit={submit}>
        <select style={styles.input} value={form.tipo_documento} onChange={(event) => setForm((prev) => ({ ...prev, tipo_documento: event.target.value }))}>
          {TIPOS.map((tipo) => <option key={tipo} value={tipo}>{label(tipo)}</option>)}
        </select>
        <input style={styles.input} placeholder="Nome do arquivo ou referencia" value={form.nome_original} onChange={(event) => setForm((prev) => ({ ...prev, nome_original: event.target.value }))} required />
        <input style={styles.input} placeholder="Referencia documental controlada" value={form.referencia_documental} onChange={(event) => setForm((prev) => ({ ...prev, referencia_documental: event.target.value }))} />
        <button type="submit" style={styles.button} disabled={disabled}>Anexar</button>
      </form>
      <div style={styles.list}>
        {documentos.map((doc) => (
          <article key={doc.id} style={styles.item}>
            <strong>{label(doc.tipo_documento)}</strong>
            <span>{doc.nome_original}</span>
            <small>{doc.status} - {doc.sensibilidade_lgpd}</small>
          </article>
        ))}
        {!documentos.length ? <p style={styles.empty}>Nenhum documento anexado.</p> : null}
      </div>
    </section>
  );
}

const styles = {
  box: {
    display: 'grid',
    gap: '12px',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '17px',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
    gap: '8px',
  },
  input: {
    minHeight: '38px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '0 10px',
  },
  button: {
    minHeight: '38px',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0 14px',
  },
  list: {
    display: 'grid',
    gap: '8px',
  },
  item: {
    display: 'grid',
    gap: '4px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
  },
  empty: {
    color: '#64748b',
    margin: 0,
  },
};
