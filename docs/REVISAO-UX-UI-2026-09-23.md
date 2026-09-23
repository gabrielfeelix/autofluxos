# Revisão de UX/UI — AutoFluxos — 23/09/2026

Status: investigação em andamento. Este documento recebe conclusões progressivamente.

## Objetivo e limites

Revisar experiência, organização das telas, nomenclatura, papéis e maturidade dos fluxos. Propor melhorias sem implementar mudanças no produto. Inspeção do código não comprova funcionamento em produção; cada achado deve indicar sua evidência e limitações.

Investigação delegada a três agentes gpt-5.6-luna, com consolidação pelo agente principal. Nenhuma alteração de banco, disparo de mensagens, configuração de integração ou publicação está no escopo. Há alterações locais preexistentes em canais, motor e servidor; serão preservadas.

## Cobertura

| Frente | Estado | Registro detalhado |
|---|---|---|
| Atividades, contatos e comparação com funil | Em investigação | [Operação diária](revisao-ux-ui-2026-09-23/01-operacao.md) |
| Organização, gestor, consultor, configurações e navegação | Em investigação | [Estrutura e papéis](revisao-ux-ui-2026-09-23/02-estrutura.md) |
| Início, relatórios, transmissões e integrações | Em investigação | [Visão geral e conexões](revisao-ux-ui-2026-09-23/03-conexoes.md) |

## Perguntas do usuário

- Atividades ocupa bem a tela e oferece busca, responsáveis e ações?
- Contatos é tão fácil de operar quanto Funil? A busca e os filtros têm proporções adequadas?
- Seleção e nome do contato ficam visíveis durante rolagem horizontal?
- Existem jornadas distintas de organização, gestor e consultor no código e na UI?
- Configurações tem nomes claros, agrupamentos coerentes e telas que deveriam ser reunidas?
- A página inicial ajuda a agir? Relatórios merece uma área própria?
- Transmissões e integrações têm fluxos completos, feedback e tratamento de falhas?

## Conclusões e prioridades

Aguardando os primeiros achados documentados. As propostas finais terão prioridade, impacto e critérios de aceite.

## Critérios da revisão

- **P1 — resolver primeiro:** bloqueia trabalho cotidiano, induz erro relevante ou impede entender acesso/estado de uma operação.
- **P2 — próxima rodada:** reduz esforço recorrente, melhora descoberta e organiza ações ou informação.
- **P3 — refinamento:** melhora apresentação ou acrescenta conveniência sem corrigir um bloqueio.
- **Confirmado no código:** estrutura ou comportamento diretamente identificável nos arquivos. Não equivale a validação visual em navegador.
- **Hipótese de UX:** julgamento de usabilidade a validar com uso real, especialmente densidade, nomes e descoberta.
- **Pendente de execução:** depende de sessão autenticada, provedor externo, tamanho de tela, dados representativos ou interação real.

Para cada mudança proposta, o aceite deve descrever o que o usuário consegue fazer: encontrar uma tarefa, identificar seu responsável, manter o contato visível ao rolar, entender quem recebe uma transmissão ou corrigir uma integração com erro. Adicionar elementos visuais sem melhorar uma dessas tarefas não é critério suficiente.

## Registro progressivo

1. Escopo e perguntas registrados antes da investigação.
2. Três frentes delegadas a agentes de menor custo; relatórios separados evitam sobrescrita durante a consolidação.
3. Estado inicial: há alterações locais preexistentes no AutoFluxos; repositório Verandi sem alterações no momento da consulta. Revisão não autoriza mudanças em produção.
