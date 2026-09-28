---
description: Busca no Portal da Transparência municipal (plataforma portaltp.com.br) tudo o que foi executado por uma secretaria/órgão desde 2016 (padrão: meio ambiente) e resume por ano
argument-hint: <URL do portal> <Município>/<UF> [termos do órgão, padrão "MEIO AMBIENTE"] [desde=2016]
allowed-tools: Bash(node tools/captacao-recursos/captacao.mjs:*), Bash(NODE_USE_ENV_PROXY=1 node tools/captacao-recursos/captacao.mjs:*), Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
---

# Execução de um órgão no Portal da Transparência municipal

Argumentos recebidos: `$ARGUMENTS`

Objetivo: reunir **tudo o que foi feito pelo órgão** (padrão: secretaria e fundo municipal de meio ambiente) desde o ano inicial: empenhos, liquidações e pagamentos, contratos e aditivos, licitações, atas, ordens de compra, diárias, convênios e subvenções, receitas próprias do fundo (taxas de licenciamento, multas) e estrutura de pessoal (só contagens).

## 1. Coleta pela API do portal

A plataforma portaltp publica cada consulta do site em `<portal>/api/transparencia.asmx/json_<consulta>?ano=AAAA[&mes=M]` e lista as consultas em `<portal>/api/dadosabertos.aspx`.

```bash
NODE_USE_ENV_PROXY=1 node tools/captacao-recursos/captacao.mjs portal-tp --portal <URL> --municipio "<Município>" --uf <UF> --orgao "MEIO AMBIENTE" --desde <ano>
```

- Use em `--orgao` os termos que aparecem no nome da unidade gestora (ex.: `"MEIO AMBIENTE,FUNDO MUNICIPAL DE MEIO AMBIENTE"`). Confira em `/consultas/institucional/secretarias.aspx` o nome oficial do órgão e do fundo.
- Registros marcados `criterio=texto` citam o órgão fora do campo de unidade (ex.: objeto de licitação feita por outra secretaria para ele): **confira um a um** antes de atribuí-los ao órgão.
- Se a lista automática de consultas falhar, abra `<portal>/api/dadosabertos.aspx`, escolha as consultas e rode de novo com `--consultas json_a,json_b`.
- Se a API estiver indisponível, navegue nas páginas `/consultas/despesas/empenhos.aspx`, `/consultas/despesas/liquidacoes.aspx`, `/consultas/despesas/diarias.aspx`, `/consultas/despesas/subvencoes.aspx`, `/consultas/compras/licitacoes.aspx` e `/consultas/compras/contratos.aspx`, filtrando pela unidade gestora e exportando quando houver opção.
- Se o domínio estiver bloqueado na rede, diga ao usuário qual domínio liberar e ofereça a checagem cruzada pelos dados abertos do tribunal de contas estadual (`estadual`, despesas por unidade gestora e função 18 – Gestão Ambiental).

## 2. Análise

Escreva `saida-captacao/<municipio>-<uf>/execucao-orgao.md` com:

1. Orçamento executado por ano (empenhado, liquidado, pago) e peso no total do município, quando disponível.
2. Principais despesas por natureza e principais favorecidos (top 10 por valor), contratos vigentes e vencidos, licitações por modalidade.
3. Receitas vinculadas ao fundo municipal de meio ambiente (taxas, multas, compensações, repasses).
4. Estrutura: quantidade de cargos/servidores por ano (sem nomes).
5. Alertas para conferência: contratações diretas recorrentes com o mesmo fornecedor, possíveis fracionamentos, aditivos acima de 25%, restos a pagar elevados, anos sem execução, órgão sem fundo próprio.
6. O que a execução revela sobre a capacidade de captar recursos (ex.: fundo sem movimentação, ausência de contrapartidas, falta de projetos).

Não exponha nomes de servidores nem dados pessoais; fornecedores pessoa jurídica podem ser citados. Separe fato de interpretação e cite a consulta/página de origem de cada número.
