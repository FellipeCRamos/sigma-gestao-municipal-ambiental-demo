// Apoio aos testes: zip em memoria, servidor HTTP local e contexto de coleta.

import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';

import { criarCasadorExato, normalizar } from '../lib/texto.mjs';

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = TABELA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function criarZip(arquivos) {
  const partes = [];
  const central = [];
  let deslocamento = 0;
  for (const { nome, conteudo, deflate = true } of arquivos) {
    const dados = Buffer.from(conteudo);
    const comprimido = deflate ? deflateRawSync(dados) : dados;
    const nomeBuffer = Buffer.from(nome);
    const crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuffer.length, 26);
    partes.push(local, nomeBuffer, comprimido);

    const registro = Buffer.alloc(46);
    registro.writeUInt32LE(0x02014b50, 0);
    registro.writeUInt16LE(20, 4);
    registro.writeUInt16LE(20, 6);
    registro.writeUInt16LE(0x800, 8);
    registro.writeUInt16LE(deflate ? 8 : 0, 10);
    registro.writeUInt32LE(crc, 16);
    registro.writeUInt32LE(comprimido.length, 20);
    registro.writeUInt32LE(dados.length, 24);
    registro.writeUInt16LE(nomeBuffer.length, 28);
    registro.writeUInt32LE(deslocamento, 42);
    central.push(registro, nomeBuffer);
    deslocamento += 30 + nomeBuffer.length + comprimido.length;
  }
  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, diretorio, fim]);
}

export async function pastaTemporaria() {
  return mkdtemp(join(tmpdir(), 'captacao-teste-'));
}

// Sobe um servidor em porta livre; `rotas(url, req)` devolve { status, corpo, tipo }.
export async function servidorLocal(rotas) {
  const chamadas = [];
  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    chamadas.push(url);
    const resposta = (await rotas(url, req)) ?? { status: 404, corpo: 'nao encontrado' };
    res.writeHead(resposta.status ?? 200, { 'content-type': resposta.tipo ?? 'application/json' });
    res.end(typeof resposta.corpo === 'string' || Buffer.isBuffer(resposta.corpo) ? resposta.corpo : JSON.stringify(resposta.corpo));
  });
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return { base, chamadas, fechar: () => new Promise((resolve) => servidor.close(resolve)) };
}

export async function lerConfig() {
  return JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));
}

// Municipio ficticio usado em todos os testes.
export function alvoFicticio(extra = {}) {
  const municipio = extra.municipio ?? 'Vila Serena';
  return {
    municipio,
    municipioNormalizado: normalizar(municipio),
    uf: 'ES',
    ibge: '3299999',
    cnpjs: [],
    desde: 2016,
    casarMunicipio: criarCasadorExato(municipio),
    ...extra,
  };
}

export async function contextoTeste({ config, alvo, dadosDir = null } = {}) {
  const saida = await pastaTemporaria();
  return {
    alvo: alvo ?? alvoFicticio(),
    config: config ?? (await lerConfig()),
    saida,
    cacheDir: join(saida, '_cache'),
    dadosDir,
    atualizar: true,
    log: () => {},
  };
}
