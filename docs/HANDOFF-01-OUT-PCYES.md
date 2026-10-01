# Handoff 01/out/2026: PCYES, Inbox e MGM

Para o próximo agente. Substitui `HANDOFF-30-SET-PCYES-NOITE.md` (no git em
`4831128`). Leia inteiro antes de mexer.

## Regras e jeito de trabalhar

- Regras do repo valem (`AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`). Em 30/set o
  Gabriel autorizou nomeando: **"pode editar o banco de produção"** e **"pode
  mexer na Vercel de produção"**, para a PCYES. Escrever na loja Magento da
  PCYES (criar cupom, mexer em regra) foi autorizado caso a caso; pergunte de
  novo antes de outra escrita lá.
- Resposta curta, decisão tomada, commit sem perguntar. **Cada deploy dá F5 na
  Inbox de quem está atendendo** (sem Skew Protection no Vercel Hobby, o Next 16
  faz recarga completa na primeira navegação depois de um build novo,
  `doMpaNavigation`). Em 30/set foram ~40 deploys. Junte as mudanças e publique
  poucas vezes, de preferência fora do horário da PCYES (seg a sex, 8h às 18h).
- Deploy: push na `main` publica. Espere o SHA de `git rev-parse --short HEAD`
  ficar `READY` na API da Vercel (`VERCEL_TOKEN` do cofre, projeto
  `prj_17XxHvJ1vOAQ6j4mQSauCPA1BJXO`, time `team_hmVHyYO1YFO9fuAtpG9Ym2hm`).
- `tsconfig.json` aparece modificado sozinho (`.next/dev/dev/types`): é o
  `next dev`. Não commite.

### Acesso

- Banco: Management API com `SUPABASE_ACCESS_TOKEN` do cofre
  (`4yu-apps/.secrets/4yu.env`), ref `xxxynoshwirupkdzwxbj`. Segredo do Vault por
  `select public.ler_segredo('<secret_id>')`; nunca imprima o valor.
- Magento PCYES: token da integração em `connections.secret_id` (via
  `lojas_integradas.conexao_id`), usado como `Bearer` em
  `https://www.pcyes.com.br/rest/V1/...`. Permissões liberadas na integração:
  pedidos, envios, "Postagens", estoque e **Regras de Preço do Carrinho**
  (`Magento_SalesRule::quote`, liberada em 30/set). A loja não aceita compra de
  visitante: não dá para simular total com forma de pagamento.
- Produção pela tela: dá para entrar com `revisor.meta@4yu.com.br` (senha
  `REVISOR_META_SENHA` no `.env`) num Chromium do Playwright e medir requisições
  da Inbox. A conta é pequena e não tem loja.

## O que entrou em 30/set (tudo no ar, último deploy `d0bc624`)

Código (commits `3c26b31` a `d0bc624`):

- **Inbox**: trocar de conversa sem esqueleto (a conversa anterior fica até a
  nova chegar; a linha clicada acende na hora). Alfinete não cobre mais o
  horário. Números de não lidas (aba, pílula e barra lateral) contam conversa
  aberta com mensagem que **quem olha** não leu, a mesma regra da bolinha.
  "Minhas conversas", "Sem responsável" e "Todas" na barra lateral filtram na
  fila local sem ir ao servidor (`pedirFiltroDaInbox`, `fila-local.tsx`).
- **Iniciais**: `src/core/iniciais.ts` (NFKC, pula enfeite, corta por
  caractere inteiro) substituiu oito cópias. Nome com letra estilizada do
  WhatsApp não vira mais "��".
- **Cupom na Inbox**: ícone de tíquete na barra da resposta (loja Magento).
  Lista cupons ativos de código fixo, mais usados primeiro, e um clique manda
  "Cupom 10% off para o site: *CODIGO*". `src/loja/magento-cupons.ts`,
  `src/server/acoes-cupons-do-inbox.ts`, `src/components/lead/seletor-de-cupom.tsx`.
- **Tiques** ✓, ✓✓ e ✓✓ ciano: migration **0116** (`messages.situacao`, aplicada
  em produção). O webhook `statuses` grava só avançando
  (`avancarSituacaoDaMensagem`); a situação entra no pulso da conta; a rota da
  conversa devolve `situacoes`. Conferido: mensagens já gravando `entregue`;
  **`lida` ainda não foi vista acontecer**.
- **Rodapé da bolha** (autor, hora, tiques) preso no canto inferior direito,
  como no WhatsApp (`RodapeDaBolha` em `historico.tsx`).
- **Mensagem enviada não some** ao sair e voltar: o histórico busca o que veio
  depois da cópia em cache ao montar.
- **Coexistência**: o `history` da Meta só manda `to` no eco; mensagem que o
  negócio mandou vem só com `from`, e o cliente é o `thread.id`. Antes ela era
  descartada em silêncio (`contatoDaMensagem` com `daThread`).

Banco e loja (não passam pelo git):

- `clients.horario_atendimento` da PCYES: **seg a sex, 08:00 às 18:00** (estava
  9h às 17h e o bot disse "fechado" às 17:51).
- `clients.contexto_negocio` da PCYES ("Sobre o negócio", lido pela IA em todo
  fluxo): seção PAGAMENTO com **Pix 5%** (o preço da loja é o do cartão); seção
  CUPOM com **só o CHAT10**, regras e a soma com o Pix (**14,5%**, não 15%: o
  Magento aplica um desconto sobre o outro, decisão do Gabriel manter); seção
  "COMO ATENDEMOS" corrigida: Suporte, garantia e peça de reposição
  (44) 2101-1428, Empresa (44) 2101-1485, Parcerias (44) 98809-1552, todos em
  outro WhatsApp. O texto antigo dizia que tudo se resolvia aqui.
- Fluxo **Vendas com IA v10**: peça de reposição vai para o Suporte; o bot
  nunca pede foto, vídeo, nota fiscal ou número de pedido (vídeo manda a
  conversa para a fila, "o bot só lê texto").
- Magento: regra **92 "[PCYES] CUPOM CHAT10"**, cupom `CHAT10` (id 64), cópia da
  regra 36 (WERDUM10): 10%, todos os grupos, sem fim, 10.000 usos, exclui
  placas de vídeo, placas-mãe e memória RAM (categorias 9, 16, 55; 27, 28, 35
  inativas). Testado num carrinho: igual ao WERDUM10. Serve para medir vendas
  que vieram do chat.

## Pendências, em ordem

1. **Testar o que entrou** numa conversa de teste (DDD 44 é do Gabriel): cupom
   pelo ícone; bot respondendo cupom e Pix; tique virando ciano quando o
   celular lê; mensagem enviada continuando ao sair e voltar; peça de
   reposição indo para o Suporte.
2. **F5 sozinho, sem clique**: não reproduzido. Hipóteses descartadas com
   prova: `replaceState` da fila, prefetch, cookie de sessão, actions que
   revalidam. A recarga ao trocar de conversa vinha dos deploys. Se o Gabriel
   relatar de novo, pegar o horário e cruzar com os deploys.
3. ~~Mensagens em rajada~~: feito em `ef5fd80` (`core/rajada.ts`). Texto
   espera 3 s; se outro texto da pessoa chega, só o último responde e a IA lê
   a rajada inteira. Falta ver acontecer numa conversa real.
4. ~~Métricas~~: feito em `8fe56f8`. Relatórios ganharam "Mensagens enviadas"
   (só API: robô + equipe, sem o eco do celular nem o site) e "Cupons
   mandados" (cupom ativo do Magento citado numa saída do período, com pedidos
   e receita da loja, sem cancelado). "Resolvidas pela automação" já existia.
   Não vi os dois blocos com dado: a conta revisora não tem loja nem envio.
5. **MGM**: o histórico importado antes de `ca6f064` não tem as mensagens que a
   MGM mandou, e não volta sem reconectar o número, o que o Gabriel recusou.
   Ver também a memória de fixar "Fluxo - Atendimento" no canal do Daniel.
6. Menor: o seletor de cupom não foi visto na tela da PCYES; a lista tem ~45
   cupons de parceiro.
7. **Tom profissional no sistema inteiro** (pedido do Gabriel em 01/out,
   "não está profissional"). Varrer rótulos, status, selos, botões, avisos e
   estados vazios do `src/` e trocar linguagem informal pelo padrão de SaaS
   B2B. Exemplos que ele citou: "Gente esperando" → "Cliente aguardando";
   "Sem conversa no mês" → "Sem atividade no mês"; "repassar para humano" →
   "transferir para atendente". Começa em `src/app/admin/organizacoes/(lista)/page.tsx:193`
   e `src/app/admin/consumo/page.tsx:31`. Inclui textos que o bot manda
   (`AVISO_DE_ESPERA`, `AVISO_DE_HANDOFF` em `receber-mensagem.ts`).
8. **Revisão das conversas de 30/set** (feita em 01/out): o que sobrou aberto.
   ~~"9h às 17h" nos fluxos~~: 8h às 18h publicado em 01/out (Suporte v5,
   Compra para empresa v5, Parcerias v5, Meu pedido v6). Saudação
   automática do app ("Pcyes Ecommerce agradece seu contato") ainda ligada no
   celular, duplica a do bot; reclamação ("Suporte não responde") volta ao
   menu em vez de ir para a equipe. Lições viraram regra geral em `3cfdad9`
   (prompt e ficha de e-commerce) e `0162b37` (bolha única).

9. **Modal "Nova chave" com clique ruim** (`ajustes/chaves`, relato de
   01/out): clicar perto do seletor "Como ela entra na chamada" abre o
   dropdown, e clicar no espaço entre campos dispara o aviso de sair com texto
   preenchido. Só dentro do campo ou fora do modal se comporta. Suspeita: o
   rótulo envolve o seletor, e o clique no fundo do modal conta como "fora".
10. **Galeria de integrações com logo** (pedido de 01/out): um card por
   integração conhecida (Meta, WhatsApp, Instagram, Magento, Nuvemshop,
   Verandi, Google Agenda), cada um com seu jeito de ligar: login (OAuth) onde
   o serviço tem, um campo "cole sua chave" onde não tem, e "Outra integração
   → Nova chave" para o resto. O primeiro card é **Conectar com Meta**: login
   do Facebook, escolhe as Páginas, e o sistema gera o token, assina
   `subscribed_apps` e grava `paginas_de_lead` sozinho. Para Página de cliente
   depende do App Review (`leads_retrieval`, `pages_manage_metadata`,
   `pages_manage_ads`, `ads_read` em Advanced). O vídeo do review é esse botão.
11. **Lead Ads, teste manual em andamento** (01/out): usuário do sistema
   `autofluxos-ads` (Funcionário; o portfólio só aceita 1 admin) com a Página
   4YU e o app; caso de uso "Capturar e gerenciar leads" adicionado ao app;
   token com as 6 permissões guardado como `meta-ads` na conta 4YU
   (`f175bf85-...`). Falta: `subscribed_apps` na Página, `paginas_de_lead`,
   lead pela Lead Ads Testing Tool. Se der erro de permissão, Instagram e Lead
   Ads vão juntos para o App Review (Instagram foi reprovado por falta de
   screencast).

## Pegadinhas novas

- O pulso da conta muda sem mensagem nova (arquivo baixado, tique). Quem
  compara pulso por hora precisa tratar empate como "o que chegou por último"
  (`pulsoDaTela`, `fila-viva.ts`), senão a tela pede atualização a cada batida.
- Bolha que sai é azul: tique azul some. Lida usa ciano `#7ee8fa`.
- Erro no admin do Magento "Neighborhood is a required field" ao contratar
  frete: é o módulo da Frete Rápido com o complemento (3ª linha do endereço)
  vazio. Resolve preenchendo a 3ª linha com o bairro. Não é nosso.
- Desconto do Pix da PCYES é a regra 48 (sem cupom, condição forma de pagamento
  `pix`); a tela "Pix Discount Label" do Magento é só o texto do site.
