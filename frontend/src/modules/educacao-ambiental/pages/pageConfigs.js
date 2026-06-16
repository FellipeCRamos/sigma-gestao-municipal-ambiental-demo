const publicationStatusOptions = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'arquivado', label: 'Arquivado' },
  { value: 'rejeitado', label: 'Rejeitado' },
];

const levelOptions = [
  { value: 'basico', label: 'Básico' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
  { value: 'infantil', label: 'Infantil' },
  { value: 'juvenil', label: 'Juvenil' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'cidadania', label: 'Cidadania' },
];

export const curadoriaStatusOptions = [
  'nao_iniciado',
  'em_levantamento',
  'em_curadoria',
  'pendente_fonte',
  'pendente_validacao_tecnica',
  'pendente_validacao_juridica',
  'validado_tecnicamente',
  'validado_juridicamente',
  'apto_publicacao',
  'publicado',
  'suspenso',
  'arquivado',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export const confiabilidadeOptions = [
  'fonte_oficial_primaria',
  'fonte_oficial_secundaria',
  'fonte_tecnica_reconhecida',
  'fonte_academica',
  'fonte_institucional_nao_verificada',
  'levantamento_interno_sem_validacao',
  'relato_comunitario',
  'nao_verificado',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export const sensibilidadeOptions = ['baixo', 'medio', 'alto'].map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

export const fonteStatusOptions = [
  'referencial_para_curadoria',
  'a_verificar',
  'ativa',
  'inativa',
  'arquivada',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export const fonteTipoOptions = [
  'oficial_federal',
  'oficial_estadual',
  'oficial_municipal',
  'base_geoespacial',
  'legislacao',
  'relatorio_tecnico',
  'artigo_cientifico',
  'plano_municipal',
  'processo_administrativo',
  'levantamento_de_campo',
  'relato_comunitario',
  'midia',
  'outro',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export const fonteEsferaOptions = [
  'federal',
  'estadual',
  'municipal',
  'internacional',
  'academica',
  'comunitaria',
  'institucional',
  'nao_aplicavel',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export const evidenciaTipoOptions = [
  'legislacao',
  'mapa',
  'relatorio',
  'artigo',
  'imagem',
  'vistoria',
  'processo_administrativo',
  'base_dados',
  'plano',
  'noticia',
  'relato',
  'outro',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export const referenciaEntidadeOptions = [
  'conteudo',
  'norma',
  'especie',
  'area_ambiental',
  'programa',
  'meta',
  'material',
  'trilha',
  'agenda',
  'faq',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const normaTipoOptions = [
  'constituicao',
  'lei_federal',
  'decreto_federal',
  'resolucao_conama',
  'lei_estadual',
  'decreto_estadual',
  'resolucao_consema',
  'portaria',
  'instrucao_normativa',
  'lei_municipal',
  'decreto_municipal',
  'resolucao_municipal',
  'portaria_municipal',
  'nota_tecnica',
  'manual',
  'plano',
  'programa',
  'outro',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const esferaOptions = [
  'mundial',
  'internacional',
  'federal',
  'estadual',
  'municipal',
  'intermunicipal',
  'institucional',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const vigenciaOptions = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'revogada', label: 'Revogada' },
  { value: 'alterada', label: 'Alterada' },
  { value: 'substituida', label: 'Substituída' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'nao_verificada', label: 'Não verificada' },
];

const agendaStatusOptions = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'programado', label: 'Programado' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'realizado', label: 'Realizado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'arquivado', label: 'Arquivado' },
];

const agendaTipoOptions = [
  'data_comemorativa',
  'campanha',
  'evento',
  'palestra',
  'oficina',
  'mutirao',
  'curso',
  'visita_tecnica',
  'acao_escolar',
  'acao_comunitaria',
  'reuniao',
  'outro',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const abrangenciaOptions = [
  'mundial',
  'nacional',
  'nacional_mundial',
  'interamericano',
  'estadual',
  'municipal',
  'comunitaria',
  'escolar',
  'institucional',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const materialTipoOptions = [
  'cartilha',
  'folder',
  'video',
  'apresentacao',
  'mapa',
  'infografico',
  'plano_de_aula',
  'atividade_escolar',
  'guia_tecnico',
  'manual',
  'modelo_documental',
  'link_externo',
  'outro',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const grupoBiologicoOptions = [
  'arvore',
  'planta_herbacea',
  'ave',
  'mamifero',
  'reptil',
  'anfibio',
  'peixe',
  'inseto',
  'polinizador',
  'fungo',
  'outro',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const tipoAreaOptions = [
  'app',
  'unidade_conservacao',
  'zona_de_amortecimento',
  'area_verde_urbana',
  'nascente',
  'corredor_ecologico',
  'fragmento_florestal',
  'area_de_recuperacao',
  'area_de_risco',
  'territorio_educativo',
  'outro',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const validacaoAreaOptions = [
  { value: 'nao_validado', label: 'Nao validado' },
  { value: 'em_validacao', label: 'Em validacao' },
  { value: 'validado', label: 'Validado' },
  { value: 'rejeitado', label: 'Rejeitado' },
  { value: 'em_revisao', label: 'Em revisao' },
];

const programaStatusOptions = [
  { value: 'planejado', label: 'Planejado' },
  { value: 'em_execucao', label: 'Em execucao' },
  { value: 'concluido', label: 'Concluido' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'arquivado', label: 'Arquivado' },
];

export const conteudosConfig = {
  entityPath: 'conteudos',
  title: 'Conteudos educativos',
  description: 'Cadastro, revisao e publicacao de conteudos institucionais de educacao ambiental.',
  statusField: 'status',
  orderBy: 'updated_at',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'titulo', label: 'Titulo' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'publico_alvo', label: 'Publico' },
  ],
  fields: [
    { name: 'titulo', label: 'Titulo' },
    { name: 'slug', label: 'Slug' },
    { name: 'categoria', label: 'Categoria' },
    { name: 'subcategoria', label: 'Subcategoria' },
    { name: 'eixo_tematico', label: 'Eixo tematico' },
    { name: 'publico_alvo', label: 'Publico-alvo' },
    { name: 'nivel', label: 'Nivel', type: 'select', options: levelOptions, defaultValue: 'basico' },
    { name: 'status', label: 'Status', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'status_curadoria', label: 'Status de curadoria', type: 'select', options: curadoriaStatusOptions, defaultValue: 'nao_iniciado' },
    { name: 'grau_confiabilidade', label: 'Grau de confiabilidade', type: 'select', options: confiabilidadeOptions, defaultValue: 'nao_verificado' },
    { name: 'nivel_sensibilidade', label: 'Sensibilidade', type: 'select', options: sensibilidadeOptions, defaultValue: 'baixo' },
    { name: 'destaque', label: 'Destaque', type: 'checkbox' },
    { name: 'exige_validacao_tecnica', label: 'Exige validacao tecnica', type: 'checkbox', defaultValue: true },
    { name: 'exige_validacao_juridica', label: 'Exige validacao juridica', type: 'checkbox' },
    { name: 'conteudo_local_especifico', label: 'Conteudo local especifico', type: 'checkbox' },
    { name: 'apto_para_portal_publico', label: 'Apto para portal publico', type: 'checkbox' },
    { name: 'apto_para_ia', label: 'Apto para IA futura', type: 'checkbox' },
    { name: 'leitura_minutos', label: 'Leitura em minutos', type: 'number' },
    { name: 'fonte_principal_id', label: 'Fonte principal ID', type: 'number' },
    { name: 'validade_revisao_meses', label: 'Validade da revisao (meses)', type: 'number' },
    { name: 'revisao_periodica_em', label: 'Revisao periodica em', type: 'date' },
    { name: 'resumo', label: 'Resumo', type: 'textarea', full: true },
    { name: 'corpo', label: 'Corpo', type: 'textarea', full: true },
    { name: 'fonte_referencia', label: 'Fonte/referencia', type: 'textarea', full: true },
    { name: 'observacoes_validacao', label: 'Observacoes de validacao', type: 'textarea', full: true },
    { name: 'parecer_curadoria', label: 'Parecer de curadoria', type: 'textarea', full: true },
    { name: 'justificativa_publicacao', label: 'Justificativa de publicacao', type: 'textarea', full: true },
    { name: 'justificativa_sem_referencia', label: 'Justificativa sem referencia', type: 'textarea', full: true },
    { name: 'tags', label: 'Tags separadas por virgula', kind: 'json', full: true },
  ],
};

export const normasConfig = {
  entityPath: 'normas',
  title: 'Biblioteca normativa ambiental',
  description: 'Cadastro manual e auditavel de normas com linguagem cidada e status de vigencia.',
  statusField: 'status_publicacao',
  orderBy: 'updated_at',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'titulo', label: 'Titulo' },
    { key: 'esfera', label: 'Esfera' },
    { key: 'status_vigencia', label: 'Vigencia' },
  ],
  fields: [
    { name: 'titulo', label: 'Titulo' },
    { name: 'numero', label: 'Numero' },
    { name: 'ano', label: 'Ano', type: 'number' },
    { name: 'tipo_norma', label: 'Tipo', type: 'select', options: normaTipoOptions, defaultValue: 'lei_federal' },
    { name: 'esfera', label: 'Esfera', type: 'select', options: esferaOptions, defaultValue: 'federal' },
    { name: 'orgao_emissor', label: 'Orgao emissor' },
    { name: 'tema_principal', label: 'Tema principal' },
    { name: 'status_vigencia', label: 'Status de vigencia', type: 'select', options: vigenciaOptions, defaultValue: 'nao_verificada' },
    { name: 'status_publicacao', label: 'Status de publicacao', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'necessita_revisao', label: 'Necessita revisao', type: 'checkbox', defaultValue: true },
    { name: 'link_fonte', label: 'Link/fonte' },
    { name: 'ementa', label: 'Ementa', type: 'textarea', full: true },
    { name: 'resumo_tecnico', label: 'Resumo tecnico', type: 'textarea', full: true },
    { name: 'resumo_cidadao', label: 'Resumo em linguagem cidada', type: 'textarea', full: true },
    { name: 'impacto_para_municipio', label: 'Impacto pratico para MunicipioDemo', type: 'textarea', full: true },
    { name: 'observacoes', label: 'Observacoes', type: 'textarea', full: true },
    { name: 'temas_secundarios', label: 'Temas secundarios', kind: 'json', full: true },
  ],
};

export const agendaConfig = {
  entityPath: 'agenda',
  title: 'Agenda ambiental',
  description: 'Campanhas, eventos, oficinas e datas ambientais com curadoria da SMAD.',
  statusField: 'status',
  orderBy: 'data_inicio',
  quickStatuses: ['programado', 'publicado', 'realizado'],
  columns: [
    { key: 'titulo', label: 'Título' },
    { key: 'data_inicio', label: 'Início', type: 'date' },
    { key: 'tipo_agenda', label: 'Tipo' },
    { key: 'abrangencia', label: 'Abrangência' },
    { key: 'fonte_principal_id', label: 'Fonte principal ID' },
    { key: 'status_curadoria', label: 'Curadoria' },
    { key: 'grau_confiabilidade', label: 'Confiabilidade' },
  ],
  fields: [
    { name: 'titulo', label: 'Título' },
    { name: 'tipo_agenda', label: 'Tipo', type: 'select', options: agendaTipoOptions, defaultValue: 'evento' },
    { name: 'abrangencia', label: 'Abrangência', type: 'select', options: abrangenciaOptions, defaultValue: 'municipal' },
    { name: 'status', label: 'Status', type: 'select', options: agendaStatusOptions, defaultValue: 'rascunho' },
    { name: 'status_curadoria', label: 'Status de curadoria', type: 'select', options: curadoriaStatusOptions, defaultValue: 'nao_iniciado' },
    { name: 'grau_confiabilidade', label: 'Grau de confiabilidade', type: 'select', options: confiabilidadeOptions, defaultValue: 'nao_verificado' },
    { name: 'data_inicio', label: 'Data de início', type: 'datetime-local' },
    { name: 'data_fim', label: 'Data de fim', type: 'datetime-local' },
    { name: 'publico_alvo', label: 'Público-alvo' },
    { name: 'local', label: 'Local' },
    { name: 'organizador', label: 'Organizador' },
    { name: 'link_referencia', label: 'Link/referência' },
    { name: 'fonte_principal_id', label: 'Fonte principal ID', type: 'number' },
    { name: 'campanha_especial', label: 'Campanha especial', type: 'checkbox' },
    { name: 'inscricao_aberta', label: 'Inscrição aberta', type: 'checkbox' },
    { name: 'apto_para_portal_publico', label: 'Apto para portal público', type: 'checkbox' },
    { name: 'apto_para_ia', label: 'Apto para IA futura', type: 'checkbox' },
    { name: 'limite_vagas', label: 'Limite de vagas', type: 'number' },
    { name: 'descricao', label: 'Descrição', type: 'textarea', full: true },
    { name: 'observacoes', label: 'Observações', type: 'textarea', full: true },
  ],
};

export const materiaisConfig = {
  entityPath: 'materiais',
  title: 'Materiais educativos',
  description: 'Cartilhas, links, guias, mapas e materiais para consulta ou download futuro.',
  statusField: 'status',
  orderBy: 'updated_at',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'titulo', label: 'Titulo' },
    { key: 'tipo_material', label: 'Tipo' },
    { key: 'categoria', label: 'Categoria' },
  ],
  fields: [
    { name: 'titulo', label: 'Titulo' },
    { name: 'tipo_material', label: 'Tipo', type: 'select', options: materialTipoOptions, defaultValue: 'outro' },
    { name: 'categoria', label: 'Categoria' },
    { name: 'publico_alvo', label: 'Publico-alvo' },
    { name: 'status', label: 'Status', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'url_externa', label: 'URL externa' },
    { name: 'arquivo_url', label: 'Arquivo URL' },
    { name: 'fonte', label: 'Fonte' },
    { name: 'autor', label: 'Autor' },
    { name: 'descricao', label: 'Descricao', type: 'textarea', full: true },
    { name: 'tags', label: 'Tags separadas por virgula', kind: 'json', full: true },
  ],
};

export const trilhasConfig = {
  entityPath: 'trilhas',
  title: 'Trilhas de aprendizagem',
  description: 'Estrutura inicial de trilhas educativas. Certificados ficam apenas preparados nesta sprint.',
  statusField: 'status',
  orderBy: 'ordem_exibicao',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'titulo', label: 'Titulo' },
    { key: 'publico_alvo', label: 'Publico' },
    { key: 'nivel', label: 'Nivel' },
  ],
  fields: [
    { name: 'titulo', label: 'Titulo' },
    { name: 'publico_alvo', label: 'Publico-alvo' },
    { name: 'nivel', label: 'Nivel', type: 'select', options: levelOptions, defaultValue: 'basico' },
    { name: 'carga_horaria_estimada', label: 'Carga estimada', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'certificado_disponivel', label: 'Certificado disponivel', type: 'checkbox' },
    { name: 'ordem_exibicao', label: 'Ordem', type: 'number' },
    { name: 'descricao', label: 'Descricao', type: 'textarea', full: true },
  ],
};

export const especiesConfig = {
  entityPath: 'especies',
  title: 'Especies e biodiversidade',
  description: 'Cadastro educativo de especies, sem publicar listas locais sem fonte e validacao.',
  statusField: 'status',
  orderBy: 'updated_at',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'nome_popular', label: 'Nome popular' },
    { key: 'nome_cientifico', label: 'Nome cientifico' },
    { key: 'grupo_biologico', label: 'Grupo' },
  ],
  fields: [
    { name: 'nome_popular', label: 'Nome popular' },
    { name: 'nome_cientifico', label: 'Nome cientifico' },
    { name: 'grupo_biologico', label: 'Grupo biologico', type: 'select', options: grupoBiologicoOptions, defaultValue: 'outro' },
    { name: 'status_conservacao', label: 'Status de conservacao' },
    { name: 'status', label: 'Status', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'especie_nativa', label: 'Nativa', type: 'checkbox' },
    { name: 'especie_exotica', label: 'Exotica', type: 'checkbox' },
    { name: 'especie_invasora', label: 'Invasora', type: 'checkbox' },
    { name: 'imagem_url', label: 'Imagem URL' },
    { name: 'descricao', label: 'Descricao', type: 'textarea', full: true },
    { name: 'ocorrencia_local', label: 'Ocorrencia local', type: 'textarea', full: true },
    { name: 'importancia_ecologica', label: 'Importancia ecologica', type: 'textarea', full: true },
    { name: 'riscos_ameacas', label: 'Riscos e ameacas', type: 'textarea', full: true },
    { name: 'curiosidades', label: 'Curiosidades', type: 'textarea', full: true },
    { name: 'fonte_referencia', label: 'Fonte/referencia', type: 'textarea', full: true },
    { name: 'observacoes_validacao', label: 'Observacoes de validacao', type: 'textarea', full: true },
  ],
};

export const areasConfig = {
  entityPath: 'areas',
  title: 'Areas protegidas, APPs e territorios',
  description: 'Cadastro educativo de areas ambientais com status de validacao e publicacao.',
  statusField: 'status_publicacao',
  orderBy: 'updated_at',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'tipo_area', label: 'Tipo' },
    { key: 'status_validacao', label: 'Validacao' },
  ],
  fields: [
    { name: 'nome', label: 'Nome' },
    { name: 'tipo_area', label: 'Tipo', type: 'select', options: tipoAreaOptions, defaultValue: 'outro' },
    { name: 'categoria', label: 'Categoria' },
    { name: 'esfera_gestao', label: 'Esfera de gestao' },
    { name: 'status_validacao', label: 'Status de validacao', type: 'select', options: validacaoAreaOptions, defaultValue: 'nao_validado' },
    { name: 'status_publicacao', label: 'Status de publicacao', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'descricao', label: 'Descricao', type: 'textarea', full: true },
    { name: 'localizacao_descritiva', label: 'Localizacao descritiva', type: 'textarea', full: true },
    { name: 'fonte_referencia', label: 'Fonte/referencia', type: 'textarea', full: true },
    { name: 'observacoes', label: 'Observacoes', type: 'textarea', full: true },
  ],
};

export const programasConfig = {
  entityPath: 'programas',
  title: 'Programas ambientais',
  description: 'Programas, projetos e eixos ambientais com indicadores resumidos.',
  statusField: 'status',
  orderBy: 'updated_at',
  quickStatuses: ['planejado', 'em_execucao', 'concluido'],
  columns: [
    { key: 'nome', label: 'Nome' },
    { key: 'eixo_tematico', label: 'Eixo' },
    { key: 'responsavel', label: 'Responsavel' },
  ],
  fields: [
    { name: 'nome', label: 'Nome' },
    { name: 'eixo_tematico', label: 'Eixo tematico' },
    { name: 'responsavel', label: 'Responsavel' },
    { name: 'status', label: 'Status', type: 'select', options: programaStatusOptions, defaultValue: 'planejado' },
    { name: 'data_inicio', label: 'Data inicio', type: 'date' },
    { name: 'data_fim_prevista', label: 'Fim previsto', type: 'date' },
    { name: 'publico_alvo', label: 'Publico-alvo' },
    { name: 'descricao', label: 'Descricao', type: 'textarea', full: true },
    { name: 'indicadores_resumo', label: 'Indicadores resumidos', type: 'textarea', full: true },
    { name: 'fonte_referencia', label: 'Fonte/referencia', type: 'textarea', full: true },
    { name: 'ods_relacionados', label: 'ODS relacionados', kind: 'json', full: true },
  ],
};

export const metasConfig = {
  entityPath: 'metas',
  title: 'Metas ambientais',
  description: 'Metas estruturais em rascunho ou publicadas quando validadas.',
  statusField: 'status',
  orderBy: 'updated_at',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'titulo', label: 'Titulo' },
    { key: 'indicador', label: 'Indicador' },
    { key: 'ano_alvo', label: 'Ano alvo' },
  ],
  fields: [
    { name: 'programa_id', label: 'Programa ID', type: 'number' },
    { name: 'titulo', label: 'Titulo' },
    { name: 'indicador', label: 'Indicador' },
    { name: 'ano_base', label: 'Ano base', type: 'number' },
    { name: 'ano_alvo', label: 'Ano alvo', type: 'number' },
    { name: 'valor_base', label: 'Valor base', type: 'number' },
    { name: 'valor_alvo', label: 'Valor alvo', type: 'number' },
    { name: 'unidade_medida', label: 'Unidade' },
    { name: 'status', label: 'Status', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'descricao', label: 'Descricao', type: 'textarea', full: true },
    { name: 'observacoes', label: 'Observacoes', type: 'textarea', full: true },
  ],
};

export const faqConfig = {
  entityPath: 'faq',
  title: 'Perguntas frequentes',
  description: 'Base educativa preparada para consulta publica e futura IA educadora.',
  statusField: 'status',
  orderBy: 'ordem_exibicao',
  quickStatuses: ['em_revisao', 'aprovado', 'publicado'],
  columns: [
    { key: 'pergunta', label: 'Pergunta' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'ordem_exibicao', label: 'Ordem' },
  ],
  fields: [
    { name: 'pergunta', label: 'Pergunta' },
    { name: 'categoria', label: 'Categoria' },
    { name: 'status', label: 'Status', type: 'select', options: publicationStatusOptions, defaultValue: 'rascunho' },
    { name: 'ordem_exibicao', label: 'Ordem', type: 'number' },
    { name: 'resposta', label: 'Resposta', type: 'textarea', full: true },
    { name: 'fonte_referencia', label: 'Fonte/referencia', type: 'textarea', full: true },
  ],
};
