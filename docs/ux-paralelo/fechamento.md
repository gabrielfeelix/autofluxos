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
| 8.6 foco, toque, envios parciais, importação só das recusadas | `f8ad517` |
| 7.5 passo 6: e2e do atendimento pelo rodapé | `737b5d1` |
| Revisão A1 `ba6eff4` e Fase 7: três achados corrigidos | `2378342` |
| Fase 12 (parcial): varredura, jornadas, quatro correções de volta | `b568586` |

Detalhes e desvios: 6.x em `a1.md`, 8.x em `a2.md`.

**Próximo, na ordem:**

1. **Docker voltar** (caiu às 21:59 de 23/09; é o Docker Desktop do Windows,
   não sobe pelo WSL). Depois: `npx supabase status`, dev na 3101.
2. Fase 12, o que falta: conferir no navegador a ida e volta do gatilho
   (`.ux-local/j11.mjs`), "Segmento → transmissão" e "Testar"; prints finais
   em `docs/revisao-ux-ui-2026-09-23/prints-depois/` com
   `PRINTS=docs/revisao-ux-ui-2026-09-23/prints-depois node .ux-local/varredura.mjs`
   (jpg, dono, desktop e celular); atualizar `00-cobertura.md` para
   "Validada em navegador" (as 45 rotas da varredura) e fazer o passo 4.
   Registro em `docs/ux-paralelo/fase-12.md`.
3. Tarefa 12.2 no plano: itens abertos (um pede decisão do Gabriel: Inbox e
   Contatos recortam por "só os próprios"?).
4. 10.6 continua **bloqueada**: Brevo sem `autofluxos.mail.4yu.com.br`.

**Deploy:** a cota da Vercel voltou em 23/09 à noite; `f8ad517` e
`2378342` READY (levaram 8.3 a 8.6 juntas). Commit pulado pela Vercel por
outro mais novo aparece `AUSENTE` no `deploy.sh`: conferir o seguinte.

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
