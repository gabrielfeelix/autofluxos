# Handoff 02/out/2026: fechar o padrão de tela (DS) na casca azul

Para o próximo agente. O dono (Gabriel, designer) pediu o padrão de tela
**inteiro** e recebeu metade: está cansado de repetir. Faça tudo desta lista
numa passada, confira em print cada tela que mexer, e só então entregue.

## Onde estamos (tudo em produção até `05ba70d`)

- **Casca azul, opção C** (decisão em `docs/DECISIONS.md`, 02/out): fundo azul
  em degradê com fios; barra lateral é ilha **branca sólida**; cabeçalho e
  telas moram direto no azul; cartões brancos. Protótipo de referência:
  https://claude.ai/artifact/UBK2qodWLXc2nMqqpVxBsJ (botão "C · Flutuante").
- **Mecânica de cor** (`src/app/globals.css`, bloco "A casca"): os tokens de
  uso (`--ink`, `--primary`, `--surface`…) apontam para `--p-*`. Dentro de
  `.app-quadro` (o miolo) eles viram brancos; todo `.bg-panel`, `.app-card`,
  `.quadro-tool`, `dialog`, `[popover]`… volta aos `--p-*`. Por isso texto
  solto no azul sai branco e o cartão continua normal **sem a tela saber**.
  Botão primário solto no azul = branco com texto azul. Selo de estado
  tingido solto no azul vira pastilha clara.
- **Componentes de topo** (`src/components/design/cabecalho-da-tela.tsx`):
  `CabecalhoDaTela` (título, `Contagem`, descrição, ações à direita, trilha só
  com link), `TopoDaTela` (quando a ação mora num componente de cliente com
  estado: a página passa `topo` e o componente desenha o cabeçalho com o
  próprio botão; ver `tabela-de-segmentos.tsx`, `gerenciador.tsx`,
  `tabela-de-pessoas.tsx`). `Miolo largura="leitura|larga|cheia|toda"`
  (`miolo.tsx`). `EsqueletoDeAjuste` em `esqueleto.tsx`.
- Telas já com ações fora do cartão: Contatos, Fluxos, Gatilhos, Sequências,
  Transmissões, Segmentos, Respostas rápidas, Mensagens salvas, Produtos,
  Pessoas, Chaves e as subtelas de Configurações.

## O padrão (palavras do dono, não reinterprete)

**A referência é a tela de Contatos** (`app/clientes/[clienteId]/leads/page.tsx`):
título + pílula na linha de cima com os botões à direita; **embaixo, fora do
cartão, a barra de busca, Filtros e Colunas**; o cartão começa direto na tabela.
"Tem um padrão lindo. Por que tudo isso muda na tela de Fluxos?"

## O que falta (faça todos)

### 1. Escala de botão: hoje não existe

- `app-primary-button` aparece com **67 combinações de tamanho** escritas à
  mão (`grep -rho 'app-primary-button[^"]*' src`). `ModalFormulario`
  (`design/modal-formulario.tsx:155`) dá 13px/py-2.5 ao primário e 11.5px/py-1.5
  ao `secundario`; `.quadro-tool` é 12px/36px. Resultado no topo de Fluxos:
  "+ Criar automação" maior que "+ Nova pasta", e os dois pequenos.
- Crie um `Botao` (ou classes `botao-sm|md|lg` + `botao-primario|secundario|
  fantasma|perigo`) com **uma** escala, e use:
  - **lg** no topo da tela (ações de `CabecalhoDaTela`): primário e secundário
    com a **mesma altura e fonte** (~40px, 14px). Contatos hoje é a medida certa.
  - **md** em cabeçalho de seção/cartão e formulário.
  - **sm** em linha de tabela e ação inline ("Editar", "Apagar").
- `ModalFormulario` precisa aceitar `tamanho` e usar o `Botao`. Troque as
  67 variações; `quadro-tool` e `crm-button` entram na mesma escala.

### 2. Barra de busca e filtros fora do cartão

- Ainda **dentro** do cartão: Fluxos (`BarraDeLista` em `fluxos/page.tsx`),
  Palavras-chave e Sequências (`BuscaDaAba`), Transmissões
  (`lista-de-transmissoes.tsx`), Negócios em lista (`lista-de-negocios.tsx`).
  Mova para logo abaixo do `CabecalhoDaTela`, como em Contatos. Confira as
  telas de admin que usam `BarraDeLista` (mesmo padrão, mesma régua).
- A barra de Contatos é a referência visual (campo largo branco, botões
  brancos com ícone na mesma altura).

### 3. Revisão tela a tela (o dono: "não é só ali, cuidado")

Passe em **todas**: conta (`scripts/ux-local/prints.mjs` lista as rotas) e
também Segmentos, Respostas rápidas, Mensagens salvas, Canais, Produtos,
Integrações, Vendas, Respostas coletadas, ficha do contato, negócio.
Para cada uma: topo pelo `CabecalhoDaTela`, ações no tamanho lg, barra fora do
cartão, nenhum título repetido dentro do cartão, contraste no azul.
Conhecidos: "Respostas coletadas" tem "Automações › Respostas" duas vezes e o
título diverge do menu ("Respostas" × "Respostas coletadas").

### 4. Depois, se sobrar

- **Celular** ainda está no fundo antigo (casca só `md+`).
- Hidratação: botão de perfil renderiza "perfil" no servidor e "Gabriel Teste"
  no cliente (`BarraDoCelular`/conta), já existia antes da casca.
- Busca de pedido no Inbox dispara sozinha desde `05ba70d`; não deu para
  provar local (conta de revisão sem loja). Conferir com a PCYES.
- Pedido do dono, não feito: ao abrir "Status do pedido", listar os pedidos
  do contato pelo telefone (exige consulta nova no Magento, não existe).

## Como trabalhar aqui

- Local: `bash scripts/ux-local/dev.sh` (porta 3100, Supabase local) e
  `node scripts/ux-local/entrar.mjs`; login `revisao@local.test` /
  `senha-local-123456`. Turbopack às vezes cai com panic: suba de novo.
- Print: `LARGURAS='[[1440,900,""]]' node scripts/ux-local/prints.mjs <pasta> [telas]`;
  monte grades 2x2 para revisar barato e abra em tamanho real só o que precisar.
- Valide com `npx tsc --noEmit -p .` e o teste do arquivo mexido; **não rode a
  suíte inteira**. Um processo pesado por vez (a WSL cai).
- Ao terminar: commit, push e confira o deploy (Vercel, projeto `autofluxos`).
  Registre a escala de botão em `docs/DECISIONS.md`.
