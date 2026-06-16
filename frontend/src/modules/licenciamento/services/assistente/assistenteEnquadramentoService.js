import { classificarAtividadeAmbiental } from './atividadeClassifier.js';
import { gerarResultadoAssistente } from './recomendacaoTramitacaoService.js';
import { getInitialResponses, getSidDinamicoConfig } from './sidDinamicoConfig.js';

export function analisarDescricaoAtividade({ descricaoOriginal, perfilUsuario }) {
  const interpretacao = classificarAtividadeAmbiental(descricaoOriginal, perfilUsuario);
  const formulario = getSidDinamicoConfig(interpretacao.slug);

  return {
    interpretacao,
    formulario,
    respostasIniciais: getInitialResponses(formulario),
  };
}

export function gerarPreRequerimentoAssistido({ descricaoOriginal, perfilUsuario, interpretacao, respostasFormulario }) {
  return gerarResultadoAssistente({
    descricaoOriginal,
    perfilUsuario,
    interpretacao,
    respostasFormulario,
  });
}
