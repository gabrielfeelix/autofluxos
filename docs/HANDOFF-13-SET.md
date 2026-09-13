# Handoff — 13/set/2026: a vez do Coexistence

Para quem pega o trabalho a partir daqui. O foco combinado é **Coexistence**:
atender no número que o cliente já usa no WhatsApp Business App, sem ele perder
o celular dele.

Leia, nesta ordem: este arquivo, depois
[META-TECH-PROVIDER.md](META-TECH-PROVIDER.md) (a seção de 13/09 é a atual) e
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) antes de encostar em banco.

---

## Onde a fila está, de verdade

```
verificação do negócio → app review → app em Live → Tech Provider → Coexistence
    ✅ 02/09              ✅ 12/09      ✅ 13/09       ↑ aqui
```

**O app review saiu em 12/09 e o WhatsApp passou.** `whatsapp_business_messaging`
e `whatsapp_business_management` estão live (em Advanced desde a publicação de
13/09, abaixo). As três do
Instagram (`instagram_business_basic`, `instagram_business_manage_messages`,
`business_management`) foram rejeitadas — **e foi decisão do dono deixá-las de
lado por ora**, porque a pressa é o WhatsApp. Rejeição de permissão não derruba
as aprovadas; não há nada a "cancelar".

### O app foi publicado em 13/09, e isso mudou o acesso

```
app_status: live_mode     is_live: true
```

**As permissões de WhatsApp subiram de Standard para `advanced`** na publicação.
É o que destrava embarcar o número **do cliente**: em Standard, o Embedded Signup
só aceitava números da própria conta.

| Permissão | `access_level` |
|---|---|
| `whatsapp_business_messaging` | **advanced** |
| `whatsapp_business_management` | **advanced** |

**O próximo degrau é Tech Provider**, e daí Coexistence.

Dois campos seguem em aberto — **não** barraram o Live, mas valem por outro
motivo, e nenhum tem API:

- `contact_email_verified: false` — é por onde a Meta avisa de violação e
  suspensão; `contato@4yu.com.br` nunca foi confirmado;
- `description` / `short_description` nulos — aparecem para o cliente na tela do
  Embedded Signup.

**Primeira coisa a fazer:** conferir o estado com o MCP (nunca pelo painel — ver
"como não se enganar" abaixo) antes de agir sobre qualquer suposição daqui.

---

## O que Coexistence exige, e a ordem que não dá para furar

1. **Coexistence não é alternativa à fila — é o último degrau dela.** Exige já
   ser Tech Provider ou Solution Partner. Não existe atalho; já foi verificado.
2. **Tech Provider sai do app review aprovado** + app em Live.
3. **Embedded Signup v4**, não v2 — o v2 morre, e começar nele é retrabalho
   garantido (está no PLANO-MESTRE §323).
4. **Verificação padrão do negócio não está disponível para contas em
   coexistência.** O caminho de verificação *do cliente* muda quando o número é
   coexistente. Não prometa ao cliente o fluxo normal.
5. **Coexistência não vale para todo número nem toda região**, e exige WhatsApp
   Business App **2.24.17+** no celular dele.

A nossa WABA (`468946307261350`) já tem selo **CoEx**.

---

## O que está pronto no produto

Ambos os repositórios estão limpos, sincronizados e deployados (Vercel, ligada ao
GitHub `main` — push dispara deploy sozinho).

| Repo | Última migration | Última commit |
|---|---|---|
| `autofluxos` (schema `public`) | `0046_ordem_do_fluxo` | `302964e` |
| `verandi` (schema `app_verandi`) | `0061_vr_prazo_de_cancelamento` | `2219385` |

**Entregue em 12/09**, tudo já aplicado em produção e conferido no banco:

- **Verandi:** aula experimental com grade própria por serviço
  (`/disponibilidade?experimental=1`); prazo de cancelamento com
  `participacao.avisado_em` e `conta.horas_minimas_cancelamento` (MGM = 2h).
- **AutoFluxos:** duplicar automação (nasce desligada e sem publicar) e reordenar
  a lista (`flows.ordem`).

**Pendências que são do Eduardo, não de código** — estão item a item em
[PEDIDOS-12-SET.md](PEDIDOS-12-SET.md):

1. o fluxo de agendamento precisa passar `&experimental=1` na URL quando a pessoa
   vem pelo caminho da aula experimental — o filtro existe, mas ninguém pede por
   ele ainda;
2. o horário da recepção do MGM (`clients.horario_atendimento` está `null` = atende
   sempre), sem o qual `{{atendimento_aberto}}` nunca desvia;
3. correções de desenho, incluindo o galho do menu institucional que empurra todo
   mundo para a aula experimental (diagnosticado nó a nó; **não é** o caminho da
   Fisioterapia, que está certo).

---

## Como não se enganar (lições que já custaram caro aqui)

**O painel da Meta mente por omissão.** O ✅ "Análise do app" significa *envio
feito*, não *aprovado*. Quem responde é o **Meta Devtools MCP**
(`mcp.facebook.com/devtools`) — a Graph API não expõe app review. Comandos:

```
devtools_app_list                             → descobre o app_id
devtools_app_review    action: status         → o envio como um todo
devtools_app_review    action: privileges     → permissão a permissão  ← o que vale
devtools_app_review    action: requirements   → o checklist que falta
devtools_app           action: basic_settings → dev_mode, urls, ícone
devtools_compliance    action: status         → violações abertas
```

**`is_approved: false` no `status` não quer dizer que tudo foi rejeitado** — ele
descreve o envio inteiro. Leia `privileges`.

**`grant_status: REJECTED` muda de significado conforme
`has_been_previously_reviewed`.** Antes do primeiro review, é "nunca concedida";
depois, é rejeição de verdade. A versão anterior deste doc errou por ler o
primeiro caso como o segundo.

**Mesma lição, outro produto:** o contêiner GTM dizia "publicado" por meses sem
estar no ar. Console não é evidência; a consulta é.

---

## Regras da casa que continuam valendo

- **Banco de produção é compartilhado** entre AutoFluxos (`public`) e Verandi
  (`app_verandi`), no mesmo projeto Supabase, **sem backup**. Leia
  `BANCO-COMPARTILHADO.md` inteiro antes de qualquer migration. Nunca
  `supabase db push` / `db reset` contra produção. Descubra a próxima migration
  pelo diretório (`ls supabase/migrations/ | tail -1`), nunca por um plano.
- **Não há Docker nesta máquina** (WSL2 sem a integração ligada), então o replay
  local não roda. O substituto usado em 12/09 foi o **ensaio em transação**
  (`begin; <migration>; rollback;` pela Management API): prova contra o estado
  real da produção, não prova a ordem desde o zero. Serve para migration aditiva
  conferida objeto a objeto depois.
- **Segredos** em `/home/gabfelix/dev/4yu-apps/.secrets/4yu.env`, fora de git.
  Carregue com `set -a && . ../.secrets/4yu.env && set +a`. O repo do CRM é
  público — nunca copie segredo para dentro de repo nenhum.
- **Nada é aplicado em produção sem autorização explícita do dono.**
- O dono prefere **resposta curta**: conclusão e resultado, sem texto longo.
- Em plano de várias fases, ele quer que se **toque até o fim**, com commit e
  push por etapa, sem perguntar entre uma e outra.
- **Sessões paralelas no mesmo repo são comuns**: `git fetch` antes de começar.
