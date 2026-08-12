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
| **Fluxo** | o desenho da conversa de um cliente |
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
- Cada cliente indica se tem IA contratada.
- Clicar num cliente abre a tela dele.

### 2. Cliente

Reúne tudo de um cliente: fluxos, números de WhatsApp e acesso aos leads.

**Lista de fluxos.** Cada fluxo mostra quantos blocos tem, quantos impedimentos
de publicação existem (se houver) e se está **no ar** ou ainda **rascunho**.
Criar fluxo novo pede só o nome — ele nasce com um esqueleto válido.

**Números de WhatsApp.** Lista os números conectados, cada um indicando qual
fluxo executa e alertando quando está ligado a um fluxo ainda não publicado ou a
nenhum fluxo (nesses casos o bot não responde). Conectar um número pede a
identificação dele e qual fluxo deve rodar. A tela também mostra o endereço que
precisa ser cadastrado no painel da Meta.

### 3. Editor de fluxo

A tela principal do produto, e onde a pessoa passa a maior parte do tempo. Tem
três funções convivendo: **catálogo de blocos**, **área de desenho** e um
**painel** que alterna entre editar o bloco selecionado e testar a conversa.

**No cabeçalho:** nome do fluxo e do cliente, estado do salvamento, o que está
no ar (versão e há quanto tempo), aviso quando o desenho difere do que está
publicado, contagem de impedimentos, e a ação de publicar.

#### Interações da área de desenho

| Ação | O que acontece |
|---|---|
| Escolher um tipo no catálogo | um bloco novo aparece já selecionado, com conteúdo de exemplo, e o painel abre nele |
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
publicação; **aviso** não. Cada item é clicável e seleciona o bloco culpado.
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

- **Vazio:** primeira vez, sem nada criado. É a maior chance de ensinar o produto.
- **Carregando:** a maioria das telas lê banco antes de aparecer.
- **Erro:** falha de rede ou de servidor, com caminho de volta.
- **Sem permissão:** cliente tentando alcançar algo que não é dele.
- **Não encontrado:** endereço de cliente ou fluxo que não existe.

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
