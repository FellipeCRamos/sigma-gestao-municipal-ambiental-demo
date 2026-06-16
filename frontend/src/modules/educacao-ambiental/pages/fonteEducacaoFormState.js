export const fonteInitialForm = {
  nome: '',
  tipo_fonte: 'outro',
  esfera: 'nao_aplicavel',
  orgao_responsavel: '',
  url: '',
  confiabilidade_padrao: 'nao_verificado',
  status: 'referencial_para_curadoria',
  periodicidade_atualizacao: '',
  descricao: '',
  observacoes: '',
  temas_relacionados: '',
};

export function normalizeFonteForm(form) {
  return {
    ...form,
    temas_relacionados: String(form.temas_relacionados || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}
