# Handoff: a T9.1 completa, e a T9.2 esperando o dono

> Escrito em 22/set/2026, ao fim da sessão que executou a **T9.1** inteira e
> preparou o **item 3 da T9.2**.
>
> **Estado:** F0 a F8 completas, **T9.1 completa**. Tudo em `origin/main`
> (último commit `6cd32c7`). Banco local na **0087**, **produção na 0086**.
>
> **A `0087` existe e NÃO foi aplicada em produção**: ela precisa de autorização
> explícita, e a da `0086` valeu só para aquela. Ver o §4.
>
> A próxima migration é a **0088**: confira com `ls supabase/migrations/ | tail -1`
> e **não copie numeração de documento nenhum, inclusive deste**.

## 1. Antes de escrever qualquer código

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -4      # deve terminar em 6cd32c7

npx supabase start                     # Docker

npm run test:unit                  # 2117 passam, 14 pulados
npm run test:integration:local     # 492 passam
npm run test:e2e:local             # 3 passam  <- novo nesta fase
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, 3 errors ANTERIORES
```

O banco local deve estar na **0087**:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

**A produção não tem essa tabela.** `supabase_migrations.schema_migrations` só
existe no Docker: o AutoFluxos aplica SQL pela Management API e não pelo CLI, e
perguntar a versão lá responde `42P01 relation does not exist`. O estado da
produção se descobre **pelos objetos**, como o `BANCO-COMPARTILHADO.md` manda.

### Consulta à produção: heredoc, sempre

A armadilha continua valendo e foi usada o tempo todo nesta sessão. **Não
consulte a produção com SQL aninhado em `python3 -c` dentro de `bash`**: as três
camadas de aspas se comem e a resposta vem errada sem erro nenhum.

```bash
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
python3 - <<'PY'
import json,os,urllib.request,urllib.error
def q(sql):
    req=urllib.request.Request(
      f"https://api.supabase.com/v1/projects/{os.environ['AUTOFLUXOS_SUPABASE_PROJECT_REF']}/database/query",
      data=json.dumps({"query":sql}).encode(),
      headers={"Authorization":f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}",
               "Content-Type":"application/json"})
    try: return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e: return {"ERRO":e.code,"corpo":e.read().decode()[:300]}
print(q("select 1 as ok"))
PY
```

**Leia o corpo do erro, e não só o código.** Um `HTTPError: 400` sem corpo
parece falha de credencial e quase sempre é SQL: foi assim que a falta da tabela
de migrations se revelou.

## 2. As regras da casa (continuam valendo inteiras)

- **Nunca `git stash` nem `git reset --hard`.** Há sessões paralelas no repo, e
  **havia uma ativa durante esta sessão**: os arquivos de `components/quadros/`
  mudaram sozinhos duas vezes, e uma delas deixou o typecheck quebrado por
  alguns minutos em arquivo que eu não tinha tocado. Antes de acusar seu próprio
  código, rode `git status` e veja de quem é o arquivo.
- **Nada de travessão** em tela, comentário, commit ou doc. Use dois pontos.
- **Teste que fala com banco entra em `test/suites.ts`**, senão o guarda recusa.
- **`service_role` ignora RLS.** Quem isola é o `client_id` em cada consulta.
- **Ao trocar retorno de função, procure os chamadores à mão.**
- **Teste de concorrência (e de proteção) só vale depois de você vê-lo falhar.**
- **Regra de validação nova entra com uma ocorrência medida atrás.**
- **`git push -q` não imprime confirmação.** O que prova é
  `git fetch && git log --oneline origin/main -1`.

### Migration antes do push, e a exceção que esta fase encontrou

**Neste repositório o `git push` em `main` É o deploy.** A regra continua: antes
de empurrar código que **lê objeto novo**, aplique a migration.

A `0087` é a exceção que confirma a regra, e vale entender por quê: ela só
**revoga** privilégio. Nenhum código lê objeto novo, e um revoke não muda
contrato, então não existe o intervalo perigoso da `0071`. Por isso o código foi
empurrado com ela pendente, de propósito e com o motivo escrito no commit.

## 3. O que esta sessão entregou

Quatro commits, todos em `origin/main`.

| Commit | O quê |
|---|---|
| `0364724` | o Playwright, em commit separado |
| `850ae32` | a `0087` e o teste de isolamento |
| `38139f2` | o A23 provado |
| `0bc9db8` | a jornada e2e e o checklist A01–A32 |
| `6cd32c7` | o pacote do piloto (T9.2, item 3) |

### A decisão do Playwright: instalado

O `test:e2e:local` estava no `package.json` desde antes da F5 e a dependência
nunca entrou. **Instalei**, e o que pesou:

1. o plano nomeia `test/e2e/jornada-chatbot-crm.spec.ts` como entregável;
2. o **A22** é teclado, foco e `Esc` num `<dialog>`, exatamente o que módulo puro
   não prova;
3. o `.env.teste-local` já aponta para o Docker, então o e2e roda contra Postgres
   de verdade sem tocar produção.

O custo real era navegador no CI, e **ele não se paga: o e2e fica fora do CI**. O
`ci.yml` não recebe a chave secreta de propósito, porque o repositório é público
e um workflow de PR de fora leria o segredo. Sem banco não há jornada. Eles
rodam na máquina antes do push, como os de integração.

### A `0087`: o revoke que não fechou

A auditoria do item 5 achou **três das 31 funções de `public` executáveis por
`anon`**: `concluir_processo`, `resolver_continuidade` (0072) e
`reabrir_ao_receber` (0049). É a lição da 0026 se repetindo: `revoke ... from
anon, authenticated` **não fecha função**, porque o `EXECUTE` vem de `PUBLIC`.

**Nenhum dado vazou**, e o alcance foi medido e não suposto: `anon` entra na
função e leva `401 permission denied` do `grant` de tabela da 0041 na linha
seguinte. A única `security definer` das três retorna `trigger`, e o Postgres
recusa chamada direta de função de gatilho.

O risco era **profundidade perdida, não porta aberta**, e é por isso que se
conserta agora e barato.

### O checklist: 24 provados, 7 parciais, 1 descoberto

Em `docs/VALIDACAO-OPERACAO-CHATBOT-CRM.md`, com `arquivo:linha` por aceite.

**O achado mais caro é o A20, e ele é de produto e não de teste:**
`arquivarCampo` marca `arquivado: true` sem consultar dependência nenhuma. Não
há bloqueio para arquivar etapa ou campo com automação apontando para ele,
embora exista para os casos vizinhos (apagar fluxo que é passo de sequência,
apagar etiqueta que a dispara). O modo de falha é silencioso.

**Os 7 parciais têm todos o mesmo formato:** o teste cobre cada metade do aceite
em separado e nunca as duas juntas. É a cobertura que passa por completa numa
auditoria por ID.

## 4. O que depende de você

**Nada da T9.2 foi marcado como feito, e nada de piloto foi simulado.**

1. **A `0087`**, que é a única migration pendente. Não é urgente pelo motivo do
   §3, e o procedimento está no `BANCO-COMPARTILHADO.md`.
2. **O alerta de diagnóstico do webhook.** A tabela tem **3.087 alertas, 2.973
   nos últimos 7 dias**, e **2.401 deles** são o alerta que grava em toda chamada
   do webhook: 78% do volume. O comentário dele em
   `src/app/api/webhook/whatsapp/route.ts:68` já diz "sai quando o caso fechar".
   Enquanto ele estiver lá, o item 4 da T9.2 (acompanhar falhas na liberação) é
   difícil na prática: são 2.400 linhas de ruído por cima das 177 recusas da
   Cloud API que importam.
3. **Escolher empresas, observar pessoas usando e liberar gradualmente** (itens
   1, 2, 4 e 5 da T9.2). Detalhe em `docs/PACOTE-PILOTO-F9.md`, §6.

**Uma coisa que muda o roteiro de observação:** com **0 vendas e 0 cartões
ganhos** na produção, não dá para demonstrar a parte de vendas com o dado que
existe. Quem testar SDR/venda precisa cadastrar produto e registrar venda
durante a sessão.

## 5. Armadilhas novas desta sessão

1. **O limite de tentativas derruba e2e, e o sintoma mente.**
   `consumirLimite` dá 5 cadastros por 5 minutos **por IP**. Rodar a suíte
   repetidamente satura. O teste falha adiante com 404 ou seletor que não
   aparece, e a mensagem do limite fica na tela anterior. O `beforeAll` cadastra
   uma vez e os testes reusam a sessão, mas **cada rodada gasta uma tentativa**.
2. **O cadastro não termina no painel**, e sim em `/ajustes/whatsapp`.
   Concatenar `page.url()` gerava `/ajustes/whatsapp/ajustes/etiquetas` e um 404
   que parecia falta de permissão.
3. **`getByLabel('Senha')` casa com dois elementos**, porque o botão "Mostrar a
   senha" tem o mesmo texto. `getByRole('textbox', { name: 'Senha' })` resolve.
   Vale para qualquer campo com botão auxiliar.
4. **`host` importa no `next dev`:** ele serve em `localhost` e recusa os
   próprios chunks para `127.0.0.1` com "Blocked cross-origin request". A página
   abre assim mesmo, então isso passa por verde enchendo o log de aviso.
5. **`test.use({ storageState })` exige desestruturação** e o ESLint recusa `{}`
   vazio (`no-empty-pattern`). Um `beforeEach` com `context.addCookies` faz o
   mesmo sem argumento morto.
6. **`heredoc` no `docker exec` precisa de `-i`.** Sem ele o psql não lê o stdin
   e o comando devolve **saída vazia, sem erro**: parece que nada aconteceu.
7. **A produção não tem `supabase_migrations.schema_migrations`** (§1).

## 6. O que ficou de fora, e por quê

- **Os outros três `.spec.ts` que o plano nomeia**
  (`configuracao-da-operacao.spec.ts` da T7.1, `formularios.spec.ts` da T7.4,
  `visao-geral.spec.ts` da T8.2). O Playwright agora existe e eles ficaram ao
  alcance, mas a T9.1 pede a jornada integrada, e escrever os três junto teria
  misturado a dívida das fases anteriores com a entrega desta. **São o próximo
  passo natural**, e o mais barato que existe hoje.
- **Seis das oito jornadas do item 1** (só humano; SDR/venda; pós-venda;
  múltiplas equipes; formulário/CTWA; integração de destino com falha). As duas
  feitas são a primeira (só bot/inbox, o A01) e o A22. As outras seis têm
  cobertura por teste de integração, listada no checklist; o que falta é o
  percurso pelo navegador. **Quatro delas dependem de dado comercial que a
  produção não tem** (ver §4).
- **A medição com percentil e tamanho de base** (item 4). O plano manda "definir
  metas com baseline e infraestrutura reais antes do piloto", e a produção tem 37
  contatos: cronometrar isso mediria a rede do Docker. O que está registrado é a
  contagem de consultas e o teto conhecido (`contatosDoNivel`, 5.000 ids).
- **A correção do A20.** Encontrado e documentado, não consertado: acrescentar
  bloqueio de dependência em `arquivarCampo` e no arquivamento de etapa é
  mudança de comportamento que merece tarefa própria, e a T9.1 é verificação.
  **É o primeiro candidato para a próxima sessão.**
- **Os 7 aceites parciais**, cada um com o ângulo faltante nomeado no checklist.
- **A limpeza do alerta de diagnóstico** (§4, item 2). É mudança de
  comportamento em produção, fora do escopo da T9.1, e a hora certa é junto da
  decisão de começar o piloto.
- **Tudo o que o handoff anterior listava e continua pendente:** a proteção de
  rascunho nos 13 chamadores do `Modal` controlado (o `ModalFormulario` tem, e
  agora com prova de navegador); `medirFunil`/`MedidasDoMes` convivendo com
  `medirDesfechos`; `handoffs.resolvido_em` fora da conta de desfecho; a seleção
  em lote (RB-37, é o A18); `contatosDoNivel` com teto de 5.000; as telas da F4;
  opt-out/bloqueio no schema; a segunda metade da janela gratuita; os 3 lint
  errors anteriores.

## 7. Estado por fase

| Fase | Situação |
|---|---|
| F0 a F4 | **completas** (F4 sem as telas) |
| F5 · T5.1, T5.2, T5.3 | **completas** |
| F6 · T6.1, T6.2 | **completas**, sem os e2e |
| F7 · T7.1 a T7.4 | **completas**, sem os e2e |
| F8 · T8.1, T8.2 | **completas**, sem os e2e |
| F9 · T9.1 | **completa** (checklist, jornada, A23, isolamento, medição registrada) |
| F9 · T9.2 item 3 | **completo**: o pacote está em `docs/PACOTE-PILOTO-F9.md` |
| F9 · T9.2 itens 1, 2, 4, 5 | **do dono**, e esperando (§4) |
