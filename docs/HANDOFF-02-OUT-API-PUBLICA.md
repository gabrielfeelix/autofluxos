# Handoff 02/out/2026: API pública do AutoFluxos (chaves, REST e webhooks de saída)

Para o próximo agente. Plano fechado com o Gabriel (dono, designer, não é dev).
Leia antes, nesta ordem: `AGENTS.md`, `docs/BANCO-COMPARTILHADO.md` **inteiro**,
`docs/DECISIONS.md` (fim), e a área de desenvolvedores já publicada
(`src/components/docs/paginas-dev.tsx`, rota `/ajuda/desenvolvedores`).

## Por que existe

Hoje um sistema de fora só fala com o AutoFluxos por **uma** porta: o webhook
de entrada (`POST /api/webhook/entrada/{clienteId}`, HMAC), que abre um fluxo
para um contato **que já existe** e só **dentro da janela de 24h**. Não há
chave de API, nem REST, nem aviso de saída. Concorrentes (RD, Kommo, Blip,
Zenvia) têm os três, e "tem API?" é pergunta de checklist em B2B.

Quem vai usar, em ordem de probabilidade:

1. **Agência ou freelancer** que implanta para clínica, estúdio, loja: liga
   formulário, landing page ou o sistema do cliente no WhatsApp.
2. **Empresa com sistema próprio** (agenda de clínica, ERP, matrícula): quer
   "quando X acontece no meu sistema, mande mensagem". Lembrete e cobrança
   caem fora da janela, então precisam de **template**.
3. **Quem já usa CRM** (RD, Pipedrive, HubSpot): quer o lead do WhatsApp lá.
   Isso é **webhook de saída**, não REST.
4. BI e relatório: raro em PME. Fica por último.

## O que já existe e deve ser reaproveitado (não reescreva)

| Peça | Onde |
|---|---|
| Telefone canônico | `src/core/contatos/telefone.ts` (`chavesDoTelefone`, `telefoneCanonico`) |
| Achar ou criar contato | `src/server/repos/conversas.ts` `acharOuCriarContato` (devolve `criadoAgora`); `contacts` é `unique(client_id, wa_id)` |
| Achar por telefone | `acharContatoPeloTelefone` em `src/server/receber-evento.ts` (privada, duplicada em `receber-lead-do-formulario.ts`): **extraia para um repo** e use nos três |
| Campos tipados | `src/server/repos/campos.ts` `gravarCampos` (RPC, mescla, devolve recusados) |
| Etiquetas | `src/server/repos/etiquetas.ts` `listarEtiquetas`, `marcarContatos` |
| Origem do lead | `contacts.campos.origem`, primeiro toque congelado (`receber-mensagem.ts` ~591-681; `receber-lead-do-formulario.ts:156` usa `'Formulário'`) |
| Funil | `src/server/quadro-de-entrada.ts` `porNoQuadroPadrao`; `src/server/repos/quadros.ts` `moverCartao`, `fecharCartao` |
| Abrir fluxo | `src/server/receber-mensagem.ts` `abrirFluxoParaContato` (resultados `aberto`, `janela_fechada`, `sem_contexto`, `automacao_pausada`, `atendimento_humano`, `sem_fluxo`, `ocupado`) |
| Enviar template | caminho de `acaoRetomarComModelo` em `src/server/acoes-transmissoes.ts` (~612-667): `podeEnviar(status)`, `canal.enviarTemplate`, `registrarSaida` |
| Janela 24h | `src/channels/janela.ts` (`dentroDaJanela`, `permissaoDeEnvio`) |
| Linha do tempo | `src/server/repos/eventos.ts` `anotar` (tipos em `src/core/crm.ts` `TIPOS_DE_EVENTO`) |
| Limite de chamadas | `src/server/limite.ts` `consumirLimite(chave, teto, janela)` (Postgres, falha fecha) |
| Recurso do plano | `src/core/planos.ts` `RECURSOS_DO_PLANO` + `src/server/recursos-do-plano.ts` `recursoLiberado(clienteId, recurso)` |
| Papéis | `src/core/permissoes.ts` (owner, admin, member); `src/server/sessao.ts` `podeAdministrarConta` |
| Cofre | `src/server/cofre.ts` (Supabase Vault) |
| Auditoria | `src/server/repos/auditoria.ts` `registrar` (tabela `af_auditoria`, append-only) |
| Anti-SSRF de saída | `src/server/efeitos/rede.ts` (só https, IP fixado, recusa rede privada) |
| Webhook de entrada (modelo de rota) | `src/app/api/webhook/entrada/[clienteId]/route.ts` (ordem das defesas: tamanho, limite, auth, plano, schema) |

## Decisões fechadas

**Chave**
- Formato: `af_live_<id>_<segredo>`. `id` = 12 caracteres públicos (acha a
  linha), `segredo` = 32 bytes aleatórios em base62. Prefixo reconhecível de
  propósito (varredura de segredo do GitHub e quem achar a chave colada).
- Guardar **só o SHA-256 do segredo** (alta entropia, não precisa de bcrypt) e
  os 4 últimos caracteres para a tela. **Não** usar o Vault aqui: a chave é
  conferida a cada chamada e nunca precisa ser lida de volta. Comparação em
  tempo constante.
- Mostrada **uma vez**, na criação. Revogar é imediato (sem cache).
- Envio: `Authorization: Bearer af_live_...`. O `clienteId` vem **sempre da
  chave**, nunca do corpo ou do caminho.
- Quem cria e revoga: owner e admin (`podeAdministrarConta`). Criar e revogar
  vão para `af_auditoria`.
- Recurso de plano novo `'api'` em `RECURSOS_DO_PLANO` (aparece sozinho na
  tela de planos do admin). Sem o recurso: 403 com `recusaDoPlano`. Liberado
  nos planos maiores; o Gabriel decide quais na tela de admin.

**Escopos** (checkbox na criação, a chave só faz o que marcou)
- `contatos:ler`, `contatos:escrever`, `fluxos:disparar` (fase 1)
- `mensagens:enviar` (fase 2, desmarcado por padrão, com aviso de custo)
- `funil:ler`, `funil:escrever` (fase 4)
- Webhooks de saída não usam escopo: são configurados no painel.

**Contrato REST**
- Base `/api/v1`, JSON, nomes em português como o resto do produto
  (`telefone`, `nome`, `campos`, `etiquetas`).
- Erro sempre `{ "erro": { "codigo": "janela_fechada", "mensagem": "..." } }`
  com status HTTP certo (400, 401, 403, 404, 409, 413, 422, 429). `codigo` é
  estável e documentado; `mensagem` é para gente.
- Limites: 120 chamadas/min por chave (`consumirLimite('api:<chaveId>',120,60)`),
  corpo até 64 KB. Resposta 429 traz `Retry-After`.
- `/api/v1` entra em `PREFIXOS_ABERTOS` de `src/proxy.ts` (sem sessão); a rota
  autentica pela chave. Confira o `proxy.test.ts`.
- Um helper só, `src/server/api/autenticar.ts`:
  `autenticarChave(request, escopo) -> { clienteId, chaveId } | Response`,
  na ordem tamanho, limite, chave, escopo, plano. Toda rota começa por ele.

## Fases (uma por vez, cada uma com commit, deploy e página de docs)

### Fase 1: chaves, contatos e disparar fluxo

Banco (migration nova; **número pelo disco**, `ls supabase/migrations | tail -1`;
em 02/out a última era `0119`):

```
public.chaves_de_api (
  id uuid pk, client_id uuid not null (fk do cliente, on delete cascade),
  nome text not null, publico text unique not null,   -- o <id> da chave
  hash text not null, final text not null,            -- sha256 hex, 4 últimos
  escopos text[] not null, criada_por uuid, criada_em timestamptz default now(),
  ultima_em timestamptz, chamadas bigint default 0, revogada_em timestamptz
)
```
RLS ligado sem política (só `service_role`, como as outras tabelas sensíveis);
`set search_path = public, extensions` no topo; nada de `app_verandi`.

Rotas:
| Método | Caminho | Escopo | Faz |
|---|---|---|---|
| GET | `/api/v1/contatos/{telefone}` | `contatos:ler` | Um contato: id, nome, telefone, campos, etiquetas, estágio, criado_em |
| POST | `/api/v1/contatos` | `contatos:escrever` | Cria ou atualiza pelo telefone. Corpo `{telefone, nome?, campos?, etiquetas?}`. 201 criou, 200 atualizou. Novo: `campos.origem = 'API'`, `porNoQuadroPadrao`, `anotar('chegou', {origem:'API'})`. Etiqueta inexistente: **não cria**, devolve em `avisos` |
| GET | `/api/v1/fluxos` | `fluxos:disparar` | Fluxos publicados e ativos (id, nome), para descobrir o id |
| POST | `/api/v1/fluxos/{fluxoId}/disparar` | `fluxos:disparar` | Corpo `{telefone}`. Usa `abrirFluxoParaContato`. 202 `aberto`; 409 com `codigo` = o resultado (`janela_fechada`, `atendimento_humano`, `ocupado`...); 404 contato ou fluxo |

UI, em **Configurações > API** (`src/app/clientes/[clienteId]/ajustes/api/page.tsx`,
item novo no hub `ajustes/page.tsx` e em `design/secoes-do-cliente.tsx`):
- Sem o recurso no plano: estado vazio explicando o que a API faz e o botão
  de ver planos.
- Lista de chaves: nome, `af_live_<id>_••••<final>`, escopos em pílulas,
  "usada há X" (ou "nunca usada"), criada por, botão Revogar (confirmação).
- "Criar chave": modal com nome (placeholder "Exemplo: Integração da loja"),
  escopos agrupados com uma linha de explicação cada, e a tela final que
  mostra a chave **uma vez** com Copiar e o aviso "guarde agora, ela não
  aparece de novo".
- Ações otimistas (a chave aparece na lista na hora), sem `revalidatePath`
  da rota aberta.
- Link para a documentação e para o webhook de entrada (que continua em
  Automações > Eventos).
- Renomear o item atual **"Chaves"** do hub para **"Credenciais de sistemas"**:
  ele guarda as senhas que o bloco Chama um sistema usa, e duas coisas
  chamadas "chave" confundem.

Docs (`src/components/docs/paginas-dev.tsx`): grupo novo **API** com
Autenticação (como criar a chave, escopos, Bearer), Erros e limites (tabela
de `codigo`), e uma página por endpoint com `metodo`, campos, respostas e
painel de código cURL/Node.js/Python. Tirar o aviso "não há API REST pública"
da Visão geral.

### Fase 2: enviar template

- `GET /api/v1/templates` (`mensagens:enviar`): só os aprovados (nome, idioma,
  categoria, quantas variáveis no corpo e no cabeçalho).
- `POST /api/v1/mensagens/template` (`mensagens:enviar`): `{telefone, template,
  idioma?, valores?: {corpo?: string[], cabecalho?: string[]}}`. Reusa o
  caminho de `acaoRetomarComModelo`, registra a saída no histórico e anota na
  linha do tempo com autor "API".
- **`Idempotency-Key` obrigatório** (tabela pequena com a chave e a resposta,
  24h): sem isso, a nova tentativa do cliente vira mensagem em dobro e
  cobrança em dobro.
- **Teto diário por organização** (padrão 500, ajustável no admin) além do
  limite por minuto. Estourou: 429 `teto_diario`.
- Contato inexistente é criado (mesma regra do POST contatos).
- Texto livre por API: **não** nesta fase.
- Docs com aviso claro de que a Meta cobra cada mensagem desde 01/out/2026.

### Fase 3: webhooks de saída

- Tabelas: `webhooks_de_saida` (url https, eventos[], segredo no Vault, ativo,
  falhas seguidas) e `entregas_de_webhook` (evento, corpo, tentativas,
  próxima_em, status, resposta curta).
- Eventos da primeira leva: `contato.criado`, `contato.etapa_mudou`,
  `oportunidade.ganha`, `oportunidade.perdida`. O ponto de emissão é
  `anotar` em `repos/eventos.ts` (já é central): enfileira quando o tipo tem
  assinante. `mensagem.recebida` fica para depois (volume).
- Envio com o anti-SSRF de `rede.ts`, 10 s de tempo limite, cabeçalhos
  `x-autofluxos-assinatura: sha256=<hmac de "timestamp.corpo">` e
  `x-autofluxos-timestamp`. Novas tentativas 1 min, 5 min, 30 min, 2 h, 12 h;
  pausa sozinho depois de 20 falhas seguidas e avisa no painel.
- Processamento por cron novo em `vercel.json` (com `CRON_SECRET`, como os
  de `/api/manutencao`) mais um `after()` na emissão para a primeira tentativa.
- UI na mesma tela **API**: seção Webhooks (url, eventos, testar, últimas
  entregas com status).

### Fase 4: leitura completa e funil

`GET /api/v1/contatos` paginado por cursor e filtro por etiqueta e data;
`GET /api/v1/etiquetas`; `GET /api/v1/funil` (quadros e etapas);
`POST /api/v1/funil/cartoes` e `PATCH .../{id}` (mover, ganhar, perder) com
`funil:ler` e `funil:escrever`.

## Regras que não se negociam

- **Banco compartilhado com a Verandi.** Nunca `supabase db push`/`reset`.
  Migration aplicada pela Management API com ensaio `begin; ...; rollback;`
  antes, e **só com autorização explícita do Gabriel**. Confira antes se a
  Verandi não está no meio de uma alteração.
- Chave nunca aparece em log, alerta, auditoria ou mensagem de erro. Só `publico`.
- Nenhum identificador SQL vindo de fora; ids validados como uuid.
- Toda rota com teste do arquivo dela (auth, escopo, plano, schema). **Não
  rode a suíte inteira**; `npx tsc --noEmit -p .` e o teste do arquivo.
- Implementação inline, sem subagente. Um processo pesado por vez (WSL).
- UI: print em 1440 e 390 antes de entregar; tom de SaaS B2B; sem travessão;
  placeholder de exemplo começa com "Exemplo:".
- Commit e push ao fim de cada fase, conferir o deploy na Vercel (projeto
  `autofluxos`), registrar a decisão em `docs/DECISIONS.md`.

## Pronto quando (fase 1)

Uma chave criada no painel faz, por cURL contra produção, o POST de contato
(201 e depois 200 no mesmo telefone), o GET dele, o GET de fluxos e o disparo
(202 com janela aberta, 409 `janela_fechada` com ela fechada); a chave
revogada passa a dar 401 na chamada seguinte; e as páginas de API estão em
`/ajuda/desenvolvedores` com exemplo que funciona copiado e colado.
