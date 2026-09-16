# Handoff, noite de 16/set: o Inbox ganhou os quatro gestos, e o lead ganhou dono

Continua de `619e8b5`. Fecha o item 6 inteiro de
`docs/HANDOFF-16-SET-PENDENCIAS.md` e o Trabalho 2 de
`docs/HANDOFF-16-SET-TRANSMISSOES-E-DISTRIBUICAO.md`.

O dono pediu para fazer tudo o que não dependesse dele, deixando a prova contra
a Meta para depois. Foi o que aconteceu.

---

## Comece por aqui

Se você está abrindo este repositório agora, leia nesta ordem e pare quando
souber o bastante para a tarefa que recebeu:

1. **`AGENTS.md`** na raiz. É curto e tem a regra que mais custa quebrar: o
   Supabase de produção é dividido com outro produto (Verandi), e `supabase db
   push` e `db reset` são proibidos contra ele.
2. **`docs/BANCO-COMPARTILHADO.md`**, inteiro, antes de qualquer coisa que toque
   banco, migration, Auth, RLS, Storage ou Data API. Não é aviso genérico: cada
   regra ali custou tempo de alguém.
3. **Este arquivo**, para saber onde o trabalho parou.
4. **`docs/PLANO-DISTRIBUICAO.md`** se a tarefa encostar em atribuição de
   conversa, e **`docs/HANDOFF-16-SET-TRANSMISSOES-E-DISTRIBUICAO.md`** se
   encostar em modelo aprovado ou transmissão. O segundo continua valendo inteiro
   na parte da Meta.

**A numeração da próxima migration sai do disco, nunca de documento**, inclusive
deste. Rode `ls supabase/migrations/ | tail -1`. Este parágrafo já esteve errado
três vezes em outros arquivos, sempre porque alguém confiou no número escrito.

Comandos que este repositório usa:

```bash
npx vitest run src/core src/channels    # os puros, sem banco, rápidos
npx tsc --noEmit | grep -v "^\.next/"
npx next build
ls supabase/migrations/ | tail -1       # a próxima migration
```

A suíte inteira demora e alguns testes de `src/server/repos/*` estouram por
timeout quando duas sessões falam com o Supabase ao mesmo tempo. Isso é
concorrência, não regressão: valide com `tsc` e `build`, e rode os testes por
pasta.

**Não aplique migration em produção sem autorização explícita do dono.** Quando
ela vier, o caminho é a Management API com o ref literal `xxxynoshwirupkdzwxbj`,
sempre com ensaio em transação antes (`begin; ...; rollback;`) e conferência
objeto a objeto depois. As duas últimas migrations estão documentadas assim em
`docs/BANCO-COMPARTILHADO.md` e servem de modelo.

**Travessão é proibido** em texto de tela, comentário e nome de teste. Cada
arquivo que você abrir deve sair sem, inclusive os travessões que já estavam lá.

---

## O que entrou

| Commit | O quê |
|---|---|
| `7d75ffb` | fixar conversa, marcar como não lida, marcar todas as à vista como lidas |
| `1591909` | favoritar mensagem, a tela do acervo, e os travessões fora de onze arquivos |
| `7e58bea` | distribuição de leads: carteira, balanceado, e a trava de "só quem assumiu responde" |

Duas migrations aplicadas em produção, as duas com autorização explícita do dono
e conferidas antes pelo ensaio em transação:

- **`0063`**, `af_fixadas` e `af_favoritas`. Aditiva, duas tabelas novas.
- **`0064`**, `af_atendentes` mais `clients.distribuicao` e
  `clients.exige_assumir`. A primeira da sequência a encostar em tabela com dado,
  e as nove contas de produção acordaram no padrão de antes.

O detalhe de cada uma está em `docs/BANCO-COMPARTILHADO.md`, inclusive o que o
ensaio provou e o que ele não cobre.

---

## O que ficou faltando, em ordem de importância

### 1. Nada disto foi clicado no navegador

**É a mesma pendência que o handoff anterior já registrava, e ela cresceu.**
Build, lint, tipos e 1185 testes passam, e nenhum deles é sobre o que a pessoa
vê. As afirmações abaixo são as que ninguém conferiu:

- o alfinete e o envelope aparecem no hover da linha e somem fora dele;
- o horário dá lugar aos dois botões sem o nome espremer;
- o bloco fixado fica no topo e não se reordena quando chega mensagem;
- a estrela pinta cheia ao clicar e continua cheia depois do recarregamento;
- com a trava ligada, a caixa de resposta some e o aviso ocupa o lugar dela.

O caminho mais curto para conferir tudo: abrir o Inbox, fixar duas conversas,
marcar uma como não lida, guardar uma mensagem, e abrir
`/clientes/<id>/favoritas`.

### 2. A distribuição nunca distribuiu nada de verdade

O gancho está ligado nos três pontos onde o handoff é registrado, e os testes de
`receber-mensagem` passam com ele no caminho. **Mas nenhuma conta de produção
está em `balanceado`**, então o código nunca escolheu ninguém fora de teste.

Para provar, em ordem: ligar o balanceado numa conta com duas pessoas, forçar um
handoff (o bloco "transferir para humano" de qualquer fluxo serve), e conferir
que a conversa apareceu com dono. Depois marcar uma das pessoas como ausente e
repetir, para ver a escolha mudar.

### 3. A prova contra a Meta continua inteira

Item `1c` do handoff de transmissões, sem uma linha mexida. Nada do caminho de
modelo ou de transmissão falou com um número real. A ordem continua a mesma, e
o primeiro passo continua sendo **criar um modelo da biblioteca que tenha
botão**.

### 4. Arquivar conversa: decidido que não entra

O handoff anterior deixou em aberto ("talvez, precisamos pensar") e mandava
decidir antes de escrever qualquer coisa. Fica decidido: **não entra.**

`estado` já tem `resolvida` (a 0049), e "arquivada" seria um segundo nome para a
mesma ideia, com a diferença de que ninguém saberia dizer qual usar. Dois
conceitos para a mesma coisa é o tipo de dívida que não se separa depois, e o
gesto que o dono descreveu (tirar da frente sem apagar) já existe inteiro em
resolver.

Se voltar a fazer falta, o pedido real provavelmente é outro: um filtro que
esconde resolvidas antigas da fila, e isso é tela, não estado novo.

### 5. Visibilidade restrita ficou de fora, com motivo

O handoff de 15/set desenhou três níveis (restrita, equipe, geral), copiando o
RD. Não entraram, e a razão está no `docs/PLANO-DISTRIBUICAO.md`: o produto não
tem conceito de equipe dentro da conta, então dos três sobrariam dois, e a
queixa original (dois vendedores respondendo o mesmo cliente) se resolve pela
trava sem esconder histórico de ninguém. Esconder é a parte que muda consulta em
quase toda tela do Inbox e a que menos resolve.

---

## Coisas que vão economizar tempo de quem continuar

- **Travessão saiu de onze arquivos**, incluindo os que já o tinham antes deste
  trabalho. O script que fez isso está descrito no commit `1591909`; o resto do
  repositório ainda tem, e cada arquivo aberto deve sair sem.
- **`af_fixadas` e `af_favoritas` não guardam cliente.** O corte por conta
  acontece em TypeScript, por ausência: contato que não voltou da consulta do
  cliente atual não entra. Quem for escrever leitura nova nessas tabelas precisa
  repetir esse corte, ou a lista de uma conta aparece dentro de outra.
- **Marcar como não lida não apaga a linha de leitura.** Ela recua um
  milissegundo antes da última entrada. Apagar devolveria todas as entradas
  desde a criação do usuário, e uma conversa de três meses voltaria com insígnia
  em 87. Ver o comentário em `repos/leituras.ts`.
- **O Docker continua indisponível nesta máquina** (integração do WSL
  desligada). As duas migrations eram aditivas e o ensaio em transação bastou. A
  próxima que não for aditiva precisa do Docker de volta antes de tocar em
  produção.
- **O deploy não foi feito.** O código está na `main` e as migrations estão em
  produção, que é a ordem segura: coluna nova sem código que a use não muda
  nada. Publicar é
  `npx vercel --prod --token "$VERCEL_TOKEN" --yes`, com o `.env` do
  `4yu-apps/.secrets/` carregado. Vale conferir no navegador antes, pelo item 1.
