# Gravar áudio, e tirar a Meta de dentro do bucket público

> Sessão de **15/set/2026**, continuando
> [HANDOFF-15-SET-MIDIA-RECEBIDA.md](HANDOFF-15-SET-MIDIA-RECEBIDA.md).
>
> Aquele handoff deixou uma lista ordenada. O item 0 — **provar no WhatsApp** —
> continua pendente e **continua sendo o primeiro**: ele depende do dono, não de
> código. Esta sessão fez os itens 1 e 2.
>
> **Nada desta sessão passou por um WhatsApp real.** É a quarta vez que essa
> frase precisa ser escrita.

---

## Onde parou

Migration **`0056` aplicada em produção** em 15/set/2026, com autorização
explícita do dono, e conferida pelos dois testes que o
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) exige — leia o parágrafo dela
lá antes de mexer em Storage.

Typecheck, lint e `npm run build` limpos.

---

## O que foi feito

### 1. A pesquisa que o item 1 pedia

Em [PESQUISA-VOZ-E-CHAMADA.md](PESQUISA-VOZ-E-CHAMADA.md), com a URL da Meta ao
lado de cada afirmação. **Leia antes de reabrir qualquer uma destas discussões.**

Os dois achados que mudam decisão:

**A Calling API existe — e mesmo assim a resposta é não.** O indício que o
handoff anterior marcou como não verificado estava certo: a
[WhatsApp Business Calling API](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/)
é oficial e não exige App Review novo (`whatsapp_business_messaging` já basta).
O que trava é o pré-requisito 5 da lista dela: **limite diário de no mínimo
2.000 destinatários únicos**. Nenhum cliente de estúdio chega lá, e não é para
chegar. Além disso a mídia trafega em **WebRTC (ICE + DTLS + SRTP)** — não é um
endpoint a mais, é virar um endpoint de voz. **Decisão: não fazer.**

**O problema do formato de áudio deixou de existir sozinho.** O handoff temia
que o Chrome só gravasse `audio/webm`, que a Meta não aceita. Hoje Chrome, Edge,
Opera e Safari gravam `audio/mp4`, e o Firefox grava `audio/ogg;codecs=opus` —
os dois estão na tabela da Meta. **Nenhuma conversão, nenhum WASM, nenhuma
dependência nova.** A implementação inteira virou negociação de formato.

### 2. Gravar áudio na caixa de resposta

Botão 🎤 ao lado do clipe, nas duas páginas (Inbox e Ficha, pelo `Responder`).

- `src/core/audio-de-voz.ts` — a regra, pura e testada sem navegador: qual
  formato pedir, mono obrigatório (a Meta exige no OGG), teto de 5 minutos,
  tradução dos erros de microfone.
- `src/components/lead/botao-de-microfone.tsx` — a tela.
- Sobe pelo **mesmo caminho do clipe** (URL assinada → Storage → Server Action),
  então herda validação de tipo, teto de 16 MB e limpeza ao apagar o cliente.

**Parar e cancelar são botões diferentes, de propósito.** No WhatsApp não existe
apagar depois que funcione; um áudio gravado por engano precisa morrer antes de
sair do navegador.

**Migration `0056`, e ela é obrigatória.** O `autofluxos-acervo` foi criado pela
`0017` com lista fechada de MIME, e `audio/mp4` não estava nela. Sem a `0056`, o
`PUT` volta **400 do Storage** na cara de quem atende — longe de qualquer código
nosso. O teste `o formato gravado bate com o que o acervo aceita` existe para
essa armadilha não voltar.

### 3. A mídia que sai passa a subir antes, em vez de ir por `link`

**É o item 2 do handoff anterior, e a solução não foi a que ele previa.**

O handoff propunha URL assinada de validade curta, e escreveu que precisaria de
teste real — *"a Meta tem que conseguir buscar dentro da validade"*. Esse teste
é o problema: se a Meta aceitar a mensagem com 200 e falhar o download depois, a
mensagem **some sem erro**, e não achei na doc a garantia de que a recusa é
síncrona. Apostar nisso seria trocar um risco de privacidade por um risco de
mensagem perdida.

O caminho que **não** tem aposta é o outro que a Cloud API oferece: subir o
arquivo para a Meta (`POST /{phone-number-id}/media`) e mandar o `id`. A Meta
fica com os bytes; não há download posterior para falhar.

O comentário que estava no código rejeitava esse caminho dizendo que o `id`
expira em 30 dias e viraria "um cache com invalidação". **O argumento estava
certo sobre o cache e errado sobre o que estava em jogo**: aqui não há cache
nenhum — o `id` é usado no mesmo pedido em que nasce, e os 30 dias nunca chegam
a importar. O que estava em jogo era o `link` **obrigar** o arquivo a estar num
endereço que a Meta alcança sem credencial nossa, que é a razão de o bucket ser
público.

**A queda para `link` fica, e é ela que torna isto seguro de subir sem teste de
campo.** Qualquer falha no upload — rede, prazo, recusa da Meta — devolve `null`
e o envio sai como saía ontem. **O pior caso desta mudança é o comportamento de
ontem.**

**O prazo é compartilhado pelas duas pernas** (20s no total, não 20s por perna).
O envio de mídia roda dentro do `after()` do webhook, que morre no `maxDuration`
de 60s da Vercel; dois prazos somados mais o envio passariam do teto e a função
morreria no meio.

**O que isto custa:** os bytes passam por nós duas vezes. No caso normal são uns
segundos; no limite de 16 MB, o prazo corta e cai para `link`.

---

## O que fazer, em ordem

### 0. Provar o que já estava no ar (do handoff anterior, intocado)

Foto, áudio, vídeo, PDF e figurinha **recebidos**; tique azul; localização e
cartão de contato; reação otimista; seletor de emoji. **Continua sendo o
primeiro item.**

### 1. Provar o que subiu hoje

| O quê | Como provar |
|---|---|
| Mídia que **sai** ainda chega | Mandar uma foto pelo clipe. **Se chegar, o envio por `id` funcionou.** |
| Confirmar que foi por `id` e não pela queda | Procurar `[whatsapp] não deu para subir a mídia` no log da Vercel. **Ausência dessa linha = foi por `id`.** |
| Gravar áudio | Gravar 5s, enviar, ouvir no celular. A `0056` já está em produção. |
| Áudio no Firefox | Mesmo teste — é o único que usa o caminho OGG/Opus. |

### 2. Fechar o bucket — **só depois do item 1**

Agora que o envio não depende mais de URL pública, o `autofluxos-acervo` pode
ficar privado. **Não escrevi essa migration de propósito**: um arquivo parado na
pasta vira "aplicar as pendentes em ordem" na próxima sessão, e aplicá-la antes
de o envio por `id` estar provado em campo derruba a mídia que sai. Ela nasce
depois da prova, com este conteúdo:

```sql
update storage.buckets set public = false where id = 'autofluxos-acervo';
```

**E ela não basta sozinha.** Falta a segunda metade, que é trabalho de verdade:

- **`listarAcervo` e `pedirEnvioAssinado` devolvem `getPublicUrl`.** Com o
  bucket privado essas URLs passam a dar 400. Precisam virar URL assinada, como
  `urlAssinada` já faz para a mídia recebida (`repos/midia-recebida.ts`).
- **O `payload` das mensagens que já saíram guarda a URL pública**, e o grafo
  dos fluxos publicados também. As bolhas antigas quebram. O conserto é guardar
  **caminho** e assinar na hora de desenhar — a decisão que a `0055` já tomou
  para a mídia recebida — com uma ponte que reconheça a URL pública antiga e
  extraia o caminho dela.
- **O envio por `id` passa a depender de URL assinada** para ler do Storage:
  `subirParaAMeta` recebe o endereço de quem chama e não sabe assinar nada. Quem
  chama é que muda.

Enquanto o bucket for público, **a regra da `0017` continua sem ninguém que a
faça cumprir**: *"documento pessoal não entra, e isso é regra de uso, não de
banco"*. Um atendente que suba a foto de um RG põe isso em URL pública e
permanente. **Isso é risco de hoje, não do futuro.**

### 3. Camada 4 — chamada perdida

Inalterada. A pesquisa só confirmou que o campo de webhook se chama `calls`.
Continua precisando de uma chamada real para saber quais campos vêm.

### 4. Marcar como lida sem usuário na sessão

Inalterado. Ver `server/recibo-de-leitura.ts`.

---

## Armadilhas desta sessão

Somam-se às dos handoffs anteriores.

- **O `schema_migrations` local mente, e mente de um jeito específico.** Ele
  dizia `0042` enquanto **todos** os objetos da `0043` à `0055` já existiam —
  aplicar as pendentes saiu inteiro em `NOTICE: ... already exists, skipping`.
  Ou seja: o número não estava atrasado por falta dos objetos, estava atrasado
  por falta do registro. **Confira o objeto, não o número.**

- **Não existe container `supabase_storage_autofluxos`**, só `..._db_`. O schema
  `storage` existe no Postgres e dá para conferir `storage.buckets` por SQL —
  mas **não dá para testar upload localmente**. Validação de bucket no Docker é
  de esquema, nunca de comportamento.

- **`content-type` escrito à mão num `multipart` apaga o `boundary`** que o
  `fetch` monta sozinho, e a Meta responde 400 sem dizer por quê. Há um teste
  travando isso (`o upload leva messaging_product e o arquivo com o tipo da
  origem`).

- **`AbortSignal.timeout` começa a contar quando é criado.** É exatamente por
  isso que ele serve como prazo compartilhado — criado uma vez fora e passado
  aos dois `fetch`. Trocar por um `timeout` em cada chamada dobra o pior caso
  em silêncio.

- **O MIME do bucket é comparado como string exata.** `audio/ogg;codecs=opus`
  **não** bate com `audio/ogg`. O `Blob` que o `MediaRecorder` entrega vem
  carimbado com o `;codecs=`, e é por isso que o componente monta um `Blob` novo
  com o MIME limpo antes de subir.

- **A suíte roda contra PRODUÇÃO** (continua valendo do handoff anterior) e leva
  ~2 minutos.

---

## Decisões desta sessão que o próximo precisa conhecer

**Ligar: não, e o motivo não é técnico nosso.** É o piso de 2.000 destinatários
únicos por dia da Meta. Reavaliar só se um cliente passar disso — e aí a
pergunta é "vale um produto de voz?", não "vamos ligar a API".

**Não converter áudio no navegador.** Foi cogitado e é desnecessário: os
navegadores atuais já gravam em formato que a Meta aceita. Se alguém propuser
WASM de Opus aqui, a resposta está em `FORMATOS_DE_GRAVACAO`.

**O teto de 5 minutos envia, não descarta.** Perder cinco minutos de fala por um
limite nosso seria pior do que o limite existir.

**Subir antes é melhor que `link`, e não é só privacidade.** O endereço de
origem passa a precisar ser alcançável só por **nós** — o que também vale para
URL externa colada num fluxo.

**Toda troca no caminho de envio precisa de queda para o comportamento antigo.**
Foi isso que permitiu esta mudança ir ao ar sem WhatsApp real. Se a próxima não
puder degradar assim, ela espera pelo teste.

---

## O que continua valendo dos handoffs anteriores

Enquete, editar mensagem enviada, apagar para todos e foto de perfil do contato
não existem na Cloud API. Figurinha continua sendo problema de **acervo**, não
de API (WebP ≤ 100 KB estática, ≤ 500 KB animada). GIF continua sem linha na
tabela da Meta.

**A bolha está duplicada em duas páginas.** Toda mudança de desenho vai nas duas.

**O vitest só inclui `.test.ts`, não `.test.tsx`.** Por isso a lógica do
microfone mora em `core/` — é o que a torna testável.

---

## Regras que não se negociam

Estão em [AGENTS.md](../AGENTS.md) e em
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md), e valem inteiras. Em especial:
**nada em produção sem autorização explícita do dono**, e a próxima migration
vem de `ls supabase/migrations/ | tail -1` — **não deste documento**.
