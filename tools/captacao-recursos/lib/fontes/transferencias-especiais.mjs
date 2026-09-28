// Emendas "PIX" (transferencias especiais) pela API publica do Transferegov
// (PostgREST). Os nomes de campo sao descobertos na primeira resposta para
// tolerar mudancas de layout da API.

import { STATUS, criarClassificadorAmbiental } from '../classificacao.mjs';
import { obterJson } from '../rede.mjs';
import { anoDe, nomeDoEnte, normalizar, paraNumero, somenteDigitos } from '../texto.mjs';

function acharCampo(campos, ...padroes) {
  return campos.find((nome) => padroes.every((padrao) => padrao.test(nome))) ?? null;
}

export function mapearCamposPlanoAcao(campos) {
  return {
    uf: acharCampo(campos, /uf/i, /benefici/i),
    nome: acharCampo(campos, /nome/i, /benefici/i),
    cnpj: acharCampo(campos, /cnpj/i, /benefici/i),
    ano: acharCampo(campos, /(?:^|_)ano(?:_|$)/i),
    parlamentar: acharCampo(campos, /nome/i, /parlamentar/i),
    emenda: acharCampo(campos, /numero|codigo/i, /emenda/i),
    situacao: acharCampo(campos, /situacao/i),
    valores: campos.filter((nome) => /valor/i.test(nome)),
    textos: campos.filter((nome) => /objeto|finalidade|descricao|area|politica|justificativa/i.test(nome)),
  };
}

export function pertenceAoMunicipio(registro, campos, alvo) {
  if (campos.cnpj && alvo.cnpjs.length) {
    const documento = somenteDigitos(registro[campos.cnpj]);
    if (documento) return alvo.cnpjs.includes(documento);
  }
  if (!campos.nome) return false;
  // Beneficiario costuma vir como "MUNICIPIO DE X" ou "PREFEITURA MUNICIPAL DE X".
  return nomeDoEnte(registro[campos.nome]) === alvo.municipioNormalizado;
}

export async function coletarTransferenciasEspeciais(ctx) {
  const { base, tabela, tamanhoPagina } = ctx.config.transferenciasEspeciais;
  const classificar = criarClassificadorAmbiental(ctx.config);
  const amostra = await obterJson(`${base}/${tabela}?limit=1`);
  const campos = mapearCamposPlanoAcao(Object.keys(amostra?.[0] ?? {}));
  if (!campos.uf && !campos.nome) throw new Error(`layout inesperado em ${base}/${tabela}: campos de beneficiario nao encontrados`);

  ctx.log(`Transferencias especiais: filtrando ${campos.uf ? `${campos.uf}=${ctx.alvo.uf}` : 'todas as UFs'}`);
  const registros = [];
  for (let offset = 0; ; offset += tamanhoPagina) {
    const filtro = campos.uf ? `&${campos.uf}=eq.${encodeURIComponent(ctx.alvo.uf)}` : '';
    const pagina = await obterJson(`${base}/${tabela}?limit=${tamanhoPagina}&offset=${offset}${filtro}`);
    if (!Array.isArray(pagina) || !pagina.length) break;
    registros.push(...pagina.filter((registro) => pertenceAoMunicipio(registro, campos, ctx.alvo)));
    if (pagina.length < tamanhoPagina) break;
  }

  const itens = registros
    .map((registro) => {
      const ano = anoDe(registro[campos.ano]);
      const total = campos.valores.find((nome) => /total/i.test(nome));
      const valor = total
        ? paraNumero(registro[total])
        : campos.valores.reduce((soma, nome) => soma + paraNumero(registro[nome]), 0);
      const texto = campos.textos.map((nome) => registro[nome]).join(' ');
      return {
        ano,
        emenda: campos.emenda ? registro[campos.emenda] : '',
        parlamentar: campos.parlamentar ? registro[campos.parlamentar] : '',
        situacao: campos.situacao ? registro[campos.situacao] : '',
        valor,
        ambiental: classificar(texto),
        status: /IMPEDID|CANCELAD|REJEITAD|DEVOLV/.test(normalizar(campos.situacao ? registro[campos.situacao] : '')) ? STATUS.PERDIDA_CANCELADA : STATUS.CAPTADA,
        registro,
      };
    })
    .filter((item) => !item.ano || item.ano >= ctx.alvo.desde);

  return {
    fonte: 'Transferegov - transferencias especiais (emendas PIX)',
    geradoEm: new Date().toISOString(),
    camposDetectados: campos,
    itens,
    avisos: itens.length ? [] : ['Nenhuma transferencia especial encontrada para o municipio (ou layout da API mudou).'],
  };
}
