# Inventário e revisão: Transmissões e Conexões

Data: 2026-09-23. Leitura estática local, sem envio, rede, produção ou
mutação.

## Transmissões

### Inventário

`/clientes/[clienteId]/transmissoes` é uma tela com duas abas por query
(`aba=modelos|transmissoes`), fallback de valor desconhecido para `modelos` e
Suspense por aba (`src/app/clientes/[clienteId]/transmissoes/page.tsx:30-70`).

**Modelos aprovados** (`ListaDeTemplates`) lista status Rascunho, Em análise na
Meta, Aprovado, Recusado, Pausado e Desativado; mostra motivo de recusa e abre
`NovoModelo`; apagar exige confirmação e informa retenção do nome por 30 dias
(`src/components/transmissoes/lista-de-templates.tsx:23-44,80-105`).

**Transmissões** (`ListaDeTransmissoes`) lista estados Rascunho, Agendada,
Enviando, Concluída, Cancelada e Parou, progresso entregue/retida/falha e abre
`NovaTransmissao`; sem modelo aprovado mostra pré-requisito. Cancelar é permitido
em rascunho/agendada/enviando e informa quantas já saíram
(`src/components/transmissoes/lista-de-transmissoes.tsx:32-73,112-135`).

**Criação:** `NovaTransmissao` seleciona público/filtros, modelo aprovado,
horário e nome; a ação server valida e cria/agendata. **Edição:** o fluxo atual
não oferece edição de transmissão; a operação disponível após criar é acompanhar
o status ou cancelar. O rascunho interno é transitório, conforme T01. **Status:**
feedback de progresso é por linha e motivos ficam visíveis; **cancelamento:**
confirmação explícita, mensagem posterior e refresh.

### T01: `rascunho` é estado técnico transitório, não uma jornada perdida

**Atual/evidência:** `criarTransmissao` grava `estado: 'rascunho'`
(`src/server/repos/transmissoes.ts:127-155`), mas `acaoCriarTransmissao`
enfileira destinatários e muda para `agendada` na mesma ação
(`src/server/acoes-transmissoes.ts:452-466`). A UI cria pela ação
`acaoCriarTransmissaoPorEtiqueta` (`src/server/acoes-transmissoes.ts:537-559`) e não
persiste uma interrupção entre esses passos.
(`src/components/transmissoes/lista-de-transmissoes.tsx:138-200`).

**Impacto:** nenhum problema de jornada foi demonstrado: `rascunho` é etapa
técnica e a tela só precisa tratar registros deixados por falha entre inserts.

**Solução:** não criar editor de rascunho sem evidência de necessidade. Se uma
falha deixar rascunho persistido, exibir estado de recuperação ou limpeza
administrativa antes de oferecer “Continuar”.

**Dependências:** ação/repositório precisam expor leitura dos campos do rascunho.

**Aceite:** Given criação normal, Then o registro aparece como `agendada`; Given
falha entre gravação e fila, Then o registro não é apresentado como campanha
enviável sem público e existe diagnóstico para operação.

### T02: Status “Parou” e “retida” precisam de decisão orientada

**Atual/evidência:** `retida` recebe linha própria para não contar como entregue
(`lista-de-transmissoes.tsx:19-29`), e falha mostra motivo; o usuário ainda
precisa interpretar o que fazer depois.

**Impacto:** “Parou” pode significar falha transitória, modelo pausado ou fila
cancelada; a operação seguinte não é evidente.

**Solução:** para cada motivo, mostrar próxima ação contextual: revisar modelo,
aguardar Meta, criar novo modelo ou exportar relatório. Preservar distinção
numérica entre entregue, retida e falha.

**Aceite:** Given transmissão parada por modelo pausado, Then CTA leva à aba do
modelo e explica que retidas não foram entregues; Given falha sem ação possível,
Then texto diz que não há retry automático.

### T03: Prévia existe, mas o consumo diário exibido começa em zero

**Atual/evidência (confirmado; relacionado a C10):** `NovaTransmissao` concentra
seleção de público, modelo, horário e nome, calcula contagem do público, mostra
prévia da mensagem e exibe o veredito de limite antes de confirmar
(`src/components/transmissoes/nova-transmissao.tsx:132-147,233-241,261-336`).
Porém, a prop `jaEnviadasHoje` é passada como `0` na abertura do formulário
(`src/components/transmissoes/nova-transmissao.tsx:142-147`), e a action também
assume zero quando ausente (`src/server/acoes-transmissoes.ts:441-448`).

**Impacto:** a prévia de mensagem e público é útil, mas o limite diário pode
parecer totalmente disponível mesmo após transmissões no dia. Isso permite uma
decisão incorreta antes de confirmar e deixa a proteção dependente de um valor
otimista (C10).

**Solução:** buscar o consumo real do dia ao abrir/alterar o público e recalculá-lo
no servidor na confirmação, preservando a prévia existente. Exibir restante,
limite atingido e motivo em linguagem humana.

**Aceite:** Given uma conta com transmissões já aceitas no dia, When abrir ou
alterar o público, Then o restante e o bloqueio/aviso refletem o consumo real;
Given concorrência entre prévia e confirmação, When enviar, Then a action
recalcula o limite antes de criar e explica o resultado sem apagar a prévia.

## Conexões

### Inventário

`/clientes/[clienteId]/ajustes/integracoes` tem abas `Conectadas (N)` e
`Disponíveis (N)`, escolhe automaticamente conectadas quando existem e cards
podem ser link ou informativos conforme tenham tela
(`src/app/clientes/[clienteId]/ajustes/integracoes/page.tsx:150-255`).

`/ajustes/whatsapp` permite conectar número, desconectar, escolher fluxo por
quatro papéis/situações e copiar webhook. Exibe estados sincronizando, travado,
desembarcado, pronto e progresso importado
(`src/app/clientes/[clienteId]/ajustes/whatsapp/page.tsx:386-620`).

`/ajustes/instagram` conecta/desliga conta e exibe estado de app review
(`src/app/clientes/[clienteId]/ajustes/instagram/page.tsx:80-189`).

`/ajustes/anuncios` conduz Facebook, token de Ads e páginas ligadas; mostra
pré-requisitos/avisos antes dos formulários (`src/app/clientes/[clienteId]/ajustes/anuncios/page.tsx:57-228`).

`/ajustes/chaves` cria conexões API, troca valor, apaga e liga Agenda; campos
incluem nome, URL, header/campo e segredo, com teste de conexão separado
(`src/app/clientes/[clienteId]/ajustes/chaves/page.tsx:87-256`).

`/ajustes/integracoes/magento` testa, conecta/desconecta token e liga/desliga a
loja (`src/app/clientes/[clienteId]/ajustes/integracoes/magento/page.tsx:25-69`).

### T04: “Disponíveis” inclui integrações sem tela e não explica o próximo passo

**Atual/evidência:** card sem `href` é informativo, inclusive quando `emBreve`,
enquanto card com `href` navega (`integracoes/page.tsx:229-255`).

**Impacto:** disponibilidade, conexão e “em breve” podem parecer o mesmo estado.

**Solução:** CTA textual por estado (“Conectar”, “Configurar”, “Em breve”),
descrição da dependência e categoria visível (canal, API, comércio, anúncios).

**Aceite:** Given integração sem tela, Then CTA não promete ação; Given Magento
disponível, Then o card abre configuração e informa token/teste.

### T05: WhatsApp mistura saúde do canal, importação histórica e configuração de fluxos

**Atual/evidência:** no mesmo cartão há status de conexão, importação de
conversas, avisos de Meta, botão desconectar, modal de fluxos e webhook
(`whatsapp/page.tsx:402-620`).

**Impacto:** diagnóstico e configuração competem; o usuário pode alterar fluxo
enquanto a conexão ainda está sincronizando.

**Solução:** manter uma tela, mas separar “Estado da conexão”, “O que o bot
responde” e “Webhook”; desabilitar apenas controles que realmente dependem de
sincronização e explicar o motivo.

**Aceite:** Given sincronização em curso, Then progresso fica no bloco de estado
e a configuração de fluxo continua claramente independente; Given conexão caída,
Then CTA de reconectar aparece no bloco de saúde.

### T06: Chaves de API não mostra claramente ciclo de teste, rotação e remoção

**Atual/evidência:** há criar, trocar valor, apagar e teste de Agenda
(`chaves/page.tsx:149-199,211-256`), mas ações aparecem em uma lista única.

**Impacto:** rotação pode ser confundida com edição destrutiva; apagar uma chave
ativa pode interromper integração sem resumo de impacto.

**Solução:** mostrar estado “ativa/testada/nunca testada”, separar “Trocar segredo”
de “Excluir conexão” e confirmar dependências conhecidas antes de remover.

**Aceite:** Given chave ativa, Then trocar segredo informa que o valor anterior
deixa de valer; Given exclusão, Then confirmação identifica a conexão e o efeito.

## Regras a preservar

- Modelo aprovado é pré-requisito para transmissão; não oferecer transmissão
  funcional sem ele.
- `retida` não pode ser somada a entregue; motivo da Meta deve continuar visível.
- Cancelamento informa mensagens já enviadas e não promete desfazê-las.
- Abas e filtros devem manter URL compartilhável e sobreviver a refresh.
- Conexões devem distinguir conectada, reconectar, vence em breve, disponível e
  em breve.

## Prioridade

- **P1:** T02 e T05, diagnóstico de envio e clareza
  do canal principal.
- **P2:** T03, T04 e T06, validação de volume no envio, estados de integração e
  ciclo de vida de chaves. T01 fica como regra preservada, sem ticket de produto.
- **P3:** refinamento de cópia, categorias e ordenação dos cards.
