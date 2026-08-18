-- 0017 — o acervo de mídia de cada cliente.
--
-- O bloco de mídia entrou pedindo uma URL `https://` colada à mão, e isso é
-- metade de uma funcionalidade: quem desenha o fluxo do estúdio não tem onde
-- hospedar a foto da sala. O acervo é esse lugar.
--
-- **O nome do bucket carrega o produto, e isto é a correção de um erro nosso.**
-- O bucket das logos se chama `logos`, sem prefixo, e Storage é global ao
-- projeto compartilhado — a Verandi já tem `foto-profissional` e `foto-pessoa`
-- ali do lado. Renomear `logos` agora quebraria toda `logo_url` já gravada, mas
-- o bucket novo não repete o erro. Ver docs/BANCO-COMPARTILHADO.md.
--
-- **Público, e a decisão é consciente.** A Cloud API baixa o arquivo do `link`
-- que mandamos, então a Meta precisa alcançá-lo sem credencial nossa. URL
-- assinada expiraria e transformaria "a foto parou de chegar" num mistério de
-- produção. O que entra aqui é material que o cliente publica no WhatsApp de
-- qualquer forma — catálogo, foto de sala, PDF de plano. Documento pessoal não
-- entra, e isso é regra de uso, não de banco.
--
-- Objeto exclusivo do AutoFluxos. Não toca `app_verandi`, e a única coisa
-- global que encosta é o Storage, avaliada acima.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'autofluxos-acervo',
  'autofluxos-acervo',
  true,
  -- 16 MB é o teto da própria Cloud API para vídeo e documento. Aceitar mais
  -- seria guardar arquivo que a Meta recusaria na hora de entregar, e o erro
  -- apareceria na conversa de um cliente em vez de no upload.
  16777216,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'audio/mpeg',
    'audio/ogg',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- SVG fica de fora pelo mesmo motivo do bucket de logos: ele carrega script, e
-- num bucket público isso seria XSS hospedado por nós. O WhatsApp também não
-- envia SVG, então não há caso de uso perdido.
--
-- Mapa dos buckets deste projeto, já que Storage não separa produto:
--   logos, autofluxos-acervo          → AutoFluxos
--   foto-pessoa, foto-profissional    → Verandi
--
-- Não dá para documentar isso com `comment on table storage.buckets`: a tabela
-- é do papel `supabase_storage_admin` e a Management API responde
-- `42501: must be owner of table buckets`. Comentário de migration é o lugar
-- que sobra, e é versionado do mesmo jeito.
