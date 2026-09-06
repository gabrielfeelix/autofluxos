# Handoff — 06/set/2026, as seis rodadas fechadas

Para quem pegar daqui, humano ou agente. Este documento fecha a série que começou
em [HANDOFF-06-SET.md](HANDOFF-06-SET.md) e continuou em
[HANDOFF-06-SET-NOITE.md](HANDOFF-06-SET-NOITE.md). **Os dois continuam valendo**
— principalmente o §4 do primeiro, que é o que não fazer enquanto a Meta analisa.

---

## 1. Comece por aqui, nesta ordem

1. **`git fetch` antes de qualquer coisa.** A regra vale mesmo hoje, que não
   havia sessão paralela: o custo de conferir é um comando, o de não conferir é
   um dia de trabalho em cima de um `main` velho.
2. Este documento.
3. [SEGURANCA.md](SEGURANCA.md) — a auditoria, e principalmente o **backlog do
   fim**, que é a lista mais honesta do que falta neste produto.
4. [HANDOFF-06-SET.md §4](HANDOFF-06-SET.md) — as travas da Meta.
5. Só então código.

---

## 2. O que ficou pronto nesta sessão

| Commit | O quê | Migration |
|---|---|---|
| `6631255` | O painel direito para de falar em código — rodada 4 | — |
| `fae777a` | O aviso de handoff alcança quem fechou o painel — rodada 5 | `0045` **aplicada** |
| `64d8f03` | Auditoria OWASP escrita — rodada 6 | — |
| `178bffb` | O service worker do push precisa abrir sem sessão | — |

**As seis rodadas do [PLANO-IMPLEMENTACAO-SET.md](PLANO-IMPLEMENTACAO-SET.md)
estão fechadas.** Suíte em **1282 passando**, 14 puladas. Typecheck e build
verdes.

### 2.1 A migration `0045`

`assinaturas_de_push` — para onde mandar o aviso de handoff. Aplicada em
produção e conferida **no banco**: RLS ligada, **zero** grant para
`anon`/`authenticated`, os dois índices no lugar, e as 42 tabelas da Verandi
intactas.

Docker não roda nesta máquina, então o replay local está fechado. O que
substituiu: **ensaio numa transação com `rollback`** antes do commit de verdade
— roda o SQL inteiro contra a produção, confere colunas, grants e RLS, e desfaz.
Prova que a migration roda e o estado final é o pretendido, sem risco. Vale
repetir na próxima.

A próxima é a **`0046`** — mas confira pelo diretório, sempre.

### 2.2 Chaves novas

VAPID (push do navegador) em `.secrets/4yu.env` e na Vercel:
`AUTOFLUXOS_VAPID_PUBLIC_KEY`, `AUTOFLUXOS_VAPID_PRIVATE_KEY`,
`AUTOFLUXOS_VAPID_SUBJECT`. Na Vercel entram sem o prefixo do app e a privada
está como `encrypted`. **Nenhum valor no repositório** — `.env.local` é
ignorado pelo git, e foi conferido.

---

## 3. O que aprendi que os planos diziam errado

A lição se repetiu pela quarta sessão seguida. **Documento não é fonte de
verdade sobre o código.**

1. **"O Better Auth já tem SMTP configurado; reusar."** Não tem. `auth.ts:89`
   desliga a verificação por e-mail **porque** exigiria SMTP, que é global ao
   projeto compartilhado com a Verandi. Foi o que fez a rodada 5 sair pela
   metade — e a metade que saiu é a que não dependia de ninguém.
2. **"Guardar o rótulo junto do campo."** Não fecha: quatro das origens de
   `salvar_campo` não nascem de pergunta com texto (resposta de `http`, legenda
   de mídia, `salvarPadraoEm`, `salvarValorEm`). Formatar a chave responde a
   todas.
3. **"Passada de Playwright."** Não há Playwright nem testing-library neste
   repositório. A prova saiu como função pura testável.
4. **Os papéis do Better Auth são em inglês.** `owner`, `admin`, `member` — e
   os quatro membros que existem em produção são `owner`. Uma lista escrita em
   português teria entregado a rodada 5 **muda**, com todos os testes passando.
   Foi consultar o banco que salvou.

---

## 4. Coisas desta sessão que vão morder quem não souber

- **`npm run lint` já falha em 4 erros no `main`**, e não é coisa desta sessão:
  `src/app/page.tsx` (2 × aspas não escapadas), `src/core/flow/resposta.ts:133`
  (`no-fallthrough`) e um `set-state-in-effect`. Conferido com `git stash`.
  Não confunda com regressão sua — e vale consertar, porque lint que já falha
  ensina todo mundo a ignorar lint.
- **A suíte falha sozinha de vez em quando.** `leads.test.ts` caiu numa
  execução e passou isolada e na seguinte. É a defasagem de relógio contra o
  Supabase que o handoff da noite descreve. Reexecute antes de caçar bug.
- **Push só funciona em HTTPS** — em `localhost` o navegador libera, em rede
  local por IP não. Testar em produção ou com túnel.
- **Arquivo em `public/` que precisa abrir sem sessão tem que entrar no
  `proxy.ts`.** Aconteceu nesta sessão: `/sw-push.js` subiu no deploy da rodada
  5 respondendo **307 para `/entrar`**, porque caiu no matcher como qualquer
  rota do painel. O navegador recusa registrar um service worker cuja resposta
  não seja o script, então o push nunca chegaria — **sem erro em tela e sem
  erro em log**. Corrigido em `178bffb`, com teste.
  Foi `curl` na produção que pegou: o deploy dizia READY, a suíte estava verde,
  o typecheck também. **Nenhum dos três sabe o que o proxy faz com uma URL.** É
  a lição do contêiner GTM errado outra vez, e a razão de "provar fora do
  console" ser regra e não zelo.
- **Não existe ícone do produto em `public/`.** O service worker não aponta
  `icon`/`badge` de propósito: apontar para arquivo que não existe faz o
  navegador desenhar quadrado vazio, que é pior que o ícone genérico dele.
  Quando o ícone nascer, ele entra em `public/sw-push.js`.
- **A auditoria diz onde estão as facas.** `SEGURANCA.md` lista 13 itens de
  backlog com gatilho. Dois merecem atenção antes de cliente pagante: **S1**
  (as 88 Server Actions sem rate limit) e **S11/S12** (verbos de auditoria
  documentados que ninguém grava — inclusive `publicou_fluxo`, que é a ação que
  muda o que o bot fala com todos os leads).
- **S13 tem data:** remover o `console.error` com o corpo cru do webhook do
  Instagram (`receber-do-instagram.ts:330`) **no dia da aprovação da Meta**.
  Até lá ele é a única janela para o que ela manda de verdade, e o §4 do
  handoff da manhã manda não mexer.

---

## 5. O que falta

Nenhuma rodada. O que existe é backlog, e ele está em dois lugares:

- **[SEGURANCA.md](SEGURANCA.md)**, o backlog de segurança com gatilho por item;
- **[PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md)**, o que só você decide — e o
  **SMTP subiu de prioridade**: hoje ele trava três coisas (convite,
  recuperação de senha e o aviso de handoff por e-mail), com o código das três
  pronto esperando só a credencial.

E o de sempre: **a fila da Meta**. Nada nesta sessão mexeu em rota, nome de menu
ou caminho de tela do revisor.

---

## 6. Como se prova que uma rodada terminou

Sem exceção, e nesta ordem:

```
npm test && npm run typecheck && npm run lint && npm run build && git diff --check
```

(`lint` com a ressalva do §4: 4 erros são anteriores. Compare com o `main`
antes de culpar seu diff.)

Depois: commit por rodada, **atualizar o documento de origem**, e — para
qualquer coisa que vá ao ar — **provar fora do console**.

**A regra que vale mais que todas:** afirmar que algo funciona só depois de ver
a saída do comando que prova. Foi ela que pegou o `owner`, foi ela que impediu
esta auditoria de repetir o erro que ela própria documenta, e foi ela que achou
o service worker redirecionado — que a suíte, o typecheck, o build e o "READY"
da Vercel deixaram passar juntos.
