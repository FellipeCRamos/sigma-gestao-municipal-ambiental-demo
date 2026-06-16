const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'chave_demo_teste_publico_substituir_123456789';

const workflow = require('../src/services/operacaoWorkflowService');
const { validatePassword } = require('../src/services/passwordPolicy');
const { hasPermission, PERMISSIONS } = require('../src/config/permissions');
const { TERMOS_USO, POLITICA_PRIVACIDADE } = require('../src/config/governance');
const {
  buildTaxaResponse,
  parameterMatches,
  ruleMatchesComposite,
  ruleMatchesValue,
} = require('../src/modules/licenciamento/licenciamentoEnquadramento.service');
const {
  TAXA_STATUS,
  validateRegraPayload,
  validateRegraParametroPayload,
  validateTaxaPayload,
} = require('../src/modules/licenciamento/licenciamentoEnquadramento.validation');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assertThrowsStatus(fn, statusCode) {
  assert.throws(fn, (error) => error.statusCode === statusCode);
}

test('workflow de campanha permite triagem para pre-selecionado', () => {
  const result = workflow.validateCampanhaTransition(
    workflow.CAMPANHA_STATUS.EM_ANALISE,
    workflow.CAMPANHA_STATUS.PRE_SELECIONADO
  );

  assert.equal(result.current, workflow.CAMPANHA_STATUS.EM_ANALISE);
  assert.equal(result.next, workflow.CAMPANHA_STATUS.PRE_SELECIONADO);
});

test('workflow de campanha bloqueia salto de em_analise para atendido', () => {
  assertThrowsStatus(
    () => workflow.validateCampanhaTransition(
      workflow.CAMPANHA_STATUS.EM_ANALISE,
      workflow.CAMPANHA_STATUS.ATENDIDO
    ),
    400
  );
});

test('workflow de campanha exige data para agendamento', () => {
  assertThrowsStatus(
    () => workflow.validateCampanhaTransition(
      workflow.CAMPANHA_STATUS.PRE_SELECIONADO,
      workflow.CAMPANHA_STATUS.AGENDADO
    ),
    400
  );
});

test('workflow de ocorrencia permite aberta para em analise', () => {
  const result = workflow.validateOcorrenciaTransition(
    workflow.OCORRENCIA_STATUS.ABERTA,
    workflow.OCORRENCIA_STATUS.EM_ANALISE
  );

  assert.equal(result.current, workflow.OCORRENCIA_STATUS.ABERTA);
  assert.equal(result.next, workflow.OCORRENCIA_STATUS.EM_ANALISE);
});

test('workflow de ocorrencia bloqueia reabertura de resolvida', () => {
  assertThrowsStatus(
    () => workflow.validateOcorrenciaTransition(
      workflow.OCORRENCIA_STATUS.RESOLVIDA,
      workflow.OCORRENCIA_STATUS.ABERTA
    ),
    400
  );
});

test('politica de senha bloqueia senha fraca e aceita senha pragmatica', () => {
  assert.equal(validatePassword('12345678').valid, false);
  assert.equal(validatePassword('Sigba2026').valid, true);
});

test('RBAC consulta nao executa merge de qualidade e gestor executa', () => {
  assert.equal(hasPermission({ perfil: 'consulta' }, PERMISSIONS.QUALIDADE_MERGE), false);
  assert.equal(hasPermission({ perfil: 'gestor' }, PERMISSIONS.QUALIDADE_MERGE), true);
});

test('RBAC comunicacao observavel fica restrita a perfis operacionais', () => {
  assert.equal(hasPermission({ perfil: 'gestor' }, PERMISSIONS.COMUNICACAO_VIEW), true);
  assert.equal(hasPermission({ perfil: 'operador' }, PERMISSIONS.COMUNICACAO_VIEW), true);
  assert.equal(hasPermission({ perfil: 'consulta' }, PERMISSIONS.COMUNICACAO_VIEW), false);
});

test('documentos de governanca possuem versao operacional', () => {
  assert.match(TERMOS_USO.versao, /^2026\.04-gov4b/);
  assert.equal(POLITICA_PRIVACIDADE.versao, TERMOS_USO.versao);
});

test('licenciamento enquadramento identifica valor dentro da faixa', () => {
  assert.equal(ruleMatchesValue({ operador: 'faixa', valor_minimo: 10, valor_maximo: 100 }, 50), true);
  assert.equal(ruleMatchesValue({ operador: 'faixa', valor_minimo: 10, valor_maximo: 100 }, 101), false);
  assert.equal(ruleMatchesValue({ operador: 'maior_igual', valor_minimo: 500, valor_maximo: null }, 600), true);
});

test('licenciamento enquadramento bloqueia faixa invalida', () => {
  assertThrowsStatus(
    () => validateRegraPayload({
      atividade_id: 1,
      tipo_licenca_id: 1,
      valor_minimo: 50,
      valor_maximo: 10,
    }),
    400
  );
});

test('licenciamento taxa nao parametrizada e formula pendente sao controladas', () => {
  assert.equal(buildTaxaResponse(null).status, TAXA_STATUS.TAXA_NAO_PARAMETRIZADA);
  assert.equal(buildTaxaResponse({ formula: 'valor * 2' }).status, TAXA_STATUS.FORMULA_PENDENTE);
  assert.equal(buildTaxaResponse({ valor_fixo: '150.25' }).valor, 150.25);
});

test('licenciamento taxa calcula servico administrativo por VRTE', () => {
  const result = buildTaxaResponse(
    { id: 1, quantidade_vrte: 16, fator_padrao: 1, tipo_taxa: 'servico_administrativo' },
    { ano: 2026, valor_vrte: 4.9279 }
  );

  assert.equal(result.status, TAXA_STATUS.ESTIMADA);
  assert.equal(Number(result.valor.toFixed(4)), 78.8464);
  assert.match(result.memoria_calculo, /16 VRTE/);
});

test('licenciamento taxa calcula LMA classe I nao industrial por VRTE', () => {
  const result = buildTaxaResponse(
    { id: 2, quantidade_vrte: 290, fator_padrao: 1, tipo_taxa: 'atividade_nao_industrial_degradadora' },
    { ano: 2026, valor_vrte: 4.9279 }
  );

  assert.equal(Number(result.valor.toFixed(3)), 1429.091);
});

test('licenciamento taxa retorna vrte nao parametrizada quando regra exige VRTE sem exercicio', () => {
  const result = buildTaxaResponse({ id: 3, quantidade_vrte: 10, fator_padrao: 1 }, null);
  assert.equal(result.status, TAXA_STATUS.VRTE_NAO_PARAMETRIZADA);
});

test('licenciamento taxa rejeita formula executavel', () => {
  assertThrowsStatus(
    () => validateTaxaPayload({
      tipo_licenca_id: 1,
      formula: 'eval("2+2")',
    }),
    400
  );
});

test('licenciamento aceita codigo de formula segura e rejeita codigo fora da whitelist', () => {
  assert.equal(validateTaxaPayload({
    tipo_taxa: 'servico_administrativo',
    usa_formula: true,
    formula_codigo: 'EIA_MULTIPLICA_5',
  }).formula_codigo, 'EIA_MULTIPLICA_5');

  assertThrowsStatus(
    () => validateTaxaPayload({
      tipo_taxa: 'servico_administrativo',
      formula_codigo: 'CODIGO_LIVRE',
    }),
    400
  );
});

test('licenciamento regra composta avalia dois parametros obrigatorios', () => {
  const parametros = [
    validateRegraParametroPayload({
      regra_enquadramento_id: 1,
      parametro_chave: 'vmms',
      parametro_label: 'Volume mensal de madeira',
      operador: 'menor_igual',
      valor_maximo: 50,
    }),
    validateRegraParametroPayload({
      regra_enquadramento_id: 1,
      parametro_chave: 'area',
      parametro_label: 'Area util',
      operador: 'menor_igual',
      valor_maximo: 0.1,
    }),
  ];

  assert.equal(ruleMatchesComposite({}, parametros, { parametros_informados: { vmms: 40, area: 0.08 } }), true);
  assert.equal(ruleMatchesComposite({}, parametros, { parametros_informados: { vmms: 40, area: 0.2 } }), false);
  assert.equal(parameterMatches(parametros[0], 51), false);
});

test('RBAC licenciamento separa parametrizacao de consulta', () => {
  assert.equal(hasPermission({ perfil: 'gestor' }, PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE), true);
  assert.equal(hasPermission({ perfil: 'operador' }, PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE), false);
  assert.equal(hasPermission({ perfil: 'consulta' }, PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW), true);
});

let failed = 0;

tests.forEach(({ name, fn }) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
});

if (failed > 0) {
  process.exitCode = 1;
}
