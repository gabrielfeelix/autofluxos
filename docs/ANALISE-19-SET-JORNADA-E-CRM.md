# Análise: da entrada do contato à venda e ao relacionamento

> 19/set/2026. Complementa [a proposta chatbot-first](PROPOSTA-19-SET-CHATBOT-FIRST.md)
> a partir do esclarecimento do dono: o bot é o diferencial, mas a operação
> também pode começar diretamente no funcionário. Precisamos conectar os
> recursos para trabalhar o contato ao longo do tempo.
>
> Escopo: leitura estática do código e pesquisa em documentação de fornecedores.
> Os achados não foram reproduzidos em produção nem por testes funcionais.
> Nenhuma alteração de implementação ou banco foi feita nesta análise.
> Recomendações de produto estão identificadas como recomendações, não como
> capacidades já disponíveis ou conclusões comprovadas com clientes.
>
> **Consolidação posterior nesta mesma data:** as decisões de negócio, interface
> e entrega foram detalhadas na [proposta principal](PROPOSTA-19-SET-CHATBOT-FIRST.md)
> e no [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md). Esta análise
> permanece como fundamento e diagnóstico. Em caso de recomendação ainda aberta
> aqui, prevalece a decisão explícita da proposta revisada.

## 1. A direção: dois modos de entrada, uma operação contínua

**Recomendação:** chatbot-first como diferencial e investimento principal, com
bot opcional em cada operação. Atendimento humano direto deve ser um caminho
configurado, completo e observável.

A empresa escolhe por canal ou entrada: bot primeiro, humano primeiro ou regra
condicional. Não precisa escolher um modo exclusivo para toda a conta. Por
exemplo, dúvidas gerais vão ao bot e um anúncio específico ao consultor.

O modo humano direto deve registrar o contato, origem e mensagem, colocar na fila,
atribuir conforme a regra, sinalizar espera e permitir acompanhamento. “Nenhum
fluxo publicado” e “bot pausado” não são substitutos confiáveis dessa configuração.

Distinguir também quem inicia:

- Se o interessado já escreveu, o consultor responde à conversa recebida.
- Se chegou somente um formulário ou importação, ainda pode não existir conversa
  no WhatsApp. A primeira abordagem precisa respeitar os requisitos do canal;
  ter telefone não equivale a ter janela de atendimento aberta.

**Código:** `src/server/receber-mensagem.ts` grava a mensagem antes de avançar o
bot. `avancarConversa` retorna quando não encontra fluxo nem sessão viva. A
atribuição aparece nos caminhos de handoff e exceção; não foi demonstrada uma
jornada configurável completa de humano direto. `src/server/distribuir-atendimento.ts`
preserva o responsável existente e distribui contatos sem dono por carga.

Preservar carteira é útil, mas exige política quando o responsável está ausente:
espera, cobertura temporária ou redistribuição. Carteira comercial, responsável
pela negociação e atendente atual podem ser pessoas diferentes.

## 2. Origem, aquisição e as janelas do WhatsApp

### 2.1 Origem independe de quem atende

A origem deve ser registrada antes da decisão bot/humano. Distinguir:

| Informação | Exemplo | Cuidado |
|---|---|---|
| Canal | WhatsApp, Instagram | canal não é campanha |
| Primeira origem conhecida | primeiro anúncio identificado | preservar o histórico de aquisição |
| Nova entrada identificada | anúncio visto numa recompra | não sobrescrever a primeira origem |
| Origem da oportunidade | campanha associada à negociação atual | definir regra de atribuição; não presumir causalidade |
| Tipo de entrada | mensagem CTWA, formulário, importação | cada tipo tem implicações operacionais diferentes |

Ausência de referência de anúncio significa origem não identificada, não prova
que o contato veio organicamente. Receber anúncio também não informa sozinho o
custo de aquisição ou retorno: isso depende de gasto de mídia e vendas atribuídas.

**Achados do código:**

- `atribuirOrigem` guarda dados de `referral` e registra passagens sucessivas,
  preservando os campos de primeira origem quando já existem.
- No recebimento, `if (!contatoAtual.automacaoAtiva) return` aparece **antes** de
  `atribuirOrigem`. A mensagem fica registrada, mas esse caminho pula a atribuição
  de origem e a passagem. É uma lacuna concreta para operar com bot pausado.
- Quando não há `referral`, a função grava `Direto`. Esse rótulo é mais conclusivo
  que a evidência e merece revisão.
- `src/server/receber-lead-do-formulario.ts` importa respostas de novos contatos,
  registra o anúncio e tenta inserir no quadro padrão. Se o contato já existe,
  registra a passagem e retorna; não incorpora por esse caminho as novas respostas.
  Preservar uma correção humana não exige descartar o novo interesse: guardar a
  submissão e definir como atualizar os campos é o comportamento recomendado.

### 2.2 As 72 horas não são a duração do lead

O contato permanece na base até uma ação de remoção ou política de retenção.
Janelas da plataforma regulam mensagens e cobrança, não a existência comercial
da pessoa.

A página oficial do WhatsApp descreve a janela de atendimento de 24 horas,
renovada por mensagens do usuário, e o benefício de 72 horas para entradas
qualificadas por anúncio ou botão da Página. Não apresentar qualquer anúncio ou
formulário do Facebook como elegível automaticamente.
[Fonte oficial: preços e janelas](https://business.whatsapp.com/products/platform-pricing).

**Limite da pesquisa:** a documentação técnica detalhada da Meta retornou 429.
A documentação de fornecedores não ficou uniforme: uma tabela oficial da
Salesforce de julho/2025 distingue templates gratuitos por 72 horas de texto
livre na janela de 24 horas, e exige resposta da empresa em até 24 horas para
abrir o benefício. A página atual da 360dialog descreve texto livre também dentro
da janela gratuita. A tabela antiga não resolve sozinha o comportamento atual da
Cloud API. Não fechar essa divergência por palpite.
[Salesforce, p. 2](https://www.salesforce.com/en-us/wp-content/uploads/sites/4/assets/pdf/WhatsApp_Business-Messaging-WhatsApp-Rate_Card_Jul_1_2025-to-Jul-31-2025.pdf),
[360dialog](https://docs.360dialog.com/docs/get-started/pricing/free-vs-billed-messaging).

**Código:** `src/channels/janela.ts` libera envio pelo maior prazo entre última
mensagem + 24h e entrada do anúncio + 72h, sem receber confirmação da primeira
resposta elegível. O teste local também prevê janela aberta com anúncio e sem
última mensagem. Isso exige revisão prioritária antes de prometer autorização de
envio, duração ou gratuidade na interface.

O formulário e o CTWA usam `registrarPassagem` em
`src/server/repos/passagens.ts`, cuja entrada não distingue explicitamente esses
tipos. Auditar a derivação de `portaDeEntradaEm` e seus consumidores para garantir
que passagem de formulário não conceda benefício de conversa por anúncio.
A suspeita de classificação incorreta depende dessa verificação adicional.

Requisito de produto: mostrar separadamente **pode enviar**, **qual formato pode
enviar** e **como será cobrado**, apoiados na regra atual e no evento elegível.
Não implementar nesta revisão uma mudança de prazo com fonte incompleta.

## 3. Qualificação: dados, critérios e avaliação humana

No exemplo do dono, “Maringá” e “plano XYZ” são informações úteis coletadas. Elas
podem comprovar adequação ao negócio se os critérios forem atender Maringá e
oferecer aquele plano. Não comprovam sozinhas urgência, orçamento ou intenção de
comprar agora.

**Recomendação:** padronizar os conceitos e deixar a empresa configurar critérios.

| Conceito | Exemplo | Quem define |
|---|---|---|
| Campo | cidade, interesse, prazo desejado | gestor define estrutura; bot, integração ou pessoa preenche |
| Etiqueta | pediu retorno, evento de setembro | catálogo da empresa, aplicado conforme permissão |
| Qualificação | cidade atendida + interesse compatível | regra do processo definida pela empresa |
| Temperatura | avaliação atual de chance/urgência | humano, ou regra identificada e explicável |
| Etapa | proposta enviada | andamento daquela oportunidade |
| Valor do relacionamento | total comercial registrado | fatos comerciais e régua da empresa |
| Recência | última compra ou última interação | eventos distintos, com datas distintas |

Um cliente pode ser ouro em valor e estar com uma nova negociação fria. Um lead
pode ter dados completos e ainda não estar qualificado. Um qualificado pode querer
comprar só no ano seguinte.

### 3.1 O que o produto fornece e o que a empresa adapta

Fornecer um modelo pronto de qualificação, com critérios editáveis e estado
“ainda não avaliado”. Cada processo pode ter critérios diferentes dentro da
mesma empresa. O atendente preenche, corrige e justifica exceções; não muda o
significado de “qualificado” para toda a equipe a cada conversa.

No dado, distinguir ausente, desconhecido e resposta negativa. Mostrar quais
critérios foram atendidos e o que falta. Quando a regra mudar, explicar se os
registros atuais serão recalculados; preservar qual regra sustentou um resultado
histórico e não disparar ações em massa silenciosamente.

**Código:** existem perguntas com `salvarEm`, `salvar-campo` e bloco `etiqueta` em
`src/core/flow/schema.ts`. Campos chegam ao contato como pares de chave/valor e
aparecem no inbox em `src/components/lead/campos-coletados.tsx`. Isso oferece uma
base, mas não demonstra um catálogo tipado de campos por empresa, edição humana
completa, proveniência ou critérios compartilhados de qualificação.

O fluxo SDR atual precisa de revisão do corte de orçamento e do rótulo de
qualificado, como já descrito na proposta. A temperatura atual nasce como
`morno`; não usar esse padrão como evidência de avaliação realizada.

### 3.2 Campos da pessoa e campos da negociação

Cidade pode pertencer ao contato. Plano de interesse, prazo e orçamento podem
pertencer à negociação atual, pois a pessoa pode querer dois produtos distintos.
Coletar tudo como “último valor do contato” arrisca sobrescrever o contexto de uma
venda anterior. Definir o destino do campo no modelo e reaproveitar o que já é
conhecido sem obrigar o atendente a preencher duas vezes.

O HubSpot documenta propriedades padrão e personalizadas, com tipos e permissão
específica para criar sua estrutura. Esse é um precedente útil para separar
preenchimento operacional de configuração da empresa.
[Fonte](https://knowledge.hubspot.com/properties/create-and-edit-properties).

## 4. Segmentação: pronta para começar, personalizável para trabalhar

**Resposta recomendada à dúvida “o sistema cria ou a empresa cria?”: ambos.**

Entregar visões prontas como “sem responsável”, “aguardando retorno”,
“qualificação incompleta” e “clientes sem compra recente”, quando houver dado
suficiente. Permitir ajustar condições e salvar segmentos próprios.

Exemplo de segmento comercial: cidade = Maringá, interesse na oportunidade = XYZ,
negociação aberta, próxima ação vencida. Exemplo de relacionamento: ao menos uma
compra registrada, última compra há mais de 90 dias, sem renovação aberta.
Noventa dias é configuração ilustrativa, não padrão adequado a todo negócio.

O construtor inicial pode usar campos, operadores e grupos “todas”/“qualquer”,
com exemplos e prévia de pessoas afetadas. Não precisa nascer com linguagem de
consulta nem centenas de condições.

Distinguir três objetos na experiência:

- **Visão salva:** como a pessoa prefere trabalhar, incluindo ordenação e colunas.
- **Segmento dinâmico:** quem satisfaz condições agora, recalculado quando os dados mudam.
- **Público de uma ação:** conjunto registrado para aquele envio, com estados
  individuais; alterações posteriores na base não reescrevem os resultados.

O HubSpot documenta segmentos ativos, atualizados por filtros, e estáticos, sem
atualização automática. É uma referência para essa distinção, sem necessidade de
copiar toda a complexidade da ferramenta.
[Fonte](https://knowledge.hubspot.com/segments/change-list-type).

**Cuidado de implementação:** se o filtro for produto XYZ e negociação aberta,
as duas condições precisam alcançar a mesma negociação quando essa for a
intenção. Uma compra antiga de XYZ e uma proposta atual de outro produto não
podem satisfazer o segmento por acidente.

### 4.1 Ouro, prata e bronze

Podem ser uma régua opcional de valor, nunca a classificação universal da base.
Oferecer padrões explicados, com ajustes por empresa e base de cálculo visível:
valor vendido ou efetivamente pago, período, cancelamentos e estornos.

“Sem compra registrada” é diferente de “nunca comprou”. Sem integração e sem
histórico importado, o sistema só pode afirmar o primeiro. Essa distinção vale
para filtros, rótulos e automações.

**Código:** etiquetas próprias já existem em `src/server/repos/etiquetas.ts`.
Níveis e faixas existem em `src/core/relacionamento.ts`. A tela de contatos filtra
nível depois da paginação; o link de CSV não transporta esse filtro. Não foi
localizado um construtor geral de segmentos salvos nos caminhos revisados.
Uma segmentação para ação em lote precisa compartilhar regras entre contagem,
lista, exportação e execução, sempre respeitando o acesso do usuário.

## 5. Como o sistema sabe que vendeu e como registra recompra

Uma venda precisa chegar por uma fonte: confirmação humana, integração com
pedido/contrato ou evento transacional definido. Conversa é contexto e pode gerar
uma sugestão, mas não é confirmação automática de pagamento.

O RD descreve negociação como oportunidade associada a contatos/empresa, com
valor, proprietário e etapa, e documenta atualização desses registros via API.
O Pipedrive acompanha a transação até ganha ou perdida e permite associar
produtos e atividades. Isso sustenta separar a identidade da pessoa da tentativa
de venda. [RD: negociações](https://developers.rdstation.com/reference/crm-v2-deals),
[RD: atualização](https://developers.rdstation.com/reference/crm-v2-update-deal),
[Pipedrive: negócios](https://support.pipedrive.com/en/article/deals-what-they-are-and-how-to-add-them).

**Recomendação para AutoFluxos:** cada nova oportunidade tem identidade própria,
vinculada ao contato; um contato pode ter várias, simultâneas ou sucessivas.
Uma nova compra não é reabrir e sobrescrever a negociação ganha anteriormente.
Contato novo não exige negociação; oportunidade pode nascer automaticamente por
regra explícita ou por ação do consultor.

Exemplo: Ana tem negociação 1, plano XYZ, ganha em janeiro; negociação 2,
renovação, ganha em abril; negociação 3, novo serviço, aberta em setembro. A ficha
mostra todas e a equipe trabalha a terceira sem perder as anteriores.

Para o gesto diário, oferecer “Registrar venda”/“Concluir negociação” na ficha e
no contexto de trabalho. Reaproveitar o interesse e pedir o necessário para o
resultado: descrição do que foi vendido, data, valor quando conhecido e a
confirmação do operador. Pagamento fica separado se não foi confirmado.

### 5.1 Produto precisa ser obrigatório?

A recomendação é permitir descrição livre no começo e uma lista simples de
produtos/serviços quando a empresa precisar comparar e segmentar. Se a promessa
for “quem comprou o plano XYZ”, um identificador estável do produto deixa de ser
acessório: títulos livres como “XYZ”, “Plano X” e “xyz mensal” não garantem isso.

O item vendido preserva a descrição e o valor da época. Mudar preço ou nome no
catálogo não reescreve vendas passadas. Múltiplos itens podem entrar depois, quando
o uso exigir; catálogo comercial não obriga a construir estoque ou financeiro.

Definir “última compra” antes da automação: venda fechada, pedido confirmado ou
pagamento são datas diferentes. Escolher uma fonte por regra de negócio e
mostrar qual foi usada. Renovação automática também não deve criar uma negociação
manual para cada parcela se o objetivo é apenas reconhecer pagamentos.

### 5.2 O que falta no modelo atual

O fechamento genérico como `ganha` mistura atendimento e venda, como registrado
na proposta. O encadeamento usa conflito `quadro_id,contact_id`, o que impede nova
ocorrência por esse caminho quando o contato já está no destino. Os resumos somam
cartões ganhos; não representam ainda um livro confiável de compras recorrentes.

Corrigir significado e repetição antes de lançar alertas de recompra. Também
prever importação de histórico e a marcação de cliente preexistente sem inventar
valor, produto ou data de compra.

## 6. Permissões: padrões por responsabilidade, com escopo de registros

**Recomendação inicial**, sujeita ao perfil dos pilotos:

| Perfil | Operação permitida por padrão | Configuração |
|---|---|---|
| Dono/administrador | acompanha a conta e define acessos | equipe, regras, campos, integrações e capacidades |
| Gestor | acompanha a operação autorizada, redistribui e revisa | processos/segmentos conforme delegação |
| Operador/consultor | atende, registra dados e trabalha oportunidades autorizadas | preferências e visões pessoais |

SDR e vendedor podem usar o mesmo perfil técnico com filas e processos diferentes.
Começar com poucos perfis, sem inventar um papel para cada cargo.

Separar **ação** e **alcance**: ver, editar, atribuir, exportar, enviar em lote,
publicar bot e alterar critérios; sobre meus registros, equipe ou toda a conta.
Definir também quem vê os sem responsável. Uma visão pessoal pode ser livre,
mas publicar segmento compartilhado que dispara automações exige poder próprio.

Não basta esconder botões. Conferir as regras nas consultas, ações e exportações.
Quando há dados relacionados, a pessoa não deve obter registros fora do seu
alcance por contagens, ficha de contato ou segmentos. Registro da regra usada e
do autor ajuda a explicar alterações operacionais.

O HubSpot separa ações sobre registros e alcance próprio/equipe/todos. É um
precedente, não uma obrigação de reproduzir seu modelo comercial de planos.
[Fonte](https://knowledge.hubspot.com/records/assign-access-to-records).

**Código:** `src/server/sessao.ts` distingue participação na conta e administração
da equipe. Ações revisadas de configuração do CRM, como `acaoDefinirFaixas`, e de
transmissão exigem acesso à conta, sem demonstrar essa matriz granular. A trava
`podeResponderAgora` é coordenação operacional, permite assumir e libera em caso
de erro; não serve como fronteira de privacidade por carteira. Não afirmar que
faltam todas as permissões, nem vender isolamento por equipe antes de implementá-lo.

## 7. Sidebar e rotina: onde cada trabalho acontece

A navegação atual tem Painel, Inbox, Contatos, Funil de vendas, Automações,
Transmissões e Configurações, em `src/components/design/secoes-do-cliente.tsx`.
O principal problema encontrado não é a quantidade de abas: são decisões e dados
que não atravessam a jornada inteira.

**Organização recomendada para validar:**

| Lugar | Trabalho que precisa entregar |
|---|---|
| Inbox | atender e agir sobre o contato sem perder a conversa |
| Contatos | ficha única, histórico, clientes, segmentos e visões salvas |
| Negociações/processos | oportunidades, etapas, valor, responsável e próxima ação |
| Automações | bots, entradas, regras e sequências; dependências e estado visíveis |
| Transmissões | preparar público, enviar e acompanhar resultados |
| Painel | resultados e pendências por objetivo |
| Configurações | campos, critérios, catálogo, equipe, acesso e integrações |

Os rótulos definitivos dependem de teste. Não transformar cada filtro em nova aba
nem adicionar tela sem comportamento pronto. Uma entrada de Clientes pode começar
como visão de Contatos; merece seção própria se a rotina justificar.

### 7.1 A peça comercial que falta explicitar: próxima ação

Para trabalhar leads frios, só segmentar não basta. Depois de encontrar Ana, o
consultor precisa registrar “ligar amanhã às 10h”, saber quem fará isso e concluir
ou reagendar. Negociações abertas devem expor responsável e próximo passo, sem
obrigar tarefa fictícia para cada contato da base.

O repositório tem `src/server/repos/tarefas.ts`, mas ele é fila de execução da
máquina. Há mensagens agendadas e adiamento de conversa; isso não demonstra uma
agenda de atividades comerciais com dono, prazo e conclusão. Definir uma camada
mínima de atividades, ligada ao contato e opcionalmente à oportunidade, antes de
prometer gestão completa da rotina de vendas.

A forma de iniciar a ação pode ser simples: abrir o contato filtrado, responder,
registrar o resultado e escolher a próxima ação no mesmo contexto. Recursos
avançados não devem obrigar todo operador a ir às configurações.

## 8. Simples no início, configurável conforme a necessidade

Não há dados nesta análise para concluir que todos os clientes querem simplicidade
ou que todos querem parametrização profissional. A recomendação é oferecer três
profundidades sobre os mesmos dados:

1. **Começar:** modelos, campos essenciais, filas e segmentos úteis prontos.
2. **Ajustar:** editar critérios, etapas, produtos, responsáveis e filtros.
3. **Avançar:** combinar condições, integrar sistemas e delegar capacidades.

Não são três produtos nem modos que exigem migração. Um usuário pode operar só
a primeira camada enquanto o gestor configura a terceira. Padrões explicados e
editáveis permitem aprender sem fechar o caminho de crescimento.

E-mail marketing fica fora da entrega atual, conforme pedido do dono. Contatos,
campos, públicos e eventos podem ser reutilizados depois; não construir agora
infraestrutura de disparo de e-mail para justificar uma segmentação útil hoje.

## 9. Prioridades e testes de uma jornada vendável

| Prioridade | Entrega | Como comprovar |
|---|---|---|
| P0 | origem independente do bot; humano direto; revisão das janelas | entrada por anúncio com bot pausado preserva referência; fila recebe responsável ou espera visível; formulário não abre janela indevida |
| P0 | separar resultado operacional de venda; permitir novas oportunidades | qualificação não soma compra; duas vendas no mesmo funil ficam distintas; repetição técnica não duplica venda |
| P1 | campos e critérios por empresa/processo | bot e funcionário usam a mesma informação; Maringá + XYZ explicam o resultado; correção não apaga histórico |
| P1 | permissões de configuração e operação | operador preenche, mas não muda regra global sem delegação; consultas e exportações respeitam o escopo prometido |
| P1 | segmentos salvos e próxima ação | encontrar, trabalhar e acompanhar o grupo sem planilha auxiliar; contagem, lista e ação alcançam o mesmo universo |
| P2 | relacionamento por compra e produto | recomprou sai da régua pertinente; sem histórico aparece como desconhecido; cancelamento tem efeito definido |
| Posterior | e-mail e análises avançadas | necessidade e fontes de dados validadas antes de ampliar o canal |

Essas prioridades refinam a sequência da proposta. P0 não autoriza mudanças em
produção; regras de banco compartilhado continuam valendo. Dividir o trabalho em
jornadas entregáveis, sem esperar todas as personalizações avançadas para validar
o atendimento básico.

Cenário de referência, derivado do exemplo do dono:

1. Uma pessoa chega de anúncio; origem e contato são registrados.
2. A entrada pode chamar o consultor diretamente ou coletar cidade e interesse.
3. Critérios da empresa indicam qualificação, com motivo e dados faltantes.
4. O consultor recebe contexto, registra a oportunidade e uma próxima ação.
5. Uma venda é confirmada com fonte e dados comerciais explícitos.
6. A próxima negociação é um novo registro do mesmo contato.
7. Um segmento encontra clientes sem compra recente, excluindo quem já renovou.
8. A equipe age e o histórico registra o resultado sem duplicar compras ou contatos.

A venda do produto deve acompanhar o que essa jornada comprova. Não prometer CRM
completo por ter um kanban, segmentação automática por ter etiquetas ou atendimento
humano direto por deixar um bot desligado.
