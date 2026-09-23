# Handoff de execução: UX, UI e regras de negócio

Status: consolidado e revisado. Este arquivo transforma as recomendações da primeira rodada em tarefas executáveis e aponta os tickets especializados da segunda rodada. Não é autorização para alterar produção.

## Como trabalhar com esta revisão

1. Ler o documento principal e o inventário `00-cobertura.md`.
2. Escolher uma entrega abaixo ou um ticket dos relatórios `04` a `07`; conferir evidências contra o código atual antes de implementar.
3. Preservar a regra existente quando a tarefa for apenas visual. Se a proposta exigir mudança de permissão, estado, cota ou atribuição, explicitar a mudança e validar o contrato antes de misturar com layout.
4. Reutilizar componentes e ações existentes. Não criar uma segunda regra de conclusão de atividade, envio ou acesso só para atender à nova superfície.
5. Verificar os critérios de aceite com dados representativos e o ambiente local isolado. Registrar o que não foi possível validar. Não usar produção como fixture.

Os IDs H são pacotes de implementação, não contagem de problemas novos. Eles podem reunir achados dos relatórios anteriores. IDs A, X, S e T apontam para tickets especializados; evitar implementar a mesma correção duas vezes.

### Decidir o que de fato deve mudar

Para cada ticket, distinguir três situações:

- **Defeito demonstrado:** controle promete comportamento diferente do implementado, contrato entre telas se rompe ou operação perde contexto/dados de forma reproduzível. Corrigir com regressão focada.
- **Melhoria de UX proposta:** a função existe e pode estar correta, mas sua descoberta, hierarquia, linguagem ou eficiência podem melhorar. Preservar o contrato e validar o novo desenho com a tarefa real.
- **Questão a verificar:** a leitura não determinou um comportamento ou a evidência está só no wrapper da página. Ler o componente/handler antes de implementar; não criar função duplicada para preencher uma ausência não comprovada.

Exemplos de cuidados nesta própria revisão: um estado `rascunho` no domínio não prova que o usuário consegue deixar um formulário salvo; uma página que só monta um componente não prova ausência de feedback no componente; rota legada com redirect não é tela órfã; retorno do bot após atendimento humano não deve ser confundido com expediente. As versões finais dos relatórios devem refletir essas distinções.

## H01: Atividades como agenda operacional (P1)

**Evidência e problema:** `src/app/clientes/[clienteId]/atividades/page.tsx:58` limita a largura a 900 px; a lista abre contato, mas não oferece as ações do componente da ficha. `src/server/repos/atividades.ts:156` lista abertas com limite 200. Ver `01-operacao.md` para o rastreamento.

**Cenário:** a pessoa abre Atividades para organizar o dia, mas precisa abrir cada contato para executar ações e não consegue pesquisar ou distinguir facilmente o próprio trabalho do trabalho da equipe.

**Solução sugerida:**

1. Usar a área útil da aplicação, com cabeçalho “Atividades”, contagem de resultados e botão “Nova atividade”.
2. Exibir acessos rápidos Atrasadas, Hoje e Próximas; filtros explícitos de situação, responsável e tipo; busca por título/contato. Aplicar busca e paginação ao conjunto autorizado no servidor, não só às primeiras 200 linhas recebidas.
3. Usar linhas com prazo, título/tipo, contato, responsável e ações. Mostrar hora quando cadastrada e link/local quando relevante. Cor deve complementar texto/ícone de atraso, nunca substituir.
4. Oferecer Concluir e Reagendar na linha. Abrir contato continua disponível. Concluídas e canceladas ficam acessíveis por situação, com reabertura conforme as regras atuais.
5. Nova atividade abre formulário com contato, tipo, título, prazo/hora, responsável e campos condicionais pertinentes. Reaproveitar os componentes/contextos da ficha e Inbox; pré-preencher contato e oportunidade quando a origem já os conhece.
6. Após mutação, manter filtros e posição quando possível; mostrar progresso, sucesso ou erro associado à linha. Em falha, não retirar a atividade da lista como se tivesse sido concluída.
7. Introduzir paginação ou carregamento incremental com contagem e fim explícito. Distinguir “nenhuma atividade” de “nenhum resultado para estes filtros”.

**Regras a preservar:** escopo próprio/equipe/todos decidido pelo servidor; responsável precisa ser elegível; vínculo com contato e eventual negócio deve continuar íntegro; usar a regra vigente de fuso e cancelamento. A apresentação “Minhas/Equipe” não cria autorização. Reagendar precisa de ação adequada no servidor caso ainda não exista; não assumir que editar data visualmente basta.

**Dependências:** campos e ações em `src/components/lead-crm/atividades.tsx`, marcador do Inbox, `src/server/acoes-atividades.ts`, critérios de escopo detalhados nos relatórios de acesso.

**Aceite:**

- Dadas mais de 200 atividades autorizadas, quando buscar uma fora do primeiro lote, ela é encontrada.
- Dado usuário com escopo próprio, quando tentar atribuir/consultar outra equipe por URL ou ação, o servidor mantém sua restrição.
- Dada atividade de hoje, quando concluir, a lista e as contagens refletem a conclusão; se falhar, o item permanece e há feedback.
- Dado prazo com hora, quando reagendar, a hora/fuso apresentados e o valor persistido correspondem à mesma intenção.
- Dada lista filtrada, quando abrir e voltar de um contato, o contexto de busca não se perde sem necessidade.

## H02: Seleção e identidade fixadas em Contatos (P1)

**Evidência e problema:** cabeçalhos e células iniciais em `src/app/clientes/[clienteId]/leads/page.tsx:476` não usam fixação horizontal. Ao consultar campos à direita, perde-se a identidade da linha.

**Solução sugerida:** fixar primeira e segunda colunas, com offsets derivados das larguras efetivas; aplicar ao cabeçalho e células; fundo opaco nos estados normal, selecionado e hover; separação visual na borda da segunda coluna. Manter contêiner de rolagem único e sem desalinhamento entre cabeçalho/corpo.

**Regras a preservar:** seleção continua ligada ao ID do contato; ocultar/reordenar campos opcionais não pode alterar o deslocamento das colunas fixas; não mudar escopo de seleção em massa nem comportamento do clique na linha. Foco visível não pode ficar oculto sob as colunas.

**Aceite:** dadas muitas colunas e rolagem até o extremo direito, nome/telefone e checkbox continuam legíveis; selecionar uma linha atua no contato correto; cabeçalho e corpo permanecem alinhados; a tabela funciona com zoom 200% e viewport estreita sem overflow da página inteira. Validar também a primeira rolagem e retorno ao extremo esquerdo.

## H03: Barra de busca e filtros de Contatos (P2)

**Evidência e problema:** busca flexível sem máximo em `leads/page.tsx:324`, filtros em faixas separadas a partir de `:350`, ações com peso semelhante a partir de `:259`.

**Solução sugerida:** título/contagem e ação “Novo contato” no cabeçalho; barra operacional com busca de largura controlada, Filtros, Ordenar (se suportado) e Colunas; região de filtros ativos com remoção individual e Limpar tudo. Agrupar importar/exportar e operações menos frequentes em menu identificável. Dentro de Filtros, manter categorias claras: condição do contato, etiquetas e outros campos realmente suportados. Segmentos devem servir como filtros salvos, sem criar semântica paralela para a mesma condição.

**Regras a preservar:** composição atual de filtros e busca, paginação, parâmetros na URL e permissões de exportação/ações em massa. Limpar um filtro não deve apagar outros nem a busca. Ao mudar filtros, reiniciar apenas a paginação que deixaria de ser válida. Estado ativo precisa de texto e atributo acessível, não só cor.

**Aceite:** dados dois filtros e uma busca, remover um preserva os demais; copiar/abrir URL reproduz o resultado; estado vazio oferece limpar filtros; exportação descreve se cobre selecionados ou o conjunto filtrado. Em notebook, a busca não toma toda a barra; em celular os controles mantêm ordem legível. Conferir o contrato de seleção em massa no relatório `05` antes de mudar a barra.

## H04: Papéis compreensíveis e navegação coerente (P1/P2)

**Evidência e problema:** mapa, exemplos e limites em `02-estrutura.md`. Organização, papel de conta, modelo de capacidade, equipe e administração da plataforma representam conceitos diferentes. O modelo “Gestor” não é um cargo persistido e não existe jornada nomeada Consultor no conjunto revisado.

**Solução sugerida:**

1. Explicitar organização atual e papel nessa organização; qualificar o modo suporte 4YU sem chamá-lo de impersonação.
2. Em Pessoas e acesso, apresentar papel da organização e perfil de trabalho como conceitos distintos. Modelo de acesso aplica regras; o resumo mostra o resultado em linguagem humana.
3. Exibir por pessoa o alcance (próprios/equipe/organização) e capacidades relevantes, com acesso ao detalhamento. Se equipe é necessária e está ausente, informar a consequência antes de salvar.
4. Derivar navegação de acesso efetivo, mantendo proteção no servidor. Definir quando ocultar uma função indisponível e quando explicar uma restrição; a rota direta deve responder coerentemente.
5. Antes de criar preset “Consultor”, definir se ele pode exportar, transmitir, ler valores, registrar venda e operar contatos não atribuídos. A recomendação é acesso mínimo para a tarefa, mas o documento não inventa uma política obrigatória para o negócio.

**Regras a preservar:** não reduzir nem ampliar acesso de membros existentes silenciosamente; suporte continua agindo com identidade própria; não confundir recurso CRM desativado com permissão negada; regras de página/ação podem diferir legitimamente em modo leitura, desde que a UX explique.

**Aceite:** dada pessoa restrita à equipe, o resumo corresponde ao acesso efetivo; navegação não promete salvar o que o servidor proibirá sem explicação; mudança de perfil exibe efeito antes de aplicar; reabrir o editor apresenta o acesso persistido corretamente.

## H05: Início acionável e Relatórios enxutos (P2)

**Evidência e problema:** métricas e séries documentadas em `03-conexoes.md`, C13/C14. A existência dos dados permite análise, mas não prova que todas as dimensões de filtro estejam disponíveis.

**Solução sugerida:** separar decisões do dia de análise histórica. No Início, priorizar pendências autorizadas, alertas com evidência e atalhos que abrem a lista já filtrada. Em Relatórios, começar com período, comparação e as métricas existentes que tenham definição verificável; séries com dias zero; estado sem dados; indicação de amostra. Só oferecer filtro de canal/fluxo/equipe se o cálculo suportar aquela dimensão de forma consistente.

**Regras a preservar:** mesma fonte e definição para total e detalhamento; respeitar escopos e fuso; não transformar ausência de eventos em falha de integração; “conversa”, “contato”, “venda” e “atividade concluída” não são medidas intercambiáveis. Exportação avançada e PDF são evolução posterior, não pré-requisito.

**Aceite:** dado um período, totais e série usam os mesmos limites de data e fuso; abrir a origem de um indicador mantém filtro coerente; usuário restrito não recebe agregado da organização inteira; zero e ausência de dados são distinguíveis quando a fonte permitir.

## Mapa de dependências entre entregas

### Onde executar os demais pacotes

| Pacote | Tickets/fonte | Recorte para implementação |
|---|---|---|
| H06, Automações | [A01–A16](04-automacoes.md) | Separar listagem/navegação, configuração de gatilhos e alterações no editor; tratar edição temporal de sequência como mudança funcional própria |
| H07, Atendimento e ficha | [X01–X21](05-atendimento-crm.md) | Unificar apresentação do estado bot/humano, preservar contexto entre telas e melhorar próximos passos sem fundir entidades distintas |
| H08, Configuração e entrada | [S01–S12](06-configuracao-acesso.md) | Reorganização, feedback e contexto de acesso; aproveitar componentes e validações já existentes |
| H09, Transmissões e conexões | [T01–T06](07-transmissoes-conexoes.md) e [C09–C11](03-conexoes.md) | Corrigir consumo usado na prévia, facilitar acompanhamento/recuperação e preservar público/cancelamento; T01 registra estado técnico, não pede editor novo |
| H10, Validação integrada | Matriz de jornadas abaixo e [cobertura](00-cobertura.md) | Percorrer entradas/saídas entre módulos, com escopos, falhas parciais e retornos; registrar evidência visual e funcional |

Não executar H06–H09 como uma única alteração gigante. Separar correções locais, reorganização visual e mudanças de regra facilita revisão e evita que uma melhoria de layout carregue mudanças não intencionais.

| Dependência | Motivo |
|---|---|
| Modelo de acesso → filtros de responsável e visibilidade de ações | UI não pode inventar acesso de equipe |
| Semântica de seleção → ações em massa e público de transmissão | Usuário precisa saber exatamente quem será afetado |
| Rascunho/publicação → ativação e gatilhos de automação | Editar não deve significar publicar implicitamente sem indicação |
| Contato/conversa/negócio/atividade → atribuição e histórico | Objetos diferentes podem ter responsáveis e ciclos de vida distintos |
| Saúde da conexão → publicação e transmissão | Configuração presente não garante entrega, e baixo tráfego não comprova falha |
| Definição das métricas → home e relatórios | O mesmo nome precisa contar o mesmo evento |

Essas relações são critérios para a revisão dos tickets especializados. Não afirmam, por si só, que o código viola cada contrato.

## Ligações entre telas que precisam fazer sentido para o usuário

Esta matriz é o roteiro de validação de integração da experiência. O comportamento atual e as lacunas estão nos tickets dos relatórios; não tratar todos os itens abaixo como defeitos existentes.

| Jornada | Contexto que deve acompanhar a pessoa | Contrato de UX e negócio |
|---|---|---|
| Início → pendência → Inbox/Atividades | Organização, escopo, período e filtro que geraram o indicador | O número deve levar ao conjunto que explica aquele número |
| Contatos → ficha → voltar | Busca, filtros, página e contato selecionado | Voltar não deve obrigar a reconstruir a pesquisa |
| Inbox → ficha → Inbox | Contato, conversa selecionada e recorte da fila | Abrir ficha não equivale a assumir atendimento; estado atualizado deve reaparecer |
| Funil → ficha/atividade | Negócio, etapa, contato e responsável pertinente | Não perder qual dos negócios do contato motivou a atividade |
| Ganhar/perder → próximo funil/histórico | Venda, valor, motivo e transições previstas | Explicar efeitos legítimos sobre negócio e contato sem sugerir encerramento da conversa |
| Importar → Contatos → selecionar | Resultado por linha, duplicatas e erros | Não chamar importação parcial de falha total nem reenviar sucessos na tentativa seguinte |
| Filtros/segmento → transmissão | Critérios, quantidade, elegibilidade, modelo e exclusões | Público precisa ser entendido antes de disparar; salvar segmento não equivale a enviar |
| Transmissão → detalhe → contato | Campanha, destinatário e estado de entrega | Distinguir enviado/entregue/retido/falha; permitir investigar sem perder a campanha |
| Configurar canal → Automações → configurar canal | Canal/número e situação de entrada | Fluxo publicado e vinculado devem ser descobertos juntos; ligação não é publicação |
| Lista de automações → editor → publicar → lista | Pasta, filtros, automação, rascunho e versão publicada | Deixar claro o que foi salvo e o que passou a responder |
| Gatilho/sequência → fluxo de destino | Origem, destino, publicação e tempo do passo | Ao corrigir o destino, permitir retornar à configuração que estava impedida |
| Testar → bloco com erro → corrigir → testar | Rascunho, variáveis e limites do simulador | Não apresentar simulação como prova de entrega real nem executar efeitos externos implicitamente |
| Pessoa/equipe → fila e atividades | Capacidades e alcance efetivo | Mudança de acesso deve produzir menu e resultados coerentes, sem esconder trabalho por acidente |
| Integração com erro → reparo → origem | Provedor, conexão e recurso dependente | Reparo precisa oferecer retorno ao fluxo/campanha que dependia da conexão |

## Decisões de produto que não devem ser inventadas na implementação

- **Consultor:** confirmar quais tarefas distinguem esse perfil do atendente e do gestor. Até lá, preservar capacidades existentes e melhorar a explicação do acesso.
- **Todos os resultados:** manter seleção por página como comportamento atual; ampliar alcance é funcionalidade nova, com contrato explícito, não consequência automática de redesenhar checkbox.
- **Sequência em andamento:** antes de editar passo/tempo, definir se a mudança afeta inscrições já ativas ou só futuras, conforme comportamento atual identificado em `04`.
- **Agregados de equipe:** um relatório não pode ampliar acesso só porque apresenta totais em vez de linhas.
- **Estado conectado:** presença de credencial, autorização, webhook e tráfego recente têm significados diferentes. Uma conta sem tráfego pode estar saudável.

Essas decisões não impedem corrigir largura, colunas fixas, hierarquia visual e nomes claros. Elas impedem apenas misturar uma mudança de regra não decidida com uma entrega de UX.

## Evidência de conclusão esperada de quem implementar

Para cada ticket: arquivos alterados, comportamento antes/depois, critérios aceitos, testes relevantes executados e limitações remanescentes. Mudanças visuais precisam de conferência renderizada nos tamanhos acordados; testes de unidade não comprovam layout. Mudanças de regra precisam de cenários de autorização e falha, não apenas happy path.
