# Triagem Locacional SEMAM (CC-1)

Script de Processing do QGIS 3.34+ que gera a **ficha de restrições** de uma área a partir do `SIG_FUNDAO_SEMAM.gpkg`.

> **Triagem é indício, não decisão — confirmar em vistoria e no processo (e-Docs).**
> O aviso sai no topo e no fim de toda ficha.

## Instalar

1. No QGIS, abra a **Caixa de Ferramentas de Processamento**.
2. Clique no ícone de Python e escolha **"Adicionar script à Caixa de Ferramentas…"**.
3. Selecione `triagem_locacional_semam.py`.
4. A ferramenta aparece em **Scripts → SEMAM Fundão → Triagem Locacional SEMAM**.

## Usar

Informe a área de **uma** destas formas (pode combinar; tudo vira uma única área, a não ser que "Uma ficha por feição" esteja marcada):

| Forma | Como fazer |
|---|---|
| Feições selecionadas | Escolha a camada e marque **"Somente feições selecionadas"** |
| Polígono desenhado | Crie uma camada temporária (Camada → Criar camada → Nova camada temporária de rascunho), desenhe, selecione e use-a como acima |
| KML/KMZ do requerente | Campo **"arquivo do requerente"**. Aceita também GeoJSON, SHP e GPKG, e lê todas as pastas/camadas do arquivo |
| WKT | Campo **"geometria em WKT"** (ex.: `CRS=EPSG:4674;POINT(-40.40 -19.93)`) |

O script trata a entrada assim:
- **Qualquer sistema de referência** é aceito e reprojetado para SIRGAS 2000 / UTM 24S (EPSG:31984).
- **Ponto e linha** recebem buffer (padrão 50 m).
- **Geometria inválida** é corrigida (`makeValid`) e a correção é anotada na ficha.

### Saídas

Todas vão para a pasta escolhida, com data e hora no nome:
- **`triagem_AAAAMMDD_HHMMSS.html`**: ficha autocontida, que abre sem internet (croqui em SVG embutido).
- **`….pdf`**: a mesma ficha em A4.
- **`….csv`**: um achado por linha (`;`, UTF-8).
- **Camada temporária "Interseções da triagem"**: geometria de cada achado, com severidade, base legal etc.

### O que a ficha traz

- **Área analisada:** área (m² e ha), perímetro, centróide em UTM 24S e em lat/long (decimal e GMS), distrito e zona do PDM.
- **Achados que restringem** (impeditivos, restritivos, condicionantes): camada, classe, área (m² e %), distância, severidade, base legal, orientação, fonte, data, escala e confiabilidade do dado.
- **Informações de contexto** (regras INFORMATIVO): resumidas por regra. Quando há muitas classes, a ficha mostra as 12 maiores e avisa que a lista completa está no CSV.
- **Atos da SEMAM próximos**, com o nº do processo e a distância.
- **Croqui** esquemático da área e dos achados.
- **"Consultado, sem achado":** a ausência também é informação.
- **"Regras não avaliadas":** camada inexistente, filtro inválido, tipo desconhecido etc. Uma regra com problema **nunca** vira um falso "sem achado".
- **Limitações dos dados usados**, vindas de `_catalogo.limitacao`.

## Contrato do GeoPackage: como a ferramenta interpreta

**Nenhuma camada é fixa no código:** tudo vem de `_regras_triagem`, e fonte, data, escala, confiabilidade e limitação vêm de `_catalogo`. Estes pontos o contrato não detalhava. É assim que a ferramenta lê cada um, e é assim que o GPKG deve ser montado.

| Coluna / caso | Interpretação |
|---|---|
| `camada` (vetor) | Nome da tabela no GPKG |
| `camada` (raster) | Caminho **relativo à pasta do GPKG** (ex.: `rasters/mapbiomas_c11_2025.tif`) ou nome de tabela raster do próprio GPKG |
| `tipo = sobrepoe` | Interseção com a área. Polígonos dão área (m² e %), sem contar sobreposições em dobro. Linhas dão extensão (m) dentro da área. Pontos dão a contagem dentro da área |
| `tipo = distancia` | Feições a até `raio_m` da área. Informa a menor distância (0 = encosta/sobrepõe) |
| `tipo = raster_classes` | % e m² de cada classe do raster dentro da área |
| `campo_classe` (vetor) | Campo que separa os achados em classes (ex.: `nome`, `zona`, `processo`). Vazio: uma linha por regra |
| `campo_classe` (raster) | **Opcional:** nome de uma tabela de legenda no GPKG com colunas `codigo` (ou `valor`) e `classe` (ou `nome`). Sem ela, a legenda vem de um CSV ao lado do raster (`<raster>.csv`), depois da tabela de atributos do raster (RAT, que a coleta já grava) e, por fim, do código numérico |
| `filtro_sql` (vetor) | Cláusula WHERE no dialeto do GeoPackage/SQLite (ex.: `tipo = 'APP de nascente'`). É **validada no GPKG**; se for inválida, a regra vai para "não avaliadas" |
| `filtro_sql` (raster) | Lista das classes que contam, ex.: `3,4,5,49` ou `valor IN (3,4)`. Vazio: todas as classes |
| `severidade` | `IMPEDITIVO`, `RESTRITIVO`, `CONDICIONANTE` ou `INFORMATIVO`. Outro valor é tratado como INFORMATIVO e **avisado** na ficha |
| `_catalogo.camada` | Deve ser **igual** a `_regras_triagem.camada` (inclusive o caminho do raster) para a ficha achar fonte e data |

**Distrito, zona do PDM e atos da SEMAM** também saem de regras:
- Se `_regras_triagem` tiver a coluna **opcional** `secao_ficha` (`distrito`, `zona_pdm` ou `atos_semam`), ela decide.
- Sem essa coluna, as regras **INFORMATIVO** vão para a seção pelo rótulo:
  - rótulo com *distrito* → Distrito;
  - rótulo com *PDM*, *zona* ou *zoneamento* → Zona do PDM;
  - rótulo com *ato*, *processo*, *licença*, *autorização*, *anuência* ou *dispensa* → Atos da SEMAM.
- Para os atos, use `tipo = distancia`, `raio_m = 500` e `campo_classe` = campo do nº do processo.

## Testes

```
python testes/testar_triagem.py                (Linux: QT_QPA_PLATFORM=offscreen)
python-qgis testes\testar_triagem.py           (Windows, OSGeo4W Shell)
```

`testes/gerar_gpkg_sintetico.py` cria um GPKG **sintético** que segue o contrato:
- camadas fictícias com respostas exatas: gleba de 10.000 m², UC em 50%, APP em 20% (com dois polígonos sobrepostos), raster 30/50/20%, nascente a 30 m e atos a 100, 350 e 600 m;
- quatro regras com defeito de propósito;
- uma camada de 60 mil lotes, para medir o tempo.

O teste cobre 10 cenários:
1. gleba de referência;
2. ponto em WKT lat/long com buffer;
3. KMZ em WGS 84 com duas pastas;
4. polígono inválido (gravata-borboleta);
5. somente selecionadas;
6. uma ficha por feição;
7. área côncava (centróide fora);
8. linha com buffer;
9. sem área;
10. GPKG sem `_regras_triagem`.

**Resultado atual:** todos passam, com cada triagem entre 0,2 e 0,4 s (limite pedido: 10 s).

Nenhum dado real é usado nem gravado no repositório.
