# Ferramentas do SIG de Fundão (SEMAM)

Ferramentas de apoio ao `SIG_FUNDAO_SEMAM.gpkg`, independentes do sistema web deste repositório:

| Pasta | Ferramenta | Onde roda |
|---|---|---|
| [`coleta/`](coleta/README.md) | **CC-2**: coleta e recorte das bases públicas (MapBiomas, FBDS, SGB, IBGE, INCRA, ANM, ANA) e recorte dos arquivos grandes locais | PC com QGIS: duplo clique em `COLETAR_BASES.bat` |
| [`triagem/`](triagem/README.md) | **CC-1**: Triagem Locacional SEMAM, que gera a ficha de restrições de uma área lida do GPKG | QGIS 3.34+, Caixa de Ferramentas de Processamento |

**Este repositório é público.** Aqui ficam só o código e os testes com dados **sintéticos**, gerados na hora dos testes. Dados reais (recortes, CAR, SIGEF, processos, CPF ou nomes) **nunca** entram aqui; ficam no PC e na rede da SEMAM.
