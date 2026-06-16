import RequerenteStatusBadge from '../components/RequerenteStatusBadge';

function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

export default function PortalRequerenteRequerimentos({ requerimentos = [], onSelect, onNew }) {
  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Meus Requerimentos</h2>
          <p style={styles.text}>Acompanhe apenas os requerimentos vinculados ao seu cadastro.</p>
        </div>
        <button type="button" style={styles.button} onClick={onNew}>Novo requerimento</button>
      </div>
      <div style={styles.list}>
        {requerimentos.map((item) => (
          <button type="button" key={item.id} style={styles.item} onClick={() => onSelect?.(item)}>
            <div style={styles.itemHeader}>
              <strong>{item.codigo}</strong>
              <RequerenteStatusBadge status={item.status} />
            </div>
            <span>{item.finalidade}</span>
            <small>{label(item.tipo_solicitacao)} - {item.distrito || 'Distrito nao informado'} - {new Date(item.updated_at || item.created_at).toLocaleDateString('pt-BR')}</small>
          </button>
        ))}
        {!requerimentos.length ? <p style={styles.empty}>Nenhum requerimento cadastrado.</p> : null}
      </div>
    </section>
  );
}

const styles = {
  section: {
    display: 'grid',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    color: '#0f172a',
    fontSize: '22px',
  },
  text: {
    margin: '4px 0 0',
    color: '#64748b',
  },
  button: {
    minHeight: '40px',
    border: 0,
    borderRadius: '6px',
    background: '#0f766e',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 900,
    padding: '0 14px',
  },
  list: {
    display: 'grid',
    gap: '10px',
  },
  item: {
    display: 'grid',
    gap: '8px',
    textAlign: 'left',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#ffffff',
    cursor: 'pointer',
    padding: '14px',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  empty: {
    color: '#64748b',
    margin: 0,
  },
};
