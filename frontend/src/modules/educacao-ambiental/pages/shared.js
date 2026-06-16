export const EDUCACAO_STATUS_LABELS = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
  arquivado: 'Arquivado',
  rejeitado: 'Rejeitado',
  programado: 'Programado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
  vigente: 'Vigente',
  revogada: 'Revogada',
  alterada: 'Alterada',
  substituida: 'Substituída',
  nao_verificada: 'Não verificada',
  nao_validado: 'Não validado',
  em_validacao: 'Em validação',
  validado: 'Validado',
  planejado: 'Planejado',
  em_execucao: 'Em execução',
  concluido: 'Concluído',
  suspenso: 'Suspenso',
  nao_iniciado: 'Não iniciado',
  em_levantamento: 'Em levantamento',
  em_curadoria: 'Em curadoria',
  pendente_fonte: 'Pendente de fonte',
  pendente_validacao_tecnica: 'Pendente de validação técnica',
  pendente_validacao_juridica: 'Pendente de validação jurídica',
  validado_tecnicamente: 'Validado tecnicamente',
  validado_juridicamente: 'Validado juridicamente',
  apto_publicacao: 'Apto para publicação',
  fonte_oficial_primaria: 'Fonte oficial primária',
  fonte_oficial_secundaria: 'Fonte oficial secundária',
  fonte_tecnica_reconhecida: 'Fonte técnica reconhecida',
  fonte_academica: 'Fonte acadêmica',
  fonte_institucional_nao_verificada: 'Fonte institucional não verificada',
  levantamento_interno_sem_validacao: 'Levantamento interno sem validação',
  relato_comunitario: 'Relato comunitário',
  referencial_para_curadoria: 'Referencial para curadoria',
  a_verificar: 'A verificar',
  ativa: 'Ativa',
  inativa: 'Inativa',
  ativo: 'Ativo',
  mundial: 'Mundial',
  nacional: 'Nacional',
  nacional_mundial: 'Nacional/mundial',
  interamericano: 'Interamericano',
  estadual: 'Estadual',
  municipal: 'Municipal',
};

export function labelStatus(value) {
  return EDUCACAO_STATUS_LABELS[value] || value || '-';
}

export function statusBadgeStyle(value) {
  const map = {
    publicado: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    aprovado: { background: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
    em_revisao: { background: '#fef3c7', color: '#92400e', border: '#fde68a' },
    rascunho: { background: '#f3f4f6', color: '#374151', border: '#e5e7eb' },
    arquivado: { background: '#e5e7eb', color: '#374151', border: '#d1d5db' },
    rejeitado: { background: '#fee2e2', color: '#991b1b', border: '#fecaca' },
    nao_verificada: { background: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    nao_validado: { background: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    validado: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    validado_tecnicamente: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    validado_juridicamente: { background: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
    apto_publicacao: { background: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
    pendente_fonte: { background: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    pendente_validacao_tecnica: { background: '#fef3c7', color: '#92400e', border: '#fde68a' },
    pendente_validacao_juridica: { background: '#fef3c7', color: '#92400e', border: '#fde68a' },
    fonte_oficial_primaria: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    fonte_oficial_secundaria: { background: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
    fonte_tecnica_reconhecida: { background: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },
    fonte_academica: { background: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
    levantamento_interno_sem_validacao: { background: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    relato_comunitario: { background: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
    referencial_para_curadoria: { background: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
    a_verificar: { background: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
  };

  return {
    ...styles.badge,
    ...(map[value] || { background: '#f3f4f6', color: '#374151', border: '#e5e7eb' }),
  };
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}

export function unpackList(payload) {
  if (Array.isArray(payload)) {
    return { items: payload, pagination: null };
  }

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pagination: payload?.pagination || null,
  };
}

export function toInputValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function normalizeFormPayload(fields, form) {
  return fields.reduce((acc, field) => {
    const value = form[field.name];

    if (field.type === 'checkbox') {
      acc[field.name] = Boolean(value);
      return acc;
    }

    if (field.kind === 'json') {
      acc[field.name] = String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      return acc;
    }

    if (field.type === 'number') {
      acc[field.name] = value === '' || value === undefined ? null : Number(value);
      return acc;
    }

    acc[field.name] = value === undefined ? '' : value;
    return acc;
  }, {});
}

export const styles = {
  page: {
    display: 'grid',
    gap: '22px',
    color: '#172033',
  },
  section: {
    background: '#ffffff',
    border: '1px solid #d7e8dd',
    borderRadius: '8px',
    padding: '22px',
    boxShadow: '0 14px 32px rgba(23, 94, 74, 0.08)',
  },
  band: {
    background: '#f7fbf9',
    borderTop: '1px solid #d7e8dd',
    borderBottom: '1px solid #d7e8dd',
    padding: '22px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '22px',
    lineHeight: 1.2,
    color: '#0d1b3d',
    fontWeight: 850,
  },
  sectionSubtitle: {
    margin: '6px 0 0',
    color: '#5f6f83',
    fontSize: '13px',
    lineHeight: 1.5,
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
  metric: {
    background: 'linear-gradient(90deg, #e8f7ed 0, #e8f7ed 6px, #ffffff 6px, #ffffff 100%)',
    border: '1px solid #d7e8dd',
    borderRadius: '8px',
    padding: '18px',
  },
  metricLabel: {
    margin: 0,
    color: '#5f6f83',
    fontSize: '13px',
    fontWeight: 750,
  },
  metricValue: {
    margin: '8px 0 0',
    color: '#176a36',
    fontSize: '30px',
    lineHeight: 1,
    fontWeight: 900,
  },
  filters: {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
  },
  formGrid: {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
  },
  label: {
    display: 'grid',
    gap: '6px',
    color: '#0d1b3d',
    fontSize: '13px',
    fontWeight: 750,
  },
  input: {
    width: '100%',
    minHeight: '42px',
    borderRadius: '8px',
    border: '1px solid #cfe3d7',
    background: '#ffffff',
    color: '#172033',
    padding: '10px 12px',
    fontSize: '14px',
    outlineColor: '#198754',
  },
  textarea: {
    width: '100%',
    minHeight: '104px',
    borderRadius: '8px',
    border: '1px solid #cfe3d7',
    background: '#ffffff',
    color: '#172033',
    padding: '10px 12px',
    fontSize: '14px',
    outlineColor: '#198754',
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
    border: '1px solid #176a36',
    background: 'linear-gradient(180deg, #2da94f 0%, #16823b 100%)',
    color: '#ffffff',
    fontWeight: 850,
    padding: '0 16px',
    cursor: 'pointer',
  },
  buttonSecondary: {
    minHeight: '42px',
    borderRadius: '8px',
    border: '1px solid #cfe3d7',
    background: '#ffffff',
    color: '#176a36',
    fontWeight: 800,
    padding: '0 16px',
    cursor: 'pointer',
  },
  buttonDanger: {
    minHeight: '38px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#991b1b',
    fontWeight: 800,
    padding: '0 12px',
    cursor: 'pointer',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #e4efe8',
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
    borderBottom: '1px solid #d7e8dd',
    background: '#effaf3',
    color: '#0d1b3d',
    fontWeight: 850,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid #e4efe8',
    verticalAlign: 'top',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '28px',
    borderRadius: '999px',
    border: '1px solid',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 850,
    whiteSpace: 'nowrap',
  },
  message: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #d7e8dd',
    background: '#f7fbf9',
    color: '#334155',
    fontSize: '14px',
    fontWeight: 650,
  },
  error: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#991b1b',
    fontSize: '14px',
    fontWeight: 750,
  },
};
