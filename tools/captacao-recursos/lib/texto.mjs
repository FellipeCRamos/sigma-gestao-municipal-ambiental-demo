// Utilitarios de texto, numero e data para dados publicos brasileiros.

export function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Nome de coluna comparavel: "Dt. Prog. Ini" -> "DT_PROG_INI".
export function normalizarColuna(valor) {
  return normalizar(valor).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D+/g, '');
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Casa termos como prefixo de palavra: "RESIDUO" encontra "RESIDUOS SOLIDOS".
export function criarCasador(termos = []) {
  const lista = [...new Set(termos.map(normalizar).filter(Boolean))];
  if (!lista.length) return () => [];
  const regex = new RegExp(`(?<![A-Z0-9])(${lista.map(escaparRegex).join('|')})`, 'g');
  return (texto) => {
    const alvo = normalizar(texto);
    const achados = new Set();
    for (const match of alvo.matchAll(regex)) achados.add(match[1]);
    return [...achados];
  };
}

// Casa o nome como palavra inteira em texto livre. Evita nomes mais longos:
// "SAO JOSE" nao casa "SAO JOSEENSE" nem "SAO JOSE DO RIO PRETO".
export function criarCasadorExato(termo) {
  const alvo = normalizar(termo);
  const regex = new RegExp(`(?<![A-Z0-9])${escaparRegex(alvo)}(?![A-Z0-9])(?! (?:DO|DA|DOS|DAS|DE) [A-Z])`);
  return (texto) => regex.test(normalizar(texto));
}

// Nome do ente sem prefixo institucional nem sufixo de UF:
// "PREFEITURA MUNICIPAL DE VILA SERENA - ES" -> "VILA SERENA".
export function nomeDoEnte(valor) {
  return normalizar(valor)
    .replace(/^(?:PREFEITURA MUNICIPAL|PREFEITURA|MUNICIPIO|PREF\.? MUN\.?)(?: DE| DO| DA| DOS| DAS)? /, '')
    .replace(/\s*(?:-|\/|\()\s*[A-Z]{2}\)?$/, '')
    .trim();
}

// Aceita "1.234,56", "1234,56", "1234.56", "1,234.56" e numeros.
export function paraNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  let texto = String(valor ?? '').trim().replace(/[R$\s]/g, '');
  if (!texto) return 0;
  const negativo = /^-|^\(.*\)$/.test(texto);
  texto = texto.replace(/[-()]/g, '');
  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');
  if (ultimaVirgula > -1 && ultimoPonto > -1) {
    texto = ultimaVirgula > ultimoPonto
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '');
  } else if (ultimaVirgula > -1) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if ((texto.match(/\./g) || []).length > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(texto)) {
    // "1.000.000" e "2.000" sao separadores de milhar; "1234.56" e decimal.
    texto = texto.replace(/\./g, '');
  }
  const numero = Number(texto);
  if (!Number.isFinite(numero)) return 0;
  return negativo ? -numero : numero;
}

// Aceita "dd/mm/aaaa", "aaaa-mm-dd" e "aaaa-mm-ddThh:mm". Devolve "aaaa-mm-dd" ou null.
export function paraDataIso(valor) {
  const texto = String(valor ?? '').trim();
  let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function anoDe(...valores) {
  for (const valor of valores) {
    const iso = paraDataIso(valor);
    if (iso) return Number(iso.slice(0, 4));
    const m = String(valor ?? '').match(/^\s*(\d{4})\s*$/);
    if (m) return Number(m[1]);
  }
  return null;
}

export function mediana(valores) {
  const lista = valores.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!lista.length) return 0;
  const meio = Math.floor(lista.length / 2);
  return lista.length % 2 ? lista[meio] : (lista[meio - 1] + lista[meio]) / 2;
}

export function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function formatarPercentual(valor) {
  if (!Number.isFinite(valor)) return '-';
  return `${(valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

// Le o primeiro campo presente dentre os candidatos (nomes de coluna normalizados).
export function campo(registro, candidatos) {
  for (const nome of candidatos) {
    if (registro[nome] !== undefined && registro[nome] !== '') return registro[nome];
  }
  return '';
}
