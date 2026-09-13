# Revisão cética — 13/set/2026, 23h UTC

> Revisa [HANDOFF-13-SET-NOITE-COEXISTENCIA.md](HANDOFF-13-SET-NOITE-COEXISTENCIA.md).
> Aquele documento pede, na primeira linha, para ser lido com desconfiança.
> Foi. **Duas afirmações centrais dele não se sustentam**, e a hipótese
> principal que ele deixou como próximo passo **já está descartada por
> evidência** — a escrita que ele sugere na conta do cliente não deve ser feita.

## O erro do documento anterior, em uma linha

Ele conclui **"a Meta não chamou nosso endpoint"** a partir de "zero alertas do
diário de bordo". Mas o diário de bordo **subiu às 22:15 UTC** e o cliente
conectou às **21:04** — o silêncio cobre uma janela em que não havia o que
observar. Não é evidência de ausência: é ausência de observação.

## O que foi verificado agora, e como

Cada linha foi apurada hoje às 23h UTC, com o comando ao lado. Refaça.

| Fato | Como foi provado |
|---|---|
| O endpoint está vivo e é a rota que responde | `GET .../api/webhook/whatsapp?hub.mode=subscribe&...` → `200` + devolve o challenge |
| O proxy não come mais | `POST` sem assinatura → `assinatura inválida` (401 **da rota**), não "sessão expirada" |
| **O diário de bordo funciona ponta a ponta** | `POST` assinado com payload real de `smb_message_echoes` → alerta gravado **e** a mensagem entrou em `messages` com `direcao: saida` |
| Os três campos estão assinados | `devtools_webhook_list` → `history`, `smb_app_state_sync`, `smb_message_echoes` presentes |
| App live, compliance limpo | `devtools_app basic_settings` → `live_mode: true` |
| O número é coexistente de verdade | `is_on_biz_app: true` **e** `platform_type: CLOUD_API`, `status: CONNECTED` |
| Os dois syncs foram disparados e **aceitos** | `channels.contatos_sync_request_id = BF4E883F182915B6B6`, `historico_sync_request_id = CA1383604587B855FE` |

O teste do diário de bordo é o que importa: mandei um `smb_message_echoes` com o
payload literal da doc da Meta, no `phone_number_id` real do Eduardo. **Ele
gravou.** Ou seja, se a Meta mandar um echo agora, ele entra. O caminho de
código está certo de ponta a ponta — o `0f18eca` consertou o que havia para
consertar.

(As duas linhas de teste foram apagadas depois: `messages` e `alertas`.)

## Hipótese 1 do documento anterior: DESCARTADA — **não faça a escrita**

Ele propunha gravar `override_callback_uri` na WABA do cliente, dizendo que a
leitura era impossível (`(#10) permission`). **Ela não é impossível — o token
errado foi usado.** Com o token do canal (Vault, `token_ref
4aead604-e61b-4c95-b839-9de8668a4066`), lê-se sem erro:

```
GET /v21.0/110549275215531?fields=webhook_configuration
→ {"webhook_configuration": {"application": "https://autofluxos.4yu.com.br/api/webhook/whatsapp"}}

GET /v21.0/2042524849790437/subscribed_apps
→ AutoFluxos (1063817842847269), sem override
```

O `webhook_configuration` mostra **só** `application` — se houvesse sobrescrita
por WABA ou por número, ela apareceria aqui. **Não há.** O roteamento aponta
para nós. Escrever o `override_callback_uri` na conta do cliente seria mexer
onde já está certo, sem ganho e com risco.

## A causa provável, e ela não é nossa

A doc da Meta (*Onboard WhatsApp Business app users*) é explícita sobre um passo
que **acontece no celular do Eduardo**, não no nosso código:

> "Tap the **Confirm** button in the app to give the business the option to
> share their chat history with you."

E sobre o tempo:

> "Onboarding and synchronization can take several minutes, depending on factors
> such as the size of the business's messaging history, their internet speed,
> and how quickly you can digest webhooks."

Somando ao que o banco mostra — syncs **aceitos** (`request_id` devolvido) e
progresso `null` — o quadro que sobra é: **a Meta aceitou o pedido e está
esperando o cliente confirmar no aparelho**, ou ele não confirmou. Fontes de
suporte de BSP relatam que o sync "pode levar até 6 horas" e exigem o app aberto
com internet estável.

Note que isso também explica o segundo sintoma, que o documento anterior tratou
como reforço da hipótese 1: **nada** vem daquela WABA. É consistente com um
onboarding que a Meta registrou mas que o lado do aparelho não completou.

### O que **não** explica

`smb_message_echoes` de mensagens novas deveria fluir independente do histórico.
Se o Eduardo mandou mensagem pelo celular **depois das 22:15** e nada apareceu,
isso é sinal diferente e merece investigação. **Não sabemos se ele mandou.** Ver
a pergunta 1 abaixo.

## Erros do documento anterior — a lista

1. **"Nenhum alerta ⇒ a Meta não chamou"** é inválido: o diário subiu 1h11
   depois da conexão.
2. **"Não foi possível ler `override_callback_uri`"**: foi usado o token do app
   onde o certo é o token do canal. O dado sempre esteve legível.
3. **A hipótese 1 foi mantida como principal** justamente por causa de (2), e a
   ação sugerida era escrita na conta do cliente — em cima de um dado que agora
   sabemos estar correto.
4. **O item 4 ("teoria dos 7 dias é invenção de blog")** merece um asterisco:
   a doc da Meta de fato não a traz, mas *fontes de BSP listam número sem uso
   prévio como causa de inelegibilidade*. Não é doutrina, mas também não é
   nada. Baixa prioridade.

## O que fazer, em ordem

1. **Perguntar ao Eduardo, antes de mexer em qualquer código:**
   - Apareceu no WhatsApp Business dele uma tela pedindo para **confirmar o
     compartilhamento do histórico**? Ele confirmou?
   - Ele **mandou ou recebeu** alguma mensagem pelo celular **depois das 22:15
     UTC** (19:15 BRT)? Essa é a pergunta que separa as duas hipóteses.
   - O número dele já esteve conectado a **outra API/BSP** antes?
2. **Se ele mandou mensagem depois das 22:15 e nada apareceu** → aí sim é sinal
   novo. Confira `alertas` para "webhook do WhatsApp recebido (diagnóstico)"
   naquele intervalo. Havendo alerta, o corpo cru está no `detalhe` e o problema
   é nosso. Não havendo, é da Meta e vale abrir suporte com os dois
   `request_id`.
3. **Se ele não confirmou no aparelho** → não há bug. O onboarding precisa ser
   refeito, e a janela de 24h a partir de 13/set 21:04 UTC (vence **14/set
   21:04 UTC**) é o prazo.
4. **Não** grave `override_callback_uri`. Ver acima.
5. **Não** remova o diário de bordo ainda — agora ele cobre a janela útil, e é
   o que torna o próximo teste conclusivo. Remova ao fechar.

## O que continua verdadeiro do documento anterior

- O `0f18eca` (`message_echoes` vs `messages`) era bug real e está corrigido —
  e o teste de hoje prova que o caminho funciona.
- `health_status: BLOCKED` mente e fica em cache. Mantido.
- Nenhuma mensagem jamais entrou por canal coexistente: **é caminho novo, não
  regressão.** Esse enquadramento do documento anterior está certo e é o mais
  útil dele.
- Teste montado com formato nosso não prova integração. O teste de hoje usou o
  payload literal da doc, de propósito.

## Estado: nada foi alterado

Nenhum código mudou, nenhuma escrita foi feita na conta do cliente, e as duas
linhas do teste foram apagadas. O banco está como estava.

## Duvide disto também

A causa provável acima é **inferência**, não fato provado — está marcada como
"provável" de propósito. O que está provado é o que tem comando ao lado: o
caminho de código funciona, e o roteamento da Meta aponta para nós. A resposta
que falta está com o Eduardo, não no repositório.

---

# ATUALIZAÇÃO — 23:15 UTC: **são duas WABAs, e estávamos inscritos na errada**

O dono confirmou que **o Eduardo aceitou compartilhar o histórico** — ele viu a
tela. Isso derruba a "causa provável" que eu tinha escrito acima (confirmação
pendente no aparelho). Boa: era inferência, e caiu no primeiro fato novo.

Procurando outra coisa, o `debug_token` do canal entregou o que faltava:

```
granular_scopes:
  whatsapp_business_management -> ['2042524849790437', '101920619426215']
  whatsapp_business_messaging  -> ['2042524849790437', '101920619426215']
```

**Duas WABAs.** Nenhum documento anterior menciona a segunda.

| | `2042524849790437` (gravada em `channels`) | `101920619426215` (a que ninguém viu) |
|---|---|---|
| `name` | `unknown` | **`Eduardo Yamamoto \| Gestor de Growth`** |
| Portfólio | Portfólio EXTRA | Portfólio EXTRA |
| Contém o número `110549275215531` | sim | **sim** |
| App AutoFluxos inscrito | sim | **NÃO (estava vazio)** |

O número aparece nas duas — por isso as sondas de leitura não decidiam qual
roteia. Mas só uma delas tinha `subscribed_apps` vazio, e **é a que leva o nome
real do negócio**, enquanto a que gravamos responde `name: unknown`.

Isso explica todos os sintomas de uma vez, e melhor que a hipótese 1 do
documento original: o roteamento não estava sobrescrito para o lugar errado —
**nós é que estávamos escutando a WABA errada.** Webhook de WABA em que o app
não está inscrito simplesmente não é entregue, sem erro e sem aviso.

## O que foi feito (autorizado pelo dono, 23:14 UTC)

```
POST /v21.0/101920619426215/subscribed_apps  → {"success": true}
```

Confirmado: `subscribed_apps` da `101920619426215` agora lista AutoFluxos.
Nada na outra WABA foi alterado. É reversível com `DELETE` no mesmo endpoint.

## O que NÃO deu para recuperar

Os dois syncs de uso único **já estão gastos**, e foram gastos apontando para a
WABA errada:

```
POST /110549275215531/smb_app_data (smb_app_state_sync) → (#4) Limite de
  solicitações de sincronização excedido
POST /110549275215531/smb_app_data (history)            → idem
```

Ou seja: **a agenda e o histórico daquele onboarding não voltam.** Para
recuperá-los, o Eduardo precisa ser desembarcado e refazer o Embedded Signup —
e aí os syncs saem já com a inscrição certa.

**As mensagens novas (`smb_message_echoes` e `messages`) não dependem disso.**
Elas devem passar a chegar agora. É o que o próximo teste mede.

## O teste que fecha o caso

Peça ao Eduardo para **mandar uma mensagem pelo celular** (ou alguém mandar para
ele). Depois:

```bash
# o diário de bordo grava toda chamada recebida, antes de qualquer filtro
curl -s "$AUTOFLUXOS_SUPABASE_URL/rest/v1/alertas?select=criado_em,titulo,detalhe&order=criado_em.desc&limit=5" \
  -H "apikey: $AUTOFLUXOS_SUPABASE_SECRET_KEY" -H "authorization: Bearer $AUTOFLUXOS_SUPABASE_SECRET_KEY"
```

- **Chegou alerta** → resolvido; o problema era a inscrição. Aí sim remova o
  diário de bordo e trate o histórico perdido como decisão de produto
  (refazer o onboarding ou não).
- **Não chegou** → a inscrição não era a causa, e a próxima suspeita passa a ser
  a hipótese 3 do documento original (os dois portfólios), que segue não
  investigada.

## O bug de produto que isto revela

`terminarOnboarding` confia no `waba_id` que vem na query do retorno do Embedded
Signup e **nunca confere se o número está mesmo naquela WABA**. Quando o cliente
tem mais de uma, dá para inscrever numa e o número viver na outra — exatamente
o que aconteceu aqui, em silêncio, gastando a janela de 24h.

A correção certa é usar o `debug_token` (que já temos, em `conexao.ts`) para
listar **todas** as WABAs do token e inscrever-se na que realmente contém o
`phone_number_id`, em vez de confiar na query. **Não foi feito ainda** — é
código, e o caso ainda não fechou.
