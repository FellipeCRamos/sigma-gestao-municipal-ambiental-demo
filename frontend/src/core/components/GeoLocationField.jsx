const TIPO_LABELS = {
  PONTO: 'Ponto',
  LINHA: 'Linha',
  POLIGONO: 'Poligono',
  MULTIPOLIGONO: 'Multipoligono',
};

function formatCoord(value) {
  if (value === null || value === undefined || value === '') return '-';
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 7 });
}

export default function GeoLocationField({
  value,
  label = 'Localizacao geoambiental',
  helperText = 'Componente preparado para vinculo futuro com Anuencia, Licenciamento, Fiscalizacao, Viveiro e Portal do Requerente.',
  onOpen,
  disabled = false,
}) {
  const hasValue = Boolean(value?.id || value?.codigo || value?.titulo);

  return (
    <section style={styles.wrapper} aria-label={label}>
      <div>
        <span style={styles.label}>{label}</span>
        {hasValue ? (
          <div style={styles.summary}>
            <strong>{value.codigo || `GEO #${value.id}`}</strong>
            <span>{value.titulo || 'Localizacao sem titulo informado'}</span>
            <small>
              {TIPO_LABELS[value.tipo_geometria] || value.tipo_geometria || 'Geometria'} - Lat {formatCoord(value.latitude)} / Long {formatCoord(value.longitude)}
            </small>
          </div>
        ) : (
          <p style={styles.empty}>Nenhuma localizacao vinculada.</p>
        )}
        {helperText ? <p style={styles.helper}>{helperText}</p> : null}
      </div>
      {onOpen ? (
        <button type="button" style={styles.button} onClick={onOpen} disabled={disabled}>
          Selecionar
        </button>
      ) : null}
    </section>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#f8fafc',
    padding: '14px',
  },
  label: {
    display: 'block',
    color: '#334155',
    fontSize: '13px',
    fontWeight: 800,
    marginBottom: '6px',
  },
  summary: {
    display: 'grid',
    gap: '3px',
    color: '#0f172a',
    fontSize: '13px',
  },
  empty: {
    margin: 0,
    color: '#475569',
    fontSize: '13px',
  },
  helper: {
    margin: '8px 0 0',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  button: {
    minHeight: '38px',
    border: '1px solid #0f766e',
    borderRadius: '8px',
    background: '#0f766e',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 800,
    padding: '0 14px',
  },
};
