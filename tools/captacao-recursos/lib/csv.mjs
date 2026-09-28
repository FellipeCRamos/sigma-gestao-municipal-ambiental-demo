// Leitor de CSV em streaming (RFC 4180): aspas, aspas escapadas, quebras de
// linha dentro de campos, delimitador detectado pelo cabecalho e deteccao de
// codificacao (UTF-8 com fallback para Windows-1252, comum em dados publicos).

import { normalizarColuna } from './texto.mjs';

const ASPAS = 34;
const LF = 10;
const CR = 13;

export function detectarDelimitador(linha) {
  const candidatos = [';', ',', '\t', '|'];
  let melhor = ';';
  let maior = -1;
  for (const delimitador of candidatos) {
    let total = 0;
    let dentroAspas = false;
    for (const caractere of linha) {
      if (caractere === '"') dentroAspas = !dentroAspas;
      else if (!dentroAspas && caractere === delimitador) total++;
    }
    if (total > maior) {
      maior = total;
      melhor = delimitador;
    }
  }
  return melhor;
}

export class ParserCsv {
  constructor(delimitador = null) {
    this.delimitador = delimitador;
    this.pendente = '';
    this.campo = '';
    this.linha = [];
    this.dentroAspas = false;
    this.acabouDeFecharAspas = false;
    this.campoIniciado = false;
  }

  push(texto) {
    const linhas = [];
    if (this.delimitador === null) {
      this.pendente += texto;
      const fim = this.pendente.indexOf('\n');
      if (fim === -1 && this.pendente.length < 1_000_000) return linhas;
      this.delimitador = detectarDelimitador(fim === -1 ? this.pendente : this.pendente.slice(0, fim));
      texto = this.pendente;
      this.pendente = '';
    }
    const codigoDelimitador = this.delimitador.charCodeAt(0);
    const n = texto.length;
    let i = 0;
    while (i < n) {
      if (this.dentroAspas) {
        const fechamento = texto.indexOf('"', i);
        if (fechamento === -1) {
          this.campo += texto.slice(i);
          break;
        }
        this.campo += texto.slice(i, fechamento);
        this.dentroAspas = false;
        this.acabouDeFecharAspas = true;
        i = fechamento + 1;
        continue;
      }
      const codigo = texto.charCodeAt(i);
      if (this.acabouDeFecharAspas) {
        this.acabouDeFecharAspas = false;
        if (codigo === ASPAS) {
          this.campo += '"';
          this.dentroAspas = true;
          i++;
          continue;
        }
      }
      if (codigo === ASPAS && !this.campoIniciado) {
        this.dentroAspas = true;
        this.campoIniciado = true;
        i++;
        continue;
      }
      if (codigo === codigoDelimitador) {
        this.#fecharCampo();
        i++;
        continue;
      }
      if (codigo === LF) {
        this.#fecharCampo();
        linhas.push(this.linha);
        this.linha = [];
        i++;
        continue;
      }
      if (codigo === CR) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < n) {
        const proximo = texto.charCodeAt(j);
        if (proximo === codigoDelimitador || proximo === LF || proximo === CR || proximo === ASPAS) break;
        j++;
      }
      this.campo += texto.slice(i, j);
      this.campoIniciado = true;
      i = j;
    }
    return linhas;
  }

  end() {
    const linhas = [];
    if (this.pendente) linhas.push(...this.push('\n'));
    if (this.campoIniciado || this.campo || this.linha.length) {
      this.#fecharCampo();
      linhas.push(this.linha);
      this.linha = [];
    }
    return linhas;
  }

  #fecharCampo() {
    this.linha.push(this.campo);
    this.campo = '';
    this.campoIniciado = false;
    this.acabouDeFecharAspas = false;
  }
}

class Decodificador {
  constructor() {
    this.decoder = null;
  }

  decode(chunk) {
    if (typeof chunk === 'string') return chunk;
    if (!this.decoder) {
      const estrito = new TextDecoder('utf-8', { fatal: true });
      try {
        const texto = estrito.decode(chunk, { stream: true });
        this.decoder = estrito;
        return texto;
      } catch {
        this.decoder = new TextDecoder('windows-1252');
        return this.decoder.decode(chunk, { stream: true });
      }
    }
    try {
      return this.decoder.decode(chunk, { stream: true });
    } catch {
      // UTF-8 com bytes invalidos no meio do arquivo: segue com substituicao.
      this.decoder = new TextDecoder('utf-8');
      return this.decoder.decode(chunk, { stream: true });
    }
  }

  flush() {
    return this.decoder && typeof this.decoder.decode === 'function' ? this.decoder.decode() : '';
  }
}

function linhaVazia(linha) {
  return linha.length === 1 && linha[0] === '';
}

// Gera arrays de campos a partir de um stream de Buffers ou strings.
export async function* linhasCsv(stream, { delimitador = null } = {}) {
  const parser = new ParserCsv(delimitador);
  const decodificador = new Decodificador();
  for await (const chunk of stream) {
    for (const linha of parser.push(decodificador.decode(chunk))) {
      if (!linhaVazia(linha)) yield linha;
    }
  }
  const resto = decodificador.flush();
  const finais = resto ? [...parser.push(resto), ...parser.end()] : parser.end();
  for (const linha of finais) {
    if (!linhaVazia(linha)) yield linha;
  }
}

// Gera objetos { COLUNA_NORMALIZADA: valor } usando a primeira linha como cabecalho.
export async function* registrosCsv(stream, opcoes = {}) {
  let cabecalho = null;
  for await (const linha of linhasCsv(stream, opcoes)) {
    if (!cabecalho) {
      cabecalho = linha.map((nome, indice) => normalizarColuna(nome) || `COLUNA_${indice + 1}`);
      continue;
    }
    const registro = {};
    for (let i = 0; i < cabecalho.length; i++) registro[cabecalho[i]] = (linha[i] ?? '').trim();
    yield registro;
  }
}

export function escaparCampoCsv(valor, delimitador = ';') {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (texto.includes(delimitador) || texto.includes('"') || texto.includes('\n') || texto.includes('\r')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export function gerarCsv(linhas, colunas, delimitador = ';') {
  const cabecalho = colunas.map((coluna) => escaparCampoCsv(coluna.titulo, delimitador)).join(delimitador);
  const corpo = linhas.map((linha) => colunas
    .map((coluna) => escaparCampoCsv(typeof coluna.valor === 'function' ? coluna.valor(linha) : linha[coluna.chave], delimitador))
    .join(delimitador));
  // BOM para o Excel reconhecer UTF-8.
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}
