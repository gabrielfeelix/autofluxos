# Plano mestre — trabalho restante

Atualizado em **14/ago/2026**. Este é o índice único das atividades ainda não
concluídas do AutoFluxos. Ele consolida [ESTADO.md](ESTADO.md),
[PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md), [EXPANSAO.md](EXPANSAO.md),
[BRIEF-UI.md](BRIEF-UI.md) e [CONEXOES.md](CONEXOES.md).

Os documentos de origem continuam explicando o porquê e o desenho de cada
feature. Este documento responde três perguntas: **o que ainda falta, em qual
ordem e o que prova que cada etapa terminou**.

> **Regra de banco obrigatória:** AutoFluxos e Verandi compartilham o projeto
> Supabase, mas não o domínio. Antes de qualquer migration, leia
> [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md). AutoFluxos só cria objetos
> próprios em `public`, nunca consulta `app_verandi`, qualifica os objetos no
> SQL e descobre o próximo número de migration pelo diretório. Auth, Storage,
> extensões, Data API, cotas e backup são globais. Nunca use `supabase db push`
> contra produção.

## O que não entra no backlog

- Os itens **0 a 5 de EXPANSAO.md estão concluídos**.
- O nó API e as Conexões estão concluídos. As caixas vazias de
  [PLANO-NO-API.md](PLANO-NO-API.md) são o roteiro histórico, não tarefas.
- [PLANO-PILATES.md](PLANO-PILATES.md) foi substituído pelo Verandi. Não criar
  tabelas de agenda no AutoFluxos nem portar aquele plano para `public`.
- [BRIEF-AGENDA.md](BRIEF-AGENDA.md) descreve o produto hoje chamado Verandi.
  A fronteira é API/evento autenticado, nunca acesso cruzado ao banco.
- PITR pago continua fora por decisão explícita. Kanban/CRM e iPaaS continuam
  fora do produto.
- Os itens marcados como **gatilho** abaixo são backlog verdadeiro, mas não
  devem furar a fila antes de o gatilho existir.

## Ordem de execução aprovada — produto primeiro

O mapa completo abaixo ainda preserva todas as dívidas e seus critérios de
aceite. **Ele não é a ordem de calendário.** A prioridade aprovada em
14/ago/2026 é fazer o AutoFluxos parecer e operar como um produto de
atendimento completo antes de ampliar a fila de infraestrutura.

| Ordem | Frente | Resultado visível |
|---|---|---|
| 1 | Inbox | Fila, conversa, atendimento e contexto numa única tela |
| 2 | Operação rápida | Respostas rápidas, automação ligada/desligada, aviso a atendente e horário |
| 3 | Automação avançada | Subfluxos, agendador e timeout de pergunta |
| 4 | Retomada e alcance | Templates Meta, sequências, transmissão e campanhas |
| 5 | Integrações | Verandi como integração de primeira parte e presets de fluxo |
| 6 | Escala | Instalar fluxos, palavras-chave, padrões e mídia |

As proteções de segurança entram como requisito da feature que expõem: escrita
cruzada e sessão segura **antes de login de cliente**; isolamento e RLS junto
de papéis; LGPD, paginação e acessibilidade quando Leads/Inbox forem para uso
mais amplo. Elas não deixam de existir, apenas não substituem uma entrega de
produto por si só.

> **Em andamento:** a primeira fatia desta ordem é o Inbox, aproveitando a
> resposta e o handoff já existentes em Leads.

## Mapa completo de dependências

| Fase | Trabalho | Estado para começar |
|---|---|---|
| 1 | Fechar portas e isolamento de escrita | Agora |
| 2 | Publicação segura, alertas e sessão real | Depois da fase 1 |
| 3 | Leads em escala, LGPD e telas de leitura | Depois da fase 2 |
| 4 | Login por usuário, papéis e auditoria | Fases 1 e 2 concluídas; obrigatório antes do primeiro cliente logar |
| 5 | Produtividade do operador | Pode seguir após a fundação; sem dependência externa |
| 6 | Inbox | Depois da produtividade básica |
| 7 | Subfluxos e agendador | Depois do Inbox |
| 8 | Retomada pela Meta | Agendador pronto e liberações da Meta concluídas |
| 9 | Integração de primeira parte com Verandi | API estável do Verandi |
| 10 | Escala de agência | Quando houver repetição entre clientes/campanhas |
| 11 | Mídia de saída | Quando um cliente pedir |

As atividades externas da Meta e as decisões comerciais correm em paralelo;
elas não exigem esperar as fases de código.

A fase 4 é um **portão de acesso, não uma obrigação de calendário**: se nenhum
cliente for receber login ainda, as fases 5–7 podem avançar depois da fundação.
O que não pode acontecer é liberar login de cliente antes de concluir a fase 4.

## Fase 1 — Fechar portas e isolamento de escrita

Fonte: blocos 3 e 4 de [PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md).

### Entregas

1. Rate limit atômico no Postgres para `/login` e `/api/simular`.
2. Recusa de corpo acima de 256 KB e de fluxo acima de 200 nós no simulador.
3. `robots.txt` e metadados que impeçam indexação do painel.
4. `acaoSalvarRascunho`, `acaoAlternarIa` e `acaoPublicar` passam a exigir
   `clienteId`; repositório prova o par `(fluxoId, clienteId)` em toda escrita.
5. Testes de limite e de tentativa de escrita cruzada.

### Banco

A última migration no início deste plano é `0011`. A primeira candidata é
`0012_limites.sql`, mas o executor deve conferir o diretório novamente. A
função de limite deve ficar em `public`, ter `search_path` fixo, permissões
mínimas e não ficar executável por `public`, `anon` ou `authenticated`.

### Aceite

- A sexta tentativa de login do mesmo IP em cinco minutos é recusada.
- Um corpo de 300 KB retorna 413 e um grafo com 201 nós não executa efeitos.
- Um fluxo de um cliente não pode ser alterado usando o id de outro.
- O painel não é indexável.

## Fase 2 — Publicação segura, observabilidade e sessão real

Fonte: blocos 5, 6 e 7 de [PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md).

### Entregas

1. **Histórico e rollback:** listar versões imutáveis no editor; voltar para
   uma versão antiga publica seu grafo como uma versão nova.
2. **Alertas:** `alertar()` envia webhook configurável em falha do processamento
   assíncrono do webhook, falha de entrega na Cloud API e falha de leitura do
   cofre. Sem URL configurada, vira no-op.
3. **Sessão do painel:** cookie com id aleatório, expiração conferida no servidor
   e HMAC com `PAINEL_SEGREDO` separado de `PAINEL_SENHA`.
4. Testes de versão, alerta, expiração, adulteração e revogação global por troca
   do segredo.

### Aceite

- Rollback nunca reescreve histórico nem aponta para trás; sempre cria a
  próxima versão.
- Uma falha real de envio gera alerta sem derrubar a conversa por causa do
  próprio alerta.
- Cookie expirado ou adulterado é recusado; trocar o segredo encerra todas as
  sessões existentes.

## Fase 3 — Leads em escala, LGPD e telas de leitura

Fonte: blocos 8 e 9 de [PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md) e itens
4 e 6 de [ESTADO.md](ESTADO.md).

### Entregas

1. Paginação de 50 leads, busca por nome/telefone e exportação CSV.
2. Exclusão de contato e política de retenção automática, com 12 meses como
   padrão inicial e teste de fronteira do prazo.
3. Exclusão de cliente com confirmação digitando o nome e explicação explícita
   de que leads, conversas e credenciais serão removidos por cascata.
4. Migration para remover `public.clients.ia_habilitada`, depois de confirmar
   mais uma vez que nenhum código a lê.
5. Clientes, cliente, leads e lead responsivos em 390 px. O editor continua
   desktop.
6. Auditoria WCAG 2.2 e correção das violações A/AA nas telas de leitura,
   incluindo foco de diálogos, teclado, nome acessível e contraste.

### Banco

Retenção, exclusão e remoção de coluna devem usar os próximos números livres no
momento da execução. Se `pg_cron` for habilitado ou alterado, tratar isso como
mudança global e validar o impacto no Verandi antes de aplicar.

### Aceite

- Lista nunca carrega todos os leads de uma vez; busca e CSV respeitam o
  cliente atual.
- Retenção apaga somente dados vencidos; exclusão destrutiva exige confirmação
  forte e não deixa credenciais órfãs.
- As quatro telas não têm rolagem horizontal em 390 px e a auditoria não deixa
  violação nível A aberta.

## Fase 4 — Login por usuário, papéis e auditoria

Fonte: item 1 de [ESTADO.md](ESTADO.md), item 15 de
[EXPANSAO.md](EXPANSAO.md) e telas 5–6 de [BRIEF-UI.md](BRIEF-UI.md).

Esta fase é obrigatória **antes do primeiro cliente receber acesso**. Como o
Supabase Auth é compartilhado com o Verandi, o desenho deve avaliar URLs,
e-mails, claims, SMTP, políticas e efeitos nos dois produtos antes de qualquer
migration ou configuração global.

### Entregas

1. Plano técnico próprio para identidade, associação usuário–cliente e RLS,
   aprovado antes de implementação.
2. Login real: entrar, sair, erro, expiração e revogação individual.
3. Administração: convidar, remover e definir papel.
4. Operador com acesso administrativo; cliente somente leitura, limitado a
   leads e conversas do próprio cliente.
5. Isolamento de todas as consultas, actions e rotas, inclusive
   `/api/simular`; resposta indistinguível entre “não existe” e “não é seu”.
6. Atribuição de conversas no Inbox.
7. Registros de auditoria com autor, data e ação de publicação/administração.

### Aceite

- Matriz automatizada prova operador, cliente correto, cliente errado,
  anônimo, convite removido e sessão revogada.
- Nenhum usuário de cliente vê editor, segredo, conexão ou outro cliente.
- A alteração não enfraquece RLS, Auth ou fluxo de login do Verandi.

## Fase 5 — Produtividade do operador

Fonte: itens 6 a 10 de [EXPANSAO.md](EXPANSAO.md).

Executar nesta ordem:

1. Inserir `{{variavel}}` por clique no cursor do último campo em foco.
2. Respostas rápidas na caixa de atendimento.
3. Controle visível “Automação ligada/desligada” por lead.
4. Notificação de handoff para a pessoa responsável, como efeito de servidor e
   melhor-esforço. Falha ao avisar não desfaz o handoff; fora da janela de 24h,
   a interface explica a limitação de templates.
5. Horário e fuso por cliente; `agora` entra no motor por parâmetro e a condição
   `dentro_do_horario` permanece determinística em teste.
6. Testar um fluxo como um lead existente, carregando suas variáveis sem
   alterar o histórico real.

### Aceite

- Inserção respeita cursor e não corrompe texto.
- Resposta rápida e alternância têm confirmação visível e isolamento por
  cliente.
- Notificação falha aberto e registra o erro.
- Testes de horário não dependem do relógio da máquina.

## Fase 6 — Inbox

Fonte: item 11 de [EXPANSAO.md](EXPANSAO.md).

### Entregas

1. Nova tela Inbox ao lado de Leads; Leads continua sendo a visão de
   qualificação.
2. Lista ordenada de conversas com contagem de não lidas.
3. Troca de conversa no cliente, sem navegação de página.
4. Histórico contínuo, separadores de data e carregamento de mensagens antigas.
5. Painel lateral reutilizando os dados atuais do lead.
6. Com papéis ativos, filtro e atribuição de “meus chats”.

### Aceite

- Trocar conversa não recarrega a página inteira.
- Não lidas, ordenação e paginação permanecem corretas com mensagens
  concorrentes.
- Um atendente nunca acessa conversa fora do seu cliente permitido.

## Fase 7 — Reuso e trabalho baseado em tempo

Fonte: itens 16 e 12 de [EXPANSAO.md](EXPANSAO.md).

### 7A — Subfluxos

1. Fechar a decisão: recomendação atual é **pulo sem volta ao chamador**.
2. Nó de subfluxo no schema, motor, validador e editor.
3. Recusa de ciclos entre fluxos.
4. Publicação congela em cascata as versões de todos os subfluxos alcançáveis.
5. Navegação entre fluxos e indicador “chamado por N fluxos”.

### 7B — Agendador

1. Tabela de tarefas futuras e consumidor via cron.
2. Idempotência, claim atômico, tentativas registradas e observabilidade.
3. Nenhum temporizador em memória ou dependência de instância serverless viva.

### Aceite

- Alterar um subfluxo depois da publicação não muda conversa presa à versão
  antiga; ciclos são recusados.
- Uma tarefa agendada executa uma vez, sobrevive a reinício e pode ser
  diagnosticada quando falha.

## Fase 8 — Retomada e campanhas pela Meta

Fonte: itens 13–14 de [EXPANSAO.md](EXPANSAO.md) e item 2 de
[ESTADO.md](ESTADO.md).

### Dependências externas

1. Verificar a empresa `Portfólio - 4YU`.
2. Concluir App Review e Access Verification como Provedor de Tecnologia.
3. Implantar Embedded Signup v4 com Coexistence; não iniciar no v2, que morre
   em **15/out/2026**.

### Entregas de produto, depois da liberação

1. Cadastro, sincronização e envio de templates aprovados da Meta.
2. Bloco/condição explícita para dentro ou fora da janela de 24h.
3. Sequências temporais.
4. Saída de timeout para pergunta sem resposta.
5. Transmissão segmentada, mostrando o tamanho do público antes de confirmar.

### Aceite

- Nenhum envio fora de 24h tenta texto livre.
- Agendamento e transmissão são idempotentes, auditáveis e respeitam opt-out,
  janela, template aprovado e isolamento por cliente.

## Fase 9 — Integração de primeira parte com Verandi

Fonte: item 17 de [EXPANSAO.md](EXPANSAO.md) e a fronteira atual de
[BRIEF-AGENDA.md](BRIEF-AGENDA.md).

O bloco API genérico já permite integrar sem código novo no motor. Esta fase é
o atalho de produto quando a API do Verandi estiver estável:

1. Definir contrato versionado para disponibilidade, pessoa, agendamento e
   catálogo, com autenticação e idempotência.
2. Conectar Verandi por autorização no servidor e criar a Conexão sem expor o
   token.
3. Oferecer presets de blocos `http` preconfigurados, sem criar tipo novo de nó.
4. Receber eventos do Verandi para lembretes e vagas liberadas por uma fronteira
   autenticada.

### Aceite

- Nenhum código ou consulta cruza schemas ou repositórios.
- Alterar um preset não altera fluxo já publicado.
- Falha ou indisponibilidade do Verandi segue as regras de efeito/handoff do
  AutoFluxos, sem expor segredo.

## Fase 10 — Escala de agência

Fonte: item 18 de [EXPANSAO.md](EXPANSAO.md).

Executar conforme aparecer demanda real:

1. Campanhas: várias portas de entrada por número e atribuição por anúncio.
2. Compartilhar/instalar fluxo para reduzir o setup do segundo cliente do ramo.
3. Palavras-chave configuráveis por cliente, somadas às garantias fixas do
   motor.
4. Fluxos padrão configuráveis para boas-vindas, resposta padrão, mídia e
   pós-atendimento; a garantia continua pertencendo ao motor.
5. OAuth2 como novo tipo de Conexão quando uma integração real exigir.
6. Rotação automática e auditoria de uso de credenciais quando houver mais de
   um operador.

## Fase 11 — Mídia de saída

Fonte: item 19 de [EXPANSAO.md](EXPANSAO.md).

Gatilho: primeiro cliente pedir imagem, vídeo, arquivo ou áudio enviado pelo
bot. Implementar mídia no motor, adaptador WhatsApp, simulador, validação e
armazenamento. Receber mídia sem quebrar já existe e não deve regredir.

## Backlog condicionado e manutenção

| Atividade | Gatilho ou tratamento |
|---|---|
| Credencial de sandbox por Conexão | Primeiro CRM de produção; simulador deixa de usar credencial real |
| CSP completa com nonce | Rodada própria com teste de hidratação |
| Fila de reentrega com recuo | Cliente com volume justificar; hoje falha vira handoff |
| PITR | Continua fora enquanto a decisão for não contratar o plano pago |
| Teste `JWT issued at future` | Corrigir relógio do WSL2; é ambiente, não produto |
| Sincronizar cofre entre máquinas | Ação manual do dono; agente não transporta segredo |

## Ausências documentadas que ainda não viraram atividade

Alguns documentos registram que estas capacidades não existem, mas não há
decisão de construí-las nem critério de entrada. Elas não devem entrar numa
fase escondidas:

- notas e campos manuais no contato;
- formatação de mensagem e contador de emoji;
- transcrição de áudio recebido;
- marketplace de fluxos;
- editor de fluxo para o cliente final;
- escolha entre manter a planilha do cliente, instalar o modelo 4YU ou vender o
  Verandi. [PLANILHAS.md](PLANILHAS.md) orienta essa decisão na venda; não é uma
  feature única do AutoFluxos.

Se uma delas virar prioridade, primeiro registrar estado esperado, gatilho,
fronteira de produto e critério de aceite neste plano.

## Decisões e insumos ainda necessários

1. Confirmar que subfluxo não volta ao chamador.
2. Manter Inbox ao lado de Leads — recomendação atual — ou substituir Leads.
3. Perguntar se a Prelúdio aceita o bot informar faixa de preço.
4. Obter arquivos de abordagem, ticket médio e volume mensal da Prelúdio.
5. Confirmar ramo, titular da conta Meta e titular da chave de IA do primeiro
   cliente.
6. Escolher o LLM padrão recomendado; o palpite documentado é Gemini Flash
   pago, ainda não uma decisão.
7. Pesquisar na documentação atual da Meta: iniciadores de conversa, janela de
   sequências e exigência de verificação do cliente.
8. Confirmar por teste se o BotConversa versiona fluxo e se a conexão de fluxo
   dele volta ao chamador. Isso só afeta discurso comercial e a decisão de
   subfluxo; não é dependência da fundação.

## Regra de execução e verificação

Para cada fase:

1. Confirmar `git status`, preservar alterações locais e ler a documentação do
   Next 16 correspondente antes de mexer em API ou convenção do framework.
2. Para banco, executar o checklist de BANCO-COMPARTILHADO, revisar o SQL e
   testar localmente. Aplicação em produção exige autorização explícita e usa
   somente o aplicador do AutoFluxos.
3. Implementar em fatias pequenas, com teste de isolamento e falha junto da
   funcionalidade.
4. Rodar `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` e
   `git diff --check`.
5. Em mudança global de Supabase, fazer smoke test dos dois produtos.
6. Atualizar este plano e os documentos de origem para que item concluído não
   continue parecendo pendente.
