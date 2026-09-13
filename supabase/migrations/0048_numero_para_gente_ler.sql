-- O número do jeito que a pessoa reconhece, não do jeito que a Meta indexa.
--
-- A tela do número mostrava `110549275215531` — o `phone_number_id`. Para quem
-- conectou, isso não é o telefone dele: é um número que ele nunca viu na vida.
-- O botão ao lado diz "Conectar número", e a pessoa olha a lista, não acha o
-- seu, e conclui que não conectou. Foi o que aconteceu em 13/set/2026.
--
-- A Meta já nos dá os dois campos no onboarding (`lerNumero` lê
-- `display_phone_number` e `verified_name` e descartava ambos). Guardar é mais
-- barato e mais honesto que consultar a Graph API a cada render: a tela não
-- pode depender de uma chamada de rede para dizer qual número está ali, e um
-- número que a Meta não responde agora não deixa de ser o número do cliente.
--
-- Ficam anuláveis de propósito: os canais que já existem não têm como serem
-- preenchidos retroativamente sem uma volta à Meta, e a tela sabe cair de volta
-- no id quando falta. Nada aqui é chave de nada — `phone_number_id` continua
-- sendo a identidade.

alter table public.channels
  add column if not exists display_phone_number text,
  add column if not exists verified_name text;

comment on column public.channels.display_phone_number is
  'O telefone formatado como a Meta exibe (+55 11 91100-1414). Só para a tela: a identidade do canal é phone_number_id.';

comment on column public.channels.verified_name is
  'O nome de exibição aprovado na Meta ("Eduardo Yamamoto | Gestor de Growth"). Só para a tela.';
