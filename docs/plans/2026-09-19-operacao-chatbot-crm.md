# Plano de implementação: operação centrada no chatbot e CRM conectado

**Objetivo:** entregar uma operação em que chatbot, atendimento humano, contexto
do contato e acompanhamento opcional compartilhem dados confiáveis, com regras e
interfaces definidas na [proposta principal](../PROPOSTA-19-SET-CHATBOT-FIRST.md).

**Arquitetura:** evoluir o monólito existente, separando regras puras em `src/core`,
coordenação/autorização em `src/server` e persistência em `src/server/repos`.
Reutilizar motor, canais, editor, fila técnica e design atual. Introduzir identidade
estável para ocorrências e oportunidades, venda explícita e serviços comuns de
consulta; não criar microsserviços nem outro sistema de autenticação.

**Stack observada:** Next.js 16.3, React 19, TypeScript, Tailwind, React Flow, Zod,
Better Auth, Supabase/PostgreSQL e Vitest. Confirmar versões instaladas na execução;
ler os guias locais em `node_modules/next/dist/docs/` antes de escrever código Next.

**Estado:** em execução desde 19/set/2026. A F0 está implementada e verificada
localmente; ver `docs/DECISOES-OPERACAO-CHATBOT-CRM.md` para as decisões e
evidências. As demais fases seguem pendentes. Arquivos assinalados **novos** são destinos propostos, não arquivos
que já existem. A proposta principal é a autoridade sobre regras RB e interface UI;
este documento define ordem, pontos de alteração e critérios de verificação.

## Protocolo de execução

1. Iniciar pela F0. Ler `AGENTS.md`, todo `docs/BANCO-COMPARTILHADO.md` e conferir
   o estado do repositório Verandi antes de tocar banco ou recursos compartilhados.
2. Trabalhar uma tarefa por vez. Antes da alteração, localizar todos os chamadores
   das funções afetadas; as listas abaixo são pontos de entrada, não licença para
   ignorar consumidores encontrados durante a implementação.
3. Para regras de negócio, escrever o cenário que falha, implementar a menor
   mudança consistente e executar a verificação específica. Testes devem provar
   comportamento, isolamento e transições, sem apenas espelhar o código.
4. Para telas, usar os contratos UI da proposta e validar estados com fixtures.
   Alterações apenas de rótulo não exigem teste unitário artificial.
5. Atualizar documentação afetada e registrar evidências antes de marcar a tarefa
   concluída. Separar “implementado”, “testado localmente” e “liberado”.
6. Não fazer deploy, publicar bot real, enviar mensagem ou aplicar migration em
   produção como parte automática da execução deste plano. A liberação em
   produção depende de autorização explícita e revisão do resultado concreto.

### Comandos previstos de verificação

Hoje existem `npm run typecheck`, `npm run lint`, `npm run build` e `npm test`.
**Não executar a suíte atual indiscriminadamente:** `vitest.config.ts` carrega
`.env`, e há testes que criam/excluem registros no Supabase configurado.

F0 deverá criar os seguintes comandos antes de utilizá-los nas demais fases:

| Comando a criar | Contrato |
|---|---|
| `npm run test:unit -- <arquivo>` | sem credenciais reais; bloqueia rede externa; execução de regras/mocks |
| `npm run test:integration:local -- <arquivo>` | exige Supabase/Postgres local permitido; recusa hosts remotos; fixtures isoladas |
| `npm run test:e2e:local -- <arquivo>` | navegador em aplicação local com canal falso; sem chamadas de envio reais |

Ao adicionar testes de navegador, incluir Playwright como dependência de
desenvolvimento, configuração local e instruções de instalação. Não pressupor que
já exista. Após cada fase, executar typecheck/lint e a suíte pertinente; build nos
marcos de interface, em ambiente sem credenciais/efeitos de produção. Resultado
esperado: código zero e cenários da fase aprovados. Falhas existentes devem ser
registradas e distinguidas de regressões, sem declarar passagem indevida.

## Modelo lógico que F1 deve materializar

| Registro | Campos/invariantes essenciais |
|---|---|
| Contato | empresa, identidade de canal, dados compartilhados e proveniência; identidade estável |
| Ciclo de atendimento | contato/canal, situação, condução, responsável/equipe, revisão de controle, início/fim |
| Entrada | empresa, contato, tipo, canal, ID externo/chave idempotente, origem e momento |
| Processo/etapa | finalidade, IDs estáveis, rótulos, ordem, arquivamento e versão de configuração |
| Ocorrência/cartão | empresa, contato, processo/etapa, resultado operacional ou vínculo comercial; múltiplos por contato |
| Oportunidade | contato, cartão comercial principal, responsável/equipe, situação, estimativa, temperatura, entrada de origem e revisão |
| Venda | oportunidade, data conhecida, total opcional, moeda BRL, situação válida/cancelada, revisões e chave da operação |
| Item de venda | produto opcional, descrição preservada, quantidade/valores conhecidos; não derivar total de dados incompletos |
| Avaliação | objetivo/processo, contato/ocorrência, versão de critérios, valores considerados, resultado e razões |
| Atividade | contato, vínculo opcional, responsável, prazo, estado, conclusão/cancelamento |
| Evento de negócio | empresa, objeto/IDs, autor, origem, instante, rótulos históricos e operação causadora |

O nome físico das tabelas será definido após inspeção das migrations e restrições
atuais. Preferir evolução compatível às duplicações desnecessárias. Se o cartão
comercial já puder ser a identidade da oportunidade, reutilizar seu ID; não criar
um segundo agregado apenas por nomenclatura. O contrato exige identidade estável
e separação semântica, não duas tabelas com os mesmos campos.

Fechamento/venda e alterações de etapa usam transação/RPC adequada ao acesso
existente. Efeitos posteriores, como criar ocorrência no próximo processo, usam
registro durável de pendência e chave idempotente. A fila técnica pode executar
esses efeitos, mas não armazenará atividades humanas como se fossem tarefas do
motor. Toda leitura/escrita conserva `cliente_id`/empresa e a política de acesso.

## F0 — Base de verificação e transição

**Resultado:** implementação futura pode ser validada sem tocar produção.
**Dependências:** nenhuma. **Aceites relacionados:** A23, A28 e preparação dos demais.

### T0.1 — Separar testes e bloquear conexões indevidas

**Alterar:** `vitest.config.ts`, `package.json`; classificar testes existentes que
usam credenciais, inclusive `src/server/repos/quadros.test.ts`,
`src/server/receber-mensagem.test.ts` e `src/server/repos/crm.test.ts`.

**Criar:** `vitest.unit.config.ts`, `vitest.integration.config.ts`,
`test/ambiente-local.ts`, `test/ambiente-local.test.ts`,
`test/fixtures/operacao.ts`, `playwright.config.ts` e
`test/e2e/ambiente-local.spec.ts` (**novos**).

1. Inventariar testes que fazem I/O real, sem executar a suíte antiga.
2. Testar que o guard recusa URL remota, variável herdada de produção e configuração
   ausente; aceita somente ambiente local de teste configurado deliberadamente.
3. Remover carregamento implícito de `.env` de produção dos caminhos de teste.
   Separar configurações unitária/local, mocks de canal e fixtures de duas empresas.
4. Adicionar os scripts da tabela anterior. Proteger também setup/teardown e
   cliente de banco, antes de qualquer criação ou limpeza.
5. Fazer o comando padrão seguro: teste que depende de integração não pode
   silenciosamente apontar para produção só por encontrar credencial disponível.

**Verificação:** `npm run test:unit -- test/ambiente-local.test.ts`; depois smoke
local. Configurar explicitamente a inclusão de `test/**/*.test.ts`, já que a
configuração atual inclui apenas `src/**/*.test.ts`. Guard inválido falha antes
de abrir conexão; cleanup só remove fixtures identificadas da execução local.

### T0.2 — Inventário e decisão sobre política de canal

**Ler:** `src/channels/janela.ts`, `src/channels/janela.test.ts`,
`src/server/receber-coexistencia.ts`, `docs/MODELO-CRM.md`,
`docs/RELACIONAMENTO.md`, `supabase/migrations/` e referências de canal da proposta.

**Criar:** `docs/DECISOES-OPERACAO-CHATBOT-CRM.md` (**novo**, registro técnico de
implementação, sem substituir o contrato principal).

1. Documentar relações e unicidades atuais; mapear usos de ganho, estágio do
   contato, quadro padrão, origem e permissões.
2. Definir fixtures: empresa sem CRM; atendimento; SDR → vendas → pós-venda;
   recompra; múltiplos times; legado ambíguo; histórico importado.
3. Confirmar regra vigente do canal/provedor sobre 24h/72h com fonte, data e casos.
   Se persistir dúvida, manter ampliação de envio bloqueada e registrar fallback.
4. Registrar baseline de consulta e comportamento local; não chamar esse baseline
   de auditoria de dados de produção.

**Saída de F0:** suíte segura utilizável, decisões rastreáveis e lista de migrations
propostas sem número fixado. Pendência externa de canal é isolada da evolução do CRM.

## F1 — Identidade e resultados confiáveis

**Resultado:** sucesso operacional, oportunidade e venda não se confundem.
**Dependências:** F0. **Regras:** RB-01 a RB-06, RB-23 a RB-25, RB-30 a RB-32.

### T1.1 — Separar resultados e permitir recorrência

**Alterar:** `src/core/quadros.ts`, `src/core/quadros-modelos.ts`,
`src/core/crm.ts`, `src/server/repos/quadros.ts`, `src/server/repos/crm.ts`.
**Criar:** `src/core/oportunidades.ts`, `src/core/vendas.ts`,
`src/server/repos/vendas.ts` (**novos**) e migration escolhida no diretório atual.
**Testar:** `src/core/quadros.test.ts`, `src/core/crm.test.ts`,
`src/server/repos/quadros.test.ts`, `src/core/vendas.test.ts` (**novo**).

1. Escrever cenários: atendimento/qualificação sem compra; mesmo contato com duas
   oportunidades; retry de criação sem duplicar; origem ligada à oportunidade.
2. Definir tipo/finalidade e resultado operacional separado do fechamento comercial.
3. Substituir unicidade permanente quadro/contato por identidade de ocorrência e
   unicidade de evento de criação. Atualizar todos os upserts/chamadores afetados.
4. Criar contrato de venda válida/cancelada e compatibilidade de leitura do legado.
   Não expor novas telas comerciais antes da autorização da F2.

**Verificação:** unitários de regras; integração local de recorrência e isolamento
por empresa. A11, A12 e A23 aprovados.

### T1.2 — Transações, histórico e continuidade

**Alterar:** `src/server/repos/quadros.ts`, `src/server/repos/eventos.ts`,
`src/server/repos/tarefas.ts`; atualizar consumidores de eventos encontrados.
**Criar:** `src/server/servicos/concluir-processo.ts`,
`src/server/servicos/concluir-processo.test.ts` (**novos**).

1. Garantir estado final e evento de conclusão na mesma unidade transacional.
2. Registrar IDs de processo/etapa/ocorrência e rótulo da época no histórico.
3. Persistir intenção de criar destino com chave por conclusão; executar via fila
   existente e registrar pendência/falha, sem perder a conclusão de origem.
4. Escrever falhas entre gravações e retry após resposta perdida. Asserções:
   nenhuma venda parcial e, no máximo, uma ocorrência de destino por intenção.
5. Atualizar `docs/MODELO-CRM.md` com fronteira entre regra antiga e nova.

**Verificação:** integração local para A13/A26 e rollback transacional. Inspecionar
migration e plano de compatibilidade antes de qualquer aplicação fora do ambiente local.

## F2 — Equipe e autorização

**Resultado:** cada superfície respeita capacidades e escopo.
**Dependências:** F1. **Regras:** RB-40 a RB-42. **Interfaces:** UI-18.

### T2.1 — Centralizar políticas de acesso

**Alterar:** `src/server/sessao.ts`, `src/server/acoes.ts`,
`src/server/acoes-crm.ts`, `src/server/acoes-transmissoes.ts`,
`src/server/acoes-conta.ts`.
**Criar:** `src/server/permissoes.ts`, `src/core/permissoes.ts`,
`src/core/permissoes.test.ts`, `src/server/permissoes.test.ts` (**novos**).

1. Modelar capacidades, escopos, equipes e acesso à fila sem responsável.
2. Aplicar autorização antes de ler ou alterar registros. Não transformar
   `podeResponderAgora` ou presença do botão em autorização.
3. Definir leitura mínima do contato para atender sem expor oportunidades de
   outras equipes. Proteger inferência por agregados e filtros comerciais.
4. Adaptar entrada automatizada com identidade de serviço limitada à empresa e
   política publicada. Rever efeitos de `service_role` e RLS sem presumir isolamento.

**Verificação:** matriz administrador/gestor/operador, duas empresas e duas equipes;
leitura/escrita diretas, exportação e dados financeiros restritos. A19/A27.

### T2.2 — Aplicar escopos na interface, buscas e realtime

**Alterar:** `src/components/design/cliente-shell.tsx`,
`src/app/clientes/[clienteId]/ajustes/equipe/page.tsx`,
`src/app/api/clientes/[clienteId]/inbox/stream/route.ts`,
`src/app/api/clientes/[clienteId]/inbox/pulso/route.ts`,
`src/app/api/clientes/[clienteId]/inbox/alertas/route.ts`,
`src/app/api/clientes/[clienteId]/leads/csv/route.ts`.
**Criar:** `src/components/conta/editor-de-acesso.tsx`,
`test/e2e/permissoes.spec.ts` (**novos**).

1. Entregar UI-18 com prévia, escopos e proteção do último administrador.
2. Aplicar mesmas políticas em páginas, endpoints, notificações e streams;
   mudança de equipe/acesso invalida assinaturas/cache sem manter dados indevidos.
3. Criar papel de compatibilidade e revisão de permissões legadas; reassociar
   pendências de membro removido de forma explícita.

**Verificação:** navegação e chamada direta com usuário sem acesso produzem a
mesma restrição; não vazar dados por erro, stream, contador ou download.

## F3 — Entrada e atendimento

**Resultado:** bot/humano operam com origem e responsabilidade consistentes.
**Dependências:** F1–F2. **Regras:** RB-07 a RB-17. **Interfaces:** UI-03 a UI-07.

### T3.1 — Registrar entrada antes de decidir automação

**Alterar:** `src/server/receber-mensagem.ts`,
`src/server/receber-lead-do-formulario.ts`, `src/server/receber-do-instagram.ts`,
`src/server/receber-coexistencia.ts`, `src/server/repos/passagens.ts`,
`src/server/quadro-de-entrada.ts`, `src/server/repos/quadros.ts`.
**Criar:** `src/server/servicos/processar-entrada.ts`,
`src/core/regras-de-entrada.ts`, `src/core/regras-de-entrada.test.ts` (**novos**).

1. Deduplicar evento antes de métricas e efeitos; distinguir novo inbound,
   submissão, importação histórica e mensagem humana enviada pelo celular.
2. Registrar origem mesmo com bot pausado. Manter primeira conhecida e histórico;
   vincular entrada escolhida à oportunidade sem reatribuição silenciosa.
3. Atualizar contato existente por política de campos, preservando submissão e
   conflitos até a política tipada da F4 estar completa.
4. Substituir fallback do quadro mais antigo por configuração explícita. Converter
   comportamento atual em opção revisável para empresas legadas.
5. Tratar CRM desligado sem acesso residual a criação automática de cartão.

**Testar:** atualizar `src/server/receber-mensagem.test.ts`,
`src/server/receber-lead-do-formulario.test.ts`,
`src/server/receber-coexistencia.test.ts` e testes do Instagram. A01–A05, A25/A28/A29.

### T3.2 — Roteamento e controle concorrente da conversa

**Alterar:** `src/server/distribuir-atendimento.ts`, `src/server/acoes.ts`,
`src/server/repos/conversas.ts`, `src/server/efeitos/resolver.ts`,
`src/server/receber-mensagem.ts`, `src/components/inbox/assumir.tsx`,
`src/components/inbox/moldura.tsx`, `src/components/inbox/fila.tsx`.
**Criar:** `src/core/controle-da-conversa.ts`,
`src/core/controle-da-conversa.test.ts`,
`src/server/controle-da-conversa.test.ts`,
`src/components/fluxos/regras-de-entrada.tsx` (**novos**).

1. Implementar prioridade publicada e fallback; preservar sessão humana/ativa
   antes de procurar palavra-chave que iniciaria outro bot.
2. Separar assumir, transferir, devolver à fila, retomar e encerrar. Usar revisão
   de controle na operação e verificar novamente antes de enviar efeitos externos.
3. Tratar respostas tardias de IA/HTTP e execução concorrente no mesmo contato.
4. Oferecer simulação de regra de entrada, bot/humano, horário e fallback; o fluxo
   humano não exige editor nem sessão de bot fictícia.
5. Preservar funcionamento por canal: limites WhatsApp não se aplicam ao Instagram.

**Verificação:** A03, A08–A10, A22/A30; teste de duas tomadas simultâneas e efeito de IA
concluído depois da transferência. Navegador local com canal falso confirma estados.

### T3.3 — Separar janela de envio e cobrança

**Alterar:** `src/channels/janela.ts`, `src/channels/janela.test.ts`,
`src/server/enviar-agendadas.ts`, `src/server/passada-de-transmissoes.ts` e
chamadores encontrados da política de envio.

1. Consumir decisão de F0; representar permissão, expiração, causa e elegibilidade
   de cobrança separadamente, com informação desconhecida explícita.
2. Revalidar no servidor no instante de envio; preservar texto do operador quando
   houver bloqueio e oferecer modelo aprovado elegível.
3. Testar limite exato do prazo, fuso, ausência de mensagem, entrada de formulário
   e execução atrasada. Não expandir 72h sem evidência aplicável ao canal.

**Saída de F3:** marco operacional utilizável sem CRM; origem e controle humano
coerentes. Não anunciar regra de gratuidade ainda pendente de confirmação.

## F4 — Contexto e qualificação

**Resultado:** bot e humano trabalham os mesmos dados e critérios explicáveis.
**Dependências:** F2–F3. **Regras:** RB-18 a RB-22. **Interfaces:** UI-08/UI-16/UI-22.

### T4.1 — Campos tipados e atualização consistente

**Alterar:** `src/server/repos/conversas.ts` (`guardarCampo` e chamadores),
`src/components/lead-crm/informacoes.tsx`, `src/components/lead-crm/resumo-do-contato.tsx`,
`src/core/flow/schema.ts`.
**Criar:** `src/core/campos.ts`, `src/server/repos/campos.ts`,
`src/components/contatos/editor-de-campos.tsx`,
`src/app/clientes/[clienteId]/ajustes/campos/page.tsx`,
`src/core/campos.test.ts`, `src/server/repos/campos.test.ts` (**novos**).

1. Criar definições por empresa/entidade, tipos e IDs estáveis. Mapear strings
   legadas sem inferir tipo de forma destrutiva; guardar original em conversão.
2. Implementar patch por campo com revisão/proveniência e política de atualização.
3. Validar obrigatoriedade na ação contextual, preservando entrada de mensagens.
4. Entregar UI-16; arquivamento verifica dependências e proíbe mudança de tipo
   incompatível sem plano de conversão.

**Verificação:** concorrência entre dois campos, proteção de correção humana,
dados não informados e isolamento. A20/A22 e tipos em frontend/backend.

### T4.2 — Critérios e avaliação versionada

**Alterar:** `src/exemplos/modelos.ts`, `src/exemplos/qualificar-sdr.ts`,
`src/core/engine/executar.ts`, `src/core/engine/types.ts`,
`src/server/efeitos/resolver.ts`, `src/components/editor/painel.tsx`.
**Criar:** `src/core/qualificacao.ts`, `src/core/qualificacao.test.ts`,
`src/server/repos/qualificacoes.ts`,
`src/components/lead-crm/qualificacao.tsx` (**novos**).

1. Implementar quatro resultados, motivos e lógica de dados incompletos.
2. Salvar versão dos critérios e valores avaliados; reavaliar gera novo registro.
3. Adicionar ações explícitas ao editor; transferência humana não emite resultado
   de qualificação positivo por consequência.
4. Corrigir modelo SDR, remover limiar empresarial arbitrário e destinos fictícios.
5. Mostrar na ficha resumo factual com fontes e avaliação por objetivo.

**Verificação:** A06/A07/A16/A32; mesma pessoa qualifica para um objetivo e não para
outro sem alterar seu cadastro global. Bot e avaliação manual produzem regra igual.

## F5 — Operação comercial e atividades

**Resultado:** empresa consegue trabalhar e concluir negócios sem perder contexto.
**Dependências:** F1–F4. **Regras:** RB-23 a RB-34. **Interfaces:** UI-09 a UI-13/UI-17/UI-21/UI-25.

### T5.1 — Oportunidade e catálogo mínimo

**Alterar:** `src/app/clientes/[clienteId]/quadros/page.tsx`,
`src/components/quadros/quadro.tsx`, `src/components/quadros/painel-do-contato.tsx`,
`src/components/lead-crm/negociacoes.tsx`,
`src/components/inbox/funil-da-conversa.tsx`.
**Criar:** `src/components/quadros/nova-oportunidade.tsx`,
`src/server/repos/produtos.ts`,
`src/app/clientes/[clienteId]/ajustes/produtos/page.tsx` (**novos**).

1. Dar ao CRM visões Oportunidades e Processos, preservando rota `/quadros` e links.
2. Criar oportunidade no contexto, mostrar abertas e permitir outra intenção.
3. Migrar temperatura global para informação legada até avaliação por oportunidade;
   não copiar “morno” automático para todas as negociações como avaliação humana.
4. Oferecer catálogo mínimo e vínculo de interesse/item; arquivar sem apagar vendas.

**Verificação:** A12; navegação Inbox → oportunidade → contato → conversa preserva
foco e seleção. Oportunidade de outra equipe não aparece como sugestão de duplicata.

### T5.2 — Registrar, perder e corrigir venda

**Alterar:** `src/components/quadros/fechar-cartao.tsx`,
`src/server/acoes-crm.ts`, `src/server/repos/vendas.ts` (criado em F1),
`src/server/repos/crm.ts`, `src/components/lead-crm/historico.tsx`.
**Criar:** `src/components/quadros/registrar-venda.tsx`,
`src/components/lead-crm/corrigir-venda.tsx`,
`src/server/repos/vendas.test.ts` (**novos**).

1. Entregar UI-10/UI-11/UI-12 e protocolo transacional de F1.
2. Bloquear conclusão comercial sem confirmação da venda; resolver drag-and-drop
   por formulário com cancelamento que restaura o estado anterior.
3. Registrar quantidade/total desconhecido, itens e valores consistentes; não
   transformar ganho em pagamento confirmado.
4. Corrigir/cancelar por revisão auditável; cancelamento resolve atomicamente a
   situação da oportunidade. Recalcular indicadores e sinalizar
   ocorrências derivadas para revisão, sem apagar o pós-venda automaticamente.
5. Permitir venda avulsa criando oportunidade mínima no processo comercial
   explicitamente escolhido; não ativar CRM silenciosamente para usuário sem acesso.

**Verificação:** A11–A15, duplo clique e falha de rede. Reabrir/cartão/retificar não
devem produzir segunda compra válida para a mesma oportunidade.

### T5.3 — Agenda humana e ficha integrada

**Alterar:** `src/components/lead-crm/abas.tsx`,
`src/components/inbox/moldura.tsx`, `src/components/quadros/painel-do-contato.tsx`,
`src/components/inbox/notificacoes-da-fila.tsx`.
**Criar:** `src/core/atividades.ts`, `src/server/repos/atividades.ts`,
`src/components/lead-crm/atividades.tsx`,
`src/app/clientes/[clienteId]/quadros/atividades/page.tsx`,
`src/core/atividades.test.ts`, `test/e2e/operacao-comercial.spec.ts` (**novos**).

1. Implementar agenda por responsável com prazos, pendência, conclusão e cancelamento.
   Atividade ligada apenas ao contato funciona no Inbox/Visão geral sem ativar CRM.
2. Mostrar próxima ação na ficha/quadro e escolha do destino das atividades ao fechar.
3. Conectar notificações internas a atribuição/atividade/pendência, sem duplicar.
4. Diferenciar lembrete humano, adiamento da conversa e mensagem agendada.

**Saída de F5:** jornada SDR → venda → próxima ação → recompra aprovada localmente,
com rastreabilidade e sem obrigar outras empresas a ativar o CRM.

## F6 — Segmentos e destinatários

**Resultado:** filtrar, contar, exportar e selecionar têm a mesma interpretação.
**Dependências:** F2, F4–F5. **Regras:** RB-35 a RB-39. **Interfaces:** UI-14/UI-15.

### T6.1 — Uma consulta para todas as superfícies

**Alterar:** `src/app/clientes/[clienteId]/leads/page.tsx`,
`src/app/api/clientes/[clienteId]/leads/csv/route.ts`,
`src/server/repos/crm.ts`, `src/server/repos/relacionamento.ts`.
**Criar:** `src/core/segmentos.ts`, `src/server/repos/segmentos.ts`,
`src/server/consultas/contatos.ts`, `src/core/segmentos.test.ts`,
`src/server/consultas/contatos.test.ts` (**novos**).

1. Definir árvore limitada de grupos/condições tipadas e validar acesso aos campos.
2. Compilar somente operadores/campos permitidos, sem aceitar SQL ou identificador
   arbitrário vindo do cliente. Isolar empresa e aplicar autorização antes da consulta.
3. Aplicar filtros antes de paginação, contar distintos e preservar vínculo de
   condições à mesma oportunidade/venda. Null recebe semântica explícita.
4. Usar mesmo contrato para lista/count/CSV e registrar instante/filtro do export.
   Consultas em instantes diferentes podem refletir novas entradas; não prometer
   snapshot temporal entre requisições independentes.

**Verificação:** A17–A19/A27, fixtures acima do tamanho da página, várias oportunidades,
valores desconhecidos, campos arquivados e usuário com acesso parcial.

### T6.2 — Editor e transmissão a partir do segmento

**Alterar:** `src/components/transmissoes/nova-transmissao.tsx`,
`src/server/acoes-transmissoes.ts`, `src/server/repos/transmissoes.ts`,
`src/server/passada-de-transmissoes.ts`.
**Criar:** `src/components/contatos/editor-de-segmento.tsx`,
`src/app/clientes/[clienteId]/leads/segmentos/page.tsx`,
`test/e2e/segmentacao.spec.ts` (**novos**).

1. Entregar UI-14 com prévia explicável e validação de dependências.
2. Separar visão pessoal, segmento compartilhado e lista materializada por envio.
3. Mostrar elegíveis/excluídos; confirmar snapshot antes de agendar e revalidar
   restrições no worker de envio. Não atualizar destinatários silenciosamente.
4. Preservar mecanismos de transmissão existentes que já atendam o contrato,
   evitando implementar uma segunda fila de envio.

**Verificação:** A18/A24; editar segmento depois da confirmação não aumenta lote;
revogação de elegibilidade impede envio mesmo para destinatário já materializado.

## F7 — Modelos, navegação e configuração guiada

**Resultado:** usuário descobre e configura a operação sem aprender a arquitetura.
**Dependências:** F3–F6. **Regras:** RB-43 a RB-48. **Interfaces:** UI-01/UI-02/UI-19/UI-23/UI-24.

### T7.1 — Consolidar navegação e início por objetivo

**Alterar:** `src/components/design/secoes-do-cliente.tsx`,
`src/components/design/cliente-shell.tsx`,
`src/app/clientes/[clienteId]/fluxos/page.tsx`,
`src/components/fluxos/templates.tsx`, `src/server/acoes-conta.ts`,
`src/components/ajuda/conteudo-fluxos.tsx`.
**Criar:** `src/app/clientes/[clienteId]/ajustes/recursos/page.tsx`,
`test/e2e/configuracao-da-operacao.spec.ts` (**novos**).

1. Aplicar rótulos/agrupamentos da proposta, preservando chaves e links antigos.
2. Mover galeria para jornada Criar chatbot; diferenciar modelos de mensagem.
3. Configurar objetivo, bot/humano e CRM opcional no início; permitir concluir
   onboarding e receber conversas sem montar funil ou chatbot fictício.
4. Ativar CRM com escolha de processo e entrada, sem importação retroativa implícita.
5. Rever carregamentos da página de automações por aba, evitando buscar todos os
   conjuntos sempre; medir antes de introduzir otimizações adicionais.

**Verificação:** pessoa nova configura humano direto; outra cria bot por modelo;
links antigos funcionam e nenhuma tela vazia exige habilitar CRM para atender.

### T7.2 — Versões, simulação e publicação previsível

**Alterar:** `src/server/repos/fluxos.ts`, `src/core/flow/schema.ts`,
`src/components/editor/editor.tsx`, `src/components/editor/versoes.tsx`,
`src/app/api/simular/route.ts`, `src/app/api/simular/route.test.ts`,
`src/exemplos/modelos.ts`, `src/components/fluxos/interruptor.tsx`.
**Criar:** `src/core/validar-publicacao.ts`,
`src/core/validar-publicacao.test.ts` (**novos**).

1. Copiar modelo versionado como rascunho independente.
2. Garantir versão publicada imutável para sessões existentes e rascunho separado.
3. Validar referências, credenciais e placeholders antes de publicar; mostrar
   entradas vinculadas e alerta de bot publicado sem entrada.
4. Simular dados/qualificação/encaminhamento com efeitos falsos. Nenhuma venda,
   tarefa de envio ou chamada de integração real pode escapar da simulação.
5. Pausar/arquivar com tratamento explícito de sessões e dependências.

**Verificação:** A20/A21; editar/publicar/pausar durante sessão conserva contrato;
modelo de agendamento sem integração não promete reserva confirmada.

### T7.3 — Integrar sequências ao controle de atendimento

**Alterar:** `src/server/sequencias.ts`, `src/server/sequencias-passo.ts`,
`src/server/enviar-agendadas.ts`,
`src/server/passada-de-transmissoes.ts`, `src/server/repos/sequencias.ts` e
componentes atuais de configuração de sequência, após localizar seus chamadores.
**Criar:** `src/core/politica-de-acompanhamento.ts`,
`src/core/politica-de-acompanhamento.test.ts` (**novos**).

1. Distinguir inscrição do contato e contexto da oportunidade; eventos afetam os
   vínculos adequados e não todas as negociações por acidente.
2. Implementar estados, saída por resposta/compra e pausa por atendimento. Reusar
   a verificação de F3 antes do envio em bot, agendamento, sequência e transmissão.
3. Entregar UI-23/UI-24 com próximo passo, horário, motivo e prazo de retomada.
4. Preservar versão ativa; política nova não reinscreve contatos nem dispara passos
   vencidos. Tornar cancelamento, conclusão e falha visíveis na ficha.

**Verificação:** A31; worker já enfileirado recebe pausa e não envia; venda em outra
negociação não cancela acompanhamento sem regra correspondente; retry não reinscreve.

### T7.4 — Padronizar formulários sem perder estado

**Alterar:** `src/components/design/modal.tsx`,
`src/components/design/modal-formulario.tsx`,
`src/components/design/formulario-salvar.tsx` e formulários criados nas fases.
**Criar:** `test/e2e/formularios.spec.ts` (**novo**).

1. Padronizar foco, retorno, erros, salvamento e proteção de edição não salva.
2. Cobrir teclado/Escape/backdrop, conflito, falha e retry idempotente.
3. Verificar painel lateral em desktop e tela estreita, preservando rascunho e
   contexto ao navegar. Preservar identidade visual; não fazer redesign gratuito.

**Saída de F7:** percursos completos UI-01 a UI-25 consistentes, com linguagem de
negócio e dependências claras, sem mensagens que prometem recursos não entregues.

## F8 — Relacionamento e visão geral

**Resultado:** prioridades e indicadores refletem fatos conhecidos.
**Dependências:** F5–F7. **Regras:** RB-06, RB-29, RB-32, RB-35/RB-41.

### T8.1 — Corrigir base dos indicadores e faixas

**Alterar:** `src/core/relacionamento.ts`, `src/core/relacionamento.test.ts`,
`src/server/repos/relacionamento.ts`, `src/server/repos/relacionamento.test.ts`,
`src/server/repos/crm.ts`, `src/components/lead-crm/selo-do-cliente.tsx`.

1. Derivar compras exclusivamente de vendas válidas, com quantidade distinta e
   valores desconhecidos explícitos. Resultados legados pendentes ficam separados.
2. Implementar cliente declarado/importado sem criar compra ou receita fictícia.
3. Separar última interação e última compra; permitir faixa opcional configurada
   com moeda, limites sem sobreposição e prévia.
4. Recalcular após correção/cancelamento e aplicar escopos aos indicadores.
5. Atualizar `docs/RELACIONAMENTO.md` e textos de ajuda.

**Verificação:** A11/A14/A15/A27 e segmento de recompra não inclui cliente importado
sem data de compra como se tivesse deixado de comprar há X dias.

### T8.2 — Visão geral orientada ao trabalho

**Alterar:** página atual de início do cliente em
`src/app/clientes/[clienteId]/page.tsx` e componentes de indicadores usados por ela.
**Criar:** `test/e2e/visao-geral.spec.ts` (**novo**).

1. Atendente vê fila e atividades; gestor vê pendências de operação; vendedor vê
   oportunidades e próxima ação, sempre conforme acesso.
2. Exibir origem da métrica, período e incompletude quando aplicável. Não chamar
   atendimentos resolvidos de receita ou todas as transferências de falha do bot.
3. Separar automação resolvida, transferência prevista e transferência por falha.
   Medir tempo até atendimento a partir de pedido/encaminhamento humano, sem
   contabilizar toda a duração anterior do bot como espera do funcionário.

**Saída de F8:** consultas e relatórios conciliam com registros de origem, no mesmo
período/escopo; nenhum indicador depende de etiqueta manual como prova de venda.

## F9 — Piloto e liberação gradual

**Resultado:** validar a integração e a compreensão antes de generalizar a entrega.
**Dependências:** F0–F8. **Aceites:** A01 a A32, mais jornadas de interface.

### T9.1 — Verificação integrada e revisão do legado

**Criar:** `test/e2e/jornada-chatbot-crm.spec.ts`,
`docs/VALIDACAO-OPERACAO-CHATBOT-CRM.md` (**novos**).
**Atualizar:** proposta, decisões técnicas e ajuda das telas realmente entregues.

1. Executar jornadas locais: só bot/inbox; só humano; SDR/venda; pós-venda/recompra;
   múltiplas equipes; formulário/CTWA; importação; integração de destino com falha.
2. Simular migração duas vezes e rollback de flags sem perda de registros novos.
3. Verificar A01–A32 e contratos UI por checklist com evidência e falhas abertas.
4. Medir consultas de segmentos e filas em volume representativo. Definir metas
   com baseline e infraestrutura reais antes do piloto, incluindo percentis e
   tamanho de base; evitar prometer latência arbitrária neste documento.
5. Revisar aplicação do isolamento AutoFluxos/Verandi e ausência de alterações
   indevidas em Auth, Storage, extensões ou Data API compartilhados.

### T9.2 — Piloto de uso e plano de liberação

1. Preparar operação demonstrável e roteiro para três trabalhos: atendimento,
   SDR/vendas e pós-venda. Observar tarefas, não apenas perguntar se a tela agradou.
2. Verificar se a pessoa distingue modelo de chatbot/mensagem, concluir/vender,
   temperatura/qualificação e segmento/destinatários; ajustar textos e passos se falhar.
3. Preparar lista de empresas piloto, flags, migrations revisadas, prévia do legado,
   monitoramento e plano de retorno. Solicitar autorização de produção somente
   com esse pacote concreto, quando a execução chegar a esta fase.
4. Liberar gradualmente conforme autorização; acompanhar eventos duplicados,
   conversas sem destino, falhas de transferência, divergências de totais e acesso.
5. Só declarar fase liberada quando as evidências de ambiente e implantação
   corresponderem ao status. Planejamento ou teste local não equivalem a release.

**Critério de conclusão:** a operação passa pelos cenários de aceite e pelos
percursos de usuário, respeita as restrições do banco compartilhado e não exige
ativar CRM ou bot para atender. Pendências externas têm efeito delimitado e
visível; nenhuma migração converte sucesso operacional em venda por suposição.

## Registro de execução por fase

Preencher durante a implementação, sem marcar tarefas antecipadamente.

| Fase | Implementação | Testes locais / evidência | Liberação / observações |
|---|---|---|---|
| F0 | **T0.1 e T0.2 implementadas** | unitários 1724 ok · integração local 294 ok · typecheck limpo | não liberada; nada aplicado em produção |
| F1 | **T1.1 implementada** (0071: finalidade, ocorrência recorrente, venda). T1.2 pendente | unitários 1755 ok · integração local 311 ok · A11/A12/A13/A14/A15 aprovados | migration só no Docker local; **não aplicada em produção** |
| F2 | pendente | pendente | não iniciada |
| F3 | pendente | pendente | não iniciada |
| F4 | pendente | pendente | não iniciada |
| F5 | pendente | pendente | não iniciada |
| F6 | pendente | pendente | não iniciada |
| F7 | pendente | pendente | não iniciada |
| F8 | pendente | pendente | não iniciada |
| F9 | pendente | pendente | não iniciada |
