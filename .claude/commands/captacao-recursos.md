---
description: Levanta desde 2016 a captação de recursos ambientais do município (programas, adesões, emendas, compensações) — captadas, perdidas e abertas — e analisa o desempenho contra o cenário "com sistema de gestão"
argument-hint: <Município>/<UF> [código IBGE] [CNPJs separados por vírgula] [desde=2016]
allowed-tools: Bash(node tools/captacao-recursos/captacao.mjs:*), Bash(NODE_USE_ENV_PROXY=1 node tools/captacao-recursos/captacao.mjs:*), Bash(npm run test:captacao), Read, Write, Edit, Glob, Grep, WebSearch, WebFetch
---

# Levantamento de captação de recursos na área ambiental

Argumentos recebidos: `$ARGUMENTS`

Objetivo: levantar **todas** as oportunidades de captação de recursos para a área ambiental do município desde o ano inicial (padrão 2016), das esferas **federal e estadual** e de **compensações/acordos**, separando o que foi **captado/aderido**, o que foi **perdido** e o que está **aberto agora**, e fechar com uma **análise de desempenho** comparada ao cenário em que a secretaria tivesse um sistema de gestão.

## 1. Parâmetros

1. Extraia de `$ARGUMENTS`: município, UF, código IBGE (7 dígitos), CNPJs (prefeitura e fundo municipal de meio ambiente) e ano inicial.
2. Se faltar o código IBGE ou o CNPJ da prefeitura, descubra por busca e **confirme em duas fontes**; diga ao usuário quais valores usou.
3. Pasta de saída: `saida-captacao/<municipio>-<uf>/` (ignorada pelo git; nunca faça commit dela).

## 2. Coleta automática (APIs e dados abertos)

```bash
NODE_USE_ENV_PROXY=1 node tools/captacao-recursos/captacao.mjs tudo --municipio "<Município>" --uf <UF> --ibge <IBGE> --cnpj <CNPJs> --desde <ano>
```

- Se `PORTAL_TRANSPARENCIA_CHAVE` não estiver definida, a fonte `transparencia` é pulada: avise o usuário e siga.
- Se alguma fonte falhar por rede (`falha-*.json` na saída), informe **quais domínios** precisam ser liberados (lista no `tools/captacao-recursos/README.md`) e continue com o restante. Alternativa para o Transferegov: baixar os `siconv_*.csv.zip` pelo navegador e rodar `federal --dados-dir <pasta>`.
- Confira o `relatorio-captacao.md` gerado e a coluna `ambiental` da `matriz-oportunidades.csv`: descarte falsos positivos óbvios antes de analisar.

## 3. Pesquisa complementar (o que não tem API)

Pesquise e registre em `saida-captacao/<municipio>-<uf>/oportunidades-manuais.csv` (cabeçalho em `tools/captacao-recursos/modelos/oportunidades-manuais.csv`) **uma linha por oportunidade, sempre com link da fonte**. Cubra no mínimo:

- **Estaduais por adesão ou edital**: fundo estadual de recursos hídricos/meio ambiente, programas estaduais de castração e bem-estar animal, pagamento por serviços ambientais, fundo estadual de infraestrutura municipal (inclusive linhas de adaptação climática e defesa civil), resíduos sólidos e consórcios, apoio a planos (Mata Atlântica, redução de risco, saneamento), educação ambiental, critério ambiental na repartição do ICMS/IBS, emendas parlamentares estaduais.
- **Federais por adesão** (não aparecem como proposta no Transferegov): manejo populacional de cães e gatos, A3P, gestão de praias (SPU), adaptação climática (AdaptaCidades, Cidades Verdes Resilientes), Novo PAC Seleções (inscrições **e** resultados por eixo), SINISA/SNIS como condicionante de acesso a recursos de saneamento, editais do FNMA e do Fundo Clima.
- **Compensações e acordos**: compensação ambiental do SNUC (câmara de compensação do órgão estadual) para UCs no município, condicionantes de licenciamento de grandes empreendimentos no território, TACs e multas revertidas ao fundo municipal, acordos judiciais de reparação, royalties.
- **Fontes privadas e multilaterais**: fundos socioambientais, fundações, editais de ONGs e bancos de desenvolvimento.

Regras da planilha:
- `status` segue a legenda do relatório (`CAPTADA`, `ADERIDA`, `PERDIDA_REJEITADA`, `PERDIDA_CANCELADA`, `PERDIDA_POS_CELEBRACAO`, `NAO_PLEITEADA`, `EMENDA_NAO_OBTIDA`, `EM_ABERTO`, `EM_ANDAMENTO`, `RISCO`, `INFORMATIVO`).
- Só marque `NAO_PLEITEADA` quando houver evidência de que o município era elegível e não participou (lista oficial de aderentes/selecionados). Sem evidência, use `INFORMATIVO` e escreva "sem evidência" em `observacao`.
- `valor_potencial`: use o valor por município definido no programa ou a mediana/benchmark de municípios de porte parecido, explicando a base em `observacao`. `taxa_aprovacao` = 1 para programas de adesão com requisitos cumpríveis.
- Cuidado com homônimos (ex.: nome do município igual ao de barragem, rio ou bairro de outro estado).

Depois rode de novo:

```bash
node tools/captacao-recursos/captacao.mjs relatorio --municipio "<Município>" --uf <UF> --ibge <IBGE>
```

## 4. Análise de desempenho

Escreva `saida-captacao/<municipio>-<uf>/analise-desempenho.md` com:

1. **Sumário executivo** (5 a 8 linhas): captado × perdido × potencial não pleiteado, taxa de sucesso, taxa de aproveitamento, posição no ranking da UF.
2. **Linha do tempo** por ano e por gestão.
3. **Pontos positivos** — o que foi captado/aderido e por quê deu certo.
4. **Pontos negativos** — cada perda com a **causa-raiz** provável: falta de monitoramento de editais; pré-requisito ausente (fundo municipal com CNPJ e conta, conselho ativo, planos exigidos, regularidade no CAUC/SINISA); ausência de banco de projetos; perda de prazo ou cláusula suspensiva; dependência de emendas; falta de dados para comprovar demanda.
5. **Benchmarking** com municípios vizinhos ou de porte semelhante (ranking da UF do relatório).
6. **Cenário com sistema de gestão**: use a tabela de cenários do relatório e ligue cada causa-raiz à funcionalidade que a teria evitado (radar de editais, checklist de habilitação, banco de projetos, controle de prazos/pendências, indicadores e transparência ativa). Deixe claras as premissas e que é uma estimativa.
7. **Recomendações** em 30/90/180 dias, começando pelas oportunidades `EM_ABERTO`.
8. **Limitações** e o que falta confirmar.

Separe sempre **fato verificado (com fonte)** de **estimativa** e de **hipótese**. Não invente valores, datas ou adesões.

Ao final, resuma para o usuário os números principais e pergunte se ele quer a análise publicada como página ou documento.
