# Handoff 02/out/2026: esqueletos fiéis e o que sobrou fora do padrão

Para o próximo agente. Leia antes `docs/HANDOFF-02-OUT-DS-FECHADO.md` (o que
já existe no DS e onde mora) e as entradas de 02/out em `docs/DECISIONS.md`.
O dono (Gabriel, designer) cansou de apontar a mesma classe de defeito tela a
tela. **Varra o produto inteiro, não só os exemplos abaixo**, e confira cada
tela que mexer em print 1440 e 390 antes de entregar.

## 1. O esqueleto mente sobre a tela (prioridade)

O carregamento tem que ter a **forma da tela que vai chegar**: mesmo topo,
mesma barra de busca, mesmos cartões no mesmo lugar. Hoje não tem.

- **Integrações** (`/ajustes/integracoes`): carrega com o
  `EsqueletoDeAjuste` herdado de `app/clientes/[clienteId]/ajustes/loading.tsx`
  (seis linhas de texto soltas no azul, sem título, sem cartão). A tela real é
  título + descrição, cartão largo "Disponível agora", grade 3×2 de cartões de
  plataforma e o painel "O que a conexão rende" à direita. Dê um `loading.tsx`
  próprio a ela.
- **Produtos** (`/loja/catalogo`, `loja/loading.tsx`): o mesmo problema, o dono
  citou nominalmente.
- **Todas as outras**: 35 `loading.tsx` em `src/app` (conta e admin) e as peças
  em `src/components/design/esqueleto.tsx` (`EsqueletoDeLista`,
  `EsqueletoDeCartoes`, `EsqueletoDeAbas`, `EsqueletoDeAjuste`...). Abra cada
  rota, tire print do carregamento (throttle de rede no Playwright ou um
  `await` artificial só local) e da tela pronta, lado a lado, e corrija o que
  não bater. Conhecidos: `EsqueletoDeAbas` ainda desenha aba sublinhada, mas
  Transmissões e Integrações agora usam o `Alternador`.
- Regra para o esqueleto: o topo é `CabecalhoDaTela` de verdade (título e
  descrição são estáticos, não precisam de osso), a barra de busca fica fora
  do cartão, e o osso mora dentro de cartão branco quando a tela real tem
  cartão. Esqueleto solto no azul só onde a tela real também é solta.

## 2. Ainda escrito à mão, fora do padrão

Conhecidos (o agente anterior viu e não fez):

- **Atividades**: os recortes Vencidas / Hoje / Próximas / Sem prazo
  (`components/atividades/barra-da-agenda.tsx`) são pílulas brancas próprias.
- **Inbox**: botões e campo dentro do painel "Status do pedido"
  (`components/lead/seletor-de-pedido.tsx`) e dos seletores irmãos
  (`seletor-de-cupom`, `seletor-de-produto`, `seletor-de-resposta-rapida`,
  `seletor-de-emoji`): `rounded-[9px] border ... px-2.5 text-[12px]` à mão.
- **Transmissões**: o esqueleto (ver item 1).

**Procure os outros.** Pistas de busca: `grep -rn "rounded-\(lg\|md\|\[[0-9]*px\]\) border" src`
com `px-`/`py-`/`text-[` na mesma classe, `bg-primary` com `text-white` fora
de `botao-*`, `<input` sem `app-field`, `type="checkbox"` sem
`caixa-de-marcar`, contador sem `Badge`, pílula sem `Pilula`, troca de modo
sem `Alternador`, cabeçalho de tabela fora de `design/tabela.tsx`. Cada achado
vira o componente que já existe; se não existir, crie no `design/` e registre
em `DECISIONS.md`.

## 3. A transparência que o dono gostou: use mais

"Eu gosto muito dessa transparência, acho chique." É o trilho do
`.alternador` no azul: fundo `var(--surface)` (branco a 13% na casca) com
borda `var(--line)` (branco a 22%), e o item aceso em branco sólido. O dono
liberou usar em outros lugares, não só no alternador. Candidatos, com
critério (controle ou agrupamento solto **no azul**, nunca dentro de cartão
branco, onde vira cinza claro):

- os recortes de Atividades (Vencidas/Hoje/...) e outros chips de filtro
  soltos no azul;
- os "Filtros ativos" das barras de busca (`ChipDeFiltro`);
- a `Contagem`/`Pilula` neutra ao lado do título;
- botões secundários de ferramenta soltos no azul, se ficar bom em print.

Faça como **variante nomeada** (ex.: `botao-vidro`, `pilula-vidro`), não
`bg-white/10` espalhado, e mostre ao dono em print antes de trocar em massa.

## Como trabalhar

- Local: `bash scripts/ux-local/dev.sh` (porta 3100), `node scripts/ux-local/entrar.mjs`,
  login `revisao@local.test` / `senha-local-123456` (no banco local ele já é
  admin, dá para ver `/admin/*`). Print: `scripts/ux-local/prints.mjs`; para
  carregamento, clique e `/admin`, script descartável apagado no fim.
- Valide com `npx tsc --noEmit -p .` e o teste do arquivo mexido, nunca a
  suíte inteira. Um processo pesado por vez (a WSL cai).
- Ao fim: commit, push na `main`, confira o deploy na Vercel (projeto
  `autofluxos`).
