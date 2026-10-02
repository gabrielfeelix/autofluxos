# Handoff 02/out/2026: API pública, fases 2 a 4

Para o próximo agente. O plano inteiro, com as decisões fechadas de cada fase,
está em `docs/HANDOFF-02-OUT-API-PUBLICA.md`: **leia aquele primeiro**, este
arquivo só diz onde a fase 1 parou e o que muda no jeito de trabalhar.

## Pedido do Gabriel (dono, designer, não é dev)

"Faz todas as fases primeiro, a gente testa tudo no final." Então:

- implemente as fases 2, 3 e 4 em sequência, com commit e push ao fim de cada
  uma (deploy conferido na Vercel, projeto `autofluxos`);
- **não** pare para o teste ponta a ponta com chave real entre as fases; ele
  acontece uma vez só, no fim (lista na última seção);
- tsc limpo e o teste do arquivo de cada rota continuam obrigatórios em toda
  fase. Não rode a suíte inteira.

## Fase 1: pronta e no ar (commit `9264382`)

| Peça | Onde |
|---|---|
| Migration (aplicada em produção 02/out) | `supabase/migrations/0120_chaves_de_api.sql` |
| Formato da chave, escopos, máscara | `src/core/api/chaves.ts` (`ESCOPOS_DA_API`, cada um com `fase`) |
| Porta de toda rota | `src/server/api/autenticar.ts`: `autenticarChave`, `erroDaApi`, `lerCorpo`, `CodigoDeErro` |
| Repo das chaves | `src/server/repos/chaves-de-api.ts` |
| Contato por telefone (único, usado em 3 lugares) | `src/server/repos/contato-por-telefone.ts` |
| Criar/atualizar contato pela API | `src/server/api/contatos.ts` (`gravarContatoDaApi`: reuse na fase 2) |
| Rotas | `src/app/api/v1/` e o teste `src/app/api/v1/rotas.test.ts` |
| Ações criar/revogar (admin, auditoria) | `src/server/acoes-api.ts` |
| Tela | `src/app/clientes/[clienteId]/ajustes/api/page.tsx` + `src/components/api/chaves-de-api.tsx` |
| Docs | `src/components/docs/paginas-api.tsx` (grupo API, entra em `PAGINAS_DEV`) |
| Plano | recurso `api` em `core/planos.ts`; na produção, `planos.recursos` de `operacao` e `escala` já têm `api` |

Para acrescentar um escopo: entra em `ESCOPOS_DA_API` com `fase`, e a tela de
criar chave mostra sozinha. Código de erro novo: acrescente em `CodigoDeErro` e
na tabela de `ErrosELimites` em `paginas-api.tsx`.

`Resposta` (docs, `referencia.tsx`) agora aceita `corpo` (o JSON real). Sem
corpo e sem texto, a linha não abre. **Toda resposta nova leva `corpo`**: a
sanfona vazia foi reclamação do Gabriel.

## Armadilhas que já custaram tempo nesta fase

1. **Outra sessão trabalha na mesma árvore, no `main`.** Ela commitou um
   arquivo meu antes do repo de que ele dependia e quebrou o build. Antes de
   commitar: `git status`, e se houver mudança alheia, commite só a sua com
   índice temporário:
   `GIT_INDEX_FILE=<tmp> git read-tree HEAD`, `git add <seus caminhos>`,
   provar que compila (`git checkout-index -a --prefix=<dir>/`, symlink de
   `node_modules`, `npx tsc --noEmit -p .`, ignorando só `RouteContext`/
   `PageProps`, que são tipos gerados do `.next`), `git commit`, e depois
   **`git reset -q -- <seus caminhos>`** no índice real, senão o índice velho
   desfaz o seu commit no próximo commit da outra sessão.
2. **Zod 4: `z.uuid()` é estrito (versão RFC)** e recusa uuid que o Postgres
   aceita. Use `z.guid()` para id vindo de fora.
3. **Servidor local:** a outra sessão mantém um `next dev` na porta 3100, que
   ficou travado (90 s por página). Não suba um segundo (regra da WSL). Se
   continuar travado, peça ao Gabriel para reiniciá-lo antes dos prints. Script
   de print com sessão: `.ux-local/print-api2.mjs` (fluxo criar chave);
   `scripts/ux-local/entrar.mjs` renova a sessão.
4. **Banco local** (`supabase_db_autofluxos`, porta 56432) já tem a 0120, e o
   plano `operacao` local ganhou `api` à mão. A conta "Studio Pilates Revisão"
   (`afacb27c-ec60-44a7-be3e-a66f4fc60976`) é Operação: use para ver a tela com
   o recurso; "Conta Vazia Revisão" é Essencial (estado sem plano).
5. **Produção:** Management API com `SUPABASE_ACCESS_TOKEN` do cofre e o ref
   literal `xxxynoshwirupkdzwxbj` (`POST /v1/projects/<ref>/database/query`).
   Antes, ensaio `begin; <migration sem notify>; <conferências>; rollback;` e
   releitura de que nada sobrou. Depois, grants e Data API (`.env` local tem a
   chave secreta e a publicável da produção) e Verandi intacta
   (`app_verandi.migrations_aplicadas`, tabelas, policies de
   `storage.objects`). Registrar no `docs/BANCO-COMPARTILHADO.md` como a
   entrada da `0120`.
6. **Migration só com autorização explícita do Gabriel, a cada uma.** "Testa
   no final" não autoriza aplicar. Junte as migrations de uma fase e peça uma
   vez, dizendo o que cada uma cria. Número pelo disco: hoje a última é
   `0120`. Confira também se a Verandi está no meio de alteração
   (`git -C ../verandi status -- supabase`).

## O que fazer em cada fase (resumo; o detalhe está no plano)

**Fase 2, enviar template.** `GET /api/v1/templates` e
`POST /api/v1/mensagens/template`, escopo `mensagens:enviar` (na tela,
desmarcado por padrão e com aviso de custo: a Meta cobra toda mensagem desde
01/out/2026). Reuse o caminho de `acaoRetomarComModelo`
(`src/server/acoes-transmissoes.ts` ~612-667). `Idempotency-Key` obrigatório
(tabela nova, 24h), teto diário por organização (padrão 500, ajustável no
admin, 429 `teto_diario`). Contato inexistente é criado com
`gravarContatoDaApi`.

**Fase 3, webhooks de saída.** Tabelas `webhooks_de_saida` (segredo no Vault,
`src/server/cofre.ts`) e `entregas_de_webhook`. Emissão em `anotar`
(`src/server/repos/eventos.ts`) para `contato.criado`, `contato.etapa_mudou`,
`oportunidade.ganha`, `oportunidade.perdida`. Envio por `src/server/efeitos/rede.ts`
(anti-SSRF), 10 s, assinatura `x-autofluxos-assinatura: sha256=<hmac de
"timestamp.corpo">` + `x-autofluxos-timestamp`, novas tentativas 1 min, 5 min,
30 min, 2 h, 12 h, pausa após 20 falhas seguidas. Cron novo em `vercel.json`
com `CRON_SECRET` + `after()` na emissão. UI: seção Webhooks na mesma tela API.
Docs: página com o formato de cada evento e como conferir a assinatura.

**Fase 4, leitura e funil.** `GET /api/v1/contatos` paginado por cursor e
filtro por etiqueta e data; `GET /api/v1/etiquetas`; `GET /api/v1/funil`;
`POST /api/v1/funil/cartoes` e `PATCH .../{id}`, escopos `funil:ler` e
`funil:escrever` (repos em `src/server/repos/quadros.ts`).

Regras de sempre: tom de SaaS B2B, sem travessão, placeholder começa com
"Exemplo:", ações otimistas sem `revalidatePath` da rota aberta, print em 1440
e 390 antes de dizer que a tela está pronta, chave nunca em log, auditoria
ou mensagem de erro (só o `publico`), decisão nova em `docs/DECISIONS.md`.

## Teste final (fazer junto com o Gabriel, depois da fase 4)

Com uma chave criada no painel de produção, numa conta Operação ou Escala:

- [ ] `POST /contatos` dá 201 e, no mesmo telefone, 200; etiqueta inexistente volta em `avisos`
- [ ] `GET /contatos/{telefone}` com e sem o 55 e o nono dígito
- [ ] `GET /fluxos` e disparo: 202 com a janela aberta, 409 `janela_fechada` com ela fechada
- [ ] chave sem o escopo dá 403; conta Essencial dá 403 `plano_sem_api`
- [ ] revogar no painel e a chamada seguinte dar 401
- [ ] template com `Idempotency-Key` repetida não manda duas vezes; teto diário dá 429
- [ ] webhook de saída recebido num endpoint de teste (ex.: webhook.site), assinatura conferida, nova tentativa depois de falha
- [ ] leitura paginada e mover cartão no funil
- [ ] prints da tela API (lista, criar, chave criada, webhooks) em 1440 e 390; até aqui só o estado sem plano em 1440 foi visto
- [ ] exemplos das páginas de `/ajuda/desenvolvedores` funcionam copiados e colados
