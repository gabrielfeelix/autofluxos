# Áudio, figurinha e ligação: o que dá, o que não dá, e o que custa

> Sessão de **15/set/2026**, respondendo ao item 1 de
> [HANDOFF-15-SET-MIDIA-RECEBIDA.md](HANDOFF-15-SET-MIDIA-RECEBIDA.md):
> *"Podemos mandar áudio, figurinha, emoji? E ligar?"*
>
> O handoff mandou **pesquisar antes de codar**, e mandou não completar com
> blog o que não estivesse na documentação primária da Meta. Foi o que se fez.
> Cada afirmação daqui tem a URL da Meta ao lado.

---

## Resposta curta

| Recurso | Dá? | O que falta |
|---|---|---|
| **Emoji** | ✅ já está no ar | nada — entrou em `f5597bc` |
| **Áudio gravado na hora** | ✅ implementado | ver a armadilha do codec abaixo |
| **Áudio como arquivo** (MP3/OGG) | ✅ já estava no ar | nada |
| **Figurinha** | ⚠️ tecnicamente sim | acervo de WebP por cliente — camada 3 |
| **Ligar** | ❌ **não hoje** | volume de 2.000 destinatários/dia + pilha WebRTC |

---

## Ligação: a API existe, e mesmo assim a resposta é não

O handoff registrou o indício como **não verificado**. Verificado agora: a
**WhatsApp Business Calling API existe**, é oficial, e está documentada em
[developers.facebook.com/docs/whatsapp/cloud-api/calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/).

Ela faz voz sobre IP nos dois sentidos — o usuário liga para o negócio, e o
negócio liga para o usuário.

### Os pré-requisitos, copiados da doc

1. O número está na Cloud API, não no app WhatsApp Business. ✅ **temos**
2. O app assinado no campo de webhook `calls`. ⚙️ *config, fácil*
3. O mesmo app assinado na WABA do número. ✅ **temos**
4. Permissão `whatsapp_business_messaging`. ✅ **temos** — **não exige App Review novo**
5. **Limite diário de no mínimo 2.000 destinatários únicos.** ❌ **é aqui que trava**
6. Habilitar Calling no número. ⚙️ *config*

### Por que o item 5 é um muro e não um detalhe

O limite de mensagens é o degrau que a Meta concede por **volume e qualidade
acumulados**. Um cliente novo começa em 250 ou 1.000 destinatários/dia e sobe
sozinho conforme manda. Nenhum cliente de estúdio de pilates vai a 2.000
destinatários únicos por dia — e não é para ir.

Ou seja: **a ligação não é bloqueada por código nosso, é bloqueada por volume do
cliente.** Escrever a integração hoje seria escrever para uma conta que não
existe.

### E se algum cliente chegasse lá, o custo seria este

A doc diz que a mídia trafega em **WebRTC (ICE + DTLS + SRTP)**, com SIP como
alternativa. Isso não é "mais um endpoint da Graph": é virar um *endpoint* de
voz. Precisaria de servidor de sinalização, STUN/TURN, tratamento de SDP e um
cliente de áudio no navegador do atendente. É um produto, não um recurso.

E os tetos de produção são apertados mesmo depois de tudo isso — por par
(negócio, usuário): **1 pedido de permissão de ligação por dia, 2 por semana**;
4 chamadas não atendidas seguidas revogam a permissão automaticamente.

**Decisão: não fazer.** Reavaliar apenas se um cliente passar dos 2.000
destinatários/dia — e aí a conversa começa por "vale um produto de voz?", não
por "vamos ligar a API".

### O que muda na camada 4 (chamada perdida)

Nada. A camada 4 do handoff trata do webhook `calls` para **registrar que houve
uma chamada**, não para atender. Isso continua valendo e continua dependendo de
uma chamada real para descobrir os campos. O achado de hoje só confirma que o
campo de webhook se chama `calls`.

---

## Áudio: o problema nunca foi a API, era o formato do navegador

`enviarMidia` já mandava `audio` desde a Fase 11. O que não existia era **gravar**.

### O que a Meta aceita, copiado da tabela dela

Fonte: [developers.facebook.com/docs/whatsapp/cloud-api/reference/media](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)

| Formato | MIME | Teto |
|---|---|---|
| AAC | `audio/aac` | 16 MB |
| AMR | `audio/amr` | 16 MB |
| MP3 | `audio/mpeg` | 16 MB |
| MP4 Audio (.m4a) | `audio/mp4` | 16 MB |
| OGG | `audio/ogg` — **"OPUS codecs only; base audio/ogg not supported; mono input only"** | 16 MB |

**`audio/webm` não está na lista.** E era exatamente esse o risco que o handoff
apontou: o Chrome grava em WebM por padrão.

### O que o navegador grava, e por que isso deixou de ser um problema

O handoff supunha que seria preciso converter no navegador. **Não é mais.** O
Chrome passou a aceitar contêiner MP4 no `MediaRecorder`
([Intent to ship, Chromium](https://groups.google.com/a/chromium.org/g/blink-dev/c/p1OMVj1FrMI)),
e o Safari sempre gravou em MP4. Sobra o Firefox, que grava OGG/Opus — que a
Meta aceita direto.

| Navegador | O que pedir | Meta aceita? |
|---|---|---|
| Chrome / Edge / Opera | `audio/mp4;codecs=mp4a.40.2` | ✅ |
| Safari | `audio/mp4;codecs=mp4a.40.2` | ✅ |
| Firefox | `audio/ogg;codecs=opus` | ✅ |
| Só WebM | — | ❌ → recusa com motivo em português |

### ⚠️ Pedir `audio/mp4` sem codec é a armadilha, e ela custou um envio

**Esta seção foi reescrita em 15/set/2026, depois de o primeiro áudio não
chegar.** A versão anterior dizia que os navegadores "gravam `audio/mp4`" e
tratava isso como suficiente. **Não é.**

Contêiner e codec são coisas separadas. `audio/mp4` pedido **sem** `;codecs=`
deixa a escolha com o navegador, e o Chrome escolhe **Opus dentro de MP4**. Para
a Meta, `audio/mp4` significa **AAC**; Opus ela só entrega em contêiner **OGG**.

O arquivo que não chegou foi aberto byte a byte e confirmou:

```
mp4a  -> AUSENTE      esds -> AUSENTE
Opus  -> offset 530   dOps -> offset 586
ftyp  -> isom / iso6 / iso2 / vp09 / mp41
```

**O modo de falha é o pior possível:** o Storage aceita (o MIME `audio/mp4`
confere), a Cloud API responde **200**, a mensagem é gravada como entregue — e
nada chega no celular. Como o webhook `statuses` da Meta não é tratado, não há
onde a falha apareça.

Duas defesas, e as duas são necessárias:

1. **Pedir sempre com `;codecs=`.** `audio/mp4` puro não volta para a lista.
2. **Conferir `MediaRecorder.mimeType` depois do `start()`** — o tipo efetivo,
   que revela o que o navegador realmente fez. Pedir não garante receber.

Continua sem conversão, sem WASM e sem dependência nova. O que mudou é que a
negociação passou a ser verificada, não presumida.

### Mono, porque a Meta exige e ninguém lê a letra miúda

`"mono input only"` está na linha do OGG. `getUserMedia` pede
`channelCount: 1` — e de quebra o arquivo fica metade do tamanho. Um minuto de
voz sai em torno de 120 KB, longe dos 16 MB.

---

## Figurinha: o problema é acervo, não API

Confirmado na mesma tabela: WebP **estática ≤ 100 KB**, **animada ≤ 500 KB**.

Converter imagem para WebP dentro desses tetos no navegador é possível e é o
caminho ruim — o resultado varia com a imagem e a pessoa descobre o limite
errando. O honesto continua sendo um acervo de figurinhas por cliente, subido
uma vez. **Camada 3, como o handoff já dizia. Não mudou nada.**

---

## GIF continua sem doc

O handoff registrou que GIF vira MP4 na prática e que isso **não é
documentado**. A tabela de mídia confirma: não há linha de GIF. Continua
precisando de teste real antes de virar promessa na tela.

---

## Fontes

- [Calling — WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/)
- [Cloud API Calling — visão geral](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling)
- [Supported media types — Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)
- [Intent to ship: MP4 container support for MediaRecorder — blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/p1OMVj1FrMI)
- [MediaRecorder.isTypeSupported — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
