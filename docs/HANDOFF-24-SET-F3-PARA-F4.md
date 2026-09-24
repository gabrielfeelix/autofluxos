# Handoff 24/set: F3 feita, próximas são a F4 e o pedido da F6

Plano: `docs/PLANO-NAVEGACAO-E-CRM-2026-09-24.md`. Os blocos "Estado da F1",
"Estado da F2" e "Estado da F3" (seção 7) dizem onde cada peça mora. As
decisões do plano foram aprovadas pelo Gabriel: não reabrir nomes nem
estrutura.

## Onde parou

- F1, F2 e F3 **em produção**. F3 = commit `ff679e2`; push junto com
  `c9c2b69` (do outro agente, migration 0102), deploy READY em 24/set.
- Última migration: `0102_plano_de_verdade.sql` (do outro agente, aplicada em
  produção). A próxima se descobre com `ls supabase/migrations | tail -1`, na
  hora, nunca por este arquivo.
- Não há migration pendente.

## Dois trabalhos, em paralelo, que não se tocam

| | Agente A: F4 Loja | Agente B: pedido de verificação da F6 |
|---|---|---|
| Mexe em código | sim | **não** |
| Mexe em banco | sim (migration, só local sem autorização) | **não** |
| Sobe servidor | sim, `next build` + `next start` numa porta livre | não |
| Entrega | telas + commit local | documento + links para o Gabriel clicar |

F5 (pedido pago e carrinho abandonado como gatilho) **só depois da F4**: ela
precisa de uma loja com webhook conectada. F6 além do pedido (construir a
agenda) **só depois de o Google aprovar**.

## F4: Loja (plano, seção 5.6)

Ordem: primeiro a tela e o "Quero esta" (rápido, entrega valor sozinho),
depois uma plataforma por vez, cada uma **depois** de pesquisar a API dela.

- **Tela "Conectar loja"**: grade de cartões por plataforma, Brasil primeiro.
  Magento/Adobe Commerce aparece como **Conectada** (já existe, PCYES). À
  direita, o que a conexão rende (o bot responde com produto, estoque e link;
  carrinho abandonado vira mensagem; pedido pago vira negócio ganho).
  Estado vazio que ensina e tem botão.
- **"Quero esta"** nos cartões "Em breve" (VTEX, Tray, Loja Integrada, e
  Shopify por ora): grava o pedido por conta. É a medida de demanda.
- **Onde mora hoje**: `/loja` redireciona com 307 para `/loja/magento` "até a
  F4 existir" (F1, `next.config.ts`). A F4 troca isso pela tela nova; o
  subitem "Conectar loja" em `SECOES` (`secoes-do-cliente.tsx`) aponta para
  `/loja/magento` e deve passar a apontar para a tela nova. Nenhum link salvo
  pode quebrar.
- **Banco**: `lojas_integradas` (migration `0092`) tem
  `check (plataforma in ('magento'))`. Migration nova amplia o check e cria o
  lugar do "Quero esta". O plano também pede **interruptor de Loja** em
  Objetivo e recursos (hoje `lojaVisivel` em `repos/recursos.ts` decide por
  objetivo `vender`, loja conectada ou catálogo com item). Ler
  `docs/BANCO-COMPARTILHADO.md` inteiro antes; aplicar só no local; pedir
  autorização antes de produção; registrar no mesmo arquivo como a `0101`.
- **Nuvemshop, depois WooCommerce**: antes de codar, pesquisar como autentica,
  se avisa pedido e carrinho por webhook, se exige app publicado. Registrar em
  `docs/INTEGRACAO-MAGENTO-23-SET.md` (seção nova por plataforma). Material do
  Magento para copiar o jeito: `docs/HANDOFF-23-SET-MAGENTO.md`,
  `docs/GUIA-MAGENTO-LOJISTA.md`.
- **Aceite sugerido**: todo cartão leva a um próximo passo; "Quero esta" grava
  uma vez por conta e mostra que gravou sem recarregar; estúdio de pilates
  (sem objetivo de venda, sem loja) não vê Loja; `/loja` e `/loja/magento`
  antigos continuam abrindo.

## F6: só o pedido de verificação ao Google (plano, seção 6)

Por que agora: ler e escrever agenda é escopo sensível, o Google exige
verificação do app e ela leva **semanas**. O relógio só começa quando o
pedido é enviado.

O que se sabe e o que falta descobrir:

- O app **não tem nada de Google hoje** (sem login Google, sem OAuth). Tudo
  começa do zero.
- Projeto GCP: service account **não cria projeto** (ver
  `4yu-apps/CLAUDE.md`). Se precisar de projeto novo, quem cria é o Gabriel;
  decidir se usa `yu-automation` ou um projeto próprio do AutoFluxos (o
  pedido de verificação é por projeto e mostra o nome dele ao usuário final).
- Descobrir e escrever: quais escopos mínimos (ex.: só eventos, sem ler a
  agenda inteira), tela de consentimento (nome, logo, domínio
  `autofluxos.4yu.com.br`, e-mail de suporte), política de privacidade (a
  rota `/privacidade` existe; conferir se cobre dados do Google e o "Limited
  Use"), vídeo de demonstração que o Google pede, domínio verificado no Search
  Console (a SA é Owner de `sc-domain:4yu.com.br`).
- Entrega: `docs/VERIFICACAO-GOOGLE-AGENDA.md` com o passo a passo, o texto
  pronto para colar em cada campo e o **link clicável** de cada tela do
  console. Não criar credencial, não mexer em código, não commitar segredo.

## Como trabalhar com o Gabriel (vale para os dois)

- Não é dev: decisão tomada e implementada, não lista de opções. Resposta
  curta; pendência em uma linha. Link clicável para qualquer painel externo.
- Implementar sem subagente. Validar com `tsc` e build; rodar só os testes dos
  arquivos mexidos, nunca a suíte inteira.
- Tela: print local em 1440 e 390 antes de entregar, bonita e em largura
  cheia. Ação de salvar muda a tela na hora (otimista), sem recarregar a rota
  aberta.
- Nada de travessão em arquivo nenhum que abrir, inclusive antigos. Frase de
  exemplo dentro de campo começa com "Exemplo:". Editar arquivo grande com a
  ferramenta Edit, não com sed/python.
- Outro agente no mesmo diretório: `git status` antes, commit por caminho,
  nunca `git add -A`, nada staged sem commitar, `tsconfig.json` não se commita.
- Commit local ao fim da fase. Push e deploy só quando o Gabriel mandar.
  Antes do push, conferir `git log origin/main..HEAD`: commit de outro agente
  sobe junto.
- Ao terminar, atualizar no plano o "Estado da F4" no formato da F1 a F3.

## Armadilhas já pagas

- **Um `next dev` por pasta.** Para print confiável: `npx next build` e
  `next start` numa porta livre, com o ambiente de `scripts/ux-local/dev.sh`
  (cópia no scratchpad trocando `next dev` por `next start` e o `cd` por
  caminho absoluto). Derrubar pelo pid da porta (`ss -ltnp | grep :3107`),
  **nunca `pkill -f`**. Fechar o navegador depois: pouca RAM.
- Login local: `PORTA=<porta> node scripts/ux-local/entrar.mjs`. Cliente
  local `afacb27c-ec60-44a7-be3e-a66f4fc60976`. Scripts de print modelo:
  `.ux-local/f3.mjs` e `.ux-local/f3-acoes.mjs` (fora do git).
- Página com streaming: esperar o conteúdo, não só `networkidle`, senão o
  print pega o esqueleto.
- Conferir que o HEAD compila sem os arquivos não commitados dos outros:
  `git worktree add` no scratchpad, `ln -s` do `node_modules`,
  `npx next typegen` e `npx tsc --noEmit` (sem o typegen dá falso erro de
  `RouteContext`).
- `revalidatePath` numa server action faz o Next refazer a rota aberta no
  cliente mesmo quando o caminho revalidado é outro. A tela não perde estado
  se for otimista, mas não use para "atualizar a própria tela".
- Contagem pelo PostgREST: embutir `tabela(count)` em vez de trazer uma linha
  por vínculo; o teto de 1000 linhas corta em silêncio.
- Produção: Management API com `SUPABASE_ACCESS_TOKEN` do cofre e o ref
  literal `xxxynoshwirupkdzwxbj`. Ensaio em transação (`begin; ...;
  rollback;`) antes. Deploy: push na `main`; conferir READY com
  `.ux-local/deploy.sh <sha>`.
