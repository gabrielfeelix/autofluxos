# Plano: barra fixa, esqueletos fiéis e celular com cara de app

Pedido do Gabriel em 23/set/2026. Branch `ux/casca-esqueletos-celular`, pasta
`../autofluxos-casca`, porta 3105. Conta de print: "Studio Pilates Revisão"
(banco local, tem dado de verdade em todas as telas).

## Por que as três coisas saíam erradas

**A barra recarrega a cada clique.** Não existe `layout.tsx` em
`clientes/[clienteId]`. Cada `page.tsx` desenha a própria `ClienteShell`, e cada
`loading.tsx` desenha uma barra lateral falsa (`EsqueletoDoCliente`). Trocar de
tela desmonta a barra real, mostra a falsa e monta outra real. É o F5 que ele vê.

**Os esqueletos não parecem a tela.** Seis telas não têm `loading.tsx` próprio
(Atividades, Relatórios, Respostas, Favoritas, Configurar, ficha do contato) e
herdam o do Início, que é uma grade de cartões em três colunas. Por isso
Atividades mostra cartões. As que têm esqueleto foram desenhadas de cabeça, sem
print ao lado, e ninguém comparou uma com a outra.

**O celular é o computador espremido.** A barra lateral vira uma faixa de abas
que rola de lado no topo.

## Fase 1: a barra vira layout e para de recarregar

- [x] 1.1 `clientes/[clienteId]/layout.tsx` com a moldura: barra, faixas de
  suporte e impersonação, conferência de acesso à conta. Sem mover nenhuma
  pasta (outros agentes trabalham nessas páginas; mover arquivo é conflito em
  todo rebase).
- [x] 1.2 O item aceso sai do `usePathname`, não mais do `ativa` de cada página.
- [x] 1.3 O editor de fluxo continua tela cheia: a moldura (componente de
  cliente) não desenha a barra quando o caminho é `/fluxos/<id>`.
- [x] 1.4 `ClienteShell` vira só a guarda da seção (sem acesso, funil
  desligado) e o miolo. As páginas não mudam de assinatura.
- [x] 1.5 `loading.tsx` das seções deixam de desenhar barra: só o miolo. O
  `loading.tsx` de `[clienteId]` continua com a barra, porque é o de quem chega
  de fora (lista de clientes, link salvo).
- [x] 1.6 Prova: navegar Início → Inbox → Contatos com Playwright e conferir que
  o `<aside>` é o **mesmo nó** do DOM (marcador gravado nele não some).

## Fase 2: um esqueleto por tela, copiado do print

Método, igual para toda tela:

1. Print da tela pronta com dado (1440 e 390).
2. Esqueleto desenhado em cima do print: mesmos blocos, mesma altura de
   cabeçalho, mesmas colunas, mesmo número aproximado de linhas.
3. Rota de conferência só no dev (`/dev/esqueletos/<tela>`, `notFound()` em
   produção) que desenha o esqueleto dentro da moldura real.
4. Print do esqueleto e **sobreposição** dos dois (50% de opacidade). Só passa
   se os blocos grandes caem no mesmo lugar e a altura total não pula.

Telas: Início, Inbox, Atividades (lista e agenda), Contatos, ficha do contato,
Funil, Automações, editor de fluxo, Transmissões, Relatórios, Configurações e as
subpáginas de Configurações, Respostas, Favoritas.

- [ ] 2.1 Rota de conferência e script de sobreposição.
- [ ] 2.2 Inbox (inclusive o "fica curto e depois cresce": altura do miolo).
- [ ] 2.3 Atividades.
- [ ] 2.4 Configurações e subpáginas.
- [ ] 2.5 Início, Contatos, ficha, Funil.
- [ ] 2.6 Automações, editor, Transmissões, Relatórios, Respostas, Favoritas.

## Fase 3: celular com cara de aplicativo (abaixo de `md`)

Topo:
- esquerda: foto da pessoa e "Olá, Gabriel" (primeiro nome);
- direita: menu hambúrguer. Abre uma gaveta que cobre quase a tela toda (sobra
  uma faixa à esquerda para fechar tocando fora) com o resto: Automações,
  Transmissões, Relatórios, Configurações, trocar conta, disponível/ausente,
  tema, perfil, sair.

Barra de baixo, fixa, cinco itens:

| 1 | 2 | 3 (centro) | 4 | 5 |
|---|---|---|---|---|
| Início | Contatos | **Inbox** | Atividades | Funil |

- O Inbox é o botão de destaque: círculo maior, cor da marca, levemente
  acima da barra, com o número de conversas esperando.
- Atividades mostra o contador de vencidas/hoje que já existe.
- Item que a pessoa não pode ver (permissão) ou Funil com CRM desligado: o
  lugar vai para o próximo da gaveta (Automações), para a barra não ficar
  com buraco.
- Com uma conversa aberta no Inbox, a barra some (o campo de escrever fica no
  lugar dela, como no WhatsApp).
- `safe-area-inset-bottom` respeitado; o miolo ganha o espaço da barra embaixo
  para nada ficar escondido atrás dela.

- [ ] 3.1 Topo e gaveta.
- [ ] 3.2 Barra de baixo com o botão central.
- [ ] 3.3 Inbox com conversa aberta, editor e diálogos por cima da barra.
- [ ] 3.4 Esqueleto de quem chega de fora também no formato novo.

## Como cada fase termina

Typecheck, eslint dos arquivos tocados, testes da área, prints antes/depois
olhados, commit por caminho, push da branch, rebase e merge na `main` pelo
procedimento de `docs/PARALELO-UX.md`, deploy conferido.

## Registro

| Data | Tarefa | Commit | Observação |
|---|---|---|---|
