# Runbook: número de WhatsApp foi parar no portfólio errado

Caso real: PCYES, 26 e 27/out/2026. O bot ficou ~17h sem receber mensagens.
Resolvido sem perder número, conversas, histórico nem templates.

## Como acontece

Alguém cria um portfólio ou página nova no Facebook e, no cadastro, informa
o WhatsApp da empresa. A Meta manda um código pelo próprio WhatsApp; ao
confirmar, a **conta de mensagens do app WhatsApp Business** (onde moram os
templates e a cobrança) muda de dono para o portfólio novo. Em out/2026 a Meta
separou "Conta do WhatsApp" (o número) de "Conta de mensagens" (templates e
cobrança); é a segunda que se move.

No caso: Rodrigo criou o portfólio "PCYES FAN" (1392734763921790) e a conta
"PCYES Vendas" (1667540761039280) saiu do Grupo Oderço (901554973209443).

## Sintomas

- Mensagens **recebidas** param de chegar ao AutoFluxos. As **enviadas pelo
  celular** (ecos) continuam chegando.
- Envios pela API respondem 200 com `wamid` e não chegam a ninguém.
- A Meta diz "CONNECTED", qualidade verde, app assinado, webhook certo. A tela
  de canais diz "Conectado". **Nada disso prova que está recebendo**: o sinal
  real é "Última mensagem recebida há X".
- `GET /{waba}?fields=owner_business_info` mostra o portfólio errado.
- A conta some de "Contas de mensagens" do portfólio original e da lista do
  parceiro (4YU), e aparece "Análise em andamento" no portfólio novo.
- Um código "is your Facebook confirmation code" chega na caixa do número.

## O que NÃO fazer

- **Desconectar o número na tela de canais do AutoFluxos**: apaga o histórico
  das conversas (aviso "apagaria o histórico").
- **Cadastrar o número de novo com SMS/ligação** no Embedded Signup: tira o
  número do app do celular.
- **"Criar conta do WhatsApp" / "Create a new Messaging account"** no
  portfólio certo: cria conta nova e perde templates.
- **"Apagar minha conta"** no app: perde o histórico.
- **Excluir o portfólio errado** com a conta dentro: leva a conta junto.
- Esperar o suporte da Meta: confirmaram em 1 dia que "não dá para mover WABA
  entre portfólios" e não moveram nada.

## O que resolveu (ordem exata)

1. Backup das conversas da conta (`.secrets/backup-<cliente>-<data>/`, fora de
   git, apagar depois).
2. **Celular do cliente**: WhatsApp Business → Configurações → Conta →
   Business Platform → **Desconectar**. O app continua igual; só sai da API.
3. **Portfólio errado** → Contas de mensagens → a conta → ⋯ → **Remover do
   portfólio empresarial**. Antes estava bloqueado por "compartilhada com um
   parceiro"; depois do passo 2, liberou.
4. Ter o número ligado à **página oficial** do cliente, que fica no portfólio
   certo (Facebook → página → Configurações → Contas vinculadas → WhatsApp).
   Foi isso que fez o passo 5 oferecer o portfólio certo.
5. **AutoFluxos** → canais do WhatsApp → card do número → **"Refazer conexão
   com o celular"** → número na mão → aparece o **perfil do app** (sem SMS)
   → portfólio certo → QR no celular → confirmar.

Resultado: **mesmo WABA ID, mesmo phone_number_id**, dono = Grupo Oderço,
templates todos aprovados, as 360 conversas no mesmo canal.

## Pistas que ajudaram a diagnosticar

- No Embedded Signup, a lista de números mostra "Nome · Portfólio · Registrado":
  é onde se vê de quem o número é. Se o número aparece "Registrado" no
  portfólio errado, ele ainda está preso na API de lá (passo 2 libera).
- Campo "Portfólio empresarial" travado (cinza) no Embedded Signup = a conta de
  mensagens ainda pertence a esse portfólio (passo 3 libera).
- Erro `#3441038` "você não tem permissão para este ativo": quem está logado
  não tem o ativo atribuído (Usuários → Pessoas → Atribuir ativos), mesmo
  sendo admin do portfólio.
- `GET /{phone_number_id}/routing_roles` (sugestão do suporte) responde
  "Conversation routing is not enabled": descarta roteamento.
- O token antigo do canal perde acesso ao número e ao WABA depois do passo 3;
  é normal, o passo 5 grava um novo.

## Mudança feita no produto por causa disto

O botão "Reconectar" só aparecia quando a Meta avisava a queda. Passou a
existir sempre, como "Refazer conexão com o celular" (commit 23d71abd/8b0fadb3).
