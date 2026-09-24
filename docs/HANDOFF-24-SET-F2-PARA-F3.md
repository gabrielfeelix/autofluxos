# Handoff 24/set: F2 feita, próxima é a F3

Plano: `docs/PLANO-NAVEGACAO-E-CRM-2026-09-24.md`. Leia inteiro; os blocos
"Estado da F1" e "Estado da F2" na seção 7 dizem onde cada peça mora.

## Onde parou

- F1 (barra por seções): `1a954c9`, `03dd8ab`.
- F2 (cartão de negócio, página do negócio, lista): `c3ed2ea`, estado em
  `5efecec`. **Em produção**: push `7af0d08`, deploy READY.
- Migration `0101_previsao_do_negocio.sql` **aplicada em produção** em 24/set,
  registrada em `docs/BANCO-COMPARTILHADO.md`. Não há migration pendente.
- F3 **não começada**.

## F3 (seções 5.3 e 5.4 do plano)

**Análise > Vendas.** Subitem novo em `SECOES`
(`src/components/design/secoes-do-cliente.tsx`). Receita do mapa da F1 para
pendurar tela: subitem em `SECOES`, porta em `EXIGENCIA_DA_SECAO` e
`ENDERECO_DA_ABA`, prefixo em `aba-do-caminho.ts` (`PREFIXOS` e
`DO_CAMINHO`), teste em `aba-do-caminho.test.ts` e `secoes-do-cliente.test.ts`.
Período no topo, abas Receita (ganho no período, ticket médio, gráfico por
mês), Conversão (taxa de vitória, passagem etapa a etapa com a maior perda
destacada, motivos de perda em barras), Equipe (por responsável: ganhos,
valor, taxa, tempo médio até fechar). Vazio explica e oferece "Criar
negócio". Valor só para quem tem `ler_valores` (ver `podeVerValor` em
`relatorios/page.tsx`).

Material que já existe: `relatorios/page.tsx` (Atendimento, período e
`podeVerValor`), `repos/relatorios.ts`, `repos/vendas.ts` (`resumoDeVendas`),
`quadro_cartoes` (`situacao`, `valor`, `fechado_em`, `motivo`, `criado_em`,
`responsavel`), `motivos_de_perda` (0080), `conclusoes_de_processo` (0072),
eventos `mudou-de-etapa` em `eventos_do_contato` (com `dados.cartaoId` desde
a F2; antigos sem). Seed de relatório: `scripts/ux-local/seed-relatorios.mts`.
Antes de gráfico, carregue a skill `dataviz`.

**CRM > Etiquetas como tabela.** Tela atual `leads/etiquetas/page.tsx` (a F1
já moveu e redirecionou `ajustes/etiquetas`). Colunas: etiqueta, cor,
contatos, criada em, `⋯` com renomear, juntar com outra, apagar. Clicar no
número abre Contatos filtrado. Repo: `listarEtiquetasComContagem`,
`editarEtiqueta`, `apagarEtiqueta`, `marcarContatos` em `repos/etiquetas.ts`.
"Juntar" ainda não existe: mover os contatos de A para B e apagar A.

**Aceite da F3:** os números batem com uma consulta à mão no banco local
para um período.

## Armadilhas desta sessão

- **Next 16 aceita um só `next dev` por pasta.** Se o outro agente já roda na
  3100, o `dev.sh` com outra `PORTA` sai com "You can access the existing
  server". Esse servidor alheio serviu SSR velho de componente cliente (erro
  de hidratação falso). Para print confiável: `npx next build` e `next start`
  numa porta livre, com o ambiente do `scripts/ux-local/dev.sh` (troque
  `next dev` por `next start` numa cópia no scratchpad, com `cd` absoluto).
  Mate pelo pid da porta (`ss -ltnp | grep :3107`), **nunca `pkill -f`**: ele
  casa com a própria linha de comando e mata o shell.
- Login local: `PORTA=<porta> node scripts/ux-local/entrar.mjs` grava
  `.ux-local/sessao.json`. Cliente local
  `afacb27c-ec60-44a7-be3e-a66f4fc60976`. Script de prints da F2 como modelo:
  `.ux-local/f2.mjs` (fora do git).
- Editar arquivo grande com `sed`/`python` faz o harness reenviar o arquivo
  inteiro no contexto. Use a ferramenta Edit.
- Produção: Management API com `SUPABASE_ACCESS_TOKEN` do cofre e o ref
  literal `xxxynoshwirupkdzwxbj`. Ensaio em transação (`begin; ...;
  rollback;`) antes, releitura e Data API nos dois produtos depois. Modelo no
  registro da 0101 em `BANCO-COMPARTILHADO.md`.
- Deploy: `.vercel/project.json` tem o `projectId`; conferir READY pela API
  com `VERCEL_TOKEN` e `teamId=team_hmVHyYO1YFO9fuAtpG9Ym2hm`.
- `tsconfig.json` aparece modificado pelo build; não é de ninguém, não
  commitar.
