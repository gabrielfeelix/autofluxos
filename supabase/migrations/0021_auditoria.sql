-- 0021 — o registro de quem fez o quê.
--
-- Fecha a fundação da Etapa A. A 0019 trouxe usuário, a 0020 trouxe conta e
-- papel, e esta responde a pergunta que as duas criam: **quem publicou isso?**
-- Hoje ela não tem resposta, e o EXPANSAO já listava "Registros (auditoria)" na
-- lista honesta do que não existe.
--
-- Ela vira exigência de verdade no dia em que houver contrato, e vira exigência
-- imediata por causa do "entrar como": um administrador da 4YU consegue agir
-- dentro da conta de um cliente, e um recurso desses sem rastro é indefensável.
-- A boa prática do recurso é registrar **no instante da impersonação** e manter
-- o registro por mais tempo que o resto (docs/PLANO-SISTEMA.md §4.1).
--
-- **Append-only, e isso é o ponto.** Um log que o próprio sistema consegue
-- editar não prova nada. Os `revoke` no fim tiram `update` e `delete` de todo
-- mundo que não seja dono da tabela — inclusive da aplicação.

create table if not exists public.af_auditoria (
  id          uuid        not null primary key default gen_random_uuid(),
  quando      timestamptz not null default now(),

  -- Quem agiu. `on delete set null` e não `cascade`: apagar um usuário **não
  -- pode** apagar o que ele fez. Sem isso, sumir com o próprio rastro seria uma
  -- questão de pedir a exclusão da conta.
  autor_id    uuid references public.af_usuarios (id) on delete set null,
  -- Guardado como texto no momento do ato, porque `autor_id` pode virar nulo e
  -- "alguém apagou 428 contatos" é uma linha inútil.
  autor_email text        not null default '',

  -- Em qual conta. Também `set null`: a conta pode ser apagada, e justamente aí
  -- o registro de quem a apagou é o que mais importa.
  conta_id    uuid references public.clients (id) on delete set null,
  conta_nome  text        not null default '',

  -- O que aconteceu, em verbo: `publicou_fluxo`, `apagou_contato`,
  -- `entrou_como`, `convidou_membro`, `trocou_papel`, `apagou_cliente`.
  -- Texto livre e não enum de propósito: enum obrigaria migration a cada ação
  -- nova, e o custo de uma ação não registrada é maior que o de um nome torto.
  acao        text        not null,

  -- Sobre o quê. `alvo_tipo` é a tabela ou conceito (`flow`, `contact`,
  -- `client`, `usuario`); `alvo_id` é o id como texto, porque nem todo alvo é
  -- uuid e uma FK aqui impediria registrar a exclusão do próprio alvo.
  alvo_tipo   text        not null default '',
  alvo_id     text        not null default '',
  -- O nome legível do alvo no momento do ato, pelo mesmo motivo de `autor_email`.
  alvo_nome   text        not null default '',

  -- O que mais valha guardar: versão publicada, quantos contatos sumiram, o
  -- motivo digitado. Sem segredo aqui — nunca credencial, nunca token.
  detalhes    jsonb       not null default '{}'::jsonb,

  -- Preenchido quando o ato aconteceu dentro de um "entrar como". É a coluna
  -- que separa "o cliente fez" de "a 4YU fez em nome do cliente", e sem ela a
  -- auditoria mente por omissão.
  impersonado_por uuid references public.af_usuarios (id) on delete set null,

  ip          text        not null default '',
  agente      text        not null default ''
);

-- A leitura real é sempre "o que aconteceu nesta conta, do mais novo para o
-- mais velho". Sem este índice a tela de Registros vira varredura no primeiro
-- cliente com volume.
create index if not exists af_auditoria_conta_quando_idx
  on public.af_auditoria (conta_id, quando desc);

create index if not exists af_auditoria_autor_quando_idx
  on public.af_auditoria (autor_id, quando desc);

-- Índice parcial: impersonação é uma fração minúscula das linhas, e é a
-- consulta que um dia alguém vai fazer com pressa.
create index if not exists af_auditoria_impersonacao_idx
  on public.af_auditoria (impersonado_por, quando desc)
  where impersonado_por is not null;

comment on table public.af_auditoria is
  'Registro append-only de quem fez o quê. Não tem update nem delete: log que o sistema edita não prova nada.';
comment on column public.af_auditoria.impersonado_por is
  'Administrador que estava dentro da conta pelo "entrar como" quando o ato aconteceu. Nulo = foi a própria pessoa.';
comment on column public.af_auditoria.detalhes is
  'Contexto do ato. Nunca guardar credencial, token ou senha aqui.';

alter table public.af_auditoria enable row level security;

-- Ninguém que venha pela Data API alcança isto.
revoke all on public.af_auditoria from anon, authenticated;

-- **A garantia do append-only.** `service_role` é a chave que a aplicação usa e
-- que ignora RLS; tirar `update` e `delete` dela é o que impede que um bug — ou
-- alguém com a chave — reescreva o passado. Inserir e ler continua liberado,
-- que é tudo que um log precisa.
-- `revoke all` e depois conceder só os dois, em vez de revogar update/delete:
-- na primeira escrita eu revoguei só esses dois e **`truncate` ficou de pé**,
-- que esvazia a tabela inteira e torna o append-only decorativo. Lista do que
-- entra é sempre melhor que lista do que sai.
revoke all on public.af_auditoria from service_role;
grant select, insert on public.af_auditoria to service_role;

notify pgrst, 'reload schema';
