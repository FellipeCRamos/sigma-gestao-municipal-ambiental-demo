export const CAMPAIGN_STATUS_LABELS = {
  em_analise: 'Em análise',
  triagem: 'Triagem',
  pendente_documentacao: 'Pendente de documentação',
  pre_selecionado: 'Pré-selecionado',
  apto: 'Apto',
  inapto: 'Inapto',
  agendado: 'Agendado',
  atendido: 'Atendido',
  indeferido: 'Indeferido',
  ausente: 'Ausente',
  cancelada: 'Cancelada',
  encerrada: 'Encerrada',
};

export const SERVICE_LABELS = {
  castracao_microchipagem: 'Castração e microchipagem',
  vacinacao: 'Vacinação',
};

export const OCCURRENCE_TYPE_LABELS = {
  perda: 'Animal perdido',
  encontro: 'Animal encontrado',
  adocao: 'Adoção',
  obito: 'Óbito',
  zoonose: 'Zoonose',
  maus_tratos: 'Maus-tratos',
  outros: 'Outros',
};

export const OCCURRENCE_STATUS_LABELS = {
  aberta: 'Aberta',
  em_atendimento: 'Em atendimento',
  em_analise: 'Em análise',
  pendente_informacao: 'Pendente de informação',
  concluida: 'Concluída',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
  arquivada: 'Arquivada',
};

export const VACCINE_ORIGIN_LABELS = {
  campanha: 'Campanha pública',
  orgao_ambiental: 'Registro SMAD',
  tutor_declarado: 'Declarado pelo tutor',
  legado_jsonb: 'Legado/backfill',
};

export const VACCINE_STATUS_LABELS = {
  registrado: 'Registrado',
  comprovado: 'Comprovado',
  pendente_comprovacao: 'Pendente de comprovação',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

export const TERRITORIAL_LABELS = {
  nao_informado: 'Não informado',
  legado_textual: 'Legado textual',
  catalogo: 'Catálogo',
  controlado: 'Catálogo',
};

export const VIVEIRO_STATUS_LABELS = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  esgotado: 'Esgotado',
  bloqueado: 'Bloqueado',
  encerrado: 'Encerrado',
  pendente: 'Pendente',
  aprovada_total: 'Aprovada total',
  aprovada_parcial: 'Aprovada parcial',
  rejeitada: 'Rejeitada',
  entregue: 'Entregue',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  ativa: 'Ativa',
  consumida: 'Consumida',
};

export function displayLabel(value, labels, fallback = 'Não informado') {
  if (!value) return fallback;
  return labels[value] || value;
}

export const COMMUNICATION_DELIVERY_STATUS_LABELS = {
  pendente: 'Pendente',
  entregue: 'Entregue',
  erro: 'Falha temporária',
  falha_permanente: 'Falha permanente',
  ignorada: 'Ignorada',
};

export const COMMUNICATION_CHANNEL_LABELS = {
  portal: 'Portal',
  web_push: 'Web Push',
  email: 'E-mail',
};

export const COMMUNICATION_PRIORITY_LABELS = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const NOTIFICATION_TYPE_LABELS = {
  operacional: 'Operacional',
  campanha: 'Campanha',
  inscricao: 'Inscrição',
  ocorrencia: 'Ocorrência',
  carteira_vacinal: 'Carteira vacinal',
  teste_web_push: 'Teste Web Push',
};
