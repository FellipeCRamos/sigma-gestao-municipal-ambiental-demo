import { useState } from 'react';

function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

export default function RequerentePendencias({ pendencias = [], onResponder }) {
  const [respostas, setRespostas] = useState({});

  return (
    <section style={styles.box}>
      <h3 style={styles.title}>Pendencias</h3>
      {pendencias.map((item) => (
        <article key={item.id} style={styles.item}>
          <div>
            <strong>{label(item.status)}</strong>
            <p>{item.descricao}</p>
            {item.resposta ? <small>Resposta registrada: {item.resposta}</small> : null}
          </div>
          {item.status === 'ABERTA' ? (
            <form
              style={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                onResponder?.(item.id, respostas[item.id] || '');
                setRespostas((prev) => ({ ...prev, [item.id]: '' }));
              }}
            >
              <textarea style={styles.textarea} value={respostas[item.id] || ''} onChange={(event) => setRespostas((prev) => ({ ...prev, [item.id]: event.target.value }))} required />
              <button type="submit" style={styles.button}>Responder</button>
            </form>
          ) : null}
        </article>
      ))}
      {!pendencias.length ? <p style={styles.empty}>Nenhuma pendencia registrada.</p> : null}
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
  item: {
    display: 'grid',
    gap: '10px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
  },
  form: {
    display: 'grid',
    gap: '8px',
  },
  textarea: {
    minHeight: '86px',
    resize: 'vertical',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '10px',
  },
  button: {
    justifySelf: 'start',
    minHeight: '38px',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0 14px',
  },
  empty: {
    color: '#64748b',
    margin: 0,
  },
};
