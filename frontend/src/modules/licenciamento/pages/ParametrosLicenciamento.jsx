import { useEffect, useMemo, useState } from 'react';
import {
  createLicenciamentoParametro,
  deleteLicenciamentoParametro,
  getLicenciamentoParametrizacaoStatus,
  getLicenciamentoParametros,
  updateLicenciamentoParametro,
} from '../services/licenciamentoAdminApi';
import { formatDate, formatNumber, pageStyles, unpackListPayload } from './shared';

const RESOURCE_CONFIGS = {
  atividades: {
    title: 'Atividades licenciáveis',
    description: 'Base parametrizável de atividades, códigos municipais, CNAE e parâmetro principal.',
    createLabel: 'Salvar atividade',
    fields: [
      { name: 'codigo', label: 'Código', required: true },
      { name: 'nome', label: 'Nome', required: true },
      { name: 'categoria', label: 'Categoria' },
      { name: 'cnae', label: 'CNAE' },
      { name: 'unidade_parametro_principal', label: 'Unidade principal' },
      { name: 'parametro_principal_label', label: 'Nome do parâmetro' },
      { name: 'potencial_poluidor_padrao', label: 'Potencial padrão' },
      { name: 'tipo_atividade', label: 'Tipo de atividade', type: 'select', options: ['industrial', 'nao_industrial', 'outro'] },
      { name: 'formula_codigo', label: 'Fórmula segura', type: 'select', options: ['', 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', 'LOTES_X_LOTES_X_AREA_HA_DIV_1000', 'PARAMETRO_DIRETO', 'REGRA_COMPOSTA_AREA_TALUDE', 'UNIDADES_X_UNIDADES_X_AREA_HA_DIV_1000', 'LEITOS_X_AREA_UTIL_HA', 'M2_PARA_HA', 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM_M2_PARA_HA', 'PARAMETRO_QUALITATIVO_TODOS', 'CAPACIDADE_ARMAZENAMENTO_DIRETA', 'QUANTIDADE_RECEBIDA_DIA_DIRETA', 'PRODUCAO_DIA_DIRETA', 'PRODUCAO_MES_DIRETA', 'CAPACIDADE_INSTALADA_DIRETA', 'AREA_UTIL_DIRETA', 'NUMERO_LEITOS_DIRETA', 'NUMERO_PESSOAS_DIRETA', 'INDICE_AREA_CONSTRUIDA_ESTOCAGEM', 'PARAMETRO_SANITARIO_QUALITATIVO'] },
      { name: 'limite_impacto_local_tipo', label: 'Tipo de limite local', type: 'select', options: ['todos', 'valor_maximo', 'nao_aplicavel'] },
      { name: 'limite_impacto_local_valor', label: 'Valor limite local', type: 'number' },
      { name: 'limite_impacto_local_unidade', label: 'Unidade do limite' },
      { name: 'mensagem_extrapolacao_competencia', label: 'Mensagem de extrapolação', type: 'textarea' },
      { name: 'expressao_original', label: 'Expressão original da norma', type: 'textarea' },
      { name: 'fundamento_normativo', label: 'Fundamento normativo', type: 'textarea' },
      { name: 'descricao', label: 'Descrição', type: 'textarea' },
      { name: 'observacoes', label: 'Observações', type: 'textarea' },
    ],
    columns: [
      ['codigo', 'Código'],
      ['nome', 'Atividade'],
      ['categoria', 'Categoria'],
      ['tipo_atividade', 'Tipo'],
      ['unidade_parametro_principal', 'Unidade'],
      ['ativo', 'Ativa'],
    ],
  },
  'tipos-licenca': {
    key: 'tiposLicenca',
    title: 'Tipos de ato/licença',
    description: 'Tipos de atos ambientais usados nas regras de enquadramento.',
    createLabel: 'Salvar tipo',
    fields: [
      { name: 'codigo', label: 'Código', required: true },
      { name: 'nome', label: 'Nome', required: true },
      { name: 'natureza', label: 'Natureza' },
      { name: 'descricao', label: 'Descrição', type: 'textarea' },
      { name: 'exige_analise_tecnica', label: 'Exige análise técnica', type: 'checkbox' },
      { name: 'permite_emissao_publica', label: 'Permite emissão pública', type: 'checkbox' },
    ],
    columns: [
      ['codigo', 'Código'],
      ['nome', 'Nome'],
      ['natureza', 'Natureza'],
      ['exige_analise_tecnica', 'Análise'],
      ['ativo', 'Ativo'],
    ],
  },
  'potenciais-poluidor': {
    key: 'potenciaisPoluidor',
    title: 'Potenciais poluidores',
    description: 'Classificação de potencial poluidor usada pelo motor de enquadramento.',
    createLabel: 'Salvar potencial',
    fields: [
      { name: 'codigo', label: 'Código', required: true },
      { name: 'nome', label: 'Nome', required: true },
      { name: 'peso', label: 'Peso', type: 'number' },
      { name: 'descricao', label: 'Descrição', type: 'textarea' },
    ],
    columns: [
      ['codigo', 'Código'],
      ['nome', 'Nome'],
      ['peso', 'Peso'],
      ['ativo', 'Ativo'],
    ],
  },
  classes: {
    title: 'Classes de enquadramento',
    description: 'Classes ambientais parametrizadas para enquadramento preliminar.',
    createLabel: 'Salvar classe',
    fields: [
      { name: 'codigo', label: 'Código', required: true },
      { name: 'nome', label: 'Nome', required: true },
      { name: 'ordem', label: 'Ordem', type: 'number' },
      { name: 'descricao', label: 'Descrição', type: 'textarea' },
    ],
    columns: [
      ['codigo', 'Código'],
      ['nome', 'Nome'],
      ['ordem', 'Ordem'],
      ['ativo', 'Ativa'],
    ],
  },
  'regras-enquadramento': {
    key: 'regrasEnquadramento',
    title: 'Regras de enquadramento',
    description: 'Faixas e critérios que indicam tipo de licença, classe, porte e exigências preliminares.',
    createLabel: 'Salvar regra',
    fields: [
      { name: 'atividade_id', label: 'Atividade', type: 'select', source: 'atividades', required: true },
      { name: 'tipo_licenca_id', label: 'Tipo de licença', type: 'select', source: 'tiposLicenca' },
      { name: 'classe_id', label: 'Classe', type: 'select', source: 'classes' },
      { name: 'potencial_poluidor_id', label: 'Potencial poluidor', type: 'select', source: 'potenciaisPoluidor' },
      { name: 'parametro_nome', label: 'Parâmetro' },
      { name: 'parametro_unidade', label: 'Unidade' },
      { name: 'valor_minimo', label: 'Valor mínimo', type: 'number' },
      { name: 'valor_maximo', label: 'Valor máximo', type: 'number' },
      { name: 'operador', label: 'Operador', type: 'select', options: ['faixa', 'menor_igual', 'maior_igual', 'igual', 'qualquer'] },
      { name: 'porte_resultante', label: 'Porte resultante' },
      { name: 'dispensa_possivel', label: 'Dispensa possível', type: 'checkbox' },
      { name: 'exige_vistoria', label: 'Exige vistoria', type: 'checkbox' },
      { name: 'exige_estudo_ambiental', label: 'Exige estudo ambiental', type: 'checkbox' },
      { name: 'exige_anuencia', label: 'Exige anuência', type: 'checkbox' },
      { name: 'exige_georreferenciamento', label: 'Exige georreferenciamento', type: 'checkbox' },
      { name: 'requer_validacao_tecnica', label: 'Requer validação técnica', type: 'checkbox' },
      { name: 'limite_impacto_local_tipo', label: 'Tipo de limite local', type: 'select', options: ['todos', 'valor_maximo', 'nao_aplicavel'] },
      { name: 'limite_impacto_local_valor', label: 'Valor limite local', type: 'number' },
      { name: 'limite_impacto_local_unidade', label: 'Unidade do limite' },
      { name: 'tipo_calculo', label: 'Tipo de cálculo', type: 'select', options: ['nenhum', 'soma', 'multiplicacao', 'formula_predefinida'] },
      { name: 'formula_codigo', label: 'Código de fórmula segura', type: 'select', options: ['', 'LMA_SOMA_LMP_LMI_LMO', 'LMR_SOMA_LMP_LMI_LMO', 'EIA_MULTIPLICA_5', 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', 'LOTES_X_LOTES_X_AREA_HA_DIV_1000', 'PARAMETRO_DIRETO', 'REGRA_COMPOSTA_AREA_TALUDE', 'UNIDADES_X_UNIDADES_X_AREA_HA_DIV_1000', 'LEITOS_X_AREA_UTIL_HA', 'M2_PARA_HA', 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM_M2_PARA_HA', 'PARAMETRO_QUALITATIVO_TODOS', 'CAPACIDADE_ARMAZENAMENTO_DIRETA', 'QUANTIDADE_RECEBIDA_DIA_DIRETA', 'PRODUCAO_DIA_DIRETA', 'PRODUCAO_MES_DIRETA', 'CAPACIDADE_INSTALADA_DIRETA', 'AREA_UTIL_DIRETA', 'NUMERO_LEITOS_DIRETA', 'NUMERO_PESSOAS_DIRETA', 'INDICE_AREA_CONSTRUIDA_ESTOCAGEM', 'PARAMETRO_SANITARIO_QUALITATIVO'] },
      { name: 'expressao_original', label: 'Expressão original', type: 'textarea' },
      { name: 'mensagem_extrapolacao_competencia', label: 'Mensagem de extrapolação', type: 'textarea' },
      { name: 'observacao_publica', label: 'Observação pública', type: 'textarea' },
      { name: 'observacao_interna', label: 'Observação interna', type: 'textarea' },
      { name: 'fundamento_normativo', label: 'Fundamento normativo', type: 'textarea' },
      { name: 'vigencia_inicio', label: 'Vigência início', type: 'date' },
      { name: 'vigencia_fim', label: 'Vigência fim', type: 'date' },
    ],
    columns: [
      ['atividade_nome', 'Atividade'],
      ['tipo_licenca_codigo', 'Ato'],
      ['classe_nome', 'Classe'],
      ['porte_resultante', 'Porte'],
      ['formula_codigo', 'Fórmula'],
      ['ativo', 'Ativa'],
    ],
  },
  'regra-parametros': {
    key: 'regraParametros',
    title: 'Parâmetros compostos',
    description: 'Parâmetros adicionais por regra, preservando expressão original e faixas compostas do decreto.',
    createLabel: 'Salvar parâmetro',
    fields: [
      { name: 'regra_enquadramento_id', label: 'Regra', type: 'select', source: 'regrasEnquadramento', required: true },
      { name: 'parametro_chave', label: 'Chave do parâmetro', required: true },
      { name: 'parametro_label', label: 'Nome do parâmetro', required: true },
      { name: 'parametro_unidade', label: 'Unidade' },
      { name: 'operador', label: 'Operador', type: 'select', options: ['faixa', 'menor_igual', 'maior_igual', 'igual', 'qualquer'] },
      { name: 'valor_minimo', label: 'Valor mínimo', type: 'number' },
      { name: 'valor_maximo', label: 'Valor máximo', type: 'number' },
      { name: 'inclui_minimo', label: 'Inclui mínimo', type: 'checkbox', defaultValue: true },
      { name: 'inclui_maximo', label: 'Inclui máximo', type: 'checkbox', defaultValue: true },
      { name: 'obrigatorio', label: 'Obrigatório', type: 'checkbox', defaultValue: true },
      { name: 'ordem', label: 'Ordem', type: 'number' },
      { name: 'expressao_original', label: 'Expressão original', type: 'textarea' },
    ],
    columns: [
      ['regra_enquadramento_id', 'Regra'],
      ['parametro_chave', 'Chave'],
      ['parametro_label', 'Parâmetro'],
      ['valor_minimo', 'Mínimo'],
      ['valor_maximo', 'Máximo'],
    ],
  },
  'documentos-exigidos': {
    key: 'documentosExigidos',
    title: 'Documentos exigidos',
    description: 'Checklist documental por atividade, regra ou tipo de licença.',
    createLabel: 'Salvar documento',
    fields: [
      { name: 'atividade_id', label: 'Atividade', type: 'select', source: 'atividades' },
      { name: 'regra_enquadramento_id', label: 'Regra', type: 'select', source: 'regrasEnquadramento' },
      { name: 'tipo_licenca_id', label: 'Tipo de licença', type: 'select', source: 'tiposLicenca' },
      { name: 'nome_documento', label: 'Documento', required: true },
      { name: 'descricao', label: 'Descrição', type: 'textarea' },
      { name: 'obrigatorio', label: 'Obrigatório', type: 'checkbox', defaultValue: true },
      { name: 'aplicavel_pessoa_fisica', label: 'Pessoa física', type: 'checkbox', defaultValue: true },
      { name: 'aplicavel_pessoa_juridica', label: 'Pessoa jurídica', type: 'checkbox', defaultValue: true },
      { name: 'aplicavel_imovel_rural', label: 'Imóvel rural', type: 'checkbox', defaultValue: true },
      { name: 'aplicavel_imovel_urbano', label: 'Imóvel urbano', type: 'checkbox', defaultValue: true },
      { name: 'exige_responsavel_tecnico', label: 'Responsável técnico', type: 'checkbox' },
      { name: 'exige_art_rrt', label: 'ART/RRT', type: 'checkbox' },
      { name: 'ordem', label: 'Ordem', type: 'number' },
      { name: 'fundamento', label: 'Fundamento', type: 'textarea' },
    ],
    columns: [
      ['nome_documento', 'Documento'],
      ['obrigatorio', 'Obrigatório'],
      ['exige_art_rrt', 'ART/RRT'],
      ['ordem', 'Ordem'],
      ['ativo', 'Ativo'],
    ],
  },
  'regras-taxas': {
    key: 'regrasTaxas',
    title: 'Regras de taxa',
    description: 'Base inicial para estimativa preliminar de taxa, sem integração tributária real.',
    createLabel: 'Salvar taxa',
    fields: [
      { name: 'tipo_taxa', label: 'Tipo de taxa', type: 'select', options: ['atividade_industrial_poluidora', 'atividade_nao_industrial_degradadora', 'licenciamento_simplificado', 'autorizacao_ambiental', 'servico_administrativo'] },
      { name: 'tipo_atividade', label: 'Tipo de atividade', type: 'select', options: ['industrial', 'nao_industrial', 'servico_administrativo', 'outro'] },
      { name: 'servico_administrativo_codigo', label: 'Código do serviço administrativo' },
      { name: 'tipo_licenca_id', label: 'Tipo de licença', type: 'select', source: 'tiposLicenca' },
      { name: 'classe_id', label: 'Classe', type: 'select', source: 'classes' },
      { name: 'potencial_poluidor_id', label: 'Potencial poluidor', type: 'select', source: 'potenciaisPoluidor' },
      { name: 'porte', label: 'Porte' },
      { name: 'quantidade_vrte', label: 'Quantidade de VRTE', type: 'number' },
      { name: 'fator_padrao', label: 'Fator padrão', type: 'number' },
      { name: 'valor_fixo', label: 'Valor fixo legado', type: 'number' },
      { name: 'usa_formula', label: 'Usa fórmula segura', type: 'checkbox' },
      { name: 'formula_codigo', label: 'Código de fórmula segura', type: 'select', options: ['', 'LMA_SOMA_LMP_LMI_LMO', 'LMR_SOMA_LMP_LMI_LMO', 'EIA_MULTIPLICA_5', 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM', 'LOTES_X_LOTES_X_AREA_HA_DIV_1000', 'PARAMETRO_DIRETO', 'REGRA_COMPOSTA_AREA_TALUDE', 'UNIDADES_X_UNIDADES_X_AREA_HA_DIV_1000', 'LEITOS_X_AREA_UTIL_HA', 'M2_PARA_HA', 'AREA_CONSTRUIDA_MAIS_ESTOCAGEM_M2_PARA_HA', 'PARAMETRO_QUALITATIVO_TODOS', 'CAPACIDADE_ARMAZENAMENTO_DIRETA', 'QUANTIDADE_RECEBIDA_DIA_DIRETA', 'PRODUCAO_DIA_DIRETA', 'PRODUCAO_MES_DIRETA', 'CAPACIDADE_INSTALADA_DIRETA', 'AREA_UTIL_DIRETA', 'NUMERO_LEITOS_DIRETA', 'NUMERO_PESSOAS_DIRETA', 'INDICE_AREA_CONSTRUIDA_ESTOCAGEM', 'PARAMETRO_SANITARIO_QUALITATIVO'] },
      { name: 'formula', label: 'Fórmula textual', type: 'textarea' },
      { name: 'formula_descricao', label: 'Descrição da fórmula', type: 'textarea' },
      { name: 'unidade_referencia', label: 'Unidade de referência' },
      { name: 'observacao', label: 'Observação', type: 'textarea' },
      { name: 'fundamento_normativo', label: 'Fundamento normativo', type: 'textarea' },
      { name: 'vigencia_inicio', label: 'Vigência início', type: 'date' },
      { name: 'vigencia_fim', label: 'Vigência fim', type: 'date' },
    ],
    columns: [
      ['tipo_taxa', 'Tipo de taxa'],
      ['porte', 'Porte'],
      ['quantidade_vrte', 'VRTE'],
      ['fator_padrao', 'Fator'],
      ['formula_codigo', 'Fórmula'],
      ['ativo', 'Ativa'],
    ],
  },
  vrte: {
    title: 'VRTE por exercício',
    description: 'Valor da VRTE usado para estimativas preliminares de taxas.',
    createLabel: 'Salvar VRTE',
    fields: [
      { name: 'ano', label: 'Ano', type: 'number', required: true },
      { name: 'valor_vrte', label: 'Valor da VRTE', type: 'number', required: true },
      { name: 'data_inicio_vigencia', label: 'Vigência início', type: 'date' },
      { name: 'data_fim_vigencia', label: 'Vigência fim', type: 'date' },
      { name: 'fundamento_normativo', label: 'Fundamento normativo', type: 'textarea' },
      { name: 'observacao', label: 'Observação', type: 'textarea' },
    ],
    columns: [
      ['ano', 'Ano'],
      ['valor_vrte', 'Valor VRTE'],
      ['data_inicio_vigencia', 'Início'],
      ['data_fim_vigencia', 'Fim'],
      ['ativo', 'Ativa'],
    ],
  },
  normas: {
    title: 'Normas legais',
    description: 'Referências legais e normativas vinculáveis ao enquadramento ambiental.',
    createLabel: 'Salvar norma',
    fields: [
      { name: 'titulo', label: 'Título', required: true },
      { name: 'codigo', label: 'Código estável' },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['lei', 'decreto', 'resolucao', 'instrucao_normativa', 'portaria', 'norma_abnt', 'outro'], required: true },
      { name: 'numero', label: 'Número' },
      { name: 'ano', label: 'Ano', type: 'number' },
      { name: 'esfera', label: 'Esfera', type: 'select', options: ['municipal', 'estadual', 'federal', 'tecnica', 'outra'], required: true },
      { name: 'orgao', label: 'Órgão' },
      { name: 'ementa', label: 'Ementa', type: 'textarea' },
      { name: 'link_url', label: 'Link público' },
      { name: 'observacao', label: 'Observação', type: 'textarea' },
    ],
    columns: [
      ['titulo', 'Título'],
      ['codigo', 'Código'],
      ['tipo', 'Tipo'],
      ['esfera', 'Esfera'],
      ['ano', 'Ano'],
      ['ativo', 'Ativa'],
    ],
  },
  simulacoes: {
    title: 'Simulações públicas',
    description: 'Registros de simulações preliminares realizadas pela área pública do Licenciamento.',
    columns: [
      ['protocolo_simulacao', 'Protocolo'],
      ['atividade_nome', 'Atividade'],
      ['porte_estimado', 'Porte'],
      ['status_resultado', 'Status'],
      ['taxa_status', 'Taxa'],
      ['created_at', 'Recebida em'],
    ],
    readOnly: true,
  },
};

const TAB_ORDER = [
  'atividades',
  'tipos-licenca',
  'potenciais-poluidor',
  'classes',
  'regras-enquadramento',
  'regra-parametros',
  'documentos-exigidos',
  'regras-taxas',
  'vrte',
  'normas',
  'simulacoes',
];

function buildInitialForm(config) {
  return (config.fields || []).reduce((acc, field) => {
    acc[field.name] = field.type === 'checkbox' ? Boolean(field.defaultValue) : '';
    return acc;
  }, {});
}

function getConfigKey(resource) {
  return RESOURCE_CONFIGS[resource].key || resource;
}

function normalizePayload(config, form) {
  return (config.fields || []).reduce((acc, field) => {
    const value = form[field.name];
    if (field.type === 'checkbox') {
      acc[field.name] = Boolean(value);
      return acc;
    }

    if (value !== '') {
      acc[field.name] = value;
    }

    return acc;
  }, {});
}

function formatCell(value, field) {
  if (field === 'created_at' || field === 'updated_at') return formatDate(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (field === 'valor_fixo' && value !== null && value !== undefined) return `R$ ${formatNumber(value)}`;
  if (field === 'valor_vrte' && value !== null && value !== undefined) return `R$ ${formatNumber(value)}`;
  if (field === 'quantidade_vrte' && value !== null && value !== undefined) return `${formatNumber(value)} VRTE`;
  return value || '-';
}

function makeOptions(source, lookups) {
  const items = lookups[source] || [];
  return items.map((item) => ({
    value: item.id,
    label: item.codigo ? `${item.codigo} - ${item.nome || item.titulo}` : item.nome || item.titulo || `#${item.id}`,
  }));
}

export default function ParametrosLicenciamento() {
  const [activeTab, setActiveTab] = useState('atividades');
  const [lookups, setLookups] = useState({});
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(buildInitialForm(RESOURCE_CONFIGS.atividades));
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pilotStatus, setPilotStatus] = useState(null);

  const config = RESOURCE_CONFIGS[activeTab];

  const tabButtons = useMemo(() => TAB_ORDER.map((resource) => ({
    resource,
    title: RESOURCE_CONFIGS[resource].title,
  })), []);
  const taxaPreview = useMemo(() => {
    if (activeTab !== 'regras-taxas' || !form.quantidade_vrte) return null;
    const vrte = (lookups.vrte || []).find((item) => item.ativo) || (lookups.vrte || [])[0];
    if (!vrte?.valor_vrte) return 'Cadastre uma VRTE ativa para visualizar a prévia.';
    const quantidade = Number(form.quantidade_vrte);
    const fator = Number(form.fator_padrao || 1);
    const valor = quantidade * Number(vrte.valor_vrte) * fator;
    if (!Number.isFinite(valor)) return null;
    return `${quantidade} VRTE x R$ ${formatNumber(vrte.valor_vrte)} x ${fator} = R$ ${formatNumber(valor)}`;
  }, [activeTab, form.quantidade_vrte, form.fator_padrao, lookups.vrte]);

  async function loadResource(resource = activeTab) {
    setLoading(true);
    setMessage('');

    try {
      const response = await getLicenciamentoParametros(resource, { page_size: 100 });
      const payload = unpackListPayload(response.data);
      setItems(payload.items);
      setLookups((current) => ({
        ...current,
        [getConfigKey(resource)]: payload.items,
      }));
    } catch (error) {
      setMessage(error.message || 'Não foi possível carregar os parâmetros.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshLookups() {
    const resources = ['atividades', 'tipos-licenca', 'potenciais-poluidor', 'classes', 'regras-enquadramento', 'vrte'];
    const entries = await Promise.all(resources.map(async (resource) => {
      try {
        const response = await getLicenciamentoParametros(resource, { page_size: 100 });
        return [getConfigKey(resource), unpackListPayload(response.data).items];
      } catch {
        return [getConfigKey(resource), []];
      }
    }));

    setLookups(Object.fromEntries(entries));
  }

  async function refreshPilotStatus() {
    try {
      const response = await getLicenciamentoParametrizacaoStatus();
      setPilotStatus(response.data || null);
    } catch {
      setPilotStatus(null);
    }
  }

  useEffect(() => {
    setForm(buildInitialForm(config));
    setEditing(null);
    loadResource(activeTab);
    refreshLookups();
    refreshPilotStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(row) {
    const next = buildInitialForm(config);
    (config.fields || []).forEach((field) => {
      next[field.name] = field.type === 'checkbox' ? Boolean(row[field.name]) : row[field.name] ?? '';
    });
    setEditing(row);
    setForm(next);
    setMessage(`Editando registro #${row.id}.`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (config.readOnly) return;

    setSaving(true);
    setMessage('');

    try {
      const payload = normalizePayload(config, form);
      if (editing?.id) {
        await updateLicenciamentoParametro(activeTab, editing.id, payload);
        setMessage('Registro atualizado com sucesso.');
      } else {
        await createLicenciamentoParametro(activeTab, payload);
        setMessage('Registro criado com sucesso.');
      }

      setForm(buildInitialForm(config));
      setEditing(null);
      await loadResource(activeTab);
      await refreshLookups();
      await refreshPilotStatus();
    } catch (error) {
      setMessage(error.message || 'Não foi possível salvar o registro.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!row?.id) return;
    setSaving(true);
    setMessage('');

    try {
      await deleteLicenciamentoParametro(activeTab, row.id);
      setMessage('Registro inativado com sucesso.');
      await loadResource(activeTab);
      await refreshLookups();
      await refreshPilotStatus();
    } catch (error) {
      setMessage(error.message || 'Não foi possível inativar o registro.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <p style={pageStyles.sectionSubtitle}>Licenciamento Ambiental</p>
        <h2 style={pageStyles.sectionTitle}>Parâmetros do enquadramento</h2>
        <p style={pageStyles.sectionSubtitle}>
          Cadastre a base configurável usada pelo simulador público. O resultado permanece preliminar e sujeito à
          validação técnica da SMAD.
        </p>

        <div style={{ ...pageStyles.actions, marginTop: 18 }}>
          {tabButtons.map((tab) => (
            <button
              key={tab.resource}
              type="button"
              onClick={() => setActiveTab(tab.resource)}
              style={tab.resource === activeTab ? pageStyles.buttonPrimary : pageStyles.buttonSecondary}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Parametrização piloto</h3>
        <p style={pageStyles.sectionSubtitle}>
          Status da carga controlada da Fase 2B: VRTE, taxas, normas, atividades-piloto, regras, parâmetros e
          documentos. A reexecução do seed não deve duplicar registros.
        </p>
        <div style={pageStyles.grid3}>
          {[
            ['VRTE 2026', pilotStatus?.vrte_2026_cadastrada ? 'Cadastrada' : 'Pendente'],
            ['Taxas', pilotStatus?.taxas_cadastradas ?? '-'],
            ['Normas', pilotStatus?.normas_cadastradas ?? '-'],
            ['Atividades-piloto', pilotStatus?.atividades_piloto ?? '-'],
            ['Regras-piloto', pilotStatus?.regras_piloto ?? '-'],
            ['Parâmetros', pilotStatus?.parametros_piloto ?? '-'],
            ['Documentos', pilotStatus?.documentos_piloto ?? '-'],
          ].map(([label, value]) => (
            <div key={label} style={pageStyles.cardMetric}>
              <span style={pageStyles.metricLabel}>{label}</span>
              <strong style={pageStyles.metricValue}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>{config.title}</h3>
        <p style={pageStyles.sectionSubtitle}>{config.description}</p>

        {message ? (
          <div style={{ ...pageStyles.message, marginTop: 14 }}>
            {message}
          </div>
        ) : null}

        {taxaPreview ? (
          <div style={{ ...pageStyles.message, marginTop: 14 }}>
            Prévia de cálculo: {taxaPreview}
          </div>
        ) : null}

        {!config.readOnly ? (
          <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
            <div style={pageStyles.formGrid}>
              {config.fields.map((field) => {
                if (field.type === 'textarea') {
                  return (
                    <label key={field.name} style={pageStyles.label}>
                      {field.label}
                      <textarea
                        value={form[field.name] || ''}
                        onChange={(event) => updateField(field.name, event.target.value)}
                        style={pageStyles.textarea}
                      />
                    </label>
                  );
                }

                if (field.type === 'select') {
                  const options = field.source ? makeOptions(field.source, lookups) : (field.options || []).map((item) => ({
                    value: item,
                    label: item,
                  }));

                  return (
                    <label key={field.name} style={pageStyles.label}>
                      {field.label}
                      <select
                        value={form[field.name] || ''}
                        onChange={(event) => updateField(field.name, event.target.value)}
                        required={field.required}
                        style={pageStyles.input}
                      >
                        <option value="">Selecione</option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.type === 'checkbox') {
                  return (
                    <label key={field.name} style={{ ...pageStyles.label, alignContent: 'end' }}>
                      <span>{field.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.name])}
                        onChange={(event) => updateField(field.name, event.target.checked)}
                        style={{ width: 22, height: 22 }}
                      />
                    </label>
                  );
                }

                return (
                  <label key={field.name} style={pageStyles.label}>
                    {field.label}
                    <input
                      type={field.type || 'text'}
                      step={field.type === 'number' ? 'any' : undefined}
                      value={form[field.name] || ''}
                      required={field.required}
                      onChange={(event) => updateField(field.name, event.target.value)}
                      style={pageStyles.input}
                    />
                  </label>
                );
              })}
            </div>

            <div style={pageStyles.actions}>
              <button type="submit" disabled={saving} style={pageStyles.buttonPrimary}>
                {editing ? 'Atualizar registro' : config.createLabel}
              </button>
              {editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm(buildInitialForm(config));
                  }}
                  style={pageStyles.buttonSecondary}
                >
                  Cancelar edição
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section style={pageStyles.section}>
        <h3 style={pageStyles.sectionTitle}>Registros</h3>
        <div style={pageStyles.tableWrap}>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                {config.columns.map(([, label]) => (
                  <th key={label} style={pageStyles.th}>{label}</th>
                ))}
                {!config.readOnly ? <th style={pageStyles.th}>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={config.columns.length + 1} style={pageStyles.td}>Carregando parâmetros...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={config.columns.length + 1} style={pageStyles.td}>Nenhum registro encontrado.</td>
                </tr>
              ) : items.map((row) => (
                <tr key={row.id}>
                  {config.columns.map(([field]) => (
                    <td key={field} style={pageStyles.td}>{formatCell(row[field], field)}</td>
                  ))}
                  {!config.readOnly ? (
                    <td style={pageStyles.td}>
                      <div style={pageStyles.actions}>
                        <button type="button" onClick={() => startEdit(row)} style={pageStyles.buttonSecondary}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleDelete(row)} style={pageStyles.buttonSecondary}>
                          Inativar
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
