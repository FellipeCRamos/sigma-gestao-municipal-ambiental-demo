#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
coletar_bases_fundao.py - coleta e recorte de bases publicas para o SIG de Fundao/ES

Roda no PC com o Python/GDAL do QGIS: de duplo clique em COLETAR_BASES.bat.
Nao precisa de nada alem do QGIS.

Itens (independentes - a falha de um nao para os outros; cada item tem uma
lista de estrategias tentadas em ordem: fonte oficial, servico consultado so
na area de Fundao, espelho estadual):
  1 MapBiomas (colecao mais recente): cobertura e uso de TODOS os anos, lida
    em janela dos GeoTIFFs nacionais via /vsicurl/ + legenda (codigo;classe;cor)
  2 FBDS Fundao: APP, USO, HIDROGRAFIA
  3 SGB: geologia 1:100 mil (folhas Aracruz e Vitoria) e mapa estadual 1:400 mil
  4 IBGE: BDiA 1:250 mil (geologia, geomorfologia, pedologia, vegetacao), malha
    municipal atual, localidades, area de aplicacao da Lei 11.428
  5 INCRA acervo fundiario ES: SIGEF, SNCI, assentamentos, quilombolas
  6 ANM SIGMINE ES     7 ANA BHO (trechos e areas de contribuicao)
  8 Arquivos grandes ja no PC: so recorta (/vsizip/ + filtro espacial)

Saida (contrato):
  <base>\\50. SIG_FUNDAO\\01_brutos_pc\\
      <fonte>\\<original baixado, intacto>
      recortes\\<id_item>.gpkg | .tif   (limite de Fundao + 2 km, EPSG:31984;
                                        raster GeoTIFF LZW)
      _log_coleta.csv   id_item;url;http;bytes;sha256;inicio;fim;status;mensagem

Regras: nunca apaga nada; timeout + 3 tentativas; retomavel pelo log (o que ja
foi concluido vira PULADO); sem login, captcha ou API paga (SICAR fica fora).
As URLs foram confirmadas por pesquisa em PESQUISA_EM; cada linha do log traz a
data/hora de acesso e a evidencia da URL usada.

Opcoes:
  --listar                 lista o catalogo e sai
  --itens 1,6,anm_sigmine_es   roda so esses grupos/ids
  --refazer id1,id2        refaz itens ja concluidos (o recorte anterior e guardado)
  --base / --g3m / --saida / --limite   trocam os caminhos padrao
  --ssl-flexivel           aceita certificado invalido (so se confiar na fonte)
  --redirecionar REAL=NOVO troca prefixos de URL (testes com servidor falso)
"""

import argparse
import csv
import hashlib
import http.client
import http.cookiejar
import io
import json
import os
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime
from html.parser import HTMLParser

try:
    from osgeo import gdal, ogr, osr
except ImportError:
    sys.stderr.write("\nERRO: GDAL (modulo osgeo) nao encontrado. Rode pelo COLETAR_BASES.bat, que usa o "
                     "Python do QGIS.\n\n")
    raise

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()
try:
    sys.stdout.reconfigure(errors="replace")
except Exception:
    pass

# =============================================================================
# Contrato de caminhos (nao mudar sem combinar com quem monta o SIG_FUNDAO_SEMAM.gpkg)
# =============================================================================
BASE_PADRAO = r"C:\Users\User\Documents\BACKUP_REDE_PMF_SEMAM_17_08_2026"
G3M_PADRAO = r"C:\Users\User\Documents\G3M_AMBIENTAL\BASE_DE_DADOS"
SUBPASTA_SAIDA = ("50. SIG_FUNDAO", "01_brutos_pc")
NOME_LIMITE_KML = "09_Limite_Municipal_IDAF.kml"
NOME_LOG = "_log_coleta.csv"
CAMPOS_LOG = ["id_item", "url", "http", "bytes", "sha256", "inicio", "fim", "status", "mensagem"]

EPSG_SAIDA = 31984
BUFFER_M = 2000
CODIGO_IBGE = "3202207"
UF = "ES"
PESQUISA_EM = "2026-09-27"

TIMEOUT_S = float(os.environ.get("COLETA_TIMEOUT_S", "90"))
TENTATIVAS = 3
ESPERAS_S = tuple(float(x) for x in os.environ.get("COLETA_ESPERAS_S", "10,30").split(","))
# alguns servidores (ANM) devolvem 403 para clientes que nao parecem navegador
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
              "Chrome/128.0 Safari/537.36")

MARCA_OK = "[concluido]"
MARCA_FALHA = "[falhou]"
EXT_BINARIAS = (".zip", ".shp", ".shx", ".dbf", ".gpkg", ".tif", ".tiff", ".kmz", ".pdf", ".xls", ".xlsx")


def agora():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def normalizar(texto):
    texto = unicodedata.normalize("NFKD", str(texto).lower())
    return "".join(c for c in texto if not unicodedata.combining(c))


def msg_erro(e):
    texto = str(e).strip()
    return (texto.splitlines()[0] if texto else e.__class__.__name__)[:500]


def nome_seguro(nome):
    nome = urllib.parse.unquote(nome)
    nome = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", nome).strip(" .")
    return nome or "arquivo"


def sha256_de(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as fh:
        for bloco in iter(lambda: fh.read(4 * 1024 * 1024), b""):
            h.update(bloco)
    return h.hexdigest()


def caminho_livre(caminho):
    """Nunca sobrescreve: 'nome (2).ext', 'nome (3).ext'..."""
    if not os.path.exists(caminho):
        return caminho
    base, ext = os.path.splitext(caminho)
    n = 2
    while os.path.exists("%s (%d)%s" % (base, n, ext)):
        n += 1
    return "%s (%d)%s" % (base, n, ext)


# =============================================================================
# Log (so acrescenta; e dele que sai a retomada)
# =============================================================================

class Log:
    def __init__(self, caminho):
        self.caminho = caminho
        self.linhas = []
        novo = not os.path.exists(caminho)
        if not novo:
            with open(caminho, encoding="utf-8-sig", newline="") as fh:
                self.linhas = list(csv.DictReader(fh, delimiter=";"))
        self._fh = open(caminho, "a", encoding="utf-8-sig" if novo else "utf-8", newline="")
        self._w = csv.DictWriter(self._fh, fieldnames=CAMPOS_LOG, delimiter=";", extrasaction="ignore")
        if novo:
            self._w.writeheader()
            self._fh.flush()

    def registrar(self, id_item, url="", http="", bytes_="", sha256="", inicio="", fim="", status="", mensagem=""):
        linha = {"id_item": id_item, "url": url, "http": http, "bytes": bytes_, "sha256": sha256,
                 "inicio": inicio or agora(), "fim": fim or agora(), "status": status,
                 "mensagem": str(mensagem).replace("\n", " ").replace("\r", " ")}
        self._w.writerow(linha)
        self._fh.flush()
        try:
            os.fsync(self._fh.fileno())
        except OSError:
            pass
        self.linhas.append(linha)

    def concluido(self, id_item):
        for linha in reversed(self.linhas):
            if linha.get("id_item") != id_item:
                continue
            msg = linha.get("mensagem", "")
            if linha.get("status") == "OK" and MARCA_OK in msg:
                return linha
            if MARCA_FALHA in msg:
                return None
        return None

    def download_anterior(self, url):
        for linha in reversed(self.linhas):
            if linha.get("url") == url and linha.get("status") == "OK" and linha.get("sha256") \
                    and linha.get("mensagem", "").startswith("download"):
                return linha
        return None

    def fechar(self):
        self._fh.close()


# =============================================================================
# Rede
# =============================================================================

class ErroHTTP(Exception):
    def __init__(self, mensagem, codigo="", definitivo=False):
        super().__init__(mensagem)
        self.codigo = codigo
        self.definitivo = definitivo


class Rede:
    def __init__(self, redirecionar=None, ssl_flexivel=False, dizer=print):
        self.redirecionar = redirecionar or []
        self.ssl_flexivel = ssl_flexivel
        self.dizer = dizer
        contexto = ssl.create_default_context()
        if ssl_flexivel:
            contexto.check_hostname = False
            contexto.verify_mode = ssl.CERT_NONE
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler(),     # proxy do Windows/ambiente, se houver
            urllib.request.HTTPSHandler(context=contexto),
            urllib.request.HTTPCookieProcessor(self.cookies))

    def real(self, url):
        for de, para in self.redirecionar:
            if url.startswith(de):
                return para + url[len(de):]
        return url

    def _pedido(self, url, metodo="GET", faixa=None, cabecalhos=None):
        req = urllib.request.Request(self.real(url), method=metodo)
        req.add_header("User-Agent", USER_AGENT)
        req.add_header("Accept", "*/*")
        for k, v in (cabecalhos or {}).items():
            req.add_header(k, v)
        if faixa:
            req.add_header("Range", "bytes=%s" % faixa)
        return req

    @staticmethod
    def _explicar(e):
        texto = msg_erro(e)
        if "CERTIFICATE_VERIFY_FAILED" in texto:
            return "certificado SSL do site nao foi aceito (%s)" % texto
        if isinstance(e, (socket.timeout, TimeoutError)) or "timed out" in texto:
            return "tempo esgotado (%.0f s)" % TIMEOUT_S
        return texto

    def _abrir(self, req):
        try:
            return self.opener.open(req, timeout=TIMEOUT_S)
        except urllib.error.HTTPError as e:
            raise ErroHTTP("HTTP %d %s" % (e.code, e.reason), e.code, e.code in (400, 401, 403, 404, 410))

    def com_tentativas(self, funcao, descricao):
        ultimo = None
        for tentativa in range(1, TENTATIVAS + 1):
            try:
                return funcao()
            except ErroHTTP as e:
                if e.definitivo:
                    raise
                ultimo = e
            except (urllib.error.URLError, socket.timeout, ConnectionError, TimeoutError, OSError,
                    http.client.HTTPException) as e:
                ultimo = ErroHTTP(self._explicar(e), getattr(e, "code", ""))
                if "certificado SSL" in str(ultimo):
                    raise ultimo   # repetir nao resolve
            if tentativa < TENTATIVAS:
                espera = ESPERAS_S[min(tentativa - 1, len(ESPERAS_S) - 1)]
                self.dizer("      tentativa %d falhou (%s); nova tentativa em %.0f s..." % (tentativa, ultimo, espera))
                time.sleep(espera)
        raise ErroHTTP("%s: %d tentativas sem sucesso - %s" % (descricao, TENTATIVAS, ultimo),
                       getattr(ultimo, "codigo", ""))

    def existe(self, url):
        def tentar():
            for metodo, faixa in (("HEAD", None), ("GET", "0-0")):
                try:
                    with self._abrir(self._pedido(url, metodo, faixa)) as r:
                        tamanho = r.headers.get("Content-Length")
                        if r.status == 206:
                            m = re.search(r"/(\d+)$", r.headers.get("Content-Range", ""))
                            tamanho = m.group(1) if m else None
                        return True, r.status, int(tamanho) if tamanho and tamanho.isdigit() else None
                except ErroHTTP as e:
                    if metodo == "HEAD" and e.codigo in (403, 405, 501):
                        continue
                    raise
            return False, "", None
        try:
            return self.com_tentativas(tentar, "verificar %s" % url)
        except ErroHTTP as e:
            return False, e.codigo, None

    def texto(self, url, cabecalhos=None):
        def tentar():
            with self._abrir(self._pedido(url, cabecalhos=cabecalhos)) as r:
                bruto = r.read()
                return r.status, bruto.decode(r.headers.get_content_charset() or "utf-8", "replace")
        return self.com_tentativas(tentar, "ler %s" % url)

    def json(self, url):
        codigo, txt = self.texto(url, {"Accept": "application/json"})
        try:
            return codigo, json.loads(txt)
        except ValueError:
            raise ErroHTTP("resposta nao e JSON (inicio: %r)" % txt[:120], codigo, True)

    def baixar(self, url, destino, cabecalhos=None):
        """Baixa para destino.parcial (retomando com Range), confere o conteudo
        e renomeia. Devolve (http, bytes, sha256)."""
        parcial = destino + ".parcial"
        estado = {"http": ""}

        def tentar():
            ja = os.path.getsize(parcial) if os.path.exists(parcial) else 0
            with self._abrir(self._pedido(url, faixa="%d-" % ja if ja else None, cabecalhos=cabecalhos)) as r:
                estado["http"] = r.status
                if ja and r.status == 200:
                    # servidor ignorou o Range: guarda o parcial antigo (nunca apaga) e recomeca
                    os.rename(parcial, caminho_livre(parcial + ".antigo"))
                    ja = 0
                total = r.headers.get("Content-Length")
                total = int(total) + ja if total and total.isdigit() else None
                recebido, aviso = ja, time.time()
                with open(parcial, "ab" if ja else "wb") as fh:
                    while True:
                        bloco = r.read(1024 * 1024)
                        if not bloco:
                            break
                        fh.write(bloco)
                        recebido += len(bloco)
                        if time.time() - aviso > 15:
                            aviso = time.time()
                            self.dizer("      %.1f MB%s" % (recebido / 1e6, (" de %.1f MB" % (total / 1e6)) if total else ""))
                if total is not None and recebido < total:
                    raise ErroHTTP("download interrompido: %d de %d bytes (sera retomado)" % (recebido, total), r.status)
            return estado["http"]

        try:
            codigo = self.com_tentativas(tentar, "baixar %s" % url)
        except ErroHTTP as e:
            if "certificado SSL" in str(e) and os.name == "nt" and not self.ssl_flexivel:
                codigo = self._baixar_powershell(url, parcial, e)
            else:
                if "certificado SSL" in str(e):
                    raise ErroHTTP("%s. Se confiar na fonte, rode com --ssl-flexivel" % e, e.codigo, True)
                raise
        self._conferir_conteudo(parcial, destino)
        os.replace(parcial, destino)
        return codigo, os.path.getsize(destino), sha256_de(destino)

    def _baixar_powershell(self, url, parcial, erro_original):
        """Sites do governo com cadeia de certificado incompleta (ex.: INCRA):
        o Windows completa a cadeia sozinho, o Python nao. Tenta pelo
        PowerShell, que continua VERIFICANDO o certificado."""
        self.dizer("      certificado recusado pelo Python; tentando pelo Windows (PowerShell), com verificacao...")
        aspas = lambda s: "'" + s.replace("'", "''") + "'"  # noqa: E731
        comando = ("[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;"
                   "$ProgressPreference='SilentlyContinue';"
                   "Invoke-WebRequest -UseBasicParsing -Uri %s -OutFile %s -UserAgent %s"
                   % (aspas(self.real(url)), aspas(parcial), aspas(USER_AGENT)))
        try:
            r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", comando],
                               capture_output=True, text=True, timeout=max(TIMEOUT_S * 40, 1800))
        except Exception as e:
            raise ErroHTTP("%s; PowerShell tambem falhou: %s" % (erro_original, msg_erro(e)))
        if r.returncode != 0 or not os.path.exists(parcial):
            raise ErroHTTP("%s; PowerShell tambem falhou: %s. Se confiar na fonte, rode com --ssl-flexivel"
                           % (erro_original, (r.stderr or r.stdout).strip()[:300]), definitivo=True)
        return 200

    @staticmethod
    def _conferir_conteudo(parcial, destino):
        """Alguns servidores devolvem pagina HTML (erro, verificacao anti-robo)
        com HTTP 200 no lugar do arquivo."""
        ext = os.path.splitext(destino)[1].lower()
        with open(parcial, "rb") as fh:
            inicio = fh.read(2048)
        pagina_html = inicio.lstrip()[:1] == b"<" and ext in EXT_BINARIAS
        zip_ruim = ext in (".zip", ".kmz") and not pagina_html and not zipfile.is_zipfile(parcial)
        if pagina_html or zip_ruim:
            guardado = caminho_livre(destino + ".recebido_invalido.html")
            os.rename(parcial, guardado)
            texto = inicio.decode("utf-8", "replace")
            if re.search(r"humancheck|verifying your browser|verify you.?re human|captcha", texto, re.I):
                motivo = ("o site pediu verificacao anti-robo (captcha) - baixe manualmente pelo navegador e "
                          "coloque o arquivo em %s" % os.path.dirname(destino))
            elif zip_ruim:
                motivo = "o arquivo recebido nao e um zip valido"
            else:
                motivo = "o servidor devolveu uma pagina HTML no lugar do arquivo"
            raise ErroHTTP("%s (conteudo guardado em %s)" % (motivo, os.path.basename(guardado)), 200, True)


class _Links(HTMLParser):
    """Links de indices Apache e h5ai (com o tipo 'folder'/'file' do icone)."""

    def __init__(self):
        super().__init__()
        self.links = []
        self._alt = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "img":
            self._alt = (a.get("alt") or "").lower()
        elif tag == "a" and a.get("href"):
            self.links.append((a["href"], self._alt))
            self._alt = ""


def links_da_pagina(html_txt, url_base):
    p = _Links()
    p.feed(html_txt)
    saida = []
    for href, alt in p.links:
        if href.startswith(("?", "#", "mailto:", "javascript:")):
            continue
        saida.append((urllib.parse.urljoin(url_base, href), href, alt))
    return saida


def listar_diretorio(rede, url, profundidade=4, limite=3000):
    """Varre indice de diretorio (Apache ou h5ai). Devolve [(url, [partes do caminho relativo])]."""
    if not url.endswith("/"):
        url += "/"
    arquivos, visitados = [], set()

    def varrer(u, rel, nivel):
        if u in visitados or nivel > profundidade or len(arquivos) >= limite:
            return
        visitados.add(u)
        _, pagina = rede.texto(u)
        if re.search(r"humancheck|verifying your browser|verify you.?re human", pagina, re.I):
            raise ErroHTTP("o site pediu verificacao anti-robo (captcha) na listagem %s - baixe manualmente" % u,
                           200, True)
        for alvo, href, alt in links_da_pagina(pagina, u):
            alvo = alvo.split("#")[0].split("?")[0]
            if not alvo.startswith(u) or alvo == u or "parent" in alt:
                continue
            nome = urllib.parse.unquote(alvo[len(u):].rstrip("/"))
            if not nome or "/" in nome:
                continue
            e_pasta = alvo.endswith("/") or "folder" in alt or alt == "[dir]"
            if e_pasta:
                varrer(alvo if alvo.endswith("/") else alvo + "/", rel + [nome], nivel + 1)
            else:
                arquivos.append((alvo, rel + [nome]))
    varrer(url, [], 0)
    return arquivos


# =============================================================================
# Area de recorte: feicao de Fundao no KML do IDAF + 2 km, EPSG:31984
# =============================================================================

class _SoRemoto:
    """Em leitura remota (/vsicurl/) o GDAL nao deve listar a 'pasta' do
    servidor atras de arquivos irmaos. Em arquivo LOCAL isso seria errado: ele
    deixaria de ver .aux.xml, .tfw/.jgw (georreferencia de ortofoto) e .prj.
    Por isso a opcao vale so durante a leitura remota."""

    def __init__(self, caminho):
        self.remoto = "/vsicurl/" in str(caminho)

    def __enter__(self):
        if self.remoto:
            self.antes = gdal.GetConfigOption("GDAL_DISABLE_READDIR_ON_OPEN")
            gdal.SetConfigOption("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")

    def __exit__(self, *a):
        if self.remoto:
            gdal.SetConfigOption("GDAL_DISABLE_READDIR_ON_OPEN", self.antes)


def srs_epsg(codigo):
    s = osr.SpatialReference()
    s.ImportFromEPSG(codigo)
    s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return s


class AreaRecorte:
    def __init__(self, caminho_kml, pasta_saida):
        self.srs = srs_epsg(EPSG_SAIDA)
        self.geom = None
        self.erro = ""
        self.descricao = ""
        self._cache = {}
        try:
            self._carregar(caminho_kml)
            arquivo = os.path.join(pasta_saida, "_area_recorte_fundao_2km.gpkg")
            if not os.path.exists(arquivo):
                self._gravar(arquivo)
        except Exception as e:
            self.geom = None
            self.erro = msg_erro(e)

    def _carregar(self, caminho_kml):
        if not os.path.exists(caminho_kml):
            raise RuntimeError("limite municipal nao encontrado: %s" % caminho_kml)
        ds = ogr.Open(caminho_kml)
        candidatas, total = [], 0
        for i in range(ds.GetLayerCount()):
            lyr = ds.GetLayerByIndex(i)
            srs = lyr.GetSpatialRef() or srs_epsg(4326)
            for f in lyr:
                total += 1
                g = f.GetGeometryRef()
                if g is None:
                    continue
                textos = [str(f.GetField(j)) for j in range(f.GetFieldCount()) if f.IsFieldSetAndNotNull(j)]
                alvo = " ".join(normalizar(t) for t in textos)
                pontos = (2 if re.search(r"\bfundao\b", alvo) else 0) + (1 if CODIGO_IBGE in alvo else 0)
                if pontos:
                    candidatas.append((pontos, g.Clone(), srs.Clone(), " / ".join(textos)[:100]))
        if not candidatas:
            raise RuntimeError("nenhuma feicao de Fundao no KML (%d feicoes; procurei 'Fundao' ou %s nos atributos)"
                               % (total, CODIGO_IBGE))
        melhor = max(c[0] for c in candidatas)
        geoms = []
        for pontos, g, srs, texto in candidatas:
            if pontos != melhor:
                continue
            srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
            g.AssignSpatialReference(srs)
            g.TransformTo(self.srs)
            g.FlattenTo2D()
            geoms.append(g.MakeValid() if hasattr(g, "MakeValid") else g.Buffer(0))
        uniao = geoms[0]
        for g in geoms[1:]:
            uniao = uniao.Union(g)
        self.geom = uniao.Buffer(BUFFER_M, 16)
        self.geom.AssignSpatialReference(self.srs)
        self.descricao = "Fundao (%s) + %d m = %.1f km2" % (
            [c[3] for c in candidatas if c[0] == melhor][0], BUFFER_M, self.geom.GetArea() / 1e6)

    def _gravar(self, caminho):
        ds = ogr.GetDriverByName("GPKG").CreateDataSource(caminho)
        lyr = ds.CreateLayer("area_recorte", self.srs, ogr.wkbMultiPolygon)
        lyr.CreateField(ogr.FieldDefn("descricao", ogr.OFTString))
        f = ogr.Feature(lyr.GetLayerDefn())
        f.SetGeometry(ogr.ForceToMultiPolygon(self.geom.Clone()))
        f.SetField("descricao", "Fundao (limite IDAF) + %d m, EPSG:%d" % (BUFFER_M, EPSG_SAIDA))
        lyr.CreateFeature(f)
        ds = None

    def em(self, srs):
        chave = srs.ExportToWkt()
        if chave not in self._cache:
            s = srs.Clone()
            s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
            g = self.geom.Clone()
            if not s.IsSame(self.srs):
                g.TransformTo(s)
            self._cache[chave] = g
        return self._cache[chave]

    def bbox_geografico(self):
        """(lon_min, lat_min, lon_max, lat_max) em SIRGAS 2000 (EPSG:4674)."""
        minx, maxx, miny, maxy = self.em(srs_epsg(4674)).GetEnvelope()
        return minx, miny, maxx, maxy


# =============================================================================
# Recorte
# =============================================================================

EXT_VETOR = (".shp", ".gpkg", ".kml", ".kmz", ".geojson", ".json", ".gml", ".tab", ".mif", ".dxf", ".fgb")
EXT_RASTER = (".tif", ".tiff", ".img", ".ecw", ".jp2", ".vrt", ".asc", ".sid")


def listar_datasets(caminho):
    """Dados dentro de um .zip (inclusive zip dentro de zip e FileGDB) ou o
    proprio arquivo: [(caminho_gdal, 'vetor'|'raster', nome)]."""
    if caminho.lower().endswith(".zip") or caminho.lower().endswith(".zip}"):
        prefixo = caminho if caminho.startswith("/vsizip/") else "/vsizip/" + caminho.replace("\\", "/")
        itens = [r.replace("\\", "/") for r in (gdal.ReadDirRecursive(prefixo) or [])]
        gdbs = sorted({r[: r.lower().index(".gdb") + 4] for r in itens if ".gdb" in r.lower()})
        saida = [(prefixo + "/" + g, "vetor", os.path.splitext(os.path.basename(g))[0]) for g in gdbs]
        for r in itens:
            if r.endswith("/") or any(r.startswith(g) for g in gdbs):
                continue
            ext = os.path.splitext(r)[1].lower()
            nome = os.path.splitext(os.path.basename(r))[0]
            if ext == ".zip":
                saida.extend(listar_datasets("/vsizip/{%s/%s}" % (prefixo, r)))
            elif ext in EXT_VETOR:
                saida.append((prefixo + "/" + r, "vetor", nome))
            elif ext in EXT_RASTER:
                saida.append((prefixo + "/" + r, "raster", nome))
        return saida
    ext = os.path.splitext(caminho.lower())[1]
    return [(caminho, "raster" if ext in EXT_RASTER else "vetor", os.path.splitext(os.path.basename(caminho))[0])]


def _slug(nome, limite=55):
    return re.sub(r"[^a-z0-9]+", "_", normalizar(nome)).strip("_")[:limite] or "camada"


def _precisa_cp1252(lyr):
    """Shapefile antigo sem .cpg: se os textos nao forem UTF-8 valido, sao Windows-1252."""
    defn = lyr.GetLayerDefn()
    idx = [i for i in range(defn.GetFieldCount()) if defn.GetFieldDefn(i).GetType() == ogr.OFTString]
    if not idx:
        return False
    lyr.ResetReading()
    try:
        for n, f in enumerate(lyr):
            if n > 1000:
                break
            for i in idx:
                if f.IsFieldSetAndNotNull(i):
                    try:
                        f.GetField(i).encode("utf-8")
                    except UnicodeEncodeError:
                        return True
    finally:
        lyr.ResetReading()
    return False


def _shx_ausente(caminho, avisos, nome):
    """Shapefile local sem .shx (backup incompleto): reconstroi o indice numa
    COPIA temporaria. Nunca escreve na pasta de origem (SHAPE_RESTORE_SHX no
    arquivo original o regravaria - e numa pasta de rede so-leitura falharia)."""
    if not caminho.lower().endswith(".shp") or caminho.startswith("/vsi"):
        return caminho
    base = os.path.splitext(caminho)[0]
    if os.path.exists(base + ".shx") or os.path.exists(base + ".SHX"):
        return caminho
    tmp = tempfile.mkdtemp(prefix="shx_")
    for ext in (".shp", ".dbf", ".prj", ".cpg", ".SHP", ".DBF", ".PRJ", ".CPG"):
        if os.path.exists(base + ext):
            shutil.copy2(base + ext, os.path.join(tmp, os.path.basename(base) + ext.lower()))
    copia = os.path.join(tmp, os.path.basename(base) + ".shp")
    gdal.SetConfigOption("SHAPE_RESTORE_SHX", "YES")
    try:
        gdal.OpenEx(copia, gdal.OF_VECTOR)
    finally:
        gdal.SetConfigOption("SHAPE_RESTORE_SHX", None)
    avisos.append("%s: .shx ausente - reconstruido numa copia temporaria (original intacto)" % nome)
    return copia


def recortar_vetores(fontes, destino, area, dizer=print):
    """fontes: [(caminho_gdal, nome_camada_destino)]. Fontes com o mesmo nome de
    destino (ex.: paginas de um servico) vao para a mesma camada. Tudo e
    cortado pela area, reprojetado para EPSG:31984 e mantem os atributos.
    Devolve (n_camadas, n_feicoes, avisos)."""
    criadas, avisos, contagem = {}, [], {}
    for caminho, nome_logico in fontes:
        caminho = _shx_ausente(caminho, avisos, nome_logico)
        contexto = _SoRemoto(caminho)
        contexto.__enter__()
        try:
            ds = gdal.OpenEx(caminho, gdal.OF_VECTOR)
        except RuntimeError as e:
            contexto.__exit__()
            avisos.append("%s: nao abriu (%s)" % (nome_logico, msg_erro(e)))
            continue
        nomes = [ds.GetLayerByIndex(i).GetName() for i in range(ds.GetLayerCount())]
        for nome_lyr in nomes:
            lyr = ds.GetLayerByName(nome_lyr)
            srs = lyr.GetSpatialRef()
            if srs is None:
                avisos.append("%s/%s: sem sistema de referencia - nao recortado" % (nome_logico, nome_lyr))
                continue
            if lyr.GetGeomType() == ogr.wkbNone:
                continue  # tabela sem geometria
            chave = nome_logico if len(nomes) == 1 else "%s_%s" % (nome_logico, nome_lyr)
            src = ds
            if caminho.lower().endswith(".shp") and _precisa_cp1252(lyr):
                src = gdal.OpenEx(caminho, gdal.OF_VECTOR, open_options=["ENCODING=CP1252"])
                avisos.append("%s: textos em Windows-1252 convertidos para UTF-8" % nome_logico)
            area_src = area.em(srs)
            minx, maxx, miny, maxy = area_src.GetEnvelope()
            campos = {lyr.GetLayerDefn().GetFieldDefn(i).GetName().lower()
                      for i in range(lyr.GetLayerDefn().GetFieldCount())}
            existe_camada = chave in criadas
            if not existe_camada:
                base, n = _slug(chave), 2
                nome_dest = base
                while nome_dest in criadas.values():
                    nome_dest = "%s_%d" % (base, n)
                    n += 1
                criadas[chave] = nome_dest
            nome_dest = criadas[chave]
            opcoes = gdal.VectorTranslateOptions(
                format="GPKG",
                accessMode=("append" if existe_camada else ("update" if os.path.exists(destino) else None)),
                addFields=existe_camada,
                layers=[nome_lyr],
                layerName=nome_dest,
                dstSRS="EPSG:%d" % EPSG_SAIDA,
                reproject=True,
                spatFilter=(minx, miny, maxx, maxy),
                clipSrc=area_src.ExportToWkt(),
                makeValid=True,
                skipFailures=True,
                geometryType="PROMOTE_TO_MULTI",
                layerCreationOptions=["FID=%s" % ("fid_gpkg" if "fid" in campos else "fid")],
            )
            gdal.VectorTranslate(destino, src, options=opcoes)
            src = None
        ds = None
        contexto.__exit__()
    if not os.path.exists(destino):
        return 0, 0, avisos
    saida = ogr.Open(destino)
    for nome_dest in criadas.values():
        lyr = saida.GetLayerByName(nome_dest)
        if lyr is not None:
            contagem[nome_dest] = lyr.GetFeatureCount()
            dizer("      camada %s: %d feicao(oes) no recorte" % (nome_dest, contagem[nome_dest]))
    saida = None
    return len(contagem), sum(contagem.values()), avisos


def recortar_raster(origem, destino, area, resolucao_m=None, categorico=True, nodata=None, legenda=None):
    """Recorta raster (local, /vsizip/ ou /vsicurl/ - so a janela necessaria e
    lida), EPSG:31984, GeoTIFF LZW. legenda: {codigo: (nome, '#rrggbb')}."""
    with _SoRemoto(origem):
        return _recortar_raster(origem, destino, area, resolucao_m, categorico, nodata, legenda)


def _srs_do_prj(origem):
    """Ortofotos antigas: posicao no .tfw/.jgw e SRC so num .prj ao lado (padrao
    ArcGIS, que o GDAL nao le para GeoTIFF/JPEG). Funciona tambem dentro de zip."""
    for prj in (os.path.splitext(origem)[0] + ".prj", origem + ".prj"):
        try:
            fh = gdal.VSIFOpenL(prj, "rb")
        except RuntimeError:
            fh = None
        if not fh:
            continue
        try:
            texto = gdal.VSIFReadL(1, 1 << 20, fh).decode("utf-8", "replace")
        finally:
            gdal.VSIFCloseL(fh)
        s = osr.SpatialReference()
        try:
            s.ImportFromWkt(texto)
        except RuntimeError:
            s.ImportFromESRI([texto])
        return s.ExportToWkt()
    return None


def _recortar_raster(origem, destino, area, resolucao_m, categorico, nodata, legenda):
    ds = gdal.Open(origem)
    srs_origem = None
    if not ds.GetProjection():
        srs_origem = _srs_do_prj(origem)
        if not srs_origem:
            raise RuntimeError("raster sem sistema de referencia (nem interno, nem .aux.xml, nem .prj ao lado) - "
                               "defina o SRC no QGIS e rode de novo")
    corte = os.path.join(tempfile.mkdtemp(prefix="corte_"), "corte.geojson")
    dsc = ogr.GetDriverByName("GeoJSON").CreateDataSource(corte)
    lyr = dsc.CreateLayer("corte", area.srs, ogr.wkbMultiPolygon)
    f = ogr.Feature(lyr.GetLayerDefn())
    f.SetGeometry(ogr.ForceToMultiPolygon(area.geom.Clone()))
    lyr.CreateFeature(f)
    dsc = None
    if nodata is None:
        nodata = ds.GetRasterBand(1).GetNoDataValue()
    opcoes = dict(format="GTiff", dstSRS="EPSG:%d" % EPSG_SAIDA, cutlineDSName=corte, cropToCutline=True,
                  resampleAlg="near" if categorico else "bilinear",
                  creationOptions=["COMPRESS=LZW", "TILED=YES", "BIGTIFF=IF_SAFER"], multithread=True)
    if resolucao_m:
        opcoes.update(xRes=resolucao_m, yRes=resolucao_m, targetAlignedPixels=True)
    if nodata is not None:
        opcoes.update(srcNodata=nodata, dstNodata=nodata)
    if srs_origem:
        opcoes.update(srcSRS=srs_origem)
    gdal.Warp(destino, ds, options=gdal.WarpOptions(**opcoes))
    ds = None
    if legenda:
        aplicar_legenda(destino, legenda)
    return os.path.getsize(destino)


def _rgb(cor):
    c = (cor or "").lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)) if len(c) == 6 else (128, 128, 128)


def aplicar_legenda(tif, legenda):
    """Tabela de cores dentro do TIFF (qualquer SIG), tabela de atributos do
    raster (RAT: valor, classe, cor - lida pelo QGIS e pela Triagem) e um
    estilo .qml com o mesmo nome, que o QGIS aplica sozinho ao abrir."""
    out = gdal.Open(tif, gdal.GA_Update)
    b = out.GetRasterBand(1)
    if b.DataType == gdal.GDT_Byte:
        tabela = gdal.ColorTable()
        for codigo, (_, cor) in legenda.items():
            tabela.SetColorEntry(int(codigo), _rgb(cor) + (255,))
        b.SetRasterColorTable(tabela)
        b.SetRasterColorInterpretation(gdal.GCI_PaletteIndex)
    rat = gdal.RasterAttributeTable()
    for nome, tipo, uso in (("valor", gdal.GFT_Integer, gdal.GFU_MinMax), ("classe", gdal.GFT_String, gdal.GFU_Name),
                            ("R", gdal.GFT_Integer, gdal.GFU_Red), ("G", gdal.GFT_Integer, gdal.GFU_Green),
                            ("B", gdal.GFT_Integer, gdal.GFU_Blue)):
        rat.CreateColumn(nome, tipo, uso)
    codigos = sorted(int(k) for k in legenda)
    rat.SetRowCount(len(codigos))
    for i, cod in enumerate(codigos):
        nome, cor = legenda[cod]
        r, g, bl = _rgb(cor)
        rat.SetValueAsInt(i, 0, cod)
        rat.SetValueAsString(i, 1, nome)
        rat.SetValueAsInt(i, 2, r)
        rat.SetValueAsInt(i, 3, g)
        rat.SetValueAsInt(i, 4, bl)
    b.SetDefaultRAT(rat)
    nodata = b.GetNoDataValue()
    out = None
    from xml.sax.saxutils import quoteattr
    entradas = "".join('<paletteEntry value="%d" color="%s" alpha="255" label=%s/>' % (
        cod, "#%02x%02x%02x" % _rgb(legenda[cod][1]), quoteattr("%s (%d)" % (legenda[cod][0], cod)))
        for cod in codigos if nodata is None or cod != int(nodata))
    qml = ("<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>\n<qgis version=\"3.34.0\" "
           "styleCategories=\"Symbology\"><pipe><rasterrenderer type=\"paletted\" band=\"1\" opacity=\"1\" "
           "alphaBand=\"-1\" nodataColor=\"\"><rasterTransparency/><colorPalette>%s</colorPalette>"
           "</rasterrenderer><brightnesscontrast brightness=\"0\" contrast=\"0\" gamma=\"1\"/>"
           "<rasterresampler maxOversampling=\"2\"/></pipe><blendMode>0</blendMode></qgis>\n" % entradas)
    with open(os.path.splitext(tif)[0] + ".qml", "w", encoding="utf-8") as fh:
        fh.write(qml)


# =============================================================================
# Contexto da coleta
# =============================================================================

class Falhou(Exception):
    pass


class Coleta:
    def __init__(self, args):
        self.args = args
        self.saida = args.saida or os.path.join(args.base, *SUBPASTA_SAIDA)
        self.recortes = os.path.join(self.saida, "recortes")
        self.parciais = os.path.join(self.recortes, "_parciais")
        os.makedirs(self.parciais, exist_ok=True)
        self.log = Log(os.path.join(self.saida, NOME_LOG))
        self.rede = Rede([tuple(r.split("=", 1)) for r in (args.redirecionar or [])], args.ssl_flexivel, self.dizer)
        self.area = AreaRecorte(args.limite or os.path.join(args.base, NOME_LIMITE_KML), self.saida)
        self.resumo = {"OK": 0, "FALHA": 0, "PULADO": 0}
        self.refazer = {x.strip() for x in (args.refazer or "").split(",") if x.strip()}
        self._configurar_gdal()

    def _configurar_gdal(self):
        for chave, valor in {
            "GDAL_HTTP_TIMEOUT": str(int(TIMEOUT_S)), "GDAL_HTTP_CONNECTTIMEOUT": "30",
            "GDAL_HTTP_MAX_RETRY": str(TENTATIVAS), "GDAL_HTTP_RETRY_DELAY": str(int(ESPERAS_S[0]) or 1),
            "CPL_VSIL_CURL_USE_HEAD": "NO",
            "GDAL_HTTP_USERAGENT": USER_AGENT, "VSI_CACHE": "TRUE", "GDAL_CACHEMAX": "512",
            "OGR_GEOMETRY_ACCEPT_UNCLOSED_RING": "YES",
        }.items():
            gdal.SetConfigOption(chave, valor)
        # No Windows o curl do GDAL nao le o proxy configurado no sistema (o Python le):
        # repassa. Se houver HTTPS_PROXY no ambiente, o proprio curl ja usa (e respeita NO_PROXY).
        if os.name == "nt" and not (os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")):
            proxies = urllib.request.getproxies()
            if proxies.get("https") and not gdal.GetConfigOption("GDAL_HTTP_PROXY"):
                gdal.SetConfigOption("GDAL_HTTP_PROXY", proxies["https"].split("://", 1)[-1].rstrip("/"))
        if self.args.ssl_flexivel:
            gdal.SetConfigOption("GDAL_HTTP_UNSAFESSL", "YES")

    def dizer(self, texto):
        print(texto, flush=True)

    def pasta_fonte(self, *partes):
        p = os.path.join(self.saida, *[nome_seguro(x) for x in partes])
        os.makedirs(p, exist_ok=True)
        return p

    def exigir_area(self):
        if self.area.geom is None:
            raise Falhou("sem area de recorte: %s" % self.area.erro)

    def ja_concluido(self, id_item):
        if id_item in self.refazer:
            return False
        linha = self.log.concluido(id_item)
        if not linha:
            return False
        m = re.search(r"arquivo=(\S+)", linha.get("mensagem", ""))
        if m and not os.path.exists(os.path.join(self.saida, m.group(1).replace("/", os.sep))):
            self.dizer("  %s: o log diz concluido, mas %s sumiu - refazendo" % (id_item, m.group(1)))
            return False
        self.log.registrar(id_item, url=linha.get("url", ""), status="PULADO",
                           mensagem="ja concluido em %s (use --refazer %s para refazer)" % (linha.get("fim"), id_item))
        self.resumo["PULADO"] += 1
        self.dizer("  [PULADO] %s - ja concluido em %s" % (id_item, linha.get("fim")))
        return True

    def obter(self, id_item, url, destino, cabecalhos=None, evidencia=""):
        """Baixa sem nunca sobrescrever; reaproveita o que ja foi baixado."""
        anterior = self.log.download_anterior(url)
        if anterior:
            m = re.match(r"download: salvo em (.+?)(?: \| |$)", anterior.get("mensagem", ""))
            candidatos = [os.path.join(self.saida, m.group(1).replace("/", os.sep))] if m else []
            for c in candidatos + [destino]:
                if os.path.exists(c) and sha256_de(c) == anterior["sha256"]:
                    self.dizer("      ja baixado antes (sha256 confere): %s" % os.path.relpath(c, self.saida))
                    return c
        if os.path.exists(destino):
            destino = caminho_livre(destino)
        inicio = agora()
        self.dizer("      baixando %s" % url)
        try:
            codigo, tamanho, sha = self.rede.baixar(url, destino, cabecalhos)
        except ErroHTTP as e:
            self.log.registrar(id_item, url=url, http=e.codigo, inicio=inicio, status="FALHA",
                               mensagem="download: %s" % e)
            raise
        self.log.registrar(id_item, url=url, http=codigo, bytes_=tamanho, sha256=sha, inicio=inicio, status="OK",
                           mensagem="download: salvo em %s%s" % (os.path.relpath(destino, self.saida).replace(os.sep, "/"),
                                                                 (" | " + evidencia) if evidencia else ""))
        return destino

    def gravar_resposta(self, pasta, nome, conteudo):
        destino = caminho_livre(os.path.join(pasta, nome_seguro(nome)))
        with open(destino, "wb") as fh:
            fh.write(conteudo)
        return destino

    def temporario(self, id_item, ext):
        return os.path.join(self.parciais, "%s_%s%s" % (id_item, datetime.now().strftime("%Y%m%d_%H%M%S_%f"), ext))

    def publicar(self, temporario, id_item, ext):
        """Poe o recorte no nome do contrato. Se ja existir, o anterior e guardado
        (renomeado para .anterior_<data>) - nada e apagado."""
        final = os.path.join(self.recortes, id_item + ext)
        if os.path.exists(final):
            guardado = caminho_livre(os.path.join(
                self.recortes, "%s.anterior_%s%s" % (id_item, datetime.now().strftime("%Y%m%d_%H%M%S"), ext)))
            os.rename(final, guardado)
            if os.path.exists(final + ".aux.xml"):
                os.rename(final + ".aux.xml", guardado + ".aux.xml")
            self.dizer("      recorte anterior guardado como %s" % os.path.basename(guardado))
        os.replace(temporario, final)
        # arquivos que acompanham o raster: tabela de atributos (.aux.xml) e estilo do QGIS (.qml)
        for de, para in ((temporario + ".aux.xml", final + ".aux.xml"),
                         (os.path.splitext(temporario)[0] + ".qml", os.path.splitext(final)[0] + ".qml")):
            if os.path.exists(de):
                if os.path.exists(para):
                    os.rename(para, caminho_livre(para + ".anterior"))
                os.replace(de, para)
        return final

    def concluir(self, id_item, url, arquivo, mensagem, http=""):
        rel = os.path.relpath(arquivo, self.saida).replace(os.sep, "/")
        self.log.registrar(id_item, url=url, http=http, bytes_=os.path.getsize(arquivo), sha256=sha256_de(arquivo),
                           status="OK", mensagem="%s arquivo=%s %s" % (MARCA_OK, rel, mensagem))
        self.resumo["OK"] += 1
        self.dizer("  [OK] %s -> %s" % (id_item, rel))

    def falhar(self, id_item, url, erro, inicio=""):
        self.log.registrar(id_item, url=url, inicio=inicio, status="FALHA", mensagem="%s %s" % (MARCA_FALHA, erro))
        self.resumo["FALHA"] += 1
        self.dizer("  [FALHA] %s - %s" % (id_item, erro))

    # ---- recorte de arquivos baixados/locais
    def recortar(self, id_item, arquivos, url, evidencia="", categorico=True, filtro=None):
        self.exigir_area()
        vetores, rasters = [], []
        for arq in arquivos:
            for caminho_gdal, tipo, nome in listar_datasets(arq):
                if filtro and not re.search(filtro, normalizar(caminho_gdal)):
                    continue
                (vetores if tipo == "vetor" else rasters).append((caminho_gdal, nome))
        if not vetores and not rasters:
            raise Falhou("nenhum dado geografico reconhecido em %s" % ", ".join(os.path.basename(a) for a in arquivos))
        saidas = []
        if vetores:
            tmp = self.temporario(id_item, ".gpkg")
            n_cam, n_feic, avisos = recortar_vetores(vetores, tmp, self.area, self.dizer)
            if not os.path.exists(tmp) or not n_cam:
                raise Falhou("recorte vetorial vazio%s" % ((": " + "; ".join(avisos[:3])) if avisos else ""))
            saidas.append((self.publicar(tmp, id_item, ".gpkg"), "%d camada(s), %d feicao(oes) no recorte%s" % (
                n_cam, n_feic, (" | avisos: " + "; ".join(avisos[:4])) if avisos else "")))
        for caminho_gdal, nome in rasters:
            sufixo = "" if len(rasters) == 1 else "_" + _slug(nome, 40)
            tmp = self.temporario(id_item + sufixo, ".tif")
            recortar_raster(caminho_gdal, tmp, self.area, categorico=categorico)
            saidas.append((self.publicar(tmp, id_item + sufixo, ".tif"), "raster recortado de %s" % nome))
        for arquivo, msg in saidas:
            self.concluir(id_item, url, arquivo, msg + ((" | " + evidencia) if evidencia else ""))


# =============================================================================
# Estrategias (cada item tenta a lista em ordem)
# =============================================================================

def estr_arquivo(col, item, e):
    """Baixa o primeiro candidato que responder e recorta."""
    pasta = col.pasta_fonte(item["fonte"])
    cab = {}
    if e.get("preparar"):
        # alguns servidores (ANM) so entregam o arquivo depois de visitar o indice (cookie + Referer)
        try:
            col.rede.texto(e["preparar"])
            cab["Referer"] = col.rede.real(e["preparar"])
        except ErroHTTP as erro:
            col.dizer("      aviso: indice %s nao abriu (%s); tentando o arquivo mesmo assim" % (e["preparar"], erro))
    erros = []
    for url in e["urls"]:
        destino = os.path.join(pasta, nome_seguro(url.rstrip("/").split("/")[-1]))
        try:
            arquivo = col.obter(item["id"], url, destino, cab, e.get("evidencia", ""))
        except ErroHTTP as erro:
            erros.append("%s -> %s" % (url, erro))
            continue
        if e.get("sem_recorte"):
            col.concluir(item["id"], url, arquivo, "original baixado (documento, sem recorte) | " + e.get("evidencia", ""))
        else:
            col.recortar(item["id"], [arquivo], url, e.get("evidencia", ""), e.get("categorico", True), e.get("filtro"))
        return
    raise Falhou("nenhuma URL respondeu: " + " | ".join(erros))


def estr_descobrir(col, item, e):
    """Indice com versoes (ex.: geoftp do IBGE): acha a versao mais recente
    pelo nome da pasta (municipio_2025, versao_2023...) e baixa o arquivo."""
    versoes = []
    try:
        _, pagina = col.rede.texto(e["indice"])
        for alvo, href, _ in links_da_pagina(pagina, e["indice"]):
            m = re.search(e["regex_versao"], href)
            if m:
                versoes.append(int(m.group(1)))
    except ErroHTTP as erro:
        col.dizer("      indice %s nao abriu (%s); testando versoes conhecidas" % (e["indice"], erro))
    versoes = sorted(set(versoes) | set(e.get("versoes_reserva", [])), reverse=True)
    if not versoes:
        raise Falhou("nenhuma versao encontrada em %s" % e["indice"])
    candidatos = []
    for v in versoes:
        if e.get("regex_arquivo"):
            pasta_v = e["modelo_pasta"].format(v=v, uf=UF)
            try:
                _, pagina = col.rede.texto(pasta_v)
                for alvo, href, _ in links_da_pagina(pagina, pasta_v):
                    if re.search(e["regex_arquivo"], urllib.parse.unquote(href), re.I):
                        candidatos.append(alvo)
            except ErroHTTP:
                pass
        for modelo in e.get("modelos", []):
            candidatos.append(modelo.format(v=v, uf=UF))
    vistos = []
    for c in candidatos:
        if c not in vistos:
            vistos.append(c)
    col.dizer("      versoes encontradas: %s" % ", ".join(str(v) for v in versoes[:6]))
    return estr_arquivo(col, item, dict(e, urls=vistos))


def estr_diretorio(col, item, e):
    """Indice de pasta (FBDS/h5ai): baixa todos os arquivos e recorta."""
    col.exigir_area()
    erros = []
    for base in e["urls"]:
        try:
            arquivos = listar_diretorio(col.rede, base)
        except ErroHTTP as erro:
            erros.append("%s -> %s" % (base, erro))
            continue
        if not arquivos:
            erros.append("%s -> pasta vazia" % base)
            continue
        pasta = col.pasta_fonte(item["fonte"], *e.get("subpasta", []))
        baixados = []
        for url, rel in arquivos:
            destino_dir = os.path.join(pasta, *[nome_seguro(p) for p in rel[:-1]])
            os.makedirs(destino_dir, exist_ok=True)
            baixados.append(col.obter(item["id"], url, os.path.join(destino_dir, nome_seguro(rel[-1])),
                                      evidencia=e.get("evidencia", "")))
        alvos = [b for b in baixados if b.lower().endswith((".shp", ".zip", ".gpkg", ".kml", ".kmz", ".geojson"))]
        col.recortar(item["id"], alvos, base, e.get("evidencia", ""))
        return
    raise Falhou(" | ".join(erros))


def _paginar_arcgis(col, url_camada, bbox, pasta, rotulo):
    lon0, lat0, lon1, lat1 = bbox
    arquivos, deslocamento, tamanho_pagina, formato = [], 0, 1000, "geojson"
    for pagina in range(1, 501):
        params = {"where": "1=1", "geometry": "%.6f,%.6f,%.6f,%.6f" % (lon0, lat0, lon1, lat1),
                  "geometryType": "esriGeometryEnvelope", "inSR": "4674", "outSR": "4674",
                  "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "returnGeometry": "true",
                  "f": formato, "resultOffset": str(deslocamento), "resultRecordCount": str(tamanho_pagina)}
        url = url_camada.rstrip("/") + "/query?" + urllib.parse.urlencode(params)
        codigo, dados = col.rede.json(url)
        if "error" in dados and pagina == 1 and formato == "geojson":
            formato = "json"   # servidor antigo sem GeoJSON: Esri JSON
            params["f"] = formato
            codigo, dados = col.rede.json(url_camada.rstrip("/") + "/query?" + urllib.parse.urlencode(params))
        if "error" in dados:
            raise Falhou("servico ArcGIS respondeu erro: %s" % json.dumps(dados["error"])[:200])
        feats = dados.get("features", [])
        if pagina == 1 or feats:
            arquivos.append(col.gravar_resposta(pasta, "%s_pagina_%03d.%s" % (rotulo, pagina, formato),
                                                json.dumps(dados).encode("utf-8")))
        excedeu = dados.get("exceededTransferLimit") or (dados.get("properties") or {}).get("exceededTransferLimit")
        if not feats or (len(feats) < tamanho_pagina and not excedeu):
            return arquivos, url_camada
        deslocamento += len(feats)
    raise Falhou("mais de 500 paginas - servico devolveu dados demais")


def estr_arcgis(col, item, e):
    """Servico ArcGIS REST consultado so no retangulo de Fundao (+2 km)."""
    col.exigir_area()
    servico = e.get("servico")
    if e.get("pasta_servicos"):
        _, dados = col.rede.json(e["pasta_servicos"].rstrip("/") + "?f=json")
        achados = [s for s in dados.get("services", []) if re.search(e["regex_servico"], normalizar(s.get("name", "")))]
        if not achados:
            raise Falhou("nenhum servico casa com '%s' em %s" % (e["regex_servico"], e["pasta_servicos"]))
        raiz = e["pasta_servicos"].rstrip("/").rsplit("/", 1)[0] if "/" in achados[0]["name"] else e["pasta_servicos"].rstrip("/")
        servico = "%s/%s/%s" % (raiz, achados[0]["name"], achados[0].get("type", "FeatureServer"))
    camadas = e.get("camadas")
    if camadas is None:
        _, meta = col.rede.json(servico.rstrip("/") + "?f=json")
        camadas = [c["id"] for c in meta.get("layers", []) if re.search(e["regex_camada"], normalizar(c.get("name", "")))]
        if not camadas:
            raise Falhou("nenhuma camada casa com '%s' em %s" % (e["regex_camada"], servico))
    pasta = col.pasta_fonte(item["fonte"], item["id"])
    fontes = []
    for c in camadas:
        rotulo = "%s_camada_%s" % (_slug(servico.split("/services/")[-1], 60), c)
        arquivos, _ = _paginar_arcgis(col, "%s/%s" % (servico.rstrip("/"), c), col.area.bbox_geografico(), pasta, rotulo)
        fontes.extend((a, "%s_%s" % (item["id"], c)) for a in arquivos)
    _publicar_vetores(col, item, fontes, servico, e, "consulta ArcGIS REST no retangulo de Fundao (+2 km)")


def estr_wfs(col, item, e):
    """WFS (GeoServer) consultado so no retangulo de Fundao (+2 km)."""
    col.exigir_area()
    lon0, lat0, lon1, lat1 = col.area.bbox_geografico()
    pasta = col.pasta_fonte(item["fonte"], item["id"])
    fontes = []
    for camada in e["camadas"]:
        params = {"service": "WFS", "version": "1.0.0", "request": "GetFeature", "typeName": camada,
                  "srsName": "EPSG:4674", "bbox": "%.6f,%.6f,%.6f,%.6f,EPSG:4674" % (lon0, lat0, lon1, lat1),
                  "outputFormat": "application/json", "maxFeatures": "200000"}
        url = e["url"] + ("&" if "?" in e["url"] else "?") + urllib.parse.urlencode(params)
        codigo, txt = col.rede.texto(url, {"Accept": "application/json"})
        if not txt.lstrip().startswith("{"):
            raise Falhou("WFS nao devolveu GeoJSON para %s (inicio: %r)" % (camada, txt[:120]))
        dados = json.loads(txt)
        if len(dados.get("features", [])) >= 200000:
            col.dizer("      AVISO: %s atingiu o limite de 200.000 feicoes" % camada)
        arq = col.gravar_resposta(pasta, "%s.geojson" % _slug(camada, 80), txt.encode("utf-8"))
        fontes.append((arq, _slug(camada.split(":")[-1])))
    _publicar_vetores(col, item, fontes, e["url"], e, "consulta WFS no retangulo de Fundao (+2 km)")


def _publicar_vetores(col, item, fontes, url, e, como):
    tmp = col.temporario(item["id"], ".gpkg")
    n_cam, n_feic, avisos = recortar_vetores(fontes, tmp, col.area, col.dizer)
    if not os.path.exists(tmp) or not n_cam:
        raise Falhou("consulta nao trouxe camada utilizavel%s" % ((": " + "; ".join(avisos[:3])) if avisos else ""))
    final = col.publicar(tmp, item["id"], ".gpkg")
    col.concluir(item["id"], url, final, "%s: %d camada(s), %d feicao(oes); resposta original em %s/%s | %s" % (
        como, n_cam, n_feic, nome_seguro(item["fonte"]), item["id"], e.get("evidencia", "")))


def estr_vsicurl(col, item, e):
    """Arquivo vetorial remoto grande (GeoPackage): le so a area de Fundao com
    /vsicurl/ (o arquivo nacional nao e baixado). A URL pode vir do registro
    de metadados (GeoNetwork)."""
    col.exigir_area()
    urls = list(e.get("urls", []))
    if e.get("registro_geonetwork"):
        try:
            _, xml = col.rede.texto(e["registro_geonetwork"], {"Accept": "application/xml"})
            achadas = [u for u in re.findall(r"https?://[^\s<>\"']+", xml) if re.search(e["regex_arquivo"], u, re.I)]
            urls = list(dict.fromkeys(achadas)) + urls
        except ErroHTTP as erro:
            col.dizer("      registro de metadados nao abriu (%s)" % erro)
    erros = []
    for url in urls:
        try:
            tmp = col.temporario(item["id"], ".gpkg")
            n_cam, n_feic, avisos = recortar_vetores([("/vsicurl/" + col.rede.real(url), item["id"])], tmp, col.area, col.dizer)
            if not os.path.exists(tmp) or not n_cam:
                raise Falhou("; ".join(avisos) or "nada lido")
            final = col.publicar(tmp, item["id"], ".gpkg")
            col.concluir(item["id"], url, final, "leitura em janela via /vsicurl/ (arquivo nacional nao baixado): "
                         "%d camada(s), %d feicao(oes) | %s" % (n_cam, n_feic, e.get("evidencia", "")), http=206)
            return
        except Exception as erro:
            erros.append("%s -> %s" % (url, msg_erro(erro)))
    raise Falhou("nenhuma fonte remota respondeu: " + (" | ".join(erros) or "nenhuma URL encontrada"))


def estr_rigeo(col, item, e):
    """RIGeo/SGB: acha o link do SIG (zip) na pagina do item e baixa."""
    arquivos, erros = [], []
    for handle in e["handles"]:
        achou = None
        for pagina in ("https://rigeo.sgb.gov.br/jspui/handle/%s" % handle, "https://rigeo.sgb.gov.br/handle/%s" % handle):
            try:
                _, html_txt = col.rede.texto(pagina)
            except ErroHTTP as erro:
                erros.append("%s -> %s" % (pagina, erro))
                continue
            zips = [a for a, href, _ in links_da_pagina(html_txt, pagina)
                    if re.search(r"\.zip(\?|$)", a, re.I) and re.search(r"sig", urllib.parse.unquote(a), re.I)]
            if zips:
                achou = zips[0]
                break
        if not achou:
            erros.append("%s: link do SIG (zip) nao encontrado na pagina" % handle)
            continue
        nome = nome_seguro(urllib.parse.unquote(achou.split("?")[0].rstrip("/").split("/")[-1]))
        try:
            arquivos.append(col.obter(item["id"], achou, os.path.join(col.pasta_fonte(item["fonte"]), nome),
                                      evidencia=e.get("evidencia", "")))
        except ErroHTTP as erro:
            erros.append("%s -> %s" % (achou, erro))
    if not arquivos:
        raise Falhou(" | ".join(erros))
    col.recortar(item["id"], arquivos, "https://rigeo.sgb.gov.br/", e.get("evidencia", "") +
                 ((" | parcial: " + " | ".join(erros)) if erros else ""))


def estr_local(col, item, e):
    caminho = e["caminho"](col.args)
    if not os.path.exists(caminho):
        raise Falhou("arquivo nao encontrado: %s" % caminho)
    col.dizer("      lendo %s (%.0f MB) sem copiar" % (caminho, os.path.getsize(caminho) / 1e6))
    col.recortar(item["id"], [caminho], caminho, "arquivo local - so recorte (original nao copiado)", e.get("categorico", True))


ESTRATEGIAS = {"arquivo": estr_arquivo, "descobrir": estr_descobrir, "diretorio": estr_diretorio,
               "arcgis": estr_arcgis, "wfs": estr_wfs, "vsicurl": estr_vsicurl, "rigeo": estr_rigeo,
               "local": estr_local}


def executar_item(col, item):
    if col.ja_concluido(item["id"]):
        return
    inicio = agora()
    erros = []
    for n, e in enumerate(item["estrategias"], 1):
        rotulo = "%d/%d %s" % (n, len(item["estrategias"]), e["modo"])
        col.dizer("    estrategia %s" % rotulo)
        try:
            ESTRATEGIAS[e["modo"]](col, item, e)
            return
        except Exception as erro:
            texto = msg_erro(erro)
            erros.append("(%s) %s" % (rotulo, texto))
            if n < len(item["estrategias"]):
                col.log.registrar(item["id"], url=_url_da(e), status="FALHA",
                                  mensagem="estrategia %s falhou, tentando a proxima: %s" % (rotulo, texto))
                col.dizer("      falhou: %s" % texto)
    col.falhar(item["id"], _url_da(item["estrategias"][0]), " || ".join(erros), inicio)


def _url_da(e):
    return (e.get("urls") or [""])[0] or e.get("servico") or e.get("url") or e.get("indice") or \
        e.get("pasta_servicos") or e.get("registro_geonetwork") or ""


# =============================================================================
# MapBiomas: colecao mais recente, todos os anos, janela via /vsicurl/
# =============================================================================

GCS = "https://storage.googleapis.com"
GCS_LISTA = GCS + "/storage/v1/b/mapbiomas-public/o"
MAPBIOMAS_RAIZES = ["initiatives/brasil/", "initiatives/brazil/lulc/"]
# pastas por colecao (o padrao mudou a cada colecao; a de mais anos vence)
MAPBIOMAS_LAYOUTS = [
    "initiatives/brasil/collection{n}/lulc/coverage/",
    "initiatives/brazil/lulc/collection_{n}/coverage/",
    "initiatives/brasil/collection_{n}/lulc/coverage/",
    "initiatives/brasil/collection_{n}/lclu/coverage/",
]
MAPBIOMAS_MODELOS_RESERVA = [   # se a listagem do bucket falhar, testa estes (confirmados 2026-09-27)
    "initiatives/brasil/collection{n}/lulc/coverage/brazil_coverage/brazil_coverage-col{n}_{ano}.tif",
    "initiatives/brasil/collection_{n}/lulc/coverage/brazil_coverage_{ano}.tif",
    "initiatives/brasil/collection_{n}/lclu/coverage/brasil_coverage_{ano}.tif",
]
MAPBIOMAS_PAGINA_LEGENDA = "https://brasil.mapbiomas.org/downloads/codigos-de-legenda/"
MAPBIOMAS_LEGENDA_CSV = ("https://brasil.mapbiomas.org/wp-content/uploads/sites/3/2026/08/"
                         "legend_code_mapbiomas_brazil_collection_{n}.csv")
# Legenda de RESERVA da Colecao 11 (so usada se a oficial nao baixar). Fonte:
# CSV oficial via terceiros (pesquisa 2026-09-27); cores de 29, 50 e 75 a conferir.
MAPBIOMAS_LEGENDA_RESERVA = {
    0: ("Sem dado / fora do mapeamento", "#ffffff"), 3: ("Formação Florestal", "#1f8d49"),
    4: ("Formação Savânica", "#7dc975"), 5: ("Mangue", "#04381d"), 6: ("Floresta Alagável", "#007785"),
    7: ("Savana Alagada (beta)", "#228c70"), 49: ("Restinga Arbórea", "#02d659"),
    11: ("Campo Alagado e Área Pantanosa", "#519799"), 12: ("Formação Campestre", "#d6bc74"),
    77: ("Formação Herbáceo Arbustiva", "#86b074"), 84: ("Marisma (beta)", "#81dbbf"),
    50: ("Restinga Herbácea ou Arbustiva", "#ffaa5f"), 32: ("Apicum", "#fc8114"),
    29: ("Afloramento Rochoso", "#ad5100"), 15: ("Pastagem", "#edde8e"), 9: ("Silvicultura", "#7a5900"),
    21: ("Mosaico de Usos", "#ffefc3"), 39: ("Soja", "#f5b3c8"), 20: ("Cana", "#db7093"), 40: ("Arroz", "#c71585"),
    62: ("Algodão (beta)", "#ff69b4"), 41: ("Outras Lavouras Temporárias", "#f54ca9"), 46: ("Café", "#d68fe2"),
    47: ("Citrus", "#9932cc"), 35: ("Dendê", "#9065d0"), 48: ("Outras Lavouras Perenes", "#e6ccff"),
    23: ("Praia, Duna e Areal", "#ffa07a"), 24: ("Área Urbanizada", "#d4271e"), 30: ("Mineração", "#9c0027"),
    75: ("Usina Fotovoltaica", "#757272"), 91: ("Parque Eólico (beta)", "#403d3e"),
    25: ("Outras Áreas não Vegetadas", "#db4d4f"), 33: ("Rio, Lago e Oceano", "#2532e4"), 31: ("Aquicultura", "#091077"),
}


def _numero_colecao(pasta):
    m = re.search(r"collection_?(\d+)/?$", pasta)
    if not m:
        return None
    n = int(m.group(1))
    return n / 10.0 if n >= 30 else float(n)   # collection_71 = colecao 7.1 (beta de solos), nao 71


def _listar_gcs(col, prefixo, delimitador=None):
    itens, prefixos, token = [], [], None
    for _ in range(50):
        params = {"prefix": prefixo, "fields": "items(name,size),prefixes,nextPageToken"}
        if delimitador:
            params["delimiter"] = delimitador
        if token:
            params["pageToken"] = token
        _, dados = col.rede.json(GCS_LISTA + "?" + urllib.parse.urlencode(params))
        itens.extend(dados.get("items", []))
        prefixos.extend(dados.get("prefixes", []))
        token = dados.get("nextPageToken")
        if not token:
            break
    return itens, prefixos


def mapbiomas_descobrir(col):
    """Devolve (colecao, {ano: url}) da colecao mais recente com serie anual."""
    try:
        numeros = set()
        for raiz in MAPBIOMAS_RAIZES:
            _, prefixos = _listar_gcs(col, raiz, "/")
            for p in prefixos:
                n = _numero_colecao(p)
                if n is not None and n == int(n):
                    numeros.add(int(n))
        for n in sorted(numeros, reverse=True):
            anos = {}
            for layout in MAPBIOMAS_LAYOUTS:
                itens, _ = _listar_gcs(col, layout.format(n=n))
                serie = {}
                for it in itens:
                    m = re.search(r"coverage[^/]*?(\d{4})\.tif$", it["name"])
                    if m:
                        serie[int(m.group(1))] = "%s/mapbiomas-public/%s" % (GCS, it["name"])
                for ano, url in serie.items():   # layout com mais anos tem prioridade
                    if ano not in anos or len(serie) > anos[ano][1]:
                        anos[ano] = (url, len(serie))
            if len(anos) >= 10:
                return n, {a: u for a, (u, _) in sorted(anos.items())}
    except (ErroHTTP, ValueError, KeyError) as erro:
        col.dizer("      listagem do bucket falhou (%s); testando URLs conhecidas" % erro)
    for n in (13, 12, 11, 10, 9):
        for modelo in MAPBIOMAS_MODELOS_RESERVA:
            url = "%s/mapbiomas-public/%s" % (GCS, modelo.format(n=n, ano=1985))
            if col.rede.existe(url)[0]:
                anos = {}
                for ano in range(1985, datetime.now().year + 1):
                    anos[ano] = "%s/mapbiomas-public/%s" % (GCS, modelo.format(n=n, ano=ano))
                return n, anos
    raise Falhou("nenhuma colecao do MapBiomas encontrada")


def mapbiomas_legenda(col, n, id_leg):
    """Baixa a legenda oficial (CSV) e devolve ({codigo: (nome, cor)}, origem)."""
    urls = []
    try:
        _, pagina = col.rede.texto(MAPBIOMAS_PAGINA_LEGENDA)
        urls += [a for a, _, _ in links_da_pagina(pagina, MAPBIOMAS_PAGINA_LEGENDA)
                 if re.search(r"legend_code[^/]*collection_?%d\.csv$" % n, a, re.I)]
    except ErroHTTP as erro:
        col.dizer("      pagina de legendas nao abriu (%s)" % erro)
    urls.append(MAPBIOMAS_LEGENDA_CSV.format(n=n))
    pasta = col.pasta_fonte("MapBiomas", "colecao_%d" % n)
    for url in dict.fromkeys(urls):
        try:
            arq = col.obter(id_leg, url, os.path.join(pasta, nome_seguro(url.split("/")[-1])),
                            evidencia="legenda oficial MapBiomas colecao %d" % n)
        except ErroHTTP:
            continue
        with open(arq, encoding="utf-8-sig") as fh:
            texto = fh.read()
        sep = ";" if texto.count(";") > texto.count(",") else ","
        legenda = {}
        for linha in csv.DictReader(io.StringIO(texto), delimiter=sep):
            chaves = {k.strip().lower(): (v or "").strip() for k, v in linha.items() if k}
            cod = chaves.get("class_id") or chaves.get("codigo") or chaves.get("code")
            nome = chaves.get("class_name_pt_br") or chaves.get("classe") or chaves.get("class_name")
            cor = chaves.get("hex_code") or chaves.get("cor") or chaves.get("color")
            if cod and cod.isdigit() and nome:
                legenda[int(cod)] = (nome, cor if cor.startswith("#") else "#" + cor)
        if legenda:
            legenda.setdefault(0, ("Sem dado / fora do mapeamento", "#ffffff"))
            return legenda, "oficial (%s)" % url
    return dict(MAPBIOMAS_LEGENDA_RESERVA), "RESERVA embutida (colecao 11; conferir com a oficial)"


def executar_mapbiomas(col, item):
    inicio = agora()
    try:
        col.exigir_area()
        n, anos = mapbiomas_descobrir(col)
    except Exception as erro:
        col.falhar(item["id"], GCS_LISTA, msg_erro(erro), inicio)
        return
    col.dizer("    colecao mais recente: %d (%d anos: %d-%d)" % (n, len(anos), min(anos), max(anos)))
    id_leg = "mapbiomas_c%d_legenda" % n
    legenda, origem = mapbiomas_legenda(col, n, id_leg)
    if not col.ja_concluido(id_leg):
        tmp = col.temporario(id_leg, ".csv")
        with open(tmp, "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh, delimiter=";")
            w.writerow(["codigo", "classe", "cor"])
            for cod in sorted(legenda):
                w.writerow([cod, legenda[cod][0], legenda[cod][1]])
        col.concluir(id_leg, "", col.publicar(tmp, id_leg, ".csv"), "legenda codigo;classe;cor - " + origem)
    for ano, url in sorted(anos.items()):
        id_ano = "mapbiomas_c%d_%d" % (n, ano)
        if col.ja_concluido(id_ano):
            continue
        inicio = agora()
        existe, codigo, tamanho = col.rede.existe(url)
        if not existe:
            if ano >= datetime.now().year - 1:
                col.dizer("      %d ainda nao publicado nesta colecao" % ano)
                continue
            col.falhar(id_ano, url, "ano nao encontrado (HTTP %s)" % codigo, inicio)
            continue
        try:
            col.dizer("      %d: lendo a janela de Fundao em %s" % (ano, url.rsplit("/", 1)[-1]))
            tmp = col.temporario(id_ano, ".tif")
            recortar_raster("/vsicurl/" + col.rede.real(url), tmp, col.area, resolucao_m=30, categorico=True,
                            nodata=0, legenda=legenda)
            col.concluir(id_ano, url, col.publicar(tmp, id_ano, ".tif"),
                         "janela lida via /vsicurl/ (original nacional de %s nao baixado); legenda %s" % (
                             ("%.2f GB" % (tamanho / 1e9)) if tamanho else "grande porte", origem.split(" (")[0]),
                         http=206)
        except Exception as erro:
            col.falhar(id_ano, url, msg_erro(erro), inicio)


# =============================================================================
# CATALOGO - URLs confirmadas por pesquisa em 2026-09-27
#   CONFIRMADA   = vista literalmente em fonte oficial (pagina, listagem ou HEAD)
#   CORROBORADA  = vista literalmente em codigo/documentacao publica de terceiros
#   INFERIDA     = montada pelo padrao (fica depois das confirmadas)
# =============================================================================

GEOBASES_WFS = "https://ide.geobases.es.gov.br/geoserver/ows"
IBGE_WFS = "https://geoservicos.ibge.gov.br/geoserver/ows"
GEOFTP = "https://geoftp.ibge.gov.br"
INCRA_ZIP = "https://certificacao.incra.gov.br/csv_shp/zip/"
EV_GEOBASES = "Geobases-ES (espelho estadual, EPSG:31984) - CONFIRMADA: paginas das camadas no portal oficial, pesquisa %s" % PESQUISA_EM


def _bdia(tema, prefixo, caminho, geobases=None):
    estr = [
        {"modo": "wfs", "url": IBGE_WFS, "camadas": ["BDIA:%s_area" % prefixo],
         "evidencia": "IBGE WFS BDIA:%s_area - CORROBORADA (uso publico em 2026-07/09), pesquisa %s" % (prefixo, PESQUISA_EM)},
        {"modo": "descobrir", "indice": GEOFTP + caminho, "regex_versao": r"versao_(\d{4})/?$",
         "versoes_reserva": [2025, 2023, 2021], "modelo_pasta": GEOFTP + caminho + "versao_{v}/",
         "regex_arquivo": r"(^|/)%s_area[^/]*\.zip$" % prefixo, "modelos": [GEOFTP + caminho + "versao_{v}/%s_area.zip" % prefixo],
         "evidencia": "geoftp IBGE %s - pasta CONFIRMADA (indice oficial), versao mais recente escolhida na hora; "
                      "arquivo nacional recortado" % caminho},
    ]
    if geobases:
        estr.append({"modo": "wfs", "url": GEOBASES_WFS, "camadas": [geobases], "evidencia": EV_GEOBASES})
    return {"id": "ibge_bdia_%s" % tema, "grupo": 4, "fonte": "IBGE", "estrategias": estr,
            "descricao": "IBGE BDiA 1:250 mil - %s" % tema}


def _local(id_item, desc, montar):
    return {"id": id_item, "grupo": 8, "fonte": "LOCAL", "descricao": desc,
            "estrategias": [{"modo": "local", "caminho": montar}]}


CATALOGO = [
    {"id": "mapbiomas", "grupo": 1, "fonte": "MapBiomas", "especial": executar_mapbiomas,
     "descricao": "MapBiomas - cobertura e uso, colecao mais recente, todos os anos (janela via /vsicurl/)",
     "estrategias": [{"modo": "mapbiomas", "urls": [GCS_LISTA],
                      "evidencia": "Colecao 11 (1985-2025) CONFIRMADA por listagem do bucket e HEAD 200; legenda CSV "
                                   "CORROBORADA; pesquisa %s" % PESQUISA_EM}]},

    # ---- 2 FBDS
    *[{"id": "fbds_%s" % sub.lower(), "grupo": 2, "fonte": "FBDS", "descricao": "FBDS Fundao - %s" % sub,
       "estrategias": [{"modo": "diretorio", "subpasta": ["FUNDAO", sub],
                        "urls": ["https://geo.fbds.org.br/ES/FUNDAO/%s/" % sub, "http://geo.fbds.org.br/ES/FUNDAO/%s/" % sub,
                                 "https://www.geo.fbds.org.br/ES/FUNDAO/%s/" % sub],
                        "evidencia": "geo.fbds.org.br/ES/FUNDAO/ - CONFIRMADA (pagina indexada 'ES/FUNDAO/USO') e "
                                     "CORROBORADA (verificacao HEAD de terceiros, 3202207,FUNDAO,200); pesquisa %s" % PESQUISA_EM}]}
      for sub in ("APP", "USO", "HIDROGRAFIA")],

    # ---- 3 SGB
    {"id": "sgb_geologia_100k", "grupo": 3, "fonte": "SGB",
     "descricao": "SGB geologia 1:100 mil (folhas Aracruz SE.24-Y-D-IV e Vitoria SF.24-V-B-I)",
     "estrategias": [
         {"modo": "rigeo", "handles": ["doc/18319", "doc/18379"],
          "evidencia": "RIGeo doc/18319 (Aracruz) e doc/18379 (Vitoria) - CONFIRMADAS (paginas oficiais); zip do SIG "
                       "achado na pagina na hora; pesquisa %s" % PESQUISA_EM},
         {"modo": "arcgis", "servico": "https://geoportal.sgb.gov.br/server/rest/services/geologia/litoestratigrafia_100000/MapServer",
          "camadas": [0], "evidencia": "GeoSGB litoestratigrafia_100000/MapServer/0 - CONFIRMADA; pesquisa %s" % PESQUISA_EM},
     ]},
    {"id": "sgb_geologia_es_400k", "grupo": 3, "fonte": "SGB", "descricao": "SGB mapa geologico do ES 1:400 mil",
     "estrategias": [
         {"modo": "arcgis", "servico": "https://geoportal.sgb.gov.br/server/rest/services/geologia/litoestratigrafia_estados/MapServer",
          "regex_camada": r"espirito santo", "evidencia": "GeoSGB litoestratigrafia_estados - CONFIRMADA (camada "
          "'Espirito Santo - 1:400.000'); pesquisa %s" % PESQUISA_EM},
         {"modo": "wfs", "url": GEOBASES_WFS, "camadas": ["geonode:espiritosanto_lito_31984",
                                                          "geonode:espiritosanto_estrutura_31984"], "evidencia": EV_GEOBASES},
     ]},

    # ---- 4 IBGE
    _bdia("geologia", "geol", "/informacoes_ambientais/geologia/levantamento_geologico/vetores/escala_250_mil/"),
    _bdia("geomorfologia", "geom", "/informacoes_ambientais/geomorfologia/vetores/escala_250_mil/",
          "geonode:ibge_geomorfologia_es_2023_bff_1km_epsg_31984"),
    _bdia("pedologia", "pedo", "/informacoes_ambientais/pedologia/vetores/escala_250_mil/"),
    _bdia("vegetacao", "vege", "/informacoes_ambientais/vegetacao/vetores/escala_250_mil/",
          "geonode:vege_area_uf_es_epsg_31984"),
    {"id": "ibge_malha_municipal_es", "grupo": 4, "fonte": "IBGE", "descricao": "IBGE malha municipal mais recente (ES)",
     "estrategias": [
         {"modo": "descobrir", "indice": GEOFTP + "/organizacao_do_territorio/malhas_territoriais/malhas_municipais/",
          "regex_versao": r"municipio_(\d{4})/?$", "versoes_reserva": [2025, 2024],
          "modelos": [GEOFTP + "/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_{v}/UFs/{uf}/{uf}_Municipios_{v}.zip"],
          "evidencia": "ES_Municipios_2025.zip CORROBORADA com cabecalhos reais (3.357.757 B, sha256 8e4d59ad...); "
                       "ano mais recente escolhido na hora; pesquisa %s" % PESQUISA_EM},
     ]},
    {"id": "ibge_localidades", "grupo": 4, "fonte": "IBGE", "descricao": "IBGE localidades (Censo 2022)",
     "estrategias": [
         {"modo": "arquivo", "urls": [GEOFTP + "/organizacao_do_territorio/estrutura_territorial/localidades/Localidades_do_Brasil/2022/Localidades_UFs_gpkg.zip",
                                      GEOFTP + "/organizacao_do_territorio/estrutura_territorial/localidades/Localidades_do_Brasil/2022/Localidades_Brasil_gpkg.zip",
                                      GEOFTP + "/organizacao_do_territorio/estrutura_territorial/localidades/Localidades_do_Brasil/2022/Localidades_Brasil_shp.zip"],
          "evidencia": "Localidades_do_Brasil/2022 - CORROBORADA (IPEA geobr e outros); pesquisa %s" % PESQUISA_EM},
     ]},
    {"id": "ibge_lei_11428", "grupo": 4, "fonte": "IBGE",
     "descricao": "Area de aplicacao da Lei 11.428/2006 (mapa IBGE 1:5 mi, vetor publicado pelo MMA)",
     "estrategias": [
         {"modo": "arquivo", "urls": [
             "https://www.gov.br/mma/pt-br/assuntos/ecossistemas-1/biomas/arquivos-biomas/shape_mata_atlantica_ibge_5milhoes_policonica_sirgas2000shp_202.zip",
             "http://antigo.mma.gov.br/estruturas/202/_arquivos/shape_mata_atlantica_ibge_5milhoes_policonica_sirgas2000shp_202.zip"],
          "evidencia": "MMA gov.br - CONFIRMADA (indice de busca, ~491 KB); espelho antigo CORROBORADO; pesquisa %s" % PESQUISA_EM},
     ]},
    {"id": "ibge_lei_11428_mapa_pdf", "grupo": 4, "fonte": "IBGE", "descricao": "Mapa oficial IBGE da Lei 11.428 (PDF, referencia)",
     "estrategias": [{"modo": "arquivo", "sem_recorte": True,
                      "urls": [GEOFTP + "/informacoes_ambientais/estudos_ambientais/biomas/mapas/lei11428_mata_atlantica.pdf"],
                      "evidencia": "geoftp IBGE - CONFIRMADA; pesquisa %s" % PESQUISA_EM}]},

    # ---- 5 INCRA (zips estaticos: sem login; exigem IP brasileiro)
    {"id": "incra_sigef_es", "grupo": 5, "fonte": "INCRA", "descricao": "INCRA SIGEF (ES)",
     "estrategias": [
         {"modo": "arquivo", "urls": [INCRA_ZIP + "Sigef%20Brasil_ES.zip"],
          "evidencia": "INCRA csv_shp/zip - CORROBORADA (uso publico, ES na lista de UFs); pesquisa %s" % PESQUISA_EM},
         {"modo": "wfs", "url": GEOBASES_WFS, "camadas": ["geonode:incra_sigef_privado_es_31984",
                                                          "geonode:incra_sigef_publico_es_31984"], "evidencia": EV_GEOBASES},
     ]},
    {"id": "incra_snci_es", "grupo": 5, "fonte": "INCRA", "descricao": "INCRA SNCI - imoveis certificados (ES)",
     "estrategias": [
         {"modo": "arquivo", "urls": [INCRA_ZIP + "Im%C3%B3vel%20certificado%20SNCI%20Brasil_ES.zip"],
          "evidencia": "nome CORROBORADO; para ES pode nao existir (404) - por isso ha espelho; pesquisa %s" % PESQUISA_EM},
         {"modo": "wfs", "url": GEOBASES_WFS, "camadas": ["geonode:incra_snci_privado_es_31984",
                                                          "geonode:incra_snci_publico_es_31984"], "evidencia": EV_GEOBASES},
     ]},
    {"id": "incra_assentamentos_es", "grupo": 5, "fonte": "INCRA", "descricao": "INCRA projetos de assentamento",
     "estrategias": [
         {"modo": "arquivo", "urls": [INCRA_ZIP + "Assentamento%20Brasil.zip", INCRA_ZIP + "Assentamento%20Brasil_ES.zip"],
          "evidencia": "Assentamento Brasil.zip - CORROBORADA (~48 MB, nacional, recortado); pesquisa %s" % PESQUISA_EM},
         {"modo": "wfs", "url": GEOBASES_WFS, "camadas": ["geonode:incra_assentamentos_es_31984"], "evidencia": EV_GEOBASES},
     ]},
    {"id": "incra_quilombolas_es", "grupo": 5, "fonte": "INCRA", "descricao": "INCRA areas de quilombolas",
     "estrategias": [
         {"modo": "arquivo", "urls": [INCRA_ZIP + "%C3%81reas%20de%20Quilombolas.zip", INCRA_ZIP + "%C3%81reas%20de%20Quilombolas_ES.zip"],
          "evidencia": "Areas de Quilombolas.zip - CORROBORADA (IPEA geobr e outros); pesquisa %s" % PESQUISA_EM},
         {"modo": "wfs", "url": GEOBASES_WFS, "camadas": ["geonode:incra_quilombolas_es_31984"], "evidencia": EV_GEOBASES},
     ]},

    # ---- 6 ANM
    {"id": "anm_sigmine_es", "grupo": 6, "fonte": "ANM", "descricao": "ANM SIGMINE - processos minerarios (ES)",
     "estrategias": [
         {"modo": "arquivo", "preparar": "https://dadosabertos.anm.gov.br/SIGMINE/PROCESSOS_MINERARIOS/",
          "urls": ["https://dadosabertos.anm.gov.br/SIGMINE/PROCESSOS_MINERARIOS/ES.zip"],
          "evidencia": "dadosabertos.anm.gov.br - CONFIRMADA (listagem oficial: ES.zip 3.508.374 B, 25/09/2026); "
                       "pesquisa %s" % PESQUISA_EM},
         {"modo": "arcgis", "servico": "https://geo.anm.gov.br/arcgis/rest/services/SIGMINE/dados_anm/MapServer", "camadas": [0],
          "evidencia": "geo.anm.gov.br SIGMINE/dados_anm camada 0 - CONFIRMADA; pesquisa %s" % PESQUISA_EM},
     ]},

    # ---- 7 ANA BHO
    {"id": "ana_bho_trechos", "grupo": 7, "fonte": "ANA", "descricao": "ANA BHO - trechos de drenagem",
     "estrategias": [
         {"modo": "arcgis", "servico": "https://portal1.snirh.gov.br/server/rest/services/Hosted/main_geoft_bho6_trecho_drenagem/FeatureServer",
          "camadas": [0], "evidencia": "BHO 6 (base vigente) - servico CORROBORADO (uso publico 2026-09-21); pesquisa %s" % PESQUISA_EM},
         {"modo": "vsicurl", "registro_geonetwork": "https://metadados.snirh.gov.br/geonetwork/srv/api/records/32e309da-a8c1-443f-90ac-0cd79ce6a33d/formatters/xml",
          "regex_arquivo": r"trecho_drenagem\.gpkg$",
          "urls": ["https://metadados.snirh.gov.br/files/32e309da-a8c1-443f-90ac-0cd79ce6a33d/geoft_bho_trecho_drenagem.gpkg"],
          "evidencia": "BHO 6 - registro de metadados CONFIRMADO; URL do arquivo lida do registro (reserva INFERIDA)"},
         {"modo": "wfs", "url": GEOBASES_WFS, "camadas": ["geonode:geoft_bho_trecho_drenagem_es"],
          "evidencia": EV_GEOBASES + " - ATENCAO: versao antiga (BHO 2017)"},
     ]},
    {"id": "ana_bho_areas_contribuicao", "grupo": 7, "fonte": "ANA", "descricao": "ANA BHO - areas de contribuicao (ottobacias)",
     "estrategias": [
         {"modo": "arcgis", "pasta_servicos": "https://portal1.snirh.gov.br/server/rest/services/Hosted",
          "regex_servico": r"bho6.*area", "camadas": [0],
          "evidencia": "BHO 6 - servico procurado na pasta Hosted na hora (nome INFERIDO por padrao)"},
         {"modo": "vsicurl", "registro_geonetwork": "https://metadados.snirh.gov.br/geonetwork/srv/api/records/32e309da-a8c1-443f-90ac-0cd79ce6a33d/formatters/xml",
          "regex_arquivo": r"area_drenagem\.gpkg$",
          "urls": ["https://metadados.snirh.gov.br/files/32e309da-a8c1-443f-90ac-0cd79ce6a33d/geoft_bho_area_drenagem.gpkg"],
          "evidencia": "BHO 6 - registro de metadados CONFIRMADO; URL do arquivo lida do registro (reserva INFERIDA)"},
         {"modo": "wfs", "url": GEOBASES_WFS, "camadas": ["geonode:geoft_bho_area_drenagem_es"],
          "evidencia": EV_GEOBASES + " - ATENCAO: versao antiga (BHO 2017)"},
     ]},

    # ---- 8 arquivos grandes ja no PC (so recorte)
    _local("local_map_es_2012_2015_uso_cobertura", "Local: MAP_ES 2012-2015 uso e cobertura vegetal (zip)",
           lambda a: os.path.join(a.g3m, "MAP_ES_2012_2015_USO_COBERTURA_VEGETAL_2012-2015.zip")),
    _local("local_ortofotomosaico_es_2007_2008_uso_solo", "Local: ortofotomosaico ES 2007-2008 uso do solo (zip)",
           lambda a: os.path.join(a.g3m, "ORTOFOTOMOSAICO_ES_2007_2008_USO_DO_SOLO.zip")),
    _local("local_uso_solo_2007_2008_01", "Local: QGis/Uso do solo/uso_solo_2007_2008_01.shp",
           lambda a: os.path.join(a.base, "QGis", "Uso do solo", "uso_solo_2007_2008_01.shp")),
]


# =============================================================================
# Execucao
# =============================================================================

def rodar(args):
    col = Coleta(args)
    col.dizer("=" * 76)
    col.dizer("Coleta de bases publicas - Fundao/ES - %s" % agora())
    col.dizer("Saida  : %s" % col.saida)
    col.dizer("Recorte: %s" % (col.area.descricao if col.area.geom is not None else
                               "INDISPONIVEL (%s) - downloads seguem, recortes vao falhar" % col.area.erro))
    col.dizer("URLs confirmadas por pesquisa em %s; a evidencia de cada uma vai para o log." % PESQUISA_EM)
    col.dizer("=" * 76)
    escolhidos = {x.strip() for x in (args.itens or "").split(",") if x.strip()}
    for item in CATALOGO:
        if escolhidos and str(item["grupo"]) not in escolhidos and item["id"] not in escolhidos:
            continue
        col.dizer("\n[%s] %s" % (item["grupo"], item["descricao"]))
        try:
            if item.get("especial"):
                item["especial"](col, item)
            else:
                executar_item(col, item)
        except Exception as erro:  # nada derruba a coleta inteira
            col.falhar(item["id"], "", "erro inesperado: %s" % msg_erro(erro))
    col.log.fechar()
    col.dizer("\n" + "=" * 76)
    col.dizer("FIM - OK: %(OK)d   FALHA: %(FALHA)d   PULADO: %(PULADO)d" % col.resumo)
    col.dizer("Log: %s" % col.log.caminho)
    if col.resumo["FALHA"]:
        col.dizer("Rode de novo mais tarde: o que ja deu certo sera pulado e so as falhas serao tentadas.")
    return 1 if col.resumo["FALHA"] else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="Coleta e recorte de bases publicas para Fundao/ES.")
    ap.add_argument("--base", default=BASE_PADRAO, help="pasta BACKUP_REDE_PMF_SEMAM_17_08_2026")
    ap.add_argument("--g3m", default=G3M_PADRAO, help="pasta G3M_AMBIENTAL\\BASE_DE_DADOS")
    ap.add_argument("--saida", help="padrao: <base>\\50. SIG_FUNDAO\\01_brutos_pc")
    ap.add_argument("--limite", help="KML do limite (padrao: <base>\\%s)" % NOME_LIMITE_KML)
    ap.add_argument("--itens", help="grupos (1-8) ou ids, separados por virgula")
    ap.add_argument("--refazer", help="ids a refazer mesmo se ja concluidos")
    ap.add_argument("--listar", action="store_true", help="lista o catalogo e sai")
    ap.add_argument("--ssl-flexivel", action="store_true", help="aceita certificado SSL invalido")
    ap.add_argument("--redirecionar", action="append", help="PREFIXO_REAL=PREFIXO_NOVO (testes)")
    args = ap.parse_args(argv)
    if args.listar:
        for item in CATALOGO:
            print("%s  %-44s %s" % (item["grupo"], item["id"], item["descricao"]))
            for e in item["estrategias"]:
                print("      - %-10s %s" % (e["modo"], _url_da(e)))
        return 0
    return rodar(args)


if __name__ == "__main__":
    sys.exit(main())
