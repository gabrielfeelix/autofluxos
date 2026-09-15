# Camada 2 no ar, e um sintoma sem causa achada

> Sessão de 15/set/2026, continuando [HANDOFF-15-SET-INBOX-WHATSAPP.md](HANDOFF-15-SET-INBOX-WHATSAPP.md).
> **Camada 2 entregue e publicada.** Camadas 3, 4 e 5 continuam abertas.
>
> **Leia primeiro a seção "O que ficou sem resolver".** Ela é a razão deste
> documento existir, e não a lista do que foi feito.

## Onde parou

`main` em `ed01bc0`, empurrado. Deploy automático da Vercel rodou e ficou
`READY` em produção às 00:34 de 15/set — conferido pela API, não pelo painel.

789 testes passando (eram 770), typecheck e lint limpos, `npm run build` limpo.

Migration `0054` **aplicada em produção** com autorização explícita do dono,
conferida pelos dois testes que o `BANCO-COMPARTILHADO.md` pede: replay do zero
em Docker e ensaio em transação contra a produção. Verificada depois **na**
produção: três colunas, índice parcial, nenhum grant a `anon`/`authenticated`,
e `app_verandi` com os mesmos 42 objetos de antes.

---

## O que ficou sem resolver

**O dono deu F5 e disse que não aparece nada para reagir, citar nem mandar
emoji.** Isso ficou em aberto, e é o primeiro item de quem pegar.

Separando o que é fato do que é suposição:

### Emoji: não é bug, é escopo

**O seletor de emoji não foi implementado.** Ele é da camada 5, e a camada
aprovada nesta sessão foi só a 2. Hoje dá para digitar emoji direto no campo de
texto e ele sai — emoji nunca foi recurso de API, é texto puro. O que falta é a
telinha de escolher, e ela não existe.

Se o pedido era "quero o seletor de emoji", isso é **trabalho novo**, não
conserto.

### Reagir e citar: o código está no ar, e o sintoma não foi reproduzido

O que foi descartado com evidência:

- **Não é deploy que não saiu.** `ed01bc0` está `READY` em produção.
- **Não é o prazo de 30 dias escondendo o botão.** 421 das 422 mensagens da
  produção estão dentro do prazo.
- **Não é `waMessageId` ausente.** As 182 mensagens de entrada têm todas o id
  da Meta.
- **Não é o contexto deixando de atravessar `children`.** Foi a hipótese mais
  promissora — `Historico` é renderizado no servidor e entregue como `children`
  ao `ProvedorDeCitacao`, que é cliente. Um teste de render provou que o
  contexto **alcança** esse arranjo. O teste ficou no repo
  (`src/components/lead/citacao.test.ts`).

O que **não** foi feito, e é o que falta: **ninguém abriu a tela logada.** Não
há Playwright no projeto, o painel usa login por usuário (Better Auth) e a
tentativa de autenticar por `curl` não passou do 307. Toda a investigação foi
por baixo — banco, build, deploy —, e nenhuma olhou o HTML que a pessoa recebe.

### A pergunta que decide o caminho, e que ficou sem resposta

Os botões são **dois símbolos pequenos e cinza, colados embaixo da bolha**: um
`↩` (citar) e um `☺` (reagir). Discretos de propósito, e provavelmente
discretos **demais**.

São dois problemas diferentes com consertos diferentes:

1. **Não aparece nada embaixo das mensagens** → é bug de verdade. Comece
   abrindo a tela logada e olhando o DOM: procure por `aria-label="Reagir a
   esta mensagem"`. Se não estiver no HTML, o caminho é `BarraDaMensagem` →
   `useCitacao()` devolvendo `null`; se estiver no HTML mas invisível, é CSS.
2. **Aparecem, mas ninguém os enxerga** → é design ruim, e o conserto é deixá-los
   legíveis, não mexer na lógica.

Há um detalhe que reforça a hipótese 2: o comentário dentro de
`acoes-da-mensagem.tsx` descreve uma barra que **aparece ao passar o mouse**,
com `opacity` e `focus-within` — e **esse CSS nunca foi escrito**. O comentário
mente sobre o código. A barra deveria estar sempre visível; se ela está, o
problema é só que ninguém repara nela.

**Corrija o comentário junto com o que for decidido** — comentário que descreve
código inexistente é a próxima hora perdida de alguém.

---

## O que a camada 2 entregou

### Reagir

- Seis emojis, os mesmos do WhatsApp (`👍 ❤️ 😂 😮 😢 🙏`). Lista curta é o
  recurso, não uma versão reduzida dele: se escolher custa mais que digitar
  "ok", ninguém reage.
- **Clicar no emoji que já está lá remove.** É como a Meta desfaz — não existe
  endpoint de "desreagir", manda-se emoji vazio.
- Some em mensagem de mais de 30 dias, e o servidor confere de novo.
- **Reagir não faz o bot calar**, ao contrário de responder e de mandar mídia.
  Um "👍" não é alguém assumindo o atendimento.

### Citar

- Barra lateral dentro da bolha, prévia acima do campo com `×` para desfazer.
- Trocar de conversa esquece a citação (`key` no provedor). Sem isso, citar
  aqui e responder noutra conversa mandaria o id de outra pessoa.

### O bug que isto consertou

A reação entrava como **mensagem solta** no fim da conversa e — pior — chegava
ao motor como se fosse mídia, com `formato: 'reaction'`. Numa conversa parada
numa pergunta, um "❤️" **respondia a pergunta**: o fluxo seguia o ramo errado e
ninguém entendia por quê.

Agora ela é gravada, gruda na mensagem que comenta, e não acorda o motor.

---

## Decisões que o próximo precisa conhecer

**Sem chave estrangeira nas colunas novas, de propósito.** A Meta deixa reagir a
mensagem de até 30 dias, o histórico é cortado em 500, e `context` também chega
quando alguém responde a um anúncio ou encaminha algo. Reagir ou citar algo que
não temos é **caso normal**. Com FK, a reação seria recusada na escrita e
perdida; sem ela, o join não acha e a tela mostra "mensagem original" em cinza.

**`reacao` guarda string vazia, e não `null`, na remoção.** `null` = não é
reação; string vazia = reação removida. Colapsar os dois faria a reação tirada
ficar na tela para sempre.

**Os dois prazos da Meta são eixos diferentes e não se reusam.** Responder em
texto livre exige que a *pessoa* tenha falado nas últimas 24h; reagir exige que
a *mensagem* tenha menos de 30 dias. Amarrá-los faria reagir parar de funcionar
em quase toda conversa real — a maioria das conversas está fora da janela de 24h
e dentro dos 30 dias.

**Trocar de emoji chega como mensagem nova, não como edição.** Por isso
`casarReacoes` fica com a mais recente de cada lado. Sem isso, quem troca de
"👍" para "❤️" fica com os dois pendurados para sempre.

**A bolha está duplicada em duas páginas** — Inbox e Ficha. Toda mudança de
desenho precisa ir nas duas. Já era assim antes desta sessão.

---

## A foto do contato: não dá, e não é limitação nossa

Pedido na sessão. **A Cloud API não expõe foto de perfil de contato.**

- O webhook entrega `contacts[].profile` com **só o nome** (e, com o rollout de
  usernames, `username` e `country_code` — todos texto).
- O único `profile_picture_url` que existe é o do **próprio negócio**
  (`/{phone-number-id}/whatsapp_business_profile`) — o nosso lado, não o dela.
- O outro `profile_picture` da doc é de **grupo**, não de pessoa.

Levantado na doc oficial pelo MCP da Meta em 15/set, com as três URLs conferidas.

Quem mostra foto de contato no mercado está rodando provedor não oficial por
cima do WhatsApp Web — o caminho que arrisca banir o número do cliente, recusado
desde o começo (ver o topo de `channels/cloud-api.ts`).

**O que dá para fazer, e não foi feito:** cor estável derivada do nome nas
iniciais, em vez do cinza único de hoje (`components/inbox/avatar.tsx`). Mesmo
truque de Slack e Google. É tela e nada mais.

---

## Armadilhas desta sessão (somam-se às do handoff anterior)

- **O vitest só inclui `.test.ts`, não `.test.tsx`.** Por isso não existe teste
  de componente no repo. Para testar render, é `createElement` na mão — feio, e
  ainda assim mais barato que descobrir em produção. Mudar o `include` é uma
  opção, e não foi feita nesta sessão.
- **Não há script aplicador de migration.** É `curl` direto na Management API,
  com `SUPABASE_ACCESS_TOKEN` e `AUTOFLUXOS_SUPABASE_PROJECT_REF` do cofre.
- **O `notify pgrst` no fim da migration funcionou** — o PostgREST enxergou as
  colunas novas na primeira tentativa, sem a armadilha de cache do handoff
  anterior. Mas o ensaio em transação precisa **tirar** o `notify`: ele não roda
  dentro de transação de teste.
- **O conector da Vercel não alcança o escopo `4-yu`** (403). Use o
  `VERCEL_TOKEN` do cofre com a API v6.
- **O `BANCO-COMPARTILHADO.md` dizia `0047` quando o disco já tinha `0053`.** A
  regra dele mesmo — o diretório é a fonte de verdade — continua valendo, e
  continua sendo violada pelo próprio documento.

---

## O que vem, em ordem

### 0. Fechar o sintoma acima

Antes de qualquer camada nova. Abra a tela logada, olhe o DOM, e decida entre
bug e design. É meia hora com o navegador aberto, e foi exatamente o que faltou
aqui.

### 1. Camada 5 — acabamento (a mais pedida na prática)

- **Seletor de emoji na caixa de texto.** É o que o dono pediu e não veio.
- Marcar como lida ao abrir a conversa — hoje a pessoa do outro lado nunca vê o
  segundo tique. **O adaptador já sabe fazer**: `aguardarResposta` em
  `cloud-api.ts` manda `status: 'read'` junto do "digitando". Falta chamar ao
  abrir.
- Desenhar localização e cartão de contato — receber já funciona.
- Cor no avatar (ver a seção da foto).

### 2. Camada 3 — figurinha e GIF

Figurinha exige WebP dentro de 100 KB / 500 KB; o caminho honesto é um acervo
por cliente, não converter no navegador. GIF vira MP4 — funciona na prática,
**não é documentado**, então precisa de teste real antes de virar promessa na
tela.

### 3. Camada 4 — chamada perdida

A Meta manda `connect` e `terminate`, e **nada que diga "perdida"**. Dá para
inferir de um `terminate` sem atendimento. **Precisa de uma chamada real** para
saber quais campos vêm — o mapeamento é inferência nossa, não contrato.

---

## O que continua valendo do handoff anterior

Enquete, editar enviada e apagar para todos **não existem na Cloud API**. Não
prometer na tela. O que aparece no mercado são provedores não oficiais.

E a lição que esta sessão repetiu de outro jeito: **"passou no typecheck" não é
"está na tela"**. A camada 1 não foi testada com envio real; a camada 2 não foi
testada com reação real nem com a tela aberta. As duas estão no ar.
