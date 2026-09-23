# Fechamento do plano de UX: um agente só (desde 23/09 à noite)

Os quatro worktrees (`../autofluxos-a1` a `a4`) foram apagados e nenhum outro
agente está rodando. O que falta do plano é feito por **um agente só**, na
pasta `../autofluxos-ux`, branch `ux/restante`, `PORTA=3101`, com push na
`main` a cada tarefa (rebase `--autostash` antes). Os registros por tarefa
continuam no `aN.md` da fase (a1 = 5 e 6, a2 = 5.9, 7 e 8, a3 = 9 e 10,
a4 = 11 e 12).

## Onde parei

Feito, tudo na `main`, deploys READY:

| Tarefa | Commit |
|---|---|
| 10.1, 10.4 passo 3, achado do A2, 5.7, 5.8, 5.9 | `cc883ed` a `1073709` |
| 6.1 prévia com o consumo real do dia | `b9e911d` |
| 6.2 progresso numa consulta (migration **0096**) | `458f6ba` |
| 6.3 filtros, detalhe por destinatário, próxima ação | `9d1b881` |
| 6.4 estado da conexão em camadas (inclui a troca de `falhaDoCanal`) | `924d406` |
| 6.5 cartões de integração com ação escrita | `5674660` |

Detalhes e desvios de cada uma em `a1.md` (Fase 6 é do A1).

**Próximo, na ordem:**

1. 6.6 (WhatsApp: blocos saúde, respostas, webhook) e 6.7 (chaves de API).
   O bloco de saúde da 6.6 já existe em parte: `CamadasDaConexao` no topo da
   tela do WhatsApp (6.4). Juntar a ele sincronização e reconectar.
2. Fase 8 (8.1 a 8.6). Somar o achado da 5.9: **Inbox no celular (390 px)
   mostra lista e conversa lado a lado**, a conversa sai cortada.
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
- `0096_progresso_das_transmissoes.sql` (função só leitura, `service_role`):
  sem ela `progressoDas` cai na leitura antiga, uma por transmissão, que
  também corta em 1.000 destinatários.
- `0097_teste_das_chaves.sql` (6.7, duas colunas anuláveis em `connections`):
  sem ela a tela de Chaves funciona, só diz "nunca testada" para a agenda.

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
- `prints.mjs` aceita `LARGURAS='[[320,700,"-320"]]'` e ganhou as telas
  `whatsapp`, `instagram`, `anuncios`. Scripts de print em `.ux-local/`:
  `voce.mjs`, `webhook.mjs`, `anotar.mjs`, `transmissao.mjs`,
  `transmissoes-lista.mjs`, `conexoes.mjs` (criam dado "zz print" e apagam no
  fim). A conta de revisão não tem canal: `conexoes.mjs` cria um WhatsApp e um
  Instagram temporários.
- Push na `main` é deploy: código que lê coluna nova precisa tolerar a
  migration ainda não aplicada (ver `listarWebhooks`, erro 42703).
