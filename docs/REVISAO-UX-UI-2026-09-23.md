# Revisão de UX/UI: AutoFluxos, 23/09/2026

Status: segunda rodada concluída, 51 rotas inventariadas e revisão estática de controles, jornadas e regras de negócio documentada. A primeira rodada foi ampliada para Automações, editor, Inbox, ficha, onboarding, administração e demais superfícies. Validação visual e funcionamento com provedores permanecem pendentes.

## Objetivo e limites

Revisar experiência, organização das telas, nomenclatura, papéis e maturidade dos fluxos. Propor melhorias sem implementar mudanças no produto. Inspeção do código não comprova funcionamento em produção; cada achado deve indicar sua evidência e limitações.

Investigação delegada a três agentes gpt-5.6-luna, com consolidação pelo agente principal. Nenhuma alteração de banco, disparo de mensagens, configuração de integração ou publicação está no escopo. Há alterações locais preexistentes em canais, motor e servidor; serão preservadas.

## Cobertura

| Frente | Estado | Registro detalhado |
|---|---|---|
| Atividades, contatos e comparação com funil | Revisado no código | [Operação diária](revisao-ux-ui-2026-09-23/01-operacao.md) |
| Organização, gestor, consultor, configurações e navegação | Revisado no código | [Estrutura e papéis](revisao-ux-ui-2026-09-23/02-estrutura.md) |
| Início, relatórios, transmissões e integrações | Revisado no código | [Visão geral e conexões](revisao-ux-ui-2026-09-23/03-conexoes.md) |
| Inventário completo de rotas e profundidade da revisão | Inventário conferido | [Mapa de cobertura](revisao-ux-ui-2026-09-23/00-cobertura.md) |
| Automações: listagem, abas, cards, editor e tipos de bloco | Inspecionado no código | [Automações](revisao-ux-ui-2026-09-23/04-automacoes.md) |
| Inbox, ficha, CRM, importação, segmentos e ligações entre jornadas | Inspecionado no código | [Atendimento e CRM](revisao-ux-ui-2026-09-23/05-atendimento-crm.md) |
| Formulários de configurações, acesso, onboarding, admin e páginas públicas | Inspecionado no código | [Configuração e acesso](revisao-ux-ui-2026-09-23/06-configuracao-acesso.md) |
| Controles de transmissões, modelos e conexões | Inspecionado no código | [Transmissões e conexões](revisao-ux-ui-2026-09-23/07-transmissoes-conexoes.md) |
| Pacotes de implementação e critérios transversais | Consolidado | [Handoff para execução](revisao-ux-ui-2026-09-23/08-handoff-execucao.md) |

### Contrato de entrega para o agente implementador

A segunda rodada registra inventários por superfície, não apenas uma lista de problemas. Cada ticket deve indicar: ID e prioridade; comportamento atual; evidência no código; cenário e impacto; solução sugerida com fluxo e estados; regras de negócio a preservar; dependências e critérios de aceite observáveis. Hipótese de UX não deve ser implementada como correção de defeito comprovado sem confirmar a premissa.

O agente implementador deve conferir se o código mudou após esta revisão, aproveitar comportamentos existentes e não transformar uma recomendação de organização visual em alteração silenciosa de permissão, cota, propriedade de dados ou entrega de mensagens.

**Ordem de leitura recomendada:** este resumo → `00-cobertura.md` → `08-handoff-execucao.md` → relatório da área a implementar. Os relatórios `01`–`03` são a primeira rodada; as precisões de `04`–`08` prevalecem quando aprofundam o mesmo tema. IDs repetidos por tema representam a mesma entrega, não demandas para duplicar funcionalidade. Nem todo ticket descreve bug: alguns são propostas de produto e outros registram regras que já funcionam e devem ser preservadas.

### Automações também faz parte da revisão ampliada

O inventário identificou seis abas na listagem: Fluxos, Modelos de chatbot, Palavras-chave, Eventos, Campanhas e Sequências. O editor tem 14 tipos de bloco: mensagem, mídia, pergunta, condição, salvar campo, etapa, etiqueta, nota, ir para automação, voltar, IA, atendimento humano, HTTP e NPS. O relatório `04` registra as opções de cada grupo e os caminhos de criar, duplicar, importar, organizar, salvar, publicar, testar, recuperar versão e compartilhar.

O foco é a jornada completa: encontrar a automação → entender como ela inicia → editar → saber o que foi salvo → publicar a versão pretendida → ativar a entrada → acompanhar o resultado. A revisão trata separadamente rascunho, publicação e ativação; não recomenda reunir esses estados num único selo impreciso.

Proposta concreta: organizar a área em **Fluxos, Gatilhos e Sequências**, com a biblioteca de modelos acessível na criação e por link próprio. Dentro de Gatilhos, manter Palavras-chave, Eventos e Campanhas por frase/link; estas últimas não são Transmissões. Preservar URLs e acesso direto. A listagem deve ter busca/filtros, identidade clara e uma ação principal de editar; ações menos frequentes podem ficar no menu. O relatório `04` detalha o custo desse agrupamento e as alternativas.

No editor, preservar catálogo, canvas e painel de propriedades/teste, melhorando a hierarquia do que já existe. A revisão confirmou que o simulador pode executar IA e HTTP reais; HTTP já tem aviso. O ticket A16 explica a melhoria de comunicação proposta, sem alegar que o botão envia mensagens reais no WhatsApp.

## Perguntas do usuário

- Atividades ocupa bem a tela e oferece busca, responsáveis e ações?
- Contatos é tão fácil de operar quanto Funil? A busca e os filtros têm proporções adequadas?
- Seleção e nome do contato ficam visíveis durante rolagem horizontal?
- Existem jornadas distintas de organização, gestor e consultor no código e na UI?
- Configurações tem nomes claros, agrupamentos coerentes e telas que deveriam ser reunidas?
- A página inicial ajuda a agir? Relatórios merece uma área própria?
- Transmissões e integrações têm fluxos completos, feedback e tratamento de falhas?

## Conclusões e prioridades

Principais achados por inspeção estática, detalhados nos três relatórios:

| Prioridade | Achado | Direção proposta |
|---|---|---|
| P1 | Seleção e Contato não têm fixação na tabela horizontal | Fixar as duas colunas, incluindo cabeçalho, com fundo e sobreposição corretos |
| P1 | Atividades limita a largura a 900 px e a lista oferece abertura do contato como ação | Transformar a tela em área de execução: concluir, reagendar, atribuir e criar com feedback |
| P2 | Busca de Contatos cresce sem largura máxima; filtros aparecem em faixas de pills | Barra compacta de busca e filtros, com seleção ativa explícita e limpeza fácil |
| P2 | Funil já oferece busca, filtro de responsável e ações contextuais mais completas | Reaproveitar sua lógica de interação nas demais áreas operacionais |
| P1 | Papéis da conta, modelos de permissão e administração da plataforma usam linguagens diferentes | Explicitar papel, contexto e acesso efetivo; conferir coerência entre menu e autorização |
| P1 | Transmissões mostra consumo diário inicial igual a zero no formulário | Exibir consumo consultado, revalidar ao confirmar e explicar conflitos |
| P1 | Alguns estados de integração se baseiam em cadastro/configuração | Separar conexão configurada, autorização válida e evidência recente de funcionamento |
| P2 | Há métricas e séries no código, mas a análise fica concentrada na home | Início orientado à ação; Relatórios para período, comparação e detalhamento |

São evidências de código, ainda sem validação em navegador. O limite de largura está confirmado; a qualidade visual percebida e a proporção exata da tela precisam de comparação em viewports reais.

## Avaliação consolidada

O problema principal identificado é a **desigualdade entre as superfícies de trabalho**. O Funil reúne ferramentas de operação; Atividades expõe uma lista limitada; Contatos tem ferramentas, mas distribui busca, filtros e ações em várias regiões. A melhoria deve dar consistência às tarefas recorrentes, antes de acrescentar decoração ou novas telas.

### Atividades: tornar a agenda um lugar para trabalhar

Usar a largura útil da aplicação e uma hierarquia clara: título e ação “Nova atividade”; resumo de atrasadas/hoje/próximas; busca e filtros; lista com prazo, atividade, contato, responsável e ações. “Minhas atividades” e “Equipe” devem refletir o acesso efetivo. Não liberar escopo de equipe só porque existe um seletor.

Criar, concluir e reabrir já têm superfícies na ficha/Inbox; a falta está na agenda global. Reagendar e atribuir precisam ser conferidos como jornada completa, reaproveitando regras existentes quando aplicável. Evitar exigir abertura da ficha para toda ação simples. O limite atual de 200 atividades exige paginação ou aviso explícito, para não esconder trabalho.

**Aceite:** encontrar uma tarefa, identificar seu responsável e concluir/reagendar sem sair da agenda; feedback claro; preservar filtros e permissões; não perder itens além do limite da consulta.

### Contatos: densidade organizada e identidade sempre visível

Fixar seleção e Contato na horizontal é a primeira correção. Cabeçalho e linhas precisam usar as mesmas larguras, fundos opacos e camadas adequadas. Conferir que foco e campos não ficam encobertos.

Reduzir a busca a uma largura confortável; colocar filtros em um controle identificável e mostrar chips somente para filtros ativos, com remoção individual e “Limpar”. Separar a ação principal “Novo contato” das ferramentas de gestão da base. Importar, exportar e colunas continuam acessíveis sem disputar o mesmo peso visual.

**Aceite:** rolar até a última coluna mantendo contato e seleção; reconhecer filtros ativos; limpar a busca; usar teclado e telas estreitas sem perder contexto.

### Organização, gestor e consultor: base existente, linguagem incompleta

Conta/organização é o espaço de trabalho. Gestor e consultor são perfis de pessoas dentro dele. Administrador da plataforma é outro contexto. Essas três coisas não devem aparecer como opções equivalentes.

O código já tem papéis de conta (`owner/admin/member`), capacidades e escopos (`próprios/equipe/todos`), além de modelos “Gestor” e “Operador”. Isso não equivale a perfis de negócio persistidos e jornadas distintas. Não foi identificada uma jornada nomeada “Consultor”. A política atual de membro é ampla; chamar essa pessoa apenas de “Atende” pode criar expectativa incorreta.

Proposta de linguagem voltada ao usuário: **Proprietário da organização**, **Administrador da organização**, **Gestor**, **Consultor/Atendente**, conforme a função real do negócio. Os dois últimos podem continuar sendo modelos de acesso, desde que a interface explique isso e mostre o resultado: “vê sua equipe”, “pode exportar”, “pode alterar configurações”. Não expor identificadores técnicos nem modificar permissões existentes silenciosamente.

**Aceite:** quem administra entende o que uma pessoa pode ver e fazer antes de salvar; quem opera sabe em qual organização está; menu, acesso por URL e ações têm comportamento coerente. A definição do nome “Consultor” depende de confirmar se representa venda, atendimento ou ambos.

### Início e Relatórios: propósitos diferentes

A home já tem conteúdo analítico relevante. O primeiro ajuste deve ser de hierarquia: “o que exige minha ação hoje?”, com atividades atrasadas, conversas aguardando atendimento e problemas de conexão que tenham evidência. Resumos devem levar à lista filtrada correspondente.

Uma área de **Relatórios faz sentido** porque já existem métricas de desfechos, espera, satisfação, fechamentos e séries no código. Sua primeira versão deve permitir escolher período, comparar e entender a definição dos números. Não é necessário começar com um construtor de dashboards. Exportação e análises avançadas podem vir depois. Gestores e consultores devem ver apenas os dados permitidos pelo seu escopo.

**Aceite:** a home orienta a próxima ação; relatórios respondem “o que mudou no período?”; métricas exibem período e definição e não misturam bases diferentes sem explicação.

### Configurações: boa cobertura não significa organização excelente

O hub reúne muitas funções úteis, mas há sobreposição entre canais e integrações, nomes amplos como “Personalizar sistema” e uma página “Equipe” que reúne pessoas, permissões e distribuição. A avaliação é de arquitetura da informação; não houve inspeção visual renderizada para julgar acabamento.

Proposta consolidada de agrupamento, a validar por tarefas de usuários:

| Grupo | Conteúdo | Decisão de juntar/separar |
|---|---|---|
| Organização | Dados da empresa; Pessoas e acesso; Plano e consumo; Objetivo e recursos | Um grupo, mantendo páginas distintas porque são tarefas diferentes |
| Atendimento e automação | Conhecimento da IA; Horário; Respostas rápidas; comportamento de retorno ao bot onde já é configurado | Aproximar assuntos relacionados e preservar a distinção entre atendimento humano e automação |
| Conteúdo e classificação | Catálogo; Arquivos e mídias; Etiquetas | Agrupar descoberta; manter editores próprios, sem transformar tudo em um formulário longo |
| Conexões | Canais de conversa; Fontes de leads; Sistemas externos; Credenciais avançadas | Catálogo central de estado e acesso aos detalhes de cada provedor |

Recomendação editorial: **“Personalizar sistema” → “Objetivo e recursos”**; **“Equipe” → “Pessoas e acesso”**. Dentro de Pessoas e acesso, usar seções Pessoas, Equipes e Distribuição do atendimento, com explicação do alcance de cada uma.

A consolidação deve ocorrer principalmente **na navegação e na descoberta**, não fundindo todas as telas. WhatsApp e Instagram justificam detalhes próprios; credenciais avançadas não devem competir com conectar um canal. Segmentos deve ficar próximo dos filtros salvos de Contatos; modelos de mensagem devem continuar acessíveis no contexto de Transmissões. Rotas legadas que redirecionam para o destino atual não são, por si só, telas duplicadas.

**Aceite:** localizar como adicionar uma pessoa, ativar o funil, mudar horário ou resolver uma conexão sem conhecer o nome técnico da configuração. O catálogo e seus contadores devem representar o mesmo conjunto de integrações.

### Transmissões e integrações: há implementação, falta comprovação operacional

Transmissões tem criação, agendamento, fila, cancelamento e progresso, com arquivos de teste associados. A revisão encontrou problemas concretos de apresentação da cota e de consulta de progresso por campanha, além da falta de filtros e detalhamento de falhas na lista. Isso não autoriza concluir que todo envio funciona nem que o módulo está quebrado.

WhatsApp, Instagram, anúncios, agenda e Magento têm fluxos implementados em diferentes níveis. A matriz detalhada registra a cobertura encontrada e o que exige provedor real. Telegram aparece como indisponível na interface; existir um adaptador isolado não torna a jornada disponível.

Para os estados visuais, diferenciar **configurado**, **autorização válida**, **último evento** e **falha conhecida**. Ausência de eventos recentes, sozinha, não prova desconexão: pode haver pouco tráfego. Cada problema confirmado deve ter uma próxima ação legível.

**Aceite:** compreender público, cota e estado antes de transmitir; consultar progresso e falhas; identificar o que uma integração consegue fazer e como recuperar uma falha. Comprovação de entrega exige teste separado em ambiente autorizado.

## Ordem de execução proposta

| Rodada | Entrega | Resultado esperado |
|---|---|---|
| 1 | Fixação das colunas; busca/filtros de Contatos; ações e largura de Atividades | Menos navegação e perda de contexto no trabalho diário |
| 2 | Resumo de acesso e nomenclatura; menu por capacidade; corrigir cota/estados enganosos | Clareza sobre quem pode agir e sobre o estado das operações |
| 3 | Automações: busca, estados de publicação/ativação, gatilhos, passos de sequência e limites do Testar | Configurar e alterar automações entendendo o efeito de cada ação |
| 4 | Reorganização de Configurações; home orientada a pendências | Encontrar ajustes e decidir a próxima ação com menos esforço |
| 5 | Relatórios enxutos; filtros e detalhe de campanhas; diagnósticos de conexão | Analisar resultados e resolver falhas sem depender de suporte |

Esta ordem é proposta de produto, não autorização de implementação. Mudanças de acesso exigem revisar compatibilidade com usuários atuais; reorganização de menus deve preservar links e entradas contextuais úteis.

## Validação ainda necessária

- Navegador autenticado com dados representativos: desktop largo, notebook e celular; confirmar densidade, quebra das barras e comportamento da rolagem.
- Matriz de personas: proprietário, administrador da conta, gestor com escopo de equipe e consultor/atendente com escopo próprio; conferir menu, URL direta e ações.
- Atividades com mais de 200 registros, contatos com muitas colunas e campanhas com histórico extenso.
- Transmissões em ambiente autorizado: agendar, cancelar, falhar parcialmente e acompanhar entrega; conferir cota com consumo existente e concorrência.
- Integrações: conexão, expiração/revogação e recuperação; teste real de provedor somente em escopo autorizado.

Nenhuma dessas validações em execução foi feita nesta revisão. Arquivos de teste encontrados são evidência de cobertura prevista, não de resultado atual. A revisão também não equivale a auditoria completa de segurança ou acessibilidade. Na segunda rodada, Inbox, editor de fluxos, onboarding e área administrativa receberam inventário e revisão próprios no código; isso não equivale a clicar em todas as combinações de estado e permissão no navegador.

## Critérios da revisão

- **P1, resolver primeiro:** bloqueia trabalho cotidiano, induz erro relevante ou impede entender acesso/estado de uma operação.
- **P2, próxima rodada:** reduz esforço recorrente, melhora descoberta e organiza ações ou informação.
- **P3, refinamento:** melhora apresentação ou acrescenta conveniência sem corrigir um bloqueio.
- **Confirmado no código:** estrutura ou comportamento diretamente identificável nos arquivos. Não equivale a validação visual em navegador.
- **Hipótese de UX:** julgamento de usabilidade a validar com uso real, especialmente densidade, nomes e descoberta.
- **Pendente de execução:** depende de sessão autenticada, provedor externo, tamanho de tela, dados representativos ou interação real.

Para cada mudança proposta, o aceite deve descrever o que o usuário consegue fazer: encontrar uma tarefa, identificar seu responsável, manter o contato visível ao rolar, entender quem recebe uma transmissão ou corrigir uma integração com erro. Adicionar elementos visuais sem melhorar uma dessas tarefas não é critério suficiente.

## Registro progressivo

1. Escopo e perguntas registrados antes da investigação.
2. Três frentes delegadas a agentes de menor custo; relatórios separados evitam sobrescrita durante a consolidação.
3. Estado inicial: há alterações locais preexistentes no AutoFluxos; repositório Verandi sem alterações no momento da consulta. Revisão não autoriza mudanças em produção.
4. Achados de operação incorporados durante a investigação: largura de Atividades, ausência de ações na agenda, busca e colunas de Contatos.
5. Papéis, configurações, métricas e conexões incorporados; hipóteses separadas de defeitos demonstráveis.
6. Revisão editorial corrigiu três inferências: acesso de suporte não é impersonação; diferença entre guards não comprova falha; rota legada de Retomada redireciona para Horário e não é tela órfã.
7. Consolidação final: prioridades, arquitetura sugerida, critérios de aceite e limites da validação. Somente documentação criada nesta tarefa.
8. A pedido do usuário, iniciada segunda rodada: inventário de rotas, ações internas, ligações entre telas e tickets executáveis, incluindo Automações e editor em profundidade.

9. Segunda rodada encerrada: 51 rotas conferidas contra o disco, seis abas de Automações, 14 tipos de bloco e inventários internos nos relatórios 04–07.
10. Revisão de qualidade corrigiu inferências sobre seleção/bulk, favoritos, retomada, rascunho de transmissão, prévia de público, datas civis, efeitos de ganho/perda e atrasos absolutos de sequência.
11. Handoff 08 consolidado; links entre documentos e cobertura de rotas verificados. Somente documentação foi alterada; sem teste de aplicação, deploy, banco ou envio.
