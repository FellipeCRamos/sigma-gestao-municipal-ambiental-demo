# Captação de recursos – levantamento de oportunidades (federal e estadual)

Ferramenta de linha de comando, sem dependências externas (Node.js ≥ 20), que levanta **o que um município captou, o que perdeu e o que está aberto** em recursos para a área ambiental desde 2016. Ela também consolida a execução de uma secretaria no Portal da Transparência municipal da plataforma *portaltp*.

É usada pelos comandos do Claude Code `/captacao-recursos` e `/transparencia-orgao` (em `.claude/commands/`), mas também roda sozinha.

## Uso rápido

```bash
# tudo que tem API/dados abertos + relatório
node tools/captacao-recursos/captacao.mjs tudo \
  --municipio "Nome do Município" --uf XX --ibge 1234567 \
  --cnpj 00000000000100 --desde 2016

# execução de uma secretaria no portal municipal (portaltp.com.br)
node tools/captacao-recursos/captacao.mjs portal-tp \
  --municipio "Nome do Município" --uf XX \
  --portal https://municipio-uf.portaltp.com.br --orgao "MEIO AMBIENTE"
```

As saídas ficam em `saida-captacao/<municipio>-<uf>/`, pasta ignorada pelo git porque contém dados reais. Os arquivos gerados são:

| Arquivo | Conteúdo |
| --- | --- |
| `relatorio-captacao.md` | indicadores, evolução anual, perdas, oportunidades não pleiteadas e abertas, cenário "com sistema de gestão" |
| `matriz-oportunidades.csv` | uma linha por oportunidade (captada, perdida, aberta…), pronta para Excel (`;`, UTF-8 com BOM) |
| `indicadores.json` | indicadores e cenários em formato de máquina |
| `transferegov.json`, `transferencias-especiais.json`, `portal-transparencia.json`, `ckan.json`, `portal-tp.json` | coleta bruta de cada fonte |
| `portal-tp/<consulta>.csv` | registros do órgão por consulta do portal municipal |

## Comandos

| Comando | Fonte | O que faz |
| --- | --- | --- |
| `federal` | [Dados abertos do Transferegov](https://repositorio.dados.gov.br/seges/detru/) (antigo SICONV) | Lê as propostas, os convênios e as emendas do município. Classifica cada proposta como captada, rejeitada, cancelada ou anulada. Cruza com **todos** os programas ambientais a que o município era elegível para achar os **não pleiteados** e os **abertos agora**. |
| `pix` | API de transferências especiais do Transferegov | Lista as emendas "PIX" recebidas e as impedidas ou canceladas. |
| `transparencia` | API do Portal da Transparência | Busca os convênios pelo código IBGE. Exige a variável `PORTAL_TRANSPARENCIA_CHAVE` ([cadastro gratuito](https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email)). |
| `estadual` | Portais CKAN (dados abertos do estado e do TCE; configuráveis) | Busca conjuntos de dados por tema e extrai as linhas do município. |
| `portal-tp` | `<portal>/api/transparencia.asmx/json_*` | Coleta todas as consultas do portal municipal e filtra pela unidade gestora do órgão. |
| `relatorio` | as saídas acima + `oportunidades-manuais.csv` | Gera a matriz, os indicadores e o relatório. |
| `tudo` | — | Roda `federal`, `pix`, `transparencia`, `estadual` e `relatorio`. Se uma fonte falhar, as outras continuam. |

Opções: `--municipio`, `--uf`, `--ibge`, `--cnpj`, `--desde`, `--saida`, `--dados-dir`, `--manual`, `--atualizar`, `--portal`, `--orgao`, `--consultas`. Veja `node tools/captacao-recursos/captacao.mjs ajuda`.

## Método

- **Relevância ambiental.** Uma oportunidade é ambiental quando o programa, o objeto ou o órgão casa com os termos dos eixos em `config.json`: resíduos, saneamento e água, drenagem e riscos, clima, florestas e biodiversidade, costeiro, bem-estar animal e gestão ambiental. Termos e exclusões podem ser ajustados no arquivo, sem mexer no código.
- **Elegibilidade.** Um programa do Transferegov é elegível quando atende a três condições:
  - aceita a natureza jurídica "Administração Pública Municipal";
  - vale para a UF do município (ou para todas);
  - foi disponibilizado a partir de `--desde`.
- **Status.**
  - `CAPTADA`: aprovada ou em execução.
  - `PERDIDA_REJEITADA` e `PERDIDA_CANCELADA`: proposta rejeitada ou cancelada.
  - `PERDIDA_POS_CELEBRACAO`: convênio anulado, rescindido ou cancelado. O valor perdido é o repasse menos o desembolsado.
  - `RISCO`: prestação de contas rejeitada ou inadimplência.
  - `NAO_PLEITEADA`: programa elegível com janela de propostas encerrada e sem proposta do município.
  - `EM_ABERTO`: janela vigente.
  - `EMENDA_NAO_OBTIDA`: programa acessível só por emenda, e o município não obteve nenhuma.
  - `ADERIDA`: adesão sem repasse direto (registro manual).
  - `INFORMATIVO`: dado sem classificação automática.
- **Valor potencial de um programa não pleiteado.** É a mediana do repasse aprovado para municípios da mesma UF. Sem histórico na UF, usa a mediana do Brasil.
- **Cenário "com sistema de gestão".** Para cada cenário (conservador, moderado e otimista em `config.json`) soma:
  - `potencial × taxa de aprovação observada na UF × cobertura` (fração das oportunidades que um monitoramento ativo teria pleiteado);
  - `perdas × redução de perdas` (rejeições, cancelamentos e anulações evitáveis com controle de prazos, pendências e cláusula suspensiva).

  É uma estimativa contrafactual com premissas explícitas, não uma previsão.

## Oportunidades sem base de dados única

Não há API para programas estaduais por adesão (portarias, editais de fundos estaduais), termos de adesão federais, compensações ambientais (SNUC, condicionantes), TACs e acordos judiciais. Registre esses casos em `<saida>/oportunidades-manuais.csv`, copiando o cabeçalho de `modelos/oportunidades-manuais.csv`, e rode `relatorio` de novo. As colunas são:

`esfera;fonte;tipo;identificador;ano;titulo;concedente;origem;status;valor_captado;valor_perdido;valor_potencial;taxa_aprovacao;eixos;observacao;link`

- `status` usa os códigos acima.
- Os valores aceitam `1.234,56`.
- `eixos` separa os itens com `/`.
- `taxa_aprovacao` vai de 0 a 1. Use 1 em programas por adesão, em que basta cumprir os requisitos.

## Rede

Os domínios abaixo precisam estar liberados:

- `repositorio.dados.gov.br`
- `api.transferegov.gestao.gov.br`
- `api.portaldatransparencia.gov.br`
- os portais CKAN do `config.json`
- o subdomínio `*.portaltp.com.br` do município

Atrás de proxy, rode com `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21). Se o download dos arquivos do Transferegov (centenas de MB) não for possível, baixe `siconv_programa`, `siconv_programa_proposta`, `siconv_proposta`, `siconv_convenio` e `siconv_emenda` (`.csv` ou `.csv.zip`) pelo navegador e use `--dados-dir`. Os downloads ficam em cache por 7 dias em `saida-captacao/_cache/`.

## Limitações

- A classificação ambiental é feita por palavras-chave. Revise a coluna `ambiental` da matriz antes de divulgar números.
- Os nomes de coluna das fontes podem mudar. O código aceita vários nomes candidatos e descobre os campos das APIs na primeira resposta, mas uma mudança maior de layout exige ajuste.
- O `portal-tp` guarda só contagens e somas das consultas com dados de pessoas (folha, servidores).

## Testes

```bash
npm run test:captacao
```

Os testes usam dados fictícios e servidores HTTP locais que simulam as APIs, sem acesso à internet.
