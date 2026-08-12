# AutoFluxos — brief funcional para o design

Este documento descreve **o que cada tela faz**, quais estados existem e o que
acontece em cada interação. **Não propõe nada de visual** — cor, tipografia,
espaçamento, layout, tokens e movimento são decisão de quem desenha.

---

## O produto

**AutoFluxos.** A 4YU desenha fluxos de atendimento automático no WhatsApp para
empresas clientes. Alguém manda mensagem para o número da empresa, o bot conduz
uma conversa curta, coleta o que importa, e passa para uma pessoa quando precisa.

Não é o bot de uma empresa específica: é a ferramenta onde o bot de **qualquer**
cliente é montado. O que muda de cliente para cliente é o desenho do fluxo, nunca
o produto.

## Quem usa

- **Hoje:** uma pessoa só — o operador da agência. Ele cria os clientes, desenha
  os fluxos, publica e acompanha os leads. A interface pode ser densa; o usuário
  é técnico e usa isso o dia inteiro.
- **Depois:** o cliente final ganha acesso **somente leitura** aos leads e às
  conversas dele. Não desenha fluxo, não vê outros clientes.

## Vocabulário do produto

Estes nomes aparecem na interface e devem ser respeitados:

| Termo | O que é |
|---|---|
| **Cliente** | a empresa atendida (ex.: uma produtora de vídeo) |
| **Fluxo** (ou **automação**) | o desenho da conversa de um cliente. É a unidade que se vende: existe com IA e sem IA |
| **Bloco** | cada peça do fluxo |
| **Rascunho** | o desenho sendo editado |
| **Versão publicada** | foto imutável do fluxo, é o que roda de verdade |
| **Lead** | pessoa que conversou com o bot |
| **Handoff** | momento em que o bot passa a conversa para uma pessoa |
| **Canal** | o número de WhatsApp ligado a um cliente |

Os seis tipos de bloco: **Mensagem**, **Pergunta**, **Condição**, **Guardar**,
**IA**, **Falar com humano**.

---

## Telas que existem hoje

### 1. Lista de clientes

Entrada do sistema. Lista os clientes e permite criar um novo pelo nome.

- **Vazio:** primeiro acesso, nenhum cliente. Oferece criar um cliente de exemplo
  já com um fluxo pronto, para a pessoa ter o que explorar.
- Cada cliente mostra quantas automações tem e quantas delas usam IA
  (ex.: "3 automações · 1 com IA"). Cliente sem nenhuma diz isso.
- Clicar num cliente abre a tela dele.

### 2. Cliente

Reúne tudo de um cliente: fluxos, números de WhatsApp e acesso aos leads.

**Atalho para os leads, em destaque.** O fluxo é o meio, o lead é o fim. O
atalho carrega dois números: quantos leads existem e — quando houver — quantos
estão **esperando atendimento humano**. Esse segundo número é o que faz alguém
largar o que está fazendo, e chega na tela depois do resto (é consulta mais
pesada), então precisa de um estado intermediário que não empurre o layout.

**Lista de fluxos.** Cada fluxo mostra quantos blocos tem, quantos impedimentos
de publicação existem (se houver), se usa **IA**, e se está **no ar** ou ainda
**rascunho**.

**Criar automação** pede o nome e **se tem IA** — a decisão é tomada aqui porque
é aqui que se sabe o que foi vendido. Ela nasce com um esqueleto válido.

**Números de WhatsApp.** Lista os números conectados, cada um indicando qual
fluxo executa e alertando quando está ligado a um fluxo ainda não publicado ou a
nenhum fluxo (nesses casos o bot não responde). Conectar um número pede a
identificação dele e qual fluxo deve rodar. A tela também mostra o endereço que
precisa ser cadastrado no painel da Meta.

### 3. Editor de fluxo

A tela principal do produto, e onde a pessoa passa a maior parte do tempo. Tem
três funções convivendo: **catálogo de blocos**, **área de desenho** e um
**painel** que alterna entre editar o bloco selecionado e testar a conversa.

**No cabeçalho:** nome do fluxo e do cliente, **se esta automação tem IA**
(alternável ali mesmo), estado do salvamento, o que está no ar (versão e há
quanto tempo), aviso quando o desenho difere do que está publicado, contagem de
impedimentos, e a ação de publicar.

Ligar ou desligar a IA não republica nada: muda só o que a próxima publicação
aceita. Com a IA desligada, um bloco de IA no desenho vira impedimento.

#### Interações da área de desenho

| Ação | O que acontece |
|---|---|
| Escolher um tipo no catálogo | um bloco novo aparece **no meio de onde a pessoa está olhando**, já selecionado, com conteúdo de exemplo, e o painel abre nele |
| Clicar num bloco | seleciona e abre no painel para edição |
| Arrastar um bloco | reposiciona; a posição faz parte do fluxo e é salva |
| Arrastar de uma alça até outro bloco | cria a ligação — **é assim que a conversa ramifica** |
| Ligar uma alça que já tinha ligação | a antiga é substituída: cada saída leva a um lugar só |
| Apagar um bloco | some com ele e com todas as ligações que o tocavam |
| Marcar como início | define onde a conversa começa; só um bloco por fluxo |
| Navegar | mover a tela, aproximar, afastar, enquadrar tudo, e um mapa de visão geral |

#### As alças (o conceito central)

Todo bloco recebe conversa por cima. O que muda é a saída:

- **Mensagem**, **Guardar** e **IA** têm uma saída só.
- **Pergunta** tem **uma saída por opção**. É isso que faz a ramificação existir:
  a ligação que sai da opção "Orçamento" é o caminho de quem escolheu orçamento.
  Quando não há opções, a resposta é livre em texto e a saída volta a ser única.
- **Condição** tem duas saídas: verdadeiro e falso.
- **Falar com humano** não tem saída: a conversa acaba ali.

Cada alça precisa ser um alvo confortável de arrastar, e precisa ficar claro
qual saída pertence a qual opção.

#### Painel — aba "Bloco"

Formulário do bloco selecionado, diferente por tipo. Também permite definir o
bloco como início e apagá-lo.

- **Mensagem:** o texto enviado.
- **Pergunta:** o texto, em qual variável guardar a resposta, e a lista de
  opções (adicionar, renomear, remover). Precisa comunicar quantas opções ainda
  cabem e como elas vão aparecer no WhatsApp.
- **Condição:** variável, operador e valor de comparação.
- **Guardar:** em qual campo e com que conteúdo.
- **IA:** a instrução, onde guardar a resposta, e o aviso de que IA é plano à
  parte e ainda não está ativa.
- **Falar com humano:** a mensagem de despedida do bot e o motivo interno, que
  aparece depois no painel de leads.

Campos de texto aceitam `{{variavel}}`, que é substituída pelo que a pessoa
respondeu. O painel mostra quais variáveis aquele fluxo preenche.

**Lista de impedimentos e avisos.** Abaixo do formulário. **Impedimento** trava a
publicação; **aviso** não. Cada item é clicável: seleciona o bloco culpado **e
traz ele para a vista**, com movimento — o bloco pode estar fora da tela, e
selecionar sem mover faz o clique parecer quebrado.
Exemplos: bloco sem texto, opção que não leva a lugar nenhum, condição sem uma
das saídas, nome de variável inválido, rótulo maior do que o WhatsApp mostra,
bloco solto que a conversa nunca alcança, e o mais importante: **nenhum caminho
chega a "Falar com humano"**.

#### Painel — aba "Testar"

Uma conversa de mentira com o fluxo que está na tela **agora**, inclusive
alterações ainda não salvas. Quem digita faz o papel do cliente.

- O bot responde exatamente como responderia no WhatsApp, com as opções
  clicáveis, indicando se virariam botões ou lista.
- Entre as mensagens aparecem eventos internos: o que foi guardado, quando
  passou para um humano e por quê, quando a conversa encerrou.
- **Quando a automação tem IA, ela responde de verdade aqui** — com a chave da
  4YU, para dar para desenhar o fluxo na frente do cliente numa reunião e ele já
  responder. A resposta demora alguns segundos: a espera precisa ser visível.
- Quando a IA não sabe responder, ela não inventa: avisa e passa para uma
  pessoa. Isso aparece como evento, com o motivo.
- Um botão simula o envio de áudio, para mostrar que áudio vai direto para uma
  pessoa.
- Se o desenho mudar no meio de um teste, a conversa avisa que está velha e
  oferece recomeçar — mas não reinicia sozinha.
- Quando o bot sai de cena (passou para humano ou encerrou), a conversa fica
  claramente terminada e só resta recomeçar.
- Ao lado, o estado ao vivo: em que bloco a conversa está e o que já foi
  coletado.

### 4. Leads

Onde o valor do produto aparece para o cliente. Lista as pessoas que conversaram
com o bot, com o que o fluxo coletou de cada uma (as informações variam por
fluxo), quem está esperando atendimento humano e há quanto tempo, e quando foi a
última mensagem.

As colunas do meio **saem dos dados**: cada fluxo coleta o que quiser, então a
tabela descobre as colunas a partir do que existe. Uma lista fixa de campos aqui
seria o produto sabendo o negócio de um cliente específico.

Abrir um lead mostra a conversa inteira, na ordem, separando o que a pessoa
escreveu do que o bot respondeu, mais tudo que o fluxo coletou dela.

**Sem campo de resposta, de propósito:** responder acontece no WhatsApp de quem
atende. Um botão de enviar aqui prometeria uma caixa de entrada que não existe —
e construir uma é decisão de produto, não de tela (ver "Coexistence" no
ESTADO.md: o celular do cliente continua sendo o inbox).

#### 4a. Lista de leads — o que cada linha tem

Uma tabela. As colunas fixas são **Contato**, **Situação** e **Última
mensagem**; entre elas entram, dinamicamente, as informações que aquele fluxo
coletou.

| Coluna | O que mostra |
|---|---|
| Contato | nome do perfil do WhatsApp (ou "sem nome") e o número. Leva ao lead |
| *(dinâmicas)* | uma por informação coletada; quem não tem aquela informação mostra vazio |
| Situação | "aguardando humano" **com há quanto tempo e o motivo**, ou "com o bot" |
| Última mensagem | quando foi, em tempo relativo, e uma prévia — marcando quando foi o bot que falou |

Ordena da conversa mais recente para a mais antiga. Quem nunca escreveu aparece
no fim, sem data.

**Vazio, dois casos diferentes:** sem número de WhatsApp conectado, o texto diz
isso (é a causa real); com número conectado, diz que os leads aparecem quando
alguém escrever.

#### 4b. O lead — campos e conversa

Cabeçalho com nome, número e há quanto tempo chegou. Se está esperando uma
pessoa, isso aparece em destaque logo abaixo, com o motivo e desde quando.

Depois, **o que o fluxo coletou** — pares de rótulo e valor, e um texto honesto
quando ainda não coletou nada.

Por fim, **a conversa inteira na ordem**: o que o lead escreveu de um lado, o
que o bot respondeu do outro, cada mensagem com horário. Mensagem que não é
texto (áudio, imagem, documento) aparece identificada como tal. Conversa muito
longa mostra as mais recentes e **avisa que cortou** — nunca corta calado.

A conversa chega depois do resto da página (é a consulta que cresce sem limite),
então precisa de um estado de carregamento próprio.

---

## Telas que faltam

### 5. Login

Hoje a proteção é uma senha única, sem tela. Precisa virar login de verdade:
entrar, sair, erro de credencial, e sessão que expira.

### 6. Administração de usuários

Quem trabalha na agência e quem é cliente. Convidar, remover, e definir o que
cada um alcança:

- **Operador:** tudo — cria clientes, desenha, publica.
- **Cliente:** somente leitura, e só do próprio cliente: seus leads e suas
  conversas. Nunca o editor, nunca outro cliente.

O produto foi construído assumindo um operador só, então esta tela **cria** a
noção de papéis. Ela precisa deixar óbvio o que cada papel enxerga, porque errar
aqui expõe dado de um cliente para outro.

---

## Estados que toda tela precisa resolver

Os quatro primeiros **já existem em código** e precisam de desenho; o quinto
espera o login.

- **Vazio:** primeira vez, sem nada criado. É a maior chance de ensinar o produto.
- **Carregando:** as telas pintam o cabeçalho na hora e preenchem o miolo quando
  o banco responde. O que espera é sempre um pedaço da tela, nunca a tela toda —
  então o desenho precisa de esqueletos que **reservem o espaço certo**, senão o
  conteúdo pula quando chega. Onde há esqueleto hoje: lista de fluxos, tabela de
  leads, conversa de um lead, e o contador de leads no cabeçalho do cliente.
- **Erro:** falha de banco ou de rede. Duas saídas: tentar de novo e voltar para
  o começo. Mostra um código curto para reportar. Existe também uma versão de
  último recurso, para quando o próprio layout quebra.
- **Não encontrado:** endereço que não existe. Tem duas versões, e a diferença é
  proposital: na raiz, "esta página não existe"; dentro de um cliente, "este
  cliente, fluxo ou lead não existe — ou não é deste painel", que é a mesma
  mensagem que um dia vai servir para "não é seu".
- **Sem permissão:** cliente tentando alcançar algo que não é dele. Ainda não
  existe — entra com o login, e reaproveita a tela acima de propósito: dizer
  "existe, mas não é seu" já é contar demais.

## Momentos em que algo muda e a pessoa precisa perceber

Sem prescrever como — só onde importa:

1. **Salvamento automático:** o editor salva sozinho depois de uma pausa na
   digitação. Existem quatro estados: salvo, alterações pendentes, salvando, e
   falhou. A pessoa nunca deve ficar em dúvida se o trabalho dela está seguro.
2. **Publicação:** é a ação mais séria do produto — muda o que os clientes reais
   vão conversar. Precisa de peso, e o resultado (deu certo, ou foi recusado com
   estes impedimentos) precisa ser inequívoco.
3. **Desenho difere do publicado:** estado persistente, não um alerta que some.
4. **Bloco novo entrando na tela** e **bloco sendo apagado**.
5. **Ligação sendo criada** enquanto se arrasta de uma alça, e o feedback de
   onde ela pode ou não pousar.
6. **Bloco selecionado** — a área de desenho e o painel falam do mesmo bloco, e
   isso precisa estar amarrado visualmente.
7. **Impedimento clicado** → o bloco culpado é selecionado e trazido para a
   vista.
8. **Chegada de mensagem no teste**, incluindo a espera enquanto o motor responde.
9. **Handoff** dentro do teste: é o momento em que o bot sai de cena.
10. **Lead novo aparecendo** e **lead esperando humano há muito tempo** —
    urgência que cresce com o tempo.

---

## Restrições que vêm do WhatsApp (não são escolha nossa)

Elas moldam o editor e precisam ser comunicadas **antes** do erro acontecer:

- Uma pergunta com **até 3 opções** vira botões; de 4 a 10 vira uma lista
  suspensa; **acima de 10 o WhatsApp recusa a mensagem**.
- Rótulo de opção: **20 caracteres**. Passou disso, aparece cortado.
- O bot só conversa por texto, botão e lista. Áudio, imagem e documento que
  chegam vão direto para uma pessoa.

## O que não pode mudar

- O desenho é o modelo: **a ligação que se arrasta é a ramificação**. Não pode
  existir tela separada para configurar caminho.
- **Um fluxo sem caminho até "Falar com humano" não publica.** Isso é regra de
  produto, não sugestão — existe para nunca prender uma pessoa conversando com
  um robô.
- Rascunho pode estar pela metade e ser salvo. O que é barrado é publicar.

---

## O que mudou desde a primeira versão deste brief

Resumo para quem já leu a versão anterior e só quer o delta. Tudo abaixo **já
existe em código** e está esperando desenho.

| # | O quê | Onde |
|---|---|---|
| 1 | **Lista de leads** — tabela com colunas dinâmicas, situação e última mensagem | §4a |
| 2 | **Tela de um lead** — campos coletados e a conversa inteira | §4b |
| 3 | **Atalho de leads no cliente**, com quantos esperam atendimento | §2 |
| 4 | **IA é da automação, não do cliente** — caixa ao criar, selo na lista, alternador no editor | §2, §3 |
| 5 | **Lista de clientes** conta automações em vez de dizer "cliente com IA" | §1 |
| 6 | **Carregando, Erro e Não encontrado** passaram a existir | "Estados" |
| 7 | Impedimento clicado **traz o bloco para a vista**; bloco novo nasce onde a pessoa olha | §3 |
| 8 | Na aba Testar, **a IA responde de verdade** | §3 |

O que **não** mudou e continua valendo: nenhuma decisão visual está tomada aqui.
Cor, tipografia, espaçamento, layout e movimento seguem sendo de quem desenha.
