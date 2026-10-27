# Handoff 27/out/2026: integrações de cardápio e delivery

## O pedido do Gabriel

Conectar o AutoFluxos a toda plataforma de cardápio digital ou delivery
próprio que der alguma conexão (catálogo, status do pedido, aviso ao cliente),
para o bot avisar quem pediu ("saiu para entrega", "está chegando"). O que
faltar, a gente cria. Ele quer decisão tomada e implementada, explicada curto.

## Leia antes, nesta ordem

1. `docs/PESQUISA-CARDAPIOS-DELIVERY.md`: o mercado e cada plataforma (API,
   catálogo, status, credencial, quem é concorrente).
2. `docs/PLANO-INTEGRACOES-CARDAPIO.md`: as fases 0 a 9 e as decisões de
   arquitetura.
3. `docs/superpowers/plans/2026-10-27-cardapios-fase-0-e-1.md`: o plano
   executável das Fases 0 e 1, tarefa por tarefa.
4. `docs/BANCO-COMPARTILHADO.md` antes da migration (Task 2).

## Sua tarefa

Executar o plano das Fases 0 e 1 inteiro (Tasks 1 a 6), com a skill
`superpowers:executing-plans`, **inline, sem subagente** (o Gabriel não gosta
da espera cega). Depois, escrever e executar um plano por plataforma, na
ordem: Cardápio Web, OlaClick, Open Delivery, Goomer, Delivery Direto, Foody,
Neemo. Cada uma: conector em `src/cardapios/<plataforma>.ts` implementando
`ConectorDeCardapio`, webhook em `/api/cardapio/<plataforma>`, tela de
conexão, e a passada de polling na rota `/api/manutencao/pedidos` (GitHub
Actions, 10 min) como rede de segurança.

## Paradas obrigatórias com o Gabriel

- **Migration 0154** (Task 2): ensaio com `rollback`, depois pedir
  autorização para aplicar. Nada em produção sem o ok dele.
- **Textos dos 4 modelos de aviso** (Task 4): mostrar e esperar o ok antes de
  submeter à Meta.
- **Goomer e Delivery Direto** exigem parceria: ofereça escrever a mensagem;
  quem manda é ele.

## Estado de partida

- No `main`: pesquisa pós-compra virou produto em 26/out (`cfed6b2e`,
  `821c0730`, `96e8bfbe`, `3cae758d`), com evento `pedido.<status>`,
  "começar pelo modelo" (0152) e passada de pedidos da Magento (0153). A
  passada de 10 min e o segredo `AGENDADOR_SEGREDO` (Vercel + GitHub) já
  existem: reaproveite.
- Outra sessão mexeu em `src/core/evento-com-modelo.ts` e
  `src/server/acoes-evento-com-modelo.ts` em 27/out (imagem do cabeçalho
  voltou a ser campo da configuração do evento). Confira o estado atual antes
  de tocar.
- O quadro de Pedidos (0146) já existe e avisa o cliente só dentro das 24h:
  é o que a Task 4 resolve.
- **Docker não está ligado na WSL**: sem Supabase local, sem print de tela e
  sem os testes que precisam de banco. Diga isso no relatório em vez de fingir
  que conferiu. Está na lista de pendências do Gabriel.

## Regras que pegam aqui

- Commit só por pathspec (`git commit -- <arquivos>`): outra sessão usa a
  mesma árvore e já levou arquivo alheio por engano uma vez.
- Push com o helper do `GITHUB_TOKEN` do cofre; conferir deploy READY em
  segundo plano; juntar pushes (cota de deploy da Vercel é dividida com a
  Verandi).
- `npx tsc --noEmit -p .` limpo; testes só dos arquivos mexidos.
- Nenhum travessão longo em arquivo; placeholder com "Exemplo:"; tom de SaaS
  B2B na tela; logos oficiais de terceiros, nunca desenhadas.
- Feature nova em `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`; pendência do
  Gabriel em `../PENDENCIAS-DO-GABRIEL.md`.

## Futuro (não é desta tarefa)

O Gabriel quer, depois, um sistema próprio de pedidos e catálogo para
restaurante (com nota fiscal e gateway), como a Verandi. Mantenha o modelo de
pedido e catálogo genérico para não fechar essa porta.
