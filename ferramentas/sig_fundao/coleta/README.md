# Coleta e recorte de bases públicas: Fundão/ES (CC-2)

`coletar_bases_fundao.py` + `COLETAR_BASES.bat`. Roda no PC que alcança os sites do governo, com o Python e o GDAL do QGIS. **Não precisa instalar nada além do QGIS.**

## Rodar

- **Duplo clique em `COLETAR_BASES.bat`.** Ele acha o QGIS instalado (`C:\Program Files\QGIS 3.xx` ou OSGeo4W) e roda o script com o Python do QGIS (`python-qgis.bat` ou `o4w_env.bat`).
- **Pelo `cmd`, com opções:**
  - `COLETAR_BASES.bat --listar`: mostra o catálogo.
  - `COLETAR_BASES.bat --itens 1,6`: só os grupos 1 e 6 (também aceita ids).
  - `COLETAR_BASES.bat --refazer anm_sigmine_es`: refaz um item já concluído.
  - `--base`, `--g3m`, `--saida` e `--limite` trocam os caminhos padrão.
  - `--ssl-flexivel`: só se um site de confiança tiver certificado quebrado.

## Saída (contrato)

```
C:\Users\User\Documents\BACKUP_REDE_PMF_SEMAM_17_08_2026\50. SIG_FUNDAO\01_brutos_pc\
  <fonte>\<original baixado, intacto>          MapBiomas, FBDS, SGB, IBGE, INCRA, ANM, ANA
  recortes\<id_item>.gpkg | .tif               Fundão (KML do IDAF) + 2 km, EPSG:31984; raster GeoTIFF LZW
  _log_coleta.csv                              id_item;url;http;bytes;sha256;inicio;fim;status;mensagem
  _area_recorte_fundao_2km.gpkg                a área exata usada nos recortes (para conferência)
```

Cada raster recortado vem acompanhado de:
- `<id>.tif.aux.xml`: tabela de atributos, com valor, classe e cor.
- `<id>.qml`: estilo que o QGIS aplica **sozinho** ao abrir o raster.

A tabela de cores também vai dentro do próprio TIFF.

As respostas de serviços (WFS/ArcGIS) são o "original" desses itens. Ficam em `<fonte>\<id_item>\`, uma resposta ou página por arquivo.

## Regras de funcionamento

- **Itens independentes.** Cada item tem uma **lista de estratégias**, tentadas em ordem: a fonte oficial, depois um serviço consultado só no retângulo de Fundão, depois o espelho estadual (Geobases-ES). A falha de um item não para os outros.
- **Retomável pelo log.** O que já foi concluído vira `PULADO` na próxima execução, e nada é baixado de novo (o sha256 é conferido). Download interrompido é **retomado** do ponto onde parou.
- **Nunca apaga nada:**
  - Arquivo com o mesmo nome vira `nome (2).ext`.
  - Recorte refeito guarda o anterior como `<id>.anterior_<data>.gpkg`.
  - Página HTML recebida no lugar do arquivo fica guardada como `*.recebido_invalido.html`.
  - Shapefile local sem `.shx` é lido de uma **cópia temporária**, sem escrever na pasta de origem.
- **Rede:** timeout de 90 s e 3 tentativas (espera de 10 s e de 30 s); User-Agent de navegador (a ANM recusa outros); proxy do Windows respeitado.
  - O certificado incompleto do INCRA é tratado pelo PowerShell, que continua verificando o certificado.
  - Página anti-robô (captcha) é detectada e explicada no log.
- **Sem login, captcha ou API paga.** O SICAR fica fora.
- **Mensagens em português.** Cada linha do log traz data e hora de acesso e a **evidência** da URL.

## Catálogo (URLs confirmadas por pesquisa em 27/09/2026)

Graus de confiança:
- **CONFIRMADA**: vista literalmente em fonte oficial (página, listagem ou HEAD).
- **CORROBORADA**: vista literalmente em código ou documentação pública de terceiros.
- **INFERIDA**: montada pelo padrão; sempre fica depois das anteriores.

| # | id_item | Estratégias, em ordem | Confiança |
|---|---|---|---|
| 1 | `mapbiomas_c<N>_<ano>` e `mapbiomas_c<N>_legenda` | Acha a coleção mais recente listando o bucket público `mapbiomas-public` (hoje a **Coleção 11, 1985–2025**) e lê a janela de Fundão de cada ano nos GeoTIFFs nacionais via `/vsicurl/`, **sem baixar o Brasil**. Legenda: CSV oficial (código, classe, cor); se falhar, uma tabela de reserva embutida | CONFIRMADA (listagem + HEAD); legenda CORROBORADA |
| 2 | `fbds_app`, `fbds_uso`, `fbds_hidrografia` | Varre `https://geo.fbds.org.br/ES/FUNDAO/<APP\|USO\|HIDROGRAFIA>/` (índice h5ai), baixa todos os arquivos e recorta | CONFIRMADA / CORROBORADA |
| 3 | `sgb_geologia_100k` | Folhas **1:100 mil** Aracruz (RIGeo `doc/18319`) e Vitória (`doc/18379`): o link do SIG é lido na página do item. Reserva: serviço `litoestratigrafia_100000` | CONFIRMADA (itens); nome do zip lido na hora |
| 3 | `sgb_geologia_es_400k` | Mapa estadual 1:400 mil: serviço ArcGIS `litoestratigrafia_estados` (camada "Espírito Santo"). Reserva: Geobases-ES `espiritosanto_lito_31984` | CONFIRMADA |
| 4 | `ibge_bdia_<tema>` (geologia, geomorfologia, pedologia, vegetação) | WFS do IBGE (`BDIA:*_area`), depois geoftp (versão mais recente escolhida na hora; arquivo nacional recortado), depois Geobases-ES | CORROBORADA / CONFIRMADA |
| 4 | `ibge_malha_municipal_es` | geoftp: o ano mais recente de `municipio_AAAA` (hoje 2025) → `ES_Municipios_AAAA.zip` | CORROBORADA (com sha256 real) |
| 4 | `ibge_localidades` | `Localidades_do_Brasil/2022` (gpkg por UF, gpkg Brasil ou shp) | CORROBORADA |
| 4 | `ibge_lei_11428` | Vetor do mapa IBGE 1:5 mi publicado pelo MMA (gov.br; espelho antigo como reserva) | CONFIRMADA |
| 4 | `ibge_lei_11428_mapa_pdf` | PDF oficial do IBGE, sem recorte, só referência | CONFIRMADA |
| 5 | `incra_sigef_es`, `incra_snci_es`, `incra_assentamentos_es`, `incra_quilombolas_es` | Zips estáticos de `certificacao.incra.gov.br/csv_shp/zip/` (a página de exportação exige login, mas os zips não). Reserva: Geobases-ES `incra_*_es_31984` | CORROBORADA |
| 6 | `anm_sigmine_es` | `dadosabertos.anm.gov.br/SIGMINE/PROCESSOS_MINERARIOS/ES.zip` (visita o índice antes, por causa do cookie). Reserva: ArcGIS `SIGMINE/dados_anm` | CONFIRMADA |
| 7 | `ana_bho_trechos`, `ana_bho_areas_contribuicao` | **BHO 6** (base vigente; a BHO 2017 foi marcada "desatualizada" pela ANA): serviço ArcGIS consultado no retângulo, depois o GPKG nacional lido em janela via `/vsicurl/` (URL tirada do registro de metadados), depois Geobases-ES (BHO 2017, avisado no log) | CORROBORADA / INFERIDA |
| 8 | `local_map_es_2012_2015_uso_cobertura`, `local_ortofotomosaico_es_2007_2008_uso_solo`, `local_uso_solo_2007_2008_01` | Só recorte, lendo o original com `/vsizip/` e filtro espacial, sem copiar. Aceita zip dentro de zip, FileGDB, raster, e ortofoto georreferenciada só por `.tfw`/`.prj` | arquivos locais |

## Riscos conhecidos (confira no primeiro uso)

- **INCRA:**
  - Só responde a IP brasileiro, e a cadeia de certificado é incompleta; o script tenta pelo Windows.
  - O zip do SNCI pode não existir para o ES; nesse caso vai para o Geobases.
- **FBDS:** o site às vezes mostra uma verificação anti-robô. O script detecta, guarda o que recebeu e pede o download manual.
- **BHO 6, áreas de contribuição:** o nome do serviço foi inferido. O script procura na pasta de serviços; se não achar, usa o GPKG remoto ou o Geobases.
- **MapBiomas:** as cores de reserva das classes 29, 50 e 75 precisam de conferência. Só são usadas se o CSV oficial não baixar.
- **LGPD:** alguns atributos são nomes de pessoas: `NOME` (titular, na ANM) e `nome_area` (no SIGEF, pode conter nome). Os dados ficam só no PC e na rede da SEMAM, **nunca neste repositório**.

## Testes

```
python testes/testar_coleta.py        (no Windows: python-qgis testes\testar_coleta.py)
```

O teste roda o **catálogo real** contra um **servidor HTTP falso** (`testes/servidor_falso.py`), trocando só o host de cada URL (`--redirecionar`). Os dados são **sintéticos** (`testes/gerar_dados_sinteticos.py`).

O servidor imita:
- **listagens:** h5ai (FBDS), índice Apache (geoftp) e a API JSON do bucket do MapBiomas;
- **serviços:** ArcGIS REST paginado e WFS;
- **armadilhas e falhas:** a pasta `collection_71` (a Coleção 7.1, que uma comparação ingênua poria à frente da 11); 503 intermitente; conexão que cai no meio; lentidão além do timeout; 404; página HTML com HTTP 200; ANM que exige navegador e cookie.

O que é verificado:
- **Recortes:**
  - estão em EPSG:31984;
  - ficam dentro de Fundão + 2 km, com o polígono da borda cortado;
  - mantêm os atributos intactos;
  - convertem acentos Windows-1252 sem `.cpg`.
- **Rasters:**
  - LZW e pixel de 30 m;
  - legenda oficial na tabela de cores e na RAT;
  - o QGIS abre o raster já com a legenda.
- **Downloads e retomada:**
  - originais byte a byte iguais;
  - download cortado retomado com `Range`;
  - segunda execução só com `PULADO`, sem baixar de novo;
  - `--refazer` guarda o anterior.
- **Arquivos de origem:** arquivo pré-existente nunca sobrescrito; shapefile sem `.shx` sem escrever na origem.
- **Casos de falha:** limite ausente gera falha clara; HTML no lugar de zip é detectado.

**Resultado atual:** todos passam, em cerca de 12 s.

Não testado aqui: o `.bat` num Windows real, e os sites reais, que estão bloqueados no ambiente onde a ferramenta foi escrita. Na primeira execução no PC, confira o `_log_coleta.csv`.
