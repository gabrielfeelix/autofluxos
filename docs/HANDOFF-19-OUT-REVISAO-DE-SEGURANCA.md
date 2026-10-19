# Handoff 19/out/2026: revisão de segurança dos nossos produtos

**Contexto e autorização.** AutoFluxos e Verandi são produtos da 4YU, do
Gabriel Barbosa, dono dos repositórios (`gabrielfeelix/autofluxos`,
`gabrielfeelix/verandi`), dos domínios (`*.4yu.com.br`) e do projeto Supabase.
Ele autoriza e pede esta revisão defensiva para **corrigir** falhas nos
próprios sistemas antes que alguém as explore. Nada aqui é contra sistema de
terceiros.

Gabriel não é dev: quer decisão tomada e implementada, resposta curta em
pt-BR.

## Leia antes

1. `4yu-apps/CLAUDE.md` (segredos, IDs, banco compartilhado).
2. `autofluxos/docs/BANCO-COMPARTILHADO.md` e `verandi/docs/BANCO-COMPARTILHADO.md`.
3. `autofluxos/docs/INCIDENTE-LGPD.md`.

## Já feito em 19/out (não refaça)

- Banco: RLS em todas as tabelas, funções `security definer` fechadas para
  `anon`, políticas da Verandi por ação, índices, SSL obrigatório.
- Next 16.4.2 e `npm audit` zerado nos dois; Dependabot ligado.
- Cabeçalhos de segurança nos dois (HSTS, `frame-ancestors`, `object-src`,
  `base-uri`, `form-action`, `nosniff`, Referrer-Policy, Permissions-Policy).
- Revisão de autorização no código (~310 ações e 47 rotas no AutoFluxos; 111
  ações, 11 rotas e 6 páginas de admin na Verandi). Corrigido: Verandi
  `c51617f` + migration `0083_vr`; AutoFluxos `26e07264`. Detalhe nos
  runbooks e nos commits.

## Parte 1: correções de código que ficaram (fazer primeiro)

Trabalho normal de desenvolvimento, com teste.

1. **AutoFluxos: escopo do Atendente nas ações de conversa.** As rotas
   `inbox/conversa`, `midia` e `aberta` já filtram por
   `acharLead(..., alcance)`, mas estas ações não:
   `acaoAtribuirPara` (`src/server/acoes.ts`), `acaoAtribuirContato` e
   `acaoAbrirPainelDoContato` (`src/server/acoes-crm.ts`),
   `acaoLiberarAtendimento` (`src/server/acoes.ts`), `acaoLerAtividades`
   (`src/server/acoes-atividades.ts`) e `acaoBuscarNasMensagens`
   (`src/server/acoes-busca.ts`). Com escopo `proprios`, aplicar o mesmo
   filtro de alcance. **Antes, perguntar ao Gabriel** em uma linha: atendente
   vê só as próprias conversas, ou a equipe vê tudo? O comentário de
   `src/server/distribuir-atendimento.ts` diz "todo mundo vê tudo", e as rotas
   dizem o contrário.
2. **Verandi: papel no banco para financeiro, recibo, plano e contrato.** As
   políticas dessas tabelas aceitam qualquer membro da conta; quem restringe
   por papel é o código (`exigirCaixa`, `exigirDono`, `exigirOperacional`).
   Para fechar no banco, primeiro mover para o servidor (`clienteAdmin`
   depois de conferir conta e papel) as gravações que hoje usam a sessão de
   qualquer papel: `src/server/agenda/avulsa.ts`,
   `src/server/financeiro/materializar.ts` (roda ao abrir a agenda) e
   `src/server/licencas/prorrogacao.ts`. Depois, migration trocando as
   políticas de escrita para `tem_papel(conta_id, ...)`, com os testes de
   `tests/` rodando no Supabase local.
3. **Pontos menores:** o webhook de saída da Verandi
   (`src/core/webhook/endereco.ts`) confere só o texto do host, não o IP para
   onde o nome resolve; `aceitarConvite` confere senha a partir do servidor,
   então o limite do Auth não conta por quem tenta; o segredo do webhook da
   Brevo vai na query string.

## Parte 2: verificação externa (depois da Parte 1)

Conferir de fora o que já foi conferido por dentro, sempre nos nossos
domínios. Produção tem cliente pagante: em produção, só leitura passiva;
qualquer teste que envie formulário ou grave dado roda no ambiente local
(Docker, `npx supabase start` + `next dev`). Um processo pesado por vez na
WSL.

- Produção, só leitura: OWASP ZAP no modo baseline (passivo) em
  `autofluxos.4yu.com.br` e `verandi.4yu.com.br`; `testssl.sh`; cabeçalhos
  em todas as rotas; se `/.env`, `/.git/config` ou source map de produção
  ficam acessíveis; o que `/api-docs` da Verandi mostra sem login.
- Local: com duas organizações de teste (telefone de teste é DDD 44),
  confirmar que uma não lê nem grava dado da outra pelas ações e rotas;
  webhooks sem assinatura válida recebem 401; upload recusa tipo e tamanho
  fora do permitido; a IA do AutoFluxos não grava nada sem a confirmação
  (`src/server/ia/politica.ts`).

## Entrega

Achados confirmados, mais graves primeiro, com a correção feita e testada; o
que for decisão vai ao Gabriel em uma linha. Banco: regras do runbook
(ensaio em transação, aplicador da Verandi, autorização explícita).

## Fora do escopo, já decidido

Troca do segredo JWT antigo (adiada), PITR, compute maior, teste de
restauração, backup do Storage em outro provedor, CSP completa com nonce.
