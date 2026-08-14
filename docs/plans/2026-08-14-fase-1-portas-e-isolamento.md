# Fase 1 — Portas e isolamento Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fechar os pontos de abuso e impedir que uma escrita de fluxo atravesse o cliente dono.

**Architecture:** A primeira fatia cria um RPC atômico, acessível apenas ao `service_role`, e o chama no login e no simulador. O simulador também mede os bytes recebidos antes de analisar JSON, limita o grafo já validado e expõe `robots.txt` pelo App Router. A segunda fatia carrega `clienteId` até o repositório e exige o par em cada atualização/publicação.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Supabase/Postgres.

---

### Task 1: Limitar entradas externas e impedir indexação

**Files:**
- Create: `supabase/migrations/0014_limites.sql`, `src/server/limite.ts`, `src/server/limite.test.ts`, `src/app/robots.ts`
- Modify: `src/server/auth-actions.ts`, `src/app/api/simular/route.ts`, `src/app/api/simular/route.test.ts`, `src/app/layout.tsx`

1. Escrever testes para a chamada RPC, corpo acima de 256 KB e fluxo com 201 nós.
2. Criar função SQL atômica com `search_path`, RLS e permissões restritas.
3. Aplicar limite por IP ao login e ao simulador; rejeitar antes de efeitos caros.
4. Gerar `robots.txt` que bloqueia o painel e adicionar metadado `noindex`.
5. Rodar testes, lint, tipos, build e `git diff --check`; commit e push.

### Task 2: Vincular escrita de fluxo ao cliente

**Files:**
- Modify: `src/server/repos/fluxos.ts`, `src/server/acoes.ts`, `src/components/editor/editor.tsx`, `src/server/repos/repos.test.ts`, `docs/PLANO-MESTRE.md`, `docs/ESTADO.md`

1. Escrever teste de repositório que tenta alterar/publicar um fluxo com o cliente errado.
2. Exigir `(fluxoId, clienteId)` no repositório, actions e chamadas do editor.
3. Atualizar a documentação para registrar a Fase 1 concluída.
4. Rodar a suíte, lint, tipos, build e `git diff --check`; commit e push.

**Done When:** sexta tentativa é recusada, o simulador não aceita corpo/grafo excessivo, o painel não é indexado e nenhuma escrita aceita um fluxo de outro cliente.
