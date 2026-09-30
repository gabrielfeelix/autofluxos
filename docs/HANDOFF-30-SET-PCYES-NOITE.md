# Handoff 30/set/2026, noite: PCYES e o e-commerce no WhatsApp

Para o próximo agente, que continua a otimização do bot e da Inbox da PCYES.
Substitui `HANDOFF-30-SET-PCYES-BOT.md` e `HANDOFF-30-SET-INBOX-TEMPO-REAL.md`
(no git em `e1aadac`). Leia inteiro antes de mexer.

## Regras e jeito de trabalhar

- Regras do repo valem (`AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`). Em
  30/set o Gabriel autorizou nomeando: **"pode editar o banco de produção"** e
  **"pode mexer na Vercel de produção"**. Vale para a PCYES; mudança de login,
  Auth ou outra conta pede confirmação de novo.
- A PCYES atende cliente de verdade agora. Erro vira cliente sem resposta.
- O Gabriel não quer ouvir sugestão de trocar de chat nem de `/clear` por
  custo de tokens (memória `nunca-sugerir-trocar-de-chat`). Resposta curta,
  decisão tomada, commit e deploy sem perguntar.
- Deploy: push na `main` publica. Espere o SHA **de `git rev-parse`**, não o
  que você acha que é; nesta sessão o monitor esperou SHA errado três vezes.
  Outras sessões também commitam (avatar da Inbox, `ef77e62`).

### Acesso ao banco de produção

Não há `DATABASE_URL`: use a Management API com `SUPABASE_ACCESS_TOKEN` do cofre
(`4yu-apps/.secrets/4yu.env`) e o ref `xxxynoshwirupkdzwxbj`. Leitura dentro de
`begin transaction read only; ...; commit;`. Segredos do Vault saem por
`select public.ler_segredo('<secret_id>')`; nunca imprima o valor.

- Conta PCYES: `64dbc3a9-1f77-4892-9770-e3e4be9e14cd`.
- Loja: `lojas_integradas` (Magento `https://www.pcyes.com.br`, token em
  `connections.secret_id`) e `frete_rapido_ref` (token da Frete Rápido).
- Fluxos: `flows.rascunho` e `flow_versions`. Publicar = `update flows set
  rascunho` + `select public.publicar_fluxo(id, grafo)`, **depois** de validar
  com `validar()`. E confira `flows.ia_habilitada` do fluxo: o script de
  montagem valida com IA ligada, o banco pode estar com ela desligada (foi o
  handoff do Saraiva em 30/set, "o fluxo pediu IA e não há modelo").

## Fluxos da PCYES publicados

| Fluxo | id | versão | IA |
|---|---|---|---|
| Boas-vindas e menu | `abd4df71-cfa0-4e5c-a39d-af2aa57866cb` | 5 | sim |
| Vendas com IA | `baff0b15-36ce-4740-a805-f049f0ab39b1` | 9 | sim |
| Drivers e manuais | `968c958a-af07-43e8-b68a-79ad326c2849` | 4 | sim |
| Meu pedido | `a7db904f-00fa-48b7-81a5-4b828fce82cc` | 5 | sim |
| Suporte / Empresa / Parcerias | Encaminhar para outro WhatsApp | | não |

Montagem reproduzível: `scripts/fluxos/pcyes-triagem.mts` (lê os rascunhos de
uma pasta, grava `.novo.json` e valida). A instrução de vendas da v9 foi
editada à mão por cima disso (busca pelo modelo; produto sem estoque manda o
card e explica o "Avise-me"): rode o script a partir do rascunho **atual**.

- Menu: `entendeTextoLivre` liga a saída "escreveu outra coisa" a uma IA de
  triagem (`triagem`), que roteia para o fluxo do assunto. Quem volta a
  escrever até 2 h depois do fim cai direto na triagem (`{{retomada}}`), sem
  saudação. INICIO mostra o menu.
- Vendas e Drivers pulam a pergunta inicial quando a pessoa chegou pela
  triagem (condição `veio-do-botao` sobre `{{assunto}}`).
- Perguntas sem prazo; prazo vencido sem saída vai para a fila calado.

## O que entrou no código em 30/set (tudo no ar, último deploy `c1ab14f`)

- Carrossel: frase da IA e cards numa mensagem (`src/core/juntar-cards.ts`).
- Cadeia de IA grátis na ordem Cerebras, Gemini, Groq (`src/server/ia/modelo.ts`).
  Groq grátis tem 8.000 tokens/min e estourava em turno de venda.
- Envio que cai na rede repete 2x (`comRetentativaDeConexao`); Inbox tem
  "Tentar de novo" em envio não confirmado.
- Encaminhado a outro time e terminou: conversa resolvida.
- Conversa nasce com responsável (distribuição na abertura); quem responde
  conversa sem dono vira responsável. Só a PCYES usa distribuição.
- Retomada do bot volta calada, sem aviso cobrado.
- Inbox sem "F5 sozinho": nada de `revalidatePath` em envio, nada de
  `router.refresh` no pulso; conversa aberta não perde mensagem; contador
  "(N)" na aba; números da barra contam só conversa esperando resposta e vêm
  pela fila viva; "Minhas conversas" abre o filtro certo; prévia mostra sempre
  a última mensagem; "Passar" virou "Transferir" e começa vazio.
- Status do pedido na Inbox (ícone de localização, `seletor-de-pedido.tsx`,
  `acoes-pedido-do-inbox.ts`): busca por número (aceita "1955"), mostra de quem
  é e se o telefone confere, manda situação, transportadora, previsão, última
  atualização, itens e total com o botão **Rastrear entrega**.
- Rastreio: o Magento da PCYES grava no envio o link inteiro
  `https://ondeestameupedido.com.br/FR260928DHHN5`; `linkDoRastreio` aceita
  link ou código. A permissão "Vendas › Operações › **Postagens**" foi liberada
  na integração em 30/set (antes dava 401). O bot também recebe
  `linkDoRastreio` e `andamento` no `loja_pedido`.

## Pendências, em ordem

1. **MGM Pilates (cliente pagante): nenhuma mensagem enviada no histórico.**
   Visto pelo Gabriel na Inbox em 30/set à noite e conferido no banco: a MGM
   tem 1.636 mensagens de `entrada` com `historico=true`, **zero de `saida`**
   e só 1 entrada ao vivo. Até a mensagem de hoje às 09:46 (Maria Augusta)
   entrou como histórico, e a Inbox diz "Passaram 24h" numa conversa de
   horas atrás. O canal (+55 11 93213-9312, `cloud-api`, coexistência) foi
   conectado de novo em 30/set às 14:25 (`coexistencia_em`), com a importação
   do histórico em 68%. Analisar:
   - se a importação (`historico_sync`) descarta as mensagens que a empresa
     mandou pelo app (devem entrar como `saida`, eco da coexistência);
   - se o webhook ao vivo do número novo está assinado e chegando (só 1
     entrada ao vivo);
   - se a janela de 24h ignora mensagem com `historico=true` mesmo quando ela
     é de hoje (`ultima_entrada_em`).
   Ver também a memória `mgm-falta-ligar-fluxo-no-canal`: falta fixar
   "Fluxo - Atendimento" no WhatsApp do Daniel quando o Gabriel avisar.
2. **Mensagens em rajada (PCYES).** "Olá boa tarde", "Tudo bem", "?" viram três
   rodadas e respostas por cima do menu (Saraiva, 30/set 14:04). Proposta:
   juntar o que chega em ~3 s numa rodada e não responder cumprimento solto logo
   depois do menu.
3. **Teste real do que entrou hoje**, pelo WhatsApp da PCYES e com duas abas da
   Inbox: triagem por texto livre, "obrigado" depois do Suporte, carrossel,
   RTX 5060 sem estoque, status do pedido 000001955 com o botão de rastreio,
   números da barra atualizando sem F5.
4. **Métricas**: resolução sem humano, mensagens por conversa (custo desde
   1/out, a Meta cobra cada mensagem de serviço), clique no botão da loja.
5. Chave grátis do **Cerebras** (`CEREBRAS_API_KEY`, o Gabriel cria em
   cloud.cerebras.ai): mesmo modelo do Groq com cota maior, vai primeiro na
   cadeia. IA paga só depois que a empresa aprovar o teste grátis.
6. O WhatsApp do Suporte (44) 2101-1428 pode não responder quem o bot manda
   para lá (Bruno Cunha: "Suporte não responde.", 30/set 13:21). Avisar o
   Gabriel se aparecer de novo.
7. Menor: tela do canal com o técnico num bloco "Avançado"; cupom (primeira
   compra) como ferramenta do bot; áudio automático só com chave paga.

## Pegadinhas que já custaram tempo

- O Magento numera pedido com 9 dígitos (`000001955`); gente digita `1955`.
- Status `delivered_carrier` é da PCYES ("Entregue à transportadora").
- O andamento da entrega está nos comentários do pedido
  ("Em Transferência - 28/09/2026 às 21:32:52"); `andamentoDoPedido` lê só os
  que têm esse formato.
- Produto sem estoque volta na busca com `emEstoque: false`; buscar pela
  categoria "placa de video" traz 635 itens e esconde o modelo pedido.
- Coexistência: a saudação automática do app chega como eco com U+200E e não
  pode calar o bot (`ehMensagemAutomaticaDoApp`).
