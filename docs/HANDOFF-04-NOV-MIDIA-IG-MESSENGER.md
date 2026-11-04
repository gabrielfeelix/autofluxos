# Handoff 04/nov/2026: mídia do Instagram e do Messenger no Inbox

> **Executado em 04/nov/2026.** Download pela URL de CDN em
> `channels/instagram.ts` (`baixarMidia`, hosts em `core/compartilhado.ts`),
> cartão de reel/post/story/link (`CompartilhadoNaBolha`), eco com cópia,
> voz em WAV para Instagram/Messenger (`core/wav.ts`), migration `0167`
> aplicada. Retroativo: 135 reels viraram cartão; 27 arquivos antigos ainda
> baixaram, 25 com URL expirada, 1 HEIC ignorado. Falta testar um envio real
> de áudio WAV pelo Inbox numa conversa do Instagram.

Pedido do Gabriel: tudo que o WhatsApp mostra no Inbox (áudio, imagem, vídeo,
figurinha, GIF, documento) tem que aparecer igual no Instagram e no Messenger,
recebido e enviado, mais o reel/post que a pessoa compartilha.

## Antes de começar

- `git pull` primeiro: outros agentes commitam nesta pasta. Commit só dos
  próprios arquivos (`git add` nominal) e push na hora, com o helper do
  `GITHUB_TOKEN` (memória `push-repo-motion`). Conferir o deploy READY na
  Vercel antes de dizer "no ar".
- Banco: ler `docs/BANCO-COMPARTILHADO.md`. Consulta e migration pela
  Management API com `SUPABASE_ACCESS_TOKEN` do cofre e o ref
  `xxxynoshwirupkdzwxbj`. Próxima migration: `ls supabase/migrations | tail -1`
  (a última hoje é `0166`).
- Validar com `tsc` e os testes dos arquivos tocados, nunca a suíte inteira.
- Gabriel quer resposta curta, sem explicação longa, e link clicável em todo
  passo que for dele.

## O que está errado hoje (medido no banco em 04/nov)

Contatos com `contacts.canal` em `instagram`/`messenger`, mensagens sem texto:
96 vídeos/reels, 37 figurinhas, 14 áudios e 2 imagens recebidos; 39 vídeos,
4 áudios e 1 imagem enviados. **Todos com `messages.arquivo` nulo.** O Inbox
mostra "arquivo recebido, sem cópia guardada" e, no eco do que foi mandado pelo
celular, "(áudio, imagem ou documento)".

O payload já traz o endereço, guardado como `id` (ver `paraMensagemInterna` em
`src/server/receber-do-instagram.ts`):

```
{"type":"video","video":{"id":"https://www.instagram.com/reel/DfDWVlSJslQ/"}}
{"type":"sticker","sticker":{"id":"https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=..."}}
```

No WhatsApp o `id` é um media id e a cópia é baixada por `guardarMidiaRecebida`
(procurar no código); no Instagram/Messenger é uma URL de CDN que expira.

## O que fazer

1. **Recebido (Instagram e Messenger):** quando o anexo tem URL de CDN
   (`lookaside.fbsbx.com`, `scontent`, `cdninstagram`), baixar e guardar pelo
   mesmo caminho do WhatsApp (`guardarMidiaRecebida`), para o Inbox tocar o
   áudio, mostrar imagem/figurinha/GIF e o vídeo como no WhatsApp.
2. **Reel, post e story compartilhados** (`ig_reel`, `share`, `story_mention`,
   e vídeo cujo `id` é `instagram.com/reel/...`): não baixar, mostrar como
   cartão de link ("Reel compartilhado", abre no Instagram). Hoje caem em
   `sticker`/`video` pela tabela `TIPO_DO_ANEXO`.
3. **Eco** (`gravarEco`, mesmo arquivo): ler os `attachments` do eco e gravar
   com o tipo e o arquivo certos, em vez do texto genérico.
4. **Messenger** (`src/server/receber-da-pagina.ts`): mesma coisa; os anexos
   chegam em `message.attachments[].payload.url`.
5. **Enviar mídia pelo Inbox** para Instagram/Messenger: conferir no adaptador
   (`channels/instagram.ts` e o do Messenger) se áudio/imagem/arquivo saem;
   o WhatsApp é a referência.
6. **Retroativo:** as mensagens antigas têm URL expirada; não dá para baixar.
   O reel antigo dá (é link público): converter os já gravados em cartão.

Validar com tsc e os testes do Instagram; print do Inbox em 1440 e 390 com uma
conversa do Estúdio de exemplo (`22ee56d8-48e3-4763-a5af-d863db5eee62`, conta
@gaabriel.feelix) que tenha áudio, figurinha e reel.

## Feito hoje que esta frente não deve desfazer

- `contacts.canal` (0166) e `contacts.foto_url`/`foto_em` (0165).
- Foto de perfil buscada na chegada da mensagem e ao conectar o Instagram
  (`src/server/foto-do-contato.ts`).
- Filtro por canal na fila e aviso de janela fechada em todo canal de 24h
  (`src/components/inbox/fila.tsx`).
- Fila em tempo real separada por empresa (`src/components/inbox/fila-viva.ts`).

## Outras pendências abertas em 04/nov (fora desta frente)

- **Decisão do Gabriel, caso Gunter (PCYES):** primeira mensagem que já traz
  pergunta ("entregam pra Maceió?") deve ir direto para a IA em vez do menu de
  boas-vindas? Ainda sem resposta.
- **Instagram da 4YU Tech Demonstração sem fluxo:** a @usedialogon recebe e
  ninguém responde. Ele escolhe o fluxo em
  https://dialogon.com.br/clientes/3a1d5ac8-369c-4373-856a-495468e7bad4/conversas/canais/instagram
- **Revisão da Meta:** permissões de página, `instagram_business_manage_comments`
  e `business_management` no rascunho; faltam os vídeos (Inbox do Instagram,
  Messenger, comentários). Estúdio de exemplo segue sendo a conta do revisor.
- **Nomes de contato da PCYES:** o envio de modelo pela API aceita `nome`
  desde `ae8e2cb0`; falta quem integra o sistema da PCYES mandar o campo.
