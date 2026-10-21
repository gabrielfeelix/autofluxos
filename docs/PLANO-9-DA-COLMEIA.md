# Plano: os 9 recursos fáceis da Colmeia

Origem: `docs/COMPARATIVO-COLMEIA.md`, seção "O que da Colmeia é fácil de
fazer". Escrito em 21/out/2026 depois de ler o código de cada peça.

**Estado em 21/out/2026:** itens 3 e 5 no ar (`274f2892`); itens 1, 2 e 4 em
`708349e6`, com a migration `0139` aplicada em produção no mesmo dia, com
autorização do Gabriel. Itens 6 a 9 ficam para depois.

Limite conhecido do item 4: só conta clique em modelo **criado depois** pela
biblioteca (o modelo escrito do zero na nossa tela ainda não tem botão), e na
mensagem comum dentro da janela.

Banco: os itens 1, 2 e 4 precisam de colunas novas. Vão numa migration só
(número tirado de `ls supabase/migrations | tail -1` na hora), que só entra em
produção com autorização do Gabriel. Código que lê coluna nova só vai ao ar
depois dela aplicada.

## 1. Transmissão grátis para quem conversou nas últimas 24h

**Hoje:** toda transmissão sai como modelo aprovado, inclusive para quem
escreveu há uma hora. Marketing custa R$ 0,3217; mensagem comum dentro da
janela custa R$ 0,035 depois das 1.000 grátis do mês
(`src/core/franquia-da-meta.ts`).

**Como:** opção na transmissão, ligada por padrão: "Quem conversou nas últimas
24h recebe como mensagem comum". No envio (`src/server/disparar-transmissao.ts`,
`tentarUm`), se a janela do contato está aberta e o modelo cabe em texto
(sem botão e sem mídia no cabeçalho), manda cabeçalho e corpo já preenchidos
por `enviarTexto`. Senão, modelo como hoje.

**Banco:** `transmissoes.texto_livre_na_janela boolean default true`,
`transmissao_destinatarios.enviada_como text` ('modelo' ou 'texto').

**Tela:** a prévia da nova transmissão mostra quantos vão como mensagem comum
e a economia estimada; o detalhe mostra quantos foram de cada jeito.

## 2. Espaçar os envios

**Hoje:** a transmissão sai no ritmo máximo seguro (`RITMO_INICIAL`,
`src/core/disparo.ts`), e as respostas chegam todas juntas para a equipe.

**Como:** opção "Ritmo": "Tudo de uma vez" ou "Aos poucos, até N por hora,
só no horário de atendimento". Cada passada calcula quantos ainda cabem na
hora e para. O horário vem da configuração que a conta já tem
(FUNCIONALIDADES.md:367).

**Limite honesto:** as passadas andam por carona no webhook, no Inbox aberto e
no cron diário (`src/server/passada-de-transmissoes.ts`). Conta sem movimento
anda mais devagar que o pedido; fora do horário, nada sai.

**Banco:** `transmissoes.por_hora integer null` (nulo = tudo de uma vez).

## 3. Baixar relatório em planilha

**Como:** botão "Baixar planilha" na tela de relatórios, que baixa um CSV do
período e do filtro da tela: um dia por linha (conversas, automação, vendas,
espera) e uma aba de atendimento por pessoa quando houver. Rota
`/api/clientes/[clienteId]/relatorios/csv`, mesma permissão da tela.

**Banco:** nada.

## 4. Saber quem clicou no link da transmissão

**Hoje:** o link do botão é fixo no modelo aprovado pela Meta; ninguém sabe
quem clicou. O rastreio assinado já existe para card de produto
(`src/server/link-de-produto.ts`).

**Como:** ao criar modelo com botão de link, opção "Contar cliques" (ligada).
O modelo vai à Meta com o link passando por nós e um código variável no fim;
o destino real fica guardado no modelo. No envio, cada destinatário recebe
um código assinado; o clique anota em `transmissao_destinatarios` e
redireciona. Na mensagem comum do item 1, os links do texto passam pelo mesmo
caminho.

**Limite:** só vale para modelo criado depois disso. Modelo antigo continua
sem contagem.

**Banco:** `transmissao_destinatarios.clicada_em timestamptz null`.

**Tela:** coluna "Clicaram" no detalhe da transmissão.

## 5. Comentários da pesquisa de satisfação

**Hoje:** o bloco "Satisfação (NPS)" dos relatórios mostra nota, média e
distribuição. O "por quê?" é guardado (`guardarComentario`,
`src/server/repos/avaliacoes.ts`) e `comentariosDaConta` não é chamada em
lugar nenhum.

**Como:** no bloco de satisfação, os últimos comentários do período, com
nota, nome do contato e link para a conversa.

**Banco:** nada.

## 6. E-mail como passo do fluxo (depois)

Bloco novo "Enviar e-mail" no editor (`src/core/flow/schema.ts`): para quem
(o contato ou um endereço fixo), assunto e texto com variáveis. Sai pela Brevo
(`src/server/email.ts`) com remetente `autofluxos.mail.4yu.com.br` e
responder-para o e-mail da conta. Teto diário por plano para não queimar a
reputação do domínio de envio. 2 a 3 dias.

## 7. Devolver a venda para a Meta (depois)

Conversions API para mensagens: evento `Lead` quando o contato entra no funil
e `Purchase` em `oportunidade.ganha`, com o `ctwa_clid` já gravado
(FUNCIONALIDADES.md:310). Conta escolhe o conjunto de dados (pixel) na tela
de anúncios. A confirmar na documentação da Meta: permissão exigida e se o
conjunto de dados precisa estar ligado à WABA. 3 dias.

## 8. Telegram completo (depois)

Conectar por token do BotFather, `setWebhook` para uma rota nossa, receber
mensagens no Inbox e ligar `disponivel: true` em `src/core/canais.ts`. O
envio já existe (`src/channels/telegram.ts`). Sem App Review. 3 a 5 dias.

## 9. Redistribuir a fila quando um atendente sai (depois)

Quando a presença de alguém vira ausente (FUNCIONALIDADES.md:364), as
conversas dele sem resposta há mais de X minutos voltam para o rodízio, com
nota na conversa. X configurável por conta. 3 a 4 dias.
