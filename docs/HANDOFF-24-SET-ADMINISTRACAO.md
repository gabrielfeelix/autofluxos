# Handoff: administração, o que falta (24/set/2026)

Plano: `docs/PLANO-ADMINISTRACAO-2026-09-24.md`. Leia as seções 7, 8 e 8.1
inteiras; as decisões estão tomadas lá e **não precisam de pergunta**.

## Autorização do Gabriel (vale para esta frente inteira)

O Gabriel autorizou, por escrito em 24/set/2026, o agente que executar este
handoff a:

- **aplicar em produção as migrations que esta frente criar** (seções 7, 8 e
  8.1), pela Management API, seguindo `docs/BANCO-COMPARTILHADO.md`: ensaio
  `begin; ...; rollback;`, aplicação, releitura objeto a objeto, Data API dos
  dois produtos, registro no runbook com números medidos;
- **commitar, dar push na `main` e conferir o deploy** na Vercel.

Não vale para migration de outra frente, nem para mexer em `app_verandi`,
Auth, Storage ou extensão. Nunca `supabase db push` nem `db reset`.

## Já pronto (não refazer)

- A1 a A7 publicadas; `0099` e `0100` em produção (registro no runbook).
- Troca de plano com modal de impacto (`f7a5db7`, `fef5ff4`):
  `src/core/troca-de-plano.ts` (regra pura + teste), `src/server/troca-de-plano.ts`
  (mede de novo ao confirmar), `src/components/plano/modal-de-troca.tsx`,
  usada em `components/cliente/escolha-de-plano.tsx`,
  `components/admin/plano-da-organizacao.tsx` e `tabela-de-pedidos.tsx`. O uso
  vem de `usoDaOrganizacao` em `server/repos/plano.ts`, medido junto da página.
- Hoje **nada no produto trava recurso pelo plano**: `recursos` só descreve.

## O que falta, na ordem

1. **Seção 8 e 8.1 (plano de verdade)**, uma migration:
   `clients.plano_agendado`, `clients.plano_agendado_para`,
   `clients.preco_contratado` (preenchido com o preço de hoje),
   `planos.preco_excedente` (0,40 / 0,30 / 0,20).
   - descida agendada para a virada do mês; subida na hora. A passada diária
     que aplica a descida entra na manutenção que já existe (procure o cron
     em `vercel.json` / `src/app/api`); aviso no app e por e-mail 7 dias e 1
     dia antes;
   - trava por recurso, só leitura, religando ao subir (tabela na seção 8):
     IA, transcrição, transmissões, integrações e webhook. Cada trava lê o
     plano **vigente**, nunca o agendado;
   - excedente: conta no modal e na tela Plano e consumo ("estimativa"
     enquanto não há gateway); aviso em 80% e 100% da faixa;
   - preço editado na tela Planos vale para organização nova; para as
     existentes, a administração escolhe entre manter (legado) e aplicar com
     aviso de 30 dias.
2. **A8 planos**: criar, duplicar, excluir (bloqueado com organização no
   plano: modal lista quais e oferece "Mover todas para…"). Migration tira o
   `check` de ids fixos de `planos.id` e `clients.plano`.
3. **A9 usuários**: editar nome/e-mail, redefinir senha, organizações do
   usuário (pôr, trocar função, tirar), excluir (bloqueado se único
   Proprietário de alguma organização).
4. **A10 organizações**: criar pela administração; excluir com nome digitado,
   bloqueado com canal conectado.

A tabela de pedidos (`tabela-de-pedidos.tsx`) ainda mede o uso sob demanda
(lento); vale acelerar a consulta de transcrições em `usoDaOrganizacao`.

## Como trabalhar (regras do Gabriel)

- Não fazer perguntas; decisões estão no plano. Resposta final curta.
- Commit por fase, **por caminho** (`git add <arquivos>`, nunca `-A`): há
  outra sessão na mesma árvore (negócios, análise de vendas). Numere a
  migration pelo diretório **na hora** (`ls supabase/migrations | tail -1`).
- Migration **antes** do push quando o código lê objeto novo (regra da
  `0071` no runbook).
- Ações otimistas, sem `revalidatePath` da rota aberta; nenhum travessão (U+2014)
  em arquivo aberto; placeholder começa com "Exemplo:"; interface diz
  "Organização" e "Função"; usar os componentes nossos (`Dropdown`, `Modal`,
  `Caixa`, botões `app-primary-button`/`app-secondary-button` com padding).
- Rodar só os testes dos arquivos mexidos; validar com `tsc`; HEAD validado
  num worktree limpo (`node_modules` por `cp -al`, `next typegen` + `tsc`).
- Print local em 1440 e 390 de cada tela mexida antes de entregar
  (`bash scripts/ux-local/dev.sh` em segundo plano, porta 3100;
  `.ux-local/admin.mjs`, `.ux-local/troca.mjs`, `.ux-local/hierarquia.mjs`;
  senha local `senha-local-123456`; org de teste
  `afacb27c-ec60-44a7-be3e-a66f4fc60976`, dono `revisao@local.test`).
- Deploy: projeto Vercel `prj_17XxHvJ1vOAQ6j4mQSauCPA1BJXO`, time
  `team_hmVHyYO1YFO9fuAtpG9Ym2hm`; conferir o SHA em READY. Um push por
  fase grande, não por commit.
- Ao fim: atualizar este handoff e a seção 6 do plano.
