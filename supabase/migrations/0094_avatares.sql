-- Foto de perfil de quem usa o painel (tarefa 7.5, "Você" no rodapé).
--
-- **Storage é global ao projeto dividido com a Verandi** (ver
-- docs/BANCO-COMPARTILHADO.md). Bucket novo, com o nome do produto no id, não
-- muda bucket existente de ninguém. A cota de 1 GB do plano gratuito é
-- compartilhada: 2 MB de teto por arquivo, e a tela já manda um quadrado de
-- 256 px em webp, que fica em dezenas de KB.
--
-- **Público de propósito.** A foto aparece na barra lateral e na lista de
-- pessoas como `<img>`, e assinar URL a cada tela seria custo sem ganho: foto
-- de perfil não é documento pessoal. O caminho leva o id da pessoa e um carimbo
-- de tempo, então não é adivinhável a partir do nome.
--
-- **Sem policy de RLS.** `anon` e `authenticated` não escrevem nada; quem sobe
-- a foto é o servidor, com a `service_role`, depois de conferir a sessão. Leitura
-- pública vem do próprio `public = true` do bucket.
--
-- Não toca `app_verandi`. Aplicar só no Supabase local; produção fica pendente
-- para o Gabriel autorizar.

set search_path = public, extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'autofluxos-avatares',
  'autofluxos-avatares',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
