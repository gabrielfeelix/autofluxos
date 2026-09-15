# Handoff — 15/set/2026, tarde: o tema claro e a reforma do Inbox

Para o agente que continua. Leia este arquivo inteiro antes de abrir código.
Ele tem três partes: **o que já está no ar** (e as armadilhas que isso criou),
**o que falta**, com especificação de layout item a item, e **as regras que não
se renegociam**.

O que não estiver aqui está em [PLANO-SISTEMA.md](PLANO-SISTEMA.md) e
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md).

---

## 0. Em uma linha

O painel era escuro com degradês e acento ciano; virou **claro por padrão, com
azul de marca `#2563eb`**, camada de tokens única, tema escuro por escolha, e o
Inbox foi redesenhado na direção do ManyChat — barra de filtros atravessando,
ações rápidas em ícone, coluna de conversas arrastável.

Sete commits, todos em produção: `736d97f` → `52cf07b`.

---

## 1. O que entrou

| Commit | O quê |
|---|---|
| `736d97f` | Tema claro, camada de tokens, tema escuro por escolha, Inbox redesenhado |
| `d08913d` | URL longa rolava a conversa; áudio que sai encolhia; 219 textos ilegíveis |
| `db4b052` | Barra de filtros atravessa; coluna arrastável; tela encosta nas bordas; dicas próprias |
| `499fdbb` | Busca filtra enquanto digita; contraste das bolhas |
| `2a2dd5e` | **Correção grave**: bolha de saída pintava branco sobre branco |
| `52cf07b` | Eco do celular nunca baixava a mídia |

### 1.1 A camada de tokens — leia antes de escrever qualquer cor

**Nenhuma cor é escrita à mão fora de `src/app/globals.css`.** Havia 437
ocorrências de `white/[0.0x]` em 82 arquivos; foram todas para token. Escrever
`bg-[#fff]` ou `text-rose-300` num componente novo é regressão, não estilo.

Os nomes disponíveis como utilitário do Tailwind:

```
bg-canvas  bg-panel  bg-surface  bg-surface-strong
border-line  border-line-soft  border-strong
text-ink  text-soft  text-muted  text-dim
bg-primary  text-primary  bg-primary-weak  text-primary-strong
text-perigo  text-aviso  text-ok  text-info
shadow-pop  shadow-menu  shadow-modal
```

Eles existem porque estão em `@theme inline`. **`:root` sozinho não gera
utilitário no Tailwind 4** — esse defeito já custou caro uma vez (o comentário
no topo de `globals.css` conta a história do `text-soft` que nunca pintou
nada). Token novo entra nos dois lugares.

### 1.2 O tema escuro

`:root[data-tema='escuro']` redefine os mesmos nomes. O atributo é posto por
`SCRIPT_DAS_PREFERENCIAS` (`src/components/design/tema.tsx`) dentro do `<head>`,
**antes da primeira pintura** — sem isso a tela pinta clara e pisca a cada
navegação.

Três preferências seguem esse mesmo desenho: tema, barra lateral recolhida, e
largura da coluna de conversas (`--fila`, uma variável de CSS em vez de
atributo, porque é número).

O padrão é claro **mesmo para quem tem o sistema no escuro**, de propósito.
Não há `@media (prefers-color-scheme: dark)` em lugar nenhum, e não deve haver.

### 1.3 A armadilha que já derrubou a tela uma vez

**Propriedade customizada declarada num elemento vale para o próprio
elemento.**

`.bolha-nossa` (a bolha azul do que enviamos) redefine `--primary: #fff`, para
que link e destaque dentro dela sejam brancos. A bolha usava `bg-primary` — que
resolveu para o branco recém-escrito. Texto branco sobre fundo branco: **toda
mensagem enviada sumiu da conversa em produção.**

A saída foi capturar o azul no `:root`, em `--bolha-nossa`, com o valor já
substituído. Se você criar outro escopo que redefine token, **o fundo dele não
pode vir do token que ele mesmo troca**.

### 1.4 O que a landing faz, e por quê

`src/app/page.tsx` e as páginas legais continuam escuras. Elas declaram a
própria paleta dentro de `.pagina`, nos dois `*.module.css` de `app/(site)/`, e
o seletor repete o nome **três vezes** (`.pagina.pagina.pagina`) para vencer a
especificidade de `:root[data-tema='escuro']`. Não "limpe" isso.

### 1.5 Componentes novos criados nesta leva

| Arquivo | O quê |
|---|---|
| `components/design/tema.tsx` | Preferências, script do `<head>`, botão de tema |
| `components/design/barra-lateral.tsx` | Barra recolhível do painel |
| `components/design/dica.tsx` | Tooltip do produto, CSS puro, sem estado |
| `components/inbox/moldura.tsx` | Grade do Inbox + contexto da ficha (`useFicha`) |
| `components/inbox/pilulas.tsx` | `PilulaMenu`, `PilulaInterruptor`, `ESTADOS_DA_FILA` |
| `components/inbox/acoes-rapidas.tsx` | A fileira de ícones do cabeçalho da conversa |
| `server/canal-do-whatsapp.ts` | Adaptador da Cloud API, compartilhado |

Removidos por terem ficado órfãos: `components/inbox/ficha-do-rail.tsx` e
`components/inbox/estado-da-conversa.tsx`.

### 1.6 A anatomia atual do Inbox

```
┌──────────────────────────────────────────────────────────────────────┐
│ Caixa de Entrada  (18) ⚙      [🔍 Pesquisar em conversas]            │  ← <header col-span-full>
│ [Conversas abertas ▾][Todos os atendentes ▾][Não lidas 12]           │     desenhado pela `Fila`
│ [Classificar: Mais recentes ▾]            3 esperando uma pessoa     │
├───────────────┬──────────────────────────────────┬───────────────────┤
│ lista         │ Guti Santos          [Assumir]   │  avatar grande    │
│ (arrastável   │ Não atribuído     🏷 🕐 ✓ 💬 ⏸ 🪪 │  nome · waId      │
│  264–520px)   ├──────────────────────────────────┤  [Abrir ficha]    │
│               │ 🟢 WhatsApp                      ├───────────────────┤
│               ├──────────────────────────────────┤  estado do bot    │
│               │ conversa                         │  QuemE            │
│               │                                  │  etiquetas (só    │
│               │                                  │   leitura)        │
│               ├──────────────────────────────────┤  funil            │
│               │ caixa de resposta                │  anotação         │
└───────────────┴──────────────────────────────────┴───────────────────┘
```

`Fila` devolve **um fragmento com duas irmãs** — o `<header>` e o `<aside>`.
Elas caem direto na grade de `MolduraDoInbox`. Envolvê-las num `<div>` tira as
duas da grade e a barra deixa de atravessar.

A coluna da direita é **de leitura**. Os dois editores que moravam nela
(etiquetas e anotação) foram para as ações rápidas porque cada um guarda estado
local semeado pelo servidor: o mesmo editor em dois lugares diverge no primeiro
clique. **Um editor por informação.**

---

## 2. O que falta — a fila, em ordem

### 2.1 Botão de enviar condicional (pedido explícito do dono) — **feito**

**O problema.** A caixa de resposta tem um botão "Enviar" sempre ativo, ao lado
de "📎 Anexar", "😊" e um botão de microfone com rótulo de texto. Quatro
controles com borda disputando a linha, e um "Enviar" que pergunta "enviar o
quê?" quando o campo está vazio.

**O alvo**, que é o que WhatsApp, Instagram e Telegram fazem:

```
┌────────────────────────────────────────────────────────────┐
│ 📎  😊   Responder Guti pelo WhatsApp…                  🎤 │   ← campo vazio
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ 📎  😊   opa, tudo certo?                               ➤  │   ← com texto
└────────────────────────────────────────────────────────────┘
```

- Clipe e emoji à esquerda, **sem borda**, ícone só, 36px, `text-muted
  hover:bg-surface hover:text-ink`.
- Campo no meio: `rows={1}`, cresce até ~132px de altura, `rounded-[19px]`,
  `resize-none`.
- À direita, **um botão só**, que troca: microfone quando não há texto, avião
  de papel (primário, redondo) quando há.
- Emoji inserido também faz aparecer o avião.

**Arquivos.** `src/components/lead/responder.tsx` é o dono da linha.
`seletor-de-emoji.tsx:81`, `botao-de-anexo.tsx:197` e `botao-de-microfone.tsx:392`
têm cada um o próprio gatilho com borda e rótulo de texto — os três precisam
virar ícone sem borda, com `Dica` no lugar do `title`.

**A pegadinha.** O `<textarea>` é **não controlado** e `inserirResposta()` usa
`setRangeText` direto no DOM, para respeitar o cursor e o teto de 4.096
caracteres. Não o torne controlado só para saber se há texto — isso quebra a
inserção de resposta rápida no meio da frase. Use um booleano `temTexto`
atualizado no `onChange`, depois de `inserirResposta` e depois do envio.

**Enquanto grava**, `BotaoDeMicrofone` toma a linha inteira e o resto sai de
cena (`gravando` já existe em `responder.tsx`). Mantenha.

**Como ficou.** A aparência dos três ícones mora em `components/lead/botao-da-barra.ts`
(`BOTAO_DA_BARRA`), num lugar só porque eles são irmãos na mesma linha e já
tinham nascido diferentes. Os rótulos de texto do microfone ("Abrindo…",
"Subindo…") viraram a `Dica` e o `aria-label` — a informação não sumiu, mudou de
lugar. O erro do microfone flutua por cima em vez de ser irmão na linha: a linha
é um flex sem quebra, e um parágrafo ali espremia o campo até sumir.

### 2.2 Tirar a contagem da janela do rodapé — **feito, na casa 1**

Hoje o rodapé da caixa de resposta diz *"Responder daqui assume a conversa: o
bot para de falar com Guti até você clicar em 'Já atendi'. Janela do WhatsApp
fecha em 22h18."*

O dono quer a **contagem da janela** fora dali. Duas casas possíveis, e ele
aceitou as duas — escolha uma e seja consistente:

1. No cabeçalho da conversa, ao lado de "Não atribuído", como pílula discreta.
2. Na coluna da direita, logo abaixo do `waId`.

A **primeira metade** da frase (o bot para de falar) fica onde está, só
encolhe. Ela é consequência do gesto que se está prestes a fazer, e pertence ao
rodapé.

`restaDaJanela` já chega em `CaixaDeResposta` como string pronta
(`comoFalta(restaDaJanela(...))`, em `channels/janela.ts`). Para levá-la ao
cabeçalho, passe-a de `Conteudo` para `CabecalhoDaConversa` — a variável
`janela` já existe lá, calculada.

Cuidado: `restaDaJanela === null` significa **fora da janela**, e nesse caso a
caixa de resposta inteira vira um aviso e não há campo. Esse caminho não pode
sumir.

**Como ficou.** Casa 1 — pílula ao lado de "Não atribuído", com relógio, e em
`text-aviso` abaixo de duas horas, porque "22h18" e "1h04" são a mesma frase e
significam coisas opostas. A tela da Ficha (`leads/[contatoId]`) ganhou a mesma
pílula no cabeçalho "Conversa": duas telas que dizem a mesma coisa em lugares
diferentes são dois produtos para quem usa as duas.

### 2.3 Agendar mensagem — **feito, e a migration já está em produção**

**Precisa de banco.** Leia [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md)
inteiro antes. A próxima migration é a **`0057`** — confira com
`ls supabase/migrations | tail -1`, nunca copie número de plano.

**Não aplique nada em produção sem autorização explícita do dono.**

Esboço da tabela, para discussão:

```sql
set search_path = public, extensions;

create table mensagens_agendadas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clients(id) on delete cascade,
  contato_id uuid not null references contacts(id) on delete cascade,
  texto text not null,
  quando timestamptz not null,
  criada_por uuid,
  criada_em timestamptz not null default now(),
  -- 'agendada' | 'enviada' | 'cancelada' | 'falhou'
  estado text not null default 'agendada',
  enviada_em timestamptz,
  erro text
);
create index on mensagens_agendadas (estado, quando);
create index on mensagens_agendadas (cliente_id, estado);
```

**O disparo** é cron da Vercel, como os três que já existem em `vercel.json` →
`src/app/api/manutencao/`. Copie o desenho de `tarefas`. O cron mais curto do
plano gratuito é de um em um minuto? **Não** — confira o plano antes de
prometer precisão de minuto ao dono; hoje os três crons rodam uma vez por dia.
Se a granularidade não der, diga isso a ele em vez de entregar um agendamento
que atrasa horas.

**A janela de 24h é o problema de verdade, e precisa ser dito na tela.** Uma
mensagem agendada para amanhã de manhã provavelmente cai **fora** da janela, e
a Meta vai recusar — exige modelo aprovado, que este produto ainda não tem. O
agendador precisa:

- avisar no momento de agendar, quando o horário escolhido já se sabe fora;
- gravar o erro em `erro` e mostrar na tela quando a recusa acontecer;
- nunca falhar em silêncio.

**A tela**, na direção do que o dono mandou de referência:

```
┌─────────────────────────────────┐
│ Agendar mensagem                │
│ Mensagem              0/4096    │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ └─────────────────────────────┘ │
│ Quando        [Predefinições ▾] │   em 1 hora · em 3 horas ·
│ ┌─────────────────────────────┐ │   amanhã de manhã · amanhã à tarde ·
│ │ amanhã às 9h    📅 16/set   │ │   próxima segunda · personalizado
│ └─────────────────────────────┘ │
│ ⚠ fora da janela de 24h         │   ← só quando for o caso
│ [      Agendar mensagem      ]  │
└─────────────────────────────────┘
```

Entra como **mais um ícone nas ações rápidas** (`acoes-rapidas.tsx`), um
relógio com `+`, usando o `AcaoComPainel` que já está lá.

**O contador geral** que o dono pediu — "quantas agendadas temos no total, não
só deste contato" — vai na barra de filtros do Inbox, à direita, junto de "N
esperando uma pessoa". Clicar abre a lista de todas as agendadas da conta, com
cancelar. Conta por `cliente_id`, não por contato.

**Como ficou, e o que não foi como o plano dizia.**

A migration é a **`0057`** e ela cobre as duas coisas — a tabela e a coluna de
transcrição do §2.4 —, porque as duas são aditivas e separá-las custaria duas
idas ao banco compartilhado. Aplicada em produção em 15/set com os dois testes
(replay em Docker e ensaio em transação). O estado conferido está em
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md).

O plano dizia para conferir a granularidade do cron antes de prometer precisão
de minuto. **Conferido, e não dá:** o time na Vercel é `hobby`, e lá o cron
dispara uma vez por dia. Não há quarta tarefa agendada no `vercel.json` de
propósito — o Hobby limita o número delas, e uma que a plataforma recuse não
falha sozinha: reprova o deploy inteiro. Então a passada das agendadas roda
junto do cron de tarefas que já existe.

Quem dá resolução de verdade são **três gatilhos**, o mesmo desenho que
`rodarTarefas` já usava:

1. carona no webhook do WhatsApp — a conta que tem mensagem marcada é, quase
   sempre, a que está conversando;
2. **carona no pulso do Inbox**, uma vez por minuto dentro do SSE que já roda de
   segundo em segundo enquanto alguém tem a tela aberta. É isto que cobre a
   mensagem marcada para uma conversa parada;
3. o cron diário, como piso.

A tela **diz isso**, em vez de prometer o minuto: *"sai no horário marcado
enquanto alguém estiver com o Inbox aberto ou chegar mensagem na conta."*

A janela de 24h **avisa e não trava**, e essa foi a decisão que mais mudou em
relação ao esboço: ela reabre a cada mensagem do cliente, então recusar no
momento de marcar impediria o caso normal — marcar a resposta de amanhã numa
conversa que continua hoje à noite. A conferência de verdade é no envio, e a
recusa da Meta fica guardada em `erro` e aparece na lista.

`enviando` é um estado da máquina e existe para duas passadas simultâneas não
mandarem a mesma mensagem duas vezes: quem consegue **escrever** o estado é dono
da linha. Linha presa em `enviando` por mais de cinco minutos volta para a fila
— e sim, isso pode repetir uma mensagem se a função morreu entre a Meta aceitar
e o `marcarEnviada`. Entre repetir e sumir em silêncio, repetir é o trato, e é o
mesmo de `devolverDesconhecidas`.

### 2.4 Transcrição de áudio — **feito**

O dono perguntou se depende de IA. **Depende — não existe transcrição sem
modelo de fala.** A resposta prática é que a chave já existe: `GEMINI_API_KEY`
está no `.env` e o Gemini transcreve áudio nativamente.

Desenho proposto:

- Botão "transcrever" na bolha de áudio, **sob demanda**, não automático.
- O resultado é **gravado na mensagem** (coluna nova, ou dentro do `payload`).
  Transcrever uma vez, não a cada abertura da conversa — senão cada scroll na
  conversa vira uma conta na fatura.
- Só funciona para áudio com cópia guardada. Os antigos não têm (ver §3.2).

**Sobre o §2.4, o que precisa ser sabido antes de mexer:** transcrever manda a
voz do cliente para o Gemini, hoje com a chave da 4YU no free tier — que treina
modelo com o que passa por ela. Por isso é **sob demanda**, nunca automático: o
clique é o consentimento de quem atende. O resultado é guardado em
`messages.transcricao` para uma conversa aberta dez vezes não virar dez
chamadas. Está escrito em `server/transcrever-audio.ts` e resumido na dica do
botão.

### 2.5 A fonte dentro da conversa (pedido do dono) — **feito**

**O problema.** O produto inteiro usa **Outfit** (`--font-outfit`,
`app/layout.tsx`), e a bolha de mensagem herda. Outfit é uma geométrica de
display: desenhada para título, com traço de espessura uniforme, aberturas
fechadas e pouca diferença entre formas parecidas. Em corpo 13 e parágrafo
corrido ela força a vista — que é exatamente a queixa.

A conversa é o único lugar do painel onde se **lê texto de verdade**, escrito
por outra pessoa, em blocos, o dia inteiro. Ela merece uma fonte de texto, e
não a de marca.

**A recomendação.** Manter Outfit na casca — barra lateral, títulos, botões,
pílulas: é ela que dá identidade ao produto — e usar uma fonte de interface
dentro da bolha. **Inter** é a escolha óbvia e não é modismo: altura de x
grande, aberturas abertas, `1`/`l`/`I` distinguíveis, e foi desenhada para
corpo pequeno em tela. É o que o Instagram e metade dos produtos de chat usam
via stack do sistema; carregá-la explicitamente só torna previsível o que hoje
depende do sistema operacional de quem olha.

Medidas propostas, para a bolha:

| | Hoje | Proposta |
|---|---|---|
| Família | Outfit (display) | Inter (texto) |
| Corpo | 13px | **14.5px** |
| Entrelinha | 1.5 | **1.45** |
| Peso | 400 | 400 (o contraste vem da cor da bolha, não do peso) |
| Espaçamento | 0 | 0 — Inter já vem ajustada; `tracking` negativo fecha aberturas |

A hora e o rodapé da bolha ficam em 10–10.5px, também em Inter, e continuam em
`text-muted`.

**Não engordar a fonte para resolver legibilidade.** Peso 500 numa bolha azul
com texto branco vira borrão em tela comum — o ganho real vem do corpo maior e
da forma da letra.

**Como fazer.** `next/font/google` em `app/layout.tsx`, ao lado de Outfit,
expondo `--font-inter`; registrar `--font-texto: var(--font-inter)` em
`@theme inline`; e aplicar `font-texto` na bolha e no campo de resposta — o que
se escreve tem que parecer com o que sai. Não troque a fonte global: a barra
lateral e os títulos em Inter fazem o produto perder a cara.

**Confira no escuro também.** Texto claro sobre fundo escuro engorda
opticamente; se ficar pesado, `-webkit-font-smoothing: antialiased` já está
ligado no `body` e resolve a maior parte.

---

### 2.6 O rodapé da bolha: quem falou — **feito**

O rodapé dizia `atendimento · 20:20` em tudo que saía, e `Gabriel Felix · 20:20`
em tudo que entrava. Os dois estavam errados por motivos opostos: o da entrada
repetia dezenas de vezes o nome que já está no cabeçalho, e o da saída era uma
palavra que o dono leu e perguntou o que significava — ela valia igual para o
bot e para gente.

Agora: **entrada mostra só a hora**; saída mostra quem respondeu (nome e um
sobrenome, `nomeCurto` em `core/atendente.ts`), ou "automação" quando foi o
fluxo, ou **nada além da hora** quando não sabemos.

O autor é gravado **dentro do `payload`**, não numa coluna — `core/autor-da-mensagem.ts`
explica por quê em detalhe, e o resumo é que uma coluna custaria uma migration
no banco compartilhado para resolver um rótulo. Quando o agendamento (§2.3)
pedir a `0057` de qualquer jeito, isto vira coluna; a leitura já passa toda por
`autorDoPayload`, então é um lugar só para mudar.

"Não sabemos" cobre dois casos reais e nenhum deles é bug: mensagem anterior a
isto existir, e o eco do que o dono manda pelo celular — que chega pela Meta sem
autor nenhum.

### 2.7 A busca do Inbox estava apertada — **feito**

`max-w-[460px]` deixavam pouco mais de trinta caracteres à vista: nome completo
não cabia. Foi para `680px`, com o campo um pouco mais alto. O `mx-auto`
continua centrando entre o título e a engrenagem.

### 2.8 A linha de escrever, segunda passada — **feito**

Pedidos do dono depois de ver a primeira versão em produção:

- **os três ícones viraram traço** (`components/lead/icones-da-barra.tsx`) e
  subiram para 18px, com o botão em 40. Eram emoji do sistema, e o `🎤` do
  Windows é um microfone de palco — o dono leu como karaokê. Emoji também não
  obedece `currentColor`, então o hover não os alcançava;
- **a barra de rolagem só aparece ao bater o teto.** O padrão do `<textarea>` é
  `overflow: auto`, e "auto" mente enquanto a altura é reescrita a cada tecla:
  desenha a barra por um quadro no meio do crescimento. Agora é `hidden` abaixo
  do teto e `auto` nele.

### 2.9 Link na conversa — **azul feito, prévia na fila**

Endereço colado virava texto comum: não dava para clicar e não parecia link. A
`TextoDoWhatsApp` agora reconhece `https://`, `http://` e `www.`, e desenha em
`text-primary` com sublinhado — que fica azul no que chega e **branco no que
sai**, porque `.bolha-nossa` redefine `--primary` (§1.3, a armadilha jogando a
favor desta vez). A pontuação final fica fora do endereço, senão "veja em
exemplo.com." abriria uma página que não existe.

**Falta a prévia**, que é o que o dono pediu de verdade: cartão com título,
domínio e imagem, como o WhatsApp mostra ao colar. Ela é maior do que parece e
não é só front-end:

- alguém precisa **buscar** o `<title>`, `og:title`, `og:description` e
  `og:image` do endereço. Isso é uma requisição do nosso servidor para um host
  que um desconhecido escolheu — ou seja, **SSRF**: precisa recusar IP privado,
  `localhost`, redirecionamento para rede interna, e ter teto de tamanho e de
  tempo;
- o resultado tem que ser **guardado**, senão cada abertura da conversa refaz a
  busca de todos os links dela;
- a imagem não pode ser servida do host de origem direto na tela (vaza o IP de
  quem olha e some quando o site sai do ar): ou passa pelo nosso Storage, ou a
  prévia fica só com texto.

Uma tabela `previas_de_link` (endereço normalizado como chave, campos da prévia,
`buscada_em`) resolve as duas primeiras. Migration nova; leia
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) antes.

---

## 3. Defeitos conhecidos e dívidas

### 3.1 `src/core/ogg-opus.ts:213` reprova no ESLint

`numeroDaFaixa` é `let` e nunca reatribuído (`prefer-const`). **Não troque para
`const` sem entender.** Se a intenção era atribuí-lo dentro de `bloco()`, a
troca esconde o defeito em vez de mostrar. Arquivo de trabalho em andamento do
dono, não desta leva.

### 3.2 O GIF animado que dizia "sem cópia guardada" — **consertado**

O dono mandou duas figurinhas seguidas. A segunda, estática e de 193 KB,
apareceu inteira; a primeira, **animada e de 438 KB**, ficou para sempre
dizendo *"arquivo recebido, sem cópia guardada — peça para enviar de novo"*.
As duas estavam no bucket, e as duas assinavam URL sem erro.

**Não era mídia: era o pulso.** A mensagem é gravada primeiro e o arquivo baixa
depois (`guardarMidiaRecebida`, e é assim de propósito — gravar a conversa não
espera download). O pulso do Inbox era `max(messages.ts)`, e `ts` não muda
quando o arquivo chega. A tela que se atualizou no intervalo entre as duas
coisas desenhava a bolha sem arquivo **e nunca mais tinha motivo para
redesenhar**. Quanto maior o arquivo, mais certa a derrota: GIF animado, vídeo
e áudio longo perdem essa corrida sempre.

O conserto está em `pulsoDaConta` (`server/repos/leads.ts`): o pulso passou a
ser o carimbo da última mensagem **mais um dígito por mensagem** das cinco
últimas, dizendo se ela já tem arquivo. Sem coluna nova e sem migration. O
formato virou opaco — `2026-09-15T17:47:16+00:00|10110` — e quem compara só
pergunta se mudou (`precisaAtualizar`). **Não volte a tratar o pulso como
data**; o teste em `repos/pulso.test.ts` tranca isso.

### 3.3 Mídia antiga de eco não volta

O eco passou a baixar cópia em `52cf07b`, mas o `id` da Meta vive 7 dias. Tudo
que o dono mandou pelo celular antes disso está perdido, e a bolha diz isso.
Não prometa recuperação.

### 3.4 Filtros que só existem no modo local

"Não lidas" e "Classificar" só aparecem quando a fila inteira está no navegador
(`local !== null`, abaixo de `TETO_DA_FILA_LOCAL`). Acima do teto eles
filtrariam uma página de 50 de 5.000 e mostrariam número errado. **Não os
"conserte" fazendo aparecer sempre.** Para valerem em conta grande, o filtro
precisa descer para a consulta.

A busca segue a mesma regra: filtra ao vivo no modo local, e o Enter vai ao
servidor sempre.

### 3.5 Não há filtro de canal, e é de propósito

O contato não guarda de que canal veio, e o Instagram está `disponivel: false`
em `core/canais.ts`. A aba dentro da conversa diz o canal; um menu "Todos os
canais" com uma opção só seria promessa de um filtro que não filtra. Quando o
segundo canal entregar, a segunda aba nasce sozinha e **aí** o filtro passa a
ter o que separar.

---

## 4. As regras que não se renegociam

1. **Banco de produção é compartilhado com a Verandi.** AutoFluxos em `public`,
   Verandi em `app_verandi`. Nunca `supabase db push` nem `db reset`. Nada é
   aplicado sem autorização explícita do dono. Leia
   [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md).

2. **Cor só em `globals.css`.** Componente novo usa token. Se faltar um token,
   crie-o nos dois lugares (`@theme inline` e `:root`, e no bloco escuro).

3. **O tema claro é o padrão e não se inverte.** Sem
   `prefers-color-scheme` em lugar nenhum.

4. **Deploy é `git push origin main`** — a Vercel publica sozinha, projeto
   `prj_17XxHvJ1vOAQ6j4mQSauCPA1BJXO`, time `team_hmVHyYO1YFO9fuAtpG9Ym2hm`,
   domínio `autofluxos.4yu.com.br`. Antes de empurrar: `npm run typecheck`,
   `npm run lint`, `npm run build`. Os testes (`npm test`, ~2min) antes de
   qualquer coisa que toque servidor.

5. **O dono acompanha em produção, por print.** Ele prefere um deploy pequeno
   e visível a um lote grande e demorado. Empurre cedo e com frequência.

6. **Escreva em português**, no tom dos comentários que já estão no
   repositório: eles explicam **por que**, não o que, e contam o defeito que a
   linha existe para evitar. Commit segue o mesmo padrão.

---

## 5. Onde começar

```bash
git log --oneline -8              # o que entrou nesta leva
cat docs/BANCO-COMPARTILHADO.md   # antes de qualquer migration
sed -n '1,200p' src/app/globals.css   # a camada de tokens
```

Depois: §2.1 (botão condicional) e §2.2 (contagem da janela) são pequenos,
visuais, e não tocam banco. Faça os dois, empurre, e mostre. §2.3 e §2.4 pedem
conversa com o dono antes de código.
