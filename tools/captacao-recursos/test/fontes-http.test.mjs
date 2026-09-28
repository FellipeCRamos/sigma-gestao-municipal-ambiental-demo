import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STATUS } from '../lib/classificacao.mjs';
import { anosCitados, coletarCkan, recursoEhCsv } from '../lib/fontes/ckan.mjs';
import { coletarPortalTp, criarFiltroOrgao, decodificarResposta, extrairConsultas, somarValores } from '../lib/fontes/portal-tp.mjs';
import { coletarPortalTransparencia } from '../lib/fontes/portal-transparencia.mjs';
import { coletarTransferenciasEspeciais, mapearCamposPlanoAcao } from '../lib/fontes/transferencias-especiais.mjs';
import { alvoFicticio, contextoTeste, criarZip, lerConfig, servidorLocal } from './auxiliares.mjs';

const ANO_ATUAL = new Date().getFullYear();

test('portaltp: decodifica JSON puro, {"d"} e JSON dentro de XML', () => {
  assert.deepEqual(decodificarResposta('[{"a":1}]'), [{ a: 1 }]);
  assert.deepEqual(decodificarResposta('{"d":"[{\\"a\\":2}]"}'), [{ a: 2 }]);
  assert.deepEqual(decodificarResposta('<?xml version="1.0"?><string xmlns="http://tempuri.org/">[{&quot;a&quot;:3,&quot;b&quot;:&quot;x &amp; y&quot;}]</string>'), [{ a: 3, b: 'x & y' }]);
  assert.deepEqual(decodificarResposta('{"dados":[{"a":4}]}'), [{ a: 4 }]);
  assert.deepEqual(decodificarResposta(''), []);
});

test('portaltp: extrai consultas e filtra pelo orgao', () => {
  assert.deepEqual(extrairConsultas('<a href="x/json_empenhos?ano=">e</a> json_contratos json_EMPENHOS'), ['json_empenhos', 'json_contratos']);
  const filtrar = criarFiltroOrgao(['meio ambiente']);
  assert.equal(filtrar({ unidade_gestora: 'SECRETARIA MUNICIPAL DE MEIO AMBIENTE', valor: '10' }), 'unidade');
  assert.equal(filtrar({ unidade_gestora: 'SECRETARIA DE OBRAS', objeto: 'Mudas para o Meio Ambiente' }), 'texto');
  assert.equal(filtrar({ unidade_gestora: 'SECRETARIA DE OBRAS', objeto: 'asfalto' }), null);
  assert.deepEqual(somarValores([{ valor: '1.000,50', nome: 'x' }, { valor: 2, valor_pago: '3' }]), { valor: 1002.5, valor_pago: 3 });
});

test('portaltp: coleta por ano, cai para mes quando exigido e protege dados pessoais', async () => {
  const servidor = await servidorLocal((url) => {
    if (url.pathname === '/api/dadosabertos.aspx') {
      return { tipo: 'text/html', corpo: 'Consultas: json_empenhos, json_contratos, json_servidores_secretaria' };
    }
    const consulta = url.pathname.split('/').pop();
    const ano = Number(url.searchParams.get('ano'));
    if (consulta === 'json_empenhos') {
      if (!url.searchParams.get('mes')) return { status: 500, tipo: 'text/plain', corpo: 'Missing parameter: mes.' };
      if (ano !== 2020 || url.searchParams.get('mes') !== '3') return { corpo: [] };
      return {
        tipo: 'text/xml',
        corpo: `<string>${JSON.stringify([
          { unidade_gestora: 'FUNDO MUNICIPAL DE MEIO AMBIENTE', valor_empenhado: '1.500,00', historico: 'mudas' },
          { unidade_gestora: 'SECRETARIA DE SAUDE', valor_empenhado: '9.999,00', historico: 'remedios' },
        ]).replace(/"/g, '&quot;')}</string>`,
      };
    }
    if (consulta === 'json_contratos') {
      return { corpo: ano === 2021 ? [{ unidade_gestora: 'SEC. DE ADMINISTRACAO', objeto: 'Veiculo para a Secretaria de Meio Ambiente', valor: '80000' }] : [] };
    }
    if (consulta === 'json_servidores_secretaria') {
      return { corpo: [{ secretaria: 'MEIO AMBIENTE', nome: 'Pessoa Demo', salario: '1000' }] };
    }
    return { status: 404, corpo: 'x' };
  });
  try {
    const ctx = await contextoTeste({ alvo: alvoFicticio({ desde: 2020 }) });
    const resultado = await coletarPortalTp(ctx, { base: `${servidor.base}/`, termos: ['MEIO AMBIENTE'], intervaloMs: 0 });
    const porConsulta = Object.fromEntries(resultado.consultas.map((c) => [c.consulta, c]));

    assert.deepEqual(Object.keys(porConsulta), ['json_empenhos', 'json_contratos', 'json_servidores_secretaria']);
    assert.equal(porConsulta.json_empenhos.anos[2020].doOrgao, 1);
    assert.deepEqual(porConsulta.json_empenhos.anos[2020].somas, { valor_empenhado: 1500 });
    assert.equal(porConsulta.json_empenhos.registros[0].historico, 'mudas');
    assert.equal(porConsulta.json_contratos.anos[2021].porUnidade, 0);
    assert.equal(porConsulta.json_contratos.registros[0].criterio, 'texto');
    assert.equal(porConsulta.json_servidores_secretaria.pessoal, true);
    assert.equal(porConsulta.json_servidores_secretaria.registros.length, 0, 'nao deve guardar dados pessoais');
    assert.equal(porConsulta.json_servidores_secretaria.anos[2020].doOrgao, 1);
    const mesesPedidos = servidor.chamadas.filter((u) => u.pathname.endsWith('json_empenhos') && u.searchParams.get('ano') === '2020');
    assert.equal(mesesPedidos.length, 13, '1 tentativa anual + 12 meses');
  } finally {
    await servidor.fechar();
  }
});

test('emendas PIX: descobre campos, filtra UF e municipio', async () => {
  const mapeados = mapearCamposPlanoAcao(['id_plano_acao', 'uf_beneficiario_plano_acao', 'nome_beneficiario_plano_acao', 'ano_plano_acao']);
  assert.equal(mapeados.uf, 'uf_beneficiario_plano_acao');
  assert.equal(mapeados.ano, 'ano_plano_acao');
  assert.equal(mapearCamposPlanoAcao(['id_plano_acao']).ano, null);
  const registros = [
    { ano_plano_acao: 2021, uf_beneficiario_plano_acao: 'ES', nome_beneficiario_plano_acao: 'MUNICIPIO DE VILA SERENA', cnpj_beneficiario_plano_acao: '11111111000111', nome_parlamentar_emenda_plano_acao: 'PARLAMENTAR DEMO', numero_emenda_plano_acao: '202100001', valor_custeio_plano_acao: 100000, valor_investimento_plano_acao: 50000, situacao_plano_acao: 'CIENTE', descricao_programacao_orcamentaria: 'castração de animais' },
    { ano_plano_acao: 2022, uf_beneficiario_plano_acao: 'ES', nome_beneficiario_plano_acao: 'MUNICIPIO DE VILA SERENA', cnpj_beneficiario_plano_acao: '11111111000111', nome_parlamentar_emenda_plano_acao: 'OUTRO DEMO', numero_emenda_plano_acao: '202200002', valor_custeio_plano_acao: 0, valor_investimento_plano_acao: 300000, situacao_plano_acao: 'IMPEDIDO', descricao_programacao_orcamentaria: 'pavimentacao' },
    { ano_plano_acao: 2022, uf_beneficiario_plano_acao: 'ES', nome_beneficiario_plano_acao: 'MUNICIPIO DE VILA SERENA DO NORTE', cnpj_beneficiario_plano_acao: '99999999000199', nome_parlamentar_emenda_plano_acao: 'X', numero_emenda_plano_acao: '1', valor_custeio_plano_acao: 1, valor_investimento_plano_acao: 1, situacao_plano_acao: 'CIENTE', descricao_programacao_orcamentaria: '' },
  ];
  const servidor = await servidorLocal((url) => {
    if (url.searchParams.get('limit') === '1') return { corpo: [registros[0]] };
    assert.equal(url.searchParams.get('uf_beneficiario_plano_acao'), 'eq.ES');
    const offset = Number(url.searchParams.get('offset'));
    return { corpo: registros.slice(offset, offset + 2) };
  });
  try {
    const config = await lerConfig();
    config.transferenciasEspeciais = { base: servidor.base, tabela: 'plano_acao_especial', tamanhoPagina: 2 };
    const ctx = await contextoTeste({ config });
    const resultado = await coletarTransferenciasEspeciais(ctx);
    assert.equal(resultado.itens.length, 2);
    assert.equal(resultado.itens[0].valor, 150000);
    assert.equal(resultado.itens[0].status, STATUS.CAPTADA);
    assert.deepEqual(resultado.itens[0].ambiental.eixos, ['Bem-estar animal']);
    assert.equal(resultado.itens[1].status, STATUS.PERDIDA_CANCELADA);
  } finally {
    await servidor.fechar();
  }
});

test('CKAN: busca conjuntos, baixa CSV/ZIP e extrai linhas do municipio', async () => {
  assert.deepEqual(anosCitados('despesas_2015_a_2019.csv'), [2015, 2019]);
  assert.equal(recursoEhCsv({ format: 'CSV', url: 'x' }), true);
  assert.equal(recursoEhCsv({ format: 'PDF', url: 'x.pdf' }), false);

  const csv = 'Municipio;Objeto;Valor Repasse\nVila Serena;Castração de cães;"10.000,00"\nOutra;Obra;"5,00"\nPREFEITURA MUNICIPAL DE VILA SERENA - ES;Pavimentação;"2.000,00"\nVila Serena do Norte;Obra;"7,00"\n';
  let base;
  const servidor = await servidorLocal((url) => {
    if (url.pathname === '/api/3/action/package_search') {
      return {
        corpo: {
          result: {
            results: [{
              name: 'transferencias',
              title: 'Transferencias a municipios',
              resources: [
                { id: 'r1', name: 'transferencias_2021.csv', format: 'CSV', url: `${base}/r1.csv` },
                { id: 'r2', name: 'transferencias_2012.csv', format: 'CSV', url: `${base}/antigo.csv` },
                { id: 'r3', name: 'compactado', format: 'CSV', url: `${base}/r3.zip` },
                { id: 'r4', name: 'manual.pdf', format: 'PDF', url: `${base}/m.pdf` },
              ],
            }],
          },
        },
      };
    }
    if (url.pathname === '/r1.csv') return { tipo: 'text/csv', corpo: csv };
    if (url.pathname === '/r3.zip') return { tipo: 'application/zip', corpo: criarZip([{ nome: 'dados.csv', conteudo: csv }]) };
    return { status: 404, corpo: 'nao encontrado' };
  });
  base = servidor.base;
  try {
    const config = await lerConfig();
    config.ckan = { ...config.ckan, portais: [{ nome: 'Portal Demo', base, consultas: ['transferencia', 'convenio'] }] };
    const ctx = await contextoTeste({ config });
    const resultado = await coletarCkan(ctx);
    assert.deepEqual(resultado.recursos.map((r) => r.recurso), ['transferencias_2021.csv', 'compactado']);
    assert.equal(resultado.recursos[0].total, 2);
    assert.equal(resultado.recursos[0].ambientais, 1);
    assert.deepEqual(resultado.recursos[0].somas, { VALOR_REPASSE: 12000 });
    assert.ok(!servidor.chamadas.some((u) => u.pathname === '/antigo.csv'), 'recurso anterior ao periodo nao deve ser baixado');
  } finally {
    await servidor.fechar();
  }
});

test('Portal da Transparencia: pula sem chave e pagina por ano com chave', async () => {
  const config = await lerConfig();
  const semChave = await coletarPortalTransparencia(await contextoTeste({ config }));
  assert.match(semChave.avisos[0], /PORTAL_TRANSPARENCIA_CHAVE/);

  const servidor = await servidorLocal((url, req) => {
    assert.equal(req.headers['chave-api-dados'], 'chave-demo');
    assert.equal(url.searchParams.get('codigoIBGE'), '3299999');
    const ano = url.searchParams.get('dataInicial').slice(-4);
    if (ano !== String(ANO_ATUAL) || url.searchParams.get('pagina') !== '1') return { corpo: [] };
    return { corpo: [{ dimConvenio: { numero: '123', objeto: 'Aquisição de castramóvel' }, situacao: 'EM EXECUÇÃO', valor: 200000, valorLiberado: 50000, orgao: { nome: 'MINISTERIO DEMO' } }] };
  });
  process.env.PORTAL_TRANSPARENCIA_CHAVE = 'chave-demo';
  try {
    config.portalTransparencia = { ...config.portalTransparencia, base: servidor.base, intervaloMs: 0 };
    const resultado = await coletarPortalTransparencia(await contextoTeste({ config, alvo: alvoFicticio({ desde: ANO_ATUAL }) }));
    assert.equal(resultado.itens.length, 1);
    assert.equal(resultado.itens[0].numero, '123');
    assert.equal(resultado.itens[0].status, STATUS.CAPTADA);
    assert.equal(resultado.itens[0].ambiental.relevante, true);
  } finally {
    delete process.env.PORTAL_TRANSPARENCIA_CHAVE;
    await servidor.fechar();
  }
});
