# Handoff 30/set/2026: separar a conexão do login da conexão de dados

## O problema

Em 28/set (P5 do `docs/PLANO-SEGURANCA-2026-09-28.md`, migration `0111`) a
`DATABASE_URL` da Vercel passou a usar o papel `autofluxos_login`, que só
enxerga `af_*`, `clients`, `funcoes`, `planos` e `membro_capacidades`.

Mas `bancoDoLogin()` (`src/server/auth.ts`) não é usado só pelo Better Auth.
Estes arquivos fazem SQL de **dados** por ele, e quebraram com
`permission denied` (ex.: `/admin/organizacoes`, `permission denied for view
resumo_clientes`, digest 167968593):

- `src/server/repos/relatorios.ts` (todas as consultas)
- `src/server/repos/analise-de-vendas.ts` (todas)
- `src/server/repos/organizacoes.ts` (lista usa `flows`, `channels`,
  `resumo_clientes`, `consumo_de_conversas`)
- `src/server/repos/etiquetas.ts:105` (transação)
- conferir também `pessoas.ts`, `sessao.ts`, `usuarios.ts`, `funcoes.ts`,
  `usuarios-da-plataforma.ts`: a maioria só toca `af_*`, mas confira query a
  query.

`resumo_clientes` é `security_invoker`, então herda a permissão de quem
consulta.

## O que foi feito para destravar (30/set)

A `DATABASE_URL` de produção voltou para o valor antigo
(`AUTOFLUXOS_DATABASE_URL_ANTIGO` no cofre), com redeploy. O painel voltou, e
o ganho de segurança da P5 está **desligado** até este conserto.

## O conserto pedido

Duas conexões:

1. **Login**: `bancoDoLogin()` com `autofluxos_login`, só para Better Auth e
   para as consultas que tocam só `af_*`/`clients`/`funcoes`/`planos`/
   `membro_capacidades`.
2. **Dados**: um pool próprio (ex.: `bancoDeDados()`, variável nova, ex.
   `DATABASE_URL_DADOS`) para relatórios, análise de vendas, organizações e
   etiquetas. Decida o papel: o antigo (`postgres`), ou um papel novo só com
   leitura nas tabelas de relatório. Não reabra o que a P5 fechou para o login.

Depois: variável nova na Vercel, `DATABASE_URL` de volta para o
`autofluxos_login`, redeploy, e conferir **cada** tela: login, `/admin`,
`/admin/organizacoes`, relatórios, análise de vendas, etiquetas.

Regras do repo valem: `docs/BANCO-COMPARTILHADO.md` antes de qualquer grant ou
papel; nada em produção sem autorização explícita do dono; migration numerada
pelo diretório (a última é `0114`).

## Também de 30/set, já resolvido

- Login inteiro fora desde 28/set: Better Auth 1.7.5 recusava
  `af_contas.issuer not null`. `0114` aplicada; o login agora alerta quando o
  erro não é senha errada (`src/server/acoes-conta.ts`).
