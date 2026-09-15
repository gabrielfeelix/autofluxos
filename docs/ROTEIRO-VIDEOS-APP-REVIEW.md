# Roteiro dos vídeos do App Review da Meta

Dois vídeos, um por permissão. 2 a 4 minutos cada. Tela do computador, sem som,
sem precisar aparecer nem falar. O revisor lê a tela.

## Antes de ligar a gravação

- Logado no AutoFluxos com um cliente **real**, número conectado de verdade.
- Um celular à mão com um número que **não** é o da empresa — ele faz o papel do
  cliente que puxa conversa. Se der, grave a tela do celular também (ou aponte a
  câmera pra ele; os dois servem).
- Feche notificação, aba de banco, print de outro cliente. Nada de dado que não
  seja do cliente que você está mostrando.
- Zoom do navegador em 100%. O revisor precisa ler o número na tela.
- Legenda em inglês ajuda, português passa. Se for legendar, as frases-chave
  estão no fim deste arquivo.

## Vídeo 1 — `whatsapp_business_messaging`

O que ele precisa provar: **a empresa responde um cliente que puxou conversa.**

Ordem de gravação:

1. **Você logado.** Abra o painel já dentro do cliente. Deixe visível: nome do
   cliente na barra lateral, seu usuário no canto. Dois, três segundos parado —
   é o que diz "isto é um painel de empresa, com login".
2. **O número conectado.** Vá em `Ajustes → WhatsApp`. Pare na tela que mostra o
   número e o status conectado. Passe o mouse por cima sem clicar em nada. Esta
   é a tela que prova que o número é real e é da empresa.
3. **O cliente manda mensagem.** No celular, abra a conversa com o número da
   empresa e digite algo comum — *"Oi, vocês atendem hoje?"*. Envie. Mostre a
   mensagem enviada na tela do celular.
4. **A mensagem chega no Inbox.** Volte pro painel, abra o Inbox. A conversa
   aparece na lista. Clique nela. A mensagem do cliente está lá, com o horário.
   Não corte esse trecho — é o coração do vídeo.
5. **O atendente responde pelo painel.** Digite a resposta no campo do Inbox e
   envie. Espere o balão aparecer na conversa.
6. **A resposta chega no celular.** Volte pro celular. A resposta está lá.

O que **não** fazer neste vídeo: nada de disparo, nada de lista, nada de enviar
pra alguém que não escreveu primeiro. Uma conversa só, do começo ao fim.

## Vídeo 2 — `whatsapp_business_management`

O que ele precisa provar: **você administra a conta de WhatsApp de terceiros,
com autorização deles.**

Ordem de gravação:

1. **O cliente conecta o número.** Em `Ajustes → WhatsApp`, clique em conectar.
   O popup da Meta (Embedded Signup) abre. Mostre a tela de autorização — é ela
   que prova o consentimento. Se você não quiser conectar um número novo na
   gravação, abra o popup até a tela de permissões e **cancele** ali: o AutoFluxos
   trata cancelamento como decisão normal e volta pra tela sem erro. Grave esse
   retorno também; mostra que o fluxo é o de verdade.
2. **A lista de números conectados.** Na mesma tela de Ajustes, mostre o número
   (ou os números) com o papel de cada um e a opção de desconectar. Desconectar
   é o que prova que o controle é do cliente, não seu — mostre o botão, não
   clique.
3. **No lugar de templates, mostre as configurações do WhatsApp.** A tela de
   modelos aprovados da Meta ainda não existe no produto. Então demore uns
   segundos nesta tela: número, webhook, papéis, fluxos ligados ao número.
4. **Dois clientes diferentes.** Saia deste cliente, volte pra lista de clientes
   e entre em outro. Mostre que o segundo tem **o número dele**, a conversa dele,
   a configuração dele. Faça o caminho completo pela URL visível — o revisor
   precisa ver que muda de `/clientes/<um>` para `/clientes/<outro>` e que o
   conteúdo muda junto. Este trecho é o que responde "por que você precisa de
   management": porque cada conta é de um cliente e você administra várias.

## O que derruba o review

- Tela falsa, dado inventado, número de mentira.
- Qualquer coisa que pareça disparo em massa.
- Não mostrar o cliente escrevendo primeiro no Vídeo 1.
- Vídeo curto demais, sem contexto — corte que pula direto pra mensagem enviada.

## Conta de teste

Deixe um usuário pronto e coloque e-mail e senha no formulário do review. O
revisor precisa entrar sozinho.

> Existe `revisor.meta@4yu.com.br` registrado nos documentos, com senha em texto
> puro no `.env`. **Troque essa senha depois da aprovação.**

## Descrição do caso de uso (cole no formulário)

> AutoFluxos is a customer service platform for small and medium Brazilian
> businesses. Each business connects its own WhatsApp number through Embedded
> Signup and owns its WABA. The platform provides a shared team inbox,
> conversation automation, and CRM. Businesses only message customers who
> contacted them first, or who gave explicit opt-in consent.

## Frases de legenda, se for legendar em inglês

Vídeo 1:

- `Business dashboard — logged in as the business operator`
- `The business's own WhatsApp number, connected via Embedded Signup`
- `A customer starts the conversation from their phone`
- `The message arrives in the shared team inbox`
- `An agent replies from the dashboard`
- `The reply arrives on the customer's phone`

Vídeo 2:

- `The business authorizes AutoFluxos through Meta's Embedded Signup`
- `Connected numbers for this business — the business can disconnect at any time`
- `WhatsApp settings for this business account`
- `A different business — its own number, its own conversations`
