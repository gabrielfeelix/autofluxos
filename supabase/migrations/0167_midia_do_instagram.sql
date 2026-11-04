-- 0167: formatos que o Instagram e o Messenger usam, nos dois buckets do AutoFluxos.
--
-- **Recebidos.** A partir de 04/nov/2026 o anexo do direct (Instagram e
-- Messenger) é baixado como o do WhatsApp. Três formatos aparecem lá e não na
-- Cloud API: o GIF do teclado (`image/gif`, hospedado no Giphy), o vídeo do
-- iPhone (`video/quicktime`) e o áudio em WAV. O resto (o áudio de voz, que o
-- Instagram serve como `video/mp4`; a figurinha e a prévia de post em JPEG) já
-- estava na lista.
--
-- **Acervo.** `audio/wav` para a voz gravada no Inbox e mandada pelo Instagram
-- ou Messenger, que não tocam OGG (ver `src/core/wav.ts`). O envio para WhatsApp
-- recusa WAV antes de sair (`acoes-midia-do-inbox.ts`).
--
-- **Objeto do AutoFluxos.** Só amplia a lista de dois buckets que já existem e
-- são só nossos. Não cria bucket, não cria policy, não muda tamanho nem
-- `public`. Não toca `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.
--
-- Idempotente: só acrescenta o que falta.

set search_path = public, extensions;

update storage.buckets
   set allowed_mime_types = (
         select array_agg(distinct m order by m)
           from unnest(allowed_mime_types || array['image/gif', 'video/quicktime', 'audio/wav']) as m
       )
 where id = 'autofluxos-recebidos';

update storage.buckets
   set allowed_mime_types = (
         select array_agg(distinct m order by m)
           from unnest(allowed_mime_types || array['audio/wav']) as m
       )
 where id = 'autofluxos-acervo';
