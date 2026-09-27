# -*- coding: utf-8 -*-
"""
Gera dados SINTETICOS para testar coletar_bases_fundao.py com o servidor falso.

Nada aqui e dado real: o "municipio" e um retangulo ficticio perto de Fundao,
os nomes sao inventados e nenhum atributo pessoal existe.

Cria em <destino>:
  servidor/   arvore servida pelo servidor_falso.py (+ regras.json)
  pc/BACKUP/  simula ...\\BACKUP_REDE_PMF_SEMAM_17_08_2026 (KML do limite, shp local)
  pc/G3M/     simula ...\\G3M_AMBIENTAL\\BASE_DE_DADOS (dois zips "grandes")

Devolve o dicionario de redirecionamentos host real -> caminho no servidor.
"""

import json
import os
import shutil
import zipfile

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()

# "Fundao" sintetico (lon/lat SIRGAS 2000) e vizinhos
FUNDAO = (-40.45, -20.05, -40.20, -19.85)
ARACRUZ = (-40.45, -19.85, -40.20, -19.70)
SERRA = (-40.45, -20.20, -40.20, -20.05)
LONGE = (-41.60, -18.60, -41.50, -18.50)   # fora da area de recorte

REDIRECIONAR = {
    "https://storage.googleapis.com": "/gcs",
    "https://brasil.mapbiomas.org": "/mapbiomas_site",
    "https://geo.fbds.org.br": "/fbds",
    "http://geo.fbds.org.br": "/fbds_http_inexistente",
    "https://www.geo.fbds.org.br": "/fbds_www_inexistente",
    "https://rigeo.sgb.gov.br": "/rigeo",
    "https://geoportal.sgb.gov.br": "/sgb_geoportal",
    "https://ide.geobases.es.gov.br": "/geobases",
    "https://geoservicos.ibge.gov.br": "/ibge_wfs",
    "https://geoftp.ibge.gov.br": "/geoftp",
    "https://www.gov.br/mma": "/mma_gov",
    "http://antigo.mma.gov.br": "/mma_antigo",
    "https://certificacao.incra.gov.br": "/incra",
    "https://dadosabertos.anm.gov.br": "/anm",
    "https://geo.anm.gov.br": "/anm_geo",
    "https://portal1.snirh.gov.br": "/snirh_portal",
    "https://metadados.snirh.gov.br": "/snirh_meta",
}


def srs(epsg):
    s = osr.SpatialReference()
    s.ImportFromEPSG(epsg)
    s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return s


def ret(x0, y0, x1, y1):
    return "POLYGON((%r %r,%r %r,%r %r,%r %r,%r %r))" % (x0, y0, x1, y0, x1, y1, x0, y1, x0, y0)


def para_utm(wkt):
    g = ogr.CreateGeometryFromWkt(wkt)
    g.AssignSpatialReference(srs(4674))
    g.TransformTo(srs(31984))
    return g.ExportToWkt()


def vetor(caminho, feicoes, epsg=4674, driver=None, campos=None, camada=None, opcoes=None, tipo=ogr.wkbUnknown):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    driver = driver or {".shp": "ESRI Shapefile", ".gpkg": "GPKG", ".geojson": "GeoJSON", ".gdb": "OpenFileGDB",
                        ".kml": "KML"}[os.path.splitext(caminho)[1].lower()]
    ds = ogr.GetDriverByName(driver).CreateDataSource(caminho)
    lyr = ds.CreateLayer(camada or os.path.splitext(os.path.basename(caminho))[0], srs(epsg), tipo, options=opcoes or [])
    campos = campos or sorted({k for _, a in feicoes for k in a})
    for c in campos:
        exemplo = next((a[c] for _, a in feicoes if c in a), "")
        lyr.CreateField(ogr.FieldDefn(c, ogr.OFTInteger if isinstance(exemplo, int) else
                                      ogr.OFTReal if isinstance(exemplo, float) else ogr.OFTString))
    for wkt, attrs in feicoes:
        f = ogr.Feature(lyr.GetLayerDefn())
        f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        for k, v in attrs.items():
            f.SetField(k, v)
        lyr.CreateFeature(f)
    ds = None


def zipar(zip_destino, arquivos, base):
    os.makedirs(os.path.dirname(zip_destino), exist_ok=True)
    with zipfile.ZipFile(zip_destino, "w", zipfile.ZIP_DEFLATED) as z:
        for a in arquivos:
            if os.path.isdir(a):
                for r, _, fs in os.walk(a):
                    for f in fs:
                        z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), base))
            else:
                z.write(a, os.path.relpath(a, base))


def shp_zipado(zip_destino, nome, feicoes, epsg=4674, tmp=None, pasta_interna=""):
    d = os.path.join(tmp, os.path.basename(zip_destino) + "_tmp", pasta_interna)
    vetor(os.path.join(d, nome + ".shp"), feicoes, epsg)
    zipar(zip_destino, [os.path.join(tmp, os.path.basename(zip_destino) + "_tmp")],
          os.path.join(tmp, os.path.basename(zip_destino) + "_tmp"))


def geojson(caminho, feicoes):
    fc = {"type": "FeatureCollection", "crs": {"type": "name", "properties": {"name": "EPSG:4674"}}, "features": []}
    for wkt, attrs in feicoes:
        g = ogr.CreateGeometryFromWkt(wkt)
        fc["features"].append({"type": "Feature", "properties": attrs, "geometry": json.loads(g.ExportToJson())})
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as fh:
        json.dump(fc, fh)


def grade(bbox, n, prefixo):
    """n x n celulas dentro do bbox (poligonos pequenos)."""
    x0, y0, x1, y1 = bbox
    dx, dy = (x1 - x0) / n, (y1 - y0) / n
    return [(ret(x0 + i * dx, y0 + j * dy, x0 + (i + 1) * dx, y0 + (j + 1) * dy), {"cod": "%s-%03d-%03d" % (prefixo, i, j)})
            for i in range(n) for j in range(n)]


def raster_mapbiomas(caminho, ano):
    """GeoTIFF Byte em EPSG:4326, LZW, blocado (como o nacional), mas pequeno."""
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    x0, y1, px = -41.0, -19.4, 0.0027
    n = 444
    ds = gdal.GetDriverByName("GTiff").Create(caminho, n, n, 1, gdal.GDT_Byte,
                                              ["COMPRESS=LZW", "TILED=YES", "BLOCKXSIZE=256", "BLOCKYSIZE=256"])
    ds.SetGeoTransform((x0, px, 0, y1, 0, -px))
    ds.SetProjection(srs(4326).ExportToWkt())
    arr = np.full((n, n), 15, dtype=np.uint8)
    corte = int(n * (ano - 1980) / 60.0)          # floresta avanca com o ano (arquivos diferentes)
    arr[:, :corte] = 3
    arr[200:260, 200:260] = 24
    arr[:10, :] = 0
    ds.GetRasterBand(1).WriteArray(arr)
    ds = None


def gerar(destino):
    if os.path.exists(destino):
        shutil.rmtree(destino)
    srv = os.path.join(destino, "servidor")
    tmp = os.path.join(destino, "_tmp")
    dados = os.path.join(srv, "dados")
    os.makedirs(tmp)
    regras = {"falhar_n_vezes": {}, "cortar_na_primeira": {}, "lento": {}, "codigo_fixo": {}, "html_200": {},
              "exigir_navegador_e_cookie": {}, "dar_cookie": {}, "servicos_arcgis": {}, "wfs": {}}
    dentro = ret(-40.40, -20.00, -40.30, -19.90)
    na_borda = ret(-40.22, -19.95, -40.10, -19.90)     # corta a borda leste da area
    fora = ret(*LONGE)

    # ---------------------------------------------------------------- 1 MapBiomas
    gcs = os.path.join(srv, "gcs", "mapbiomas-public")
    for ano in range(1985, 1997):
        raster_mapbiomas(os.path.join(gcs, "initiatives/brasil/collection11/lulc/coverage/brazil_coverage/"
                                           "brazil_coverage-col11_%d.tif" % ano), ano)
        raster_mapbiomas(os.path.join(gcs, "initiatives/brasil/collection_71/lulc/coverage/brazil_coverage_%d.tif" % ano), ano)
    for ano in range(1985, 1995):
        raster_mapbiomas(os.path.join(gcs, "initiatives/brasil/collection_10/lulc/coverage/brazil_coverage_%d.tif" % ano), ano)
    raster_mapbiomas(os.path.join(gcs, "initiatives/brazil/lulc/collection_11/coverage/coverage-brazil_classification_1997.tif"), 1997)
    pag = os.path.join(srv, "mapbiomas_site", "downloads", "codigos-de-legenda")
    os.makedirs(pag)
    url_csv = "https://brasil.mapbiomas.org/wp-content/uploads/sites/3/2026/08/legend_code_mapbiomas_brazil_collection_11.csv"
    with open(os.path.join(pag, "index.html"), "w", encoding="utf-8") as fh:
        fh.write('<html><body><table><tr><td>Cobertura - Códigos de legenda para uso no R ou Python</td>'
                 '<td><a href="%s">Baixar</a></td></tr></table></body></html>' % url_csv)
    leg = os.path.join(srv, "mapbiomas_site", "wp-content/uploads/sites/3/2026/08")
    os.makedirs(leg)
    with open(os.path.join(leg, "legend_code_mapbiomas_brazil_collection_11.csv"), "w", encoding="utf-8") as fh:
        fh.write("class_id,class_name_pt_br,class_name_en,hex_code\n3,Formação Florestal,Forest Formation,#1f8d49\n"
                 "15,Pastagem,Pasture,#edde8e\n24,Área Urbanizada,Urban Area,#d4271e\n")

    # ---------------------------------------------------------------- 2 FBDS (arquivos soltos, listagem h5ai)
    fb = os.path.join(srv, "fbds", "ES", "FUNDAO")
    vetor(os.path.join(fb, "APP", "ES_3202207_APP.shp"), [(dentro, {"HIDRO": "rio sintetico"}), (fora, {"HIDRO": "longe"})])
    vetor(os.path.join(fb, "APP", "ES_3202207_APP_USO.shp"), [(dentro, {"CLASSE_USO": "formacao florestal"})])
    vetor(os.path.join(fb, "USO", "ES_3202207_USO.shp"), [(dentro, {"CLASSE_USO": "area antropizada"}),
                                                           (na_borda, {"CLASSE_USO": "agua"})])
    vetor(os.path.join(fb, "HIDROGRAFIA", "ES_3202207_NASCENTES.shp"), [("POINT(-40.35 -19.95)", {"ID": 1}),
                                                                         ("POINT(-41.55 -18.55)", {"ID": 2})])
    vetor(os.path.join(fb, "HIDROGRAFIA", "ES_3202207_RIOS_SIMPLES.shp"),
          [("LINESTRING(-40.50 -19.95,-40.10 -19.95)", {"COMP_KM": 40.0})])
    vetor(os.path.join(fb, "HIDROGRAFIA", "ES_3202207_RIOS_DUPLOS.shp"), [(dentro, {"AREA_HA": 1.5})])
    vetor(os.path.join(fb, "HIDROGRAFIA", "ES_3202207_MASSAS_DAGUA.shp"), [(dentro, {"NATUREZA": "lagoa", "RIO": "x"})])
    regras["falhar_n_vezes"][r"ES_3202207_USO\.dbf$"] = 2          # 2 x 503, passa na 3a tentativa
    regras["cortar_na_primeira"][r"ES_3202207_APP\.shp$"] = 60     # conexao cai no meio -> retomada com Range

    # ---------------------------------------------------------------- 3 SGB
    idx = os.path.join(srv, "rigeo", "jspui", "handle", "doc", "18319")
    os.makedirs(idx)
    with open(os.path.join(idx, "index.html"), "w", encoding="utf-8") as fh:
        fh.write('<html><body><a href="/jspui/bitstream/doc/18319/3/mapa_geologico_aracruz.pdf">PDF</a>'
                 '<a href="/jspui/bitstream/doc/18319/4/sig_aracruz.zip">sig_aracruz.zip</a></body></html>')
    shp_zipado(os.path.join(srv, "rigeo", "jspui", "bitstream", "doc", "18319", "4", "sig_aracruz.zip"), "geologia_aracruz",
               [(dentro, {"SIGLA": "NP3sg", "LITOTIPOS": "granito sintetico"})], tmp=tmp, pasta_interna="SIG")
    idx = os.path.join(srv, "rigeo", "handle", "doc", "18379")   # so a pagina sem 'jspui' existe
    os.makedirs(idx)
    with open(os.path.join(idx, "index.html"), "w", encoding="utf-8") as fh:
        fh.write('<html><body><a href="https://rigeo.sgb.gov.br/bitstream/doc/18379/2/sig_vitoria_vr.zip">SIG</a></body></html>')
    shp_zipado(os.path.join(srv, "rigeo", "bitstream", "doc", "18379", "2", "sig_vitoria_vr.zip"), "geologia_vitoria",
               [(ret(-40.40, -20.06, -40.30, -20.02), {"SIGLA": "Q2a", "LITOTIPOS": "areia sintetica"})], tmp=tmp)
    geojson(os.path.join(dados, "sgb_es_400k.geojson"),
            grade((-40.46, -20.06, -40.19, -19.84), 48, "SGB") + [(fora, {"cod": "longe"})])   # 2.304 dentro -> 3 paginas
    regras["servicos_arcgis"][r"/sgb_geoportal/server/rest/services/geologia/litoestratigrafia_estados/MapServer"] = {
        "meta": {"layers": [{"id": 2, "name": "Rio de Janeiro - 1:400.000 [2018]"},
                            {"id": 3, "name": "Espírito Santo - 1:400.000 [2020]"}]},
        "dados": {"3": "dados/sgb_es_400k.geojson"}, "max_registros": 1000}

    # ---------------------------------------------------------------- 4 IBGE
    geojson(os.path.join(dados, "vege.geojson"), [(dentro, {"legenda": "Floresta Ombrofila (sint.)"}), (fora, {"legenda": "x"})])
    regras["wfs"]["/ibge_wfs/geoserver/ows"] = {"BDIA:vege_area": "dados/vege.geojson"}
    base_ped = os.path.join(srv, "geoftp", "informacoes_ambientais", "pedologia", "vetores", "escala_250_mil")
    shp_zipado(os.path.join(base_ped, "versao_2023", "pedo_area.zip"), "pedo_area", [(dentro, {"versao": 2023})], tmp=tmp)
    shp_zipado(os.path.join(base_ped, "versao_2025", "pedo_area.zip"), "pedo_area", [(dentro, {"versao": 2025}), (fora, {"versao": 2025})], tmp=tmp)
    base_geo = os.path.join(srv, "geoftp", "informacoes_ambientais", "geologia", "levantamento_geologico", "vetores", "escala_250_mil")
    shp_zipado(os.path.join(base_geo, "versao_2023", "geol_area.zip"), "geol_area", [(dentro, {"sigla": "A"})], tmp=tmp)
    geojson(os.path.join(dados, "geomorf_es.geojson"), [(dentro, {"nm_unidade": "Tabuleiros (sint.)"})])
    regras["wfs"]["/geobases/geoserver/ows"] = {"geonode:ibge_geomorfologia_es_2023_bff_1km_epsg_31984": "dados/geomorf_es.geojson"}
    malhas = os.path.join(srv, "geoftp", "organizacao_do_territorio", "malhas_territoriais", "malhas_municipais")
    municipios = [(ret(*FUNDAO), {"NM_MUN": "Fundão (sintético)", "CD_MUN": "3202207"}),
                  (ret(*ARACRUZ), {"NM_MUN": "Aracruz (sintético)", "CD_MUN": "0000001"}),
                  (ret(*SERRA), {"NM_MUN": "Serra (sintético)", "CD_MUN": "0000002"}), (fora, {"NM_MUN": "Longe", "CD_MUN": "0"})]
    shp_zipado(os.path.join(malhas, "municipio_2024", "UFs", "ES", "ES_Municipios_2024.zip"), "ES_Municipios_2024", municipios, tmp=tmp)
    shp_zipado(os.path.join(malhas, "municipio_2025", "UFs", "ES", "ES_Municipios_2025.zip"), "ES_Municipios_2025", municipios, tmp=tmp)
    loc = os.path.join(srv, "geoftp", "organizacao_do_territorio", "estrutura_territorial", "localidades", "Localidades_do_Brasil", "2022")
    vetor(os.path.join(tmp, "loc", "BR_Localidades_2022.gpkg"), [("POINT(-40.40 -19.93)", {"NM_LOCALID": "Sede (sint.)"}),
                                                                  ("POINT(-41.55 -18.55)", {"NM_LOCALID": "Longe"})])
    zipar(os.path.join(loc, "Localidades_Brasil_gpkg.zip"), [os.path.join(tmp, "loc")], os.path.join(tmp, "loc"))
    regras["html_200"][r"^/mma_gov/"] = "<html><body>Pagina nao encontrada (o servidor devolveu HTML com 200)</body></html>"
    shp_zipado(os.path.join(srv, "mma_antigo", "estruturas", "202", "_arquivos",
                            "shape_mata_atlantica_ibge_5milhoes_policonica_sirgas2000shp_202.zip"),
               "lei_11428", [(ret(-41.5, -21.5, -39.0, -18.0), {"nome": "Mata Atlantica (sint.)"})], tmp=tmp)
    # o PDF do mapa da lei nao existe no servidor falso -> este item deve FALHAR sem parar os outros

    # ---------------------------------------------------------------- 5 INCRA
    zi = os.path.join(srv, "incra", "csv_shp", "zip")
    d = os.path.join(tmp, "sigef")
    vetor(os.path.join(d, "Sigef Brasil_ES.shp"), [(dentro, {"nome_area": "Fazenda São João (sint.)", "status": "CERTIFICADA"}),
                                                    (fora, {"nome_area": "Longe", "status": "X"})],
          opcoes=["ENCODING=ISO-8859-1"])
    for ext in (".cpg",):
        if os.path.exists(os.path.join(d, "Sigef Brasil_ES" + ext)):
            os.remove(os.path.join(d, "Sigef Brasil_ES" + ext))   # shapefile antigo sem .cpg
    zipar(os.path.join(zi, "Sigef Brasil_ES.zip"), [d], d)
    shp_zipado(os.path.join(zi, "Assentamento Brasil.zip"), "Assentamento_Brasil",
               [(dentro, {"nome_proje": "PA Sintetico"}), (fora, {"nome_proje": "PA Longe"})], tmp=tmp)
    shp_zipado(os.path.join(zi, "Áreas de Quilombolas.zip"), "quilombolas", [(dentro, {"nome": "x"})], tmp=tmp)
    regras["lento"][r"Quilombolas\.zip$"] = 5          # mais lento que o timeout do teste -> 3 tentativas -> espelho
    geojson(os.path.join(dados, "snci_priv.geojson"), [(dentro, {"nome_imove": "Imovel SNCI (sint.)"})])
    geojson(os.path.join(dados, "snci_pub.geojson"), [(fora, {"nome_imove": "Longe"})])
    geojson(os.path.join(dados, "quilombolas.geojson"), [(na_borda, {"nome": "Comunidade (sint.)"})])
    regras["wfs"]["/geobases/geoserver/ows"].update({
        "geonode:incra_snci_privado_es_31984": "dados/snci_priv.geojson",
        "geonode:incra_snci_publico_es_31984": "dados/snci_pub.geojson",
        "geonode:incra_quilombolas_es_31984": "dados/quilombolas.geojson"})

    # ---------------------------------------------------------------- 6 ANM (exige navegador + cookie do indice)
    anm = os.path.join(srv, "anm", "SIGMINE", "PROCESSOS_MINERARIOS")
    shp_zipado(os.path.join(anm, "ES.zip"), "ES", [(dentro, {"PROCESSO": "000000/2099", "FASE": "sintetica"}),
                                                   (fora, {"PROCESSO": "999999/2099", "FASE": "longe"})], tmp=tmp)
    regras["exigir_navegador_e_cookie"][r"/anm/SIGMINE/PROCESSOS_MINERARIOS/ES\.zip$"] = True
    regras["dar_cookie"][r"/anm/SIGMINE/PROCESSOS_MINERARIOS/$"] = "sessao=ok; Path=/"

    # ---------------------------------------------------------------- 7 ANA
    geojson(os.path.join(dados, "bho_trechos.geojson"),
            [("LINESTRING(-40.44 -19.90,-40.21 -19.90)", {"cotrecho": 1, "noriocomp": "Rio Sintetico"}),
             ("LINESTRING(-41.55 -18.55,-41.52 -18.52)", {"cotrecho": 2, "noriocomp": "Longe"})])
    regras["servicos_arcgis"][r"/snirh_portal/server/rest/services/Hosted/main_geoft_bho6_trecho_drenagem/FeatureServer"] = {
        "meta": {"layers": [{"id": 0, "name": "trecho"}]}, "dados": {"0": "dados/bho_trechos.geojson"}}
    regras["servicos_arcgis"][r"/snirh_portal/server/rest/services/Hosted"] = {
        "meta": {"services": [{"name": "Hosted/main_geoft_bho6_trecho_drenagem", "type": "FeatureServer"}]}}
    uuid = "32e309da-a8c1-443f-90ac-0cd79ce6a33d"
    rec = os.path.join(srv, "snirh_meta", "geonetwork", "srv", "api", "records", uuid, "formatters")
    os.makedirs(rec)
    with open(os.path.join(rec, "xml"), "w", encoding="utf-8") as fh:
        fh.write('<gmd:MD_Metadata><gmd:URL>https://metadados.snirh.gov.br/files/%s/geoft_bho_area_drenagem.gpkg</gmd:URL>'
                 '<gmd:URL>https://metadados.snirh.gov.br/files/%s/geoft_bho_trecho_drenagem.gpkg</gmd:URL></gmd:MD_Metadata>'
                 % (uuid, uuid))
    vetor(os.path.join(srv, "snirh_meta", "files", uuid, "geoft_bho_area_drenagem.gpkg"),
          grade((-40.60, -20.20, -40.00, -19.70), 30, "OTTO") + [(fora, {"cod": "longe"})], camada="geoft_bho_area_drenagem")

    # ---------------------------------------------------------------- PC simulado
    pc = os.path.join(destino, "pc")
    base = os.path.join(pc, "BACKUP")
    g3m = os.path.join(pc, "G3M")
    os.makedirs(g3m)
    vetor(os.path.join(base, "09_Limite_Municipal_IDAF.kml"),
          [(ret(*ARACRUZ), {"Name": "Aracruz"}), (ret(*FUNDAO), {"Name": "Fundão"}), (ret(*SERRA), {"Name": "Serra"})],
          epsg=4326, campos=["Name"], camada="Municipios")
    vetor(os.path.join(base, "QGis", "Uso do solo", "uso_solo_2007_2008_01.shp"),
          [(para_utm(dentro), {"CLASSE": "Café", "AREA_HA": 12.5}), (para_utm(fora), {"CLASSE": "Longe", "AREA_HA": 1.0})],
          epsg=31984, opcoes=["ENCODING=ISO-8859-1"])
    os.remove(os.path.join(base, "QGis", "Uso do solo", "uso_solo_2007_2008_01.cpg"))
    d = os.path.join(tmp, "map_es")
    vetor(os.path.join(d, "MAP_ES", "uso_cobertura_2012_2015.shp"),
          [(para_utm(dentro), {"CLASSE": "Mata nativa", "ANO": 2015}), (para_utm(na_borda), {"CLASSE": "Pasto", "ANO": 2015})], epsg=31984)
    r = gdal.GetDriverByName("GTiff").Create(os.path.join(tmp, "declividade.tif"), 300, 300, 1, gdal.GDT_Byte, ["COMPRESS=LZW"])
    r.SetGeoTransform((-40.6, 0.002, 0, -19.7, 0, -0.002))
    r.SetProjection(srs(4674).ExportToWkt())
    r.GetRasterBand(1).WriteArray(np.arange(300 * 300, dtype=np.uint32).reshape(300, 300).astype(np.uint8))
    r = None
    with zipfile.ZipFile(os.path.join(d, "rasters.zip"), "w") as z:
        z.write(os.path.join(tmp, "declividade.tif"), "declividade.tif")
    zipar(os.path.join(g3m, "MAP_ES_2012_2015_USO_COBERTURA_VEGETAL_2012-2015.zip"), [d], d)
    d = os.path.join(tmp, "orto")
    vetor(os.path.join(d, "USO_SOLO_ES.gdb"), [(para_utm(dentro), {"USO": "Eucalipto"}), (para_utm(fora), {"USO": "Longe"})],
          epsg=31984, camada="uso_solo_2007_2008", tipo=ogr.wkbPolygon)
    # ortofoto georreferenciada SO por .tfw + .prj (sem georreferencia interna), como mosaicos antigos
    orto = os.path.join(d, "ORTO")
    os.makedirs(orto)
    r = gdal.GetDriverByName("GTiff").Create(os.path.join(orto, "mosaico.tif"), 200, 200, 3, gdal.GDT_Byte,
                                             ["PROFILE=BASELINE"])
    for i in range(3):
        r.GetRasterBand(i + 1).WriteArray(np.full((200, 200), 60 * (i + 1), dtype=np.uint8))
    r = None
    for extra in os.listdir(orto):
        if extra.endswith(".aux.xml"):
            os.remove(os.path.join(orto, extra))
    x0, y0 = 355000.0, 7798000.0          # canto superior esquerdo em EPSG:31984, dentro de Fundao
    with open(os.path.join(orto, "mosaico.tfw"), "w") as fh:
        fh.write("10.0\n0.0\n0.0\n-10.0\n%.1f\n%.1f\n" % (x0 + 5, y0 - 5))
    with open(os.path.join(orto, "mosaico.prj"), "w") as fh:
        fh.write(srs(31984).ExportToWkt())
    zipar(os.path.join(g3m, "ORTOFOTOMOSAICO_ES_2007_2008_USO_DO_SOLO.zip"), [d], d)

    with open(os.path.join(srv, "regras.json"), "w", encoding="utf-8") as fh:
        json.dump(regras, fh, ensure_ascii=False, indent=1)
    shutil.rmtree(tmp)
    return {"servidor": srv, "base": base, "g3m": g3m, "redirecionar": REDIRECIONAR}


if __name__ == "__main__":
    import sys
    print(json.dumps(gerar(sys.argv[1] if len(sys.argv) > 1 else "dados_teste"), indent=1))
