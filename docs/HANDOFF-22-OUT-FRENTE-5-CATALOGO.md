# Handoff: 22/out/2026 (noite), frente 5 continua

Continua `docs/HANDOFF-22-OUT-FRENTES-4-E-5.md`. Frente 4 e o primeiro item da
frente 5 (formulário de agendamento) estão no código. Falta o **catálogo
oficial do WhatsApp** e a prova ao vivo do formulário.

## Leia antes

1. `docs/HANDOFF-22-OUT-FRENTES-4-E-5.md` (regras e armadilhas).
2. `docs/BANCO-COMPARTILHADO.md` e `AGENTS.md` antes de qualquer migration.
3. `4yu-apps/PENDENCIAS-DO-GABRIEL.md`, seção AutoFluxos (duas migrations
   esperando autorização).

## Feito nesta sessão

| Commit | O quê |
|---|---|
| `511bc303` | Webhooks `cobranca.paga` e `cobranca.vencida` (só quando `mudarStatus` muda); `GET`/`POST /api/v1/cobrancas` com `Idempotency-Key`; escopos `cobrancas:ler`/`cobrancas:criar`; docs de devs |
| `ff3839cb` | **Correção**: a 0141 já estava em produção e eu tinha editado no lugar. Voltou ao original; origem `api` foi para a `0142_cobranca_pela_api` |
| `138aa3ad` | Formulário nativo de agendamento (WhatsApp Flows) ligado à Verandi, bloco **Agendar**, cartão de ativação, `0143_formularios_do_whatsapp` |

**Produção:** 0142 e 0143 aplicadas em 22/out/2026, com autorização (registro
em `docs/BANCO-COMPARTILHADO.md`). Falta só o Gabriel ativar o formulário no
número da MGM.

## Formulário de agendamento: como está

- Cripto: `src/server/formularios-do-whatsapp/cripto.ts` (teste de ida e volta).
- Telas e regras puras: `src/core/formulario-de-agendamento.ts` (Flow JSON 7.1,
  API de dados 3.0, telas DIA, HORARIO, CONFIRMADO).
- Endpoint: `src/app/api/webhook/formulario-whatsapp/[id]/route.ts` (432
  assinatura, 421 decifrar, 427 token) e `server/formularios-do-whatsapp/endpoint.ts`.
- Token: HMAC derivado do `BETTER_AUTH_SECRET`, vale `horasParaDesistir`.
- Conversa: `acordarFluxoDoFormulario` e `rodarDesistenciaDoFormulario` em
  `server/receber-mensagem.ts`; o endpoint acorda "marcou" no `after()`; o
  `nfm_reply` é rede de segurança e não chega ao motor.
- Ativação: `server/formularios-do-whatsapp/ativar.ts` (chave pública no
  número, cria Flow com `endpoint_uri`, liga `application_id`, publica).

**Não validado ao vivo** (precisa ativar no número da MGM):
- se a Meta aceita o Flow JSON 7.1 como está (os `validation_errors` vão para
  o cartão);
- se `POST /{flow_id}` com `application_id` é aceito com o token do número;
- se o ping de saúde passa (resposta `{"data":{"status":"active"}}` cifrada);
- o tamanho do `flow_token` (~150 caracteres; a doc não dá limite).
Ao ativar, o erro da Meta aparece escrito no cartão. Corrija e "Tentar de novo"
(cada passo pula o que já foi feito).

Local semeado para print: conta `71aa7f92-...`, credencial "Verandi (agenda)"
falsa e canal `45f62fc5-...` com WABA e token falsos. Print em
`.ux-local/formulario-agenda.mjs`.

## Próximo: catálogo oficial do WhatsApp (6 a 10 dias)

Do `HANDOFF-21-OUT-PROXIMAS-FEATURES.md`, item 4: sincronizar o catálogo
próprio e o da Nuvemshop com o Commerce Manager, mensagem de produto e
multiproduto, receber o carrinho (`order` no webhook). Se exigir Commerce
Manager ligado pelo Gabriel, anote em `PENDENCIAS-DO-GABRIEL.md` e adiante o
que der. Já existe `enviarProdutos`/`enviarProdutoComBotao` em
`channels/cloud-api.ts` (conferir o que usam hoje antes de começar).
