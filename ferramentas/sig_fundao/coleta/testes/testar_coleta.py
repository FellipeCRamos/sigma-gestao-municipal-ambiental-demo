# -*- coding: utf-8 -*-
"""
Testes de coletar_bases_fundao.py com SERVIDOR FALSO e dados SINTETICOS.

    python testar_coleta.py          (Linux; no Windows: python-qgis testar_coleta.py)

Roda o catalogo REAL do script: so o prefixo de cada host e trocado pelo
servidor local (--redirecionar), entao os caminhos das URLs sao os de verdade.
"""

import csv
import glob
import hashlib
import os
import re
import shutil
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.dirname(AQUI))
os.environ["COLETA_TIMEOUT_S"] = "2"
os.environ["COLETA_ESPERAS_S"] = "0.1,0.1"

from osgeo import gdal, ogr  # noqa: E402
import gerar_dados_sinteticos as gerador  # noqa: E402
from servidor_falso import ServidorFalso  # noqa: E402
import coletar_bases_fundao as coleta  # noqa: E402

gdal.UseExceptions()
FALHAS = []


def conferir(cond, msg):
    print(("  ok    " if cond else "  FALHA ") + msg)
    if not cond:
        FALHAS.append(msg)


def sha(caminho):
    with open(caminho, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def ler_log(caminho):
    with open(caminho, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh, delimiter=";"))


def final_por_item(linhas):
    """Ultimo resultado final (OK/FALHA com marca, ou PULADO) de cada item."""
    res = {}
    for l in linhas:
        m = l["mensagem"]
        if l["status"] == "PULADO" or coleta.MARCA_OK in m or coleta.MARCA_FALHA in m:
            res[l["id_item"]] = l["status"]
    return res


class _Feicao(dict):
    def GetField(self, nome):
        return self[nome]


def camadas(gpkg):
    """{camada: (epsg, extensao, [feicoes como dict])} - copia tudo e fecha o arquivo."""
    ds = ogr.Open(gpkg)
    saida = {}
    for i in range(ds.GetLayerCount()):
        lyr = ds.GetLayerByIndex(i)
        feats = [_Feicao(f.items()) for f in lyr]
        saida[lyr.GetName()] = (lyr.GetSpatialRef().GetAuthorityCode(None) if lyr.GetSpatialRef() else None,
                                lyr.GetExtent() if feats else None, feats)
    ds = None
    return saida


TMP = tempfile.mkdtemp(prefix="coleta_teste_")
info = gerador.gerar(os.path.join(TMP, "dados"))
SAIDA = os.path.join(info["base"], "50. SIG_FUNDAO", "01_brutos_pc")
LOG = os.path.join(SAIDA, "_log_coleta.csv")

with ServidorFalso(info["servidor"]) as srv:
    red = sum([["--redirecionar", "%s=%s%s" % (k, srv.url, v)] for k, v in info["redirecionar"].items()], [])
    comum = ["--base", info["base"], "--g3m", info["g3m"]] + red

    def contar(sufixo):
        return sum(1 for m, c, _ in srv.estado.pedidos if m == "GET" and c.endswith(sufixo))

    # arquivo que JA existia na pasta de saida: nao pode ser sobrescrito
    os.makedirs(os.path.join(SAIDA, "ANM"))
    with open(os.path.join(SAIDA, "ANM", "ES.zip"), "wb") as fh:
        fh.write(b"arquivo antigo do usuario")

    # ------------------------------------------------------------------ 1a execucao
    print("\n[1] Primeira execucao completa")
    rc = coleta.main(comum)
    linhas = ler_log(LOG)
    fim = final_por_item(linhas)
    conferir(rc == 1, "codigo de saida 1 (ha uma falha planejada)")
    with open(LOG, encoding="utf-8-sig") as fh:
        conferir(fh.readline().strip() == "id_item;url;http;bytes;sha256;inicio;fim;status;mensagem",
                 "cabecalho do log exatamente como o contrato")
    conferir(all(re.match(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$", l["inicio"]) and l["fim"] for l in linhas),
             "inicio/fim com data e hora de acesso em todas as linhas")
    conferir({l["status"] for l in linhas} <= {"OK", "FALHA", "PULADO"}, "status so OK/FALHA/PULADO")
    esperados_ok = {"fbds_app", "fbds_uso", "fbds_hidrografia", "sgb_geologia_100k", "sgb_geologia_es_400k",
                    "ibge_bdia_geologia", "ibge_bdia_geomorfologia", "ibge_bdia_pedologia", "ibge_bdia_vegetacao",
                    "ibge_malha_municipal_es", "ibge_localidades", "ibge_lei_11428", "incra_sigef_es", "incra_snci_es",
                    "incra_assentamentos_es", "incra_quilombolas_es", "anm_sigmine_es", "ana_bho_trechos",
                    "ana_bho_areas_contribuicao", "local_map_es_2012_2015_uso_cobertura",
                    "local_ortofotomosaico_es_2007_2008_uso_solo", "local_uso_solo_2007_2008_01",
                    "mapbiomas_c11_legenda"} | {"mapbiomas_c11_%d" % a for a in range(1985, 1998)}
    nao_ok = sorted(i for i in esperados_ok if fim.get(i) != "OK")
    conferir(not nao_ok, "todos os itens esperados OK (%d)%s" % (len(esperados_ok), (" - faltam: %s" % nao_ok) if nao_ok else ""))
    conferir(fim.get("ibge_lei_11428_mapa_pdf") == "FALHA", "item com 404 FALHOU sem parar os outros")

    # recortes: EPSG:31984, dentro da area, atributos intactos
    ds_area = ogr.Open(os.path.join(SAIDA, "_area_recorte_fundao_2km.gpkg"))
    ax0, ax1, ay0, ay1 = ds_area.GetLayer(0).GetExtent()
    ds_area = None
    fora = []
    for g in glob.glob(os.path.join(SAIDA, "recortes", "*.gpkg")):
        for nome, (epsg, ext, feats) in camadas(g).items():
            if epsg != "31984":
                fora.append("%s/%s SRC %s" % (os.path.basename(g), nome, epsg))
            if ext and (ext[0] < ax0 - 1 or ext[1] > ax1 + 1 or ext[2] < ay0 - 1 or ext[3] > ay1 + 1):
                fora.append("%s/%s fora da area" % (os.path.basename(g), nome))
    conferir(not fora, "todo recorte vetorial em EPSG:31984 e dentro de Fundao+2 km %s" % (fora or ""))
    anm = camadas(os.path.join(SAIDA, "recortes", "anm_sigmine_es.gpkg"))
    procs = [f.GetField("PROCESSO") for _, (_, _, fs) in anm.items() for f in fs]
    conferir(procs == ["000000/2099"], "ANM: so o processo dentro da area, atributo intacto (%s)" % procs)
    sigef = [f.GetField("nome_area") for _, (_, _, fs) in camadas(os.path.join(SAIDA, "recortes", "incra_sigef_es.gpkg")).items() for f in fs]
    conferir(sigef == ["Fazenda São João (sint.)"], "SIGEF: acento de shapefile Windows-1252 sem .cpg preservado (%s)" % sigef)
    uso = [f.GetField("CLASSE") for _, (_, _, fs) in camadas(os.path.join(SAIDA, "recortes", "local_uso_solo_2007_2008_01.gpkg")).items() for f in fs]
    conferir(uso == ["Café"], "Local Latin-1: 'Café' correto (%s)" % uso)
    pedo = [f.GetField("versao") for _, (_, _, fs) in camadas(os.path.join(SAIDA, "recortes", "ibge_bdia_pedologia.gpkg")).items() for f in fs]
    conferir(pedo == [2025], "BDiA pedologia: versao mais recente (2025) escolhida (%s)" % pedo)
    conferir(any("municipio_2025" in l["url"] for l in linhas if l["id_item"] == "ibge_malha_municipal_es"),
             "Malha municipal: ano mais recente (2025)")
    cam_borda = camadas(os.path.join(SAIDA, "recortes", "fbds_uso.gpkg"))
    ext_borda = [e for _, (_, e, fs) in cam_borda.items() if fs]
    conferir(ext_borda and max(e[1] for e in ext_borda) <= ax1 + 1, "Poligono na borda foi CORTADO no limite (clip)")
    sgb = camadas(os.path.join(SAIDA, "recortes", "sgb_geologia_es_400k.gpkg"))
    n_sgb = sum(len(fs) for _, (_, _, fs) in sgb.items())
    paginas = glob.glob(os.path.join(SAIDA, "SGB", "sgb_geologia_es_400k", "*_pagina_*.geojson"))
    conferir(len(paginas) == 3 and n_sgb > 2000, "ArcGIS paginado: 3 paginas guardadas, %d feicoes juntas" % n_sgb)
    conferir(os.path.exists(os.path.join(SAIDA, "recortes", "local_map_es_2012_2015_uso_cobertura.tif")),
             "Raster dentro de zip-dentro-de-zip recortado")
    usos = [f.GetField("USO") for _, (_, _, fs) in camadas(os.path.join(
        SAIDA, "recortes", "local_ortofotomosaico_es_2007_2008_uso_solo.gpkg")).items() for f in fs]
    conferir(usos == ["Eucalipto"], "FileGDB dentro de zip lido (/vsizip/) e recortado (%s)" % usos)
    orto = glob.glob(os.path.join(SAIDA, "recortes", "local_ortofotomosaico_es_2007_2008_uso_solo*.tif"))
    if orto:
        o = gdal.Open(orto[0])
        conferir("31984" in o.GetProjection() and o.RasterCount == 3 and abs(o.GetGeoTransform()[1] - 10) < 0.01,
                 "Ortofoto georreferenciada so por .tfw/.prj (dentro do zip) recortada no lugar certo")
        o = None
    else:
        conferir(False, "Ortofoto georreferenciada so por .tfw/.prj (dentro do zip) recortada")

    # MapBiomas
    urls_mb = {l["url"] for l in linhas if l["id_item"].startswith("mapbiomas_c11_1")}
    conferir(all("collection11" in u or "collection_11" in u for u in urls_mb) and len(urls_mb) == 13,
             "MapBiomas: colecao 11 (nao a 7.1 'collection_71' nem a 10), 13 anos")
    conferir(any("coverage-brazil_classification_1997" in u for u in urls_mb), "Ano so publicado no layout novo tambem veio")
    t = gdal.Open(os.path.join(SAIDA, "recortes", "mapbiomas_c11_1990.tif"))
    b = t.GetRasterBand(1)
    conferir("31984" in t.GetProjection() and t.GetMetadata("IMAGE_STRUCTURE").get("COMPRESSION") == "LZW",
             "Raster em EPSG:31984 com compressao LZW")
    conferir(abs(t.GetGeoTransform()[1] - 30) < 0.01, "Pixel de 30 m")
    rat = b.GetDefaultRAT()
    nomes_rat = {rat.GetValueAsInt(i, 0): rat.GetValueAsString(i, 1) for i in range(rat.GetRowCount())} if rat else {}
    conferir(b.GetColorTable() is not None and b.GetColorTable().GetColorEntry(3)[:3] == (31, 141, 73)
             and nomes_rat.get(3) == "Formação Florestal",
             "Tabela de cores + tabela de atributos (RAT) com a legenda OFICIAL")
    t = None
    qml = os.path.join(SAIDA, "recortes", "mapbiomas_c11_1990.qml")
    conferir(os.path.exists(qml), "Estilo .qml com o mesmo nome (o QGIS aplica sozinho)")
    TIF_QGIS = os.path.join(SAIDA, "recortes", "mapbiomas_c11_1990.tif")
    with open(os.path.join(SAIDA, "recortes", "mapbiomas_c11_legenda.csv"), encoding="utf-8-sig") as fh:
        leg = fh.read().splitlines()
    conferir(leg[0] == "codigo;classe;cor" and "3;Formação Florestal;#1f8d49" in leg, "Legenda codigo;classe;cor")
    conferir(sha(glob.glob(os.path.join(SAIDA, "MapBiomas", "colecao_11", "*.csv"))[0]) ==
             sha(os.path.join(info["servidor"], "mapbiomas_site/wp-content/uploads/sites/3/2026/08/legend_code_mapbiomas_brazil_collection_11.csv")),
             "Legenda original guardada intacta")

    # originais intactos, nunca sobrescrever
    orig = os.path.join(info["servidor"], "fbds", "ES", "FUNDAO", "APP", "ES_3202207_APP.shp")
    baixado = os.path.join(SAIDA, "FBDS", "FUNDAO", "APP", "ES_3202207_APP.shp")
    conferir(os.path.exists(baixado) and sha(baixado) == sha(orig), "Download cortado no meio foi RETOMADO e ficou identico")
    conferir(any(r and r.startswith("bytes=6") for m, c, r in srv.estado.pedidos if c.endswith("ES_3202207_APP.shp")),
             "Retomada usou Range (nao baixou de novo do zero)")
    with open(os.path.join(SAIDA, "ANM", "ES.zip"), "rb") as fh:
        conferir(fh.read() == b"arquivo antigo do usuario", "Arquivo pre-existente NAO foi sobrescrito")
    conferir(sha(os.path.join(SAIDA, "ANM", "ES (2).zip")) == sha(os.path.join(info["servidor"], "anm/SIGMINE/PROCESSOS_MINERARIOS/ES.zip")),
             "Novo download salvo como 'ES (2).zip', identico ao original")
    conferir(any("tentativa" in l["mensagem"] or l["id_item"] == "fbds_uso" for l in linhas), "Retentativas registradas")
    conferir(any("CONFIRMADA" in l["mensagem"] or "CORROBORADA" in l["mensagem"] for l in linhas if l["status"] == "OK"),
             "Evidencia da pesquisa das URLs registrada no log")
    conferir(not os.listdir(os.path.join(SAIDA, "recortes", "_parciais")), "Nenhum parcial sobrando")
    conferir(os.path.exists(os.path.join(SAIDA, "recortes", "mapbiomas_c11_1990.tif.aux.xml")),
             "Nomes das classes (.aux.xml) acompanham o raster publicado")
    antes = [dict(l) for l in linhas]

    # ------------------------------------------------------------------ 2a execucao: retomada
    print("\n[2] Segunda execucao (retomada pelo log)")
    n_es = contar("/PROCESSOS_MINERARIOS/ES.zip")
    n_tif = contar("brazil_coverage-col11_1990.tif")
    rc = coleta.main(comum)
    linhas = ler_log(LOG)
    conferir(linhas[:len(antes)] == antes, "Log so recebeu linhas novas (nada reescrito)")
    novas = linhas[len(antes):]
    fim2 = final_por_item(novas)
    pulados = [i for i in esperados_ok if fim2.get(i) != "PULADO"]
    conferir(not pulados, "Tudo que estava OK virou PULADO%s" % (" - nao: %s" % pulados if pulados else ""))
    conferir(fim2.get("ibge_lei_11428_mapa_pdf") == "FALHA", "So a falha foi tentada de novo")
    conferir(contar("/PROCESSOS_MINERARIOS/ES.zip") == n_es and contar("brazil_coverage-col11_1990.tif") == n_tif,
             "Nenhum download repetido na retomada")

    # ------------------------------------------------------------------ 3a: --refazer guarda o anterior
    print("\n[3] --refazer anm_sigmine_es")
    rc = coleta.main(comum + ["--itens", "anm_sigmine_es", "--refazer", "anm_sigmine_es"])
    anteriores = glob.glob(os.path.join(SAIDA, "recortes", "anm_sigmine_es.anterior_*.gpkg"))
    conferir(rc == 0 and len(anteriores) == 1 and os.path.exists(os.path.join(SAIDA, "recortes", "anm_sigmine_es.gpkg")),
             "Recorte refeito; o anterior foi guardado (%s)" % [os.path.basename(a) for a in anteriores])
    conferir(contar("/PROCESSOS_MINERARIOS/ES.zip") == n_es, "Original reaproveitado (sha256 confere), sem baixar de novo")

    # ------------------------------------------------------------------ 4a: shapefile local sem .shx
    print("\n[4] Shapefile local sem .shx")
    shx = os.path.join(info["base"], "QGis", "Uso do solo", "uso_solo_2007_2008_01.shx")
    guardado = shx + ".guardado"
    os.rename(shx, guardado)
    rc = coleta.main(comum + ["--itens", "local_uso_solo_2007_2008_01", "--refazer", "local_uso_solo_2007_2008_01"])
    conferir(rc == 0, "Recortou mesmo sem .shx")
    conferir(not os.path.exists(shx), "Nada foi escrito na pasta de origem (sem .shx novo)")
    ult = [l for l in ler_log(LOG) if l["id_item"] == "local_uso_solo_2007_2008_01"][-1]
    conferir("copia temporaria" in ult["mensagem"], "Aviso de .shx reconstruido em copia temporaria no log")
    os.rename(guardado, shx)

    # ------------------------------------------------------------------ 5a: sem o KML do limite
    print("\n[5] KML do limite ausente")
    rc = coleta.main(comum + ["--itens", "anm_sigmine_es", "--refazer", "anm_sigmine_es",
                              "--limite", os.path.join(TMP, "nao_existe.kml"), "--saida", os.path.join(TMP, "saida_sem_limite")])
    ult = [l for l in ler_log(os.path.join(TMP, "saida_sem_limite", "_log_coleta.csv")) if l["id_item"] == "anm_sigmine_es"]
    conferir(rc == 1 and any("limite municipal nao encontrado" in l["mensagem"] for l in ult),
             "Sem limite: falha clara, sem derrubar o script")
    conferir(any(l["status"] == "OK" and l["mensagem"].startswith("download") for l in ult),
             "Mesmo sem limite, o original foi baixado")

    # ------------------------------------------------------------------ 6a: HumanCheck / HTML no lugar do arquivo
    print("\n[6] Pagina anti-robo no lugar do arquivo")
    conferir(any("pagina HTML no lugar do arquivo" in l["mensagem"] for l in ler_log(LOG) if l["id_item"] == "ibge_lei_11428"),
             "HTML com HTTP 200 detectado e guardado (nao virou 'zip')")
    conferir(glob.glob(os.path.join(SAIDA, "IBGE", "*.recebido_invalido.html")), "Conteudo invalido guardado, nao apagado")

print("\n[7] O QGIS abre o raster ja com a legenda (processo separado)")
import subprocess  # noqa: E402
codigo_qgis = r"""
import os, sys
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from qgis.core import QgsApplication, QgsRasterLayer
app = QgsApplication([], False); app.initQgis()
camada = QgsRasterLayer(sys.argv[1], "mb")   # manter a referencia: sem ela o renderer some
r = camada.renderer()
print("TIPO", r.type()); print("ROTULO3", {c.value: c.label for c in r.classes()}.get(3) if r.type() == "paletted" else "")
"""
res = subprocess.run([sys.executable, "-c", codigo_qgis, TIF_QGIS], capture_output=True, text=True)
if "No module named 'qgis'" in res.stderr:
    print("  (QGIS nao disponivel neste Python: conferencia pulada)")
else:
    conferir("TIPO paletted" in res.stdout and "ROTULO3 Formação Florestal (3)" in res.stdout,
             "QGIS aplicou o .qml: legenda paletted com nomes (%s %s)" % (res.stdout.strip().replace("\n", " | "),
                                                                          res.stderr.strip()[-200:] if res.returncode else ""))

print("\n--listar:")
conferir(coleta.main(["--listar"]) == 0, "--listar funciona")

print("\nRESULTADO: %s" % ("TODOS OS TESTES PASSARAM" if not FALHAS else "%d FALHA(S)" % len(FALHAS)))
for x in FALHAS:
    print("  - " + x)
if os.environ.get("MANTER_TESTE") != "1":
    shutil.rmtree(TMP, ignore_errors=True)
else:
    print("dados de teste em", TMP)
sys.exit(1 if FALHAS else 0)
