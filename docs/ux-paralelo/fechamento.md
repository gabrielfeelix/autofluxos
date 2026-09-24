# Fechamento do plano de UX: um agente só (desde 23/09 à noite)

Os quatro worktrees (`../autofluxos-a1` a `a4`) foram apagados e nenhum outro
agente deste plano está rodando (mas **outra sessão** trabalha no plano da
casca e do celular, `docs/PLANO-CASCA-ESQUELETOS-CELULAR.md`, mexendo em
moldura, barras e Inbox no celular: `git fetch` antes de cada tarefa). O que falta do plano é feito por **um agente só**, na
pasta `../autofluxos-ux`, branch `ux/restante`, `PORTA=3101`, com push na
`main` a cada tarefa (rebase `--autostash` antes). Os registros por tarefa
continuam no `aN.md` da fase (a1 = 5 e 6, a2 = 5.9, 7 e 8, a3 = 9 e 10,
a4 = 11 e 12).

## Onde parei

Feito, tudo na `main` (deploys READY até a 8.2; da 8.3 em diante ver
"Deploy parado" abaixo):

| Tarefa | Commit |
|---|---|
| 10.1, 10.4 passo 3, achado do A2, 5.7, 5.8, 5.9 | `cc883ed` a `1073709` |
| 6.1 prévia com o consumo real do dia | `b9e911d` |
| 6.2 progresso numa consulta (migration **0096**) | `458f6ba` |
| 6.3 filtros, detalhe por destinatário, próxima ação | `9d1b881` |
| 6.4 estado da conexão em camadas (inclui a troca de `falhaDoCanal`) | `924d406` |
| 6.5 cartões de integração com ação escrita | `5674660` |
| 6.6 cartão do número: saúde, respostas, webhook | `01d3617` |
| 6.7 chaves: testar, trocar, excluir (migration **0097**) | `3d51465` |
| 8.1 estado do atendimento igual no Inbox e na ficha | `589bf38` |
| 8.2 compositor com três modos e respostas rápidas por teclado | `ae32e1a` |
| 8.3 próximos passos por destino, três tipos na aba, resumo no topo | `737e144` |
| 8.4 ganhar/perder, segmento e funil dizem o efeito | `b2bde21` |
| 8.5 `?aba=`/`?volta=`, aviso de fora do filtro, `recarregarContato`, e2e | `1f8dd4d` |

Detalhes e desvios: 6.x em `a1.md`, 8.x em `a2.md`.

**Próximo, na ordem:**

1. 8.6 (acessibilidade e envios parciais). Já feito de brinde na 8.3:
   `horaComFuso` ("(Brasília)") nas agendadas da ficha e `prazoEmPalavras`
   por dia quando não há hora. Falta no passo 4 o painel `agendar.tsx`
   (`quandoLegivel`). O Inbox no celular **já foi resolvido** pela outra
   sessão (`0deeb1c`, uma coluna por vez): não mexer em `inbox/moldura.tsx`.
2. 7.5 Passo 6: e2e do membro de atendimento (trocar nome e foto pelo rodapé,
   menu sem Configurações) e os testes "editar perfil só altera o próprio" e
   "nome vazio é recusado", se ainda não existirem.
3. Revisar os merges que o A4 não revisou (A1 `ba6eff4`, A2 Fase 7).
4. Fase 12 (validação integrada), com as personas criadas no local. Provar ali
   que atendimento não vê o atalho "Automações ›" no Início.
5. 10.6 continua **bloqueada**: Brevo sem `autofluxos.mail.4yu.com.br`.

**Deploy parado (23/09, 20:37):** a Vercel recusa com "Deployment rate
limited, retry in 24 hours" (cota diária do Hobby; prévia de branch também
conta). `737e144`, `b2bde21` e `1f8dd4d` estão na `main` sem deploy. O
`deploy.sh` só diz `AUSENTE`; o motivo aparece no status do commit:
`GH_TOKEN=$GITHUB_TOKEN gh api repos/gabrielfeelix/autofluxos/commits/<sha>/status`.
Quando a cota voltar, o próximo push publica tudo junto: conferir READY.
Para gastar menos, esta sessão parou de empurrar a branch `ux/restante`.

Scripts de print novos: `.ux-local/ficha.mjs` (8.3, cria agendada "zz
print"), `efeitos.mjs` (8.4, desfaz os cartões que criar), `texto-aba.mjs`.
O e2e (`npx playwright test`) sobe o próprio `next dev` na `PORTA`: pare o
seu antes, e depois desfaça o `tsconfig.json` que ele reescreve.

## Produção

`0094` a `0097` aplicadas em 23/09 com autorização do Gabriel (registro em
`docs/BANCO-COMPARTILHADO.md`). Data API conferida em 23/09 nos dois produtos:
`connections` com `testada_em`/`teste_ok` em 200, a RPC
`progresso_das_transmissoes` em 401 para a chave pública, e `app_verandi.conta`
com `Accept-Profile` em 200. Nada pendente na produção.

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
