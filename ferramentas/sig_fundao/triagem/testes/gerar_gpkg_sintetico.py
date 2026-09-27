# -*- coding: utf-8 -*-
"""
Gera um GeoPackage SINTETICO que segue o contrato do SIG_FUNDAO_SEMAM.gpkg,
para testar a Triagem Locacional sem nenhum dado real.

Todas as feicoes, nomes, processos e bases legais sao ficticios. As
coordenadas ficam num quadrado arbitrario em EPSG:31984 escolhido para que
as respostas esperadas sejam faceis de conferir a mao:

  gleba de referencia G1 = quadrado E 360000-360100, N 7797000-7797100
  (10.000 m2)

  uc_sintetica         cobre E>=360050          -> 5.000 m2 (50%)  IMPEDITIVO
  app_sintetica        cobre E<=360020 (2 poligonos sobrepostos, mesma classe)
                                                 -> 2.000 m2 (20%)  RESTRITIVO
  hidrografia          rio em E=359975           -> 25 m            CONDICIONANTE (raio 30)
  nascentes            (360130, 7797050)         -> 30 m            IMPEDITIVO (raio 50)
                       (360500, 7797050)         -> 400 m, fora do raio
  atos_semam           100 m, 350 m e 600 m      -> 2 dentro do raio de 500 m
  distritos            Alfa (E<360060) e Beta    -> os dois
  zoneamento_pdm       ZR-1 (sintetica)
  rasters/uso_sintetico.tif (10 m): classe 3 em E<360030, 15 ate 360080, 24 depois
                                                 -> 30% / 50% / 20%
  lotes_sinteticos     60.000 lotes de 20x20 m (teste de desempenho)

Uso:  python gerar_gpkg_sintetico.py <pasta_destino>
"""

import os
import sys

from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()

EPSG = 31984
G1 = (360000, 7797000, 360100, 7797100)


def srs():
    s = osr.SpatialReference()
    s.ImportFromEPSG(EPSG)
    return s


def retangulo(x0, y0, x1, y1):
    return "POLYGON((%f %f,%f %f,%f %f,%f %f,%f %f))" % (x0, y0, x1, y0, x1, y1, x0, y1, x0, y0)


def camada(ds, nome, tipo, campos, feicoes):
    lyr = ds.CreateLayer(nome, srs(), tipo)
    for c, t in campos:
        lyr.CreateField(ogr.FieldDefn(c, t))
    for wkt, valores in feicoes:
        f = ogr.Feature(lyr.GetLayerDefn())
        f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        for k, v in valores.items():
            f.SetField(k, v)
        lyr.CreateFeature(f)
    return lyr


def tabela(ds, nome, colunas, linhas):
    lyr = ds.CreateLayer(nome, geom_type=ogr.wkbNone)
    for c, t in colunas:
        lyr.CreateField(ogr.FieldDefn(c, t))
    for valores in linhas:
        f = ogr.Feature(lyr.GetLayerDefn())
        for k, v in valores.items():
            if v is not None:
                f.SetField(k, v)
        lyr.CreateFeature(f)


def gerar(pasta, com_lotes=True):
    os.makedirs(os.path.join(pasta, "rasters"), exist_ok=True)
    caminho = os.path.join(pasta, "SIG_FUNDAO_SEMAM_SINTETICO.gpkg")
    if os.path.exists(caminho):
        os.remove(caminho)
    ds = ogr.GetDriverByName("GPKG").CreateDataSource(caminho)
    T, R, I = ogr.OFTString, ogr.OFTReal, ogr.OFTInteger

    ds.StartTransaction()
    camada(ds, "uc_sintetica", ogr.wkbPolygon, [("nome", T)],
           [(retangulo(360050, 7796900, 360300, 7797300), {"nome": "Parque Natural Ficticio"})])
    camada(ds, "app_sintetica", ogr.wkbPolygon, [("tipo", T)],
           [(retangulo(359950, 7796800, 360020, 7797300), {"tipo": "APP de curso d'agua (sintetica)"}),
            (retangulo(359990, 7796950, 360020, 7797150), {"tipo": "APP de curso d'agua (sintetica)"})])
    camada(ds, "hidrografia_sintetica", ogr.wkbLineString, [("tipo", T)],
           [("LINESTRING(359975 7796800,359975 7797300)", {"tipo": "rio simples (sintetico)"}),
            ("LINESTRING(359000 7796800,359000 7797300)", {"tipo": "rio distante (sintetico)"})])
    camada(ds, "nascentes_sinteticas", ogr.wkbPoint, [("codigo", T)],
           [("POINT(360130 7797050)", {"codigo": "NASC-SINT-01"}),
            ("POINT(360500 7797050)", {"codigo": "NASC-SINT-02"})])
    camada(ds, "distritos_sinteticos", ogr.wkbPolygon, [("nome", T)],
           [(retangulo(358000, 7795000, 360060, 7799000), {"nome": "Distrito Alfa (ficticio)"}),
            (retangulo(360060, 7795000, 362000, 7799000), {"nome": "Distrito Beta (ficticio)"})])
    camada(ds, "zoneamento_pdm_sintetico", ogr.wkbPolygon, [("zona", T)],
           [(retangulo(358000, 7795000, 362000, 7799000), {"zona": "ZR-1 (sintetica)"})])
    camada(ds, "atos_semam_sinteticos", ogr.wkbPoint, [("processo", T), ("ato", T)],
           [("POINT(360200 7797050)", {"processo": "0001/2099-SINT", "ato": "LMO"}),
            ("POINT(360450 7797050)", {"processo": "0002/2099-SINT", "ato": "Dispensa"}),
            ("POINT(360700 7797050)", {"processo": "0003/2099-SINT", "ato": "AMA"})])
    if com_lotes:
        lotes = []
        for i in range(300):
            for j in range(200):
                x = 357000 + i * 20
                y = 7795000 + j * 20
                lotes.append((retangulo(x, y, x + 20, y + 20), {"inscricao": "L-%03d-%03d" % (i, j)}))
        camada(ds, "lotes_sinteticos", ogr.wkbPolygon, [("inscricao", T)], lotes)

    tabela(ds, "_legenda_uso_sintetico", [("codigo", I), ("classe", T), ("cor", T)], [
        {"codigo": 3, "classe": "Formacao florestal (sintetica)", "cor": "#1f8d49"},
        {"codigo": 15, "classe": "Pastagem (sintetica)", "cor": "#edde8e"},
        {"codigo": 24, "classe": "Area urbanizada (sintetica)", "cor": "#d4271e"},
    ])

    base = "Base legal de TESTE (sintetica)"
    regras = [
        dict(id=1, camada="uc_sintetica", rotulo="Unidade de conservacao", tipo="sobrepoe", campo_classe="nome",
             severidade="IMPEDITIVO", base_legal=base, orientacao="Orientacao de teste: nao licenciar sem anuencia do gestor."),
        dict(id=2, camada="app_sintetica", rotulo="APP", tipo="sobrepoe", campo_classe="tipo",
             severidade="RESTRITIVO", base_legal=base, orientacao="Orientacao de teste: excluir a APP da area util."),
        dict(id=3, camada="nascentes_sinteticas", rotulo="Nascente (raio 50 m)", tipo="distancia", campo_classe="codigo",
             raio_m=50, severidade="IMPEDITIVO", base_legal=base, orientacao="Orientacao de teste: verificar em vistoria."),
        dict(id=4, camada="hidrografia_sintetica", rotulo="Curso d'agua (30 m)", tipo="distancia", campo_classe="tipo",
             raio_m=30, severidade="CONDICIONANTE", base_legal=base, orientacao="Orientacao de teste: condicionante de drenagem."),
        dict(id=5, camada="rasters/uso_sintetico.tif", rotulo="Vegetacao nativa (raster)", tipo="raster_classes",
             campo_classe="_legenda_uso_sintetico", filtro_sql="3", severidade="RESTRITIVO", base_legal=base,
             orientacao="Orientacao de teste: supressao depende de autorizacao."),
        dict(id=6, camada="rasters/uso_sintetico.tif", rotulo="Uso e cobertura (raster)", tipo="raster_classes",
             campo_classe="_legenda_uso_sintetico", severidade="INFORMATIVO", base_legal="", orientacao=""),
        dict(id=7, camada="distritos_sinteticos", rotulo="Distrito", tipo="sobrepoe", campo_classe="nome",
             severidade="INFORMATIVO"),
        dict(id=8, camada="zoneamento_pdm_sintetico", rotulo="Zona do PDM", tipo="sobrepoe", campo_classe="zona",
             severidade="INFORMATIVO"),
        dict(id=9, camada="atos_semam_sinteticos", rotulo="Atos da SEMAM (processos)", tipo="distancia",
             campo_classe="processo", raio_m=500, severidade="INFORMATIVO"),
        # regras com defeito de proposito: devem aparecer em "nao avaliadas" sem derrubar a triagem
        dict(id=90, camada="camada_que_nao_existe", rotulo="Camada ausente", tipo="sobrepoe", severidade="RESTRITIVO"),
        dict(id=91, camada="app_sintetica", rotulo="Filtro quebrado", tipo="sobrepoe", filtro_sql="coluna_inexistente = 1",
             severidade="RESTRITIVO"),
        dict(id=92, camada="app_sintetica", rotulo="Tipo invalido", tipo="sobreposicao", severidade="RESTRITIVO"),
        dict(id=93, camada="uc_sintetica", rotulo="Severidade fora do contrato", tipo="sobrepoe", severidade="ALTA"),
        # regra com filtro valido: so a APP maior (ogc fid 1) deveria contar
        dict(id=10, camada="app_sintetica", rotulo="APP (so poligono 1)", tipo="sobrepoe", filtro_sql="fid = 1",
             severidade="CONDICIONANTE", base_legal=base),
    ]
    if com_lotes:
        regras.append(dict(id=11, camada="lotes_sinteticos", rotulo="Lotes (cadastro sintetico)", tipo="sobrepoe",
                           campo_classe="inscricao", severidade="INFORMATIVO"))
    colunas = [("id", I), ("camada", T), ("rotulo", T), ("tipo", T), ("campo_classe", T), ("filtro_sql", T),
               ("raio_m", R), ("severidade", T), ("base_legal", T), ("orientacao", T)]
    tabela(ds, "_regras_triagem", colunas, regras)

    cat = []
    for nome, titulo, conf in [
        ("uc_sintetica", "Unidades de conservacao (sintetico)", "A"),
        ("app_sintetica", "APP (sintetico)", "B"),
        ("nascentes_sinteticas", "Nascentes (sintetico)", "C"),
        ("hidrografia_sintetica", "Hidrografia (sintetico)", "B"),
        ("rasters/uso_sintetico.tif", "Uso e cobertura raster (sintetico)", "B"),
        ("distritos_sinteticos", "Distritos (sintetico)", "A"),
        ("zoneamento_pdm_sintetico", "Zoneamento do PDM (sintetico)", "A"),
        ("atos_semam_sinteticos", "Atos da SEMAM (sintetico)", "A"),
        ("lotes_sinteticos", "Lotes (sintetico)", "C"),
    ]:
        cat.append(dict(camada=nome, titulo=titulo, fonte="Dados sinteticos de teste - nao usar",
                        data_ref="2099-01-01", escala="1:10.000", confiabilidade=conf,
                        limitacao="Dado ficticio gerado para teste automatizado."))
    tabela(ds, "_catalogo", [(c, T) for c in ["camada", "titulo", "fonte", "data_ref", "escala",
                                               "confiabilidade", "limitacao"]], cat)
    ds.CommitTransaction()
    ds = None

    # raster de uso: 10 m, 3 classes em faixas verticais
    x0, y1, px = 359800, 7797300, 10
    largura, altura = 60, 50
    tif = os.path.join(pasta, "rasters", "uso_sintetico.tif")
    r = gdal.GetDriverByName("GTiff").Create(tif, largura, altura, 1, gdal.GDT_Byte, ["COMPRESS=LZW"])
    r.SetGeoTransform((x0, px, 0, y1, 0, -px))
    r.SetProjection(srs().ExportToWkt())
    import numpy as np
    arr = np.zeros((altura, largura), dtype=np.uint8)
    for col in range(largura):
        xc = x0 + (col + 0.5) * px
        arr[:, col] = 3 if xc < 360030 else (15 if xc < 360080 else 24)
    r.GetRasterBand(1).WriteArray(arr)
    r.GetRasterBand(1).SetNoDataValue(0)
    r = None
    return caminho


if __name__ == "__main__":
    destino = sys.argv[1] if len(sys.argv) > 1 else "saida_sintetica"
    print(gerar(destino))
