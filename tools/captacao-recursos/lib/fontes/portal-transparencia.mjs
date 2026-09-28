// Portal da Transparencia do Governo Federal (API de dados, requer chave
// gratuita). Complementa o Transferegov com convenios registrados no SIAFI.

import { classificarConvenio, criarClassificadorAmbiental } from '../classificacao.mjs';
import { esperar, obterJson } from '../rede.mjs';
import { anoDe, paraNumero } from '../texto.mjs';

function lerCaminho(objeto, caminho) {
  return caminho.split('.').reduce((atual, chave) => (atual == null ? undefined : atual[chave]), objeto);
}

function primeiro(objeto, caminhos) {
  for (const caminho of caminhos) {
    const valor = lerCaminho(objeto, caminho);
    if (valor !== undefined && valor !== null && valor !== '') return valor;
  }
  return '';
}

export async function coletarPortalTransparencia(ctx) {
  const { base, variavelChave, intervaloMs } = ctx.config.portalTransparencia;
  const chave = process.env[variavelChave];
  if (!chave) {
    return {
      fonte: 'Portal da Transparencia (API)',
      geradoEm: new Date().toISOString(),
      itens: [],
      avisos: [`Coleta pulada: defina a variavel ${variavelChave} com a chave da API (cadastro gratuito).`],
    };
  }
  const classificar = criarClassificadorAmbiental(ctx.config);
  const itens = [];
  const anoFinal = new Date().getFullYear();
  for (let ano = ctx.alvo.desde; ano <= anoFinal; ano++) {
    for (let pagina = 1; ; pagina++) {
      const parametros = new URLSearchParams({
        codigoIBGE: ctx.alvo.ibge,
        dataInicial: `01/01/${ano}`,
        dataFinal: `31/12/${ano}`,
        pagina: String(pagina),
      });
      const lote = await obterJson(`${base}/convenios?${parametros}`, { headers: { 'chave-api-dados': chave } });
      await esperar(intervaloMs);
      if (!Array.isArray(lote) || !lote.length) break;
      for (const registro of lote) {
        const objeto = primeiro(registro, ['dimConvenio.objeto', 'objeto']);
        const situacao = primeiro(registro, ['situacao', 'dimConvenio.situacao']);
        itens.push({
          ano: anoDe(primeiro(registro, ['dataInicioVigencia', 'dataPublicacao', 'dataConclusao'])) ?? ano,
          numero: primeiro(registro, ['dimConvenio.numero', 'numero']),
          objeto,
          orgao: primeiro(registro, ['orgao.nome', 'unidadeGestora.orgaoVinculado.nome', 'orgao']),
          convenente: primeiro(registro, ['convenente.nome', 'convenente']),
          situacao,
          valor: paraNumero(primeiro(registro, ['valor', 'valorConvenio'])),
          valorLiberado: paraNumero(primeiro(registro, ['valorLiberado'])),
          status: classificarConvenio(situacao),
          ambiental: classificar(objeto),
          registro,
        });
      }
      ctx.log(`  Portal da Transparencia ${ano}: pagina ${pagina} (${lote.length})`);
    }
  }
  return {
    fonte: 'Portal da Transparencia (API)',
    geradoEm: new Date().toISOString(),
    itens,
    avisos: [],
  };
}
