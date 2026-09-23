# Fechamento do plano de UX: um agente só (desde 23/09 à noite)

Os quatro worktrees (`../autofluxos-a1` a `a4`) foram apagados e nenhum outro
agente está rodando. O que falta do plano é feito por **um agente só**, na
pasta `../autofluxos-ux`, branch `ux/restante`, `PORTA=3101`, com push na
`main` a cada tarefa (rebase `--autostash` antes). Os registros por tarefa
continuam no `aN.md` da fase (a1 = 5 e 6, a2 = 5.9, 7 e 8, a3 = 9 e 10,
a4 = 11 e 12).

## Onde parei

Feito nesta sessão, tudo na `main`, deploys READY:

| Tarefa | Commit |
|---|---|
| 10.1 grupos por intenção em Configurações | `cc883ed` |
| 10.4 Passo 3: Ajuda no menu "Você" | `71cd77d` |
| Achado do A2: atalhos do Início só para o que a pessoa abre | `5443836` |
| 5.7 webhook mostra a última chamada (migration **0095**) | `6fc7770` |
| 5.8 abas e barra de seções no celular | `2be7307` |
| 5.9 anotações da equipe como histórico (sem migration) | `1073709` |

**Próximo, na ordem:**

1. Fase 6 inteira (6.1 a 6.7). Na 6.4, trocar `falhaDoCanal` do Início pela
   `estadoDaConexao` (pendência do A3).
2. Fase 8 (8.1 a 8.6). Somar o achado da 5.9: **Inbox no celular (390 px)
   mostra lista e conversa lado a lado**, a conversa sai cortada (já era assim).
3. 7.5 Passo 6: e2e do membro de atendimento (trocar nome e foto pelo rodapé,
   menu sem Configurações) e os testes "editar perfil só altera o próprio" e
   "nome vazio é recusado", se ainda não existirem.
4. Revisar os merges que o A4 não revisou (A1 `ba6eff4`, A2 Fase 7).
5. Fase 12 (validação integrada), com as personas criadas no local. Provar ali
   que atendimento não vê o atalho "Automações ›" no Início.
6. 10.6 continua **bloqueada**: Brevo sem `autofluxos.mail.4yu.com.br`.

## Pendente para produção (precisa de autorização do Gabriel)

- `0094_avatares.sql` (A2): sem ela, trocar foto de perfil falha.
- `0095_webhook_recusado.sql`: sem ela a tela funciona (lê sem a coluna), só
  não mostra "assinatura inválida".

## Ambiente (armadilhas desta sessão)

- O banco local estava **vazio e parado na 0087**. `npx supabase migration up
  --local` aplica o que falta (psql direto no container é bloqueado pelo modo
  automático). Depois: `PORTA=3101 node scripts/ux-local/cadastro.mjs` e
  `npx tsx scripts/ux-local/seed.mts` (com `.env.teste-local` carregado).
- A replay deixou `lojas_integradas` sem grant para `service_role` no local
  (Configurações quebrava). Grant feito só no Docker.
- Deploy: `.ux-local/deploy.sh <sha>` consulta a API da Vercel com o
  `VERCEL_TOKEN` de `.secrets/4yu.env` (o conector da Vercel não enxerga o
  projeto).
- `prints.mjs` aceita `LARGURAS='[[320,700,"-320"]]'`. Scripts de print desta
  sessão em `.ux-local/`: `voce.mjs`, `webhook.mjs`, `anotar.mjs` (criam dado
  e apagam no fim).
- Push na `main` é deploy: código que lê coluna nova precisa tolerar a
  migration ainda não aplicada (ver `listarWebhooks`, erro 42703).
