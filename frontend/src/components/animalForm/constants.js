export const INITIAL_FORM = {
  nome: '',
  especie: '',
  raca: '',
  raca_outros: '',
  sexo: '',
  porte: '',
  peso_kg: '',
  cor: '',
  data_nascimento: '',
  status: 'ativo',
  microchip: '',
  castrado: false,
  castracao_pendente: false,
  vacinado: false,
  vacinas: [],
  tutor_id: '',
  territorio_id: '',
  observacoes: '',
  bairro: '',
  endereco_referencia: '',
  latitude: '',
  longitude: '',
};

export const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'acompanhamento', label: 'Em acompanhamento' },
  { value: 'tratamento', label: 'Em tratamento' },
  { value: 'disponivel_adoao', label: 'Disponível para adoção' },
  { value: 'adotado', label: 'Adotado' },
  { value: 'inativo', label: 'Inativo' },
];

export const PORTE_RULES = {
  pequeno: { min: 0, max: 10, label: 'Pequeno (0 a 10 kg)' },
  medio: { min: 10.01, max: 20, label: 'Médio (10,01 a 20 kg)' },
  grande: { min: 20.01, max: 999, label: 'Grande (acima de 20 kg)' },
};

export const PORTE_OPTIONS = [
  { value: 'pequeno', label: PORTE_RULES.pequeno.label },
  { value: 'medio', label: PORTE_RULES.medio.label },
  { value: 'grande', label: PORTE_RULES.grande.label },
];

export const RACAS_POR_ESPECIE = {
  canino: [
    { value: 'srd', label: 'SRD / Vira-lata' },
    { value: 'pinscher', label: 'Pinscher' },
    { value: 'poodle', label: 'Poodle' },
    { value: 'shih_tzu', label: 'Shih Tzu' },
    { value: 'lhasa_apso', label: 'Lhasa Apso' },
    { value: 'yorkshire', label: 'Yorkshire Terrier' },
    { value: 'spitz_alemao', label: 'Spitz Alemao' },
    { value: 'bulldog_frances', label: 'Bulldog Frances' },
    { value: 'bulldog_ingles', label: 'Bulldog Ingles' },
    { value: 'pastor_alemao', label: 'Pastor Alemao' },
    { value: 'rottweiler', label: 'Rottweiler' },
    { value: 'labrador', label: 'Labrador Retriever' },
    { value: 'golden_retriever', label: 'Golden Retriever' },
    { value: 'border_collie', label: 'Border Collie' },
    { value: 'beagle', label: 'Beagle' },
    { value: 'dachshund', label: 'Dachshund / Salsicha' },
    { value: 'pitbull', label: 'Pit Bull' },
    { value: 'outros', label: 'Outros' },
  ],
  felino: [
    { value: 'srd', label: 'SRD / Sem raça definida' },
    { value: 'siames', label: 'Siames' },
    { value: 'persa', label: 'Persa' },
    { value: 'maine_coon', label: 'Maine Coon' },
    { value: 'angora', label: 'Angora' },
    { value: 'ragdoll', label: 'Ragdoll' },
    { value: 'bengal', label: 'Bengal' },
    { value: 'sphynx', label: 'Sphynx' },
    { value: 'british_shorthair', label: 'British Shorthair' },
    { value: 'outros', label: 'Outros' },
  ],
};

export const VACINAS_POR_ESPECIE = {
  canino: [
    {
      value: 'vanguard_plus',
      nome_comercial: 'Vanguard Plus',
      nome_tecnico: 'Vacina múltipla canina',
      nome_popular: 'V10 / Polivalente canina',
      essencial: true,
      descricao: 'Proteção múltipla contra principais doencas infecciosas caninas.',
      detalhamento:
        'Cobre cinomose, hepatite infecciosa canina, adenovírus tipo 2, parainfluenza, parvovirose, coronavirose e leptospiroses.',
    },
    {
      value: 'nobivac_dhppil',
      nome_comercial: 'Nobivac DHPPI+L',
      nome_tecnico: 'Vacina múltipla canina',
      nome_popular: 'Polivalente canina',
      essencial: true,
      descricao: 'Vacina múltipla para imunização de cães saudáveis.',
      detalhamento:
        'Protege contra cinomose, hepatite infecciosa, parvovirose, parainfluenza e leptospirose.',
    },
    {
      value: 'defensor_raiva',
      nome_comercial: 'Defensor',
      nome_tecnico: 'Vacina antirrábica',
      nome_popular: 'Raiva',
      essencial: true,
      descricao: 'Vacina para prevenção da raiva em cães e gatos.',
      detalhamento:
        'Indicada como proteção contra o vírus da raiva, importante zoonose de interesse em saúde pública.',
    },
    {
      value: 'nobivac_raiva',
      nome_comercial: 'Nobivac Raiva',
      nome_tecnico: 'Vacina antirrábica',
      nome_popular: 'Raiva',
      essencial: true,
      descricao: 'Vacina antirrábica para cães, gatos e ferrets.',
      detalhamento:
        'Utilizada para imunização ativa contra a raiva, com revacinação conforme protocolo veterinário.',
    },
    {
      value: 'bronchiguard',
      nome_comercial: 'BronchiGuard',
      nome_tecnico: 'Vacina contra traqueobronquite infecciosa canina',
      nome_popular: 'Tosse dos canis',
      essencial: false,
      descricao: 'Proteção respiratória complementar para cães.',
      detalhamento:
        'Indicada para prevenção da traqueobronquite infecciosa, associada principalmente a Bordetella bronchiseptica.',
    },
    {
      value: 'nobivac_kc',
      nome_comercial: 'Nobivac KC',
      nome_tecnico: 'Vacina contra traqueobronquite infecciosa canina',
      nome_popular: 'Tosse dos canis',
      essencial: false,
      descricao: 'Vacina complementar para proteção respiratória.',
      detalhamento:
        'Atua contra Bordetella bronchiseptica e parainfluenza canina em protocolos de prevenção respiratória.',
    },
  ],
  felino: [
    {
      value: 'nobivac_feline_hcp',
      nome_comercial: 'Nobivac Feline 1-HCP',
      nome_tecnico: 'Vacina tríplice felina',
      nome_popular: 'V3',
      essencial: true,
      descricao: 'Vacina tríplice para proteção básica felina.',
      detalhamento:
        'Protege contra rinotraqueite, calicivirose e panleucopenia felinas.',
    },
    {
      value: 'nobivac_feline_hcpch',
      nome_comercial: 'Nobivac Feline 1-HCPCh',
      nome_tecnico: 'Vacina quádrupla felina',
      nome_popular: 'V4',
      essencial: true,
      descricao: 'Vacina quádrupla felina com cobertura ampliada.',
      detalhamento:
        'Protege contra rinotraqueite, calicivirose, panleucopenia e Chlamydia psittaci.',
    },
    {
      value: 'felocell_cvr_c',
      nome_comercial: 'Felocell CVR-C',
      nome_tecnico: 'Vacina quádrupla felina',
      nome_popular: 'V4',
      essencial: true,
      descricao: 'Vacina quádrupla para doencas infecciosas felinas.',
      detalhamento:
        'Indicada contra rinotraqueite, calicivirose, panleucopenia e clamidiose felina.',
    },
    {
      value: 'nobivac_hcpch_felv',
      nome_comercial: 'Nobivac Feline 1-HCPCh + FeLV',
      nome_tecnico: 'Vacina quíntupla felina',
      nome_popular: 'V5',
      essencial: true,
      descricao: 'Vacina quíntupla com cobertura contra leucemia felina.',
      detalhamento:
        'Protege contra rinotraqueite, calicivirose, panleucopenia, Chlamydia psittaci e FeLV.',
    },
    {
      value: 'fel_o_vax_lvk_iv_calicivax',
      nome_comercial: 'Fel-O-Vax LvK IV + CaliciVax',
      nome_tecnico: 'Vacina quíntupla felina',
      nome_popular: 'V5',
      essencial: true,
      descricao: 'Vacina quíntupla felina com proteção ampliada.',
      detalhamento:
        'Indicada contra rinotraqueite, calicivirose, panleucopenia, clamidiose e leucemia felina.',
    },
    {
      value: 'defensor_raiva_felino',
      nome_comercial: 'Defensor',
      nome_tecnico: 'Vacina antirrábica',
      nome_popular: 'Raiva',
      essencial: true,
      descricao: 'Vacina antirrábica aplicável a felinos.',
      detalhamento:
        'Usada para imunização contra raiva, zoonose de relevância sanitária.',
    },
    {
      value: 'nobivac_raiva_felino',
      nome_comercial: 'Nobivac Raiva',
      nome_tecnico: 'Vacina antirrábica',
      nome_popular: 'Raiva',
      essencial: true,
      descricao: 'Vacina antirrábica para proteção felina.',
      detalhamento:
        'Aplicada conforme protocolo veterinário para prevenção do vírus da raiva.',
    },
  ],
};
