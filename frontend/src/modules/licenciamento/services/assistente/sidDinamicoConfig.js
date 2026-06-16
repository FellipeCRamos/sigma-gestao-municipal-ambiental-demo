export const RECYCLING_SLUG = 'reciclagem_ferro_velho_sucata';

const RECYCLING_FIELDS = [
  {
    key: 'tipo_pessoa',
    label: 'Tipo de pessoa',
    type: 'select',
    required: true,
    options: [
      ['fisica', 'Pessoa fisica'],
      ['juridica', 'Pessoa juridica'],
      ['mei', 'MEI'],
      ['associacao_cooperativa', 'Associacao/cooperativa'],
    ],
  },
  {
    key: 'tipo_imovel',
    label: 'Tipo de imovel',
    type: 'select',
    required: true,
    options: [
      ['residencial', 'Residencial'],
      ['comercial', 'Comercial'],
      ['galpao', 'Galpao'],
      ['terreno_aberto', 'Terreno aberto'],
      ['area_rural', 'Area rural'],
      ['outro', 'Outro'],
    ],
  },
  {
    key: 'local_exercicio',
    label: 'A atividade sera exercida',
    type: 'select',
    required: true,
    options: [
      ['quintal_residencia', 'No quintal da residencia'],
      ['galpao', 'Em galpao'],
      ['loja_comercio', 'Em loja/comercio'],
      ['terreno_aberto', 'Em terreno aberto'],
      ['area_compartilhada', 'Em area compartilhada'],
      ['outro', 'Outro'],
    ],
  },
  {
    key: 'materiais_recebidos',
    label: 'Materiais que serao recebidos ou armazenados',
    type: 'checkboxGroup',
    required: true,
    options: [
      ['ferro_sucata_metalica', 'Ferro/sucata metalica'],
      ['aluminio', 'Aluminio'],
      ['cobre', 'Cobre'],
      ['papel_papelao', 'Papel/papelao'],
      ['plastico', 'Plastico'],
      ['vidro', 'Vidro'],
      ['eletroeletronicos', 'Eletroeletronicos'],
      ['pneus', 'Pneus'],
      ['baterias', 'Baterias'],
      ['oleo_lubrificantes', 'Oleo/lubrificantes'],
      ['madeira', 'Madeira'],
      ['residuos_mistos', 'Residuos mistos'],
      ['residuos_quimicos', 'Residuos quimicos'],
      ['residuos_saude', 'Residuos de saude'],
      ['residuos_contaminados', 'Residuos contaminados'],
      ['outros', 'Outros'],
    ],
  },
  {
    key: 'operacoes',
    label: 'Havera apenas armazenamento ou tambem alguma operacao?',
    type: 'checkboxGroup',
    required: true,
    options: [
      ['armazenamento_temporario', 'Apenas recebimento e armazenamento temporario'],
      ['triagem_manual', 'Triagem/separacao manual'],
      ['prensagem', 'Prensagem'],
      ['corte', 'Corte'],
      ['desmontagem', 'Desmontagem'],
      ['trituracao', 'Trituracao'],
      ['lavagem', 'Lavagem'],
      ['queima', 'Queima'],
      ['beneficiamento', 'Beneficiamento'],
      ['outro', 'Outro'],
    ],
  },
  {
    key: 'area_armazenamento_m2',
    label: 'Area aproximada utilizada para armazenamento',
    type: 'number',
    unit: 'm2',
    required: true,
    min: 0,
  },
  {
    key: 'tipo_piso',
    label: 'O material ficara',
    type: 'checkboxGroup',
    required: true,
    options: [
      ['piso_impermeabilizado', 'Sobre piso impermeabilizado'],
      ['piso_cimentado', 'Sobre piso cimentado'],
      ['diretamente_solo', 'Diretamente no solo'],
      ['pallets_estrados', 'Sobre pallets/estrados'],
      ['cacambas', 'Em cacambas'],
      ['area_coberta', 'Em area coberta'],
      ['area_descoberta', 'Em area descoberta'],
    ],
  },
  {
    key: 'possui_cobertura',
    label: 'O local possui cobertura?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['parcialmente', 'Parcialmente'],
    ],
  },
  {
    key: 'drenagem_pluvial',
    label: 'Existe drenagem pluvial no local?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
  {
    key: 'curso_hidrico_proximo',
    label: 'Existe curso d agua, nascente, brejo, vala, corrego ou area alagavel proximo?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
  {
    key: 'intervencao_app',
    label: 'Ha intervencao em APP?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
  {
    key: 'supressao_vegetacao',
    label: 'Ha supressao de vegetacao?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
  {
    key: 'uso_recurso_hidrico',
    label: 'Havera uso de recurso hidrico?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
  {
    key: 'efluente_liquido',
    label: 'Havera geracao de efluente liquido?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
  {
    key: 'incomodo_vizinhanca',
    label: 'Havera geracao de ruido, poeira ou trafego frequente de caminhoes?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
  {
    key: 'armazenamento_solo',
    label: 'Havera armazenamento de material diretamente no solo?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
    ],
  },
  {
    key: 'semob_viabilidade',
    label: 'Possui manifestacao urbanistica da SEMOB ou viabilidade de uso do solo?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['ja_solicitei', 'Ja solicitei'],
      ['nao_sei', 'Nao sei o que e isso'],
    ],
  },
  {
    key: 'possui_fotos',
    label: 'Possui fotos do local?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
    ],
  },
  {
    key: 'comprovante_endereco',
    label: 'Possui comprovante de endereco do imovel?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
    ],
  },
  {
    key: 'cnpj_mei_inscricao',
    label: 'Possui CNPJ, MEI ou inscricao municipal?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['em_andamento', 'Em andamento'],
      ['nao_se_aplica', 'Nao se aplica'],
    ],
  },
];

const GENERIC_FIELDS = [
  {
    key: 'descricao_detalhada',
    label: 'Descreva mais detalhes da atividade',
    type: 'textarea',
    required: true,
  },
  {
    key: 'localizacao',
    label: 'Informe a localizacao aproximada',
    type: 'text',
    required: false,
  },
  {
    key: 'possui_app_ou_supressao',
    label: 'Ha APP, curso hidrico, supressao de vegetacao ou outro risco ambiental aparente?',
    type: 'select',
    required: true,
    options: [
      ['sim', 'Sim'],
      ['nao', 'Nao'],
      ['nao_sei', 'Nao sei'],
    ],
  },
];

export function getSidDinamicoConfig(slug) {
  if (slug === RECYCLING_SLUG) {
    return {
      slug,
      titulo: 'Formulario orientado para reciclagem, ferro velho e sucata',
      descricao:
        'Responda as perguntas abaixo para que a SMAD possa avaliar preliminarmente as condicoes do local, os materiais recebidos e os riscos ambientais.',
      specific: true,
      fields: RECYCLING_FIELDS,
    };
  }

  return {
    slug: slug || 'atividade_generica',
    titulo: 'Formulario preliminar em construcao',
    descricao:
      'Esta atividade ainda nao possui formulario especifico nesta versao. Informe dados minimos e utilize o modo tecnico avancado se ja souber o codigo ambiental.',
    specific: false,
    fields: GENERIC_FIELDS,
  };
}

export function getInitialResponses(config) {
  return config.fields.reduce((accumulator, field) => {
    if (field.type === 'checkboxGroup') {
      accumulator[field.key] = [];
    } else {
      accumulator[field.key] = '';
    }
    return accumulator;
  }, {});
}
