# Conectar um número de WhatsApp a uma conta do AutoFluxos

Guia de quem está ao lado do cliente na hora de conectar. Conferido tela por
tela em 30/set/2026, conectando o número da PCYES (44 2101-1387, que já rodava
no app WhatsApp Business do celular). O código por trás está em
`src/components/cliente/conectar-whatsapp.tsx`; o porquê técnico, em
`HANDOFF-COEXISTENCE.md`.

## Antes de começar: não crie nada no business.facebook

**Não adicione o número pelo Gerenciador do WhatsApp** (business.facebook.com →
Contas do WhatsApp → Adicionar). Aquele caminho é o da API sem o app: pede
código por SMS ou ligação e **tira o número do celular**.

A janela da Meta que o AutoFluxos abre (Embedded Signup) escolhe o portfólio e
cria ou escolhe a conta do WhatsApp **dentro dela mesma**. O portfólio só
precisa existir.

## Onde clicar

Conta do cliente → Conversas → Canais → WhatsApp →
`/clientes/<clienteId>/conversas/canais/whatsapp`, botão **verde "Conectar meu
WhatsApp"**. O verde abre no modo de coexistência
(`featureType: whatsapp_business_app_onboarding`): o número continua
funcionando no app do celular, com o bot junto.

## As telas, na ordem

1. **"Conecte sua conta facilmente a Portfólio - 4YU"**. "Portfólio - 4YU" é
   o nosso nome como parceiro da Meta, **não** o portfólio de destino. Normal.
   Continuar.
2. **"Adicione seu número de telefone do WhatsApp"**, com um menu que lista
   números de **todos** os portfólios a que a pessoa logada tem acesso.
   Ignore a lista: deixe "Insira um novo número de telefone", escolha BR +55 e
   digite o número (ex.: `4421011387`). Avançar.
   - Se a próxima tela perguntar **SMS ou ligação**, **pare**: o número não
     está no app WhatsApp Business, e seguir o tiraria do celular.
3. **"Verifique os detalhes da sua conta"**: aparece o perfil do app (nome,
   foto, site). É o sinal de que a Meta reconheceu o app. Avançar.
4. **"Selecione os ativos de negócios"**, com o campo **Portfólio
   empresarial**. Escolha o portfólio **do cliente** (PCYES → Grupo Oderço).
   Nunca "Criar um portfólio empresarial" por engano. Avançar.
5. **"Importar contatos e histórico de conversas"**, com um **QR code**. No
   celular do dono do número:
   - tocar **Connect** na mensagem da **Conta Oficial do Facebook Business**
     (sem a mensagem: Menu → Configurações → Business Platform);
   - ler o QR code, tocar **Connect to the Business Platform** e **Confirm**;
   - no Confirm, escolher se compartilha o histórico de 6 meses (compartilhado,
     as conversas antigas aparecem no Inbox).
6. Terminar a janela. O número aparece no canal da conta.

## Avisar o cliente antes

- O WhatsApp Business do celular precisa estar atualizado (2.24.17+).
- Os aparelhos vinculados (WhatsApp Web, computador) **se desconectam** na hora;
  ele religa depois.
- Mensagem enviada pelo **WhatsApp para Windows** não chega ao sistema.
- O app continua funcionando: ele e o bot respondem no mesmo número.

## Depois de conectar

- Ligar o fluxo de entrada do canal (boas-vindas/menu) na tela do canal.
- Conferir no banco: `channels` da conta com `is_on_biz_app = true` e
  `display_phone_number` preenchido.
- Mandar uma mensagem de outro celular e ver chegar no Inbox.
