# Handoff 25/set: ações otimistas no sistema inteiro

## O pedido do dono

Tudo que liga/desliga, anota, marca, atribui ou muda estado **muda na tela no
clique** e grava por trás. Quando o servidor responde, nada pisca: a tela já
estava certa. Só o próximo F5 traz o que veio do banco. Se falhar, volta ao
que era e diz por quê.

Prioridade dele, nesta ordem: **Inbox inteiro** (é importantíssimo que tudo lá
seja assim), depois **Negociações**, **Atividades / Agenda**, e o resto.

## Como fazer (o padrão que já existe)

- `src/components/design/acao-otimista.ts`: `useAcaoOtimista(inicial)` devolve
  `{ valor, erro, pendente, agir, limparErro }`. `agir(otimista, acao)` põe o
  valor já, roda a ação numa transição e desfaz se vier `{ ok: false }`,
  `{ erro }` ou exceção.
- Para listas (cartões, atividades), o molde é estado local + função que
  aplica a mudança e devolve quem desfaz: ver `mudarCartao` em
  `src/components/quadros/quadro.tsx` (commit `8f1a631`).
- Para estado mostrado em vários lugares ao mesmo tempo, store fora do React
  com `useSyncExternalStore`: ver `src/components/conta/presenca.ts`
  (commit `6773bba`).
- Painel que fecha no clique: a ação corre depois de fechar, e o erro sobe para
  quem abriu o painel, num `AvisoFlutuante`. Ver `marcar-atividade.tsx` e o
  `aoFalhar` em `inbox/acoes-rapidas.tsx` (commit `8f1a631`).
- **No servidor**: ação chamada de gesto rápido não faz
  `revalidatePath` da rota aberta nem do layout (`'/', 'layout'` recarregava o
  app inteiro e era o atraso de segundos da presença, commit `6773bba`).
  Revalidar outra rota, ou tag de cache, pode.
- **Não** é otimista (regra do próprio `acao-otimista.ts`): o que sai do
  sistema (mandar WhatsApp), o que apaga, lote lento (importar planilha), e
  fechar negócio ganho/perdido (dispara cliente e funil seguinte). Esses ganham
  estado de "Salvando…" no botão, não mentira na tela.

## Já otimista (conferido em 24 e 25/set, não refazer)

Inbox: resolver, adiar, pausar bot (`inbox/acoes-rapidas.tsx`), assumir
(`inbox/assumir.tsx`), mover no funil (`inbox/funil-da-conversa.tsx`), fixar e
não lida (`inbox/fila.tsx` `comRemendo`), anotação (`inbox/anotacoes.tsx`),
reação e favoritar (`lead/rodape-da-mensagem.tsx`), bot
(`atendimento/estado.tsx`), marcar atividade (`inbox/marcar-atividade.tsx`).

Ficha: estágio, temperatura, responsável (`lead-crm/*-do-contato.tsx`),
concluir/reabrir atividade (`lead-crm/atividades.tsx`).

Funil e negócio: arrastar cartão, atribuir/devolver/reabrir pelo menu
(`quadros/quadro.tsx`), quadro padrão (`quadros/quadro-padrao.tsx`), página do
negócio inteira (`negocios/pagina-do-negocio.tsx`, função `mudar`).

Cabeçalho: presença e avisos (`conta/linha-de-presenca.tsx`,
`inbox/notificacoes-da-fila.tsx` com `interruptor`).

## O que falta mapear e corrigir

1. **Inbox, varredura completa.** O mapa de 24/set cobriu os gestos
   principais. Falta passar arquivo por arquivo em `src/components/inbox/`,
   `src/components/lead/` e `src/components/atendimento/` procurando
   `await acao...` antes de mudar estado, `<form action=...>` em gesto rápido,
   `router.refresh()` depois de ação, e `useTransition` sem valor otimista.
   Candidatos a olhar: agendar mensagem (`inbox/agendar.tsx`, criar e cancelar
   agendada), etiquetas na conversa, trocar responsável pela fila, transferir,
   respostas rápidas, controle de automação (`lead/controle-automacao.tsx`).
2. **Negociações da ficha**: `lead-crm/negociacoes.tsx`. Tem nota dizendo que
   faz `router.refresh()` depois de fechar; o fechar pode ficar, o resto não.
3. **Editores da ficha**: `lead-crm/editores.tsx` (nome, campos, notas).
4. **Atividades e Agenda**: `atividades/lista-da-agenda.tsx` tem estado
   próprio (`pendentes`, `erros`, `saindo`), parece otimista mas não foi
   conferido. Conferir também criar, editar, adiar e apagar atividade na agenda
   e no calendário (arrastar no calendário, se existir).
5. **Etiquetas, segmentos, respostas rápidas** (telas do CRM): criar, renomear,
   repintar já são otimistas em etiquetas (`etiquetas/tabela-de-etiquetas.tsx`);
   conferir segmentos e respostas rápidas.
6. **Configurações e Administração**: por último. São a maior parte dos 193
   `revalidatePath` em `src/server/acoes*.ts` (contagem de 25/set).

Para cada item: diga no commit o que era (esperava o servidor, form action,
refresh) e o que ficou. Teste de verdade no local (`scripts/ux-local/dev.sh`,
porta 3100, precisa do Docker Desktop aberto) medindo o tempo entre o clique e
a mudança na tela; o script `.ux-local/menu.mjs` mostra como medir com
Playwright (a presença caiu para ~100 ms).

## Regras da casa que valem aqui

- Commit local por fase, **um push só no fim** (push na `main` é deploy na
  Vercel, e há limite de deploys). Conferir `READY` depois.
- Validar com `tsc` e eslint nos arquivos mexidos; não rodar a suíte inteira.
- `src/components/design/barra-lateral.tsx:194` já tinha erro de eslint
  (`set-state-in-effect`) antes de 25/set; não é seu.
- Sem travessão em nada escrito.
