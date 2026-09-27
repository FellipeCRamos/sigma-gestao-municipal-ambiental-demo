# -*- coding: utf-8 -*-
"""
Triagem Locacional SEMAM - script de Processing do QGIS (3.34+)

O analista escolhe a area (feicoes selecionadas de uma camada, poligono
desenhado numa camada temporaria, arquivo KML/KMZ do requerente ou WKT) e
recebe a ficha de restricoes lida do SIG_FUNDAO_SEMAM.gpkg.

NENHUMA camada e fixa neste codigo: o que e consultado, como e com qual
severidade vem da tabela _regras_triagem do GeoPackage; fonte, data e
confiabilidade vem de _catalogo.

Saidas: ficha HTML autocontida (abre offline), ficha PDF, CSV dos achados e
camada temporaria com as intersecoes.

Instalar: Caixa de Ferramentas de Processamento -> icone de Python ->
"Adicionar script a Caixa de Ferramentas..." -> escolher este arquivo.
Aparece em Scripts -> SEMAM Fundao -> Triagem Locacional SEMAM.
"""

import csv
import html
import math
import os
import re
import time
from datetime import datetime

from qgis.PyQt.QtCore import QCoreApplication, QUrl, QByteArray, QMarginsF
from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsFeatureRequest,
    QgsFeatureSink,
    QgsField,
    QgsFields,
    QgsGeometry,
    QgsProcessing,
    QgsProcessingAlgorithm,
    QgsProcessingException,
    QgsProcessingFeatureSource,
    QgsProcessingOutputFile,
    QgsProcessingParameterBoolean,
    QgsProcessingParameterFeatureSink,
    QgsProcessingParameterFeatureSource,
    QgsProcessingParameterFile,
    QgsProcessingParameterFolderDestination,
    QgsProcessingParameterGeometry,
    QgsProcessingParameterNumber,
    QgsRectangle,
    QgsVectorLayer,
    QgsWkbTypes,
)

try:  # QVariant some no Qt6; QgsField aceita QMetaType a partir do 3.38
    from qgis.PyQt.QtCore import QVariant
    _TXT, _REAL, _INT = QVariant.String, QVariant.Double, QVariant.Int
except ImportError:  # pragma: no cover
    from qgis.PyQt.QtCore import QMetaType
    _TXT, _REAL, _INT = QMetaType.QString, QMetaType.Double, QMetaType.Int

# =============================================================================
# Constantes de apresentacao (nao sao camadas: so textos e ordem)
# =============================================================================

EPSG_TRABALHO = "EPSG:31984"          # SIRGAS 2000 / UTM 24S (contrato do GPKG)
EPSG_GEOGRAFICO = "EPSG:4674"         # SIRGAS 2000 geografico, para lat/long
AVISO_FIXO = "Triagem é indício, não decisão — confirmar em vistoria e no processo (e-Docs)"

SEVERIDADES = ["IMPEDITIVO", "RESTRITIVO", "CONDICIONANTE", "INFORMATIVO"]
CORES_SEVERIDADE = {
    "IMPEDITIVO": "#b3261e",
    "RESTRITIVO": "#d9730d",
    "CONDICIONANTE": "#b8930b",
    "INFORMATIVO": "#3465a4",
}

COLUNAS_REGRAS = ["id", "camada", "rotulo", "tipo", "campo_classe", "filtro_sql", "raio_m",
                  "severidade", "base_legal", "orientacao"]
COLUNAS_CATALOGO = ["camada", "titulo", "fonte", "data_ref", "escala", "confiabilidade", "limitacao"]
TIPOS_REGRA = ("sobrepoe", "distancia", "raster_classes")

# Secoes do cabecalho da ficha. Se _regras_triagem tiver a coluna opcional
# "secao_ficha" (distrito | zona_pdm | atos_semam) ela manda; senao a secao
# e deduzida do ROTULO das regras INFORMATIVO por estas expressoes.
SECOES_POR_ROTULO = [
    ("distrito", r"distrit"),
    ("zona_pdm", r"\bpdm\b|zonea|\bzona"),
    ("atos_semam", r"\batos?\b|process|licen[cç]|autoriza|anu[eê]nc|dispens"),
]

AREA_MINIMA_M2 = 0.01    # abaixo disto um toque de borda nao conta como sobreposicao
MAX_CLASSES_CONTEXTO = 12  # na ficha; o CSV sempre traz todas

CAMPOS_ACHADO = [
    "regra_id", "camada", "titulo", "rotulo", "tipo", "classe", "area_m2", "pct_gleba",
    "comprimento_m", "n_feicoes", "distancia_m", "severidade", "base_legal", "orientacao",
    "fonte", "data_ref", "escala", "confiabilidade", "limitacao",
]


def _tr(texto):
    return QCoreApplication.translate("TriagemLocacionalSemam", texto)


# =============================================================================
# Leitura do GeoPackage
# =============================================================================

def _valor(feicao, campo):
    """Valor de um campo como tipo Python simples (NULL -> None)."""
    if campo not in feicao.fields().names():
        return None
    v = feicao[campo]
    if v is None:
        return None
    if hasattr(v, "isNull") and v.isNull():
        return None
    return v


def _texto(v):
    return "" if v is None else str(v).strip()


def ler_tabela(gpkg, tabela, colunas_obrigatorias):
    camada = QgsVectorLayer("%s|layername=%s" % (gpkg, tabela), tabela, "ogr")
    if not camada.isValid():
        raise QgsProcessingException(
            "O GeoPackage não tem a tabela '%s' (contrato do SIG_FUNDAO_SEMAM.gpkg)." % tabela)
    faltam = [c for c in colunas_obrigatorias if c not in camada.fields().names()]
    if faltam:
        raise QgsProcessingException(
            "A tabela '%s' não tem as colunas: %s" % (tabela, ", ".join(faltam)))
    return [{n: _valor(f, n) for n in camada.fields().names()} for f in camada.getFeatures()]


def ler_regras(gpkg):
    regras = []
    for r in ler_tabela(gpkg, "_regras_triagem", COLUNAS_REGRAS):
        r = dict(r)
        r["tipo"] = _texto(r.get("tipo")).lower()
        sev = _texto(r.get("severidade")).upper()
        r["severidade_original"] = sev
        r["severidade"] = sev if sev in SEVERIDADES else "INFORMATIVO"
        try:
            r["raio_m"] = float(r["raio_m"]) if r.get("raio_m") not in (None, "") else 0.0
        except (TypeError, ValueError):
            r["raio_m"] = None
        regras.append(r)
    regras.sort(key=lambda r: (SEVERIDADES.index(r["severidade"]), str(r.get("id"))))
    return regras


def ler_catalogo(gpkg):
    try:
        linhas = ler_tabela(gpkg, "_catalogo", COLUNAS_CATALOGO)
    except QgsProcessingException:
        return {}
    return {_texto(l["camada"]): l for l in linhas}


def secao_da_regra(regra):
    secao = _texto(regra.get("secao_ficha")).lower()
    if secao in ("distrito", "zona_pdm", "atos_semam"):
        return secao
    if regra["severidade"] != "INFORMATIVO":
        return ""
    rotulo = _texto(regra.get("rotulo")).lower()
    for nome, padrao in SECOES_POR_ROTULO:
        if re.search(padrao, rotulo):
            return nome
    return ""


# =============================================================================
# Preparacao da area (gleba)
# =============================================================================

def _so_poligonos(geom):
    """Depois do makeValid podem sobrar linhas/pontos soltos: fica so a parte de area."""
    if geom is None or geom.isEmpty():
        return QgsGeometry()
    if geom.type() == QgsWkbTypes.PolygonGeometry:
        return geom
    partes = [p for p in geom.asGeometryCollection() if p.type() == QgsWkbTypes.PolygonGeometry]
    return QgsGeometry.collectGeometry(partes) if partes else QgsGeometry()


def preparar_geometria(geom, crs_origem, contexto_transf, buffer_m, notas):
    """Reprojeta para EPSG:31984, tira Z/M, corrige (makeValid) e aplica o
    buffer em ponto/linha. Devolve (geometria_poligonal, tipo_original)."""
    if geom is None or geom.isEmpty():
        return QgsGeometry(), None
    g = QgsGeometry(geom)
    destino = QgsCoordinateReferenceSystem(EPSG_TRABALHO)
    if crs_origem.isValid() and crs_origem != destino:
        g.transform(QgsCoordinateTransform(crs_origem, destino, contexto_transf))
    elif not crs_origem.isValid():
        notas.add("Entrada sem SRC definido: assumido %s." % EPSG_TRABALHO)
    abstrata = g.constGet().clone()
    abstrata.dropZValue()
    abstrata.dropMValue()
    g = QgsGeometry(abstrata)
    tipo = g.type()
    if tipo == QgsWkbTypes.PolygonGeometry:
        if not g.isGeosValid():
            notas.add("Geometria de entrada inválida corrigida automaticamente (makeValid).")
        g = _so_poligonos(g.makeValid())
        return g, "polígono"
    if tipo in (QgsWkbTypes.PointGeometry, QgsWkbTypes.LineGeometry):
        rotulo = "ponto" if tipo == QgsWkbTypes.PointGeometry else "linha"
        notas.add("Entrada do tipo %s: aplicado buffer de %g m." % (rotulo, buffer_m))
        g = _so_poligonos(g.makeValid().buffer(buffer_m, 16).makeValid())
        return g, rotulo
    return QgsGeometry(), None


def _geometrias_de_arquivo(caminho, notas):
    """Le todas as camadas de um KML/KMZ/GeoJSON/SHP/GPKG do requerente."""
    from osgeo import ogr  # vem com o QGIS
    saida = []
    try:
        ds = ogr.Open(caminho)
    except RuntimeError:
        ds = None
    if ds is None:
        raise QgsProcessingException("Não consegui abrir o arquivo da área: %s" % caminho)
    nomes = [ds.GetLayerByIndex(i).GetName() for i in range(ds.GetLayerCount())]
    ds = None
    for nome in nomes:
        camada = QgsVectorLayer("%s|layername=%s" % (caminho, nome), nome, "ogr")
        if not camada.isValid():
            continue
        for f in camada.getFeatures():
            if f.hasGeometry():
                saida.append((f.geometry(), camada.crs()))
    if not saida:
        raise QgsProcessingException("O arquivo %s não tem nenhuma geometria." % caminho)
    if len(nomes) > 1:
        notas.add("Arquivo com %d camadas: todas foram lidas." % len(nomes))
    return saida


# =============================================================================
# Avaliacao das regras
# =============================================================================

class CacheCamadas:
    """Abre cada camada (com seu filtro) uma unica vez por execucao."""

    def __init__(self, gpkg):
        self.gpkg = gpkg
        self.pasta = os.path.dirname(os.path.abspath(gpkg))
        self._vetores = {}

    def vetor(self, camada, filtro):
        chave = (camada, filtro or "")
        if chave not in self._vetores:
            lyr = QgsVectorLayer("%s|layername=%s" % (self.gpkg, camada), camada, "ogr")
            if not lyr.isValid():
                self._vetores[chave] = (None, "camada '%s' não existe no GeoPackage" % camada)
            elif filtro and (not self._filtro_valido(camada, filtro) or not lyr.setSubsetString(filtro)):
                self._vetores[chave] = (None, "filtro_sql inválido para '%s': %s" % (camada, filtro))
            else:
                self._vetores[chave] = (lyr, "")
        return self._vetores[chave]

    def _filtro_valido(self, camada, filtro):
        """O QGIS aceita um filtro quebrado sem reclamar e a consulta depois
        volta vazia - o que viraria um falso 'sem achado'. Por isso o filtro
        e testado direto no GeoPackage."""
        from osgeo import ogr
        try:
            ds = ogr.Open(self.gpkg)
            if ds is None:
                return False
            sql = 'SELECT 1 FROM "%s" WHERE %s LIMIT 1' % (camada.replace('"', '""'), filtro)
            try:
                res = ds.ExecuteSQL(sql)
            except RuntimeError:
                return False
            if res is None:
                return False
            ds.ReleaseResultSet(res)
            return True
        except Exception:
            return False

    def caminho_raster(self, camada):
        c = _texto(camada)
        if re.search(r"\.(tif|tiff|vrt|img)$", c, re.I) or "/" in c or "\\" in c:
            caminho = c if os.path.isabs(c) else os.path.join(self.pasta, c.replace("\\", "/"))
            return os.path.normpath(caminho)
        return "GPKG:%s:%s" % (self.gpkg, c)


def _transf_para(crs_camada, contexto_transf):
    trabalho = QgsCoordinateReferenceSystem(EPSG_TRABALHO)
    if not crs_camada.isValid() or crs_camada == trabalho:
        return None, None
    ida = QgsCoordinateTransform(trabalho, crs_camada, contexto_transf)
    volta = QgsCoordinateTransform(crs_camada, trabalho, contexto_transf)
    return ida, volta


def _classe(feicao, campo_classe, rotulo):
    if campo_classe:
        v = _valor(feicao, campo_classe)
        return _texto(v) or "(sem valor)"
    return rotulo


def avaliar_vetor(regra, gleba, cache, contexto_transf):
    """Regras 'sobrepoe' e 'distancia'. Devolve (grupos_por_classe, erro)."""
    camada, erro = cache.vetor(_texto(regra["camada"]), _texto(regra.get("filtro_sql")))
    if camada is None:
        return {}, erro
    campo_classe = _texto(regra.get("campo_classe"))
    if campo_classe and camada.fields().indexOf(campo_classe) < 0:
        return {}, "campo_classe '%s' não existe na camada '%s'" % (campo_classe, regra["camada"])
    raio = regra["raio_m"] if regra["tipo"] == "distancia" else 0.0
    if raio is None or raio < 0:
        return {}, "raio_m inválido"

    ida, volta = _transf_para(camada.crs(), contexto_transf)
    busca = QgsGeometry(gleba)
    area_busca = gleba.buffer(raio, 16) if raio > 0 else QgsGeometry(gleba)
    retangulo = area_busca.boundingBox()
    if ida is not None:
        busca_rect = QgsGeometry.fromRect(retangulo)
        busca_rect.transform(ida)
        retangulo = busca_rect.boundingBox()

    pedido = QgsFeatureRequest().setFilterRect(retangulo)
    if campo_classe:
        pedido.setSubsetOfAttributes([campo_classe], camada.fields())
    else:
        pedido.setNoAttributes()

    motor = QgsGeometry.createGeometryEngine(busca.constGet())
    motor.prepareGeometry()
    grupos = {}
    area_gleba = gleba.area()
    provedor = camada.dataProvider()
    if provedor.hasErrors():
        provedor.clearErrors()
    for f in camada.getFeatures(pedido):
        if not f.hasGeometry():
            continue
        g = QgsGeometry(f.geometry())
        if volta is not None:
            g.transform(volta)
        if not g.isGeosValid():
            g = g.makeValid()
        classe = _classe(f, campo_classe, _texto(regra["rotulo"]))

        if regra["tipo"] == "sobrepoe":
            if not motor.intersects(g.constGet()):
                continue
            inter = gleba.intersection(g)
            if inter.isEmpty():
                continue
            grupo = grupos.setdefault(classe, {"geoms": [], "n": 0, "dist": 0.0, "comprimento": 0.0,
                                               "pontos": 0})
            tipo_g = g.type()
            if tipo_g == QgsWkbTypes.PolygonGeometry:
                if inter.area() < AREA_MINIMA_M2:
                    continue
                grupo["geoms"].append(inter)
            elif tipo_g == QgsWkbTypes.LineGeometry:
                grupo["comprimento"] += inter.length()
                grupo["geoms"].append(inter)
            else:
                grupo["pontos"] += 1
                grupo["geoms"].append(inter)
            grupo["n"] += 1
        else:  # distancia
            d = gleba.distance(g)
            if d > raio:
                continue
            grupo = grupos.setdefault(classe, {"geoms": [], "n": 0, "dist": d, "comprimento": 0.0,
                                               "pontos": 0})
            grupo["dist"] = min(grupo["dist"], d)
            grupo["n"] += 1
            parte = g.intersection(area_busca)
            grupo["geoms"].append(parte if not parte.isEmpty() else g)

    if provedor.hasErrors():
        erros = "; ".join(provedor.errors()[:2])
        provedor.clearErrors()
        return {}, "a consulta à camada falhou (%s)" % erros

    resultado = {}
    for classe, grupo in grupos.items():
        if not grupo["n"]:
            continue
        uniao = QgsGeometry.unaryUnion(grupo["geoms"]) if grupo["geoms"] else QgsGeometry()
        area = uniao.area() if (not uniao.isEmpty() and uniao.type() == QgsWkbTypes.PolygonGeometry
                                and regra["tipo"] == "sobrepoe") else 0.0
        resultado[classe] = {
            "geometria": uniao,
            "area_m2": area,
            "pct_gleba": (100.0 * area / area_gleba) if area_gleba > 0 else 0.0,
            "comprimento_m": grupo["comprimento"],
            "n_feicoes": grupo["n"],
            "distancia_m": grupo["dist"] if regra["tipo"] == "distancia" else 0.0,
        }
    return resultado, ""


def _codigos_do_filtro(filtro):
    """'3,4,5' | 'valor IN (3,4)' | 'classe = 3' -> {3,4,5}. Vazio -> None (todas)."""
    if not _texto(filtro):
        return None
    return {int(n) for n in re.findall(r"-?\d+", filtro)}


def _legenda_raster(regra, cache, banda):
    """Nome (e cor) das classes: tabela do GPKG indicada em campo_classe, CSV
    ao lado do raster (<raster>.csv ou <raster>.legenda.csv), tabela de
    atributos/categorias do proprio raster, nesta ordem."""
    legenda = {}
    tabela = _texto(regra.get("campo_classe"))
    if tabela:
        lyr = QgsVectorLayer("%s|layername=%s" % (cache.gpkg, tabela), tabela, "ogr")
        if lyr.isValid():
            nomes = [n.lower() for n in lyr.fields().names()]
            reais = lyr.fields().names()
            col_cod = next((reais[i] for i, n in enumerate(nomes) if n in ("codigo", "valor", "code", "value", "id_classe")), None)
            col_nome = next((reais[i] for i, n in enumerate(nomes) if n in ("classe", "nome", "name", "descricao")), None)
            if col_cod and col_nome:
                for f in lyr.getFeatures():
                    try:
                        legenda[int(f[col_cod])] = _texto(f[col_nome])
                    except (TypeError, ValueError):
                        pass
                return legenda
    caminho = cache.caminho_raster(regra["camada"])
    if not caminho.startswith("GPKG:"):
        base = os.path.splitext(caminho)[0]
        for csv_legenda in (base + ".csv", caminho + ".legenda.csv", base + ".legenda.csv"):
            if os.path.exists(csv_legenda):
                with open(csv_legenda, encoding="utf-8-sig") as fh:
                    amostra = fh.read(2048)
                    fh.seek(0)
                    sep = ";" if amostra.count(";") >= amostra.count(",") else ","
                    for linha in csv.DictReader(fh, delimiter=sep):
                        chaves = {k.lower().strip(): v for k, v in linha.items() if k}
                        cod = chaves.get("codigo") or chaves.get("valor") or chaves.get("code")
                        nome = chaves.get("classe") or chaves.get("nome") or chaves.get("name")
                        try:
                            legenda[int(float(cod))] = _texto(nome)
                        except (TypeError, ValueError):
                            pass
                return legenda
    rat = banda.GetDefaultRAT()
    if rat is not None and rat.GetRowCount() > 0:
        from osgeo import gdal
        col_val = col_nome = None
        for i in range(rat.GetColumnCount()):
            uso = rat.GetUsageOfCol(i)
            if uso in (gdal.GFU_MinMax, gdal.GFU_Min) and col_val is None:
                col_val = i
            elif uso == gdal.GFU_Name and col_nome is None:
                col_nome = i
        if col_val is not None and col_nome is not None:
            for linha in range(rat.GetRowCount()):
                legenda[rat.GetValueAsInt(linha, col_val)] = rat.GetValueAsString(linha, col_nome)
            return legenda
    categorias = banda.GetCategoryNames()
    if categorias:
        return {i: n for i, n in enumerate(categorias) if n}
    return legenda


def _driver_vetor_memoria():
    from osgeo import ogr
    return ogr.GetDriverByName("MEM") or ogr.GetDriverByName("Memory")


def avaliar_raster(regra, gleba, cache):
    """Regra 'raster_classes': percentual de cada classe do raster dentro da gleba."""
    from osgeo import gdal, ogr, osr
    import numpy as np

    caminho = cache.caminho_raster(regra["camada"])
    if not caminho.startswith("GPKG:") and not os.path.exists(caminho):
        return {}, "raster não encontrado: %s" % caminho
    try:
        ds = gdal.Open(caminho)
    except RuntimeError as e:
        ds = None
        erro_abertura = str(e).splitlines()[0]
    else:
        erro_abertura = ""
    if ds is None:
        return {}, "não consegui abrir o raster %s %s" % (caminho, erro_abertura)
    banda = ds.GetRasterBand(1)
    nodata = banda.GetNoDataValue()
    gt = ds.GetGeoTransform()
    srs_raster = osr.SpatialReference()
    if ds.GetProjection():
        srs_raster.ImportFromWkt(ds.GetProjection())
    else:
        srs_raster.ImportFromEPSG(31984)
    srs_raster.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs_trab = osr.SpatialReference()
    srs_trab.ImportFromEPSG(31984)
    srs_trab.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    geom_ogr = ogr.CreateGeometryFromWkb(bytes(gleba.asWkb()))
    geom_ogr.AssignSpatialReference(srs_trab)
    if not srs_raster.IsSame(srs_trab):
        geom_ogr.TransformTo(srs_raster)
    minx, maxx, miny, maxy = geom_ogr.GetEnvelope()

    # janela de pixels que cobre a gleba (recortada aos limites do raster)
    x0 = int(math.floor((minx - gt[0]) / gt[1]))
    x1 = int(math.ceil((maxx - gt[0]) / gt[1]))
    y0 = int(math.floor((maxy - gt[3]) / gt[5]))
    y1 = int(math.ceil((miny - gt[3]) / gt[5]))
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, ds.RasterXSize), min(y1, ds.RasterYSize)
    if x1 <= x0 or y1 <= y0:
        return {}, "a área está fora da cobertura do raster"
    largura, altura = x1 - x0, y1 - y0
    dados = banda.ReadAsArray(x0, y0, largura, altura)
    gt_janela = (gt[0] + x0 * gt[1], gt[1], 0.0, gt[3] + y0 * gt[5], 0.0, gt[5])

    def mascarar(todos_tocados):
        mem = gdal.GetDriverByName("MEM").Create("", largura, altura, 1, gdal.GDT_Byte)
        mem.SetGeoTransform(gt_janela)
        mem.SetProjection(srs_raster.ExportToWkt())
        ds_vet = _driver_vetor_memoria().CreateDataSource("")
        lyr = ds_vet.CreateLayer("g", srs_raster, ogr.wkbMultiPolygon)
        f = ogr.Feature(lyr.GetLayerDefn())
        f.SetGeometry(geom_ogr)
        lyr.CreateFeature(f)
        gdal.RasterizeLayer(mem, [1], lyr, burn_values=[1],
                            options=["ALL_TOUCHED=TRUE"] if todos_tocados else [])
        return mem.GetRasterBand(1).ReadAsArray().astype(bool)

    mascara = mascarar(False)
    if not mascara.any():  # gleba menor que um pixel
        mascara = mascarar(True)
    validos = mascara.copy()
    if nodata is not None:
        validos &= dados != nodata
    total = int(validos.sum())
    if total == 0:
        return {}, "sem pixels válidos do raster dentro da área"

    codigos, contagens = np.unique(dados[validos], return_counts=True)
    filtro = _codigos_do_filtro(regra.get("filtro_sql"))
    legenda = _legenda_raster(regra, cache, banda)
    area_gleba = gleba.area()

    # poligonos das classes (para a camada de intersecoes e o mapa da ficha)
    mem_cls = gdal.GetDriverByName("MEM").Create("", largura, altura, 2, gdal.GDT_Int32)
    mem_cls.SetGeoTransform(gt_janela)
    mem_cls.SetProjection(srs_raster.ExportToWkt())
    mem_cls.GetRasterBand(1).WriteArray(dados.astype(np.int32))
    mem_cls.GetRasterBand(2).WriteArray(validos.astype(np.int32))   # mascara
    ds_pol = _driver_vetor_memoria().CreateDataSource("")
    lyr_pol = ds_pol.CreateLayer("p", srs_raster, ogr.wkbPolygon)
    lyr_pol.CreateField(ogr.FieldDefn("v", ogr.OFTInteger))
    gdal.Polygonize(mem_cls.GetRasterBand(1), mem_cls.GetRasterBand(2), lyr_pol, 0, [])
    geoms_por_classe = {}
    transf = None if srs_raster.IsSame(srs_trab) else osr.CoordinateTransformation(srs_raster, srs_trab)
    for f in lyr_pol:
        g = f.GetGeometryRef().Clone()
        if transf is not None:
            g.Transform(transf)
        geoms_por_classe.setdefault(f.GetField("v"), []).append(QgsGeometry.fromWkt(g.ExportToWkt()))

    resultado = {}
    for codigo, n in zip(codigos.tolist(), contagens.tolist()):
        if filtro is not None and codigo not in filtro:
            continue
        nome = legenda.get(int(codigo), "")
        classe = "%s (%d)" % (nome, codigo) if nome else "classe %d" % codigo
        pct = 100.0 * n / total
        uniao = QgsGeometry.unaryUnion(geoms_por_classe.get(codigo, []))
        if not uniao.isEmpty():
            uniao = uniao.intersection(gleba)
        resultado[classe] = {
            "geometria": uniao,
            "area_m2": pct / 100.0 * area_gleba,
            "pct_gleba": pct,
            "comprimento_m": 0.0,
            "n_feicoes": int(n),
            "distancia_m": 0.0,
        }
    return resultado, ""


def avaliar_regras(regras, catalogo, gleba, cache, contexto_transf, feedback=None):
    achados, nao_avaliadas, sem_achado = [], [], []
    for i, regra in enumerate(regras):
        if feedback is not None:
            if feedback.isCanceled():
                break
            feedback.setProgress(10 + 80.0 * i / max(len(regras), 1))
        camada = _texto(regra.get("camada"))
        if regra["tipo"] not in TIPOS_REGRA:
            nao_avaliadas.append((regra, "tipo '%s' desconhecido" % regra["tipo"]))
            continue
        if not camada:
            nao_avaliadas.append((regra, "regra sem camada"))
            continue
        try:
            if regra["tipo"] == "raster_classes":
                grupos, erro = avaliar_raster(regra, gleba, cache)
            else:
                grupos, erro = avaliar_vetor(regra, gleba, cache, contexto_transf)
        except Exception as e:  # uma regra com problema nao derruba a triagem
            grupos, erro = {}, "erro ao avaliar: %s" % str(e).splitlines()[0]
        if erro:
            nao_avaliadas.append((regra, erro))
            continue
        if regra["severidade_original"] not in SEVERIDADES:
            nao_avaliadas.append((regra, "severidade '%s' fora do contrato; tratada como INFORMATIVO"
                                  % regra["severidade_original"]))
        if not grupos:
            sem_achado.append(regra)
            continue
        cat = catalogo.get(camada, {})
        for classe, g in sorted(grupos.items(), key=lambda kv: (-kv[1]["area_m2"], kv[1]["distancia_m"], kv[0])):
            achados.append({
                "regra_id": _texto(regra.get("id")),
                "camada": camada,
                "titulo": _texto(cat.get("titulo")) or camada,
                "rotulo": _texto(regra.get("rotulo")),
                "tipo": regra["tipo"],
                "classe": classe,
                "area_m2": g["area_m2"],
                "pct_gleba": g["pct_gleba"],
                "comprimento_m": g["comprimento_m"],
                "n_feicoes": g["n_feicoes"],
                "distancia_m": g["distancia_m"],
                "severidade": regra["severidade"],
                "base_legal": _texto(regra.get("base_legal")),
                "orientacao": _texto(regra.get("orientacao")),
                "fonte": _texto(cat.get("fonte")) or "sem registro no _catalogo",
                "data_ref": _texto(cat.get("data_ref")),
                "escala": _texto(cat.get("escala")),
                "confiabilidade": _texto(cat.get("confiabilidade")),
                "limitacao": _texto(cat.get("limitacao")),
                "secao": secao_da_regra(regra),
                "raio_m": regra["raio_m"] or 0.0,
                "geometria": g["geometria"],
            })
    return achados, nao_avaliadas, sem_achado


# =============================================================================
# Ficha (HTML / PDF / CSV)
# =============================================================================

def _num(v, casas=2):
    s = "{:,.{c}f}".format(v, c=casas)
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _dms(valor, pos, neg):
    hemis = pos if valor >= 0 else neg
    valor = abs(valor)
    g = int(valor)
    m = int((valor - g) * 60)
    s = (valor - g - m / 60.0) * 3600
    return "%d°%02d'%05.2f\" %s" % (g, m, s, hemis)


def descrever_gleba(gleba, contexto_transf, notas=None):
    c = gleba.centroid()
    if notas is not None and not gleba.contains(c):
        interno = gleba.pointOnSurface().asPoint()
        notas.add("O centróide cai fora da área (forma côncava ou em partes). Ponto interno de "
                  "referência: E %s · N %s." % (_num(interno.x(), 1), _num(interno.y(), 1)))
    p = c.asPoint()
    geo = QgsGeometry(c)
    geo.transform(QgsCoordinateTransform(QgsCoordinateReferenceSystem(EPSG_TRABALHO),
                                         QgsCoordinateReferenceSystem(EPSG_GEOGRAFICO), contexto_transf))
    q = geo.asPoint()
    return {
        "area_m2": gleba.area(),
        "perimetro_m": gleba.length(),
        "e": p.x(), "n": p.y(),
        "lon": q.x(), "lat": q.y(),
    }


def _svg_mapa(gleba, achados, largura=640, altura=420):
    """Croqui esquematico (SVG) da gleba e dos achados - funciona offline."""
    geoms = [gleba] + [a["geometria"] for a in achados if a["geometria"] and not a["geometria"].isEmpty()]
    ret = QgsRectangle(gleba.boundingBox())
    for g in geoms[1:]:
        ret.combineExtentWith(g.boundingBox())
    margem = max(ret.width(), ret.height()) * 0.08 + 1.0
    ret.grow(margem)
    esc = min((largura - 20) / max(ret.width(), 1e-9), (altura - 40) / max(ret.height(), 1e-9))
    ox = 10 + ((largura - 20) - ret.width() * esc) / 2.0
    oy = 10 + ((altura - 40) - ret.height() * esc) / 2.0
    tolerancia = 1.0 / esc  # simplifica o que for menor que 1 px

    def xy(pt):
        return "%.1f,%.1f" % (ox + (pt.x() - ret.xMinimum()) * esc, oy + (ret.yMaximum() - pt.y()) * esc)

    def caminho(g):
        g = g.simplify(tolerancia) if g.type() != QgsWkbTypes.PointGeometry else g
        partes = []
        if g.type() == QgsWkbTypes.PolygonGeometry:
            polis = g.asMultiPolygon() if g.isMultipart() else [g.asPolygon()]
            for poli in polis:
                for anel in poli:
                    if anel:
                        partes.append("M" + " L".join(xy(p) for p in anel) + " Z")
        elif g.type() == QgsWkbTypes.LineGeometry:
            linhas = g.asMultiPolyline() if g.isMultipart() else [g.asPolyline()]
            for linha in linhas:
                if linha:
                    partes.append("M" + " L".join(xy(p) for p in linha))
        return " ".join(partes)

    elementos = []
    for a in sorted(achados, key=lambda a: -SEVERIDADES.index(a["severidade"])):
        g = a["geometria"]
        if g is None or g.isEmpty():
            continue
        cor = CORES_SEVERIDADE[a["severidade"]]
        titulo = html.escape("%s - %s (%s)" % (a["rotulo"], a["classe"], a["severidade"]))
        if g.type() == QgsWkbTypes.PointGeometry:
            pts = g.asMultiPoint() if g.isMultipart() else [g.asPoint()]
            for p in pts:
                cx, cy = xy(p).split(",")
                elementos.append('<circle cx="%s" cy="%s" r="4" fill="%s" stroke="#222" stroke-width="0.6">'
                                 '<title>%s</title></circle>' % (cx, cy, cor, titulo))
        elif g.type() == QgsWkbTypes.LineGeometry:
            elementos.append('<path d="%s" fill="none" stroke="%s" stroke-width="2.2"><title>%s</title></path>'
                             % (caminho(g), cor, titulo))
        else:
            elementos.append('<path d="%s" fill="%s" fill-opacity="0.38" stroke="%s" stroke-width="0.8" '
                             'fill-rule="evenodd"><title>%s</title></path>' % (caminho(g), cor, cor, titulo))
    elementos.append('<path d="%s" fill="none" stroke="#111" stroke-width="2.4" stroke-dasharray="6 3">'
                     '<title>Área em análise</title></path>' % caminho(gleba))

    # barra de escala (valor redondo ~ 1/4 da largura)
    alvo = ret.width() / 4.0
    potencia = 10 ** math.floor(math.log10(max(alvo, 1e-9)))
    passo = max(p for p in (1, 2, 5, 10) if p * potencia <= alvo * 1.0001) * potencia
    px = passo * esc
    y_barra = altura - 16
    km = passo / 1000.0
    rotulo_escala = ("%s km" % _num(km, 0 if km == int(km) else 1)) if passo >= 1000 else ("%d m" % passo)
    elementos.append('<rect x="12" y="%d" width="%.1f" height="5" fill="#111"/>' % (y_barra, px))
    elementos.append('<text x="12" y="%d" font-size="11" font-family="sans-serif">%s</text>'
                     % (y_barra - 4, rotulo_escala))
    elementos.append('<g transform="translate(%d,24)"><path d="M0,-14 L6,6 L0,2 L-6,6 Z" fill="#111"/>'
                     '<text x="-4" y="20" font-size="11" font-family="sans-serif">N</text></g>' % (largura - 22))
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
            'role="img" aria-label="Croqui da área e dos achados">'
            '<rect width="100%%" height="100%%" fill="#fbfbf8" stroke="#ccc"/>%s</svg>'
            % (largura, altura, largura, altura, "".join(elementos)))


def _resumo_contexto(grupo):
    itens = grupo["itens"]
    textos = []
    for a in itens[:MAX_CLASSES_CONTEXTO]:
        textos.append("%s: %s" % (a["classe"], _formatar_achado(a)))
    if len(itens) > MAX_CLASSES_CONTEXTO:
        textos.append("+ %d outra(s) — lista completa no CSV" % (len(itens) - MAX_CLASSES_CONTEXTO))
    return textos


def _formatar_achado(a):
    medidas = []
    if a["area_m2"] > 0:
        medidas.append("%s m² (%s%%)" % (_num(a["area_m2"]), _num(a["pct_gleba"], 1)))
    if a["comprimento_m"] > 0:
        medidas.append("%s m de extensão" % _num(a["comprimento_m"], 1))
    if a["tipo"] == "distancia":
        medidas.append("a %s m" % _num(a["distancia_m"], 1) if a["distancia_m"] > 0 else "encosta/sobrepõe")
    if a["tipo"] == "sobrepoe" and a["area_m2"] == 0 and a["comprimento_m"] == 0:
        medidas.append("%d feição(ões) dentro" % a["n_feicoes"])
    return "; ".join(medidas) or "-"


def montar_contexto(gleba, info, achados, nao_avaliadas, sem_achado, entrada, notas, gpkg, catalogo):
    principais = [a for a in achados if not a["secao"]]
    secoes = {s: [a for a in achados if a["secao"] == s] for s in ("distrito", "zona_pdm", "atos_semam")}
    contagem = {s: sum(1 for a in principais if a["severidade"] == s) for s in SEVERIDADES}
    restritivos = [a for a in principais if a["severidade"] != "INFORMATIVO"]
    contexto = []
    for a in principais:
        if a["severidade"] != "INFORMATIVO":
            continue
        if not contexto or contexto[-1]["regra_id"] != a["regra_id"]:
            contexto.append({"regra_id": a["regra_id"], "titulo": a["titulo"], "rotulo": a["rotulo"],
                             "fonte": a["fonte"], "data_ref": a["data_ref"], "itens": []})
        contexto[-1]["itens"].append(a)
    return {
        "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "analista": os.environ.get("USERNAME") or os.environ.get("USER") or "",
        "gpkg": os.path.basename(gpkg),
        "gpkg_data": datetime.fromtimestamp(os.path.getmtime(gpkg)).strftime("%d/%m/%Y %H:%M"),
        "entrada": entrada,
        "notas": sorted(notas),
        "info": info,
        "principais": principais,
        "restritivos": restritivos,
        "contexto": contexto,
        "secoes": secoes,
        "contagem": contagem,
        "nao_avaliadas": nao_avaliadas,
        "sem_achado": sem_achado,
        "catalogo": catalogo,
        "svg": _svg_mapa(gleba, [a for a in achados if a["severidade"] != "INFORMATIVO" or a["secao"] == "atos_semam"]),
    }


def _linhas_secao(lista, vazio):
    if not lista:
        return vazio
    return ", ".join(html.escape(a["classe"]) for a in lista)


def gerar_html(ctx):
    e = html.escape
    info = ctx["info"]
    css = """
    body{font-family:"Segoe UI",Arial,sans-serif;color:#1d1d1b;margin:24px auto;max-width:980px;
         padding:0 16px;font-size:14px;line-height:1.45;background:#fff}
    h1{font-size:21px;margin:0 0 2px} h2{font-size:16px;margin:26px 0 8px;border-bottom:2px solid #e3e1da;
    padding-bottom:4px} .sub{color:#5b5a55;font-size:12.5px}
    .aviso{border:2px solid #b3261e;background:#fdf1ef;color:#7a1712;padding:10px 14px;font-weight:700;
           margin:14px 0;border-radius:4px}
    table{border-collapse:collapse;width:100%;font-size:12.8px} th,td{border:1px solid #d9d7d0;
    padding:5px 7px;vertical-align:top;text-align:left} th{background:#f2f1ec}
    td.n{text-align:right;white-space:nowrap} .sev{color:#fff;font-weight:700;font-size:11.5px;
    padding:2px 6px;border-radius:3px;white-space:nowrap}
    .grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}
    .caixa{border:1px solid #e3e1da;border-radius:4px;padding:8px 10px}
    .caixa b{display:block;font-size:11.5px;color:#5b5a55;font-weight:600}
    .resumo span{margin-right:10px} .mapa{margin-top:6px} .mapa svg{max-width:100%;height:auto}
    ul{margin:4px 0;padding-left:20px} .pe{font-size:11.5px;color:#5b5a55;margin-top:26px}
    @media print{body{margin:0;max-width:none} .aviso{break-inside:avoid} tr{break-inside:avoid}}
    """
    def selo(sev):
        return '<span class="sev" style="background:%s">%s</span>' % (CORES_SEVERIDADE[sev], sev)

    partes = ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
              '<meta name="viewport" content="width=device-width,initial-scale=1">'
              '<title>Ficha de Triagem Locacional</title><style>%s</style></head><body>' % css]
    partes.append("<h1>Ficha de Triagem Locacional — SEMAM Fundão/ES</h1>")
    partes.append('<div class="sub">Gerada em %s%s · base: %s (atualizada em %s)</div>'
                  % (e(ctx["gerado_em"]), (" por " + e(ctx["analista"])) if ctx["analista"] else "",
                     e(ctx["gpkg"]), e(ctx["gpkg_data"])))
    partes.append('<div class="aviso">%s</div>' % e(AVISO_FIXO))

    partes.append("<h2>Área analisada</h2><div class='grade'>")
    for rotulo, valor_html in [
        ("Origem", e(ctx["entrada"])),
        ("Área", e("%s m² (%s ha)" % (_num(info["area_m2"]), _num(info["area_m2"] / 10000.0, 4)))),
        ("Perímetro", e("%s m" % _num(info["perimetro_m"]))),
        ("Centróide — UTM 24S (SIRGAS 2000)", e("E %s · N %s" % (_num(info["e"], 1), _num(info["n"], 1)))),
        ("Centróide — lat/long (SIRGAS 2000)", "%s<br>%s" % (
            e("%s, %s" % (_num(info["lat"], 6), _num(info["lon"], 6))),
            e("%s %s" % (_dms(info["lat"], "N", "S"), _dms(info["lon"], "L", "O"))))),
        ("Distrito", _linhas_secao(ctx["secoes"]["distrito"], "não identificado na base")),
        ("Zona do PDM", _linhas_secao(ctx["secoes"]["zona_pdm"], "não identificada na base")),
    ]:
        partes.append("<div class='caixa'><b>%s</b>%s</div>" % (e(rotulo), valor_html))
    partes.append("</div>")
    if ctx["notas"]:
        partes.append("<ul class='sub'>%s</ul>" % "".join("<li>%s</li>" % e(n) for n in ctx["notas"]))

    partes.append("<h2>Resumo</h2><div class='resumo'>")
    for sev in SEVERIDADES:
        partes.append("<span>%s %d</span>" % (selo(sev), ctx["contagem"][sev]))
    partes.append("</div>")

    partes.append("<h2>Achados que restringem</h2>")
    if ctx["restritivos"]:
        partes.append("<table><thead><tr><th>Severidade</th><th>Camada / classe</th><th>Medida</th>"
                      "<th>Base legal</th><th>Orientação</th><th>Fonte e data do dado</th></tr></thead><tbody>")
        for a in ctx["restritivos"]:
            fonte = e(a["fonte"]) + (" · " + e(a["data_ref"]) if a["data_ref"] else "")
            if a["confiabilidade"]:
                fonte += " · confiab. %s" % e(a["confiabilidade"])
            if a["escala"]:
                fonte += " · escala %s" % e(a["escala"])
            partes.append("<tr><td>%s</td><td><b>%s</b><br>%s — %s</td><td class='n'>%s</td><td>%s</td>"
                          "<td>%s</td><td>%s</td></tr>" % (
                              selo(a["severidade"]), e(a["titulo"]), e(a["rotulo"]), e(a["classe"]),
                              e(_formatar_achado(a)), e(a["base_legal"]), e(a["orientacao"]), fonte))
        partes.append("</tbody></table>")
    else:
        partes.append("<p>Nenhuma restrição (impeditiva, restritiva ou condicionante) encontrada nas "
                      "camadas consultadas.</p>")

    if ctx["contexto"]:
        partes.append("<h2>Informações de contexto</h2><table><thead><tr><th>Camada</th>"
                      "<th>O que há na área</th><th>Fonte e data do dado</th></tr></thead><tbody>")
        for g in ctx["contexto"]:
            partes.append("<tr><td><b>%s</b><br>%s</td><td>%s</td><td>%s</td></tr>" % (
                e(g["titulo"]), e(g["rotulo"]), "<br>".join(e(t) for t in _resumo_contexto(g)),
                e(g["fonte"]) + (" · " + e(g["data_ref"]) if g["data_ref"] else "")))
        partes.append("</tbody></table>")

    atos = ctx["secoes"]["atos_semam"]
    raio_atos = max([a["raio_m"] for a in atos] or [500])
    partes.append("<h2>Atos da SEMAM próximos (até %s m)</h2>" % _num(raio_atos, 0))
    if atos:
        partes.append("<table><thead><tr><th>Nº do processo / ato</th><th>Camada</th><th>Distância</th>"
                      "</tr></thead><tbody>")
        for a in sorted(atos, key=lambda a: a["distancia_m"]):
            partes.append("<tr><td>%s</td><td>%s</td><td class='n'>%s</td></tr>" % (
                e(a["classe"]), e(a["titulo"]),
                ("%s m" % _num(a["distancia_m"], 1)) if a["distancia_m"] > 0 else "sobrepõe/encosta"))
        partes.append("</tbody></table>")
    else:
        partes.append("<p>Nenhum ato registrado na base dentro do raio.</p>")

    partes.append("<h2>Croqui</h2><div class='mapa'>%s</div>" % ctx["svg"])
    legenda = " ".join(
        "<span style='white-space:nowrap;margin-right:10px'><span style='display:inline-block;width:12px;"
        "height:12px;background:%s;opacity:.7;vertical-align:-1px'></span> %s</span>" % (CORES_SEVERIDADE[s],
        "ato da SEMAM" if s == "INFORMATIVO" else s.lower()) for s in SEVERIDADES)
    partes.append("<div class='sub'>%s <span style='white-space:nowrap'>- - - área analisada</span><br>"
                  "Croqui esquemático, sem valor cartográfico; mostra só os achados que restringem e os "
                  "atos próximos.</div>" % legenda)

    if ctx["sem_achado"]:
        partes.append("<h2>Consultado, sem achado</h2><ul>")
        for r in ctx["sem_achado"]:
            partes.append("<li>%s (%s)</li>" % (e(_texto(r.get("rotulo")) or _texto(r.get("camada"))),
                                                 e(_texto(r.get("camada")))))
        partes.append("</ul>")
    if ctx["nao_avaliadas"]:
        partes.append("<h2>Regras não avaliadas — conferir a base</h2><ul>")
        for r, motivo in ctx["nao_avaliadas"]:
            partes.append("<li><b>regra %s</b> (%s): %s</li>" % (e(_texto(r.get("id"))),
                                                                  e(_texto(r.get("rotulo"))), e(motivo)))
        partes.append("</ul>")

    usadas = sorted({a["camada"] for a in ctx["principais"] + atos})  # principais inclui o contexto
    limitacoes = [(c, ctx["catalogo"].get(c, {})) for c in usadas]
    limitacoes = [(c, cat) for c, cat in limitacoes if _texto(cat.get("limitacao"))]
    if limitacoes:
        partes.append("<h2>Limitações dos dados usados</h2><ul>")
        for c, cat in limitacoes:
            partes.append("<li><b>%s</b>: %s</li>" % (e(_texto(cat.get("titulo")) or c), e(_texto(cat.get("limitacao")))))
        partes.append("</ul>")

    partes.append('<div class="aviso">%s</div>' % e(AVISO_FIXO))
    partes.append("<div class='pe'>Documento gerado pela ferramenta Triagem Locacional SEMAM (QGIS). "
                  "Não substitui parecer técnico.</div></body></html>")
    return "".join(partes)


def gerar_html_pdf(ctx):
    """Versao do HTML no subconjunto que o QTextDocument entende (sem CSS
    moderno nem SVG embutido; o croqui entra como imagem)."""
    e = html.escape
    info = ctx["info"]
    p = ["<html><body style='font-family:Arial;font-size:9pt'>"]
    p.append("<h2 style='margin:0'>Ficha de Triagem Locacional — SEMAM Fundão/ES</h2>")
    p.append("<p style='color:#555'>Gerada em %s · base %s (atualizada em %s)</p>" % (
        e(ctx["gerado_em"]), e(ctx["gpkg"]), e(ctx["gpkg_data"])))
    aviso = ("<table width='100%%' cellpadding='6' style='border:2px solid #b3261e' bgcolor='#fdf1ef'>"
             "<tr><td><b><font color='#7a1712'>%s</font></b></td></tr></table>" % e(AVISO_FIXO))
    p.append(aviso)
    p.append("<h3>Área analisada</h3><table width='100%' border='1' cellspacing='0' cellpadding='3'>")
    for rot, val in [
        ("Origem", ctx["entrada"]),
        ("Área", "%s m² (%s ha)" % (_num(info["area_m2"]), _num(info["area_m2"] / 10000.0, 4))),
        ("Perímetro", "%s m" % _num(info["perimetro_m"])),
        ("Centróide UTM 24S", "E %s · N %s" % (_num(info["e"], 1), _num(info["n"], 1))),
        ("Centróide lat/long", "%s, %s (%s %s)" % (_num(info["lat"], 6), _num(info["lon"], 6),
                                                   _dms(info["lat"], "N", "S"), _dms(info["lon"], "L", "O"))),
        ("Distrito", ", ".join(a["classe"] for a in ctx["secoes"]["distrito"]) or "não identificado na base"),
        ("Zona do PDM", ", ".join(a["classe"] for a in ctx["secoes"]["zona_pdm"]) or "não identificada na base"),
    ]:
        p.append("<tr><td width='28%%' bgcolor='#f2f1ec'><b>%s</b></td><td>%s</td></tr>" % (e(rot), e(val)))
    p.append("</table>")
    for n in ctx["notas"]:
        p.append("<p style='color:#555'>• %s</p>" % e(n))
    p.append("<h3>Resumo</h3><p>%s</p>" % " &nbsp; ".join(
        "<b><font color='%s'>%s</font></b> %d" % (CORES_SEVERIDADE[s], s, ctx["contagem"][s]) for s in SEVERIDADES))
    p.append("<h3>Achados que restringem</h3>")
    if ctx["restritivos"]:
        p.append("<table width='100%' border='1' cellspacing='0' cellpadding='3'><tr bgcolor='#f2f1ec'>"
                 "<th width='15%'>Severidade</th><th>Camada / classe</th><th>Medida</th><th>Base legal</th>"
                 "<th>Orientação</th><th>Fonte / data</th></tr>")
        for a in ctx["restritivos"]:
            p.append("<tr><td><b><font color='%s'>%s</font></b></td><td><b>%s</b><br>%s — %s</td><td>%s</td>"
                     "<td>%s</td><td>%s</td><td>%s%s</td></tr>" % (
                         CORES_SEVERIDADE[a["severidade"]], a["severidade"], e(a["titulo"]), e(a["rotulo"]),
                         e(a["classe"]), e(_formatar_achado(a)), e(a["base_legal"]), e(a["orientacao"]),
                         e(a["fonte"]), (" · " + e(a["data_ref"])) if a["data_ref"] else ""))
        p.append("</table>")
    else:
        p.append("<p>Nenhuma restrição (impeditiva, restritiva ou condicionante) encontrada.</p>")
    if ctx["contexto"]:
        p.append("<h3>Informações de contexto</h3><table width='100%' border='1' cellspacing='0' "
                 "cellpadding='3'><tr bgcolor='#f2f1ec'><th>Camada</th><th>O que há na área</th>"
                 "<th>Fonte / data</th></tr>")
        for g in ctx["contexto"]:
            p.append("<tr><td><b>%s</b></td><td>%s</td><td>%s%s</td></tr>" % (
                e(g["titulo"]), "<br>".join(e(t) for t in _resumo_contexto(g)), e(g["fonte"]),
                (" · " + e(g["data_ref"])) if g["data_ref"] else ""))
        p.append("</table>")
    atos = ctx["secoes"]["atos_semam"]
    raio_atos = max([a["raio_m"] for a in atos] or [500])
    p.append("<h3>Atos da SEMAM próximos (até %s m)</h3>" % _num(raio_atos, 0))
    if atos:
        p.append("<table width='100%' border='1' cellspacing='0' cellpadding='3'><tr bgcolor='#f2f1ec'>"
                 "<th>Nº do processo / ato</th><th>Camada</th><th>Distância</th></tr>")
        for a in sorted(atos, key=lambda a: a["distancia_m"]):
            p.append("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % (
                e(a["classe"]), e(a["titulo"]),
                ("%s m" % _num(a["distancia_m"], 1)) if a["distancia_m"] > 0 else "sobrepõe/encosta"))
        p.append("</table>")
    else:
        p.append("<p>Nenhum ato registrado na base dentro do raio.</p>")
    p.append("<h3>Croqui</h3><p><img src='croqui.png' width='560'></p><p style='color:#555'>%s · "
             "- - - área analisada · croqui esquemático, sem valor cartográfico</p>" % " · ".join(
                 "<font color='%s'>■</font> %s" % (CORES_SEVERIDADE[s], "ato da SEMAM" if s == "INFORMATIVO"
                                                  else s.lower()) for s in SEVERIDADES))
    if ctx["nao_avaliadas"]:
        p.append("<h3>Regras não avaliadas — conferir a base</h3>")
        for r, motivo in ctx["nao_avaliadas"]:
            p.append("<p>• regra %s (%s): %s</p>" % (e(_texto(r.get("id"))), e(_texto(r.get("rotulo"))), e(motivo)))
    p.append(aviso)
    p.append("</body></html>")
    return "".join(p)


def gravar_pdf(ctx, caminho_pdf):
    from qgis.PyQt.QtGui import QImage, QPainter, QPdfWriter, QPageSize, QPageLayout, QTextDocument, QFont, QColor
    from qgis.PyQt.QtSvg import QSvgRenderer

    renderizador = QSvgRenderer(QByteArray(ctx["svg"].encode("utf-8")))
    imagem = QImage(1280, 840, QImage.Format_ARGB32)
    imagem.fill(QColor("white"))
    pintor = QPainter(imagem)
    renderizador.render(pintor)
    pintor.end()

    doc = QTextDocument()
    doc.setDefaultFont(QFont("Arial", 9))
    doc.addResource(QTextDocument.ImageResource, QUrl("croqui.png"), imagem)
    doc.setHtml(gerar_html_pdf(ctx))

    escritor = QPdfWriter(caminho_pdf)
    escritor.setPageSize(QPageSize(QPageSize.A4))
    escritor.setPageMargins(QMarginsF(14, 14, 14, 14), QPageLayout.Millimeter)
    escritor.setResolution(144)
    escritor.setTitle("Ficha de Triagem Locacional")
    imprimir = getattr(doc, "print_", None) or getattr(doc, "print")
    imprimir(escritor)
    return os.path.exists(caminho_pdf) and os.path.getsize(caminho_pdf) > 0


def gravar_csv(achados, caminho):
    with open(caminho, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(CAMPOS_ACHADO + ["secao_ficha"])
        for a in achados:
            linha = []
            for c in CAMPOS_ACHADO:
                v = a[c]
                if isinstance(v, float):
                    v = ("%.2f" % v).replace(".", ",")
                linha.append(v)
            w.writerow(linha + [a["secao"]])


# =============================================================================
# Algoritmo de Processing
# =============================================================================

class TriagemLocacionalSemam(QgsProcessingAlgorithm):
    GPKG = "GPKG"
    AREA = "AREA"
    ARQUIVO = "ARQUIVO_AREA"
    GEOMETRIA = "GEOMETRIA"
    BUFFER = "BUFFER_M"
    POR_FEICAO = "UMA_FICHA_POR_FEICAO"
    GERAR_PDF = "GERAR_PDF"
    ABRIR = "ABRIR_FICHA"
    PASTA = "PASTA_SAIDA"
    INTERSECOES = "INTERSECOES"

    def createInstance(self):
        return TriagemLocacionalSemam()

    def name(self):
        return "triagem_locacional_semam"

    def displayName(self):
        return _tr("Triagem Locacional SEMAM")

    def group(self):
        return _tr("SEMAM Fundão")

    def groupId(self):
        return "semam_fundao"

    def shortHelpString(self):
        return _tr(
            "Gera a ficha de restrições de uma área a partir do SIG_FUNDAO_SEMAM.gpkg.\n\n"
            "ÁREA: use UMA das formas — (1) camada com a feição (marque 'Somente feições selecionadas' "
            "para usar a seleção; para um polígono desenhado, crie uma camada temporária, desenhe e "
            "selecione); (2) arquivo KML/KMZ/GeoJSON/SHP do requerente; (3) geometria em WKT. "
            "Qualquer SRC é aceito (é reprojetado para SIRGAS 2000 / UTM 24S). Pontos e linhas "
            "recebem buffer (padrão 50 m). Geometrias inválidas são corrigidas (makeValid).\n\n"
            "O que é consultado vem da tabela _regras_triagem do GeoPackage; fonte e data de cada "
            "dado vêm de _catalogo. Saídas: ficha HTML (abre sem internet), PDF, CSV e camada com as "
            "interseções.\n\n" + AVISO_FIXO)

    def initAlgorithm(self, config=None):
        self.addParameter(QgsProcessingParameterFile(
            self.GPKG, _tr("Base SIG_FUNDAO_SEMAM.gpkg"), behavior=QgsProcessingParameterFile.File,
            fileFilter="GeoPackage (*.gpkg)"))
        self.addParameter(QgsProcessingParameterFeatureSource(
            self.AREA, _tr("Área: camada (use 'Somente feições selecionadas' para a seleção)"),
            [QgsProcessing.TypeVectorAnyGeometry], optional=True))
        self.addParameter(QgsProcessingParameterFile(
            self.ARQUIVO, _tr("Área: arquivo do requerente (KML, KMZ, GeoJSON, SHP, GPKG)"),
            behavior=QgsProcessingParameterFile.File, optional=True,
            fileFilter="Arquivos de área (*.kml *.kmz *.geojson *.json *.shp *.gpkg);;Todos (*.*)"))
        self.addParameter(QgsProcessingParameterGeometry(
            self.GEOMETRIA, _tr("Área: geometria em WKT (opcional)"), optional=True))
        self.addParameter(QgsProcessingParameterNumber(
            self.BUFFER, _tr("Buffer para ponto/linha (m)"), QgsProcessingParameterNumber.Double,
            defaultValue=50.0, minValue=0.1))
        self.addParameter(QgsProcessingParameterBoolean(
            self.POR_FEICAO, _tr("Uma ficha por feição (desmarcado: todas as feições formam uma única área)"),
            defaultValue=False))
        self.addParameter(QgsProcessingParameterBoolean(self.GERAR_PDF, _tr("Gerar também o PDF"),
                                                        defaultValue=True))
        self.addParameter(QgsProcessingParameterBoolean(self.ABRIR, _tr("Abrir a ficha ao terminar"),
                                                        defaultValue=True))
        self.addParameter(QgsProcessingParameterFolderDestination(self.PASTA, _tr("Pasta das fichas")))
        self.addParameter(QgsProcessingParameterFeatureSink(
            self.INTERSECOES, _tr("Interseções da triagem"), QgsProcessing.TypeVectorPolygon))
        self.addOutput(QgsProcessingOutputFile("FICHA_HTML", _tr("Ficha HTML")))
        self.addOutput(QgsProcessingOutputFile("FICHA_PDF", _tr("Ficha PDF")))
        self.addOutput(QgsProcessingOutputFile("ACHADOS_CSV", _tr("Achados (CSV)")))

    # ---------------------------------------------------------------- entrada
    def _areas(self, parameters, context, buffer_m, por_feicao, notas):
        brutas, rotulos = [], []
        transf = context.transformContext()
        fonte = self.parameterAsSource(parameters, self.AREA, context)
        if fonte is not None:
            # a validade e tratada aqui (makeValid); sem esta flag o Processing
            # recusaria o poligono invalido antes de chegar na correcao
            for f in fonte.getFeatures(QgsFeatureRequest(), QgsProcessingFeatureSource.FlagSkipGeometryValidityChecks):
                if f.hasGeometry():
                    brutas.append((f.geometry(), fonte.sourceCrs()))
                    rotulos.append("feição %s de %s" % (f.id(), fonte.sourceName()))
        arquivo = self.parameterAsFile(parameters, self.ARQUIVO, context)
        if arquivo:
            for g, crs in _geometrias_de_arquivo(arquivo, notas):
                brutas.append((g, crs))
                rotulos.append("arquivo %s" % os.path.basename(arquivo))
        if parameters.get(self.GEOMETRIA):
            g = self.parameterAsGeometry(parameters, self.GEOMETRIA, context)
            if g is not None and not g.isEmpty():
                crs = self.parameterAsGeometryCrs(parameters, self.GEOMETRIA, context)
                if not crs.isValid():
                    crs = context.project().crs() if context.project() else QgsCoordinateReferenceSystem(EPSG_TRABALHO)
                brutas.append((g, crs))
                rotulos.append("geometria informada (WKT)")
        if not brutas:
            raise QgsProcessingException(
                "Informe a área: uma camada (ou feições selecionadas), um arquivo KML/KMZ ou uma geometria.")

        preparadas = []
        tipos = set()
        for (g, crs), rot in zip(brutas, rotulos):
            gp, tipo = preparar_geometria(g, crs, transf, buffer_m, notas)
            if gp.isEmpty() or gp.area() <= 0:
                notas.add("Uma feição foi ignorada por não ter área válida (%s)." % rot)
                continue
            preparadas.append((gp, rot, tipo))
            tipos.add(tipo)
        if not preparadas:
            raise QgsProcessingException("Nenhuma geometria válida na área informada.")
        if por_feicao:
            return [(g, "%s — tipo: %s" % (rot, tipo)) for g, rot, tipo in preparadas]
        uniao = QgsGeometry.unaryUnion([g for g, _, _ in preparadas]).makeValid()
        uniao = _so_poligonos(uniao)
        origens = sorted(set(r.split(" de ")[-1] if r.startswith("feição") else r for _, r, _ in preparadas))
        descricao = "%s — %d feição(ões), tipo: %s" % (", ".join(origens), len(preparadas), ", ".join(sorted(tipos)))
        return [(uniao, descricao)]

    # ---------------------------------------------------------------- execucao
    def processAlgorithm(self, parameters, context, feedback):
        inicio = time.time()
        gpkg = self.parameterAsFile(parameters, self.GPKG, context)
        if not gpkg or not os.path.exists(gpkg):
            raise QgsProcessingException("GeoPackage não encontrado: %s" % gpkg)
        buffer_m = self.parameterAsDouble(parameters, self.BUFFER, context)
        por_feicao = self.parameterAsBool(parameters, self.POR_FEICAO, context)
        pasta = self.parameterAsString(parameters, self.PASTA, context)
        os.makedirs(pasta, exist_ok=True)

        feedback.pushInfo("Lendo regras e catálogo...")
        regras = ler_regras(gpkg)
        catalogo = ler_catalogo(gpkg)
        if not regras:
            raise QgsProcessingException("A tabela _regras_triagem está vazia.")

        notas = set()
        areas = self._areas(parameters, context, buffer_m, por_feicao, notas)
        feedback.setProgress(10)

        campos = QgsFields()
        for nome, tipo in [("ficha", _INT), ("regra_id", _TXT), ("camada", _TXT), ("rotulo", _TXT),
                           ("classe", _TXT), ("severidade", _TXT), ("area_m2", _REAL), ("pct_gleba", _REAL),
                           ("comprimento_m", _REAL), ("distancia_m", _REAL), ("base_legal", _TXT),
                           ("orientacao", _TXT), ("fonte", _TXT), ("data_ref", _TXT), ("obs_geometria", _TXT)]:
            campos.append(QgsField(nome, tipo))
        sink, dest_id = self.parameterAsSink(parameters, self.INTERSECOES, context, campos,
                                             QgsWkbTypes.MultiPolygon,
                                             QgsCoordinateReferenceSystem(EPSG_TRABALHO))

        cache = CacheCamadas(gpkg)
        carimbo = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._fichas = []
        todos_achados = []
        for n, (gleba, entrada) in enumerate(areas, 1):
            if feedback.isCanceled():
                break
            achados, nao_avaliadas, sem_achado = avaliar_regras(
                regras, catalogo, gleba, cache, context.transformContext(), feedback)
            notas_ficha = set(notas)
            info = descrever_gleba(gleba, context.transformContext(), notas_ficha)
            ctx = montar_contexto(gleba, info, achados, nao_avaliadas, sem_achado, entrada,
                                  notas_ficha, gpkg, catalogo)
            sufixo = "" if len(areas) == 1 else "_%02d" % n
            base = os.path.join(pasta, "triagem_%s%s" % (carimbo, sufixo))
            with open(base + ".html", "w", encoding="utf-8") as fh:
                fh.write(gerar_html(ctx))
            gravar_csv(achados, base + ".csv")
            self._fichas.append((ctx, base))
            for a in achados:
                todos_achados.append(a)
                g = a["geometria"]
                if g is None or g.isEmpty():
                    continue
                obs = ""
                if g.type() != QgsWkbTypes.PolygonGeometry:
                    obs = "feição %s representada com buffer de 0,5 m" % (
                        "pontual" if g.type() == QgsWkbTypes.PointGeometry else "linear")
                    g = g.buffer(0.5, 8)
                g = _so_poligonos(g)
                if g.isEmpty():
                    continue
                g.convertToMultiType()
                f = QgsFeature(campos)
                f.setGeometry(g)
                f.setAttributes([n, a["regra_id"], a["camada"], a["rotulo"], a["classe"], a["severidade"],
                                 round(a["area_m2"], 2), round(a["pct_gleba"], 3), round(a["comprimento_m"], 2),
                                 round(a["distancia_m"], 2), a["base_legal"], a["orientacao"], a["fonte"],
                                 a["data_ref"], obs])
                sink.addFeature(f, QgsFeatureSink.FastInsert)
            feedback.pushInfo("Ficha %d: %d achado(s), %d regra(s) não avaliada(s)." % (
                n, len(achados), len(nao_avaliadas)))
            for r, motivo in nao_avaliadas:
                feedback.reportError("Regra %s não avaliada: %s" % (_texto(r.get("id")), motivo), False)

        self._gerar_pdf = self.parameterAsBool(parameters, self.GERAR_PDF, context)
        self._abrir = self.parameterAsBool(parameters, self.ABRIR, context)
        feedback.setProgress(95)
        feedback.pushInfo("Triagem concluída em %.1f s." % (time.time() - inicio))
        primeira = self._fichas[0][1] if self._fichas else os.path.join(pasta, "triagem_%s" % carimbo)
        return {
            self.INTERSECOES: dest_id,
            "FICHA_HTML": primeira + ".html",
            "FICHA_PDF": primeira + ".pdf" if self._gerar_pdf else "",
            "ACHADOS_CSV": primeira + ".csv",
            "N_ACHADOS": len(todos_achados),
            "TEMPO_S": round(time.time() - inicio, 2),
        }

    def postProcessAlgorithm(self, context, feedback):
        # PDF e abertura do navegador usam classes graficas do Qt: aqui roda
        # na thread principal.
        saida = {}
        for ctx, base in getattr(self, "_fichas", []):
            if getattr(self, "_gerar_pdf", False):
                try:
                    gravar_pdf(ctx, base + ".pdf")
                except Exception as e:
                    feedback.reportError("PDF não gerado: %s" % e, False)
        if getattr(self, "_abrir", False) and getattr(self, "_fichas", None):
            try:
                from qgis.utils import iface
                if iface is not None:
                    from qgis.PyQt.QtGui import QDesktopServices
                    QDesktopServices.openUrl(QUrl.fromLocalFile(self._fichas[0][1] + ".html"))
            except Exception:
                pass
        return saida
