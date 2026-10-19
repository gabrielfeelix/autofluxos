-- 0138, índice em toda chave estrangeira de `public`, e fora os índices
-- repetidos.
--
-- O painel apontou 49 chaves sem índice em 19/out/2026. Quase todas estão em
-- tabela de poucas centenas de linhas, onde hoje o Postgres prefere ler a
-- tabela inteira e o índice não faz diferença. Ele passa a fazer quando a
-- tabela cresce, e principalmente ao apagar a linha do outro lado da chave:
-- sem índice, cada `delete` em `clients`, `flows`, `af_usuarios` ou
-- `contacts` varre as tabelas que apontam para ela. Índice de chave é o
-- padrão que o Supabase recomenda, e aqui custa poucos kB cada.
--
-- Efeito esperado no painel: o aviso de chave sem índice zera, e estes
-- índices aparecem como "não usados" até as tabelas crescerem. Esse segundo
-- aviso, nesse tamanho, quer dizer só que a tabela é pequena.
--
-- Os seis índices apagados no fim são cobertos por outro que começa pelas
-- mesmas colunas (um deles, `sequencia_passos_idx`, é cópia exata de um
-- índice único). Toda consulta que os usava passa a usar o outro, e cada
-- escrita deixa de manter um índice à toa.
--
-- Parciais onde a coluna aceita vazio: a chave só é procurada com valor.
-- Só em `public`. Nada da Verandi é tocado.

create index if not exists af_convites_inviterid_fk_idx
  on public.af_convites ("inviterId");

create index if not exists af_fixadas_contato_id_fk_idx
  on public.af_fixadas (contato_id);

create index if not exists af_leituras_contato_id_fk_idx
  on public.af_leituras (contato_id);

create index if not exists af_membros_funcao_id_fk_idx
  on public.af_membros (funcao_id)
  where funcao_id is not null;

create index if not exists af_sessoes_activeorganizationid_fk_idx
  on public.af_sessoes ("activeOrganizationId")
  where "activeOrganizationId" is not null;

create index if not exists af_sessoes_impersonatedby_fk_idx
  on public.af_sessoes ("impersonatedBy")
  where "impersonatedBy" is not null;

create index if not exists api_idempotencia_chave_api_id_fk_idx
  on public.api_idempotencia (chave_api_id)
  where chave_api_id is not null;

create index if not exists atividades_responsavel_fk_idx
  on public.atividades (responsavel)
  where responsavel is not null;

create index if not exists avaliacoes_de_qualificacao_client_id_fk_idx
  on public.avaliacoes_de_qualificacao (client_id);

create index if not exists campanhas_flow_id_fk_idx
  on public.campanhas (flow_id);

create index if not exists chamadas_channel_id_fk_idx
  on public.chamadas (channel_id);

create index if not exists channels_client_id_fk_idx
  on public.channels (client_id);

create index if not exists channels_flow_id_fk_idx
  on public.channels (flow_id)
  where flow_id is not null;

create index if not exists chaves_de_api_criada_por_fk_idx
  on public.chaves_de_api (criada_por)
  where criada_por is not null;

create index if not exists clients_plano_fk_idx
  on public.clients (plano);

create index if not exists clients_plano_agendado_fk_idx
  on public.clients (plano_agendado)
  where plano_agendado is not null;

create index if not exists clients_responsavel_padrao_fk_idx
  on public.clients (responsavel_padrao)
  where responsavel_padrao is not null;

create index if not exists conclusoes_de_processo_destino_cartao_id_fk_idx
  on public.conclusoes_de_processo (destino_cartao_id)
  where destino_cartao_id is not null;

create index if not exists consentimentos_cliente_id_fk_idx
  on public.consentimentos (cliente_id);

create index if not exists contacts_atribuido_a_fk_idx
  on public.contacts (atribuido_a)
  where atribuido_a is not null;

create index if not exists contatos_da_agenda_channel_id_fk_idx
  on public.contatos_da_agenda (channel_id);

create index if not exists duvidas_contact_id_fk_idx
  on public.duvidas (contact_id);

create index if not exists duvidas_lidas_client_id_fk_idx
  on public.duvidas_lidas (client_id);

create index if not exists entregas_de_webhook_client_id_fk_idx
  on public.entregas_de_webhook (client_id);

create index if not exists equipe_membros_usuario_id_fk_idx
  on public.equipe_membros (usuario_id);

create index if not exists eventos_do_contato_client_id_fk_idx
  on public.eventos_do_contato (client_id);

create index if not exists flows_versao_publicada_id_fk_idx
  on public.flows (versao_publicada_id)
  where versao_publicada_id is not null;

create index if not exists fluxo_links_criado_por_fk_idx
  on public.fluxo_links (criado_por)
  where criado_por is not null;

create index if not exists fluxo_links_flow_version_id_fk_idx
  on public.fluxo_links (flow_version_id);

create index if not exists gatilhos_flow_id_fk_idx
  on public.gatilhos (flow_id);

create index if not exists gatilhos_de_evento_flow_id_fk_idx
  on public.gatilhos_de_evento (flow_id);

create index if not exists lojas_integradas_conexao_id_fk_idx
  on public.lojas_integradas (conexao_id)
  where conexao_id is not null;

create index if not exists membro_capacidades_autor_fk_idx
  on public.membro_capacidades (autor)
  where autor is not null;

create index if not exists membro_capacidades_usuario_id_fk_idx
  on public.membro_capacidades (usuario_id);

create index if not exists mensagens_agendadas_contato_id_fk_idx
  on public.mensagens_agendadas (contato_id);

create index if not exists negocio_arquivos_client_id_fk_idx
  on public.negocio_arquivos (client_id);

create index if not exists quadro_cartoes_responsavel_fk_idx
  on public.quadro_cartoes (responsavel)
  where responsavel is not null;

create index if not exists quadros_seguinte_id_fk_idx
  on public.quadros (seguinte_id)
  where seguinte_id is not null;

create index if not exists revisoes_de_venda_client_id_fk_idx
  on public.revisoes_de_venda (client_id);

create index if not exists sequencia_passos_flow_id_fk_idx
  on public.sequencia_passos (flow_id);

create index if not exists sequencia_passos_template_id_fk_idx
  on public.sequencia_passos (template_id)
  where template_id is not null;

create index if not exists sequencias_etiqueta_de_saida_id_fk_idx
  on public.sequencias (etiqueta_de_saida_id)
  where etiqueta_de_saida_id is not null;

create index if not exists sessions_channel_id_fk_idx
  on public.sessions (channel_id);

create index if not exists sessions_fluxo_de_volta_fk_idx
  on public.sessions (fluxo_de_volta)
  where fluxo_de_volta is not null;

create index if not exists transmissao_destinatarios_contato_id_fk_idx
  on public.transmissao_destinatarios (contato_id);

create index if not exists transmissoes_segmento_id_fk_idx
  on public.transmissoes (segmento_id)
  where segmento_id is not null;

create index if not exists transmissoes_template_id_fk_idx
  on public.transmissoes (template_id);

create index if not exists vendas_autor_fk_idx
  on public.vendas (autor)
  where autor is not null;

create index if not exists webhooks_de_saida_criado_por_fk_idx
  on public.webhooks_de_saida (criado_por)
  where criado_por is not null;

drop index if exists public.af_leituras_usuario_idx;          -- coberto por af_leituras_pkey (usuario_id, contato_id)
drop index if exists public.connections_client_id_idx;        -- coberto por connections_client_id_nome_key
drop index if exists public.contatos_da_agenda_cliente_idx;   -- coberto por contatos_da_agenda_client_id_phone_number_key
drop index if exists public.flow_versions_flow_id_idx;        -- coberto por flow_versions_flow_id_versao_key
drop index if exists public.flows_client_id_idx;              -- coberto por flows_ordem_idx (client_id, ordem, criado_em)
drop index if exists public.sequencia_passos_idx;             -- igual a sequencia_passos_unicos_idx
