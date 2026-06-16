function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

export default function RequerenteLinhaTempo({ historico = [] }) {
  if (!historico.length) {
    return <p style={styles.empty}>Nenhuma movimentacao registrada.</p>;
  }

  return (
    <div style={styles.timeline}>
      {historico.map((item) => (
        <article key={item.id} style={styles.item}>
          <span style={styles.dot} />
          <div>
            <strong>{label(item.tipo_evento)}</strong>
            <p>{item.descricao}</p>
            <small>{item.status_novo ? label(item.status_novo) : 'Registro'} - {new Date(item.created_at).toLocaleString('pt-BR')}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

const styles = {
  timeline: {
    display: 'grid',
    gap: '10px',
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '14px 1fr',
    gap: '10px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '10px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '999px',
    background: '#0f766e',
    marginTop: '5px',
  },
  empty: {
    margin: 0,
    color: '#64748b',
  },
};
