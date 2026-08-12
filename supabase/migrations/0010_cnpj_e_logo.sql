-- 0010 — CNPJ e logo do cliente.
--
-- CNPJ entra porque nota fiscal vai ser emitida em algum momento, e o número
-- que falta na hora de emitir é o que ninguém anotou na hora de vender.
--
-- `logo_url` guarda **endereço**, não imagem. A tentação é gravar a imagem em
-- base64 numa coluna de texto e acabar com o problema — e o preço aparece na
-- lista de clientes, que faz `select` em todas as linhas: vinte clientes com
-- 60 KB de logo viram 1,2 MB trafegados para desenhar uma tela de cartões.
-- Endereço custa 80 bytes e o navegador cacheia a imagem sozinho.

alter table public.clients
  add column if not exists cnpj     text not null default '',
  add column if not exists logo_url text not null default '';

comment on column public.clients.cnpj is
  'Só para emissão de nota. Guardado como foi digitado — validar formato aqui recusaria MEI, CPF e cliente estrangeiro.';
comment on column public.clients.logo_url is
  'Endereço público no bucket `logos`. Vazio = a tela mostra as iniciais.';

-- O bucket das logos.
--
-- Público de propósito: logo de empresa é material de identidade, aparece no
-- painel e não é segredo. URL assinada exigiria assinar de novo a cada
-- renderização de lista e não protegeria nada que já não esteja no site do
-- cliente.
--
-- O limite de tamanho e a lista de tipos moram **no bucket**, não só no nosso
-- código: assim a recusa vale mesmo se alguém um dia subir por outro caminho.
-- SVG fica de fora — ele carrega script, e num bucket público isso seria XSS
-- hospedado por nós.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
