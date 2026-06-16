# SIGMA – Sistema Integrado de Gestão Municipal Ambiental

Este repositório contém uma versão pública sanitizada do **SIGMA – Sistema Integrado de Gestão Municipal Ambiental**, aplicação web desenvolvida como demonstração acadêmica para a disciplina de Estágio Supervisionado – Atividade Prática Profissional do curso de Análise e Desenvolvimento de Sistemas.

## Objetivo

Demonstrar uma aplicação web modular voltada ao apoio de rotinas de gestão municipal ambiental, incluindo módulos de demandas públicas, licenciamento ambiental, bem-estar animal, controle de acesso e área administrativa.

## SIGBA

O **SIGBA – Sistema Integrado de Gestão do Bem-Estar Animal** é tratado, nesta versão, como módulo interno do SIGMA, voltado à organização de rotinas relacionadas ao bem-estar animal.

## Aviso de sanitização

Este repositório é uma versão pública sanitizada, criada exclusivamente para fins acadêmicos. Dados, marcas, rotas, telas, documentos e conteúdos foram adaptados, removidos ou substituídos para preservar a segurança institucional e a privacidade.

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

## Módulos demonstrativos

- Painel público
- Demandas e denúncias ambientais
- Assistente preliminar de licenciamento
- Bem-estar animal
- Área administrativa
- Controle de autenticação e permissões
- Gestão documental demonstrativa
- Fluxos administrativos simulados

## Conformidade com o modelo ADS

A aplicação foi estruturada como projeto web, atendendo às tecnologias obrigatórias indicadas no modelo de Atividade Prática Profissional ADS: HTML5, CSS3 e JavaScript/TypeScript. O projeto também utiliza tecnologias opcionais compatíveis com aplicações web, como React, Vite, Node.js, Express, PostgreSQL e API REST. A alternativa desktop, baseada em C# e Windows Forms ou WPF, não se aplica ao presente projeto, pois a solução foi definida como aplicação web.

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

Ajuste as variáveis do `.env` local conforme seu ambiente de desenvolvimento.

## Limitações

A versão pública é demonstrativa e sanitizada. Não contém dados reais, documentos institucionais, banco de dados real, uploads, chaves ou credenciais. Algumas funcionalidades podem depender de banco local e dados fictícios para demonstração completa.

## Finalidade acadêmica

Este repositório foi preparado exclusivamente para comprovação técnica de Atividade Prática Profissional ADS, demonstrando a estrutura de frontend, backend, banco de dados, módulos, autenticação, autorização e organização geral da aplicação.
