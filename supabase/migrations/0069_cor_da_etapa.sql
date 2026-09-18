-- 0069 — a etapa ganha cor.
--
-- O funil é lido de relance, várias vezes por dia, e hoje todas as colunas têm o
-- mesmo cabeçalho cinza: achar "Proposta" no meio de sete etapas exige ler os
-- sete nomes. Cor é o que transforma a varredura em reconhecimento — é por isso
-- que RD, Pipedrive e Kommo têm todos alguma marca de cor por etapa.
--
-- ---------------------------------------------------------------------------
-- Por que um nome de cor, e não `#rrggbb`
-- ---------------------------------------------------------------------------
--
-- Hex livre quebra nos dois temas. Este produto tem claro e escuro, e um
-- `#fde047` escolhido no escuro vira texto ilegível sobre fundo branco no claro
-- — e quem escolheu não vai testar os dois. Guardando o **nome** da cor, quem
-- decide o tom exato é o CSS, que já sabe o tema em que está.
--
-- É também o que impede o funil de virar arco-íris: oito opções decididas uma
-- vez valem mais que 16 milhões decididas a cada etapa nova.
--
-- `null` = sem cor, que é o estado de tudo que já existe. A ausência é um valor
-- legítimo aqui: quem não quiser pintar nada continua com o funil de hoje, e
-- nenhuma etapa antiga muda de aparência por causa desta migration.
--
-- Aditivo e sem reescrever linha nenhuma, como toda migration desde a 0058:
-- aplica num banco dividido com a Verandi sem janela de parada. Nada aqui cita
-- `app_verandi`, e todo objeto é qualificado com `public.`
-- (ver docs/BANCO-COMPARTILHADO.md).

alter table public.quadro_colunas
  add column if not exists cor text
    check (
      cor is null
      or cor in ('cinza', 'azul', 'verde', 'amarelo', 'laranja', 'vermelho', 'roxo', 'rosa')
    );

comment on column public.quadro_colunas.cor is
  'O nome da cor, não o hex: quem decide o tom é o CSS, que sabe o tema. Null = sem cor.';

-- A coluna entra numa tabela que o PostgREST já serve, e o cache de colunas é o
-- mesmo dos dois produtos. Sem isto, escrever `cor` responde erro de coluna
-- desconhecida até a próxima reinicialização.
notify pgrst, 'reload schema';
