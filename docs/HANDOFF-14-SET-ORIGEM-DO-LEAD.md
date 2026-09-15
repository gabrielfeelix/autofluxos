# De onde o lead veio — o que ficou pronto em 14/set/2026

> Sessão inteira sobre uma pergunta: o lead que chega de anúncio deve dizer de
> onde veio, e o que isso custa. Terminou com o modelo **corrigido pelo dono no
> meio do caminho** — a correção está na seção "O erro que virou o desenho", e
> é a parte que mais importa reter.

## Onde parou

Catorze commits, árvore limpa, `main` em `a886114`. Typecheck e lint limpos,
682 testes de `core/` + `channels/` passando, 33 de `receber-mensagem` passando
contra o banco local.

**A `0050` foi aplicada em produção em 14/set/2026**, com autorização explícita
do dono, pela Management API (o aplicador do AutoFluxos — nunca `db push`).

Roteiro seguido, na ordem do [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md):

1. ensaio `begin; <migration>; rollback;` contra a produção — criou as duas
   tabelas e desfez, com `0` objetos remanescentes conferidos depois;
2. aplicação;
3. conferência objeto a objeto: `passagens` (10 colunas) e `anuncios` (7), RLS
   ligada nas duas, seis índices, PostgREST respondendo `200` em ambas;
4. **Verandi intacta** — 42 tabelas em `app_verandi` antes e depois; `public`
   foi de 46 para 48;
5. teste de fumaça em transação com rollback: duas passagens gravadas e o retry
   do webhook recusado pelo índice de dedupe.

Nenhum dado de teste ficou no banco.

## A pergunta que originou tudo

Um amigo do dono tem uma agência de tráfego (BME) e quer oferecer CRM aos
clientes: o lead do anúncio cairia num Kanban em vez de numa planilha. A
investigação comparou três repositórios da 4YU e concluiu que o AutoFluxos é o
único candidato vivo — `crm` e `otimiza-gestor` estão parados desde o começo de
agosto, e cada um tem metade do que o caso pede (o `crm` tem Kanban e é
single-tenant por usuário; o `otimiza-gestor` tem multi-org e nada de Meta).

O levantamento completo, com fontes da doc da Meta e comparação de dez
concorrentes, está em [PLANO-LEAD-ADS.md](PLANO-LEAD-ADS.md). Este handoff é só
o que foi construído.

## O erro que virou o desenho

A primeira implementação tratou origem como **carimbo do contato**: gravava na
primeira mensagem e congelava. Havia teste garantindo o congelamento.

O dono desmontou isso em uma frase — *"o importante é o lead existir. A campanha
é só um meio por onde ele veio"* — e o caso que ele descreveu é o comum em
tráfego pago, não a exceção: **remarketing pega quem já falou com a gente**.
Quem veio pela campanha de agosto, sumiu e voltou pela de setembro passou por
duas, e o modelo antigo descartava a segunda.

O desenho final tem **duas respostas em dois lugares**, e é deliberado:

| | Onde | Muda? | Responde |
|---|---|---|---|
| Primeiro toque | `contacts.campos.origem` | **não**, congelado | quem trouxe esta pessoa para a base |
| Histórico | tabela `passagens` | uma linha por chegada | por onde ela já passou |

Reescrever o primeiro toque faria a campanha de remarketing levar o crédito de
quem agosto conquistou — que é o erro que a regra de primeiro toque existe para
evitar. Guardar só o histórico faria "de onde veio" depender de ler a lista
inteira e escolher. As duas juntas custam uma linha a mais.

## O que existe agora

### CTWA — o lead que clica no anúncio e manda mensagem

Já funcionava antes da sessão; o `referral` era capturado desde sempre e
**nenhuma tela o distinguia** do que o bot perguntou. O que mudou:

- `src/core/contatos/origem.ts` — leitura pura da origem. A lista de chaves é
  fonte única: quem mostra lê dela, quem esconde esconde por ela.
- `atribuirOrigem` (em `receber-mensagem.ts`) guarda o referral **inteiro** —
  `body`, `source_url`, `media_type`, `ctwa_clid`. Chega uma vez só, não volta,
  e depois de 90 dias nem a API da Meta sabe mais.
- `src/server/repos/passagens.ts` — registra cada chegada. Nunca lança: falhar
  aqui viraria webhook com erro, reentrega da Meta e mensagem duplicada.
- `src/components/lead/quem-e.tsx` — a coluna do contato mostra a **lista** de
  passagens, da mais recente para a mais antiga, com data.

### O nome da campanha

O `referral` traz o `ad_id` e o título do criativo, nunca o nome que o gestor
deu no Gerenciador. Esse nome exige uma segunda chamada com token de Ads:

- `src/channels/marketing-api.ts` — uma chamada ao nó `Ad` com field expansion
  traz os três nomes. Nunca lança; devolve o código da Meta, porque 190
  (reconectar) e limite (esperar) pedem ações opostas e erram parecido na tela.
- `src/server/resolver-anuncios.ts` — lê o cache em lote, pergunta só o que
  venceu (24h), e **degrada de forma visível**: o nome some e o alerta vai à
  auditoria.
- `src/server/token-de-anuncios.ts` — o token mora numa Conexão chamada
  `meta-ads`, tipo `bearer`, que já existia. Sem tipo novo, sem migration de
  credencial. Como ligar está em [CONEXOES.md](CONEXOES.md).

### Refatoração de apoio

`porNoQuadroPadrao` saiu de `receber-mensagem.ts` para
`src/server/quadro-de-entrada.ts`: entrar no funil é consequência de **ser
contato novo**, não de ter mandado mensagem. Comportamento idêntico hoje; existe
para a segunda porta de lead ter onde chamar.

## A migration 0050

Cria duas tabelas, porque são duas coisas: `passagens` (histórico, não muda) e
`anuncios` (cache do rótulo de hoje).

**Aplicada e verificada no local.** Três passagens entram — incluindo o mesmo
anúncio em dois dias — e o retry do webhook no mesmo minuto é recusado pelo
índice.

Uma armadilha que custou uma rodada: `date_trunc('minute', criado_em)` num
índice é recusado com **42P17** (`functions in index expression must be marked
IMMUTABLE`), porque a versão `(text, timestamptz)` depende do fuso da sessão. A
saída foi coluna gerada com `at time zone 'utc'`, que torna a expressão
imutável. Está comentado no arquivo.

## Lead Ads — o formulário nativo (feito em 14/set, noite)

É o que o cliente do BME realmente pediu: hoje eles pagam um intermediário
(LeadsBridge/Pluga) para tirar o lead do Facebook e jogar numa planilha. Agora
o lead entra direto.

- `src/core/lead-ads.ts` — traduz o `field_data` da Meta. Busca telefone por
  *conter*, não por igualdade, porque campo customizado tem a chave que o
  anunciante digitou (`qual_seu_whatsapp` é o caso brasileiro).
- `src/app/api/webhook/leadgen/route.ts` — objeto `page`, campo `leadgen`.
  Responde `200` e processa no `after()`.
- `src/server/receber-lead-do-formulario.ts` — do aviso ao cartão no funil.
- `0051_paginas_de_lead` — traduz `page_id` para conta. **Não vem do corpo**: a
  assinatura prova que a Meta mandou, não de quem é o lead.
- `0052_formularios_de_lead` + cron `/api/manutencao/leads-do-formulario` — a
  reconciliação de 48h, porque a Meta não reentrega depois de um `200` e apaga
  o lead em 90 dias.

Como ligar, passo a passo, em [LEAD-ADS.md](LEAD-ADS.md). **As três migrations
(0050, 0051, 0052) estão aplicadas em produção**, cada uma com ensaio em
transação antes e Verandi conferida depois (42 tabelas, sempre).

## O que falta, em ordem

1. ~~Aplicar a `0050` em produção.~~ **Feito em 14/set.** Ver acima.
2. **Criar a conexão `meta-ads`** para o nome da campanha aparecer. Sem ela a
   lista de passagens funciona igual, com o título que a pessoa leu no dia.
3. **Testar com anúncio real.** Ninguém clicou num CTWA de verdade ainda; a
   prova até aqui é payload da doc da Meta em teste automatizado. **Contato
   antigo não ganha passagem retroativa** — só conversa nova.
4. ~~Filtro "veio de anúncio" nos rails.~~ **Feito em 14/set.** Terceiro eixo
   da fila, em memória, com contagem por grupo. Não vai para a URL de propósito
   — é recorte de análise, não "onde eu parei".
5. ~~Lead Ads.~~ **Feito em 14/set.** Falta só o degrau que não é código:
   confirmar as permissões com um cliente real (ver [LEAD-ADS.md](LEAD-ADS.md)),
   e uma tela para ligar Página sem `insert` no banco.
6. **Conversions API** — mandar de volta "este lead virou venda". Não começou.
   O `ctwa_clid` e o `lead_da_meta` já são guardados, que é o que mantém a porta
   aberta: HubSpot e Zoho não guardam o lead id e ficam trancados fora desse
   loop.

## Armadilhas registradas

- **PostgREST cacheia schema.** Tabela nova existe no banco e some no
  `schema cache` até `notify pgrst, 'reload schema'` ou reiniciar
  `supabase_rest_autofluxos`. O sintoma é "Could not find the table", que parece
  migration não aplicada e não é.
- **`vitest.config.ts` carrega o `.env` do repo em `test.env`**, e isso
  **sobrepõe variável do shell**. Para rodar contra o local não adianta
  `SUPABASE_URL=... npx vitest`: é preciso editar o `.env` (e restaurar depois).
  Os testes de repo apontam para **produção** por padrão — dívida já conhecida.
- **`leituras.test.ts` falha no banco local** (2 testes). Verificado com
  `git stash` que já falhava antes desta sessão; a função existe e tem grant.
  É diferença do banco recém-criado, não regressão.
- **`ctwa_clid` não vem em anúncio de WhatsApp Status.** Quem usar a presença
  dele como teste de "veio de anúncio" classifica Status como orgânico. O teste
  certo é a presença do `referral`. Há teste cobrindo.

## O que não fazer

- **Não reescrever `campos.origem`** a cada chegada. É primeiro toque de
  propósito; o histórico é a tabela `passagens`.
- **Não pedir `ads_management`** para ler nome de campanha. `ads_read` basta, e
  `ads_management` autoriza criar campanha e mexer em orçamento — poder que o
  produto não usa e não quer ter guardado.
- **Não transformar isto em painel de anúncios.** Saber de qual campanha a
  pessoa veio é contexto de atendimento, do mesmo tipo que o telefone. Criar
  campanha, mexer em orçamento e ler métrica são outro produto (o
  `otimiza-gestor`). A fronteira está escrita no topo de `marketing-api.ts`.
