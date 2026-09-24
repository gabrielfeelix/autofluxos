# Handoff: plano da administração (24/set/2026)

Plano: `docs/PLANO-ADMINISTRACAO-2026-09-24.md`. A1 a A7 prontas, publicadas
(Vercel READY em `3405afc`) e com as migrations em produção. Quadro de commits
na seção 6 do plano.

## Estado

- `0099` e `0100` **aplicadas em produção em 24/set/2026**, com autorização
  explícita. Registro com os números em `docs/BANCO-COMPARTILHADO.md`.
- Hierarquia testada no navegador local, com o banco conferido depois de cada
  passo (detalhe na seção 6 do plano). Roteiro reutilizável:
  `node .ux-local/hierarquia.mjs "Nome:Função,..." email@local.test`.
- Prints de A7 em `.ux-local/a7/` (1440 e 390). A tela Pessoas virou lista no
  celular e a tabela cabe em 1440.
- No banco local, `bruno@` e `ana@local.test` ganharam senha
  (`senha-local-123456`) e existe a equipe "Vendas" (Bruno e Atendente A2).
  Bruno ficou Gestor.

## Não conferido

- `/admin/planos` e `/admin/funcoes` **em produção** pedem login de
  administrador, que o agente não tinha. Conferido indiretamente: as duas
  tabelas respondem 200 pela Data API com a chave secreta, que é a condição do
  aviso "a edição liga quando a migration...". Abrir as duas e olhar.

## Próximo

Seção 7 do plano: criar/excluir plano (A8, **precisa de migration nova e de
autorização para produção**), editar e excluir usuário (A9), criar e excluir
organização (A10). As decisões já estão escritas lá.

## Atenção: outra sessão na mesma árvore

Uma sessão paralela (negócios, `supabase/migrations/0101_previsao_do_negocio.sql`,
`src/app/clientes/[clienteId]/negocios/`) tem mudanças não commitadas. Commitar
só por caminho, nunca `git add -A`. A próxima migration desta frente se numera
pelo diretório **na hora**, depois da dela.
