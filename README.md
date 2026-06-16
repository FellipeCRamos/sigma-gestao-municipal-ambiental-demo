# SIGMA - Sistema Integrado de Gestao Municipal Ambiental

Este repositorio contem uma versao publica sanitizada do **SIGMA - Sistema Integrado de Gestao Municipal Ambiental**, aplicacao web desenvolvida como demonstracao academica para a disciplina de Estagio Supervisionado - Atividade Pratica Profissional do curso de Analise e Desenvolvimento de Sistemas.

## Objetivo

Demonstrar uma aplicacao web modular voltada ao apoio de rotinas de gestao municipal ambiental, incluindo modulos como demandas publicas, licenciamento ambiental, bem-estar animal, controle de acesso e area administrativa.

## SIGBA

O **SIGBA - Sistema Integrado de Gestao do Bem-Estar Animal** e tratado nesta versao como modulo interno do SIGMA, voltado a organizacao de rotinas relacionadas ao bem-estar animal.

## Aviso de sanitizacao

Este repositorio e uma versao publica sanitizada, criada exclusivamente para fins academicos. Nao se trata de sistema em producao, homologado ou oficialmente adotado por orgao publico. Dados, marcas, rotas, telas, documentos e conteudos foram adaptados, removidos ou substituidos para preservar seguranca institucional e privacidade.

## Tecnologias

- HTML5
- CSS3
- JavaScript/TypeScript
- React
- Vite
- Node.js
- Express
- PostgreSQL
- JWT/RBAC

## Modulos demonstrativos

- Painel publico
- Demandas e denuncias ambientais
- Assistente preliminar de licenciamento
- Bem-estar animal
- Area administrativa
- Controle de autenticacao e permissoes
- Gestao documental demonstrativa
- Fluxos administrativos simulados

## Como executar localmente

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Ajuste as variaveis do `.env` local conforme seu ambiente de desenvolvimento.

## Limitacoes

A versao publica e demonstrativa e sanitizada. Nao contem dados reais, documentos institucionais, banco de producao, uploads, chaves ou credenciais. Algumas funcionalidades podem depender de banco local e dados ficticios para demonstracao completa.

## Finalidade academica

Este repositorio foi preparado exclusivamente para comprovacao tecnica de Atividade Pratica Profissional ADS, demonstrando estrutura de frontend, backend, banco de dados, modulos, autenticacao, autorizacao e organizacao geral da aplicacao.
