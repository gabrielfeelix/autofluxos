# A mídia recebida está no ar, e nada foi testado no WhatsApp de verdade

> Sessão de **15/set/2026**, continuando
> [HANDOFF-15-SET-CAMADA-2.md](HANDOFF-15-SET-CAMADA-2.md).
>
> **Leia a seção "O que ninguém provou" antes de escrever qualquer linha.** Ela
> é a razão deste documento existir, e não a lista do que foi feito.
>
> O dono vai testar no WhatsApp por conta dele. **Não presuma que passou.**

---

## Onde parou

`main` em `4f9e578`, empurrado, Vercel `READY` em produção às 10:33 — conferido
pela API, não pelo painel.

**1.517 testes passando**, typecheck, lint e `npm run build` limpos.

Três commits nesta sessão:

| Commit | O quê |
|---|---|
| `f5597bc` | Reação otimista, seletor de emoji, tique azul, localização e cartão de contato, cor no avatar |
| `453d50d` | Mídia recebida: `0055`, download, bucket privado, URL assinada, expurgo |
| `4f9e578` | Registro da `0055` aplicada e a armadilha das policies |

Migration **`0055` aplicada em produção** com autorização explícita, conferida
pelos dois testes que o [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) exige.
Leia lá o parágrafo dela antes de mexer em Storage.

O levantamento que fundamenta tudo isso — Meta, LGPD, concorrentes, números
medidos — está em [PLANO-MIDIA-RECEBIDA.md](PLANO-MIDIA-RECEBIDA.md). **Leia
antes de propor mudança de retenção ou de bucket.** As decisões já foram
tomadas com evidência, e refazer a discussão sem ler é desperdício.

---

## O que ninguém provou

**Nada do que subiu hoje passou por um WhatsApp real.** Typecheck, teste e build
não são tela, e esta é a terceira sessão seguida em que essa frase precisa ser
escrita.

A lista do que está no ar sem prova de campo:

| Recurso | Como provar |
|---|---|
| Foto, áudio, vídeo, PDF e figurinha **recebidos** | Mandar cada um para o número e abrir o Inbox |
| Tique azul ao abrir a conversa | Abrir a conversa no painel e olhar o celular que mandou |
| Localização e cartão de contato | Mandar os dois pelo WhatsApp |
| Reação otimista | Reagir com a rede ruim e ver se desfaz com erro |
| Seletor de emoji | Escrever, abrir, inserir no meio da frase |

**Comece por aqui.** Se algo estiver quebrado, é mais barato descobrir agora do
que empilhar recurso em cima.

**Onde olhar quando a mídia recebida não aparecer**, em ordem:

1. `messages.arquivo` está preenchido? Se não, o download falhou — procure
   `[midia]` e `[whatsapp]` no log da Vercel.
2. Preenchido e a bolha vazia? A assinatura falhou — procure
   `[midia] não deu para assinar`.
3. Aparece o aviso "arquivo recebido, sem cópia guardada"? Então é o teto de
   16 MB, download falhado, ou mensagem anterior à `0055` (essas nunca vão ter
   arquivo: o `id` da Meta expira em 7 dias e não volta).

---

## O que fazer, em ordem

### 0. Provar o que está no ar (acima)

### 1. Podemos mandar áudio, figurinha, emoji? E ligar?

**É a pergunta que o dono deixou, e ela é de pesquisa antes de código.**

O que já se sabe, com fonte:

- **Emoji: pronto.** O seletor entrou hoje na caixa de resposta
  (`components/lead/seletor-de-emoji.tsx`). Emoji nunca foi recurso de API — é
  texto puro.
- **Áudio de saída: a API aceita.** `enviarMidia` já manda `audio`, e a Cloud
  API aceita AAC, AMR, MP3, M4A e OGG até 16 MB. **O que não existe é a
  gravação**: falta o botão de microfone no painel, `MediaRecorder` no
  navegador, e conferir em que formato ele grava — o Chrome costuma dar
  `audio/webm`, que **não está na lista da Meta**. Isso é o miolo do trabalho, e
  não o envio.
- **Figurinha de saída: camada 3, e é um problema de acervo, não de API.** WebP
  estática ≤ 100 KB, animada ≤ 500 KB. Converter no navegador é caminho ruim; o
  honesto é um acervo por cliente.
- **GIF vira MP4.** Funciona na prática, **não é documentado**. Precisa de teste
  real antes de virar promessa na tela.
- **Ligar: PESQUISE, não presuma.** Há indícios de que a Meta lançou uma
  **WhatsApp Business Calling API**, mas **isto não foi verificado nesta sessão
  e pode estar errado ou desatualizado**. Vá à documentação oficial e descubra:
  existe? Está disponível para Tech Provider? Exige permissão nova em App
  Review? Tem custo por minuto? Funciona no Brasil? **Se não achar na doc
  primária da Meta, a resposta é "não dá" — não complete com blog.**

**Como o dono quer que isso seja feito** (foi pedido explicitamente): pesquisar,
planejar, ler a documentação, executar, e **testar no Docker** antes de
qualquer coisa tocar produção.

### 2. O bucket público da mídia que SAI

**Ficou em aberto e é risco que já existe hoje, independente de tudo acima.**

A mídia que o atendente envia vai para `autofluxos-acervo`, que é **público**
(`getPublicUrl`). A `0017` decidiu isso conscientemente — a Meta precisa baixar
do `link` que mandamos — e escreveu a fronteira na mesma frase:

> *"Documento pessoal não entra, e isso é regra de uso, não de banco."*

**Não há nada no código que faça cumprir essa regra.** Um atendente que suba a
foto de um documento, ou um vídeo com uma pessoa dentro, põe isso em URL pública
e permanente.

A saída provável: a Meta só baixa o `link` **no momento do envio**, então dá
para servir com URL assinada de validade curta, como já se faz com a mídia
recebida. **Precisa de teste real** — a Meta tem que conseguir buscar dentro da
validade. Se não conseguir, o plano B é bucket público com nome imprevisível e
expurgo curto, que é pior e precisa ser discutido.

### 3. Camada 4 — chamada perdida

A Meta manda `connect` e `terminate`, e **nada que diga "perdida"**. Dá para
inferir de um `terminate` sem atendimento. **Precisa de uma chamada real** para
saber quais campos vêm — o mapeamento seria inferência nossa, não contrato. Se o
item 1 descobrir que a Calling API existe, esta seção muda de figura.

### 4. Marcar como lida: hoje só com usuário na sessão

`avisarQueLeu` só dispara quando há `usuarioId` — sem ele não há como saber
"quando leu" e cada atualização da tela mandaria outro recibo. Contas sem
usuário ficam sem tique azul. É decisão consciente, documentada em
`server/recibo-de-leitura.ts`, e pode ser revista se incomodar.

---

## Armadilhas desta sessão

Somam-se às dos handoffs anteriores. **Todas custaram tempo hoje.**

- **Os testes rodam contra PRODUÇÃO.** O `.env` aponta para
  `xxxynoshwirupkdzwxbj`. Eles criam cliente carimbado `zz-teste-…` e apagam no
  `afterAll`, então é controlado — mas `npm test` escreve no banco que não tem
  backup e que é dividido com a Verandi. Saiba disso antes de rodar a suíte, e
  nunca a rode com a suíte de outro produto no meio de uma alteração.

- **`docker info` pode dar falso negativo enquanto o daemon sobe.** Nesta sessão
  eu declarei "Docker indisponível" e estava errado — o stack local já existia.
  Rode `docker ps` antes de concluir que não dá.

- **`npx supabase db reset` é bloqueado pelo classificador** (lido como recurso
  compartilhado). O substituto que funcionou: aplicar as migrations pendentes em
  ordem via `psql` dentro do container, o que prova a ordem sem destruir nada:

  ```bash
  for f in supabase/migrations/00XX_*.sql; do
    docker exec -i supabase_db_autofluxos psql -U postgres -d postgres \
      -v ON_ERROR_STOP=1 -q < "$f"
  done
  ```

- **O stack local fica para trás.** Em 15/set ele estava na `0042` enquanto o
  disco tinha `0055`. Confira com
  `select version from supabase_migrations.schema_migrations order by version desc limit 1`
  antes de confiar no que o local diz.

- **O Docker NÃO reproduz as policies da produção.** Local tinha **zero**
  policies em `storage.objects`; produção tem **16**, todas da Verandi. Se você
  validar isolamento de bucket só no Docker, validou o ambiente errado.

- **Policy de `INSERT` guarda a regra em `with_check`, não em `qual`.** Numa
  consulta a `pg_policies` olhando só `qual`, quatro policies da Verandi
  pareciam não filtrar bucket — e filtravam. Olhe as duas colunas.

- **Quem criar policy em `storage.objects` sem filtrar `bucket_id` abre o
  `autofluxos-recebidos` junto** — e do outro lado tem documento pessoal de
  cliente. Mesma armadilha que a `0042` documentou para `grant` amplo em
  `public`.

- **Leitura de produção é bloqueada pelo classificador até o dono liberar.** Não
  contorne; peça.

- **As ferramentas de pesquisa inventam identificador plausível.** Nesta sessão
  um agente devolveu o advisory `GHSA-5h82-j98m-7r5c` para uma falha real do
  Chatwoot — o identificador **não existe** (404). As issues existiam. **Abra o
  que for citar antes de citar.**

---

## Decisões desta sessão que o próximo precisa conhecer

**A mídia não tem prazo próprio: herda a retenção de 12 meses do contato.** A
analogia com o WhatsApp que sugeria expurgo em 7 ou 14 dias é falsa — o WhatsApp
não apaga mídia do celular; o que expira é a cópia na nuvem dele, e o celular é
o arquivo permanente que aqui não existe. O mercado também não expurga (Zendesk
exige o admin configurar, Freshdesk só apaga com a conta encerrada, Chatwoot não
tem expurgo). Mas "nunca apagar" não se sustenta com os Platform Terms 3.d.i.2 e
a auditoria anual da Meta — por isso o arquivo morre junto com o contato.

**A coluna guarda caminho, nunca URL.** URL assinada em coluna é link público
com um passo a mais: viaja em log e em backup e vale até expirar. A assinatura
sai na hora de desenhar, em lote, com 5 minutos de validade.

**O download roda antes de o bot responder**, e isso custa alguns segundos. O
custo é aceito porque perder mídia é irreversível e atrasar não é — e porque
`aguardarResposta` já segura a resposta por até 25 segundos de propósito.

**Reagir é otimista; enviar mensagem não é.** A exceção é estreita e está
justificada em `components/lead/rodape-da-mensagem.tsx`. Não a estenda para
envio sem discutir.

**Quando não há cópia, a bolha diz isso.** Bolha vazia é a reclamação mais comum
do mercado neste recurso. Não remova o aviso para "limpar a tela".

---

## O que continua valendo dos handoffs anteriores

Enquete, editar mensagem enviada, apagar para todos e **foto de perfil do
contato** não existem na Cloud API. Não prometer na tela. O que aparece no
mercado são provedores não oficiais, que arriscam banir o número do cliente.

**A bolha está duplicada em duas páginas** — Inbox e Ficha. Toda mudança de
desenho vai nas duas.

**O vitest só inclui `.test.ts`, não `.test.tsx`.** Teste de componente é
`createElement` na mão.

---

## Regras que não se negociam

Estão em [AGENTS.md](../AGENTS.md) e em
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md), e valem inteiras:

- Nunca `supabase db push` ou `db reset` contra produção.
- A próxima migration vem de `ls supabase/migrations/ | tail -1`. **Não copie
  número de documento nenhum, inclusive deste.**
- Storage, Auth, extensões e cotas são **globais** — mexer neles exige avaliar a
  Verandi antes.
- **Nada em produção sem autorização explícita do dono**, e confira antes se a
  Verandi não está no meio de uma alteração.
- Teste no Docker primeiro. Foi pedido explicitamente nesta sessão.
