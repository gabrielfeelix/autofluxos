# Revisão UX/UI: estrutura de organização, papéis e navegação

Data: 2026-09-23  
Escopo: leitura de código, testes e rotas locais; nenhuma alteração de produto,
banco ou produção foi feita. O working tree já tinha alterações anteriores, que
foram preservadas.

## Mapa observado

Há três conceitos que hoje convivem e se sobrepõem na interface:

1. **Conta/organização:** uma linha `af_membros` liga a pessoa a uma conta e
   usa os papéis técnicos `owner`, `admin` e `member` (`src/core/permissoes.ts:142-155`).
2. **Permissão operacional:** cada papel recebe capacidades (`atender`,
   `configurar_operacao`, `registrar_venda` etc.) e escopos (`nenhum`, `proprios`,
   `equipe`, `todos`). Sobrescritas por pessoa e equipes são calculadas em
   `src/core/permissoes.ts:245-290` e carregadas por
   `src/server/permissoes.ts:51-111`.
3. **Plataforma 4YU:** `af_usuarios.role` contém `admin`; esse administrador
   passa pela área `/admin` e, ao atuar numa conta, recebe acesso total sem ser
   membro (`src/server/sessao.ts:20-28, 96-113, 227-269`).

O caminho visível para uma pessoa de conta é `Configurações → Equipe`
(`src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:84-97`). O papel é
escolhido como “Atende”, “Administra” ou “Dona da conta”
(`.../equipe/page.tsx:19-23`); o botão **Acesso** abre um modal com os modelos
“Gestor” e “Operador”, equipes, oito capacidades e escopos
(`src/components/conta/editor-de-acesso.tsx:167-247`).

## Achados

Os graus abaixo significam: **alto** = pode causar acesso indevido, bloqueio de
trabalho ou decisão estrutural errada; **médio** = confunde a jornada ou torna
uma regra difícil de descobrir; **baixo** = polimento e consistência.

### E1: “Gestor” e “Operador” parecem papéis persistentes, mas são modelos temporários

**Evidência:** o código chama `MODELOS_EXTRA` de modelos, aplica-os apenas como
sobrescritas e mantém o papel técnico em `owner/admin/member`
(`src/core/permissoes.ts:218-239`; `src/server/acoes-acesso.ts:105-146`). A UI
oferece botões “Gestor” e “Operador” e diz que são ponto de partida
(`src/components/conta/editor-de-acesso.tsx:176-187`).

**Certeza:** alta. **Impacto:** médio/alto; uma pessoa pode entender que
“Gestor” será exibido, auditado e reutilizável como seu papel, mas depois do
salvamento só há uma mistura de `member` com exceções.

**Proposta:** separar visualmente “papel” de “perfil de acesso” e apresentar
somente nomes humanos (“acesso de gestão”, “acesso de atendimento”, “acesso
personalizado”). Gestor/Operador podem continuar como presets internos, mas não
devem aparecer como cargo. Critério: após salvar, a pessoa vê um resumo humano
estável do que pode fazer; reabrir o editor mantém o mesmo resumo.

### E2: “Administra” e “administrador da plataforma” usam a mesma palavra para fronteiras diferentes

**Evidência:** a conta mostra “Administra” para o papel `admin`
(`src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:19-23`), enquanto a área
global usa `admin` de plataforma e selo “admin”
(`src/app/admin/layout.tsx:26-32`; `src/server/sessao.ts:20-28`).

**Certeza:** alta. **Impacto:** alto; o usuário não consegue inferir se
“administra” permite todas as contas, uma conta ou somente a equipe.

**Proposta:** adotar termos distintos e sempre qualificados: “Administrador da
conta” e “Administrador 4YU (plataforma)”. Critério: nenhuma tela usa “admin”
sozinho para os dois escopos; o cabeçalho da conta informa “papel nesta conta”.

### E3: `member` é traduzido como “Atende”, mas sua política atual é ampla

**Evidência:** a UI chama `member` de “Atende” (`.../equipe/page.tsx:19-21`),
mas `POLITICAS.member` concede operação, atendimento, criação, registro,
valores e exportação em escopo `todos` (`src/core/permissoes.ts:207-215`). O
modelo restrito “Operador” não é o padrão (`src/core/permissoes.ts:164-179`).

**Certeza:** alta. **Impacto:** alto; o rótulo sugere atendente limitado, mas a
regra efetiva pode permitir registrar venda e exportar a conta inteira.

**Proposta:** escolher uma semântica explícita: ou renomear para “Membro
legado, acesso amplo” durante a migração, ou migrar com prévia para um papel
restrito. Critério: o texto de cada papel deve corresponder ao conjunto efetivo
de capacidades e escopos mostrado na prévia.

### E4: O papel da conta e o acesso efetivo ficam em controles separados, sem resumo na lista

**Evidência:** cada linha tem um dropdown de papel e um botão separado
“Acesso” (`src/components/conta/linha-da-equipe.tsx:107-132`); a prévia só
aparece dentro do modal (`src/components/conta/editor-de-acesso.tsx:254-297`).

**Certeza:** alta. **Impacto:** médio; o administrador precisa abrir pessoa por
pessoa para saber quem pode ver valores, exportar ou atuar em toda a conta.

**Proposta:** adicionar na linha um resumo de acesso efetivo e alertas (“toda a
conta”, “sem acesso”, “2 equipes”), com acesso ao detalhe. Critério: a lista
permite identificar em uma passada quem é operador, gestor, administrador e
quem tem exceções.

### E5: “Equipe” mistura membros da conta, times de escopo e distribuição do Inbox

**Evidência:** a mesma página contém entrada de pessoas, edição de papel,
equipes de escopo e `Distribuicao` (`src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:100-193`).
O texto ainda diz que quem não está na lista não aparece para assumir conversa
(`.../equipe/page.tsx:93-97`).

**Certeza:** alta. **Impacto:** médio; “equipe” pode significar organização,
grupo de permissão ou fila operacional.

**Proposta:** nomear a página “Pessoas e acesso” e separar blocos com tarefas
claras: Pessoas, Grupos de escopo e Distribuição do atendimento. Critério: um
novo usuário entende onde adicionar alguém, onde formar um time e onde mudar o
rodízio sem ler a descrição inteira.

### E6: O fluxo de adicionar pessoa exige senha compartilhada e não oferece convite

**Evidência:** o formulário informa “A senha é definida aqui e combinada por
fora, ainda não há convite por e-mail” (`src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:104-110`),
com campo de senha no mesmo modal (`.../equipe/page.tsx:114-150`).

**Certeza:** alta. **Impacto:** alto para jornada e segurança; a administração
precisa transportar segredo por outro canal e a pessoa não inicia uma conta
própria de forma clara.

**Proposta:** priorizar convite com aceite e criação de senha própria; enquanto
isso não existir, tornar o estado explícito (“acesso provisório”), exigir
troca no primeiro acesso e registrar o próximo passo. Critério: nenhuma senha
de usuário precisa ser copiada ou compartilhada manualmente.

### E7: O menu global sempre mostra seções; capacidade não determina descoberta

**Evidência:** `secoesVisiveis` filtra apenas o recurso CRM, não permissões
(`src/components/design/secoes-do-cliente.tsx:96-121`); `ClienteShell` usa essa
lista para montar a barra (`src/components/design/cliente-shell.tsx:68-92`).
As ações verificam capacidades no servidor (`src/server/permissoes.ts:166-197`),
mas a navegação não recebe o mapa de acesso.

**Certeza:** alta. **Impacto:** médio; pessoas podem clicar em telas que não
podem usar, enquanto a UI promete que a pessoa “não vê a tela dela”
(`src/components/conta/editor-de-acesso.tsx:167-173`).

**Proposta:** derivar itens de menu de uma matriz de capacidade, com estados
oculto/desabilitado conforme a decisão de produto. Critério: para cada item,
usuário permitido o abre; usuário proibido não é convidado a tentar ou recebe
explicação consistente, e a ação continua protegida no servidor.

### E8: Rota de conta pode ser alcançada mesmo quando CRM some do menu

**Evidência:** o código documenta que `/quadros` continua respondendo quando o
item é ocultado e que ocultar não revoga acesso (`src/components/design/secoes-do-cliente.tsx:108-116`).

**Certeza:** alta. **Impacto:** médio; “CRM desligado” e “sem capacidade” são
estados diferentes, mas a jornada não os explica.

**Proposta:** criar tela de estado para recurso desligado e autorização separada;
links antigos devem informar se o recurso está desligado ou se a pessoa não
tem acesso. Critério: a mesma URL nunca exibe uma tela funcional para um caso e
uma ausência silenciosa para outro.

### E9: Admin de plataforma entra em contas sem papel de membro, e a UI só sinaliza por faixa

**Evidência:** `conferirAcessoAoCliente` libera admin de plataforma com papel
nulo (`src/server/sessao.ts:227-269`); `regrasDe` dá acesso total sem consultar
equipes (`src/server/permissoes.ts:72-86`); a conta mostra “administrador 4YU”
no rodapé (`src/components/design/cliente-shell.tsx:178-205`).

**Certeza:** alta. **Impacto:** alto; a diferença entre operar como suporte e
agir como membro da conta precisa ser inequívoca para evitar alterações sem
intenção.

**Proposta:** tornar “Acesso de suporte 4YU” um modo explícito, com faixa
persistente e contexto da conta; manter a identidade real do administrador e
registrar no histórico que a ação foi feita por suporte. Critério: em qualquer
tela, o administrador sabe que está operando uma conta como suporte, qual conta
é, e a auditoria identifica a pessoa real.

### E10: O destino inicial diverge por tipo de identidade, sem uma explicação de contexto

**Evidência:** admin de plataforma vai para `/admin/contas`; pessoa com uma conta
vai direto para `/clientes/:id`; várias contas vão para `/contas`
(`src/server/sessao.ts:203-221`).

**Certeza:** alta. **Impacto:** médio; “conta”, “painel” e “admin” são portas
iniciais distintas, difíceis de explicar em onboarding e suporte.

**Proposta:** usar um seletor/painel comum com contexto de papel, mantendo atalhos
para o caso de uma conta. Critério: após login a pessoa identifica “onde estou”
e “qual conta posso trocar” sem depender de URL.

### E11: O seletor de conta desaparece para quem tem uma conta, então a confirmação de contexto é passiva

**Evidência:** `SeletorDeConta` só vira link quando `outrasContas > 1`; com uma
conta renderiza um `div` (`src/components/design/cliente-shell.tsx:169-205`).

**Certeza:** alta. **Impacto:** baixo/médio; reduz atrito, mas deixa o nome da
conta como texto sem ação nem caminho para entender organização/perfil.

**Proposta:** manter o atalho sem seletor quando há uma conta, mas oferecer
“Conta e perfil” no mesmo local e explicitar papel, organização e saída. Critério:
o usuário consegue acessar perfil e ajuda sem procurar outro menu.

### E12: A autorização de página não é uniforme entre configuração, operação e ações (hipótese)

**Evidência:** algumas páginas exigem capacidade (`configurar/page.tsx:1-14`,
`ajustes/recursos/page.tsx`), enquanto equipe usa `podeAdministrarConta`
(`ajustes/equipe/page.tsx:30-32`) e o shell só exige acesso à conta. A matriz
existe, mas a escolha de fronteira muda por tela.

**Certeza:** média (hipótese de UX; a leitura estática não demonstrou uma rota
concreta em que a diferença produza recusa tardia). **Impacto:** médio se houver
uma página que carregue conteúdo editável antes da recusa; baixo enquanto as
ações recusarem corretamente no servidor.

**Proposta:** testar a matriz rota por rota e só uniformizar onde houver
diferença observável entre conteúdo exibido e ação permitida. Critério: para
cada tela revisada, o comportamento de leitura e mutação é documentado e não há
promessa de edição antes da recusa.

### E13: A lista de capacidades usa verbos técnicos, mas não organiza a jornada por responsabilidade

**Evidência:** o modal apresenta oito linhas em sequência (`src/components/conta/editor-de-acesso.tsx:219-247`),
incluindo “configurar a empresa”, “configurar a operação”, “ler valores” e
“exportar e transmitir”.

**Certeza:** alta. **Impacto:** médio; o administrador precisa traduzir uma
matriz extensa em tarefas de consultor, gestor e atendente.

**Proposta:** começar por perfis de trabalho orientados a resultado (ex.: gestão
da conta, gestão comercial, atendimento, consulta) e revelar a matriz detalhada
como “ajustes avançados”. Critério: aplicar um perfil produz resumo compreensível
e o modo avançado permite conferir cada capacidade sem perder a prévia.

### E14: “Só o que é dela” e “da equipe dela” dependem de equipes, mas a relação causal fica escondida

**Evidência:** a tela avisa apenas no painel lateral quando há escopo de equipe
sem equipe (`editor-de-acesso.tsx:279-283`) e a página de equipes explica que
sem equipe o escopo não alcança nada (`gerenciar-equipes.tsx:91-95`).

**Certeza:** alta. **Impacto:** médio; uma configuração válida pode resultar em
fila vazia e parecer defeito do Inbox.

**Proposta:** mostrar o escopo efetivo diretamente na pessoa e bloquear ou guiar
“salvar” quando o escopo exige uma equipe ausente. Critério: a pessoa entende,
antes de salvar, quantos registros poderá alcançar ou que a configuração resulta
em zero.

### E15: Remoção e arquivamento não completam a decisão de destino das atribuições

**Evidência:** a interface conta conversas e cartões pendentes e oferece
“Reatribua antes” (`src/components/conta/linha-da-equipe.tsx:63-88`), mas a ação
de remoção continua sendo uma confirmação separada. Equipes são arquivadas e
deixam membros sem escopo (`src/components/conta/gerenciar-equipes.tsx:45-56`).

**Certeza:** alta. **Impacto:** alto operacional; a pessoa pode confirmar e
deixar referências sem responsável ou usuários sem acesso efetivo.

**Proposta:** transformar a remoção em fluxo com destino obrigatório (fila,
responsável ou manter atribuição), e arquivamento de equipe em fluxo que mostra
quem perderá escopo. Critério: não há confirmação final sem destino escolhido e
o resultado é visível na prévia.

### E16: Área administrativa global não explica o limite entre suporte, contas e auditoria

**Evidência:** menu global lista apenas “Contas”, “Usuários”, “Consumo”,
“Auditoria” e “Alertas” (`src/components/conta/navegacao-admin.tsx:20-25`),
enquanto `/admin` redireciona para contas (`src/app/admin/page.tsx:11-19`).

**Certeza:** média/alta. **Impacto:** médio; para um operador 4YU, não fica
claro se Usuários gerencia identidade global ou acesso por organização, nem se
Auditoria é da plataforma ou de uma conta.

**Proposta:** agrupar por objetivo (“Operação 4YU”, “Identidades”, “Segurança”) e
mostrar escopo em cada título. Critério: cada tela responde no cabeçalho “escopo
da plataforma” ou “escopo da conta”, sem depender do caminho.

## Hub de Configurações e subpáginas

O hub é montado por `GRUPOS` em `src/components/design/itens-de-ajustes.ts:19-66`
e renderizado por `AjustesShell` (`src/components/design/ajustes-shell.tsx:24-39`).
Hoje há 17 entradas: Visão geral; Canais (WhatsApp, Instagram); Atendimento
(Conhecimento da IA, Horário de atendimento, Respostas rápidas, Etiquetas,
Catálogo, Arquivos e mídias); Integrações (Todas as integrações, Captação por
anúncios, Chaves de API); Conta (Dados da empresa, Equipe, Personalizar sistema,
Plano e consumo). As rotas confirmadas incluem `negocio`, `contexto`, `horario`,
`retomada`, `respostas-rapidas`, `recursos`, `whatsapp`, `instagram`, `acervo`,
`integracoes`, `anuncios`, `chaves`, `equipe` e `plano`.

### E17: “Atendimento” mistura conteúdo do bot com operação do canal

**Evidência:** `contexto`, `horario`, `respostas-rapidas`, `etiquetas`,
`produtos` e `acervo` ficam juntos em Atendimento (`itens-de-ajustes.ts:31-39`),
embora Conhecimento e Horário configurem automação, Respostas rápidas possa ser
usada por pessoas, e Etiquetas, Catálogo e Arquivos sejam dados de apoio ao
atendimento/CRM.

**Certeza:** alta. **Impacto:** médio; quem procura “arquivos”, “catálogo” ou
“respostas rápidas” precisa conhecer a taxonomia interna para saber onde ficam
as ferramentas de atendimento e CRM.

**Proposta:** manter a entrada “Atendimento”, mas dividir visualmente em
“Automação de resposta” (Conhecimento, Horário, Retomada) e “Ferramentas e
conteúdo do atendimento” (Respostas rápidas, Etiquetas, Catálogo, Arquivos e
mídias). Critério: cada subgrupo contém apenas tarefas da mesma intenção, sem criar novas
rotas.

### E18: “Canais”, “Integrações” e “Captação por anúncios” competem pelo mesmo conceito

**Evidência:** WhatsApp/Instagram aparecem em Canais, enquanto “Todas as
integrações”, anúncios e chaves aparecem em Integrações
(`itens-de-ajustes.ts:24-29,42-48`); as páginas de canal têm rotas próprias e a
visão geral de integrações também existe.

**Certeza:** alta. **Impacto:** médio; “conectar Instagram”, “integrações” e
“captação” são buscas plausíveis para a mesma tarefa.

**Proposta:** manter “Canais” para WhatsApp/Instagram e renomear Integrações
para “Conexões e APIs”, com “Todas as conexões”, “Anúncios” e “Chaves de API”.
Critério: quem procura conectar um canal encontra uma única porta principal e
entende que anúncios/API são conexões auxiliares.

### E19: “Personalizar sistema” esconde o objetivo funcional de Recursos

**Evidência:** o item `recursos` é rotulado “Personalizar sistema”
(`itens-de-ajustes.ts:51-64`), mas a página controla objetivo da conta e ativação
do CRM (`src/app/clientes/[clienteId]/ajustes/recursos/page.tsx:1-38`).

**Certeza:** alta. **Impacto:** médio; “personalizar sistema” é amplo e não
antecipa que ali se decide vender/atender e ativar recursos.

**Proposta:** renomear para “Objetivo e recursos” e explicar que a tela define
como a conta trabalha e quais módulos ficam ativos. Critério: quem quer ativar o
funil ou mudar o objetivo encontra a página pelo rótulo.

### E20: “Equipe” concentra pessoas, grupos de escopo e distribuição

**Evidência:** esses três trabalhos ficam na mesma página
(`src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:84-193`).

**Certeza:** alta. **Impacto:** médio; “equipe” pode significar organização,
grupo de permissão ou fila operacional.

**Proposta:** manter a rota, mas renomear a entrada para “Pessoas e acesso” e
separar blocos “Pessoas”, “Grupos de escopo” e “Distribuição do atendimento”.
Critério: adicionar alguém, montar um grupo e alterar o rodízio ficam claramente
distintos.

### E21: “Retomada” é uma rota legada que redireciona para Horário

**Evidência:** a rota `src/app/clientes/[clienteId]/ajustes/retomada/page.tsx:1-17`
faz redirect para `/ajustes/horario`; `TelaDeAjustes` e `GRUPOS` não incluem
`retomada` (`src/components/design/itens-de-ajustes.ts:1-18,19-66`).

**Certeza:** alta. **Impacto:** baixo; o endereço antigo é preservado e cai na
configuração atual, portanto não há tela órfã.

**Proposta:** manter fora do índice e preservar o redirect. Se “retomada” for
uma intenção que usuários procuram, adicionar “retomada” como sinônimo de
Horário na busca, sem criar item duplicado. Critério: link antigo continua
chegando à tela correta e a busca por “retomada” encontra Horário.

### E22: Configurações frequentes e ocasionais têm o mesmo peso visual

**Evidência:** “Plano e consumo”, “Chaves de API”, “Arquivos e mídias” e
“Horário de atendimento” convivem como itens equivalentes no índice
(`itens-de-ajustes.ts:24-64`).

**Certeza:** média. **Impacto:** baixo/médio; a lista cresce e tarefas
episódicas competem com configurações recorrentes.

**Proposta:** manter todas as rotas, mas separar “Configuração do dia a dia” de
“Configuração avançada e conexões”. Já existe busca textual em
`src/components/design/menu-de-ajustes.tsx:12-24`; ampliar seus sinônimos ao
renomear grupos. Critério: tarefas frequentes aparecem antes das ocasionais e
todas continuam encontráveis pela busca.

## Resposta explícita sobre “consultor”

Não há jornada de consultor implementada. O termo não aparece como papel,
modelo, rótulo de equipe ou destino de navegação no conjunto revisado. Quem o
negócio chamaria de consultor hoje teria de ser adicionado como membro e
configurado manualmente, ou receber um preset Gestor/Operador; isso não cria um
perfil consultor nem uma tela própria. Se for uma persona necessária, deve ser
definida como perfil humano de acesso e aparecer no resumo da equipe, sem expor
`member` ou a matriz técnica.

## Critérios de aceite transversais

- Uma pessoa que administra uma conta consegue distinguir conta, equipe de
  escopo, papel e capacidade em uma única jornada.
- “Gestor”, “consultor” ou “operador” só aparecem como cargo se forem realmente
  persistidos; caso sejam presets, a UI diz isso e mostra o acesso efetivo.
- O administrador da plataforma é claramente identificado quando está dentro de
  uma conta, e a entrada sem membro é auditável.
- Menu, página, consulta e Server Action comunicam a mesma decisão de acesso;
  o menu não é tratado como fronteira de segurança.
- Remover pessoa ou arquivar equipe exige resolver atribuições e mostra o efeito
  antes da confirmação.

## Prioridade sugerida

1. **P1:** resolver E2, E3, E7 e E9, porque misturam fronteira de
   autorização com descoberta e podem induzir acesso ou bloqueio inesperado.
2. **P2:** resolver E1, E4, E5, E6, E14, E15, E17, E18, E19 e E21, para tornar a jornada de gestão
   executável e reduzir operação manual/órfãos.
3. **P3:** resolver E10, E11, E13, E16, E20 e E22, refinando contexto, nomenclatura e
   densidade da navegação.

### Validação pendente

- **E12** permanece uma hipótese de consistência entre guards de página e ações;
  não foi demonstrado neste levantamento um contraexemplo concreto. Deve ser
  validado por rota e só então entrar no backlog de implementação.
