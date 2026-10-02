# Handoff 02/out/2026: o que sobrou dos esqueletos e do DS

Para o próximo agente. Sequência de `docs/HANDOFF-02-OUT-ESQUELETOS-E-SOBRAS.md`.
Leia antes a entrada "esqueleto com a forma da tela, e o vidro" em
`docs/DECISIONS.md`. Em produção: `b9cf256`, `502c5e0`, `804e315` (deploy
READY na Vercel).

## O que já está feito (use, não refaça)

- Peças em `src/components/design/esqueleto.tsx`: `TopoCarregando`,
  `EsqueletoDeBotao`, `EsqueletoDeBusca`, `EsqueletoDeAlternador`,
  `EsqueletoDeLinhas`, `EsqueletoDoFunil`, `EsqueletoDeInbox`,
  `EsqueletoDeAjuste` (recebe título/descrição reais), `EsqueletoDeFormulario`.
- `loading.tsx` no formato da tela: Início, Atividades, Contatos, Fluxos,
  Negócios, Inbox, cartão de negócio, Relatórios, Transmissões, Produtos,
  Comércio › Integrações, Respostas rápidas, todas as subtelas de
  Configurações. Admin: `EsqueletoDeTabela` (`admin/partes.tsx`) com descrição
  e busca reais em todas as listas.
- Variante `.chip-vidro` (`globals.css`) só nos atalhos de prazo de Atividades.

## O que falta

1. **Conferir o admin em print.** Os esqueletos do admin foram trocados sem
   print lado a lado: o servidor local travou (load ~25). Telas: `/admin`,
   organizações, usuários, consumo, alertas, auditoria, pedidos, planos,
   funções e as abas da organização (resumo, dados, plano, pessoas,
   auditoria, perigo). Visão geral e as abas da organização são as mais
   prováveis de não bater.
2. **Print em 390** de todas as telas mexidas (conta e admin). Nenhuma foi
   conferida no celular nesta rodada.
3. **Aviso "1 Issue" do Next** em Configurações (apareceu em `/ajustes/plano`
   e `/ajustes/equipe`, com o esqueleto e com a tela pronta). Abrir o
   overlay ou ler o console com Playwright e corrigir.
4. **Vidro:** mostrar ao dono os atalhos de Atividades. Só depois de ele
   aprovar, levar para os outros candidatos: `ChipDeFiltro` ("Filtros
   ativos"), `Contagem`/`Pilula` neutra ao lado do título, botões de
   ferramenta soltos no azul. Variante nomeada, nunca `bg-white/10` solto.
5. **Sobras de DS que ficaram** (vistas, não feitas):
   - `transmissoes/[transmissaoId]/page.tsx`: "‹ Transmissões" à mão,
     `h1` à mão e selo de estado próprio (`rotulo.cor`). Trocar por
     `Trilha`, `CabecalhoDaTela` e `Pilula`.
   - `components/inbox/abas-da-ficha.tsx` e `components/editor/editor.tsx`:
     abas sublinhadas (`border-b-2`). Ficaram de propósito por serem abas de
     painel; decidir com o dono se viram `Alternador`.
   - Radios com `accent-[...]` em `recursos/escolher-objetivo.tsx`,
     `recursos/escolher-tipo-de-negocio.tsx` e `admin/tabela-de-planos.tsx`:
     não há classe de rádio no DS; criar `.radio-de-marcar` ao lado de
     `.caixa-de-marcar` se o dono quiser.
   - Canal Instagram: o esqueleto desenha a faixa de estado que só aparece
     quando o canal está conectado.
6. **`src/components/api/chaves-de-api.tsx`** (da sessão da API): troquei o
   checkbox para `caixa-de-marcar`. O arquivo não é meu; confira se a outra
   sessão manteve.

7. **Inbox vazio sem ilustração** (pedido do dono, 02/out). Com um filtro
   que não acha nada ("Meus atendimentos", por exemplo), a lista diz só
   "Nenhuma conversa neste filtro." (`components/inbox/fila.tsx:1079`) e o
   painel da direita só "Nenhuma conversa nesta seleção."
   (`components/inbox/painel-da-conversa.tsx:90`). As outras telas vazias
   têm ilustração com animação leve: usar a `IlustracaoInbox` de
   `components/design/ilustracoes.tsx` no painel da direita, que é onde
   sobra espaço, no mesmo formato das outras telas.

## Como conferir esqueleto (o que funcionou)

Atraso de rede no Playwright **não** mostra o `loading.tsx` no dev: o Next
segura a tela antiga. O que funcionou foi uma rota descartável que importa o
`loading.tsx` e renderiza dentro do layout real, por exemplo
`src/app/clientes/[clienteId]/zesq/page.tsx` (e `ajustes/zesq`, `admin/zesq`,
`admin/organizacoes/[id]/zesq`), com `?n=../caminho/loading`. Print dela ao
lado do print da tela pronta. **Apague as pastas `zesq` antes de commitar** e
não rode isso com outro processo pesado em paralelo.

Commit só dos seus arquivos: há outra sessão mexendo no mesmo repositório
(API, LP, ajuda). Nunca `git add -A`.
