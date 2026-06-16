const TONES = {
  RASCUNHO: ['#f8fafc', '#475569'],
  RECEBIDO_PENDENTE_TRIAGEM: ['#ecfeff', '#0e7490'],
  EM_TRIAGEM_SMAD: ['#eef2ff', '#4338ca'],
  DEVOLVIDO_PARA_COMPLEMENTACAO: ['#fff7ed', '#c2410c'],
  COMPLEMENTADO: ['#f0fdf4', '#15803d'],
  ACEITO_GEROU_PROCESSO_INTERNO: ['#dcfce7', '#166534'],
  RECUSADO_FUNDAMENTADO: ['#fef2f2', '#b91c1c'],
  ARQUIVADO: ['#f1f5f9', '#334155'],
};

function label(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

export default function RequerenteStatusBadge({ status }) {
  const [background, color] = TONES[status] || ['#f8fafc', '#334155'];
  return (
    <span style={{ ...styles.badge, background, color }}>
      {label(status)}
    </span>
  );
}

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '26px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 800,
    padding: '0 10px',
    textTransform: 'uppercase',
  },
};
