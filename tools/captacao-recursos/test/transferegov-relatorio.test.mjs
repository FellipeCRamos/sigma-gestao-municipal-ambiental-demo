import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { STATUS, classificarConvenio, classificarProposta, criarClassificadorAmbiental } from '../lib/classificacao.mjs';
import { coletarTransferegov } from '../lib/fontes/transferegov.mjs';
import { calcularIndicadores, gerarMarkdown, lerManuais, montarMatriz, simularCenarios } from '../lib/relatorio.mjs';
import { alvoFicticio, contextoTeste, criarZip, lerConfig, pastaTemporaria } from './auxiliares.mjs';

// Base ficticia no layout dos dados abertos do Transferegov.
const PROGRAMAS = `ID_PROGRAMA;COD_PROGRAMA;NOME_PROGRAMA;DESC_ORGAO_SUP_PROGRAMA;SIT_PROGRAMA;ANO_DISPONIBILIZACAO;DATA_DISPONIBILIZACAO;DT_PROG_INI_RECEB_PROP;DT_PROG_FIM_RECEB_PROP;DT_PROG_INI_EMENDA_PAR;DT_PROG_FIM_EMENDA_PAR;DT_PROG_INI_BENEF_ESP;DT_PROG_FIM_BENEF_ESP;NATUREZA_JURIDICA_PROGRAMA;UF_PROGRAMA;ACAO_ORCAMENTARIA
1;P001;Gestão de Resíduos Sólidos Urbanos;MINISTERIO DEMO A;Disponibilizado;2018;01/03/2018;01/03/2018;30/04/2018;;;;;Administração Pública Municipal;;
2;P002;Castração de cães e gatos;MINISTERIO DEMO A;Disponibilizado;2021;01/02/2021;;;01/02/2021;30/03/2021;;;Administração Pública Municipal;;
3;P003;Recuperação de nascentes;MINISTERIO DEMO A;Disponibilizado;2019;01/05/2019;01/05/2019;30/06/2019;;;;;Administração Pública Municipal;;
4;P004;Drenagem urbana sustentável;MINISTERIO DEMO B;Disponibilizado;2019;01/05/2019;01/05/2019;30/06/2019;;;;;Administração Pública Municipal;;
5;P005;Arborização urbana e viveiros;MINISTERIO DEMO A;Disponibilizado;2020;01/04/2020;01/04/2020;30/05/2020;;;;;Administração Pública Municipal;ES;
5;P005;Arborização urbana e viveiros;MINISTERIO DEMO A;Disponibilizado;2020;01/04/2020;01/04/2020;30/05/2020;;;;;Administração Pública Municipal;SP;
6;P006;Pavimentação de vias;MINISTERIO DEMO B;Disponibilizado;2020;01/04/2020;01/04/2020;30/05/2020;;;;;Administração Pública Municipal;;
7;P007;Educação ambiental nas escolas;MINISTERIO DEMO A;Disponibilizado;2020;01/04/2020;01/04/2020;30/05/2020;;;;;Administração Pública Municipal;SP;
8;P008;Adaptação climática municipal;MINISTERIO DEMO A;Disponibilizado;2026;01/01/2026;01/01/2026;31/12/2099;;;;;Administração Pública Municipal;;
9;P009;Fauna silvestre;MINISTERIO DEMO A;Disponibilizado;2014;01/01/2014;01/01/2014;31/03/2014;;;;;Administração Pública Municipal;;
10;P010;Fortalecimento de OSC ambientais;MINISTERIO DEMO A;Disponibilizado;2020;01/04/2020;01/04/2020;30/05/2020;;;;;Organização da Sociedade Civil;;
11;P011;Sanidade animal nas propriedades rurais;MINISTERIO DEMO C;Disponibilizado;2020;01/04/2020;01/04/2020;30/05/2020;;;;;Administração Pública Municipal;;
`;

const VINCULOS = `ID_PROGRAMA;ID_PROPOSTA
1;100
3;101
4;102
5;200
5;201
5;202
5;203
5;103
1;104
`;

const CABECALHO_PROPOSTA = 'ID_PROPOSTA;UF_PROPONENTE;MUNIC_PROPONENTE;COD_MUNIC_IBGE;NATUREZA_JURIDICA;NR_PROPOSTA;ANO_PROP;DIA_PROP;DESC_ORGAO_SUP;DESC_ORGAO;MODALIDADE;IDENTIF_PROPONENTE;NM_PROPONENTE;SIT_PROPOSTA;OBJETO_PROPOSTA;VL_GLOBAL_PROP;VL_REPASSE_PROP;VL_CONTRAPARTIDA_PROP';
const PROPOSTAS = `${CABECALHO_PROPOSTA}
100;ES;VILA SERENA;3299999;Administração Pública Municipal;1/2018;2018;10/03/2018;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;11111111000111;MUNICIPIO DE VILA SERENA;Proposta/Plano de Trabalho Aprovados;"Coleta seletiva; ecopontos
e compostagem";"260.000,00";"250.000,00";"10.000,00"
101;ES;VILA SERENA;3299999;Administração Pública Municipal;2/2019;2019;10/05/2019;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;11111111000111;MUNICIPIO DE VILA SERENA;Proposta/Plano de Trabalho Rejeitados;Recuperar nascentes do rio demo;"125.000,00";"120.000,00";"5.000,00"
102;ES;VILA SERENA;3299999;Administração Pública Municipal;3/2019;2019;11/05/2019;MINISTERIO DEMO B;SECRETARIA DEMO;Contrato de Repasse;11111111000111;MUNICIPIO DE VILA SERENA;Proposta/Plano de Trabalho Aprovados;Drenagem do bairro demo;"510.000,00";"500.000,00";"10.000,00"
103;ES;VILA SERENA;3299999;Organização da Sociedade Civil;4/2020;2020;02/04/2020;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;22222222000122;ASSOCIACAO DEMO;Proposta/Plano de Trabalho Aprovados;Viveiro comunitário;"40.000,00";"40.000,00";"0,00"
104;ES;VILA SERENA;3299999;Administração Pública Municipal;9/2015;2015;01/03/2015;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;11111111000111;MUNICIPIO DE VILA SERENA;Proposta/Plano de Trabalho Aprovados;Antiga;"1,00";"1,00";"0,00"
200;ES;OUTRA CIDADE;3200001;Administração Pública Municipal;5/2020;2020;02/04/2020;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;33333333000133;MUNICIPIO DE OUTRA CIDADE;Proposta/Plano de Trabalho Aprovados;Arborização;"80.000,00";"80.000,00";"0,00"
201;ES;TERCEIRA CIDADE;3200002;Administração Pública Municipal;6/2020;2020;02/04/2020;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;44444444000144;MUNICIPIO DE TERCEIRA CIDADE;Proposta/Plano de Trabalho Aprovados;Viveiro;"120.000,00";"120.000,00";"0,00"
202;ES;QUARTA CIDADE;3200003;Administração Pública Municipal;7/2020;2020;02/04/2020;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;55555555000155;MUNICIPIO DE QUARTA CIDADE;Proposta/Plano de Trabalho Rejeitados;Mudas;"90.000,00";"90.000,00";"0,00"
203;SP;CIDADE PAULISTA;3500001;Administração Pública Municipal;8/2020;2020;02/04/2020;MINISTERIO DEMO A;SECRETARIA DEMO;Convênio;66666666000166;MUNICIPIO DE CIDADE PAULISTA;Proposta/Plano de Trabalho Aprovados;Arborização;"999.999,00";"999.999,00";"0,00"
`;

const CONVENIOS = `NR_CONVENIO;ID_PROPOSTA;DIA_ASSIN_CONV;SIT_CONVENIO;SUBSITUACAO_CONV;DIA_FIM_VIGENC_CONV;VL_GLOBAL_CONV;VL_REPASSE_CONV;VL_DESEMBOLSADO_CONV;VL_SALDO_REMAN_TESOURO
900001;100;20/06/2018;Em execução;;31/12/2020;"260.000,00";"250.000,00";"150.000,00";"0,00"
900002;102;20/08/2019;Convênio Anulado;;31/12/2021;"510.000,00";"500.000,00";"100.000,00";"0,00"
900003;103;20/08/2020;Em execução;;31/12/2022;"40.000,00";"40.000,00";"40.000,00";"0,00"
`;

const EMENDAS = `ID_PROPOSTA;NR_EMENDA;NOME_PARLAMENTAR;TIPO_PARLAMENTAR;IND_IMPOSITIVO;VALOR_REPASSE_PROPOSTA_EMENDA
100;20180001;PARLAMENTAR DEMO;Individual;SIM;"250.000,00"
`;

async function montarBaseFicticia() {
  const pasta = await pastaTemporaria();
  await writeFile(join(pasta, 'siconv_programa.csv.zip'), criarZip([{ nome: 'siconv_programa.csv', conteudo: PROGRAMAS }]));
  await writeFile(join(pasta, 'siconv_programa_proposta.csv'), VINCULOS);
  await writeFile(join(pasta, 'siconv_proposta.csv.zip'), criarZip([{ nome: 'siconv_proposta.csv', conteudo: Buffer.from(PROPOSTAS, 'utf8') }]));
  await writeFile(join(pasta, 'siconv_convenio.csv'), Buffer.from(CONVENIOS, 'latin1'));
  await writeFile(join(pasta, 'siconv_emenda.csv'), EMENDAS);
  return pasta;
}

test('classifica situacoes de proposta e convenio', () => {
  assert.equal(classificarProposta('Proposta/Plano de Trabalho Aprovados'), STATUS.CAPTADA);
  assert.equal(classificarProposta('Proposta/Plano de Trabalho Rejeitados'), STATUS.PERDIDA_REJEITADA);
  assert.equal(classificarProposta('Proposta/Plano de Trabalho Cancelados'), STATUS.PERDIDA_CANCELADA);
  assert.equal(classificarProposta('Proposta/Plano de Trabalho em Análise'), STATUS.EM_ANDAMENTO);
  assert.equal(classificarConvenio('Convênio Rescindido'), STATUS.PERDIDA_POS_CELEBRACAO);
  assert.equal(classificarConvenio('Prestação de Contas Rejeitada'), STATUS.RISCO);
  assert.equal(classificarConvenio('Prestação de Contas Aprovada'), STATUS.CAPTADA);
});

test('classificador ambiental usa eixos e ignora expressoes excluidas', async () => {
  const classificar = criarClassificadorAmbiental(await lerConfig());
  assert.deepEqual(classificar('Castração de cães e gatos').eixos, ['Bem-estar animal']);
  assert.equal(classificar('Sanidade animal nas propriedades rurais').relevante, false);
  assert.equal(classificar('Pavimentação de vias').relevante, false);
  assert.ok(classificar('Drenagem urbana', 'Manejo de resíduos').eixos.includes('Residuos solidos'));
});

test('Transferegov: cruza propostas, convenios, emendas e oportunidades', async () => {
  const ctx = await contextoTeste({ dadosDir: await montarBaseFicticia() });
  const resultado = await coletarTransferegov(ctx);
  const porId = Object.fromEntries(resultado.propostas.map((p) => [p.id, p]));

  assert.deepEqual(Object.keys(porId).sort(), ['100', '101', '102', '103']);
  assert.equal(porId[100].status, STATUS.CAPTADA);
  assert.equal(porId[100].valorCaptado, 250000);
  assert.equal(porId[100].origem, 'Emenda parlamentar');
  assert.deepEqual(porId[100].parlamentares, ['PARLAMENTAR DEMO']);
  assert.equal(porId[100].objeto, 'Coleta seletiva; ecopontos\ne compostagem');
  assert.equal(porId[101].status, STATUS.PERDIDA_REJEITADA);
  assert.equal(porId[101].valorPerdido, 120000);
  assert.equal(porId[102].status, STATUS.PERDIDA_POS_CELEBRACAO);
  assert.equal(porId[102].valorPerdido, 400000);
  assert.equal(porId[102].valorCaptado, 0);
  assert.equal(porId[103].proponenteMunicipal, false);

  const oportunidades = Object.fromEntries(resultado.oportunidades.map((o) => [o.codigo, o]));
  assert.deepEqual(Object.keys(oportunidades).sort(), ['P002', 'P005', 'P008']);
  assert.equal(oportunidades.P005.status, STATUS.NAO_PLEITEADA);
  assert.equal(oportunidades.P005.valorPotencial, 100000);
  assert.equal(oportunidades.P005.municipiosNaUf, 3);
  assert.ok(Math.abs(oportunidades.P005.taxaAprovacaoUf - 2 / 3) < 1e-9);
  assert.equal(oportunidades.P008.status, STATUS.EM_ABERTO);
  assert.equal(oportunidades.P002.status, STATUS.EMENDA_NAO_OBTIDA);

  assert.equal(resultado.rankingUf[0].municipio, 'VILA SERENA');
  assert.equal(resultado.rankingUf[0].valorAprovado, 750000);
});

test('relatorio consolida, calcula indicadores e simula cenarios', async () => {
  const config = await lerConfig();
  const ctx = await contextoTeste({ config, dadosDir: await montarBaseFicticia() });
  const transferegov = await coletarTransferegov(ctx);
  const manuais = await lerManuais(Readable.from([
    'esfera;fonte;tipo;identificador;ano;titulo;concedente;origem;status;valor_captado;valor_perdido;valor_potencial;taxa_aprovacao;eixos;observacao;link\n'
    + 'Estadual;Portaria demo;Adesao;;2025;Programa estadual demo;Secretaria estadual demo;Adesao;nao pleiteada;;;"150.000,00";1;Bem-estar animal;;\n'
    + 'Federal;Termo demo;Adesao;;2018;Termo de adesao demo;Orgao federal demo;Adesao;ADERIDA;;;;;;;\n'
    + 'Estadual;x;y;;2024;Status errado;;;talvez;;;;;;;\n',
  ]));
  assert.equal(manuais.linhas.length, 3);
  assert.equal(manuais.avisos.length, 1);

  const linhas = montarMatriz({ transferegov, manuais: manuais.linhas });
  const indicadores = calcularIndicadores(linhas, alvoFicticio(), transferegov.rankingUf);
  assert.equal(indicadores.captadoTotal, 250000);
  assert.equal(indicadores.propostasApresentadas, 3);
  assert.ok(Math.abs(indicadores.taxaSucesso - 2 / 3) < 1e-9);
  assert.equal(indicadores.perdidoApresentadas, 520000);
  assert.equal(indicadores.naoPleiteadas, 2);
  assert.equal(indicadores.potencialNaoPleiteado, 250000);
  assert.equal(indicadores.aderidas, 1);
  assert.equal(indicadores.dependenciaEmendas, 1);
  assert.equal(indicadores.posicaoRankingUf, 1);

  const cenarios = simularCenarios(linhas, indicadores, config.cenarioSistema);
  const conservador = cenarios.find((c) => c.nome === 'Conservador');
  // (100.000 x 2/3 + 150.000 x 1) x 40% + 520.000 x 30%
  assert.ok(Math.abs(conservador.ganhoOportunidades - (100000 * (2 / 3) + 150000) * 0.4) < 1e-6);
  assert.equal(conservador.ganhoPerdasEvitadas, 156000);

  const md = gerarMarkdown({ alvo: alvoFicticio(), linhas, indicadores, cenarios, avisos: ['aviso demo'], configCenario: config.cenarioSistema });
  assert.match(md, /# Captacao de recursos na area ambiental - Vila Serena\/ES/);
  assert.match(md, /Arborização urbana e viveiros/);
  assert.match(md, /aviso demo/);
});

test('CLI roda federal com base local e gera relatorio', async () => {
  const dados = await montarBaseFicticia();
  const saida = join(await pastaTemporaria(), 'saida');
  const cli = fileURLToPath(new URL('../captacao.mjs', import.meta.url));
  const executar = promisify(execFile);
  const argumentos = ['--municipio', 'Vila Serena', '--uf', 'es', '--ibge', '3299999', '--saida', saida];
  await executar(process.execPath, [cli, 'federal', ...argumentos, '--dados-dir', dados]);
  await executar(process.execPath, [cli, 'relatorio', ...argumentos]);
  const md = await readFile(join(saida, 'relatorio-captacao.md'), 'utf8');
  const csv = await readFile(join(saida, 'matriz-oportunidades.csv'), 'utf8');
  assert.match(md, /Taxa de sucesso das propostas \| 66,7%/);
  assert.ok(csv.startsWith('﻿esfera;fonte;tipo'));
  assert.match(csv, /NAO_PLEITEADA/);
});

test('CLI valida parametros obrigatorios', async () => {
  const cli = fileURLToPath(new URL('../captacao.mjs', import.meta.url));
  await assert.rejects(promisify(execFile)(process.execPath, [cli, 'federal', '--municipio', 'X']), /informe --municipio e --uf/);
  await assert.rejects(promisify(execFile)(process.execPath, [cli, 'federal', '--municipio', 'X', '--uf', 'ES', '--ibge', '123']), /7 digitos/);
});
