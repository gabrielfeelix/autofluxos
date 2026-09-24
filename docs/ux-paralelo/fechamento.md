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

Feito, tudo na `main`:

| Tarefa | Commit |
|---|---|
| 10.1, 10.4 passo 3, achado do A2, 5.7, 5.8, 5.9 | `cc883ed` a `1073709` |
| 6.1 a 6.7 | `b9e911d` a `3d51465` (migrations **0096**, **0097**) |
| 8.1 a 8.5 | `589bf38` a `1f8dd4d` |
| 8.6 foco, toque, envios parciais, importação só das recusadas | `f8ad517` |
| 7.5 passo 6: e2e do atendimento pelo rodapé | `737b5d1` |
| Revisão A1 `ba6eff4` e Fase 7: três achados corrigidos | `2378342` |
| Fase 12: jornadas e quatro correções de volta | `b568586` |
| Fase 12: editor no celular (gaveta de blocos, sem rolar de lado), Testar abre o painel | `5357659` |
| Fase 12: 80 prints finais, 33 rotas "Validada em navegador" | `fd02f42` |
| 12.2: editor volta com a busca, reparo do WhatsApp volta para a transmissão, "sem fluxo" diz onde escolher | `a75e027` |

Detalhes: 6.x em `a1.md`, 8.x em `a2.md`, Fase 12 em `fase-12.md`.

**O plano de UX acabou, menos:**

1. **Decisão do Gabriel:** Inbox e Contatos recortam por escopo "só os
   próprios"? Hoje mostram tudo, e o Início conta igual ao Inbox.
2. **Transmissão por segmento** (achado da Fase 12): o público da transmissão
   só pode ser etiqueta; segmento salvo não leva a lugar nenhum. É
   funcionalidade nova (congelar a lista do segmento na confirmação, RB-38), não
   conserto de tela. Precisa de plano próprio.
3. **10.6 bloqueada:** `autofluxos.mail.4yu.com.br` não existe no DNS; falta o
   domínio na Brevo com DKIM.

**Deploy:** a Vercel bateu a cota diária de novo em 23/09 à noite (o Gabriel
confirmou). `5357659`, `fd02f42`, `a75e027` e este commit estão parados; o
primeiro deploy depois que a cota voltar publica todos: conferir que deu
READY com `.ux-local/deploy.sh <sha do último>`.

**Ambiente local nesta máquina (23/09 à noite):** o Docker Desktop voltou,
mas sem `/var/run/docker.sock` no WSL, e a porta 56431 do Kong está presa por
uma conexão do Antigravity no Windows. Contorno usado, fora do repositório:
`docker` apontando para `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe`,
o container `fwd-kong-ux` (socat, `--restart unless-stopped`) na **56441** até
o Kong, e o dev com `SUPABASE_URL=http://127.0.0.1:56441` e a chave
publicável local fixa. Com a 56431 presa, o e2e (que lê o `.env.teste-local`)
não sobe; fechar o Antigravity ou reiniciar o Kong depois resolve. Quando a
56431 voltar, `docker.exe rm -f fwd-kong-ux`.

Scripts de print novos: `.ux-local/testar.mjs`, `reparo.mjs`,
`atalho-atende.mjs`, `largo.mjs` (acha o elemento que alarga a página no
celular), além dos anteriores. O e2e (`npx playwright test`) sobe o próprio
`next dev` na `PORTA`: pare o seu antes, e depois desfaça o `tsconfig.json`
que ele reescreve.

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
