import { getChecklistDocumentalPreliminar } from './checklistDocumentalConfig.js';
import { calcularNivelAtencaoAmbiental } from './matrizRiscoAmbiental.js';

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function yes(value) {
  return value === 'sim' || value === true;
}

function buildRecyclingPendencias(respostas) {
  const pendencias = [];

  if (!hasValue(respostas.area_armazenamento_m2)) {
    pendencias.push('Informar area utilizada para armazenamento.');
  }
  if (!hasValue(respostas.materiais_recebidos)) {
    pendencias.push('Informar os materiais que serao recebidos ou armazenados.');
  }
  if (!hasValue(respostas.tipo_piso)) {
    pendencias.push('Declarar se o material ficara sobre piso adequado ou diretamente no solo.');
  }
  if (respostas.possui_fotos !== 'sim') {
    pendencias.push('Anexar fotos internas e externas do local.');
  }
  if (respostas.comprovante_endereco !== 'sim') {
    pendencias.push('Apresentar comprovante de endereco do imovel.');
  }
  if (respostas.semob_viabilidade !== 'sim') {
    pendencias.push('Apresentar ou solicitar manifestacao urbanistica/viabilidade de uso do solo, quando aplicavel.');
  }
  if (yes(respostas.efluente_liquido)) {
    pendencias.push('Informar sistema de tratamento e destinacao do efluente liquido.');
  }
  if (yes(respostas.curso_hidrico_proximo) || yes(respostas.intervencao_app)) {
    pendencias.push('Informar situacao de APP, curso hidrico, nascente, brejo, vala ou area alagavel proxima.');
  }
  if (Array.isArray(respostas.materiais_recebidos) && respostas.materiais_recebidos.some((item) => ['baterias', 'oleo_lubrificantes', 'pneus', 'eletroeletronicos'].includes(item))) {
    pendencias.push('Informar se havera recebimento de baterias, oleo, pneus ou eletroeletronicos e sua destinacao.');
  }
  pendencias.push('Informar destinacao final dos materiais ou residuos nao aproveitados.');

  return pendencias;
}

function buildGenericPendencias(respostas) {
  const pendencias = [];
  if (!hasValue(respostas.descricao_detalhada)) {
    pendencias.push('Detalhar melhor a atividade pretendida.');
  }
  if (!hasValue(respostas.localizacao)) {
    pendencias.push('Informar localizacao aproximada do imovel ou empreendimento.');
  }
  pendencias.push('Validar o enquadramento com a SMAD ou usar o modo tecnico avancado se o codigo ja for conhecido.');
  return pendencias;
}

function getRecomendacao(nivelAtencao, respostas) {
  if (nivelAtencao === 'alto') {
    return 'Encaminhar para analise interna da SMAD antes de qualquer conclusao. Indicio de necessidade de licenciamento ambiental ou validacao tecnica especifica.';
  }

  if (respostas.semob_viabilidade === 'nao' || respostas.semob_viabilidade === 'nao_sei') {
    return 'Exigir manifestacao urbanistica/SEMOB ou confirmacao de viabilidade de uso do solo antes da conclusao.';
  }

  if (nivelAtencao === 'medio') {
    return 'Solicitar complementacao e prosseguir para abertura de requerimento com analise tecnica da SMAD.';
  }

  return 'Prosseguir para abertura de requerimento com analise tecnica da SMAD, mantendo o enquadramento como preliminar.';
}

export function gerarResultadoAssistente({ descricaoOriginal, perfilUsuario, interpretacao, respostasFormulario }) {
  const risk = calcularNivelAtencaoAmbiental(interpretacao.slug, respostasFormulario, interpretacao);
  const checklistDocumental = getChecklistDocumentalPreliminar(interpretacao.slug);
  const isRecycling = interpretacao.slug === 'reciclagem_ferro_velho_sucata';
  const pendencias = isRecycling
    ? buildRecyclingPendencias(respostasFormulario)
    : buildGenericPendencias(respostasFormulario);

  const resumoCidadao = isRecycling
    ? 'Pelas informacoes prestadas, sua atividade parece envolver armazenamento, triagem e/ou comercializacao de materiais reciclaveis ou sucata. A SMAD precisara avaliar as condicoes do local, o tipo de material recebido e se ha risco ambiental.'
    : 'Pelas informacoes prestadas, o sistema identificou uma atividade provavel, mas o formulario especifico ainda esta em construcao. A orientacao permanece preliminar e deve ser validada pela SMAD.';

  const resumoTecnico = isRecycling
    ? 'Atividade declarada: armazenamento temporario, triagem e possivel comercializacao de materiais reciclaveis/sucata. Riscos preliminares: manejo de residuos solidos, armazenamento em solo ou area descoberta, recebimento de residuos especiais/perigosos, incomodo a vizinhanca, drenagem inadequada e necessidade de verificacao urbanistica.'
    : `Atividade declarada pelo requerente relacionada a ${interpretacao.atividadeProvavel}. Necessaria validacao tecnica, administrativa e normativa antes de qualquer conclusao.`;

  const recomendacaoTramitacao = getRecomendacao(risk.nivelAtencao, respostasFormulario);

  const payload = {
    descricaoOriginal,
    perfilUsuario,
    atividadeProvavel: interpretacao.atividadeProvavel,
    slugAtividade: interpretacao.slug,
    grupoAtividade: interpretacao.grupo,
    confianca: interpretacao.confianca,
    nivelAtencao: risk.nivelAtencao,
    palavrasChaveDetectadas: interpretacao.palavrasChaveDetectadas || [],
    respostasFormulario,
    pendencias,
    checklistDocumental,
    resumoCidadao,
    resumoTecnico,
    recomendacaoTramitacao,
    alertas: risk.alertas,
    nomeInteressado: respostasFormulario.nome_interessado || '',
    emailInteressado: respostasFormulario.email_interessado || '',
    telefoneInteressado: respostasFormulario.telefone_interessado || '',
    tipoPessoa: respostasFormulario.tipo_pessoa || '',
    tipoImovel: respostasFormulario.tipo_imovel || '',
    dataHoraAnalise: new Date().toISOString(),
    versaoMotor: interpretacao.versaoMotor,
  };

  if (import.meta.env?.DEV) {
    // Estrutura pronta para envio futuro ao backend, sem persistencia nesta etapa.
    console.info('[SIGMA][AssistenteEnquadramento]', payload);
  }

  return payload;
}
