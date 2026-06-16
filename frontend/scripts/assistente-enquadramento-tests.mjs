import assert from 'node:assert/strict';
import { analisarDescricaoAtividade, gerarPreRequerimentoAssistido } from '../src/modules/licenciamento/services/assistente/assistenteEnquadramentoService.js';

const analysis = analisarDescricaoAtividade({
  descricaoOriginal: 'Quero trabalhar com ferro velho no meu quintal.',
  perfilUsuario: 'nao_sei',
});

assert.equal(analysis.interpretacao.slug, 'reciclagem_ferro_velho_sucata');
assert.equal(analysis.formulario.specific, true);
assert.ok(analysis.interpretacao.confianca >= 0.86);
assert.ok(analysis.formulario.fields.some((field) => field.key === 'materiais_recebidos'));
assert.ok(analysis.formulario.fields.some((field) => field.key === 'semob_viabilidade'));

const respostasFormulario = {
  ...analysis.respostasIniciais,
  tipo_pessoa: 'fisica',
  tipo_imovel: 'residencial',
  local_exercicio: 'quintal_residencia',
  materiais_recebidos: ['ferro_sucata_metalica', 'baterias', 'oleo_lubrificantes'],
  operacoes: ['triagem_manual', 'lavagem'],
  area_armazenamento_m2: '80',
  tipo_piso: ['diretamente_solo'],
  possui_cobertura: 'nao',
  drenagem_pluvial: 'nao_sei',
  curso_hidrico_proximo: 'nao_sei',
  intervencao_app: 'nao',
  supressao_vegetacao: 'nao',
  uso_recurso_hidrico: 'nao',
  efluente_liquido: 'sim',
  incomodo_vizinhanca: 'sim',
  armazenamento_solo: 'sim',
  semob_viabilidade: 'nao',
  possui_fotos: 'nao',
  comprovante_endereco: 'nao',
  cnpj_mei_inscricao: 'nao',
};

const result = gerarPreRequerimentoAssistido({
  descricaoOriginal: 'Quero trabalhar com ferro velho no meu quintal.',
  perfilUsuario: 'nao_sei',
  interpretacao: analysis.interpretacao,
  respostasFormulario,
});

assert.equal(result.slugAtividade, 'reciclagem_ferro_velho_sucata');
assert.equal(result.grupoAtividade, 'Residuos solidos / Reciclagem');
assert.equal(result.nivelAtencao, 'alto');
assert.deepEqual(result.palavrasChaveDetectadas, ['ferro velho', 'quintal']);
assert.equal(result.tipoPessoa, 'fisica');
assert.equal(result.tipoImovel, 'residencial');
assert.ok(result.pendencias.some((item) => item.includes('fotos')));
assert.ok(result.checklistDocumental.some((item) => item.includes('CNPJ')));
assert.ok(result.recomendacaoTramitacao.includes('SMAD'));
assert.ok(!/licenca aprovada|dispensa concedida|atividade autorizada|pode iniciar imediatamente/i.test(JSON.stringify(result)));

console.log('Assistente de enquadramento: testes OK.');
