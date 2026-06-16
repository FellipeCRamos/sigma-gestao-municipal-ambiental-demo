export const LICENCIAMENTO_STATUS_LABELS = {
  protocolado: 'Protocolado',
  em_triagem: 'Em triagem',
  em_diligencia: 'Em diligência',
  em_analise_tecnica: 'Em análise técnica',
  aguardando_manifestacao: 'Aguardando manifestação',
  apto_para_decisao: 'Apto para decisão',
  deferido: 'Deferido',
  indeferido: 'Indeferido',
  arquivado: 'Arquivado',
  licenca_emitida: 'Licença emitida',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
};

export const LICENCIAMENTO_STATUS_OPTIONS = Object.entries(LICENCIAMENTO_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const COLORS = {
  navy: '#0d1b3d',
  text: '#172033',
  muted: '#5f6f83',
  border: '#d8e5f2',
  borderSoft: '#e7eef7',
  surface: '#ffffff',
  surfaceSoft: '#f7fbff',
  blue: '#1e5cc8',
  blueDark: '#0d3f8f',
  blueSoft: '#eaf3ff',
  green: '#2e9e4b',
  amber: '#ffb703',
  red: '#dc2626',
};

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
}

export function formatDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

export function unpackListPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      pagination: null,
    };
  }

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pagination: payload?.pagination || null,
  };
}

export function statusPill(status) {
  const map = {
    protocolado: { background: '#dbeafe', color: '#1d4ed8' },
    em_triagem: { background: '#e0f2fe', color: '#0369a1' },
    em_diligencia: { background: '#fef3c7', color: '#92400e' },
    em_analise_tecnica: { background: '#ede9fe', color: '#6d28d9' },
    aguardando_manifestacao: { background: '#fef9c3', color: '#854d0e' },
    apto_para_decisao: { background: '#dcfce7', color: '#166534' },
    deferido: { background: '#dcfce7', color: '#166534' },
    indeferido: { background: '#fee2e2', color: '#991b1b' },
    arquivado: { background: '#e5e7eb', color: '#374151' },
    licenca_emitida: { background: '#dcfce7', color: '#166534' },
    suspenso: { background: '#ffedd5', color: '#9a3412' },
    cancelado: { background: '#fee2e2', color: '#991b1b' },
  };

  return {
    label: LICENCIAMENTO_STATUS_LABELS[status] || status || '-',
    ...(map[status] || { background: '#f3f4f6', color: '#374151' }),
  };
}

export const pageStyles = {
  page: {
    display: 'grid',
    gap: '22px',
    color: COLORS.text,
  },
  section: {
    background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.surfaceSoft} 100%)`,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '22px',
    boxShadow: '0 14px 32px rgba(13, 63, 143, 0.08)',
  },
  sectionTitle: {
    margin: '0 0 14px 0',
    fontSize: '20px',
    lineHeight: 1.2,
    color: COLORS.navy,
    fontWeight: 850,
  },
  sectionSubtitle: {
    margin: '6px 0 0 0',
    color: COLORS.muted,
    fontSize: '13px',
    lineHeight: 1.45,
  },
  grid2: {
    display: 'grid',
    gap: '18px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))',
  },
  grid3: {
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
  },
  formGrid: {
    display: 'grid',
    gap: '14px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  },
  label: {
    display: 'grid',
    gap: '6px',
    color: COLORS.navy,
    fontSize: '13px',
    fontWeight: 750,
  },
  input: {
    width: '100%',
    minHeight: '42px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    background: '#ffffff',
    color: COLORS.text,
    padding: '10px 12px',
    fontSize: '14px',
    outlineColor: COLORS.blue,
  },
  textarea: {
    width: '100%',
    minHeight: '96px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    background: '#ffffff',
    color: COLORS.text,
    padding: '10px 12px',
    fontSize: '14px',
    outlineColor: COLORS.blue,
    resize: 'vertical',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '12px',
  },
  buttonPrimary: {
    minHeight: '42px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.blueDark}`,
    background: `linear-gradient(180deg, ${COLORS.blue} 0%, ${COLORS.blueDark} 100%)`,
    color: '#ffffff',
    fontWeight: 800,
    padding: '0 16px',
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(13, 63, 143, 0.18)',
  },
  buttonSecondary: {
    minHeight: '42px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    background: '#ffffff',
    color: COLORS.blueDark,
    fontWeight: 750,
    padding: '0 16px',
    cursor: 'pointer',
  },
  message: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.borderSoft}`,
    fontSize: '14px',
    fontWeight: 650,
  },
  tableWrap: {
    overflowX: 'auto',
    border: `1px solid ${COLORS.borderSoft}`,
    borderRadius: '8px',
    background: '#ffffff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.blueSoft,
    color: COLORS.navy,
    fontWeight: 850,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    borderBottom: `1px solid ${COLORS.borderSoft}`,
    verticalAlign: 'top',
    color: COLORS.text,
  },
  cardMetric: {
    position: 'relative',
    overflow: 'hidden',
    background: `linear-gradient(90deg, ${COLORS.blueSoft} 0, ${COLORS.blueSoft} 6px, #ffffff 6px, #ffffff 100%)`,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '18px',
    boxShadow: '0 12px 28px rgba(13, 63, 143, 0.08)',
  },
  metricLabel: {
    margin: 0,
    color: COLORS.muted,
    fontSize: '13px',
    fontWeight: 750,
    lineHeight: 1.25,
  },
  metricValue: {
    margin: '8px 0 0 0',
    color: COLORS.blueDark,
    fontSize: '30px',
    lineHeight: 1,
    fontWeight: 900,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  muted: {
    color: COLORS.muted,
  },
  dangerText: {
    color: COLORS.red,
  },
  okText: {
    color: COLORS.green,
  },
  warningText: {
    color: COLORS.amber,
  },
};
