// Acesso HTTP com repeticao e mensagens de erro acionaveis.

import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ESPERAS_MS = [2000, 4000, 8000, 16000];
const AGENTE = 'captacao-recursos/1.0 (levantamento de transparencia publica)';

export const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function avisoDeProxy() {
  const temProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (temProxy && process.env.NODE_USE_ENV_PROXY !== '1') {
    return 'HTTPS_PROXY definido, mas o fetch do Node so o usa com NODE_USE_ENV_PROXY=1 (Node >= 22.21). Rode: NODE_USE_ENV_PROXY=1 node tools/captacao-recursos/captacao.mjs ...';
  }
  return null;
}

function explicarFalha(url, erro) {
  const host = (() => {
    try { return new URL(url).host; } catch { return url; }
  })();
  const causa = erro?.cause?.code || erro?.cause?.message || erro?.code || erro?.message || String(erro);
  return new Error(`falha ao acessar ${host} (${causa}). Verifique a conexao, o proxy ou se o dominio esta liberado na rede.`);
}

async function comRepeticao(url, executar, tentativas = ESPERAS_MS.length + 1) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    try {
      return await executar();
    } catch (erro) {
      ultimoErro = erro;
      const naoRepetir = erro?.naoRepetir || (erro?.status >= 400 && erro.status < 500 && erro.status !== 429);
      if (naoRepetir || tentativa === tentativas - 1) break;
      await esperar(ESPERAS_MS[Math.min(tentativa, ESPERAS_MS.length - 1)]);
    }
  }
  if (ultimoErro?.status) throw ultimoErro;
  throw explicarFalha(url, ultimoErro);
}

async function requisitar(url, { headers = {}, timeoutMs = 60_000, accept }) {
  const resposta = await fetch(url, {
    headers: { accept, 'user-agent': AGENTE, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    const erro = new Error(`HTTP ${resposta.status} em ${url}${corpo ? `: ${corpo.slice(0, 200)}` : ''}`);
    erro.status = resposta.status;
    erro.corpo = corpo;
    // Servicos .asmx respondem 500 quando falta parametro: repetir nao adianta.
    erro.naoRepetir = /missing parameter|par[aâ]metro/i.test(corpo);
    throw erro;
  }
  return resposta;
}

export async function obterJson(url, { tentativas, ...opcoes } = {}) {
  return comRepeticao(url, async () => (await requisitar(url, { accept: 'application/json', ...opcoes })).json(), tentativas);
}

export async function obterTexto(url, { tentativas, ...opcoes } = {}) {
  return comRepeticao(url, async () => (await requisitar(url, { accept: '*/*', ...opcoes })).text(), tentativas);
}

// Baixa para `destino`, reaproveitando copia local com menos de `maxIdadeDias`.
export async function baixarArquivo(url, destino, { forcar = false, maxIdadeDias = 7, maxBytes = Infinity, log = () => {} } = {}) {
  if (!forcar) {
    const existente = await stat(destino).catch(() => null);
    if (existente && Date.now() - existente.mtimeMs < maxIdadeDias * 86_400_000) {
      log(`  usando copia local ${destino}`);
      return destino;
    }
  }
  await mkdir(dirname(destino), { recursive: true });
  const parcial = `${destino}.parcial`;
  await comRepeticao(url, async () => {
    const resposta = await fetch(url, { headers: { 'user-agent': AGENTE } });
    if (!resposta.ok || !resposta.body) {
      const erro = new Error(`HTTP ${resposta.status} ao baixar ${url}`);
      erro.status = resposta.status;
      throw erro;
    }
    const tamanho = Number(resposta.headers.get('content-length')) || 0;
    if (tamanho > maxBytes) {
      await resposta.body.cancel();
      const erro = new Error(`arquivo com ${(tamanho / 1e6).toFixed(0)} MB excede o limite de ${(maxBytes / 1e6).toFixed(0)} MB: ${url}`);
      erro.status = 413;
      throw erro;
    }
    log(`  baixando ${url}${tamanho ? ` (${(tamanho / 1e6).toFixed(1)} MB)` : ''}`);
    try {
      await pipeline(Readable.fromWeb(resposta.body), createWriteStream(parcial));
    } catch (erro) {
      await unlink(parcial).catch(() => {});
      throw erro;
    }
  });
  await rename(parcial, destino);
  return destino;
}
