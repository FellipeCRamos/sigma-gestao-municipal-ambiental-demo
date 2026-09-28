import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import { ParserCsv, detectarDelimitador, gerarCsv, linhasCsv, registrosCsv } from '../lib/csv.mjs';
import { anoDe, criarCasador, criarCasadorExato, mediana, nomeDoEnte, normalizar, normalizarColuna, paraDataIso, paraNumero } from '../lib/texto.mjs';
import { abrirCsvDoZip, listarEntradasZip } from '../lib/zip.mjs';
import { criarZip, pastaTemporaria } from './auxiliares.mjs';

async function coletar(iteravel) {
  const itens = [];
  for await (const item of iteravel) itens.push(item);
  return itens;
}

async function textoDoStream(stream) {
  const partes = [];
  for await (const parte of stream) partes.push(Buffer.from(parte));
  return Buffer.concat(partes).toString('utf8');
}

test('normaliza texto e nomes de coluna', () => {
  assert.equal(normalizar('  Gestão   Ambiental '), 'GESTAO AMBIENTAL');
  assert.equal(normalizarColuna('Dt. Prog. Ini'), 'DT_PROG_INI');
});

test('converte numeros em formatos brasileiro e internacional', () => {
  assert.equal(paraNumero('1.234.567,89'), 1234567.89);
  assert.equal(paraNumero('1234,5'), 1234.5);
  assert.equal(paraNumero('1234.56'), 1234.56);
  assert.equal(paraNumero('1,234.56'), 1234.56);
  assert.equal(paraNumero('R$ 2.000'), 2000);
  assert.equal(paraNumero('1.000.000'), 1000000);
  assert.equal(paraNumero('-10,5'), -10.5);
  assert.equal(paraNumero(''), 0);
  assert.equal(paraNumero('abc'), 0);
});

test('converte datas e extrai ano', () => {
  assert.equal(paraDataIso('5/3/2019'), '2019-03-05');
  assert.equal(paraDataIso('2021-12-31T00:00:00'), '2021-12-31');
  assert.equal(paraDataIso('sem data'), null);
  assert.equal(anoDe('', '2018', '01/01/2017'), 2018);
  assert.equal(anoDe('', 'x'), null);
});

test('casador por prefixo de palavra e casador exato', () => {
  const casar = criarCasador(['residuo', 'CASTRA']);
  assert.deepEqual(casar('Gestão de Resíduos Sólidos e castração'), ['RESIDUO', 'CASTRA']);
  assert.deepEqual(casar('pré-resíduo'), ['RESIDUO']);
  assert.deepEqual(casar('Anticastração'), []);
  const exato = criarCasadorExato('Vila Serena');
  assert.equal(exato('PREFEITURA MUNICIPAL DE VILA SERENA - ES'), true);
  assert.equal(exato('VILA SERENAS'), false);
  assert.equal(exato('Municipio de Vila Serena do Norte'), false);
  assert.equal(nomeDoEnte('PREFEITURA MUNICIPAL DE VILA SERENA - ES'), 'VILA SERENA');
  assert.equal(nomeDoEnte('Município de Vila Serena/ES'), 'VILA SERENA');
  assert.equal(nomeDoEnte('MUNICIPIO DE VILA SERENA DO NORTE'), 'VILA SERENA DO NORTE');
});

test('mediana ignora zeros e valores invalidos', () => {
  assert.equal(mediana([0, 10, 30, NaN]), 20);
  assert.equal(mediana([5, 1, 3]), 3);
  assert.equal(mediana([]), 0);
});

test('detecta delimitador fora de aspas', () => {
  assert.equal(detectarDelimitador('a;b;"c,d,e"'), ';');
  assert.equal(detectarDelimitador('a,b,c'), ',');
  assert.equal(detectarDelimitador('a\tb\tc'), '\t');
});

test('parser CSV lida com aspas, aspas escapadas, quebras de linha e CRLF', async () => {
  const csv = 'ID;OBJETO;VALOR\r\n1;"Obra; com ""aspas""\ne quebra";"1.000,50"\r\n\r\n2;simples;3\n3;"";\n';
  const linhas = await coletar(linhasCsv(Readable.from([csv])));
  assert.deepEqual(linhas, [
    ['ID', 'OBJETO', 'VALOR'],
    ['1', 'Obra; com "aspas"\ne quebra', '1.000,50'],
    ['2', 'simples', '3'],
    ['3', '', ''],
  ]);
});

test('parser CSV e robusto a pedacos quebrados em qualquer ponto', () => {
  const csv = 'A;B\n"x""y";"z\nw"\nfinal;sem quebra';
  const esperado = [['A', 'B'], ['x"y', 'z\nw'], ['final', 'sem quebra']];
  for (let tamanho = 1; tamanho <= 5; tamanho++) {
    const parser = new ParserCsv();
    const linhas = [];
    for (let i = 0; i < csv.length; i += tamanho) linhas.push(...parser.push(csv.slice(i, i + tamanho)));
    linhas.push(...parser.end());
    assert.deepEqual(linhas, esperado, `pedacos de ${tamanho}`);
  }
});

test('registros CSV usam cabecalho normalizado e detectam Windows-1252', async () => {
  const latin1 = Buffer.from('Município;Situação\nFundo;Aprovação\n', 'latin1');
  const registros = await coletar(registrosCsv(Readable.from([latin1])));
  assert.deepEqual(registros, [{ MUNICIPIO: 'Fundo', SITUACAO: 'Aprovação' }]);

  const utf8ComBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Situação\nAção\n')]);
  assert.deepEqual(await coletar(registrosCsv(Readable.from([utf8ComBom]))), [{ SITUACAO: 'Ação' }]);
});

test('multibyte UTF-8 dividido entre pedacos nao corrompe o texto', async () => {
  const bytes = Buffer.from('A\nçãõ\n');
  const pedacos = [...bytes].map((byte) => Buffer.from([byte]));
  assert.deepEqual(await coletar(linhasCsv(Readable.from(pedacos))), [['A'], ['çãõ']]);
});

test('gerarCsv escapa campos e inclui BOM', () => {
  const csv = gerarCsv([{ a: 'x;y', b: 'com "aspas"' }], [{ chave: 'a', titulo: 'A' }, { chave: 'b', titulo: 'B', valor: (l) => l.b.toUpperCase() }]);
  assert.equal(csv, '﻿A;B\r\n"x;y";"COM ""ASPAS"""\r\n');
});

test('le entradas de zip com store e deflate', async () => {
  const pasta = await pastaTemporaria();
  const caminho = join(pasta, 'dados.zip');
  const conteudo = `ID;NOME\n${Array.from({ length: 2000 }, (_, i) => `${i};item ${i}`).join('\n')}\n`;
  await writeFile(caminho, criarZip([
    { nome: 'leia-me.txt', conteudo: 'texto', deflate: false },
    { nome: 'dados.csv', conteudo },
  ]));
  const entradas = await listarEntradasZip(caminho);
  assert.deepEqual(entradas.map((e) => [e.nome, e.metodo]), [['leia-me.txt', 0], ['dados.csv', 8]]);
  assert.equal(await textoDoStream(await abrirCsvDoZip(caminho)), conteudo);
});

test('le zip gerado pelo utilitario zip, com descritor de dados e ZIP64', async (t) => {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch {
    t.skip('utilitario zip indisponivel');
    return;
  }
  const pasta = await pastaTemporaria();
  const conteudo = `ID;VALOR\n${Array.from({ length: 500 }, (_, i) => `${i};${i * 10}`).join('\n')}\n`;
  await writeFile(join(pasta, 'origem.csv'), conteudo);
  // Entrada e saida por pipe forcam o descritor de dados; -fz forca ZIP64 no arquivo.
  const doStdin = execFileSync('zip', ['-q', '-', '-'], { input: conteudo });
  await writeFile(join(pasta, 'stdin.zip'), doStdin);
  execFileSync('zip', ['-q', '-fz', join(pasta, 'arquivo.zip'), 'origem.csv'], { cwd: pasta });
  assert.equal(await textoDoStream(await abrirCsvDoZip(join(pasta, 'arquivo.zip'))), conteudo);
  const entradas = await listarEntradasZip(join(pasta, 'stdin.zip'));
  assert.deepEqual(entradas.map((e) => e.metodo), [8]);
  assert.equal(await textoDoStream(await abrirCsvDoZip(join(pasta, 'stdin.zip'), /.*/)), conteudo);
  assert.ok((await readFile(join(pasta, 'arquivo.zip'))).includes(Buffer.from([0x50, 0x4b, 0x06, 0x06])), 'zip deveria ter registro ZIP64');
});
