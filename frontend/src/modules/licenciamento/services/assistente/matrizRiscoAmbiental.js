const HIGH_RISK_MATERIALS = [
  'baterias',
  'oleo_lubrificantes',
  'pneus',
  'eletroeletronicos',
  'residuos_quimicos',
  'residuos_saude',
  'residuos_contaminados',
];

const HIGH_RISK_OPERATIONS = ['queima', 'lavagem', 'trituracao', 'beneficiamento'];

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function isYes(value) {
  return value === 'sim' || value === true;
}

function isMissingOrUnknown(value) {
  return !value || value === 'nao_sei' || value === 'nao';
}

export function calcularNivelAtencaoAmbiental(slug, respostas, interpretacao) {
  const alertas = [];
  const flags = {
    alto: 0,
    medio: 0,
  };

  if (slug !== 'reciclagem_ferro_velho_sucata') {
    return {
      nivelAtencao: interpretacao?.nivelAtencaoInicial || 'medio',
      alertas: interpretacao?.observacoes || [],
    };
  }

  const materiais = asList(respostas.materiais_recebidos);
  const operacoes = asList(respostas.operacoes);
  const piso = asList(respostas.tipo_piso);

  const materiaisCriticos = materiais.filter((item) => HIGH_RISK_MATERIALS.includes(item));
  if (materiaisCriticos.length) {
    flags.alto += 2;
    alertas.push('Materiais especiais ou perigosos exigem validacao tecnica antes de qualquer conclusao.');
  }

  if (operacoes.includes('queima')) {
    flags.alto += 3;
    alertas.push('Queima de residuos e alerta critico e nao deve ser tratada como operacao regular sem analise da SMAD.');
  }

  if (operacoes.includes('lavagem') || isYes(respostas.efluente_liquido)) {
    flags.alto += 1;
    alertas.push('Lavagem ou efluente liquido exige informacao sobre tratamento e destinacao.');
  }

  if (operacoes.includes('desmontagem') && materiais.some((item) => ['eletroeletronicos', 'baterias', 'oleo_lubrificantes'].includes(item))) {
    flags.alto += 1;
    alertas.push('Desmontagem com bateria, oleo ou eletroeletronico eleva o risco ambiental preliminar.');
  }

  if (piso.includes('diretamente_solo') || isYes(respostas.armazenamento_solo)) {
    flags.alto += 1;
    alertas.push('Armazenamento diretamente no solo pode gerar risco de contaminacao e exige verificacao tecnica.');
  }

  if (isYes(respostas.intervencao_app) || isYes(respostas.curso_hidrico_proximo)) {
    flags.alto += 1;
    alertas.push('APP, curso hidrico ou area alagavel proxima exigem analise de localizacao.');
  }

  if (isYes(respostas.supressao_vegetacao) || isYes(respostas.uso_recurso_hidrico)) {
    flags.alto += 1;
    alertas.push('Supressao vegetal ou uso de recurso hidrico depende de validacao especifica.');
  }

  if (respostas.tipo_imovel === 'residencial' || respostas.local_exercicio === 'quintal_residencia') {
    flags.medio += 2;
    alertas.push('Atividade em residencia ou quintal pode exigir manifestacao urbanistica/SEMOB.');
  }

  if (respostas.tipo_imovel === 'terreno_aberto' || respostas.local_exercicio === 'terreno_aberto') {
    flags.medio += 1;
    alertas.push('Terreno aberto exige verificacao das condicoes de piso, drenagem, cobertura e vizinhanca.');
  }

  if (respostas.possui_cobertura === 'nao' || respostas.possui_cobertura === 'parcialmente' || piso.includes('area_descoberta')) {
    flags.medio += 1;
    alertas.push('Area descoberta ou cobertura parcial pode exigir medidas de controle ambiental.');
  }

  if (isMissingOrUnknown(respostas.semob_viabilidade)) {
    flags.medio += 1;
    alertas.push('A viabilidade urbanistica/uso do solo deve ser confirmada antes da conclusao.');
  }

  if (!Number(respostas.area_armazenamento_m2)) {
    flags.medio += 1;
    alertas.push('A area de armazenamento deve ser informada para orientar o enquadramento.');
  }

  if (isYes(respostas.incomodo_vizinhanca)) {
    flags.medio += 1;
    alertas.push('Ruido, poeira ou trafego de caminhoes podem gerar incomodo e exigem avaliacao.');
  }

  if (flags.alto > 0) {
    return { nivelAtencao: 'alto', alertas };
  }

  if (flags.medio > 0) {
    return { nivelAtencao: 'medio', alertas };
  }

  return {
    nivelAtencao: 'baixo',
    alertas: ['Nao foram identificados sinais criticos, mas a orientacao permanece preliminar e sujeita a SMAD.'],
  };
}
