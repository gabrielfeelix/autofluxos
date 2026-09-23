# Revisão UX/UI e regras de negócio: Automações

Data: 23/09/2026  
Escopo: listagem `/clientes/[clienteId]/fluxos`, abas de automação e editor `/fluxos/[fluxoId]`. Revisão estática do código; não houve navegador, banco, rede ou produção.

## Como ler

**Confirmado no código** significa que a superfície, estado ou regra aparece no código citado. **Hipótese UX** é um risco de compreensão, densidade ou responsividade que precisa de validação visual com usuários/navegador. **Não examinado** é uma área que não foi coberta nesta rodada. Prioridade: **P1** urgente funcional/regra de negócio, **P2** melhoria de fluxo e entendimento, **P3** refinamento.

## Inventário das superfícies

### Listagem e abas

`../../src/app/clientes/[clienteId]/fluxos/page.tsx:78-146` confirma seis abas controladas por `?aba=`: **Fluxos**, **Modelos de chatbot**, **Palavras-chave**, **Eventos**, **Campanhas** e **Sequências**. A aba inválida volta a Fluxos. O carregamento busca somente os dados da aba ativa (`:191-263`), enquanto os contadores são carregados para a navegação.

Na aba **Fluxos** (`:386-665), a entrada é pasta/ordenação e cada automação tem nome editável, canal, resumo do grafo, IA ativa, números vinculados, impedimentos de validação, respostas, estado (`RASCUNHO`, `ATIVA`, `DESLIGADO`), subir/descer, ligar/desligar, mover para pasta, duplicar e apagar. O clique da linha abre o editor; o servidor recusa exclusão quando ainda há número vinculado (`../../src/server/repos/fluxos.ts:374+`). Criar oferece pasta, importar JSON e nova automação (`page.tsx:388-425`).

**Modelos de chatbot** (`page.tsx:667-684`) abre a galeria `GaleriaDeTemplates`: busca textual, chips de etiquetas, desenho, resumo e seleção. O modal permite criar do zero ou escolher modelo, depois canal/nome; a busca e filtros são confirmados em `../../src/components/fluxos/templates.tsx:77-210`. “Modelos de chatbot” é um rótulo deliberado para não confundir com modelos de mensagem do WhatsApp.

**Palavras-chave** (`page.tsx:686-800`) cadastra frase, operador e fluxo destino; lista permite ligar/desligar e apagar, mostra execução e avisa quando destino desapareceu ou não está publicado. **Eventos** (`:802-907`) cadastra nome exato do evento e fluxo destino, com os mesmos estados/avisos, e inclui Webhooks de entrada. **Campanhas** (`:909-1044`) cadastra nome, frase pré-preenchida e fluxo destino, lista contatos/conversas e permite ligar/desligar/apagar. **Sequências** (`:1046-1325`) cadastra evento, etapas de quadro e passos; cada passo pode aguardar horas/minutos, abrir fluxo ou enviar template aprovado, mostrar inscrições (ativas/concluídas/saíram/bloqueadas), desligar e apagar.

Webhooks têm criação por nome, segredo exibido uma única vez, switch, última chamada, exclusão e instrução completa de POST/HMAC (`../../src/components/gatilhos/webhooks-de-entrada.tsx:20-164`). A ação confirma que apagar invalida chamadas futuras (`../../src/server/acoes.ts:633-677`).

### Editor

`../../src/app/clientes/[clienteId]/fluxos/[fluxoId]/page.tsx:42-184` carrega cliente, fluxo, conexões, quadros/etapas, etiquetas, equipe, variáveis de outros fluxos, publicação e histórico. O editor é tela cheia e deixa explícito que publicar altera o que responde no WhatsApp.

O catálogo confirmado em `../../src/components/editor/editor.tsx:121-141` contém **14 tipos**: `mensagem`, `midia`, `pergunta`, `condicao`, `salvar-campo`, `etapa`, `etiqueta`, `nota`, `ir-fluxo`, `voltar`, `ia`, `handoff`, `http` e `nps`. O painel (`../../src/components/editor/painel.tsx`) revisado cobre: mensagem/mídia e atrasos (`:474-567`); pergunta, variável, opções estáticas/dinâmicas, formatos, mídia aceita e timeout (`:569-993`); condição e operadores (`:994-1075`); salvar campo (`:1077-1106`); etapa de quadro (`:1107-1162`); etiqueta (`:1163-1204`); nota (`:1207-1239`); NPS, variável, motivo e timeout (`:1240-1372`); ir para automação (`:1376-1435`); voltar/alvo (`:1442-1498`); IA, instrução, ferramentas e variável de resposta (`:1499-1572`); handoff, equipe, horário, retomada e retorno ao bot (`:1573-1816`); HTTP, método GET/POST, URL, cabeçalhos/credenciais, corpo, mapeamento e falha (`:1817-2071`).

O cabeçalho oferece nome, canal, estado de salvamento, contrato de IA para administradores, indicador publicado/rascunho, impedimentos, Organizar, Respostas, Ajuda, Histórico, Compartilhar, descartar rascunho e Publicar (`../../src/components/editor/editor.tsx:1329-1597`). Salvar é automático após pausa (`:651-682`); Publicar fica desabilitado sem validação, sem mudança ou enquanto salva. O painel pode ser fechado/redimensionado; há abas Bloco/Testar, minimapa/controles, seleção múltipla e ações em lote para atrasos (`:1609-1987`, `:2056-2118`).

Histórico lista versões e republica uma versão como nova após confirmação (`../../src/components/editor/versoes.tsx:28-124`); não há comparação visual de grafos. Compartilhar só é possível com publicação, gera links expiráveis, QR, copia o endereço, revoga e exporta JSON sem credenciais (`../../src/components/editor/compartilhar.tsx:20-190`). Importar JSON cria rascunho sem IA/credenciais e abre o editor (`../../src/components/fluxos/importar-json.tsx:10-77`).

## Achados e tickets

### A01: Procurar e filtrar automações em escala (P2)

**Evidência/certeza:** confirmado no código: Fluxos renderiza pastas e lista, mas não possui campo de busca, filtro por canal/estado/IA/impedimento ou paginação (`../../src/app/clientes/[clienteId]/fluxos/page.tsx:386-665`). Palavras-chave, eventos, campanhas e sequências também só listam itens (`:686-1325`). Impacto em contas com muitos fluxos: localizar uma automação depende de rolagem e pasta; o usuário pode editar/desligar a errada.

**Sugestão:** manter `?aba=` e adicionar `q`, `estado`, `canal`, `pasta` e, conforme aba, destino/ativo; aplicar busca por nome/frase/evento; mostrar contagem e estado vazio; preservar filtros ao abrir/voltar; deixar “Limpar filtros” explícito. Não esconder itens sem carregamento e manter permissões server-side.

**Invariante/dependências:** busca não altera ordem, publicação, vínculo a número ou execução; precisa respeitar a mesma consulta autorizada. **Aceite:** Given 100 automações em várias pastas, When buscar por nome parcial e estado desligado, Then só aparecem correspondentes, a URL é copiável e limpar restaura a lista; Given destino não publicado, Then o aviso continua visível.

### A02: Navegação das seis abas e dependências (P2; hipótese visual)

**Evidência/certeza:** seis abas ficam numa navegação única (`page.tsx:78-170`); o risco de compressão/quebra em viewport estreita é hipótese, sem navegador. O conteúdo de criação depende de existir fluxo e cada aba comunica isso de forma diferente (`:930-940`, `:696-738`, `:812-844`).

**Sugestão:** validar em 320/768/1440px; se quebrar, usar rolagem horizontal acessível ou menu “Mais”, sempre preservando contador, aba ativa e `?aba=`. Padronizar estado vazio: motivo, ação primária e consequência. **Aceite:** teclado alcança todas as abas, a aba ativa é anunciada, nenhum rótulo fica cortado, e uma aba sem fluxos leva diretamente a criar automação/modelo.

### A03: Diferenciar publicado, ligado e rascunho (P2)

**Evidência/certeza:** confirmado: publicar valida o grafo (`../../src/server/repos/fluxos.ts:278-371`), ligar/desligar é separado e controla novas conversas sem despublicar (`../../src/server/acoes.ts:535-546`); a linha mostra os estados (`page.tsx:589-599`). O texto da tela explica parte da regra, mas o risco de interpretação é UX.

**Sugestão:** no estado da linha e no editor mostrar duas dimensões explícitas: “Publicação: vN/rascunho” e “Entrada: ligada/desligada”, com tooltip e ação contextual. Após desligar, confirmar “conversas existentes continuam na versão em que começaram”. **Aceite:** Given fluxo publicado e desligado, When abrir a lista/editor, Then ambas as condições aparecem sem inferência por cor; When ligar, Then não há promessa de republicação.

### A04: Criar do zero, modelo, importar e duplicar (P2)

**Evidência/certeza:** confirmado: galeria tem busca/chips e escolha visual (`../../src/components/fluxos/templates.tsx:77-210`); duplicação é imediata, nasce desligada (`../../src/components/fluxos/duplicar.tsx:13-58`); importação abre rascunho (`importar-json.tsx:10-77`); copiar/importar limpa IA e credenciais nas ações. Hoje existem quatro caminhos paralelos.

**Sugestão:** manter caminhos, mas no CTA “Nova automação” apresentar uma escolha com consequências: “Em branco”, “Usar modelo”, “Importar arquivo”, “Duplicar existente”; após qualquer caminho, checklist único no editor: revisar canal, conexões, IA, gatilhos e publicar. **Aceite:** cada caminho informa se cria rascunho/desligada e a próxima ação; nenhum caminho publica sozinho.

### A05: Destino não publicado pode ser ligado (P1)

**Evidência/certeza:** confirmado: palavras, eventos e campanhas permitem destino não publicado e exibem “não abre nada” (`../../src/app/clientes/[clienteId]/fluxos/page.tsx:742-795`, `:848-899`, `:985-1040`); sequências também avisam por passo (`../../src/app/clientes/[clienteId]/fluxos/page.tsx:1158-1217`). Isso é funcionalidade existente com falha operacional previsível.

**Sugestão:** manter seleção de rascunho para permitir preparar configuração, mas impedir ativar o gatilho enquanto destino não publicado ou exigir confirmação explícita “Ativar agora deixará este gatilho sem resposta”. Na lista, filtrar “com impedimentos”. **Invariante:** ativar nunca pode aparentar que o fluxo responderá quando `publicado=false`. **Aceite:** Given destino em rascunho, When clicar ligar, Then botão recusa ou abre confirmação clara; Given publicado, Then ligar funciona e contador permanece.

### A06: Sequências não têm edição/reordenação de passo (P1)

**Evidência/certeza:** confirmado na tela que passos são expandidos, adicionados e removidos (`../../src/app/clientes/[clienteId]/fluxos/page.tsx:1153-1313`). O repositório revisado expõe listar, criar, alternar e apagar sequência/passo, mas não uma operação de editar ou reordenar passo (`../../src/server/repos/sequencias.ts:1-280`). Portanto a ausência é funcional no código examinado, não apenas visual.

**Sugestão:** adicionar editar inline/modal e mover para cima/baixo, mostrando ordem, atraso acumulado, canal/template e efeito de remoção. Preservar o bloqueio de tempos duplicados e a regra de template para atrasos além de 24h já aplicada ao criar passo. **Aceite:** Given passos com atrasos absolutos desde a entrada, When editar um passo, Then o novo atraso mantém a ordem temporal e rejeita empate; a UI não deve prometer “mover terceiro para primeiro” sem alterar o atraso. When editar atraso/template, Then valida janela de 24h e destino antes de salvar; exclusão exige confirmação do impacto nas inscrições.

### A07: Autosave e Publicar devem formar uma jornada explícita (P2)

**Evidência/certeza:** confirmado: salvar rascunho é automático e há `beforeunload` quando o estado não é salvo (`../../src/components/editor/editor.tsx:651-682`), Publicar é uma ação separada (`../../src/components/editor/editor.tsx:1329-1597`, `../../src/server/acoes.ts:306-327`). O código mostra estados `salvo`, `salvando`, `pendente` e `erro`, mas não há ação visível de tentar novamente no trecho examinado; navegador não foi executado.

**Sugestão:** fixar indicador “Rascunho salvo às HH:MM”, “Salvando…”, erro com tentar novamente e “Publicar vN” quando houver novidade; ao sair com erro, bloquear perda e oferecer retry. **Aceite:** Given alteração pendente, When sair/fechar, Then aviso identifica se ainda está salvando; Given salvo e válido, Then publicar informa versão e alcance (novas conversas) antes de concluir.

### A08: Operações escondidas no menu contextual (P1)

**Evidência/certeza:** confirmado: duplicar/excluir nó e apagar ligação estão no menu de botão direito (`../../src/components/editor/editor.tsx:957-985`, `:1040-1135`, `:2040-2184`); Delete/Backspace e Ctrl/Cmd+Z/Y já existem (`:1040-1135`), e excluir também existe no painel. Duplicar nó e apagar ligação continuam dependentes do menu contextual; a ausência relevante é uma ação visível acessível para duplicar.

**Sugestão:** adicionar botão “Mais” acessível no nó selecionado para duplicar e apagar ligação, mantendo os atalhos Delete/Backspace e Ctrl/Cmd+Z/Y já existentes; manter undo. Foco deve ir para o menu e voltar ao nó. **Aceite:** Given nó selecionado via teclado, When abrir “Mais”, Then duplicar, excluir e tornar início são alcançáveis sem mouse; When excluir, Then confirmação/undo informa arestas afetadas.

### A09: Catálogo de blocos e painel denso (P2; hipótese visual)

**Evidência/certeza:** os 14 blocos e todas as opções acima foram confirmados no código; densidade, rolagem e compreensão em telas pequenas são não examinadas em navegador.

**Sugestão:** agrupar catálogo por intenção (Conversar, Dados, Roteamento, Integrações), manter busca por nome/descrição e tooltip; no painel, preservar títulos e ações ao rolar. Não remover tipos. **Aceite:** todos os 14 aparecem por busca e teclado; cada bloco mostra descrição curta antes de inserir; em 320px não há ação primária fora da viewport sem rolagem alcançável.

### A10: HTTP: tornar limites de segurança compreensíveis (P2)

**Evidência/certeza:** bloco HTTP expõe URL, método, headers, credenciais, corpo, mapeamento e tratamento de falha (`painel.tsx:1817-2071`); motor passa a requisição (`../../src/core/engine/executar.ts:957-976`), enquanto servidor valida HTTPS, DNS/endereço e redirecionamentos (`../../src/server/efeitos/rede.ts:56+`, `../../src/server/efeitos/http.ts`). Não foi detectada vulnerabilidade nesta inspeção estática.

**Sugestão:** perto de URL/credencial explicar “somente HTTPS/endereço público”, que segredo fica na conexão, timeout/retry e que resposta deve ser mapeada antes de publicar; oferecer simulação ou teste por conexão explicitamente autorizado, com resultado mascarado e limite; não executar POST real implicitamente. **Invariante:** UI não deve prometer que qualquer URL funciona, nem expor segredo/log bruto. **Aceite:** configuração inválida mostra motivo antes de publicar; teste mascara credenciais e valida redirecionamento; falha configurada como humano segue o handoff definido.

### A11: IA: explicitar autonomia e confirmação (P2)

**Evidência/certeza:** bloco IA permite instrução, ferramentas e salvar resposta (`painel.tsx:1499-1572`); catálogo separa ferramentas de presets (`../../src/core/ferramentas.ts:1-80`); política possui `automatico`, `confirmar`, `humano`, com escrita padrão `confirmar` (`../../src/server/ia/politica.ts:1-104`). Isso confirma controles server-side, mas a tela do editor não foi verificada quanto à explicação dessas consequências.

**Sugestão:** ao selecionar ferramenta de escrita, mostrar a política efetiva já configurada para o cliente e o que o contato verá quando a política for `confirmar` ou `humano`; não bloquear publicação válida. Exibir ferramentas de leitura/escrita separadas. O cabeçalho já mostra o contrato de IA para administradores (`../../src/components/editor/editor.tsx:1329-1597`). **Aceite:** Given ferramenta que grava, When configurar IA, Then política efetiva (`automático`, `confirmar` ou `humano`) fica visível e a confirmação existente é compreensível; Given ferramenta de leitura, Then a tela não pede uma confirmação sem efeito.

### A12: Histórico sem comparação visual (P2)

**Evidência/certeza:** Histórico lista versão/data e republica com confirmação (`../../src/components/editor/versoes.tsx:28-124`); ação republica antiga como versão nova (`../../src/server/acoes.ts:342-372`). Não existe diff/prévia no componente.

**Sugestão:** antes de “Publicar vN de novo”, permitir abrir somente leitura e comparar com rascunho atual, mostrando blocos adicionados/removidos e versão que ficará no ar. **Invariante:** rollback continua criando nova versão e não altera conversas existentes. **Aceite:** usuário identifica a versão e mudanças antes da confirmação; a confirmação repete que só novas conversas usam a publicação.

### A13: Compartilhamento/exportação/importação precisam de checklist (P2)

**Evidência/certeza:** compartilhamento exige publicação, avisa conteúdo externo, tem prazo/revogação/QR e remove credenciais ao importar (`../../src/components/editor/compartilhar.tsx:20-190`; `../../src/server/acoes.ts:1046-1257`). O destino recebe rascunho sem IA/credenciais. O risco aqui é entendimento pós-importação, não vazamento confirmado.

**Sugestão:** ao importar mostrar resumo: canal, blocos que exigem conexão, variáveis/quadros/etiquetas ausentes, IA removida e gatilhos não ativos; oferecer checklist para revisar antes de publicar. No compartilhamento, destacar versão e expiração junto ao botão de copiar. **Aceite:** Given fluxo importado, Then não há CTA “publicar” sem indicar dependências pendentes; Given link expirado/revogado, Then mensagem diferencia estado e não oferece desenho.

### A14: Webhook: onboarding e rotação de segredo (P2)

**Evidência/certeza:** segredo aparece uma vez; apagar remove o webhook e seu segredo, e a rotação exige criar outro conscientemente (`../../src/components/gatilhos/webhooks-de-entrada.tsx:20-72`, `../../src/server/repos/webhooks-de-entrada.ts:120-146`); switch desligado faz chamadas retornarem 401 (`../../src/components/gatilhos/webhooks-de-entrada.tsx:174-206`); instrução HMAC/endpoint está em detalhes (`:145-164`). Isso é seguro, mas a operação de rotação é destrutiva e a tela não oferece teste/último status HTTP.

**Sugestão:** adicionar copiar segredo/URL com confirmação, teste de assinatura e status da última chamada (sucesso/401/erro), mantendo segredo irrecuperável; ao apagar, explicar dependências e sugerir pausar integração externa antes. A rotação continua sendo apagar e criar conscientemente; o código não gera outro segredo automaticamente. **Aceite:** segredo nunca reaparece; integração pode copiar endpoint e exemplo; última chamada distingue “nunca”, “autenticada” e “assinatura inválida”; desligar explica 401.

### A15: Ordenação e pastas sem gerenciamento simétrico (P2)

**Evidência/certeza:** ordenação usa botões subir/descer com teclado (`../../src/components/fluxos/ordenar.tsx:1-91`); listagem permite criar e apagar pasta e mover fluxo (`../../src/app/clientes/[clienteId]/fluxos/page.tsx:450-477`, `:628-636`; o componente de mover confirma opção “Sem pasta” e pastas do cliente (`../../src/components/editor/mover-fluxo.tsx:1-60`). Não foi encontrado renomear pasta nos componentes/ações de pasta examinados; a ação de apagar devolve os fluxos à raiz (`../../src/server/acoes.ts:1005-1027`).

**Sugestão:** oferecer renomear e mover vários quando a escala justificar; após mover, preservar filtro/posição. A exclusão deve manter a regra atual: devolve os fluxos à raiz e não apaga desenhos. **Aceite:** mover não altera publicação; ordenação continua dentro do grupo/pasta; ações possuem estado de erro recuperável.

### A16: Teste do fluxo e estados de execução (P1)

**Evidência/certeza:** confirmado o caminho completo do simulador: `Conversa` envia sessão, entrada, histórico, rascunho do grafo, `fluxoId`, contexto e flag de IA para `/api/simular` (`../../src/components/conversa.tsx:137-285`); a rota valida schema/limite, resolve acesso e executa o mesmo `executarComEfeitos` (`../../src/app/api/simular/route.ts:1-170`). A IA pode ser chamada de verdade quando habilitada; HTTP também pode chamar a internet de verdade. O simulador não persiste sessão; a sessão/variáveis ficam no navegador e são reenviadas. Variáveis iniciais usam telefone/nome de teste (`conversa.tsx:190-210`), há modo Conversa/Bastidores, mídia áudio/foto, timeout de pergunta, reset que limpa itens/sessão e recomeça (`conversa.tsx:300-430`). No link compartilhado, `/api/simular/compartilhado` lê o grafo pelo token e fecha a rede (`../../src/app/api/simular/compartilhado/route.ts:1-150`).

**Sugestão:** destacar antes de iniciar que a aba Testar usa IA e HTTP reais no fluxo salvo, enquanto o link compartilhado fecha a rede; oferecer uma opção de simulação sem efeitos para HTTP com resultado de exemplo e limite. Mostrar no modo Bastidores variáveis/arestas e o reset da sessão. **Aceite:** uma execução de teste identifica que está no simulador, nunca envia mensagem pelo WhatsApp nem persiste sessão/conversa, avisa quando IA/HTTP podem ter efeitos externos e permite localizar o bloco que falhou. Hoje há aviso explícito para HTTP (`../../src/components/conversa.tsx:535-594`), inclusive “o teste dispara de verdade”, mas não há aviso equivalente ao iniciar um fluxo com IA; isso precisa ser tratado como risco P1.

## Prioridades para implementação/validação

1. **P1:** A05 destinos não publicados; A06 edição/reordenação de sequência; A08 ações acessíveis; A16 clareza de efeitos reais no Testar.
2. **P2:** A01 busca/filtros; A02 navegação responsiva; A03 estados publicado/ligado; A04 criação unificada; A07 autosave/publicação; A09 catálogo/painel; A10 limites HTTP; A11 autonomia IA; A12 histórico comparável; A13 checklist de importação; A14 webhook; A15 pastas.
3. **P3:** nenhum refinamento cosmético foi priorizado antes das validações P1/P2.

## Lacunas desta revisão

Não foi executado navegador, leitor de tela, teste de teclado, teste de fluxo, rede, banco, produção ou carga. Não foram examinados integralmente os componentes de mensagens/mídia e a implementação visual das páginas de Respostas/Transmissões; os tickets correspondentes estão marcados como hipótese ou não examinado em vez de afirmar comportamento.

## Proposta curta de arquitetura de produto

Esta é uma recomendação baseada no código e na semântica atual, não uma validação visual. As seis abas representam quatro papéis diferentes:

- **Fluxos** é o trabalho principal: listagem, pastas, estado, ordem, vínculo e entrada no editor.
- **Modelos de chatbot** é criação. Pode continuar como aba para descoberta e busca, mas deveria também ser acessível pelo CTA **Nova automação → Em branco / Usar modelo**. Manter a URL `?aba=templates` evita quebrar links existentes.
- **Palavras-chave, Eventos e Campanhas** definem o que inicia um fluxo. Recomendo agrupá-los sob uma área “Gatilhos”, descrita como “O que inicia uma automação”, com subtabs ou filtro persistente; preservar as URLs atuais (`palavras`, `eventos`, `campanhas`). Evitar “Disparos” como nome do grupo para não confundir com envio em massa. Campanhas por anúncio/frase/link devem se distinguir de **Transmissões**, que é envio para uma audiência.
- **Sequências** é acompanhamento temporal e merece área própria, pois tem inscrições, passos e regras de janela diferentes dos disparadores.

O trade-off é reduzir a navegação inicial de seis escolhas para Fluxos, Gatilhos e Sequências, mas acrescentar um nível de navegação para quem configura um tipo específico. Modelos permanece como biblioteca acessível na criação e por link próprio; não remover a descoberta antes de garantir esse caminho. Se a mudança for adiada, pelo menos usar agrupamento visual mantendo os query params.

Na listagem, cada linha/card deve priorizar nome, canal, publicação, entrada ligada/desligada, pasta e o alerta acionável mais importante. A ação primária é abrir/editar; ligar/desligar, mover, duplicar e apagar ficam em menu secundário, mantendo ordenação visível onde ela for essencial. Alertas só devem aparecer quando há impedimento ou falha confirmada com ação possível: destino não publicado, validação pendente ou credencial necessária ausente. Número vinculado é contexto normal; só vira impedimento ao tentar excluir um fluxo que depende dele. Ausência de chamadas recentes não prova erro de integração. Não repetir todas as métricas em todo card.

No editor, a arquitetura já é adequada: catálogo à esquerda, canvas no centro e painel Bloco/Testar à direita, com painel recolhível. O contrato recomendado é deixar **salvamento automático**, **Publicar** e **Testar** sempre visíveis no cabeçalho; o painel Testar deve explicar efeitos externos antes da primeira mensagem. O catálogo pode ganhar agrupamento e busca sem alterar os 14 tipos; o canvas/painel devem conservar seleção, validação e ações contextuais existentes.
