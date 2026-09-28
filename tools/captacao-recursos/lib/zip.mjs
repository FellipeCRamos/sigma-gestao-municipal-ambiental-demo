// Leitura de entradas de arquivos .zip em streaming, sem dependencias externas.
// Suporta metodos "store" e "deflate", descritores de dados e ZIP64 (os
// arquivos do Transferegov passam de centenas de MB descompactados).

import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { Readable, pipeline } from 'node:stream';
import { createInflateRaw } from 'node:zlib';

const ASSINATURA_EOCD = 0x06054b50;
const ASSINATURA_LOCALIZADOR_ZIP64 = 0x07064b50;
const ASSINATURA_EOCD_ZIP64 = 0x06064b50;
const ASSINATURA_DIRETORIO_CENTRAL = 0x02014b50;
const ASSINATURA_CABECALHO_LOCAL = 0x04034b50;
const MAXIMO_32 = 0xffffffff;

async function lerTrecho(arquivo, posicao, tamanho) {
  const buffer = Buffer.alloc(tamanho);
  const { bytesRead } = await arquivo.read(buffer, 0, tamanho, posicao);
  return buffer.subarray(0, bytesRead);
}

async function localizarDiretorioCentral(arquivo, tamanhoArquivo) {
  const tamanhoCauda = Math.min(tamanhoArquivo, 22 + 65535 + 20);
  const cauda = await lerTrecho(arquivo, tamanhoArquivo - tamanhoCauda, tamanhoCauda);
  let posicao = -1;
  for (let i = cauda.length - 22; i >= 0; i--) {
    if (cauda.readUInt32LE(i) === ASSINATURA_EOCD) {
      posicao = i;
      break;
    }
  }
  if (posicao < 0) throw new Error('arquivo nao e um .zip valido (fim do diretorio central nao encontrado)');

  let total = cauda.readUInt16LE(posicao + 10);
  let tamanho = cauda.readUInt32LE(posicao + 12);
  let deslocamento = cauda.readUInt32LE(posicao + 16);

  const localizador = posicao - 20;
  if (localizador >= 0 && cauda.readUInt32LE(localizador) === ASSINATURA_LOCALIZADOR_ZIP64) {
    const posicaoEocd64 = Number(cauda.readBigUInt64LE(localizador + 8));
    const eocd64 = await lerTrecho(arquivo, posicaoEocd64, 56);
    if (eocd64.readUInt32LE(0) !== ASSINATURA_EOCD_ZIP64) throw new Error('registro ZIP64 invalido');
    total = Number(eocd64.readBigUInt64LE(32));
    tamanho = Number(eocd64.readBigUInt64LE(40));
    deslocamento = Number(eocd64.readBigUInt64LE(48));
  }
  return { total, tamanho, deslocamento };
}

export async function listarEntradasZip(caminho) {
  const arquivo = await open(caminho, 'r');
  try {
    const { size } = await arquivo.stat();
    const { total, tamanho, deslocamento } = await localizarDiretorioCentral(arquivo, size);
    const diretorio = await lerTrecho(arquivo, deslocamento, tamanho);
    const entradas = [];
    let p = 0;
    for (let k = 0; k < total; k++) {
      if (diretorio.readUInt32LE(p) !== ASSINATURA_DIRETORIO_CENTRAL) throw new Error('diretorio central do .zip corrompido');
      const flags = diretorio.readUInt16LE(p + 8);
      const metodo = diretorio.readUInt16LE(p + 10);
      let comprimido = diretorio.readUInt32LE(p + 20);
      let original = diretorio.readUInt32LE(p + 24);
      const tamanhoNome = diretorio.readUInt16LE(p + 28);
      const tamanhoExtra = diretorio.readUInt16LE(p + 30);
      const tamanhoComentario = diretorio.readUInt16LE(p + 32);
      let cabecalhoLocal = diretorio.readUInt32LE(p + 42);
      const nome = diretorio.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + tamanhoNome);

      let e = p + 46 + tamanhoNome;
      const fimExtra = e + tamanhoExtra;
      while (e + 4 <= fimExtra) {
        const id = diretorio.readUInt16LE(e);
        const tamanhoCampo = diretorio.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let q = e + 4;
          if (original === MAXIMO_32) { original = Number(diretorio.readBigUInt64LE(q)); q += 8; }
          if (comprimido === MAXIMO_32) { comprimido = Number(diretorio.readBigUInt64LE(q)); q += 8; }
          if (cabecalhoLocal === MAXIMO_32) { cabecalhoLocal = Number(diretorio.readBigUInt64LE(q)); }
        }
        e += 4 + tamanhoCampo;
      }
      entradas.push({ nome, metodo, comprimido, original, cabecalhoLocal });
      p = fimExtra + tamanhoComentario;
    }
    return entradas;
  } finally {
    await arquivo.close();
  }
}

export async function abrirEntradaZip(caminho, entrada) {
  const arquivo = await open(caminho, 'r');
  let cabecalho;
  try {
    cabecalho = await lerTrecho(arquivo, entrada.cabecalhoLocal, 30);
  } finally {
    await arquivo.close();
  }
  if (cabecalho.readUInt32LE(0) !== ASSINATURA_CABECALHO_LOCAL) throw new Error(`cabecalho local invalido em ${entrada.nome}`);
  const inicio = entrada.cabecalhoLocal + 30 + cabecalho.readUInt16LE(26) + cabecalho.readUInt16LE(28);
  if (entrada.comprimido === 0) return Readable.from([]);

  const bruto = createReadStream(caminho, { start: inicio, end: inicio + entrada.comprimido - 1 });
  if (entrada.metodo === 0) return bruto;
  if (entrada.metodo === 8) {
    const descompactador = createInflateRaw();
    pipeline(bruto, descompactador, () => {});
    return descompactador;
  }
  bruto.destroy();
  throw new Error(`${entrada.nome}: metodo de compressao ${entrada.metodo} nao suportado; extraia o .zip manualmente e use --dados-dir`);
}

// Abre o primeiro .csv (ou o que casar com `padrao`) de dentro do .zip.
export async function abrirCsvDoZip(caminho, padrao = /\.csv$/i) {
  const entradas = await listarEntradasZip(caminho);
  const entrada = entradas.find((item) => padrao.test(item.nome)) ?? entradas.find((item) => /\.csv$/i.test(item.nome));
  if (!entrada) throw new Error(`nenhum .csv encontrado em ${caminho}`);
  return abrirEntradaZip(caminho, entrada);
}
