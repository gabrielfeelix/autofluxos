# Handoff 02/out/2026: API pública pronta, falta o teste final

Para o próximo agente. As quatro fases de `docs/HANDOFF-02-OUT-API-PUBLICA.md`
estão no código, no ar e com banco aplicado. Falta **um** passo: o teste ponta
a ponta com chave real, feito junto com o Gabriel (dono, designer, não é dev).
O porquê de cada escolha está em `docs/DECISIONS.md` (entradas de 02/out, fases
2, 3 e 4); aqui só o estado e o roteiro.

## O que está no ar

| Fase | Commit | O quê |
|---|---|---|
| 1 | `9264382` | Chaves, `GET/POST /contatos`, `GET /fluxos`, disparar fluxo |
| 2 | `bb5ac37` | `GET /templates`, `POST /mensagens/template` (Idempotency-Key obrigatória, teto diário 500 ajustável em admin > organização > Plano) |
| 3 | `f39044b` | Webhooks de saída: seção na tela API, cron `/api/manutencao/webhooks`, caronas no webhook do WhatsApp e no pulso do Inbox |
| 4 | `385d11e` | `GET /contatos` paginado, `GET /etiquetas`, `GET /funil`, `GET/POST /funil/oportunidades`, `PATCH /funil/oportunidades/{id}` |
| banco | `5b588c6` | `0121` e `0122` aplicadas em produção (registro em `docs/BANCO-COMPARTILHADO.md`) |

Peças: rotas em `src/app/api/v1/`, helpers em `src/server/api/`
(`autenticar.ts`, `contatos.ts`, `templates.ts`, `funil.ts`), webhooks em
`src/server/webhooks-de-saida.ts` + `src/server/repos/webhooks-de-saida.ts`,
UI em `src/components/api/`, docs em `src/components/docs/paginas-api.tsx`
(15 páginas em `/ajuda/desenvolvedores`, conferidas contra o código: toda rota,
todo `codigo` de erro e todo escopo documentados).

Testes do arquivo de cada rota: `src/app/api/v1/{rotas,mensagens,funil}.test.ts`,
`src/server/webhooks-de-saida.test.ts`, `src/server/api/cursor.test.ts`,
`src/app/api/manutencao/webhooks/route.test.ts` (58 passando). Não rode a
suíte inteira.

## Diferenças do plano original (já decididas, não reabrir)

- `/funil/oportunidades`, não `/funil/cartoes`.
- Nova tentativa de webhook **pode atrasar**: Vercel Hobby roda cron 1x/dia;
  1ª tentativa no `after()`, as seguintes de carona (mensagem chegando no
  WhatsApp ou Inbox aberto) e o cron diário de piso.
- Modelo com mídia no cabeçalho: 422 `template_com_midia`.
- Idempotência guarda só envio que deu certo (202); recusa libera a chave.

## Teste final (com o Gabriel, em produção)

Preparação: no painel de produção, numa conta **Operação ou Escala**,
Configurações > API > Criar chave com **todas** as permissões. Exporte
`AUTOFLUXOS_CHAVE` e use `B=https://autofluxos.4yu.com.br/api/v1`. Telefone de
teste: DDD 44 é do Gabriel (memória `ddd-44-e-do-gabriel`); peça o número a ele.

- [ ] `POST $B/contatos` com `{"telefone":"<num>","etiquetas":["Nao existe"]}`: 201; de novo: 200; aviso da etiqueta em `avisos`
- [ ] `GET $B/contatos/<num>` com e sem o `55` e o nono dígito
- [ ] `GET $B/contatos?limite=1` e seguir `proximo_cursor` duas páginas sem repetir contato; `?etiqueta=<uma real>`
- [ ] `GET $B/etiquetas`, `GET $B/fluxos`
- [ ] disparar fluxo: 202 com a janela aberta (Gabriel manda "oi" antes), 409 `janela_fechada` num contato parado há mais de 24h
- [ ] chave sem o escopo dá 403; conta Essencial dá 403 `plano_sem_api`
- [ ] `GET $B/templates`; `POST $B/mensagens/template` com `Idempotency-Key: teste-1`: 202 e a mensagem chega no celular; repetir igual: mesma resposta com `Idempotent-Replayed: true` e **nada** chega; sem a chave: 400. **Cada envio é cobrado pela Meta**: mandar 2 ou 3, não mais
- [ ] teto: em admin > organização > Plano pôr `1`, enviar com chave nova: 429 `teto_diario`; depois **voltar para vazio**
- [ ] webhook: criar com uma URL do webhook.site marcando os 4 eventos, guardar o segredo, Testar (deve dar "Recebido"); criar um contato pela API e ver `contato.criado` chegar; conferir a assinatura com o código Node da página `webhooks-de-saida`
- [ ] nova tentativa: apontar o webhook para `https://httpstat.us/500`, gerar evento, ver "nova tentativa" na lista de entregas e a 2ª tentativa sair (abrir o Inbox ajuda a carona rodar); depois apagar esse webhook
- [ ] funil: `GET $B/funil`; `POST $B/funil/oportunidades` (201, de novo 200); `PATCH` com `etapa_id`, depois `{"situacao":"ganha","valor":10}` e ver `oportunidade.ganha` no webhook.site; `PATCH` de novo dá 409 `oportunidade_fechada`
- [ ] revogar a chave no painel e a próxima chamada dar 401
- [ ] exemplos copiados das páginas de `/ajuda/desenvolvedores` funcionam colados
- [ ] prints da tela API em produção (lista de chaves, criar, chave criada, webhooks) em 1440 e 390. Localmente já foram vistos (`.ux-local/print-api3.mjs`, `print-api4.mjs`)

Ao terminar: apagar a chave e os webhooks de teste, e marcar o resultado aqui
ou em `docs/DECISIONS.md` se algo mudou.

## Armadilhas

1. **Outra sessão trabalha no mesmo `main`.** Commite só os seus arquivos com
   índice temporário (`GIT_INDEX_FILE=<tmp> git read-tree HEAD`, `git add`,
   `git commit`, depois `git reset -q -- <seus caminhos>` no índice real).
2. Produção só pela Management API (`SUPABASE_ACCESS_TOKEN` em
   `.secrets/4yu.env`, ref `xxxynoshwirupkdzwxbj`), migration nova só com
   autorização explícita, ensaio com `rollback` antes.
3. Servidor local: o `next dev` da porta 3100 é da outra sessão; não suba
   outro (WSL). Sessão de print em `.ux-local/sessao.json`
   (`scripts/ux-local/entrar.mjs` renova).
4. Banco local (`supabase_db_autofluxos`) já tem `0120` a `0122`.
