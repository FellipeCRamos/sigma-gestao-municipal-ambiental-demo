import { VIVEIRO_STATUS_LABELS } from '../../../utils/displayLabels';

const COLORS = {
  navy: '#0d1b3d',
  text: '#172033',
  muted: '#5f6f83',
  border: '#d7e7dd',
  borderSoft: '#e7f0ea',
  surface: '#ffffff',
  surfaceSoft: '#f7fbf8',
  green: '#2e9e4b',
  greenDark: '#176a36',
  greenSoft: '#e8f7ed',
  blueSoft: '#eef7ff',
  amber: '#ffb703',
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
  const parsed = Number(value || 0);
  return parsed.toLocaleString('pt-BR', {
    minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function statusPill(status) {
  const map = {
    ativo: { label: 'Ativo', background: '#dcfce7', color: '#166534' },
    inativo: { label: 'Inativo', background: '#e5e7eb', color: '#374151' },
    esgotado: { label: 'Esgotado', background: '#fef3c7', color: '#92400e' },
    bloqueado: { label: 'Bloqueado', background: '#fee2e2', color: '#991b1b' },
    encerrado: { label: 'Encerrado', background: '#e5e7eb', color: '#374151' },
    pendente: { label: 'Pendente', background: '#dbeafe', color: '#1d4ed8' },
    aprovada_total: { label: 'Aprovada total', background: '#dcfce7', color: '#166534' },
    aprovada_parcial: { label: 'Aprovada parcial', background: '#fef3c7', color: '#92400e' },
    rejeitada: { label: 'Rejeitada', background: '#fee2e2', color: '#991b1b' },
    entregue: { label: 'Entregue', background: '#dcfce7', color: '#166534' },
    concluida: { label: VIVEIRO_STATUS_LABELS.concluida, background: '#dcfce7', color: '#166534' },
    cancelada: { label: 'Cancelada', background: '#fee2e2', color: '#991b1b' },
    ativa: { label: 'Ativa', background: '#dbeafe', color: '#1d4ed8' },
    consumida: { label: 'Consumida', background: '#dcfce7', color: '#166534' },
  };

  return map[status] || {
    label: VIVEIRO_STATUS_LABELS[status] || status || '-',
    background: '#f3f4f6',
    color: '#374151',
  };
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
    boxShadow: '0 14px 32px rgba(23, 74, 45, 0.08)',
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
    outlineColor: COLORS.green,
    boxShadow: '0 1px 0 rgba(15, 61, 46, 0.02)',
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
    outlineColor: COLORS.green,
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
    border: `1px solid ${COLORS.greenDark}`,
    background: `linear-gradient(180deg, ${COLORS.green} 0%, ${COLORS.greenDark} 100%)`,
    color: '#ffffff',
    fontWeight: 800,
    padding: '0 16px',
    cursor: 'pointer',
    boxShadow: '0 10px 20px rgba(23, 106, 54, 0.18)',
  },
  buttonSecondary: {
    minHeight: '42px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    background: '#ffffff',
    color: COLORS.greenDark,
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
    background: `linear-gradient(90deg, ${COLORS.greenSoft} 0, ${COLORS.greenSoft} 6px, #ffffff 6px, #ffffff 100%)`,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    padding: '18px',
    boxShadow: '0 12px 28px rgba(15, 61, 46, 0.08)',
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
    color: COLORS.greenDark,
    fontSize: '30px',
    lineHeight: 1,
    fontWeight: 900,
  },
};
