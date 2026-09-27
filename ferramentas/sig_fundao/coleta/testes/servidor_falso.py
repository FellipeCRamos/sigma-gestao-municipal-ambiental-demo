# -*- coding: utf-8 -*-
"""
Servidor HTTP FALSO para testar coletar_bases_fundao.py sem internet.

Serve uma pasta (arvore gerada por gerar_dados_sinteticos.py) imitando o
comportamento das fontes reais:
  - Range/HEAD (GDAL /vsicurl/ e retomada de download)
  - listagem h5ai (FBDS) e "Index of" (geoftp) para pastas
  - API JSON de listagem do Google Cloud Storage (bucket do MapBiomas)
  - ArcGIS REST (MapServer?f=json, /query com envelope e paginacao)
  - WFS 1.0.0 GetFeature (GeoJSON)
  - regras de falha: 503 intermitente, lentidao, corte no meio, 403 sem
    navegador/cookie, 404 e pagina HTML com HTTP 200

Tudo configurado por regras.json na raiz servida.
"""

import email.utils
import json
import os
import re
import threading
import time
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Estado:
    def __init__(self, raiz):
        self.raiz = raiz
        with open(os.path.join(raiz, "regras.json"), encoding="utf-8") as fh:
            self.regras = json.load(fh)
        self.contagem = {}
        self.pedidos = []
        self.trava = threading.Lock()

    def contar(self, caminho):
        with self.trava:
            self.contagem[caminho] = self.contagem.get(caminho, 0) + 1
            return self.contagem[caminho]


def _bbox_de_feature(f):
    xs, ys = [], []

    def andar(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        elif isinstance(c, (list, tuple)):
            for x in c:
                andar(x)
    andar((f.get("geometry") or {}).get("coordinates", []))
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


def _cruza(a, b):
    return a and not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def criar_handler(estado):
    class Handler(SimpleHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def __init__(self, *a, **k):
            super().__init__(*a, directory=estado.raiz, **k)

        def log_message(self, *a):
            pass

        # ------------------------------------------------------------- util
        def _enviar(self, codigo, corpo, tipo="application/octet-stream", extra=None):
            if isinstance(corpo, str):
                corpo = corpo.encode("utf-8")
            self.send_response(codigo)
            self.send_header("Content-Type", tipo)
            self.send_header("Content-Length", str(len(corpo)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(corpo)

        def _regra(self, nome, caminho):
            for padrao, valor in estado.regras.get(nome, {}).items():
                if re.search(padrao, caminho):
                    return valor
            return None

        # ------------------------------------------------------------- roteamento
        def do_HEAD(self):
            self.do_GET()

        def do_GET(self):
            url = urllib.parse.urlsplit(self.path)
            caminho = urllib.parse.unquote(url.path)
            q = dict(urllib.parse.parse_qsl(url.query))
            n = estado.contar(caminho)
            estado.pedidos.append((self.command, caminho, self.headers.get("Range")))

            lento = self._regra("lento", caminho)
            if lento:
                time.sleep(float(lento))
            falhas = self._regra("falhar_n_vezes", caminho)
            if falhas and n <= int(falhas) and self.command == "GET":
                return self._enviar(503, "servico indisponivel (falso)", "text/plain")
            codigo_fixo = self._regra("codigo_fixo", caminho)
            if codigo_fixo:
                return self._enviar(int(codigo_fixo), "erro fixo (falso)", "text/plain")
            html_falso = self._regra("html_200", caminho)
            if html_falso:
                return self._enviar(200, html_falso, "text/html")
            exige = self._regra("exigir_navegador_e_cookie", caminho)
            if exige:
                ua = self.headers.get("User-Agent", "")
                if "Mozilla" not in ua or "sessao=ok" not in (self.headers.get("Cookie") or ""):
                    return self._enviar(403, "Forbidden (falso: sem navegador/cookie)", "text/plain")
            cookie = self._regra("dar_cookie", caminho)

            if caminho.startswith("/gcs/storage/v1/b/"):
                return self._gcs(caminho, q)
            if caminho.endswith("/query") or q.get("f") in ("json", "pjson"):
                return self._arcgis(caminho, q)
            if q.get("request", q.get("REQUEST", "")).lower() == "getfeature":
                return self._wfs(caminho, q)

            local = os.path.join(estado.raiz, caminho.lstrip("/"))
            if os.path.isdir(local):
                if not caminho.endswith("/"):
                    return self._enviar(301, "", "text/plain", {"Location": caminho + "/"})
                if os.path.isfile(os.path.join(local, "index.html")):
                    with open(os.path.join(local, "index.html"), encoding="utf-8") as fh:
                        return self._enviar(200, fh.read(), "text/html; charset=utf-8")
                return self._listar(caminho, local, cookie)
            if not os.path.isfile(local):
                return self._enviar(404, "nao encontrado (falso)", "text/plain")
            return self._arquivo(caminho, local, cookie)

        # ------------------------------------------------------------- arquivos com Range
        def _arquivo(self, caminho, local, cookie=None):
            tamanho = os.path.getsize(local)
            inicio, fim = 0, tamanho - 1
            faixa = self.headers.get("Range")
            parcial = False
            if faixa and not self._regra("ignorar_range", caminho):
                m = re.match(r"bytes=(\d*)-(\d*)", faixa)
                if m:
                    if m.group(1):
                        inicio = int(m.group(1))
                        fim = int(m.group(2)) if m.group(2) else tamanho - 1
                    else:
                        inicio = tamanho - int(m.group(2))
                    fim = min(fim, tamanho - 1)
                    parcial = True
            if inicio >= tamanho:
                return self._enviar(416, "", "text/plain", {"Content-Range": "bytes */%d" % tamanho})
            self.send_response(206 if parcial else 200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(fim - inicio + 1))
            self.send_header("Last-Modified", email.utils.formatdate(os.path.getmtime(local), usegmt=True))
            if parcial:
                self.send_header("Content-Range", "bytes %d-%d/%d" % (inicio, fim, tamanho))
            if cookie:
                self.send_header("Set-Cookie", cookie)
            self.end_headers()
            if self.command == "HEAD":
                return
            cortar = self._regra("cortar_na_primeira", caminho)
            with open(local, "rb") as fh:
                fh.seek(inicio)
                restante = fim - inicio + 1
                if cortar and estado.contagem.get(caminho + "#cortado") is None and not parcial:
                    estado.contagem[caminho + "#cortado"] = 1
                    self.wfile.write(fh.read(int(cortar)))
                    self.wfile.flush()
                    self.close_connection = True
                    return
                while restante > 0:
                    bloco = fh.read(min(restante, 65536))
                    if not bloco:
                        break
                    self.wfile.write(bloco)
                    restante -= len(bloco)

        # ------------------------------------------------------------- listagens
        def _listar(self, caminho, local, cookie=None):
            nomes = sorted(os.listdir(local))
            if caminho.startswith("/fbds/"):
                prefixo_publico = caminho[len("/fbds"):]  # o h5ai real usa caminhos absolutos do site
                linhas = ['<tr><td class="fb-i"><img src="/_h5ai/folder-parent.png" alt="folder-parent"/></td>'
                          '<td class="fb-n"><a href="..">Parent Directory</a></td></tr>']
                for nome in nomes:
                    e_pasta = os.path.isdir(os.path.join(local, nome))
                    href = prefixo_publico + urllib.parse.quote(nome) + ("/" if e_pasta else "")
                    linhas.append('<tr><td class="fb-i"><img src="/_h5ai/x.png" alt="%s"/></td><td class="fb-n">'
                                  '<a href="%s">%s</a></td><td class="fb-d">2026-09-01 10:00</td><td class="fb-s">1 KB</td></tr>'
                                  % ("folder" if e_pasta else "file", href, nome))
                corpo = ('<!DOCTYPE html><html><head><title>FBDS - Repositório de mapas</title></head><body class="index">'
                         '<div id="fallback"><table>%s</table></div></body></html>' % "".join(linhas))
            else:
                itens = ['<a href="../">Parent Directory</a>']
                for nome in nomes:
                    barra = "/" if os.path.isdir(os.path.join(local, nome)) else ""
                    itens.append('<img src="/icons/x.gif" alt="%s"> <a href="%s%s">%s%s</a>'
                                 % ("[DIR]" if barra else "[   ]", urllib.parse.quote(nome), barra, nome, barra))
                corpo = "<html><head><title>Index of %s</title></head><body><h1>Index of %s</h1><pre>%s</pre></body></html>" % (
                    caminho, caminho, "\n".join(itens))
            extra = {"Set-Cookie": cookie} if cookie else None
            return self._enviar(200, corpo, "text/html; charset=utf-8", extra)

        def _gcs(self, caminho, q):
            m = re.match(r"/gcs/storage/v1/b/([^/]+)/o", caminho)
            bucket = m.group(1)
            base = os.path.join(estado.raiz, "gcs", bucket)
            prefixo = q.get("prefix", "")
            delim = q.get("delimiter")
            itens, prefixos = [], set()
            for raiz, _, arquivos in os.walk(base):
                for a in arquivos:
                    nome = os.path.relpath(os.path.join(raiz, a), base).replace(os.sep, "/")
                    if not nome.startswith(prefixo):
                        continue
                    resto = nome[len(prefixo):]
                    if delim and delim in resto:
                        prefixos.add(prefixo + resto.split(delim)[0] + delim)
                    else:
                        itens.append({"name": nome, "size": str(os.path.getsize(os.path.join(raiz, a)))})
            itens.sort(key=lambda i: i["name"])
            # paginacao falsa: 5 itens por pagina (testa nextPageToken)
            inicio = int(q.get("pageToken", "0"))
            pagina = itens[inicio:inicio + 5]
            dados = {"kind": "storage#objects", "prefixes": sorted(prefixos) if inicio == 0 else [], "items": pagina}
            if inicio + 5 < len(itens):
                dados["nextPageToken"] = str(inicio + 5)
            return self._enviar(200, json.dumps(dados), "application/json")

        # ------------------------------------------------------------- ArcGIS REST
        def _arcgis(self, caminho, q):
            servicos = estado.regras.get("servicos_arcgis", {})
            if q.get("f") == "json" and not caminho.endswith("/query"):
                for padrao, meta in servicos.items():
                    if re.fullmatch(padrao, caminho):
                        return self._enviar(200, json.dumps(meta["meta"]), "application/json")
                return self._enviar(200, json.dumps({"error": {"code": 404, "message": "nao existe"}}), "application/json")
            m = re.match(r"(.*)/(\d+)/query$", caminho)
            if not m:
                return self._enviar(404, "?", "text/plain")
            servico, camada = m.group(1), m.group(2)
            cfg = None
            for padrao, meta in servicos.items():
                if re.fullmatch(padrao, servico):
                    cfg = meta
            arquivo = cfg and cfg.get("dados", {}).get(camada)
            if not arquivo:
                return self._enviar(200, json.dumps({"error": {"code": 400, "message": "camada invalida"}}), "application/json")
            if q.get("f") == "geojson" and cfg.get("sem_geojson"):
                return self._enviar(200, json.dumps({"error": {"code": 400, "message": "Invalid format"}}), "application/json")
            with open(os.path.join(estado.raiz, arquivo), encoding="utf-8") as fh:
                todos = json.load(fh)
            env = [float(x) for x in q["geometry"].split(",")]
            feats = [f for f in todos["features"] if _cruza(_bbox_de_feature(f), env)]
            ini = int(q.get("resultOffset", 0))
            limite = min(int(q.get("resultRecordCount", 1000)), int(cfg.get("max_registros", 1000)))
            pagina = feats[ini:ini + limite]
            dados = {"type": "FeatureCollection", "features": pagina}
            if ini + limite < len(feats):
                dados["exceededTransferLimit"] = True
            return self._enviar(200, json.dumps(dados), "application/json")

        # ------------------------------------------------------------- WFS
        def _wfs(self, caminho, q):
            camadas = estado.regras.get("wfs", {}).get(caminho, {})
            nome = q.get("typeName") or q.get("typename") or q.get("TYPENAME")
            if nome not in camadas:
                return self._enviar(200, '<?xml version="1.0"?><ServiceExceptionReport><ServiceException>'
                                    'Feature type %s unknown</ServiceException></ServiceExceptionReport>' % nome, "text/xml")
            with open(os.path.join(estado.raiz, camadas[nome]), encoding="utf-8") as fh:
                todos = json.load(fh)
            env = [float(x) for x in q["bbox"].split(",")[:4]]
            todos["features"] = [f for f in todos["features"] if _cruza(_bbox_de_feature(f), env)]
            return self._enviar(200, json.dumps(todos), "application/json")

    return Handler


class _Silencioso(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass  # cliente que desiste no meio (timeout de teste) nao e erro do servidor


class ServidorFalso:
    def __init__(self, raiz, porta=0):
        self.estado = Estado(raiz)
        self.httpd = _Silencioso(("127.0.0.1", porta), criar_handler(self.estado))
        self.porta = self.httpd.server_address[1]
        self.url = "http://127.0.0.1:%d" % self.porta
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *a):
        self.httpd.shutdown()
        self.httpd.server_close()
