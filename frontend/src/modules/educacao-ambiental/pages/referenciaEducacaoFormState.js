export const referenciaInitialForm = {
  entidade_tipo: 'conteudo',
  entidade_id: '',
  fonte_id: '',
  titulo_referencia: '',
  tipo_evidencia: 'outro',
  confiabilidade: 'nao_verificado',
  url: '',
  pagina: '',
  data_acesso: '',
  descricao: '',
  trecho_relevante: '',
  observacoes: '',
};

export function normalizeReferenciaForm(form) {
  return {
    ...form,
    entidade_id: form.entidade_id ? Number(form.entidade_id) : null,
    fonte_id: form.fonte_id ? Number(form.fonte_id) : null,
  };
}
