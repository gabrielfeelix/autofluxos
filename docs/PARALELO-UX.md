# Plano de UX em paralelo: 4 agentes, regras comuns

Vale para os quatro agentes que executam `docs/PLANO-UX-UI-2026-09-23.md` ao
mesmo tempo. Cada agente lê este arquivo inteiro antes de começar. Se algo
aqui contradiz o plano, este arquivo vale para **como** trabalhar; o plano vale
para **o que** fazer.

## Quem faz o quê

| Agente | Fases | Branch | Pasta (worktree) | Porta |
|---|---|---|---|---|
| A1 | 5 (5.3 a 5.8) e 6 | `ux/a1-automacoes-conexoes` | `../autofluxos-a1` | 3101 |
| A2 | 7, 8 e a tarefa 5.9 | `ux/a2-acesso-inbox` | `../autofluxos-a2` | 3102 |
| A3 | 9 e 10 | `ux/a3-inicio-configuracoes` | `../autofluxos-a3` | 3103 |
| A4 | 11 e 12 | `ux/a4-relatorios-validacao` | `../autofluxos-a4` | 3104 |

- **A 5.9 (anotações no Inbox) é do A2**, não do A1: ela mexe no Inbox, que é
  a Fase 8. Dois agentes no mesmo Inbox seria conflito certo.
- **Dependências:**
  - A3 faz a Fase 9 primeiro. A Fase 10 mexe em Configurações, onde a Fase 7
    também mexe (Pessoas e acesso, papéis). **A3 só começa a 10.1 depois que
    a Fase 7 estiver na `main`** (checkboxes da Fase 7 marcados em
    `origin/main`). Enquanto espera, adianta as tarefas da 10 que não tocam
    pessoas, papéis nem equipe (10.2, 10.3, 10.4, 10.5), rebaseando antes.
  - A4 faz a Fase 11 primeiro. A **Fase 12 só começa quando as Fases 5 a 11
    estiverem todas na `main`**. Enquanto espera, A4 revisa o que os outros
    já mergearam (ver "Enquanto espera" abaixo), sem editar área dos outros.
  - 10.6 (convite por e-mail) depende do envio da Brevo por
    `autofluxos.mail.4yu.com.br`. Se não estiver configurado, A3 pula e
    registra por quê.
- Fora destes quatro, **outro agente pode estar trabalhando no diretório
  principal** (`autofluxos/`, catálogo e loja). Ninguém aqui trabalha naquela
  pasta.

## Preparar a pasta (uma vez, no começo)

A partir do diretório principal (`autofluxos/`), com `N` = o seu número:

```bash
git fetch origin
git worktree add ../autofluxos-aN -b <sua-branch> origin/main
cd ../autofluxos-aN
cp ../autofluxos/.env ../autofluxos/.env.teste-local .     # ignorados pelo git; nunca commitar
mkdir -p .ux-local && cp ../autofluxos/.ux-local/*.mjs ../autofluxos/.ux-local/deploy.sh ../autofluxos/.ux-local/sessao.json .ux-local/
sed -i "s#localhost:3100#localhost:${PORTA}#g" .ux-local/*.mjs   # com PORTA exportada antes
npm ci
```

- **Sempre exporte a sua porta** antes de qualquer script: `export PORTA=310N`.
  `scripts/ux-local/dev.sh`, `prints.mjs`, `entrar.mjs`, `cadastro.mjs` e o
  e2e (`playwright.config.ts`) leem `PORTA`. Sem ela, caem na 3100, que é do
  diretório principal.
- A sessão do navegador é por porta (cookie de `localhost:<porta>`): rode
  `node scripts/ux-local/entrar.mjs` uma vez na sua porta.
- Parar o seu dev: **pelo PID**, nunca `pkill -f`. `pkill` derruba o servidor
  dos outros três.

## O banco local é um só, dividido pelos quatro

- Um Supabase local em Docker para todos. **Nunca** `supabase stop`,
  `supabase db reset` nem `supabase start` de novo: derruba os outros.
- Os testes de integração criam as próprias contas (nome com sufixo
  aleatório). Não apague dado que você não criou.
- A conta de revisão (`revisao@local.test`, "Studio Pilates Revisão") é
  compartilhada. Pode ler e mexer para print, mas **devolva ao estado
  anterior** o que alterar (ordem, ligado/desligado, nome).
- **Migration:** antes de criar, `git fetch` e olhe o maior número entre
  `ls supabase/migrations` e `git ls-tree --name-only origin/main
  supabase/migrations/`. Use o seguinte. Se no rebase aparecer outra com o
  mesmo número, **renumere a sua** (renomeie o arquivo, reaplique no local).
  Aplicar só no local (`docker exec supabase_db_autofluxos psql ...` ou o
  jeito que o repositório já usa), nunca em produção. Leia
  `docs/BANCO-COMPARTILHADO.md` antes.

## Onde cada um escreve

- **Checkboxes do plano:** marque só os das suas tarefas, no próprio
  `docs/PLANO-UX-UI-2026-09-23.md` (linhas diferentes não conflitam).
- **Registro e handoff: no seu arquivo**, `docs/ux-paralelo/aN.md`, e **não**
  no "Registro de execução" do fim do plano (quatro agentes escrevendo no fim
  do mesmo arquivo conflitam em todo rebase). Formato igual ao do plano: uma
  linha por tarefa ou desvio, com data, tarefa, commit e observação. No topo
  do arquivo, uma seção "Onde parei" que é o seu handoff.
- `docs/HANDOFF-23-SET-UX.md` fica como está (é da sessão anterior).

## Trabalhar na branch

Por tarefa:

1. `git fetch origin && git rebase origin/main` (branch em dia antes de
   começar).
2. Print **antes** (desktop e celular) com a sua `PORTA`.
3. Implementar. Validar com `npm run typecheck` e **só** os testes da área
   (arquivo por arquivo). Não rodar a suíte inteira.
4. Print **depois**, desktop e celular. **Olhar os prints** antes de dar por
   feito.
5. Marcar checkboxes, linha no `docs/ux-paralelo/aN.md`.
6. Commit **por caminho** (`git add <arquivos>`, nunca `-A`), Conventional
   Commits em português, e `git push origin <sua-branch>`.

A branch é sua: pode fazer quantos commits quiser. **Nunca** faça push na
`main` fora do procedimento de merge abaixo.

## Merge na main: ao fim de cada fase, e só depois de comparar

Mergeie **por fase**, não no fim das duas: merge pequeno conflita menos, e os
outros passam a trabalhar em cima do seu código mais cedo.

1. **Traga a main:** `git fetch origin && git rebase origin/main`.
2. **Leia o que entrou dos outros** desde a sua última base:
   `git log --oneline <base-antiga>..origin/main` e
   `git diff --stat <base-antiga>..origin/main`. Se algum commit deles tocou
   arquivo seu, leia o diff dele antes de resolver qualquer coisa.
3. **Conflito:** resolva mantendo a intenção **dos dois lados**. Nunca
   descarte o código do outro agente para o seu passar. Na dúvida, o que já
   está na `main` ganha, e você adapta o seu.
4. **Compare o resultado com a main já mergeada:**
   - `git diff origin/main...HEAD`: releia o seu diff inteiro, como revisor.
     Procure código morto, import sobrando, travessão, texto em inglês.
   - `npm ci` se o `package-lock.json` mudou.
   - `npm run typecheck`, e o `npx eslint` dos arquivos que você tocou.
   - Os testes da sua área **e** os testes das áreas dos commits que entraram
     que encostam nos seus arquivos.
   - Suba o seu dev (`PORTA`), refaça os prints das **suas** telas e abra
     rapidamente as telas que os commits dos outros mexeram, para ver que o
     rebase não quebrou nada. Se quebrou por causa do seu código, corrija na
     sua branch. Se quebrou por causa do código deles, registre no seu arquivo
     e avise o Gabriel no resumo; não edite a área do outro agente.
5. **Só então:** `git push origin HEAD:main`. Sem `--force`, nunca. Se for
   recusado (outro agente mergeou no meio), volte ao passo 1.
6. `git push --force-with-lease origin <sua-branch>` (a branch foi rebaseada).
7. Confira o deploy da `main`: `.ux-local/deploy.sh $(git rev-parse HEAD)`
   precisa dar **READY**. Se der erro, corrija na hora, é produção.
8. Mande ao Gabriel o resumo da fase (3 a 5 linhas: o que mudou, o que ficou
   pendente, prints de depois).

## Enquanto espera (A3 e A4)

Não fique parado e não invada área alheia. Pode: rebasear, revisar o diff que
os outros mergearam (`git log origin/main`) e anotar achados no seu
`docs/ux-paralelo/aN.md`, rodar os testes da sua área contra a main nova,
adiantar partes da sua fase que não dependem da outra.

## Regras que continuam valendo (do plano e do Gabriel)

- Tudo feito por você, **sem subagente para implementar**.
- As decisões de produto já foram tomadas (tabela no plano). Não pergunte de
  novo. Pare para perguntar só se algo contradiz o plano ou falta decisão.
- Nunca produção como fixture; migration nunca em produção.
- Travessão proibido em todo arquivo que você abrir.
- Texto de tela em português do Brasil, curto, sem jargão.
- Ligado/desligado **à vista na linha** (interruptor), nunca só no menu.
- Salvar **não recarrega a página**: atualização otimista, servidor grava por
  trás, erro aparece no lugar sem sumir com o que foi digitado.
- Perto de 300 mil tokens: atualize "Onde parei" no seu `docs/ux-paralelo/aN.md`,
  mande ao Gabriel a mensagem pronta para a sessão seguinte e avise.
