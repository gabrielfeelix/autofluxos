-- 0144: o acervo aceita o resto dos documentos da Meta e os arquivos que saem por link.
--
-- **Por quê.** Em 22/out/2026 o atendimento tentou mandar o driver de um mouse
-- da PCYES em `.zip` pelo Inbox e foi recusado. A Cloud API só anexa, como
-- documento, PDF, TXT e Office (tabela de mídia da Meta); `.zip` e `.exe` ela
-- não anexa nunca. Então:
--
-- - TXT, DOC/DOCX, XLS/XLSX e PPT/PPTX entram como documento de verdade. São as
--   mesmas linhas que o `autofluxos-recebidos` (0055) já aceita na entrada.
-- - `.zip`, `.rar`, `.7z`, `.exe` e `.msi` sobem como `application/octet-stream`
--   e o Inbox manda um botão "Baixar arquivo" apontando para eles. O tipo
--   genérico faz o navegador baixar em vez de abrir, e é um só para a lista,
--   porque o mesmo `.zip` chega com tipo diferente em cada sistema operacional.
--   Ver `EXTENSOES_POR_LINK` em src/server/repos/acervo.ts.
--
-- **As duas listas andam juntas** (ver `TIPOS_ACEITOS` no mesmo arquivo):
-- tipo que o código aceita e o bucket não dá 400 no `PUT`, longe de qualquer
-- mensagem em português.
--
-- **Objeto do AutoFluxos.** Só amplia a lista de um bucket que já existe e é
-- só nosso. Não cria bucket, não cria policy, não muda tamanho nem `public`.
-- Não toca `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

update storage.buckets
   set allowed_mime_types = array[
         'image/png',
         'image/jpeg',
         'image/webp',
         'video/mp4',
         'audio/mpeg',
         'audio/ogg',
         'audio/mp4',
         'audio/aac',
         'application/pdf',
         'text/plain',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/octet-stream'
       ]
 where id = 'autofluxos-acervo';

-- SVG e HTML continuam fora, pelo motivo da 0017: carregam script e o bucket
-- é público. `octet-stream` não abre no navegador, só baixa.
