export default function RequerenteTermoAceite({ termos = [], onAceitar, loading = false }) {
  const pendentes = termos.filter((item) => !item.aceito);

  return (
    <section style={styles.box}>
      <div>
        <h3 style={styles.title}>Termos e Politica de Privacidade</h3>
        <p style={styles.text}>O envio de requerimento depende do aceite dos termos institucionais do Portal do Requerente.</p>
      </div>
      <div style={styles.list}>
        {termos.map((item) => (
          <span key={item.tipo_termo} style={item.aceito ? styles.accepted : styles.pending}>
            {item.tipo_termo.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      {pendentes.length ? (
        <button type="button" style={styles.button} onClick={() => onAceitar?.(pendentes.map((item) => item.tipo_termo))} disabled={loading}>
          Aceitar termos pendentes
        </button>
      ) : (
        <span style={styles.ready}>Termos aceitos</span>
      )}
    </section>
  );
}

const styles = {
  box: {
    display: 'grid',
    gap: '12px',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    background: '#eff6ff',
    padding: '16px',
  },
  title: {
    margin: 0,
    color: '#172554',
    fontSize: '17px',
  },
  text: {
    margin: '4px 0 0',
    color: '#1e3a8a',
    fontSize: '13px',
  },
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  accepted: {
    borderRadius: '6px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '12px',
    fontWeight: 800,
    padding: '7px 9px',
  },
  pending: {
    borderRadius: '6px',
    background: '#fff7ed',
    color: '#9a3412',
    fontSize: '12px',
    fontWeight: 800,
    padding: '7px 9px',
  },
  button: {
    justifySelf: 'start',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 800,
    minHeight: '38px',
    padding: '0 14px',
  },
  ready: {
    color: '#166534',
    fontWeight: 800,
  },
};
