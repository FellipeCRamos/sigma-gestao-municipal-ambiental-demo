# -*- coding: utf-8 -*-
"""
Testes automatizados da Triagem Locacional SEMAM com GeoPackage SINTETICO.

Roda o algoritmo pelo framework de Processing do QGIS, sem interface:
    python testar_triagem.py            (Linux: QT_QPA_PLATFORM=offscreen)
    python-qgis testar_triagem.py       (Windows, OSGeo4W Shell)

Nenhum dado real e usado: tudo vem de gerar_gpkg_sintetico.py.
"""

import csv
import importlib.util
import os
import re
import shutil
import sys
import tempfile
import time
import zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from qgis.core import (QgsApplication, QgsProcessingProvider, QgsVectorLayer, QgsProject,
                       QgsFeature, QgsGeometry, QgsProcessingFeatureSourceDefinition)

app = QgsApplication([], False)
app.initQgis()
for caminho_plugins in ("/usr/share/qgis/python/plugins",
                        os.path.join(QgsApplication.prefixPath(), "python", "plugins")):
    if os.path.isdir(caminho_plugins) and caminho_plugins not in sys.path:
        sys.path.append(caminho_plugins)
from processing.core.Processing import Processing  # noqa: E402
Processing.initialize()
import processing  # noqa: E402
from osgeo import ogr, osr  # noqa: E402

import gerar_gpkg_sintetico  # noqa: E402

spec = importlib.util.spec_from_file_location(
    "triagem", os.path.join(AQUI, "..", "triagem_locacional_semam.py"))
triagem = importlib.util.module_from_spec(spec)
spec.loader.exec_module(triagem)


class ProvedorTeste(QgsProcessingProvider):
    def loadAlgorithms(self):
        self.addAlgorithm(triagem.TriagemLocacionalSemam())

    def id(self):
        return "semamteste"

    def name(self):
        return "SEMAM teste"


PROVEDOR = ProvedorTeste()
QgsApplication.processingRegistry().addProvider(PROVEDOR)
print("algoritmos do provedor:", [a.id() for a in PROVEDOR.algorithms()])
ALG = "semamteste:triagem_locacional_semam"

TMP = tempfile.mkdtemp(prefix="triagem_teste_")
GPKG = gerar_gpkg_sintetico.gerar(TMP)
FALHAS = []
TEMPOS = []


def conferir(condicao, mensagem):
    print(("  ok    " if condicao else "  FALHA ") + mensagem)
    if not condicao:
        FALHAS.append(mensagem)


def perto(a, b, tol):
    return abs(a - b) <= tol


def rodar(nome, **params):
    pasta = os.path.join(TMP, nome)
    base = {"GPKG": GPKG, "PASTA_SAIDA": pasta, "INTERSECOES": "TEMPORARY_OUTPUT",
            "ABRIR_FICHA": False, "GERAR_PDF": True}
    base.update(params)
    t0 = time.time()
    res = processing.run(ALG, base)
    dt = time.time() - t0
    TEMPOS.append((nome, dt))
    achados = list(csv.DictReader(ler(res["ACHADOS_CSV"]).splitlines(), delimiter=";"))
    html = ler(res["FICHA_HTML"])
    return res, achados, html, dt


def ler(caminho, modo="r"):
    if "b" in modo:
        with open(caminho, modo) as fh:
            return fh.read()
    with open(caminho, modo, encoding="utf-8-sig") as fh:
        return fh.read()


def f(v):
    return float(v.replace(",", ".")) if v else 0.0


def achado(achados, regra_id, classe_contem=""):
    return [a for a in achados if a["regra_id"] == str(regra_id) and classe_contem in a["classe"]]


def camada_memoria(wkt_lista, epsg="31984", tipo="Polygon"):
    lyr = QgsVectorLayer("%s?crs=EPSG:%s" % (tipo, epsg), "area_teste", "memory")
    feats = []
    for wkt in wkt_lista:
        ft = QgsFeature()
        ft.setGeometry(QgsGeometry.fromWkt(wkt))
        feats.append(ft)
    lyr.dataProvider().addFeatures(feats)
    QgsProject.instance().addMapLayer(lyr)
    return lyr


G1 = "POLYGON((360000 7797000,360100 7797000,360100 7797100,360000 7797100,360000 7797000))"

# ---------------------------------------------------------------------------
print("\n[1] Gleba de referencia (poligono em EPSG:31984)")
lyr = camada_memoria([G1])
res, ach, html, dt = rodar("g1", AREA=lyr.id())
uc = achado(ach, 1)
conferir(len(uc) == 1 and perto(f(uc[0]["area_m2"]), 5000, 0.5) and perto(f(uc[0]["pct_gleba"]), 50, 0.01),
         "UC: 5.000 m2 = 50% IMPEDITIVO")
app_ = achado(ach, 2)
conferir(len(app_) == 1 and perto(f(app_[0]["area_m2"]), 2000, 0.5),
         "APP: 2.000 m2 com dois poligonos sobrepostos (sem contar em dobro)")
nasc = achado(ach, 3)
conferir(len(nasc) == 1 and nasc[0]["classe"] == "NASC-SINT-01" and perto(f(nasc[0]["distancia_m"]), 30, 0.01),
         "Nascente a 30 m listada; a de 400 m nao")
rio = achado(ach, 4)
conferir(len(rio) == 1 and perto(f(rio[0]["distancia_m"]), 25, 0.01) and "distante" not in rio[0]["classe"],
         "Rio a 25 m (raio 30) listado; rio distante nao")
veg = achado(ach, 5)
conferir(len(veg) == 1 and perto(f(veg[0]["pct_gleba"]), 30, 0.01) and "Formacao florestal" in veg[0]["classe"],
         "Raster filtrado (classe 3): 30%, com nome da legenda")
uso = {a["classe"]: f(a["pct_gleba"]) for a in achado(ach, 6)}
conferir(len(uso) == 3 and perto(sum(uso.values()), 100, 0.01)
         and perto(uso.get("Pastagem (sintetica) (15)", 0), 50, 0.01)
         and perto(uso.get("Area urbanizada (sintetica) (24)", 0), 20, 0.01),
         "Raster sem filtro: 30/50/20% somando 100%")
distritos = sorted(a["classe"] for a in achado(ach, 7))
conferir(distritos == ["Distrito Alfa (ficticio)", "Distrito Beta (ficticio)"] and
         all(a["secao_ficha"] == "distrito" for a in achado(ach, 7)),
         "Distrito: os dois, na secao 'distrito'")
conferir([a["classe"] for a in achado(ach, 8)] == ["ZR-1 (sintetica)"], "Zona do PDM identificada")
atos = {a["classe"]: f(a["distancia_m"]) for a in achado(ach, 9)}
conferir(set(atos) == {"0001/2099-SINT", "0002/2099-SINT"} and perto(atos["0001/2099-SINT"], 100, 0.01)
         and perto(atos["0002/2099-SINT"], 350, 0.01), "Atos a 100 m e 350 m listados; o de 600 m nao")
filt = achado(ach, 10)
conferir(len(filt) == 1 and perto(f(filt[0]["area_m2"]), 2000, 0.5), "Filtro SQL valido aplicado (fid = 1)")
conferir(not achado(ach, 90) and not achado(ach, 91) and not achado(ach, 92), "Regras com defeito nao geram achado")
conferir(all(t in html for t in ["camada_que_nao_existe", "filtro_sql inválido", "tipo &#x27;sobreposicao&#x27; desconhecido",
                                 "severidade &#x27;ALTA&#x27; fora do contrato"]),
         "Regras com defeito aparecem em 'Regras nao avaliadas' com o motivo")
conferir(triagem.AVISO_FIXO in html and html.count(triagem.AVISO_FIXO) >= 2, "Aviso fixo presente (topo e fim)")
conferir("0001/2099-SINT" in html and "Distrito Alfa" in html and "ZR-1" in html,
         "Ficha traz atos com n. do processo, distrito e zona")
conferir("10.000,00 m²" in html and "400,00 m" in html, "Area e perimetro da gleba na ficha")
conferir("E 360.050,0" in html and "N 7.797.050,0" in html, "Centroide UTM na ficha")
externos = re.findall(r'(?:src|href)\s*=\s*["\']?(?:https?:)?//', html)
conferir(not externos and "<script" not in html, "HTML autocontido (sem recurso externo nem script)")
pdf = res["FICHA_PDF"]
conferir(os.path.exists(pdf) and ler(pdf, "rb")[:5] == b"%PDF-" and os.path.getsize(pdf) > 5000,
         "PDF gerado (%s bytes)" % (os.path.getsize(pdf) if os.path.exists(pdf) else 0))
lyr_inter = res["INTERSECOES"]
if isinstance(lyr_inter, str):
    lyr_inter = QgsProject.instance().mapLayer(lyr_inter)
n_inter = lyr_inter.featureCount() if lyr_inter is not None else 0
tipos_ok = lyr_inter is not None and lyr_inter.crs().authid() == "EPSG:31984"
conferir(n_inter >= 10 and tipos_ok, "Camada de intersecoes: %d feicoes em EPSG:31984" % n_inter)
cabecalho = ler(res["ACHADOS_CSV"]).splitlines()[0].split(";")
conferir(all(c in cabecalho for c in ["camada", "classe", "area_m2", "pct_gleba", "distancia_m", "severidade",
                                       "base_legal", "orientacao", "fonte", "data_ref"]),
         "CSV com as colunas do contrato")
conferir(dt < 10, "Tempo %.2f s (< 10 s) com camada de 60.000 lotes" % dt)

# ---------------------------------------------------------------------------
print("\n[2] Ponto do requerente em WKT (lat/long) -> buffer de 50 m")
from qgis.core import QgsCoordinateTransform, QgsCoordinateReferenceSystem  # noqa: E402
pt = QgsGeometry.fromWkt("POINT(360050 7797050)")
pt.transform(QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:31984"),
                                    QgsCoordinateReferenceSystem("EPSG:4674"), QgsProject.instance()))
wkt_ll = "CRS=EPSG:4674;" + pt.asWkt(9)
res, ach, html, dt = rodar("ponto", GEOMETRIA=wkt_ll)
conferir("buffer de 50 m" in html, "Nota do buffer de 50 m na ficha")
area_txt = re.search(r"Área</b>([\d\.]+,\d+) m²", html)
area = f(area_txt.group(1).replace(".", "")) if area_txt else 0
conferir(perto(area, 3.14159 * 50 * 50, 30), "Area do buffer ~7.854 m2 (obtido %.1f)" % area)
conferir(len(achado(ach, 1)) == 1, "Buffer do ponto encosta na UC")

# ---------------------------------------------------------------------------
print("\n[3] KMZ do requerente em WGS 84, com duas pastas (camadas)")
kml = os.path.join(TMP, "requerente.kml")
s84 = osr.SpatialReference()
s84.ImportFromEPSG(4326)
s84.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
s_utm = osr.SpatialReference()
s_utm.ImportFromEPSG(31984)
s_utm.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
tr = osr.CoordinateTransformation(s_utm, s84)
ds = ogr.GetDriverByName("KML").CreateDataSource(kml)
for nome, wkt in [("Gleba norte", "POLYGON((360000 7797050,360100 7797050,360100 7797100,360000 7797100,360000 7797050))"),
                  ("Gleba sul", "POLYGON((360000 7797000,360100 7797000,360100 7797050,360000 7797050,360000 7797000))")]:
    lyr_k = ds.CreateLayer(nome, s84, ogr.wkbPolygon)
    ft = ogr.Feature(lyr_k.GetLayerDefn())
    g = ogr.CreateGeometryFromWkt(wkt)
    g.Transform(tr)
    ft.SetGeometry(g)
    lyr_k.CreateFeature(ft)
ds = None
kmz = os.path.join(TMP, "requerente.kmz")
with zipfile.ZipFile(kmz, "w") as z:
    z.write(kml, "doc.kml")
res, ach, html, dt = rodar("kmz", ARQUIVO_AREA=kmz)
uc = achado(ach, 1)
conferir(len(uc) == 1 and perto(f(uc[0]["pct_gleba"]), 50, 0.2), "KMZ reprojetado: UC ~50%% (obtido %s)"
         % (uc[0]["pct_gleba"] if uc else "-"))
conferir("2 camadas" in html, "As duas pastas do KMZ foram lidas e unidas")

# ---------------------------------------------------------------------------
print("\n[4] Poligono invalido (gravata-borboleta)")
lyr_b = camada_memoria(["POLYGON((360000 7797000,360100 7797100,360100 7797000,360000 7797100,360000 7797000))"])
res, ach, html, dt = rodar("gravata", AREA=lyr_b.id())
conferir("makeValid" in html, "Correcao automatica registrada na ficha")
conferir(perto(sum(f(a["area_m2"]) for a in achado(ach, 6)), 5000, 1), "Area corrigida = 5.000 m2 (dois triangulos)")

# ---------------------------------------------------------------------------
print("\n[5] Somente feicoes selecionadas")
lyr_s = camada_memoria([G1, "POLYGON((365000 7797000,365100 7797000,365100 7797100,365000 7797100,365000 7797000))"])
lyr_s.selectByIds([2])  # so a gleba distante
res, ach, html, dt = rodar("selecao", AREA=QgsProcessingFeatureSourceDefinition(lyr_s.id(), selectedFeaturesOnly=True))
conferir(not achado(ach, 1) and not achado(ach, 2), "So a feicao selecionada (longe de tudo) foi analisada")
conferir("fora da cobertura do raster" in html, "Raster sem cobertura na area vira 'nao avaliada', com motivo")
conferir("Nenhuma restrição (impeditiva" in html or not [a for a in ach if a["severidade"] in ("IMPEDITIVO", "RESTRITIVO")],
         "Sem restricoes fortes na area distante")

# ---------------------------------------------------------------------------
print("\n[6] Uma ficha por feicao")
lyr_2 = camada_memoria([G1, "POLYGON((360200 7797000,360250 7797000,360250 7797050,360200 7797050,360200 7797000))"])
res, ach, html, dt = rodar("por_feicao", AREA=lyr_2.id(), UMA_FICHA_POR_FEICAO=True)
htmls = sorted(x for x in os.listdir(os.path.join(TMP, "por_feicao")) if x.endswith(".html"))
conferir(len(htmls) == 2, "Duas fichas geradas (%s)" % ", ".join(htmls))

# ---------------------------------------------------------------------------
print("\n[7] Area concava (centroide fora)")
lyr_u = camada_memoria(["POLYGON((360000 7797000,360100 7797000,360100 7797100,360080 7797100,360080 7797020,"
                        "360020 7797020,360020 7797100,360000 7797100,360000 7797000))"])
res, ach, html, dt = rodar("concava", AREA=lyr_u.id())
conferir("centróide cai fora" in html, "Aviso de centroide fora da area + ponto interno")

# ---------------------------------------------------------------------------
print("\n[8] Linha (estrada) -> buffer de 50 m")
lyr_l = camada_memoria(["LINESTRING(360000 7797050,360100 7797050)"], tipo="LineString")
res, ach, html, dt = rodar("linha", AREA=lyr_l.id())
conferir("tipo: linha" in html and "Entrada do tipo linha: aplicado buffer de 50 m" in html,
         "Entrada linear reconhecida e com buffer de 50 m")
conferir(len(achado(ach, 1)) == 1, "Buffer da linha encosta na UC")

# ---------------------------------------------------------------------------
print("\n[9] Nenhuma area informada -> mensagem clara")
try:
    processing.run(ALG, {"GPKG": GPKG, "PASTA_SAIDA": os.path.join(TMP, "vazio"), "INTERSECOES": "TEMPORARY_OUTPUT",
                         "ABRIR_FICHA": False})
    conferir(False, "Deveria recusar sem area")
except Exception as e:
    conferir("Informe a área" in str(e), "Erro claro sem area: %s" % str(e).splitlines()[0][:80])

# ---------------------------------------------------------------------------
print("\n[10] GeoPackage sem _regras_triagem -> mensagem clara")
ruim = os.path.join(TMP, "ruim.gpkg")
d = ogr.GetDriverByName("GPKG").CreateDataSource(ruim)
d.CreateLayer("qualquer", geom_type=ogr.wkbNone)
d = None
try:
    processing.run(ALG, {"GPKG": ruim, "AREA": lyr.id(), "PASTA_SAIDA": os.path.join(TMP, "ruim"),
                         "INTERSECOES": "TEMPORARY_OUTPUT", "ABRIR_FICHA": False})
    conferir(False, "Deveria recusar GPKG sem regras")
except Exception as e:
    conferir("_regras_triagem" in str(e), "Erro claro: %s" % str(e).splitlines()[0][:80])

print("\nTempos: " + ", ".join("%s %.2fs" % t for t in TEMPOS))
print("Arquivos de teste em: %s" % TMP)
print("\nRESULTADO: %s" % ("TODOS OS TESTES PASSARAM" if not FALHAS else "%d FALHA(S)" % len(FALHAS)))
for x in FALHAS:
    print("  - " + x)
if os.environ.get("MANTER_TESTE") != "1":
    shutil.rmtree(TMP, ignore_errors=True)
QgsProject.instance().removeAllMapLayers()
app.exitQgis()
sys.exit(1 if FALHAS else 0)
