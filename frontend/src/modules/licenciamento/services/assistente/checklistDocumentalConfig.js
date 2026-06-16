const RECYCLING_CHECKLIST = [
  'Documento pessoal ou CNPJ/MEI.',
  'Comprovante de endereco.',
  'Croqui simples ou localizacao do imovel.',
  'Fotos internas e externas do local.',
  'Descricao dos materiais recebidos.',
  'Declaracao de nao recebimento de residuos perigosos, quando aplicavel.',
  'Comprovante ou declaracao de destinacao dos rejeitos.',
  'Manifestacao de viabilidade urbanistica/uso do solo, quando aplicavel.',
  'Procuracao, se o requerimento for feito por terceiro.',
  'ART/TRT apenas quando tecnicamente exigivel em etapa posterior.',
];

const GENERIC_CHECKLIST = [
  'Documento pessoal ou CNPJ/MEI.',
  'Comprovante de endereco.',
  'Descricao da atividade pretendida.',
  'Croqui ou localizacao do imovel.',
  'Fotos do local, quando aplicavel.',
  'Documentos tecnicos complementares conforme analise da SMAD.',
];

export function getChecklistDocumentalPreliminar(slug) {
  if (slug === 'reciclagem_ferro_velho_sucata') {
    return RECYCLING_CHECKLIST;
  }

  return GENERIC_CHECKLIST;
}
