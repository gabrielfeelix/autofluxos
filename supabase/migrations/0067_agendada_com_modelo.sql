-- 0067, a mensagem agendada que sabe usar um modelo aprovado.
--
-- Responde a uma queixa do dono, e ela expõe um buraco real do produto: *"se eu
-- agendar mensagem para daqui uma semana, não faz sentido, sendo que eu preciso
-- de template para conseguir agendar. Qual o sentido de agendar uma mensagem
-- quando eu preciso de um template para conseguir?"*.
--
-- Ele está certo. Hoje `mensagens_agendadas` só guarda texto livre, e
-- `enviar-agendadas.ts` confere a janela de 24h no instante do envio e recusa
-- com "o WhatsApp só deixa retomar por um modelo aprovado". Ou seja: marcar algo
-- para daqui uma semana é quase sempre marcar uma falha para daqui uma semana.
-- A tela avisa, mas avisar que uma coisa não vai funcionar não é o mesmo que
-- fazê-la funcionar.
--
-- O que esta migration muda: a agendada passa a poder carregar um modelo. Fora
-- da janela, o envio usa o modelo em vez de recusar; dentro, o texto livre
-- continua sendo o caminho, que é mais barato e não gasta cota da Meta.
--
-- **As duas colunas são anuláveis, e nulo é o comportamento de hoje.** Nenhuma
-- linha existente muda de sentido: agendada sem modelo continua sendo texto
-- livre que depende da janela, exatamente como antes.
--
-- Aditiva: duas colunas anuláveis numa tabela com dado de produção, sem
-- reescrita e sem alterar coluna existente. Nada aqui cita `app_verandi`, e todo
-- objeto é qualificado com `public.` (ver docs/BANCO-COMPARTILHADO.md).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Qual modelo mandar, quando a janela estiver fechada
-- ---------------------------------------------------------------------------
--
-- Sem chave estrangeira para `public.templates`, e é decisão, não esquecimento:
-- um modelo apagado não pode apagar a mensagem que alguém marcou, nem impedir
-- o envio de ser tentado e falhar com motivo legível. O envio confere o modelo
-- na hora, como `acaoRetomarComModelo` já faz, porque a Meta pausa modelo por
-- qualidade sem avisar e um `references` não protegeria disso de qualquer jeito.

alter table public.mensagens_agendadas
  add column if not exists template_id uuid;

comment on column public.mensagens_agendadas.template_id is
  'O modelo aprovado a usar quando a janela de 24h estiver fechada na hora do envio. Nulo = só texto livre, o comportamento anterior a esta coluna.';

-- ---------------------------------------------------------------------------
-- 2. O que preencher nos buracos do modelo
-- ---------------------------------------------------------------------------
--
-- `jsonb` e não `text[]`: o modelo pode ganhar variável de cabeçalho e de botão
-- depois, e um array de texto obrigaria outra migration para caber. O formato
-- segue o que o adaptador já recebe em `enviarTemplate` (`{ corpo: [...] }`).
--
-- Nulo significa "resolva na hora", que é o que `acaoRetomarComModelo` faz hoje
-- ao preencher com o nome do contato. Guardar o valor resolvido no momento de
-- agendar seria congelar um nome que pode mudar na semana que vem.

alter table public.mensagens_agendadas
  add column if not exists template_valores jsonb;

comment on column public.mensagens_agendadas.template_valores is
  'Valores das variáveis do modelo, no formato do adaptador. Nulo = resolver na hora do envio com o nome do contato.';

-- A tabela vive em `public`, que é schema exposto na Data API, e o servidor fala
-- com ela pelo PostgREST. Sem recarregar o cache, `select('template_id')`
-- responde 400 até a próxima reinicialização. O cache é o mesmo dos dois
-- produtos, por isso o reload é breve e de propósito.
notify pgrst, 'reload schema';
