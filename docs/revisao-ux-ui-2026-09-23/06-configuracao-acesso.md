# Inventário e revisão: Configuração, acesso e entradas do produto

Data: 2026-09-23. Revisão estática local, sem produção, rede, banco ou
alterações de produto. O inventário cobre as rotas abaixo; a profundidade varia
por tela e está indicada pela evidência. Os grupos de componentes destacados
tiveram formulários, ações e estados principais inspecionados.

## Inventário de rotas

| Rota | Tipo e controles observados | Evidência |
|---|---|---|
| `/clientes/[clienteId]/ajustes` | Hub/visão geral; cards e apagar cliente; `acaoApagarCliente`; shell e breadcrumb | `src/app/clientes/[clienteId]/ajustes/page.tsx:40-50,389` |
| `/ajustes/negocio` | Dados da empresa e logo; salvar/remover logo; feedback via componentes de formulário | `src/app/clientes/[clienteId]/ajustes/negocio/page.tsx:24-48` |
| `/ajustes/contexto` | Texto de conhecimento; salvar contexto; guardar/apagar chave IA; aviso sobre uso | `src/app/clientes/[clienteId]/ajustes/contexto/page.tsx:40-94` |
| `/ajustes/horario` | Horário + retomada no mesmo formulário; duas ações de salvar | `src/app/clientes/[clienteId]/ajustes/horario/page.tsx:26-76` |
| `/ajustes/retomada` | Redirect legado para `/ajustes/horario`; não é tela órfã | `src/app/clientes/[clienteId]/ajustes/retomada/page.tsx:1-17` |
| `/ajustes/whatsapp` | Conectar/desconectar número, escolher fluxos por situação, estado de sincronização e webhook copiável | `src/app/clientes/[clienteId]/ajustes/whatsapp/page.tsx:90-100,386-596` |
| `/ajustes/instagram` | Conectar/desligar conta; status e aviso de app review | `src/app/clientes/[clienteId]/ajustes/instagram/page.tsx:52-63,103-189` |
| `/ajustes/respostas-rapidas` | Criar/apagar respostas; lista vazia; componente gerenciador | `src/app/clientes/[clienteId]/ajustes/respostas-rapidas/page.tsx:11-37` |
| `/ajustes/etiquetas` | Criar/editar/apagar etiquetas e cor; formulários inline | `src/app/clientes/[clienteId]/ajustes/etiquetas/page.tsx:20-126` |
| `/ajustes/produtos` | Criar, preço, renomear, arquivados; ações próprias | `src/app/clientes/[clienteId]/ajustes/produtos/page.tsx:32-198` |
| `/ajustes/acervo` | Lista/remoção de arquivos e mídias; gerenciador | `src/app/clientes/[clienteId]/ajustes/acervo/page.tsx:11-39` |
| `/ajustes/anuncios` | Facebook, token Ads, ligar/desligar página; estados de pré-requisito | `src/app/clientes/[clienteId]/ajustes/anuncios/page.tsx:33-228` |
| `/ajustes/chaves` | Criar/trocar/apagar conexão, testar agenda; segredo mascarado/feedback | `src/app/clientes/[clienteId]/ajustes/chaves/page.tsx:42-256` |
| `/ajustes/integracoes` | Abas `conectadas`/`disponiveis`; cards de saúde; links ou cards sem tela | `src/app/clientes/[clienteId]/ajustes/integracoes/page.tsx:150-255` |
| `/ajustes/integracoes/magento` | Testar, conectar/desconectar token, ligar/desligar loja | `src/app/clientes/[clienteId]/ajustes/integracoes/magento/page.tsx:25-69` |
| `/ajustes/recursos` | Objetivo, CRM e onboarding; exige `configurar_operacao` | `src/app/clientes/[clienteId]/ajustes/recursos/page.tsx:36-86` |
| `/ajustes/equipe` | Adicionar/remover pessoa, papel, acesso, equipes e distribuição; leitura de equipe degrada a vazio | `src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:25-69,84-193` |
| `/ajustes/plano` | Plano/consumo e pedido de troca; ações editáveis só para owner/admin ou admin 4YU | `src/app/clientes/[clienteId]/ajustes/plano/page.tsx:24-60` |
| `/clientes/[clienteId]/configurar` | Assistente de preparação em quatro etapas; salvar, adiar e concluir; cria/preserva funil e rascunho de fluxo conforme escolhas | `src/app/clientes/[clienteId]/configurar/page.tsx:1-80`; `src/components/onboarding/assistente.tsx:17-123` |
| `/clientes/[clienteId]` | Home/painel da conta; primeiros passos condicionados ao acesso, CRM/operação, estados sem canal/automação e links de continuidade | `src/app/clientes/[clienteId]/page.tsx:71-183,224-309` |
| `/entrar` | Formulário de login; sessão existente redireciona por papel/contas | `src/app/entrar/page.tsx:21-47` |
| `/cadastrar` | Cadastro próprio; sessão existente redireciona; ação de cadastro | `src/app/cadastrar/page.tsx:25-47` |
| `/criar-conta` | Primeiro admin ou cadastro fechado; ação exclusiva de plataforma depois do primeiro usuário | `src/app/criar-conta/page.tsx:27-110` |
| `/primeiro-acesso` | Pessoa autenticada sem conta cria empresa; admin vai para `/admin/contas`; uma conta redireciona direto | `src/app/primeiro-acesso/page.tsx:23-53` |
| `/contas` | Selecionar/trocar conta, criar companhia, sair | `src/app/contas/page.tsx:30-148` |
| `/painel` | Painel da plataforma; criar cliente/exemplo; usuário não-admin vai para `/contas` | `src/app/painel/page.tsx:27-123` |
| `/admin` | Redirect fixo para `/admin/contas` | `src/app/admin/page.tsx:11-19` |
| `/admin/contas` | Lista, busca/filtro no componente, vincular membro | `src/app/admin/contas/page.tsx:16-55` |
| `/admin/usuarios` | Definir papel plataforma, entrar como suporte, revogar sessões, suspender acesso | `src/app/admin/usuarios/page.tsx:22-122` |
| `/admin/consumo` | Leitura de consumo/plano da plataforma | `src/app/admin/consumo/page.tsx:21-82` |
| `/admin/auditoria` | Leitura de registro de auditoria | `src/app/admin/auditoria/page.tsx:18-24` |
| `/admin/alertas` | Listar/marcar alerta individual/todos vistos | `src/app/admin/alertas/page.tsx:24-140` |
| `/ajuda` | Conteúdo público/ajuda com âncoras e retorno ao painel | `src/app/ajuda/page.tsx:71-148` |
| `/f/[token]` | Página pública de fluxo compartilhado; sucesso, token inválido/expirado e link para entrar | `src/app/f/[token]/page.tsx:52-144` |
| `/`, `/privacidade`, `/termos`, `/exclusao-de-dados` | Páginas públicas/legais; estrutura, links e estados principais conferidos; validade jurídica do texto fora do escopo | `src/app/{page,privacidade,termos,exclusao-de-dados}/page.tsx` |

## Aprofundamento de configuração e acesso

### S01: O hub não apresenta a sequência de configuração inicial

**Atual/evidência:** o menu agrupa 17 destinos por assunto, com busca local,
mas a visão geral é uma lista de cards e não indica dependências. Recursos liga
ao assistente de configuração (`src/app/clientes/[clienteId]/ajustes/recursos/page.tsx:56-86`),
enquanto WhatsApp permite configurar fluxos mesmo quando nenhum fluxo está
publicado (`src/app/clientes/[clienteId]/ajustes/whatsapp/page.tsx:549-590`).

**Impacto:** uma conta nova pode chegar a conexão, CRM ou respostas rápidas sem
saber o mínimo necessário para obter uma primeira conversa funcional.

**Solução:** no hub, exibir uma trilha curta e retomável: identidade da empresa
→ canal → horário/contexto → fluxo publicado → teste. Cada passo deve apontar
para a tela existente e indicar concluído, pendente ou bloqueado.

**Preservar:** busca, rotas atuais e redirect de `retomada`.

**Dependências:** estado de onboarding já lido em `recursos`; não criar nova
regra de permissão.

**Aceite:** Given uma conta sem canal, When abrir Configurações, Then vê o
primeiro passo e o motivo dos seguintes; Given canal conectado sem fluxo
publicado, When voltar ao hub, Then vê a pendência e link para Automações.

### S02: Formulários de dados da empresa não comunicam salvamento e escopo

**Atual/evidência:** `negocio` passa três ações ao `FormularioEmpresa`
(`src/app/clientes/[clienteId]/ajustes/negocio/page.tsx:38-48`). O componente
controla `erro` e `pendente`, desabilita o submit e mostra `role=alert`
(`src/components/conta/formulario-empresa.tsx:28-37,79-94`). Há feedback de
erro e pendência; não há confirmação de sucesso própria porque as ações podem
revalidar/redirecionar.

**Impacto:** a pessoa pode não saber se editar dados/logo exige administração;
feedback de sucesso depende do comportamento das ações e não foi confirmado no
componente de página.

**Solução:** documentar no cabeçalho quem pode editar e, se as ações não
redirecionarem, adicionar estado “salvo” junto ao bloco alterado; manter o
`role=alert` existente para erro.

**Dependências:** confirmar matriz de capacidade da ação antes de alterar texto.

**Aceite:** Given pessoa sem permissão, When abrir, Then vê dados sem controles
editáveis ou mensagem clara; Given edição válida, When salvar, Then recebe estado
de sucesso persistente até nova mudança.

### S03: Contexto mistura instrução de IA e credencial de IA sem fronteira visual

**Atual/evidência:** uma mesma página salva o contexto e guarda/apaga chave de IA
(`src/app/clientes/[clienteId]/ajustes/contexto/page.tsx:58-94`), com aviso de uso
(`src/app/clientes/[clienteId]/ajustes/contexto/page.tsx:67`).

**Impacto:** texto operacional e segredo têm risco e finalidade diferentes; o
usuário pode procurar a credencial em Integrações ou colar segredo no contexto.

**Solução:** separar “Conhecimento usado nas respostas” de “Credencial do
provedor”, explicar onde a chave é usada e sempre mascarar o valor salvo.

**Aceite:** Given chave já salva, When abrir, Then nenhum segredo aparece; Given
texto salvo e chave inválida, When salvar, Then cada bloco mostra seu próprio
resultado.

### S04: Horário e retomada são duas decisões relacionadas, mas feedback é ambíguo

**Atual/evidência:** a página contém dois salvamentos
(`src/app/clientes/[clienteId]/ajustes/horario/page.tsx:48-76`) e `retomada`
redireciona para ela. A semântica de retomada é comportamento pós-inatividade/
retorno do bot, não foi demonstrado como simples “fora do horário”. Não há item
separado no menu.

**Impacto:** “horário” pode ser entendido apenas como expediente, enquanto
retomada determina o que ocorre fora/ após a janela; a URL legada esconde essa
relação.

**Solução:** manter uma tela única, mas usar dois cartões com títulos e estados
independentes (“Horário de atendimento” e “Retomada após inatividade”), e incluir
“retomada” como sinônimo na busca.

**Aceite:** Given salvar apenas um cartão, When concluir, Then somente esse cartão
mostra sucesso; Given acessar URL legada, Then redirect chega à tela com o
cartão correspondente identificável.

### S05: WhatsApp tem bons estados técnicos, mas a ação de “sem fluxo” fica escondida por número

**Atual/evidência:** a tela mostra conectado, sincronizando, travado,
desembarcado e pronto com progresso e avisos (`src/app/clientes/[clienteId]/ajustes/whatsapp/page.tsx:457-535`);
configuração de quatro situações fica em modal (`:539-596`) e fluxo não
publicado aparece por situação (`:557-590`).

**Impacto:** o operador pode conectar o número e ainda deixar o bot silencioso
sem perceber o conjunto de situações não configuradas.

**Solução:** no cartão do número, incluir resumo “responde em N/4 situações” e
link direto para publicar/configurar o fluxo; manter detalhe no modal.

**Aceite:** Given número conectado sem fluxo publicado, Then resumo indica
explicitamente “não responde”; Given quatro fluxos publicados, Then mostra
“pronto” e permite revisar sem abrir modal às cegas.

### S06: Integrações usa saúde e disponibilidade, mas mistura cards clicáveis e informativos

**Atual/evidência:** abas persistem em `?aba=`, cartões sem `href` são apenas
informativos e com `href` navegáveis (`src/app/clientes/[clienteId]/ajustes/integracoes/page.tsx:150-255`).

**Impacto:** “em breve” e integração disponível têm aparência semelhante;
usuário pode esperar ação em cartão que não tem tela.

**Solução:** usar CTA textual explícito (“Conectar”, “Ver detalhes”, “Em breve”) e
um filtro de categoria; manter contagens e estados de saúde.

**Aceite:** Given cartão sem tela, When focado, Then não parece botão; Given
integração reconectar, Then CTA e estado levam diretamente ao reparo.

### S07: Equipe é uma tela de gestão completa, mas o feedback de erro depende de linhas/modais

**Atual/evidência:** adicionar pessoa, papel, acesso e remoção são ações
separadas (`src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:100-175`; `src/components/conta/linha-da-equipe.tsx:50-160`).
Remoção conta pendências antes de confirmar, e editor mostra prévia de acesso.

**Impacto:** é difícil revisar mudanças de papel, equipes e distribuição como
uma única alteração; erro pode aparecer longe do controle acionado.

**Solução:** manter editor detalhado, mas incluir resumo humano na linha e uma
confirmação de salvamento da configuração da pessoa. Não exibir chaves técnicas
de papel/capacidade.

**Aceite:** Given alteração de acesso válida, Then linha atualiza resumo e mostra
sucesso; Given remoção com pendências, Then destino é mostrado antes da decisão.

### S08: Plano é visível para todos os membros, mas edição usa regra diferente das demais telas

**Atual/evidência:** página calcula `podeMexer` via `podeAdministrarConta` e
passa o botão de pedido (`src/app/clientes/[clienteId]/ajustes/plano/page.tsx:24-60`); não há `exigirCapacidadeNaPagina`.

**Impacto:** pode ser correto como tela de leitura, mas o usuário não recebe uma
explicação clara de “ver” versus “pedir troca”.

**Solução:** separar visualmente “Seu plano e consumo” (leitura) de “Solicitar
alteração” (owner/admin/suporte), com estado do pedido e responsável.

**Aceite:** Given membro comum, Then consumo é legível e botão de solicitação
explica a autoridade necessária; Given owner, Then pedido tem feedback de envio.

## Entradas de autenticação, conta e onboarding

`/entrar` e `/cadastrar` compartilham formulário e redirecionam sessão existente
(`src/app/entrar/page.tsx:21-47`; `cadastrar/page.tsx:25-47`). `/criar-conta`
tem bifurcação primeiro administrador/cadastro fechado (`criar-conta/page.tsx:27-110`).
`/primeiro-acesso` cria a primeira empresa para usuário autenticado
(`primeiro-acesso/page.tsx:23-53`); `/contas` troca/cria organizações; `/painel`
é a visão do administrador de plataforma. O principal risco de compreensão é a
variação de destinos, já documentada anteriormente: o texto de cada tela deve
informar se a pessoa está criando identidade, empresa ou acesso.

### S09: Cadastro, primeiro acesso e criação de conta têm vocabulário concorrente

**Solução:** usar títulos explícitos “Criar seu acesso”, “Criar sua empresa” e
“Cadastrar administrador da plataforma”; cada tela deve mostrar o que acontece
depois do submit.

**Aceite:** Given pessoa deslogada, Then `/cadastrar` nunca sugere que está
criando organização; Given pessoa logada sem empresa, Then `/primeiro-acesso`
explica que criará a primeira conta.

## Administração global, ajuda e público

`/admin/layout` protege todas as subrotas com `exigirAdminDaPlataforma`
(`src/app/admin/layout.tsx:17-22`). `/admin/contas` opera contas e vinculações;
`/usuarios` altera papel de plataforma, sessões e suspensão;
`/consumo`/`auditoria` são leitura; `/alertas` marca alertas. O inventário
confirma que `/admin` é redirect, não dashboard.

`/ajuda` é conteúdo público com âncoras; `/f/[token]` é compartilhado e trata
token inválido/expirado e sucesso. As páginas legais foram apenas inventariadas,
não tiveram conteúdo interno revisado nesta rodada.

### S10: Administração global não diferencia operação de identidade e suporte

**Evidência:** `NavegacaoDoAdmin` expõe Contas, Usuários, Consumo, Auditoria e
Alertas sem descrições (`src/components/conta/navegacao-admin.tsx:20-53`).

**Solução:** subtítulos/escopo no cabeçalho (“Usuários da plataforma”, “Contas
de clientes”, “Registro de auditoria”) e no botão de suporte, preservando as
rotas.

**Aceite:** Given admin abre Usuários, Then distingue papel global de papel da
conta; Given abre Auditoria, Then entende se o filtro é plataforma ou conta.

### S11: Link compartilhado resolve estado, mas não oferece recuperação contextual

**Evidência:** `/f/[token]` trata validade e direciona para entrar/solicitar novo
link (`src/app/f/[token]/page.tsx:52-144`).

**Solução:** manter o estado de erro, incluir data/causa em linguagem humana
quando disponível e oferecer “voltar à ajuda” ou “entrar” sem perder o contexto.

**Aceite:** Given token expirado, Then não há formulário quebrado nem vazamento
de dados; Given token válido, Then conteúdo e CTA têm hierarquia única.

## Regras a preservar e dependências

- `AjustesShell` deve continuar usando `ClienteShell`; o acesso à conta não pode
  ser substituído por filtragem de menu.
- Ações Server Action precisam continuar validando no servidor e retornando
  feedback utilizável; não tratar estado visual como autorização.
- Redirect de `retomada` e fallback de aba inválida devem permanecer.
- Admin de plataforma é identidade própria operando como suporte, não papel de
  membro nem impersonação; UI deve deixar isso explícito.
- Foram inspecionados os controles dos componentes de Produtos, Etiquetas,
  Respostas rápidas, Acervo e `ContasAdmin`, além da estrutura/links das
  páginas públicas. A validação completa de cada Server Action, a revisão
  editorial/jurídica das páginas legais e a experiência visual em navegador
  continuam fora do escopo.

## Estados globais e viabilidade de navegador

`src/app/error.tsx:34-90` oferece retry local e, na segunda tentativa, recarga
total; `/not-found` (`src/app/not-found.tsx:11-28`) volta ao painel; `global-error`
(`src/app/global-error.tsx:14-37`) cobre falha do layout raiz. O loading da conta
mantém barra lateral escrita (`src/app/clientes/[clienteId]/loading.tsx:12-18`) e
o loading de Configurações mantém menu e largura (`src/app/clientes/[clienteId]/ajustes/loading.tsx:27-36`).
No mobile, o menu de ajustes troca para `select` e a barra global vira faixa
horizontal (`src/components/design/menu-de-ajustes.tsx:17-31`; 
`src/components/design/barra-lateral.tsx:75-92`).

### S12: Erros globais oferecem recuperação, mas o destino “Voltar para os clientes” pode não respeitar o contexto

**Evidência:** `error.tsx` e `not-found.tsx` apontam sempre para `/painel`
(`src/app/error.tsx:72-76`; `src/app/not-found.tsx:20-24`), enquanto usuários
comuns são redirecionados de `/painel` para `/contas`
(`src/app/painel/page.tsx:27-37`).

**Impacto:** há um passo extra e um rótulo de plataforma para usuário de conta;
em erro dentro de uma conta, perde-se a possibilidade de voltar diretamente à
conta ativa.

**Solução:** usar retorno contextual quando houver sessão/conta segura; manter
fallback `/contas` para usuário sem conta e `/admin/contas` para admin 4YU.

**Aceite:** Given erro em conta comum, When clicar voltar, Then chega a `/contas`
ou à conta ativa; Given admin 4YU, Then chega à área admin.

O navegador local não foi iniciado: há Playwright instalado e script
`test:e2e:local`; a inspeção segura confirmou `.env.teste-local` presente com
`AUTOFLUXOS_TESTE_LOCAL`, `SUPABASE_URL` e `SUPABASE_SECRET_KEY` preenchidos,
sem revelar valores. `docker ps` não está disponível nesta sessão, então o
Supabase local não foi validado como ativo. Não foi usado o `.env` de produção,
nem executada suíte que cria/apaga dados. Esta rodada, portanto, é
inventário/revisão estática; visual real em desktop/mobile permanece pendente.

## Prioridade

- **P1:** S01, S05, S07 e S09, primeira configuração, bot silencioso, gestão de
  acesso e entrada de usuários.
- **P2:** S02, S03, S04, S06, S08, S10 e S12, clareza de estado, segredos,
  integrações e administração.
- **P3:** S11 e refinamentos de cópia/ordenação do hub.

## Passada final por componentes e páginas

| Rota/componente inspecionado | Propósito, campos/ações e feedback | Dependências/links | Resultado |
|---|---|---|---|
| `/ajustes/produtos` + `BotaoArquivar` | Nome, tipo, preço, renomear; arquivar/desarquivar; erro inline e estados arquivados | `acoes-produtos`; vendas preservam histórico | Nenhum problema concreto evidente; regra de preço ausente ≠ zero está comunicada (`page.tsx:52-65`; `botao-arquivar.tsx:8-50`). |
| `/ajustes/etiquetas` + `FichaDeEtiqueta` | Criar/editar nome/cor, apagar com confirmação; etiqueta visual reutilizada em CRM/Inbox | `core/etiquetas`, contatos e transmissões | Nenhum problema concreto evidente; componente compartilhado evita divergência (`etiquetas/page.tsx:39-126`; `components/etiquetas/ficha.tsx:10-25`). |
| `/ajustes/respostas-rapidas` + `Gerenciador` | Atalho `/`, texto até 4096, criar/remover; vazio orienta cadastrar primeira frase | `acoes`; inserção posterior no Inbox | Nenhum problema concreto evidente; sem edição é decisão explícita e remoção confirma (`gerenciador.tsx:8-18,34-90`). |
| `/ajustes/acervo` + `GerenciadorDoAcervo` | Upload por arquivo/drag, formatos aceitos, teto 16 MB, copiar URL, apagar | Storage direto, ações de preparar/confirmar; fluxos publicados podem referenciar URL | Nenhum problema concreto evidente; erro 413 e falhas têm `role=alert`, sucesso `role=status` (`gerenciador.tsx:44-87,90-144,215-234`). |
| `/admin/contas` + `ContasAdmin` | Grade de contas, busca/filtro por contas sem acesso, cartão inteiro abre painel, `+ acesso` vincula pessoa e menu contextual confirma exclusão com nome/impacto | `listarContasComMembros`, `listarUsuarios`, ações de vínculo/exclusão; `src/components/conta/contas-admin.tsx:136-224,375-480,490-610` | Nenhum problema concreto evidente nesta passada; o menu de exclusão depende de contexto/botão direito e merece validação visual em mobile, sem evidência estática de falha. |
| `/clientes/[clienteId]` | Home mostra saudação/estado, primeiros passos, fila, métricas e atalhos; CTA de configuração só aparece com `configurar_operacao`; estados sem canal/automação apontam para a próxima ação | `src/app/clientes/[clienteId]/page.tsx:71-183,224-309` | Nenhum problema concreto evidente; há caminho de continuidade para conta nova e para usuário sem permissão de configuração. |
| `/admin/usuarios` | Papel de plataforma, entrar como suporte, derrubar sessões, suspender/devolver acesso | `exigirAdminDaPlataforma`, auditoria e sessão marcada | Nenhum problema concreto evidente; a duração de 1h e o registro são comunicados na própria linha (`admin/usuarios/page.tsx:92-139`). |
| `/admin/consumo` | Conversas, contas ativas, bytes e barra por plano; não bloqueia | `consumoDeTodasAsContas`, `core/planos` | Nenhum problema concreto evidente; a diferença entre medir e cobrar está explícita (`admin/consumo/page.tsx:9-19,31-65`). |
| `/admin/auditoria` | Lista append-only de atos, verbos traduzidos, destaque de ações via suporte | `listarAtos`, auditoria global | Nenhum problema concreto evidente; ação desconhecida aparece cru para não sumir (`admin/auditoria/page.tsx:9-16,52-73`). |
| `/admin/alertas` | Alertas técnicos, contexto, detalhe expansível, marcar visto individual/todos | `listarAlertas`, ações de visto; retenção de 90 dias | Nenhum problema concreto evidente; “visto” não promete “resolvido” (`admin/alertas/page.tsx:20-22,32-67,118-143`). |
| `/`, `/privacidade`, `/termos`, `/exclusao-de-dados` | Marketing e páginas legais; links/cópia e conteúdo foram lidos nesta passada | Conteúdo público, sem sessão | Nenhum problema concreto de controle/feedback identificado; revisão editorial/legal detalhada fica fora deste escopo (`src/app/page.tsx`; páginas legais correspondentes). |

Esta tabela consolida a passada final: os componentes de Produtos, Etiquetas,
Respostas rápidas, Acervo e os wrappers das cinco telas Admin foram conferidos;
as páginas públicas foram conferidas quanto a estrutura/links, não quanto à
validade jurídica do texto.
