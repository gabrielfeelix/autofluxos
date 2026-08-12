# AutoFluxos — desenho do MVP

> Rascunho para discussão. Nada aqui está fechado.

## O que o MVP precisa fazer (e só isso)

Um cliente da 4YU — digamos o Reinaldo — tem um número de WhatsApp. Alguém manda
mensagem pra ele. O bot conduz uma conversa curta, coleta o que importa
(nome, o que a pessoa quer, telefone), e ou responde uma dúvida simples ou passa
pro humano. No fim, o Reinaldo abre uma tela e vê os leads que caíram.

Se isso funcionar de ponta a ponta pra **um** cliente, o produto existe. Tudo
que não serve a essa frase fica fora do MVP.

## O princípio que governa tudo: o produto é chave mestre

**Não estamos construindo o bot da Prelúdio.** Estamos construindo o sistema em
que o bot da Prelúdio — e o do próximo, e o do vigésimo — cabe sem tocar em
código. A Prelúdio é o primeiro caso, não o alvo.

Isso dá um teste objetivo pra qualquer feature que alguém pedir:

> Isso é um **nó / configuração**, ou é **a Prelúdio**?

Se for a Prelúdio, vai pro JSON do fluxo ou pro contexto do cliente — nunca pro
`src/`. No dia que alguém precisar mudar código pra encaixar um cliente, a gente
parou de ter produto e passou a ter consultoria com passo extra.

A boa notícia é que a arquitetura já é isso: **`core/` não sabe o nome de nenhum
cliente.** A fronteira entre produto e cliente é literalmente a fronteira entre
`src/` e uma linha do banco (`flow_versions.grafo`, `clients.contexto_negocio`).
Se essa fronteira se mantiver, o produto é chave mestre por construção.

O risco do outro lado, que vale dizer em voz alta: quem projeta genérico no
abstrato costuma acertar ninguém. O jeito de ter os dois é **derivar** o genérico
de um caso real — construir olhando pra Prelúdio e pro Cliente 00, e recusar com
disciplina qualquer coisa deles que tente entrar no código.

## As nove decisões

### 1. O motor é uma função pura

```
executar(fluxo, sessão, mensagemRecebida) → { ações, novaSessão }
```

Sem banco dentro. Sem WhatsApp dentro. Sem `await` de rede. Só entra estado,
sai estado + o que fazer.

Por que isso importa mais do que parece:

- **Testa sem WhatsApp.** O motor tem teste unitário desde o primeiro dia. Você
  descobre que o fluxo do Reinaldo está quebrado num teste de 8ms, não num
  cliente real reclamando.
- **O simulador vira de graça.** Simulador e produção chamam a *mesma* função.
  Não existe "no simulador funcionava" — é literalmente o mesmo código.
- **Roda em serverless.** Como não há estado vivo na memória, a Vercel serve.
  A VPS só entra quando houver motivo real (fila, processo 24h, mídia pesada).

Essa é a peça que decide se o projeto fica simples ou vira um monstro.

### 2. O canal é um adaptador plugável

```ts
interface Canal {
  enviarTexto(para: string, texto: string): Promise<void>
  enviarBotoes(para: string, texto: string, opcoes: Opcao[]): Promise<void>
}
```

Três implementações, entrando em momentos diferentes:

| Driver | Quando | Papel |
|---|---|---|
| `mock` | **dia 1** | o simulador. Não envia nada, devolve o que enviaria. |
| `cloud-api` | quando a Meta liberar | oficial, produção |
| `evolution` | só se precisar | não oficial, risco de ban |

O ponto: **o `mock` é o driver número um, não um brinquedo.** Com ele dá pra
construir 100% do produto — editor, motor, banco, telas — sem depender de
aprovação da Meta, sem chip, sem VPS. Quando o `cloud-api` chegar, é uma classe
nova e nada mais muda.

### 3. O fluxo é JSON no formato do React Flow

O grafo é salvo exatamente como o React Flow serializa: `nodes` + `edges`.
Não existe formato interno traduzido pro editor — é o mesmo objeto.

```json
{
  "nodes": [
    {
      "id": "n1",
      "type": "mensagem",
      "position": { "x": 0, "y": 0 },
      "data": { "texto": "Oi! Sou o assistente do Reinaldo 👋" }
    },
    {
      "id": "n2",
      "type": "pergunta",
      "position": { "x": 0, "y": 160 },
      "data": {
        "texto": "Como posso ajudar?",
        "salvarEm": "assunto",
        "opcoes": [
          { "id": "o1", "rotulo": "Quero um orçamento" },
          { "id": "o2", "rotulo": "Já sou cliente" }
        ]
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" },
    { "id": "e2", "source": "n2", "sourceHandle": "o1", "target": "n3" },
    { "id": "e3", "source": "n2", "sourceHandle": "o2", "target": "n7" }
  ]
}
```

Repare no `sourceHandle`: **a setinha que você arrasta É a ramificação.** Não
precisa de tela de configuração de branch — o desenho é a lógica.

O schema é escrito uma vez em Zod (`core/flow/schema.ts`) e serve os dois lados:
o editor valida antes de salvar, o motor valida antes de rodar.

**Zod cuida da estrutura; `validar()` cuida do sentido.** Essa divisão apareceu
construindo o editor, e é ela que o torna usável: enquanto alguém apaga um campo
para redigitar, o fluxo passa por estados incompletos — mensagem sem texto,
opção sem rótulo, variável com meio nome. Se o Zod recusasse, o editor quebraria
a cada tecla e o trabalho se perderia.

Então o Zod só garante que o objeto tem o formato certo, e todas as regras de
qualidade (texto vazio, rótulo grande demais, nome de variável com espaço) são
erros do `validar()`. Rascunho pode estar pela metade; **publicar é que não
pode**.

### 4. Seis tipos de nó. Nem um a mais.

| Nó | Faz |
|---|---|
| `mensagem` | manda texto e segue |
| `pergunta` | pergunta, espera resposta, salva numa variável, ramifica por opção |
| `condicao` | `se {{assunto}} == "orçamento"` → caminho A, senão B |
| `salvar-campo` | grava no contato (vira coluna na tela de leads) |
| `ia` | responde **só** sobre o contexto daquele cliente (ver §6) |
| `handoff` | para o bot, marca "precisa de humano", notifica |

Seis cobre praticamente todo funil de qualificação. A tentação vai ser adicionar
o sétimo, o oitavo, o vigésimo — é assim que MVP morre. Cada nó novo custa:
componente visual + form de edição + execução no motor + teste + migração dos
fluxos que já existem.

### 5. Fluxo tem versão, e a sessão fica presa numa

`flows` (o nome) → `flow_versions` (o grafo, imutável, numerada).
`sessions.flow_version_id` aponta pra versão **publicada** que a conversa pegou
quando começou.

Sem isso: você edita o fluxo às 15h, e a conversa que começou às 14h de repente
está no nó 5 de um grafo onde o nó 5 não existe mais. Quebra silenciosa, difícil
de reproduzir, e o cliente é quem descobre.

Com isso: quem já estava conversando termina no fluxo antigo, quem chegar depois
pega o novo. Rascunho e publicado ficam separados de verdade.

### 6. O nó de IA é fechado por obrigação, não por escolha

A política da Meta (vigente desde 15/jan/2026) proíbe IA de propósito geral na
Business API. Bot task-oriented é permitido. Então o nó `ia` sempre roda com:

- o **contexto do cliente** (texto que o Reinaldo escreveu: o que ele vende,
  horário, preço, o que responder e o que não responder)
- instrução de escopo fechado
- **saída de emergência**: não sabe → `handoff`

Isso não é limitação técnica nossa. É o que mantém o número do cliente vivo.

### 7. A chave da IA é do cliente (BYOK) — e o free tier não serve pra produção

**O cliente paga a IA, sempre.** Cada cliente cadastra a própria chave. Isso
resolve custo, cota e responsabilidade de uma vez: se o Reinaldo mandar 50 mil
mensagens, a conta é dele, não sua, e a cota dele não derruba o bot do vizinho.

Mas tem uma armadilha no plano de "usar chaves grátis do AI Studio e rodar até
bater a cota":

> No free tier do Gemini, o Google **usa suas entradas e saídas pra treinar os
> modelos — incluindo revisão humana**. No tier pago, não usa. Essa diferença
> está no termo, não é boato.

O problema não é a cota. É que a conversa que passa por ali é o nome, o
telefone, o endereço e o que o cliente do Reinaldo quer comprar. Mandar isso pro
free tier significa: (a) dado pessoal de terceiro indo pro treino de um modelo,
(b) possível olho humano lendo, (c) LGPD — e o titular do dado nunca consentiu
com isso. É o tipo de coisa que não dá pra desfazer depois.

Girar várias chaves grátis pra esticar a cota também é violação de termo, e o
Google amarra as chaves à mesma identidade de faturamento — então nem funciona
bem.

A regra que fica:

| Ambiente | Chave | Dado que passa |
|---|---|---|
| Dev / simulador | free tier, sua | **fictício** — você inventando conversa |
| Produção | paga, **do cliente** | real, e o Google não treina em cima |

O free tier continua útil e de graça pra tudo que é desenvolvimento. Ele só não
pode ver conversa de gente de verdade. E como o cliente paga mesmo, BYOK não é
custo extra pra ninguém — é só endereçar a conta pra quem já ia pagar.

**Onde a chave mora:** guardar chave de terceiro no banco da aplicação é
anti-padrão reconhecido, mesmo com criptografia da aplicação. No banco fica só
uma *referência*; o valor vai pro Supabase Vault. E — regra da 4YU — nunca no
repositório, que aqui é público.

### 8. Modelo de operação: agência. Quem desenha o fluxo é você.

No MVP o cliente **não** mexe no editor. Você desenha, você publica, você faz
manutenção. Isso não é limitação temporária a ser corrigida — é o que faz o MVP
caber:

- some login multi-usuário, papéis, permissão, convite
- a UI pode ser densa e técnica, porque o usuário é você
- some a categoria inteira de bug "cliente quebrou o próprio fluxo"
- e você aprende, na mão, onde o produto dói — que é a informação que decide
  a v2

O cliente ganha depois um acesso **só de leitura**: os leads dele e as conversas
dele. Isso já entrega valor visível sem abrir o editor.

Consequência de arquitetura: dá pra adiar autenticação de verdade. Uma senha só,
sua, no MVP. `accounts` e papéis entram quando existir um segundo operador.

### 9. Todo fluxo tem saída. O sistema não deixa publicar sem.

O padrão de falha mais documentado em bot não é a IA errar — é o **"hello
loop"**: o bot não entende, repete a saudação, a pessoa tenta de novo, repete de
novo. A pessoa fica presa e vai embora achando a empresa incompetente. O segundo
padrão é o bot tratar desvio de assunto como defeito e travar.

Então três regras entram no **motor**, não na boa vontade de quem desenha:

1. **Palavra-chave global de escape.** "atendente", "humano", "falar com alguém"
   → `handoff` imediato, de qualquer nó, sem precisar estar no desenho. A LGPD
   também pede isso: caminho visível pra humano a qualquer momento.
2. **Contador de incompreensão.** Todo nó `pergunta` conta as tentativas. Na
   terceira, sai pro humano automaticamente. Loop infinito passa a ser
   impossível por construção, não por cuidado.
3. **Validador bloqueia publicação.** `core/flow/validar.ts` recusa fluxo que:
   não tem nó de início · tem nó órfão · tem `pergunta` sem saída · **não tem
   nenhum caminho até um `handoff`**.

A terceira é a mais valiosa: o produto te impede de subir um bot que prende
gente. Você não precisa lembrar — o sistema lembra.

E a primeira mensagem de todo fluxo declara que é um bot. É exigência de LGPD
("informar que a interação é com um sistema automatizado") e, na prática, baixa
a irritação de quem está do outro lado.

---

## Árvore de arquivos

```
autofluxos/
├── README.md
├── .env.example                       ← só NOMES de variável, nunca valores
├── .gitignore                         ← .env* na primeira linha (repo é público)
├── package.json
├── next.config.ts
├── tsconfig.json
│
├── docs/
│   ├── ARQUITETURA.md                 ← este arquivo
│   └── DECISOES.md                    ← log de decisão: o quê, quando, por quê
│
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql          clients, flows
│       ├── 0002_versoes.sql       flow_versions (imutável) + publicar_fluxo()
│       ├── 0003_conversas.sql     channels, contacts, sessions, messages, handoffs
│       └── 0004_leads.sql         view `leads` (security_invoker!)
│
└── src/
    │
    ├── core/                          ★ CORAÇÃO — zero import de Next, WhatsApp ou DB
    │   ├── flow/                      ✅ construído
    │   │   ├── schema.ts              Zod: Fluxo, No, Aresta + tipos — fonte da verdade
    │   │   ├── validar.ts             tem início? nó órfão? saída para humano?
    │   │   └── validar.test.ts
    │   └── engine/                    ✅ construído
    │       ├── types.ts               Sessao, Entrada, Acao
    │       ├── executar.ts            (fluxo, sessão, entrada) → {ações, sessão}
    │       ├── interpolar.ts          "Oi {{nome}}, sobre {{assunto}}..."
    │       └── executar.test.ts       ← o teste que segura o produto inteiro
    │
    ├── channels/                      ★ ADAPTADORES DE CANAL
    │   ├── types.ts                   interface Canal
    │   ├── mock.ts                    simulador (dia 1)
    │   ├── cloud-api.ts               Meta oficial
    │   └── evolution.ts               (só se precisar)
    │
    ├── server/                        ★ COLA — aqui mora o efeito colateral
    │   ├── db.ts                      ✅ Supabase com a chave secreta
    │   ├── acoes.ts                   ✅ server actions (criar, salvar, publicar)
    │   ├── repos/
    │   │   ├── clientes.ts            ✅
    │   │   ├── fluxos.ts              ✅
    │   │   ├── conversas.ts           ✅ canal, contato, sessão, mensagem, handoff
    │   │   └── leads.ts               ✅ lê a view `leads` + a conversa
    │   ├── receber-mensagem.ts        ✅ dedup → sessão → motor → executa ações
    │   └── ia/
    │       └── responder.ts           chamada ao LLM com contexto travado
    │
    ├── exemplos/                      ✅ fluxo de demonstração (dado, não código)
    │   └── triagem.ts                 some quando o editor e o banco existirem
    │
    ├── app/                           ★ NEXT.JS — front e back no mesmo deploy
    │   ├── (auth)/
    │   │   └── login/page.tsx
    │   ├── (app)/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                       lista de clientes
    │   │   └── clientes/[clienteId]/
    │   │       ├── page.tsx                   visão geral
    │   │       ├── contexto/page.tsx          o que o bot sabe sobre o negócio
    │   │       ├── canal/page.tsx             conectar o número
    │   │       ├── leads/page.tsx             ← a tela que prova o valor
    │   │       ├── conversas/page.tsx         histórico real
    │   │       └── fluxos/
    │   │           ├── page.tsx
    │   │           └── [fluxoId]/page.tsx     ← EDITOR + SIMULADOR lado a lado
    │   └── api/
    │       ├── webhook/whatsapp/route.ts      GET verifica · POST recebe
    │       ├── simular/route.ts               roda o motor sem WhatsApp
    │       └── fluxos/[id]/publicar/route.ts
    │
    ├── components/
    │   ├── conversa.tsx               ✅ o chat de teste (chama /api/simular)
    │   └── editor/                    ✅ construído
    │       ├── editor.tsx             canvas + barra + painel + salvamento
    │       ├── nos.tsx                o visual dos 6 blocos e suas alças
    │       └── painel.tsx             form do bloco selecionado
    │
    └── lib/
        └── utils.ts
```

**A regra que sustenta a árvore:** `core/` não importa nada de `app/`,
`server/` ou `channels/`. A dependência anda numa direção só. Se um dia o produto
sair do Next, virar VPS, virar CLI — `core/` vai junto sem tocar numa linha.

> **Desvio consciente na construção.** O plano previa `core/flow/nos/`, um
> arquivo por tipo de nó. Na hora de escrever, os seis nós couberam num `switch`
> de ~60 linhas dentro de `executar.ts`, e seis arquivos de dez linhas cada só
> acrescentariam indireção para ler a mesma coisa. Fica assim enquanto for
> pequeno; quando um nó ganhar lógica própria de verdade, ele sai para o
> arquivo dele.

## Banco (Supabase / Postgres)

> **Construído até agora:** `clients` e `flows` (0001) e `flow_versions` (0002).
> `flows.rascunho` é `jsonb` mutável; publicar tira uma foto dele numa linha de
> `flow_versions` que **o banco recusa alterar** (gatilho `flow_versions_imutavel`).
> `contacts`, `sessions` e `messages` entram no passo 6, quando a gente souber o
> formato real do que o WhatsApp manda.
>
> A metade que falta do §5 é o vínculo `sessions.flow_version_id` — ele só existe
> quando `sessions` existir. Até lá, o versionamento já está de pé e as versões
> já são imutáveis.
>
> **RLS ligada e sem política nenhuma**, de propósito: a chave `publishable` não
> lê nem escreve nada, e todo acesso passa pelo servidor com a chave `secret`.
> Enquanto não existir login, esse é o estado seguro — as políticas entram junto
> com o login, e não antes.

```sql
clients         id, nome                          -- Reinaldo
                contexto_negocio text             -- o que a IA pode dizer
                ia_habilitada bool                -- Etapa 2 é plano à parte
                ia_provider, ia_modelo
                ia_chave_ref                      -- ponteiro pro Vault, NÃO a chave

channels        id, client_id, provider, phone_number_id,
                waba_id, status                   -- segredo NÃO fica aqui

flows           id, client_id, nome, versao_publicada_id
flow_versions   id, flow_id, versao, grafo jsonb, publicado_em

contacts        id, client_id, wa_id, nome, campos jsonb
                consentimento_em                  -- LGPD
sessions        id, contact_id, flow_version_id, no_atual,
                vars jsonb, tentativas int,       -- anti hello-loop (§9)
                status, atualizado_em
messages        id, session_id, direcao, wa_message_id UNIQUE,
                texto, payload jsonb, ts
handoffs        id, session_id, motivo, criado_em
```

Dois detalhes que evitam bug caro:

- **`messages.wa_message_id UNIQUE`** — a Meta reenvia webhook quando não recebe
  200 a tempo. O `UNIQUE` faz a deduplicação virar erro de constraint que a gente
  engole. É dedup de graça, garantido pelo banco, não por lógica que a gente
  esquece de escrever.
- **`sessions.flow_version_id`** — o congelamento de versão da §5.

## O caminho de uma mensagem

```
WhatsApp → POST /api/webhook/whatsapp
             │
             ├─ valida assinatura (X-Hub-Signature-256)
             ├─ responde 200 IMEDIATAMENTE          ← Meta corta em 20s; mire <5s
             └─ processa (waitUntil)
                  │
                  ├─ INSERT em messages → duplicata? descarta e sai
                  ├─ acha/cria contact + session
                  ├─ core/engine/executar(grafo, sessão, texto)   ← função pura
                  ├─ salva sessão nova
                  └─ canal.enviar(ações)
```

E o simulador:

```
Navegador → POST /api/simular
              └─ core/engine/executar(grafo, sessãoFake, texto)   ← MESMA função
                   └─ canal `mock` devolve as ações como JSON
```

Duas portas de entrada, um motor só. É isso que faz o simulador valer alguma
coisa.

## A tela que decide tudo

`/clientes/[id]/fluxos/[id]` — editor e simulador na mesma tela:

```
┌────────────────┬────────────────────────────────┬──────────────┐
│  + Mensagem    │                                │  SIMULADOR   │
│  + Pergunta    │      ┌──────────┐              │              │
│  + Condição    │      │ Boas-    │              │  bot: Oi! 👋 │
│  + Salvar      │      │ vindas   │              │              │
│  + IA          │      └────┬─────┘              │  você: oi    │
│  + Humano      │           │                    │              │
│                │      ┌────▼─────┐              │  bot: Como   │
│                │      │ Como     │              │  posso       │
│                │      │ ajudar?  │              │  ajudar?     │
│                │      └─┬──────┬─┘              │  [Orçamento] │
│                │  orça. │      │ cliente        │  [Sou clien] │
│                │   ┌────▼─┐ ┌──▼────┐           │              │
│                │   │ Nome?│ │Humano │           │  ┌─────────┐ │
│                │   └──────┘ └───────┘           │  │digite...│ │
│                │                                │  └─────────┘ │
└────────────────┴────────────────────────────────┴──────────────┘
                                            [Salvar]  [Publicar]
```

Você arrasta um nó, clica, edita no painel, e testa **na hora** na direita — sem
publicar, sem WhatsApp, sem esperar ninguém. Esse loop de segundos é o produto.

Sobre o alerta de "não comece pelo editor de setinha": ele está certo sobre o
risco errado. O que mata MVP é escrever um *motor de canvas do zero* com 20 tipos
de nó. Usar React Flow com 6 nós e um painel lateral de formulário é caro em
horas? Não. E como o formato salvo já é o do React Flow, não existe camada de
tradução — que é onde a complexidade realmente moraria.

## Cliente 00 — o número de freelance do Gabriel

**O primeiro número a rodar o bot é o do Gabriel, não o do cliente.** Só depois
que estiver funcionando é que a Prelúdio entra.

Isso não é só cautela, é o melhor teste que existe: o caminho inteiro —
Embedded Signup, Coexistence, verificação da Meta, webhook, custo por conversa —
é exercitado num número onde errar não custa nada. Todo susto acontece com a
gente, não com o cliente do sócio.

Consequência prática: o `cloud-api` sai do "passo 6" e pode ser plugado assim que
a burocracia da Meta liberar, porque tem cobaia. E o Gabriel passa a ser usuário
do próprio produto, que é como se descobre o que é irritante nele.

## Cliente 01 — Prelúdio Produtora (a confirmar)

Produtora de vídeo em São Paulo (Barra Funda). 16 anos, +150 clientes, +500
produções. Serviços: vídeo institucional/comercial/promocional, cobertura de
eventos, edição e pós, social media — e casamento (aparece nos depoimentos).
CTA do site é "Solicitar orçamento!" → WhatsApp.

Operação hoje: tráfego pago → WhatsApp → triagem na mão → agenda ou liga.
**Já fecha contrato bom.**

O problema dele não é "atender 24h". É específico: **quem está em dúvida no
preço trava e não avança.** Lead quente converte; lead morno esfria. Ele responde
com textão, áudio e arquivo — funciona pro quente, e é inconsistente pro morno.

Isso é uma sorte, porque é um problema muito mais afiado do que o genérico. Mas
impõe regras que não estavam no desenho.

### Por que trava no preço (hipótese a validar com os arquivos)

Produção de vídeo é orçamento sob medida. Um institucional pode custar R$3 mil ou
R$40 mil dependendo de diária, equipe, roteiro, locação, entregáveis. Então quem
chega no WhatsApp pergunta "quanto custa?" e **não existe resposta curta**.

O morno trava aí: perguntou preço, ouviu "depende, me conta mais", e leu isso
como "vai ser caro". Não é objeção de preço de verdade — é **ausência de âncora**.

Se essa hipótese estiver certa, o trabalho do bot não é desviar da pergunta de
preço. É levantar o escopo em três ou quatro perguntas e **devolver uma faixa**:
"institucional desse tamanho costuma ficar entre X e Y". Faixa faz duas coisas
boas ao mesmo tempo: quem não tem orçamento se despede sozinho (e para de consumir
o tempo dele), e quem tem relaxa e agenda.

**Esta é a pergunta central do projeto, e é do cliente:** a Prelúdio topa o bot
falar faixa de preço? Se não topar, o bot não resolve o problema que ele contou —
resolve outro. Vale perguntar antes de desenhar qualquer coisa.

Segundo recorte que os arquivos precisam responder: **casamento e empresa são
duas conversas diferentes**, com preço, urgência e vocabulário diferentes. O
fluxo bifurca cedo, provavelmente na primeira pergunta.

### As três regras

### Regra A — o bot não pode atrapalhar o lead quente

O funil **já funciona**. Enfiar um bot na frente de um funil que converte é a
forma mais fácil de piorar o resultado e queimar o produto no primeiro cliente.

Então o fluxo tem que ter um **atalho**: identificou sinal de compra ("quanto
custa, quero fechar, quando você tem horário"), manda pro humano na hora. O bot
existe pra trabalhar o **morno** — a faixa que hoje ele perde.

Métrica do piloto, então, não é "mensagens automatizadas". É: **o quente
continuou fechando igual, e o morno passou a agendar mais?** Se a primeira metade
falhar, o produto perdeu mesmo tendo "funcionado".

### Regra B — áudio não pode quebrar o bot

No Brasil a pessoa manda áudio. Se o bot receber áudio e responder "não entendi",
a conversa morre e a culpa é nossa. Mídia estava fora do MVP — não dá mais.

Escopo mínimo: **qualquer mensagem que não seja texto → `handoff` imediato.**
Não é gambiarra: quem manda áudio está engajado, e mandar pro humano é a resposta
certa. Transcrição (o Gemini faz áudio nativo) entra na v1.1, não agora.

Efeito no motor: o nó `pergunta` precisa saber diferenciar "não entendi o texto"
(conta strike, §9) de "não é texto" (sai na hora).

### Regra C — Coexistence: o celular dele continua sendo o inbox

Havia um impeditivo escondido aqui. Historicamente, um número registrado na Cloud
API **para de funcionar no app do WhatsApp Business**. Ou seja: ele perderia o
celular dele, e como o nosso MVP não tem inbox de atendimento, o `handoff` daria
num lugar sem ninguém. O produto travaria no primeiro cliente.

A Meta lançou o **Coexistence** ("API Solutions for Business App Users"): app e
Cloud API no **mesmo número**, com sincronia bidirecional e histórico preservado.
Mensagem enviada pelo app aparece pra API e vice-versa (Messaging Echoes).

Isso resolve três problemas de uma vez:

- **Não precisa construir inbox.** O celular dele já é o inbox. Ele continua
  mandando áudio e textão do jeito que já converte.
- **`handoff` fica trivial:** o bot silencia e avisa. Ele responde do celular.
- **Bônus — pausa automática:** como a API recebe eco do que ele digita no app,
  dá pra detectar "o humano assumiu" e calar o bot sozinho, sem ninguém apertar
  nada. É o handoff mais elegante possível, e sai quase de graça.

E mata o risco da Regra A de vez: ele pode interromper o bot a qualquer segundo,
do bolso dele. O bot vira assistente, não porteiro.

**A confirmar na implementação:** Coexistence exige onboarding por parceiro que
suporte "business app number onboarding" — é uma opção do Embedded Signup, e
precisa estar ligada do nosso lado. Se por algum motivo não rolar, o plano B é
número novo pro bot e ele fecha do número atual — pior, mas não impeditivo.

### O que os arquivos dele viram

O sócio tem os modelos de conversa e o material de abordagem. Isso não é
"contexto pra IA" — é o ativo mais valioso do projeto, e vira três coisas:

1. **O desenho do fluxo** — as perguntas que ele já faz, na ordem que ele já faz
2. **O `contexto_negocio`** do nó de IA — preço, o que responder, o que não
3. **A suíte de teste do motor** — cada conversa real vira um caso no simulador.
   "Essa conversa que ele fechou em março: o bot conduziria igual?" É assim que a
   gente valida sem cobaia humana.

O item 3 é o que separa isso de um NotebookLM: não é resumir a abordagem dele, é
**executar** a abordagem dele e conferir contra o que já deu certo.

## O caminho da Meta (começa agora, roda em paralelo)

Você não vai "conectar um número". Como agência atendendo vários clientes, o
caminho certo é virar **Tech Provider** e usar o **Embedded Signup**: um botão no
seu painel onde o cliente entra com o Facebook dele e autoriza o número — sem
você pedir senha, sem você administrar o Business Manager dele.

Isso importa porque a alternativa (você criar tudo na sua conta) te deixa dono
do número do cliente, e o dia que ele sair vira uma briga.

Ordem burocrática:

1. App na Meta for Developers + produto WhatsApp
2. **Verificação de negócio** da 4YU (documento de empresa — é a etapa lenta)
3. App Review + Access Verification
4. Implementar Embedded Signup **v4**

Dois números que mudam o planejamento:

- Sem verificação completa: **10 clientes novos a cada 7 dias**. Com verificação:
  **200**. Pro MVP, 10 é de sobra — mas a verificação demora, então começar cedo
  é de graça.
- **Embedded Signup v2 morre em 15/out/2026.** Nada de tutorial antigo: já
  nascemos no v4.

Enquanto isso roda, os passos 1–5 abaixo não esperam nada.

## As três etapas

Cada etapa termina numa coisa que **funciona sozinha e pode ser vendida**. Não
são fases de um projeto — são três produtos empilhados.

### Etapa 1 — Automação, sem IA nenhuma

O bot manda mensagem, oferece opções em botão, a pessoa clica, cai na próxima,
clica de novo, recebe link, e o lead vai parar numa base. Zero LLM.

| # | Entrega | Prova o quê |
|---|---|---|
| 1 ✅ | `core/` + testes | o motor anda no grafo corretamente |
| 2 ✅ | `/api/simular` + chat de teste | dá pra conversar com um fluxo escrito na mão |
| 3 ✅ | Supabase + CRUD de cliente/fluxo | o fluxo persiste |
| 4 ✅ | Editor React Flow + painel | dá pra **desenhar** o fluxo |
| 5 ✅ | Publicar + versionar | rascunho ≠ produção |
| 6 | Webhook + `cloud-api` no número do Cliente 00 | **funciona no WhatsApp** |
| 7 | Tela de leads + `handoff` | o cliente vê valor e o humano assume |

Critério de pronto, na prática: **o Gabriel manda mensagem de outro número pro
próprio WhatsApp, clica nos botões, chega até o fim, e o lead aparece na tela.**

Não subestime essa etapa por não ter IA. Ela é a que:
- não custa token nenhum e não tem alucinação
- não tem exposição de dado pessoal a LLM (some a discussão inteira do §7)
- prova o encanamento todo: webhook → motor → envio → banco
- **já resolve muito cliente sozinha** — a maioria não precisa de IA, precisa de
  não perder lead às 22h

Se a Etapa 1 funcionar redondo, o produto existe. A IA é upgrade, não requisito.

### Etapa 2 — IA como serviço extra, cobrado à parte

O nó `ia` entra. O cliente paga à parte, com a chave dele (§7). Comercialmente é
um plano acima; tecnicamente é **um tipo de nó a mais** — o resto do sistema não
muda em nada.

Isso vira uma flag: `clients.ia_habilitada`. O validador recusa publicar fluxo
com nó `ia` para cliente que não contratou. Vender IA passa a ser ligar um
booleano, não fazer um deploy.

### Etapa 3 — Encaixar a Prelúdio **sem tocar no produto**

Com tudo funcionando, a pergunta vira: como o dia a dia da Prelúdio cabe aqui?
E a resposta tem que ser **configuração** — desenhar o fluxo dela, escrever o
contexto dela, ligar o número dela.

Se em algum momento a resposta for "precisa mudar o código", isso é um **sinal de
alerta**, não uma tarefa. Significa que faltou um nó genérico, e o certo é criar
o nó genérico — não o remendo da Prelúdio.

Etapas 1 e 2 não dependem da Prelúdio, dos arquivos dela, nem da resposta sobre
faixa de preço. Só a Etapa 3 depende.

### Restrição do WhatsApp que molda o nó `pergunta`

A Cloud API não deixa botão à vontade:

| Formato | Limite | Quando |
|---|---|---|
| Reply Buttons | **3 opções** | o caso comum |
| List Message | **10 opções**, em seções | menu maior |
| — | acima de 10 | **não existe** |

Então o nó `pergunta` escolhe o formato sozinho pela quantidade de opções, e o
validador (§9) **bloqueia publicar** fluxo com mais de 10. É melhor descobrir
isso no editor do que numa mensagem que a Meta recusa em produção.

E isso é regra de design, não só técnica: fluxo bom cabe em 3 botões. Se um nó
precisa de 8 opções, quase sempre a pergunta está errada.

## O que fica fora do MVP (de propósito)

Cada item aqui é uma coisa boa que só atrapalha agora:

- Múltiplos usuários por cliente, papéis, permissões
- Disparo em massa / campanhas (caro no modelo por mensagem, e é outro produto)
- Mídia **de saída** (bot mandar áudio/arquivo) e transcrição de áudio recebido
  — receber mídia sem quebrar é obrigatório (Regra B), entender não é
- Inbox de atendimento humano dentro do sistema (handoff v1 = avisa e para o bot)
- Métricas, funil, dashboard
- Marketplace de templates de fluxo
- Integração com CRM
- Editor de fluxo pro cliente final mexer sozinho

## Já decidido (11/ago/2026)

- **Operação:** modelo agência. Só o Gabriel mexe no editor. Cliente ganha
  leitura (leads + conversas) depois.
- **IA:** o cliente paga, com a chave dele (BYOK). Free tier só em dev, com dado
  fictício.
- **Meta:** começar a burocracia de Tech Provider agora, em paralelo.
- **Canal do dia 1:** simulador (`mock`). Evolution API fica fora — o risco é
  perder o número do cliente, que é o pior fracasso possível pra uma agência.

## O que ainda não está decidido

1. **Qual é o ramo do Cliente 01** e qual o ticket do contrato dele — decide se
   R$700/mês de manutenção é caro ou é troco.
2. **Volume de conversas/mês** — decide o custo Meta e se o free tier do Gemini
   aguentaria os testes.
3. **Qual LLM padrão** que a gente recomenda pro cliente comprar (Gemini Flash
   pago é o palpite: barato e rápido o bastante pra conversa).
4. **Quem é o titular da conta Meta e da chave de IA** — tem que ser o cliente
   final, não a agência (ver seção de preço).
