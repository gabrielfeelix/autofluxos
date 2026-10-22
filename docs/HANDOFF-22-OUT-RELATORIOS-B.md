# Handoff: 22/out/2026, relatórios (parte b do que restou)

**Feito em 22/out na mesma sessão** (ver o fim de `docs/PLANO-COBRANCA-CAMADA-2.md`). Fica como registro.

Para o agente que continua. Contexto: `docs/PLANO-COBRANCA-CAMADA-2.md`
(seção b e o fim de Andamento). Pedidos e os blocos de pedido em Vendas já
estão no ar (`3ecb7055`, `5cade8f2`).

## Decisão do Gabriel (22/out)

Os três itens que estavam "adiados por causa do MGM" **devem ser feitos**. No
MGM Pilates (`5de5a891-790f-4c14-b60b-ce0a573fe1c7`, ramo `aulas`) só o
Daniel, dono, entra no painel do AutoFluxos; o resto usa só a automação e a
Verandi. Regra: **para o dono nada some, só acrescenta**. Nada muda na Verandi.

## O que fazer

1. **`ler_valores: proprios` no operador**: o atendente vê em R$ só as
   próprias vendas. Papéis padrão em `src/core/permissoes.ts` (ver o
   comentário da RB-40 perto da linha 164: não retirar acesso em massa sem
   prévia; aqui é acréscimo). Conferir onde `ler_valores` com escopo
   `proprios` filtra valores (Vendas usa `pode(acesso.regras, 'ler_valores',
   'proprios')` e `responsaveisDoEscopo` em `src/server/repos/relatorios.ts`).
2. **Seletor Eu / Equipe / Conta** em Análise (`relatorios/page.tsx` e
   `relatorios/vendas/page.tsx`), só para quem enxerga mais que o próprio.
   Padrão: o maior escopo da pessoa (dono abre em Conta, igual a hoje). Vale
   o endereço guardar a escolha, como período e funil. Com isso, o bloco de
   pedidos em Vendas pode aparecer também fora de "conta inteira" (hoje pedido
   não tem dono: decidir pelo `criado_por` ou pelo responsável do contato).
3. **Relatórios de aulas** em Vendas, só no ramo `aulas`, acrescentando
   blocos (entram na ordem pelo `primeirosEmVendas` do pacote `aulas` em
   `src/core/nichos.ts`, hoje vazio): matrículas no período, aula
   experimental que virou matrícula, mensalidade em dia (`assinaturas` e
   `cobrancas.competencia`, `src/server/repos/assinaturas.ts`,
   `src/core/mensalidade.ts`). **Faltas e evasão ficam de fora**: moram na
   Verandi, e ler `app_verandi` daqui cruza produtos no banco
   (`docs/BANCO-COMPARTILHADO.md`, proibido). Só com ponte própria.

## Regras e armadilhas já pagas

- Diferença por ramo só em `src/core/nichos.ts` (`PacoteDoNicho`): o teste
  `nichos.test.ts` reprova literal de ramo em outro arquivo. Ele já falha
  hoje por `core/modelos-prontos.ts` (de outro commit), não é seu.
- O pool `bancoDeDados()` entra como `autofluxos_dados` e não lê tabelas sem
  `grant` (ex.: `pedidos`, `produtos`); para elas use `db()` (supabase-js).
- O dev server local (`scripts/ux-local/dev.sh`, porta 3100) nesta WSL **não
  vê edição feita por sed/python/cat**: reinicie antes de tirar print, senão
  o print mostra código velho.
- Conta local para print: "Studio Relatórios Local"
  `71aa7f92-3814-49f4-a7b5-ee22ae53f826` (nicho `null`; trocar e devolver).
  Scripts: `.ux-local/vendas.mjs`, `.ux-local/pedidos.mjs`, `q-cobrar.mjs`,
  `aplicar-local.mjs`.
- pt-BR, curto, sem travessão; print 1440 e 390; `tsc` limpo, lint e só os
  testes mexidos; push com o `GITHUB_TOKEN` do cofre e conferir `READY`.
  Migration, se precisar: não há autorização para nenhuma além da 0146.
- Feature nova entra em `docs/vantagens/VANTAGENS-AUTOFLUXOS.md` (só
  acrescentar; outro agente mexe lá).
