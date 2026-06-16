# Frontend da Plataforma SIGMA

Frontend em React + Vite, organizado como shell modular da Plataforma SIGMA.

## Estrutura

- `src/App.jsx`: fachada de entrada da aplicação.
- `src/core`: shell compartilhado, layout administrativo, estado de visão e cliente HTTP.
- `src/modules/sigba`: módulo de Bem-estar Animal. O nome técnico é mantido por compatibilidade.
- `src/modules/viveiro`: módulo do Viveiro Municipal.
- `src/pages`: telas históricas do Bem-estar Animal preservadas e progressivamente modularizadas.
- `src/components`: componentes compartilhados ou legados ainda usados pelo módulo Bem-estar Animal.
- `src/utils`: permissões, labels de apresentação e utilitários comuns.

## Identidade Visual e Textual

- Usar “Plataforma SIGMA” quando o texto se referir ao sistema guarda-chuva.
- Usar “Bem-estar Animal” quando o texto se referir ao módulo herdado do SIGBA.
- Usar “Viveiro Municipal” quando o texto se referir ao módulo de mudas, estoque, solicitações e entregas.
- Não expor “SIGBA” em textos institucionais, exceto quando o assunto for compatibilidade técnica ou histórico.

## Compatibilidade

O frontend mantém `module=sigba`, pastas `sigba`, classes históricas e entradas públicas antigas para evitar quebra de sessão, navegação e integrações. Qualquer migração desses nomes deve ser planejada com camada de redirecionamento e validação regressiva.

## Comandos

```powershell
npm.cmd --prefix frontend install
npm.cmd --prefix frontend run dev
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

## Entradas Locais

- Administração Bem-estar Animal: `http://127.0.0.1:5173/?view=admin&module=sigba`
- Administração Viveiro Municipal: `http://127.0.0.1:5173/?view=admin&module=viveiro`
- Portal do tutor: `http://127.0.0.1:5173/?view=portal`
- Área pública: `http://127.0.0.1:5173/?view=publico`

## Padrão Para Novos Módulos

Cada módulo novo deve ter:

- definição em `src/modules/<modulo>/app`;
- configuração visual e navegação em `src/modules/<modulo>/layout`;
- páginas próprias em `src/modules/<modulo>/pages`;
- serviços HTTP próprios em `src/modules/<modulo>/services`;
- permissões declaradas no utilitário compartilhado;
- uso do shell administrativo comum, sem duplicar autenticação ou cliente HTTP.

O módulo Viveiro Municipal é a referência atual para esse padrão.

## Linguagem

Textos visíveis devem seguir o guia em `backend/docs/guia-linguagem-produto.md`.

Regras rápidas:

- usar português formal, claro e acentuado;
- preservar enums, rotas, chaves e valores persistidos sem acento quando forem contrato técnico;
- mapear status técnicos para labels de apresentação;
- diferenciar linguagem cidadã, operacional interna e pública.
