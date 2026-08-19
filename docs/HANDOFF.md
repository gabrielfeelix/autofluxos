# Handoff — 18/ago/2026

Para quem pegar este projeto agora, humano ou agente. Leia isto inteiro, depois
[PLANO-SISTEMA.md](PLANO-SISTEMA.md), e só então código. As decisões de produto
que não estão aqui estão lá; as que estão aqui não se renegociam sem o dono.

---

## 1. O resumo em dez linhas

O AutoFluxos é automação de atendimento no WhatsApp: fluxo desenhado num editor
visual, motor puro que executa, e handoff para uma pessoa quando o bot não dá
conta. Está em produção em `autofluxos.4yu.com.br` (Vercel), com Supabase
**compartilhado com outro produto** (Verandi).

**A Etapa A está inteira no ar (A1 a A7), e a Etapa B também (B1 a B6)** — com
um recorte explícito em B5, dito no §7. O que sobra da Etapa A esbarra só em
coisas que o dono resolve; ver [PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md).

`npm test` → **583 passando, 8 pulados** (os 8 dependem de `IA_TESTE_REAL` e
`API_TESTE_REAL`, por desenho). `typecheck`, `lint` e `build` limpos.
**Migrations aplicadas: até a `0029`, todas. A próxima a escrever é a `0030`.**

---

## 2. O que existe hoje, rota a rota

### Portas de entrada

| Rota | O que é | Quem alcança |
|---|---|---|
| `/login` | senha única do time (`PAINEL_SENHA`), a porta principal hoje | todo mundo |
| `/entrar` | login por usuário (Better Auth) | todo mundo |
| `/criar-conta` | primeira execução **e** cadastro feito por administrador | senha única ou administrador |
| `/api/auth/[...all]` | a porta do Better Auth | todo mundo |

### Painel do operador 4YU

| Rota | O que é |
|---|---|
| `/` | lista de todos os clientes, ordenada por quem espera atendimento |
| `/contas` | seletor de companhia de quem tem mais de uma |
| `/admin/contas` | contas e quem entra em cada uma; ligar pessoa a conta |
| `/admin/usuarios` | quem existe, papel, sessões, **entrar como**, suspender |
| `/admin/auditoria` | o registro append-only |

### Painel do cliente

Barra lateral com cinco itens — **Painel · Inbox · Contatos · Automações ·
Configurações**. Não há mais abas no topo.

| Rota | Item da barra | O que é |
|---|---|---|
| `/clientes/[id]` | Painel | está sendo atendido agora? funil do mês, ficha do cliente |
| `/clientes/[id]/inbox` | Inbox | fila paginada, rail `Atribuído`, busca, conversa, resposta, painel do contato |
| `/clientes/[id]/leads` | Contatos | filtro por etiqueta, busca, seleção múltipla, ações em lote, criar à mão, CSV |
| `/clientes/[id]/leads/[contatoId]` | Contatos | ficha do contato |
| `/clientes/[id]/leads/importar` | Contatos | importação por planilha, com conciliação |
| `/clientes/[id]/fluxos` | Automações | fluxos (agrupados por pasta), **palavras-chave e campanhas** |
| `/clientes/[id]/fluxos/[fluxoId]` | — | **o editor**, tela cheia, sem a moldura |
| `/clientes/[id]/ajustes` | Configurações | índice, com o estado de cada peça |
| `/clientes/[id]/ajustes/horario` | Configurações | horário de atendimento |
| `/clientes/[id]/ajustes/equipe` | Configurações | quem entra na conta, papel, cadastrar pessoa |
| `/clientes/[id]/ajustes/etiquetas` | Configurações | etiquetas manuais da conta |
| `/clientes/[id]/ajustes/respostas-rapidas` | Configurações | respostas prontas do Inbox |
| `/clientes/[id]/contexto` | Configurações | contexto do negócio (o escopo da IA) |
| `/clientes/[id]/numero` | Configurações | números do WhatsApp e o fluxo de cada um dos **quatro papéis** |
| `/clientes/[id]/conexoes` | Configurações | credenciais dos blocos de API |
| `/clientes/[id]/acervo` | Configurações | arquivos que os fluxos enviam |

### Rotas de serviço

| Rota | Quem chama | Como se protege |
|---|---|---|
| `/api/webhook/whatsapp` | a Meta | assinatura `META_APP_SECRET` |
| `/api/manutencao/retencao` | cron da Vercel | `CRON_SECRET`, falha fechada sem ele |
| `/api/manutencao/tarefas` | cron da Vercel **e a carona no webhook** | `CRON_SECRET`, falha fechada sem ele |
| `/api/simular` | o editor | sessão + dono do `fluxoId` |
| `/api/clientes/[id]/inbox/alertas` | polling do painel | sessão + membro da conta |
| `/api/clientes/[id]/leads/csv` | botão de exportar | sessão + membro da conta |

---

## 3. O que cada frente da Etapa A entregou

### A1 — login, contas e papéis

- **Better Auth 1.7** em `src/server/auth.ts`, com os plugins `admin`
  (impersonação) e `organization` (contas e membros).
- **`clients` É a organização.** Não existe tabela `organization`: o plugin
  aponta para `clients` via `modelName`, porque toda chave estrangeira do
  sistema já aponta para lá.
- **`src/server/sessao.ts` é a fronteira de autorização.** Toda tela, rota de
  API e Server Action passa por `exigirUsuario`, `exigirAdminDaPlataforma`,
  `exigirAcessoAoCliente` ou `conferirAcessoAoCliente`.
- **"Entrar como"**: sessão de uma hora marcada com `impersonatedBy`,
  registrada na auditoria, com faixa âmbar em toda tela que ela alcança —
  inclusive o editor, que não usa moldura e a chama explicitamente.
- **Auditoria append-only** (`af_auditoria`): `service_role` só tem `insert` e
  `select`.

### A2 — sidebar e as duas visões

A moldura do cliente virou barra lateral; a área do administrador ganhou
`layout.tsx` próprio, onde `exigirAdminDaPlataforma()` roda uma vez e toda rota
abaixo herda a conferência.

**Os itens da barra são os que têm tela.** Campanhas e Integrações estão no
desenho da §2.1 do plano e são Etapa B: item de menu para tela que não existe é
promessa que a interface faz e o produto não cumpre.

### A3 — bloco de mensagem em pilha

O bloco era `data: { texto }` e virou uma pilha de até dez pedaços: **texto**
(com `*negrito*`, `_itálico_`, `~riscado~`, crases e emoji), **arquivo**,
**atraso**, **guardar** e **desligar o bot** (AutoOff).

**A regra que não pode ser quebrada: ler os dois formatos, escrever um só.**
`src/core/flow/mensagem.ts` é o único lugar que conhece o formato antigo. Ver
§4.3.

Ficou de fora a janela de 24h dentro do bloco (`Dentro de` / `Fora de`): ela só
faz sentido com modelo aprovado pela Meta, que é trava externa.

### A4 — a cadeia de atendimento

- **Horário de atendimento** por conta (`core/horario.ts`, puro e sem rede),
  com fuso IANA e mais de uma faixa por dia. Fora do expediente o handoff diz
  que está fechado e **quando volta**, em vez de prometer um atendente.
- **Assumir / liberar / passar** a conversa. A responsabilidade mora no
  **contato** (`contacts.atribuido_a`).
- **Presença** (`af_usuarios.presenca`), no rodapé da barra lateral.
- **Relógio da janela de 24h** na fila, só em quem espera uma pessoa.
- **O aviso de fila toca em qualquer tela do painel**, não só com o Inbox
  aberto.

### A5 — Inbox de verdade

Fila paginada de 50 (era tudo), rail `Atribuído` horizontal com contagem, busca
por nome e telefone, e anotação da equipe no painel lateral do contato.

---

### A6 — fluxos padrão e gatilhos

Um número deixou de executar **um** fluxo e passou a ter quatro papéis:

| Papel | Coluna | Quando roda |
|---|---|---|
| **Principal** | `channels.flow_id` (já existia) | conversa nova, quando nada mais casa. É a "resposta padrão" |
| **Boas-vindas** | `flow_boas_vindas_id` | a primeira conversa daquele contato **naquele número** |
| **Mídia recebida** | `flow_midia_id` | chegou áudio, foto, figurinha ou PDF |
| **Pós-atendimento** | `flow_pos_atendimento_id` | alguém da equipe clicou em "Já atendi" |

São três colunas e não quatro porque **"resposta padrão" é o que `flow_id`
sempre foi**. Coluna nova para o mesmo papel obrigaria a tela a explicar qual
das duas ganha.

E os **gatilhos por palavra-chave** (`gatilhos`, por conta): frase → fluxo, com
operador `É`/`Contém`, liga/desliga e contagem de execuções.

**A ordem de decisão da entrada é a regra do produto**, e mora em
`escolherAbertura` (`server/receber-mensagem.ts`):

1. **o escape global ganha de tudo** — `pediuAtendente()` é lido do motor antes
   de olhar gatilho nenhum. Um gatilho do cliente com a palavra "falar" não
   pode engolir "quero falar com uma pessoa";
2. **palavra-chave**, só em texto digitado (clique em botão nunca é sequestrado);
3. **fluxo de mídia**;
4. **boas-vindas**, só na primeira vez;
5. **o principal**, só quando não há conversa viva para continuar.

Gatilho e mídia **interrompem a conversa em andamento**. Parece agressivo e é
o que o escape global sempre fez — e o que a mídia substitui (handoff imediato)
interrompia mais ainda. A sessão anterior fica `encerrada`, nunca `ativa`.

Papel apontando para fluxo sem versão publicada **cai para o próximo
candidato** em vez de emudecer o número.

**`flow_midia_id` é o que aposenta a Regra B.** Sem ele configurado, mídia
continua indo para uma pessoa exatamente como antes.

Duas correções que a A6 tornou visíveis e entraram junto:
`prepararIa` lia o contrato de IA de `channels.flow_id` e agora lê do fluxo que
está rodando de verdade (`VersaoPublicada.fluxoId`); e `apagarFluxo` confere os
quatro papéis, não só o principal.

### A7 — configurações reunidas

**Etiquetas manuais** (`etiquetas` + `contato_etiquetas`, 0025). As derivadas
continuam derivadas e **não** viram linha: no instante em que virassem,
precisariam de sincronização, e a primeira resposta de um lead deixaria
`nao_respondeu` mentindo. Cor é lista fechada — hexadecimal livre é como se cria
uma etiqueta invisível.

**Equipe** (`/ajustes/equipe`) funcionando sem SMTP: a senha é definida por quem
cadastra e combinada por fora, como todo usuário nasce hoje. E-mail que já
existe **vincula** em vez de recusar. As três ações passam por
`podeAdministrarConta` — `exigirAcessoAoCliente` responde "pode ver", e deixar
um `member` cadastrar gente seria ele criar o próprio acesso de administrador.

### As duas peças que a `0023` tinha destravado

**Não lidas por pessoa**, com o piso na criação do usuário: sem esse piso a
primeira pessoa da equipe abriria o Inbox com meses de histórico em vermelho —
histórico que ela não deixou de ler, porque não estava lá. E a **prévia da fila**
parou de dizer "mídia ou mensagem sem texto" para foto, áudio, figurinha e PDF
igualmente.

---

## 3.1 A Etapa B, frente a frente

### B1 — o agendador (`tarefas`, 0026)

Até ele o produto era inteiramente reativo. `pegar_tarefas` usa
`for update skip locked`: duas invocações do cron que se sobrepõem — o que
acontece sozinho quando uma passada demora mais que o intervalo — leriam a mesma
fila, e a pessoa receberia a mesma mensagem duas vezes.

**A Vercel no plano Hobby dispara cron uma vez por dia.** Um prazo de trinta
minutos conferido de madrugada chega depois de a janela de 24h fechar — então o
agendador **pega carona no webhook** (teto de 5 por mensagem, depois da resposta
à Meta). A conta com prazo vencendo é, por construção, a conta que está
recebendo mensagem. O cron continua declarado como piso, para a conta que passou
o dia calada. Ver [PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md) sobre como dar
resolução de verdade a ele.

Primeiro consumidor: **prazo da pergunta** (`timeoutMinutos`, opcional no
schema — ausente é esperar para sempre, que é o comportamento de sempre). Sem
saída `timeout` desenhada, o prazo passa a conversa para uma pessoa. Quase todo
o executor é motivo para **não** fazer nada, e "ignorada" é resultado normal.

### B2 — contatos completo

Criar à mão (o telefone passa por `chavesDoTelefone`: `wa_id` é a identidade da
pessoa no WhatsApp, e gravar `(11) 98765-4321` ali criaria um cadastro que nunca
casa com a conversa que chegar), seleção múltipla, ações em lote e menu por
linha. O "marcar todos" pega **esta página** — a outra versão é o botão que
apaga cinco mil contatos achando que apagou cinquenta.

### B3 — painel completo (views da 0028)

**Mediana e média juntas, sempre.** Média de tempo de resposta é a métrica que
mais mente em atendimento: uma conversa esquecida no fim de semana empurra a
média do mês. O relógio conta do **handoff**, não da mensagem da pessoa. Quem
entrou na fila e ninguém respondeu fica **fora** da conta e aparece como aviso.
O gráfico é SVG à mão, com eixo começando em zero e dia vazio valendo zero.

### B4 — campanhas (`campanhas`, 0027)

Frase de anúncio → fluxo. **Decide antes do gatilho**, porque casa com a
mensagem inteira e é a porta que o cliente está pagando para manter aberta.
A normalização de pontuação final é nossa, e não um pedido ao anunciante.
Atribuição de **primeiro toque**: nunca sobrescreve.

### B5 — pastas e modelos (`pastas`, 0029) · **com recorte**

Pastas com `on delete set null`, nunca `cascade`. Modelos são dado em código
(`src/exemplos/modelos.ts`), e todos nascem válidos.

**Compartilhar fluxo por link ficou de fora**, de propósito: é rota pública nova
com token e escopo, uma superfície de segurança que não cabe junto de uma coluna
de organização. É a única coisa da Etapa B que não está no ar.

### B6 — integrações por preset

RD Station primeiro, depois Google Sheets e webhook. **Preset, não tipo de nó
novo**: ele preenche um bloco `http` comum e sai do caminho, e o que fica gravado
é o bloco resolvido. Referência viva mudaria por baixo o que uma conversa em
andamento chama no dia em que a RD trocasse de endereço.

---

## 4. As sete regras que não se negociam

### 4.1 O banco é compartilhado com outro produto

AutoFluxos vive em `public`; a **Verandi** vive em `app_verandi`, no **mesmo
projeto Supabase**. `auth.users`, Storage, extensões, Data API, cotas e backup
são **globais**. Leia [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) inteiro
antes de qualquer migration. **Nunca** rode `supabase db push` ou `db reset`.

**Nada é aplicado em produção sem autorização explícita do dono**, uma
migration por vez, pela Management API:

```bash
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
Q=$(python3 -c "import json;print(json.dumps({'query':open('supabase/migrations/00XX_nome.sql').read()}))")
curl -s -X POST "https://api.supabase.com/v1/projects/$AUTOFLUXOS_SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d "$Q"
```

Depois de aplicar, **confira as duas coisas**: que as colunas existem, e que
`app_verandi` continua com o mesmo número de tabelas.

### 4.2 A view `leads` só aceita coluna nova **no fim**

`create or replace view` não reordena nem remove: recusa qualquer outra
diferença com `cannot change name of view column`. A ordem verdadeira é a da
última migration que mexeu nela — hoje a `0023`, que acrescentou `ultimo_tipo`
no fim. A `0024` não tocou na view.

### 4.3 Versão publicada é imutável, inclusive para nós

`flow_versions` guarda o grafo e a sessão fica presa à versão em que começou.
Uma conversa aberta às 14h continua rodando o grafo de 14h. Se um schema deixar
de dar parse no que foi publicado antes, **toda conversa em andamento morre no
meio**, e não há como saber quantas são.

O caminho é sempre **ler os dois formatos e normalizar na leitura**. Nenhuma
migration reescreve `flow_versions.grafo`. Três testes prendem isso hoje:
`core/flow/mensagem.test.ts`, o `describe('o bloco de mensagem em pilha')` em
`core/engine/executar.test.ts`, e o teste do webhook que publica a abertura no
formato antigo.

### 4.4 Quem autoriza é `server/sessao.ts`, não o `proxy.ts`

O proxy decide se a requisição **segue**; a conferência do login por usuário lá
é só de **presença do cookie** — não vai ao banco e não decide nada sozinha.

Não é preguiça: a documentação do Next avisa que Server Action é um POST na
rota onde ela é usada, e um refactor que a mova de rota a tira do matcher sem
ninguém perceber. **`src/server/acoes.test.ts` lê o texto de `acoes.ts` e
recusa ação nova que esqueça a conferência.** Trinta e sete ações — trinta e
cinco com `clienteId`, que chamam `exigirAcessoAoCliente`, e duas que criam
cliente, que chamam `exigirOperadorDa4YU` — é exatamente onde a trigésima
oitava fica de fora.

### 4.5 A sessão de usuário tem precedência sobre a senha única

Quem entra como pessoa vê o que aquela pessoa vê. O administrador da 4YU
continua alcançando qualquer conta **enquanto a senha única existir** — é a
linha em `exigirAcessoAoCliente` que estreita para "só impersonando" no dia em
que ela sair. Quem não pode recebe **404**, e não 403.

### 4.6 `auth.ts` exporta função, não constante

`autenticacao()` constrói a instância na primeira chamada. Voltar a
`export const auth = betterAuth(...)` **derruba o CI**: o pool estoura sem
`DATABASE_URL`, e o `npm run build` do CI roda sem variável de banco nenhuma, de
propósito — este repositório é público e não guarda segredo. O mesmo vale para a
rota `[...all]`, que chama `autenticacao()` dentro de cada método em vez de usar
`toNextJsHandler`.

E `nextCookies()` tem que ser o **último** plugin: sem ele, `signInEmail` numa
Server Action autentica e não deixa sessão no navegador.

### 4.7 A auditoria não pode ser editada pela aplicação

`service_role` tem só `insert` e `select` em `af_auditoria`. Não escreva função
de apagar; não existe permissão.

---

## 5. O banco, tabela a tabela

| Tabela | O que é |
|---|---|
| `clients` | a conta. Ganhou `slug` (único, com gatilho), `metadata` e `horario_atendimento` |
| `flows`, `flow_versions` | o desenho e as versões publicadas (imutáveis por gatilho) |
| `channels` | número do WhatsApp × fluxo. Ganhou os três papéis novos da 0024 |
| `contacts` | quem conversa. Ganhou `atribuido_a` |
| `sessions`, `messages`, `handoffs` | o estado de execução e o histórico |
| `connections` | credenciais dos blocos de API |
| `af_usuarios` | usuários (Better Auth), com `presenca`. **Não** é `auth.users` |
| `af_sessoes` | sessões, com `impersonatedBy` e `activeOrganizationId` |
| `af_contas` | credenciais — guarda **hash** de senha |
| `af_verificacoes` | tokens de verificação |
| `af_membros` | usuário × conta × papel (`owner`/`admin`/`member`) |
| `af_convites` | a tabela existe; o convite não, porque depende de SMTP |
| `gatilhos` | frase → fluxo, por conta, com operador e contagem de disparos |
| `campanhas` | frase de anúncio → fluxo. `contacts.campanha_id` é o primeiro toque |
| `tarefas` | a fila do agendador. `pegar_tarefas` pega a vez com `skip locked` |
| `etiquetas`, `contato_etiquetas` | as manuais. As derivadas continuam derivadas |
| `pastas` | gavetas de fluxo. `flows.pasta_id`, `on delete set null` |
| `af_leituras` | quando cada pessoa abriu cada conversa. É a insígnia de não lidas do Inbox |
| `af_auditoria` | quem fez o quê. Append-only |
| view `leads` | contato + última mensagem + handoff aberto + `ultima_entrada_em` + `atribuido_a` + `ultimo_tipo` |
| view `metricas_sessoes`, `resumo_clientes` | agregações do painel |
| view `metricas_de_tempo`, `metricas_diarias`, `metricas_por_pessoa` | o painel completo (0028) |

**As tabelas do login ficam fora da Data API de propósito** (`revoke all` para
`anon` e `authenticated` na 0019): `af_contas` guarda hash de senha e
`af_sessoes` guarda token. Por isso `src/server/repos/usuarios.ts` e
`src/server/sessao.ts` falam Postgres direto pelo pool do Better Auth
(`bancoDoLogin()`), e são a exceção da casa — todo o resto usa `supabase-js`.

---

## 6. Ambiente

| Variável | `.env` | Vercel | Observação |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | ✅ | ✅ | |
| `META_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | ✅ | ✅ | |
| `GEMINI_API_KEY` | ✅ | ✅ | entrou em 17/ago — antes disso o bloco de IA nunca funcionou em produção |
| `PAINEL_SENHA` | ✅ | ✅ | senha única. **Sem ela em produção, o login por usuário vira a única porta** |
| `PAINEL_SEGREDO` | ✅ | ✅ | trocar encerra todas as sessões do painel |
| `CRON_SECRET` | ✅ | ✅ | sem ela a retenção responde 503 |
| `DATABASE_URL` | ✅ | ✅ | pooler **6543**, não 5432 |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | |
| `BETTER_AUTH_URL` | ❌ | ❌ | opcional; preenchida errado quebra o login |
| `ALERTA_WEBHOOK_URL` | ❌ | ❌ | **falta**. Sem ela `alertar()` é no-op |

Valores em `4yu-apps/.secrets/4yu.env`, prefixo `AUTOFLUXOS_`. **Nunca** copie
segredo para dentro do repo — ele é público.

Conexão direta: `postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`.
Porta **6543** (transaction pooler). Em modo transação o Supavisor **não
suporta prepared statements**.

---

## 7. O que falta, em ordem

### 7.1 O que ficou de fora da Etapa B, e por quê

**Compartilhar fluxo por link** (parte da B5). Rota pública nova, com token,
escopo e expiração — uma superfície de segurança que não cabe junto de uma
coluna de organização. É a única peça da Etapa B que não está no ar.

**Sequências** (disparo no tempo depois de um evento). O agendador que elas
esperavam existe e funciona; falta o desenho de produto — o que dispara, quantos
passos, e como alguém sai no meio. É a próxima peça óbvia a construir em cima da
B1, e ela não precisa de migration nova: `tarefas.tipo` é texto justamente por
isso.

### 7.2 A Etapa C

**Quadros (Kanban)**, central de notificações, casca (idioma, ajuda),
**modelos da Meta e Transmissão** (trava externa — depende de verificação da
empresa e App Review, não de código nosso), faturamento e registros.

Ordem e critério em [PLANO-SISTEMA.md §5](PLANO-SISTEMA.md). Duas coisas dessa
lista já têm base pronta: Transmissão só depende do agendador (feito) mais os
modelos da Meta; a central de notificações reaproveita o alerta de fila que já
toca em qualquer tela do painel.

### 7.3 Dívidas conhecidas

- **A tabela do §4 do PLANO-SISTEMA divergiu do disco** a partir da `0024`, e o
  disco ganha. A ordem real foi A6 → A7 → B2 → B1 → B4 → B3 → B5/B6.
- **A numeração vai cruzar com a da Verandi** (`0030_vr_`). O prefixo distingue
  e nenhum repositório aplica a migration do outro; se incomodar, o caminho é
  prefixo próprio — nunca renumerar o que já foi aplicado.
- **O agendador depende da carona no webhook** para ter resolução. Conta parada
  o dia inteiro só é varrida uma vez por dia.

### 7.4 O que espera o dono

Os itens em [PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md). Os três que mais
travam:

1. **Criar o primeiro administrador.** Não existe **nenhum** usuário em
   produção; todo o login está de pé e dormindo — e agora a tela de Equipe, o
   contador de não lidas e o desempenho por pessoa dependem de existir gente.
2. **`ALERTA_WEBHOOK_URL`**, sem a qual falha de entrega não avisa ninguém.
3. **Provar a mídia no WhatsApp de verdade** — nenhuma foto saiu pela Cloud API
   até hoje, e agora o bloco de arquivo sobe direto para o Storage.

---

## 8. Como trabalhar aqui

### O ciclo

```bash
npm test          # 583 passando, 8 pulados
npm run typecheck
npm run lint
npm run build     # roda também sem DATABASE_URL, e tem que continuar rodando
```

Commit por etapa validada, push, e a Vercel faz o deploy sozinha do `main`.
Conferir o deploy pela API (`VERCEL_TOKEN` no cofre) e **provar em produção**,
não só no build.

### Testes

Boa parte da suíte fala com o **Supabase de produção**. Eles limpam o que
criam com prefixo `zz-`; execução que quebra no meio deixa lixo. `af_auditoria`
é a exceção — append-only, então `auditoria.test.ts` deixa linhas de
`gente@exemplo.test` lá para sempre, e `/admin/auditoria` já nasce com elas.

**Cerca de 1 execução em 8 falha um teste, sem padrão identificado.** Não é o
teto de 5s (subiu para 30s), não é colisão de telefone (o sorteio é por
execução), e os testes de retenção passam `clienteId`. Rodar de novo passa.
Está escrito para não virar de novo "roda de novo que passa" sem ninguém olhar.

### Armadilhas que já custaram caro

- **Interpolar dentro de estrutura sem escapar.** O que a pessoa digita no
  WhatsApp entra em URL, corpo JSON e cabeçalho. Use `core/engine/interpolar.ts`.
- **Exceção solta no `after()` do webhook.** A mensagem já foi deduplicada; se
  a sessão não for salva, a pessoa fica sem resposta e a Meta não reenvia.
- **Identidade vinda do corpo da requisição.** Desenho pode vir de fora;
  identidade sai do banco. Foi o furo do `/api/simular`, corrigido.
- **Tela de autorização que o Next prerenderiza.** `/admin/page.tsx` só
  redireciona, e sem `force-dynamic` o Next resolvia no build: a moldura rodava
  sem sessão, e o que ficava gravado era um redirecionamento para a raiz.
- **Altura calculada em `calc(100vh - N)`.** Erra em silêncio quando o
  cabeçalho muda: a lista some por baixo e nada quebra para avisar. Use flex.
- **Estado vazio que responde pela pergunta errada.** "Nenhuma conversa" depois
  de uma busca sem resultado mente e ainda some com o campo de busca.
- **Duas funções que discordam sobre a mesma regra.** `proximaAbertura`
  anunciava faixa que `atendimentoAberto` nunca honraria.
- **Duas coisas com o mesmo sintoma escondem uma à outra.** "Falha que some ao
  rodar de novo" foi atribuída ao relógio do WSL2 por semanas — era o teto de
  5s do Vitest **e** telefone de teste derivado de `Date.now()`.

### O `.npmrc` com `legacy-peer-deps` é obrigatório

`better-auth` declara `@sveltejs/kit` como peer opcional e o npm arrasta a
cadeia do Svelte, que exige `vite@8` contra o `vite@7` do Vitest. Sem o
`.npmrc`, **o build quebra no deploy**.

### O CLI do Better Auth mente

`@better-auth/cli` é publicado à parte e fica para trás do runtime. Use
`node scripts/schema-do-auth.mjs`, que lê o runtime instalado.

---

## 9. O que o dono decidiu, e que não se renegocia sem ele

1. **A conta é do cliente e ele faz tudo nela** — cria, edita, publica, apaga.
   Nós somos administradores de contas, não donos dos fluxos.
2. **Sidebar à esquerda, não abas no topo.** Foi explícito e enfático.
3. **Etapa A só com o obrigatório.** Cada tela nova é superfície, e superfície
   custa manutenção para sempre. Vale para item de menu também: a barra só
   lista o que tem tela.
4. **Nada de conectar número por QR.** Perder o número do cliente é o pior
   fracasso possível para uma agência. Só Cloud API oficial.
5. **Nada de iPaaS embutido.** Integração é preset de bloco `http`, com
   RD Station primeiro.
6. **Mandar o cliente usar n8n/Zapier/Make não é resposta aceitável.** Faltou
   peça? Constrói a peça.
7. **Não temos dado de dinheiro.** Inventar por multiplicação vira mentira no
   relatório do cliente; o caminho honesto é ler valor fechado do CRM na
   Etapa B.
