-- O acervo passa a aceitar o formato que o navegador grava.
--
-- **O que quebrava sem isto.** A caixa de resposta ganhou um botão de gravar
-- áudio. O navegador grava em `audio/mp4` (Chrome, Edge, Opera, Safari) ou em
-- `audio/ogg` (Firefox). A `0017` criou o `autofluxos-acervo` com uma lista
-- fechada de `allowed_mime_types` que tem `audio/mpeg` e `audio/ogg` — e **não**
-- tem `audio/mp4`. Sem esta migration, gravar funciona, a URL assinada de
-- envio é emitida, e o `PUT` volta 400 na cara de quem atende: o Storage
-- compara a string do `content-type` com a lista, e `audio/mp4` não está nela.
--
-- **Por que `audio/mp4` e `audio/aac` e nada além disso.** São as duas linhas
-- da tabela da própria Meta que faltavam e que algum navegador produz. AMR não
-- entra: nenhum navegador grava AMR, e MIME aceito que ninguém produz é
-- superfície aberta sem caso de uso. A lista continua fechada de propósito — é
-- a mesma defesa que a `0055` escreveu para o bucket dos recebidos.
--
-- Fonte da tabela, conferida em 15/set/2026 e registrada com URL em
-- docs/PESQUISA-VOZ-E-CHAMADA.md:
-- developers.facebook.com/docs/whatsapp/cloud-api/reference/media
--
-- **Não mexe no `public` do bucket.** Ele continua público, e continua sendo o
-- risco em aberto que o handoff de 15/set registrou no item 2 — a mídia que sai
-- vai para URL pública e permanente. Fechar isso é outro trabalho, com outra
-- migration, e trocar duas coisas de uma vez tornaria impossível saber qual
-- delas quebrou o envio. Esta aqui só amplia uma lista.
--
-- **Objeto do AutoFluxos.** Não toca `app_verandi`. A única coisa global que
-- encosta é o Storage, e o alcance é um bucket que já existe e é só nosso:
-- não cria bucket, não cria policy, não altera cota. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

update storage.buckets
   set allowed_mime_types = array[
         'image/png',
         'image/jpeg',
         'image/webp',
         'video/mp4',
         'audio/mpeg',
         'audio/ogg',
         -- As duas linhas novas. `audio/mp4` é o que Chrome, Edge, Opera e
         -- Safari gravam (contêiner MP4 com AAC dentro, extensão .m4a na
         -- tabela da Meta). `audio/aac` é o AAC cru, que alguns navegadores
         -- oferecem como alternativa e a Meta também aceita.
         'audio/mp4',
         'audio/aac',
         'application/pdf'
       ]
 where id = 'autofluxos-acervo';

-- SVG continua fora, pelo motivo da 0017: ele carrega script e o bucket é
-- público. Nada aqui reabre essa porta.
