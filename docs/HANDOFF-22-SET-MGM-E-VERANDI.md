# Handoff: o que falta da conversa de 22/09, na MGM e na Verandi

Escrito para: o agente que vai continuar este trabalho numa sessão nova.

A rodada anterior fechou tudo que era código de template e de produto neste
repositório (11 commits, de `880be96` a `9a48edc`, todos em `main`). **O que
sobrou não se resolve aqui**: metade vive no banco de produção da MGM, metade no
repositório da Verandi. Este documento diz onde cada coisa está e o que já foi
decidido sobre ela.

Fonte de tudo: a conversa de WhatsApp de 22/09 entre Gabriel e Edu, relida
direto do banco. O detalhamento por item está em `docs/PENDENCIAS-22-09.md`, que
é o documento irmão deste — leia-o antes de começar.

## Antes de tocar em qualquer coisa

- `git fetch` e confira se `main` andou. Há outras sessões neste repo.
- Leia `AGENTS.md` e `docs/BANCO-COMPARTILHADO.md`. AutoFluxos e Verandi dividem
  **o mesmo projeto Supabase de produção**: AutoFluxos em `public`, Verandi em
  `app_verandi`. Nunca crie ou altere objeto da Verandi a partir deste repo.
- **Nada em produção sem autorização explícita do Gabriel.** Vale para cada
  publicação de fluxo da MGM descrita abaixo, uma a uma.
- Quem é quem na conversa: `554498775978` é o **Edu** (chega como `entrada`),
  `5511911001414` é o **Gabriel** (sai como `saida`). O contato se chama
  "Gabriel Felix" por ser a agenda de quem cadastrou, não por ser quem escreve
  dali. A primeira versão do doc de pendências inverteu isso e atribuiu decisões
  ao autor errado.

## Como consultar o banco daqui

Não há `psql` nem `psycopg`, e o MCP do Supabase não está autorizado. O caminho
que funciona é Node com `pg`, rodando **de dentro do repositório** (senão não
acha `node_modules`):

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
cat > .q.mjs <<'EOF'
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
// ... sua consulta
await c.end()
EOF
set -a && . .env && set +a && node .q.mjs
rm -f .q.mjs
```

As colunas são em **português** (`clients.nome`, não `name`). Apague o `.q.mjs`
ao terminar: ele fica na raiz do repo.

## O estado da MGM em produção

Conta `5de5a891-790f-4c14-b60b-ce0a573fe1c7` ("MGM Pilates"). Canal
`b68ad353-…`, cloud-api, cujo fluxo principal é o **Atendimento**.

| Fluxo | `flow_id` | Estado |
|---|---|---|
| Fluxo - Atendimento | `ae9f663f-933d-4953-bbb9-aefed2360b57` | ativo, publicado |
| Fluxo - Agendamento | `7d05c074-b07f-4d06-855b-ba7430412138` | ativo, publicado |
| Fluxo - Reagendamento | `45a9db71-d702-4f4f-8510-d0687145fb0e` | ativo, publicado |
| Fluxo - Não Comparecimento | `969a8fa0-7071-40d5-b70d-fc74e6d728f0` | ativo, publicado |
| Atendente de IA | `b8af92c1-90e7-4bcf-a5f1-d5229d00befb` | **desligado** |

**Os fluxos da MGM são cópias, não referências aos templates.** Corrigir
`src/exemplos/` não muda nada lá — foi por isso que a rodada anterior parou
aqui. Para editar, publique versão nova pela RPC; a memória do projeto registra
que o vitest unitário bloqueia rede, então o caminho é o mesmo já usado antes
neste repo para os fluxos do MGM.

### Os defeitos já corrigidos no template, ainda vivos na MGM

Levantados por varredura no grafo publicado de cada fluxo:

- **`aula(s)`** — em **Reagendamento e Atendimento**. Atenção: são dois fluxos,
  e o doc anterior só apontava um. A correção do template (`1391718`) não é
  trocar a palavra: a frase afirmava a contagem **antes** de saber qual era, e
  quem tinha zero reposições lia *"você tem 0 aula(s) para repor:"* com lista
  vazia. Mova a contagem para os ramos, onde o número já é certo.
- **`reposição(ões)`** — no Reagendamento, no motivo do handoff. Ali o número é
  mesmo variável; no template virou "em aberto".
- **Telefone cru na frase** — no **Agendamento**. O template ganhou
  `{{telefone_br}}` (`6616560`), derivado em `varsIniciais`. **Confirme que a
  variável existe em produção antes de usá-la no grafo da MGM**: ela foi criada
  nesta rodada e a MGM só a terá depois do deploy.
- **Pede data digitada** — nenhum fluxo da MGM caiu nesta varredura, mas o Edu
  relatou o problema ao vivo (*"ele fala dia 14 e n tem"*). Confira o
  Reagendamento manualmente; a busca procurou a frase exata do template.

O menu com botão único (`065a77d`) e o rótulo que perdia o nome da aula
(`{data}` cru) **não** foram procurados na MGM. Verifique: o segundo afeta
qualquer menu de dia ou aula montado sobre lista.

### O conteúdo do fluxo, que é decisão de produto e não defeito

- **Aula experimental x outras terapias** — está no **Atendimento** (é o fluxo
  que lista RPG, Drenagem, Miofascial e emenda a oferta de experimental).
  Decisão do Gabriel às 15:24: *"oferece só pilates aula experimental e se a
  pessoa seleciona os outros transfere"*.
- **"Troquei de número" só existe no Agendamento** — confirmado pela varredura:
  só esse fluxo tem a confirmação de telefone. Se o bot reconhece a pessoa pelo
  número, todo caminho que dependa da identidade precisa dessa saída.
- **Agendamento de liberação e outras modalidades** — hoje não sai pelo zap
  porque o Daniel pediu. O Edu discorda e ia falar com ele (*"nesses casos, o
  certo é redirecionar pra um atendente"*). **Não mude isso sem confirmar se
  essa conversa aconteceu**: é regra de negócio do cliente, não nossa.
- **Fluxo de não comparecimento** — existe na MGM e existe como modelo nos dois
  repos; a memória do projeto diz que falta ligá-lo na triagem.

### O que já está pronto no repo e pode ir para a MGM

Dois modelos novos saíram nesta rodada e ainda não existem na MGM:

- **Reagendamento sem data livre** (`7b8f0c9`): faixa (esta semana / a que vem /
  mais pra frente) e menu só com os dias que têm vaga. É a correção que o Edu
  pediu às 13:15.
- **Aluno inativo / de licença** (`63cc24f`), em `src/exemplos/aluno-inativo.ts`:
  voltar às aulas, falar do contrato, cancelar, outro assunto. Todas terminam
  numa pessoa, com o motivo escrito.

Os dois são **templates**. Levá-los à MGM é criar fluxo novo na conta dela, e é
publicação em produção: peça autorização.

## A Verandi

Repositório `/home/gabfelix/dev/4yu-apps/verandi` (último commit `e4dfad1`).
Schema `app_verandi`. **A Verandi fala por API, nunca pelo banco** — é regra
registrada na memória do projeto.

Dois itens, os dois de interface, os dois levantados pelo Edu usando o produto:

- **Modalidade não aparece na ficha do aluno.** Levantado às 10:18 com print.
  Onde deve ficar, palavras do Gabriel às 10:39: *"modalidade tem q ser ali do
  lado do ID, na ficha mesmo"*. A ficha é
  `src/app/(app)/pessoas/[id]/`; os componentes dela estão em
  `src/components/pessoas/`. A modalidade vem do contrato
  (`src/server/contratos/consultas.ts`) — confirme de onde puxar antes de
  desenhar a tela.
- **"Atender pedido de exclusão" está escondido.** Está em
  `src/components/pessoas/acoes-da-ficha.tsx:90`, num link cinza no rodapé do
  painel direito. O Edu levou três mensagens para achar (*"não tem opção de
  excluir aluno / pera / escondido / achei"*). Ação de LGPD não pode ser caça ao
  tesouro. O fluxo de confirmação já existe e é bom (exige digitar o nome, linha
  130) — o problema é só achar o botão.

## O que está em aberto e **não** deve ser implementado sem decisão

- **Cancelamento de contrato pelo bot.** O doc antigo registrava "sempre com
  humano, possivelmente presencial" como decidido. Não foi: o Edu levantou o
  risco às 15:35 e o Gabriel respondeu *"hmmm ta blzz, pode ser um problema"*. O
  fluxo de aluno inativo que criei **não promete** que é presencial, de
  propósito — diz só que cancelamento é com uma pessoa. Não acrescente a
  promessa sem decisão.
- **Preço para fluxo grande.** Conversa das 14:54 terminou sem fechar. A
  manutenção da MGM é R$800/mês.

## Fora de escopo

O **Oderço** saiu do escopo por decisão do Gabriel. Ignore o item no doc de
pendências.

## Duas coisas de ambiente

- **`qrcode` está no `package.json` e não instalado.** Um arquivo de teste
  (`src/components/editor/dados-padrao.test.ts`) falha só por isso, e falha
  igual sem nenhuma mudança no código. `npm install` resolve. Não persiga esse
  erro.
- **`npx tsc --noEmit` acusa três erros pré-existentes**: dois de tipos gerados
  de rota do Next e um do `qrcode`. Nenhum é regressão.

## Como a rodada anterior trabalhou, e por que vale repetir

Três defeitos foram achados **rodando a conversa**, não lendo o grafo: o rótulo
de menu que perdia o nome da aula, o `+55` inventado em oito telas de contato, e
um helper de teste que afirmava valores que produção nunca produziu. Os testes
que existiam olhavam arestas e passavam em todos eles.

Ao mexer num fluxo da MGM, monte a conversa de ponta a ponta e leia **o que a
pessoa recebe**. `src/exemplos/reagendamento.test.ts`,
`lembrete.test.ts` e `aluno-inativo.test.ts` são os modelos desse jeito de
testar, e o helper deles replica `resolverHttp` inteiro: extrair **e** formatar,
nessa ordem. Pular a formatação foi exatamente o erro que escondeu um defeito
por meses.
