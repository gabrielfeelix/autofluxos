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

## Feito em 24/set (segunda sessão)

- `0102` em produção (registro no runbook): `c9c2b69`.
- Seções 8, 8.1 e A8: `f7c30a5`. A9 e A10: `e960ca4`. Deploy `e960ca4` READY.
- MGM Pilates movida para **Escala a R$ 800** (`preco_contratado`), a pedido
  do Gabriel, antes de ligar a trava: o bot dela usa uma conexão (Verandi),
  e no Essencial a integração pausaria. Registro na auditoria.
- Travas: `server/recursos-do-plano.ts` (IA em `ia/modelo.ts`, transcrição
  nova, criar transmissão, integração no `efeitos/resolver.ts` vira handoff,
  webhook de entrada 403 depois da assinatura, criar conexão/webhook).
- Passada diária: `server/passada-do-plano.ts`, na carona de
  `api/manutencao/retencao`.

## O que falta

- **E-mail dos avisos não sai ainda**: `server/email.ts` só envia com
  `BREVO_API_KEY` e `EMAIL_REMETENTE` na Vercel, e `autofluxos.mail.4yu.com.br`
  não tem DKIM da Brevo (NXDOMAIN em 24/set). Hoje o aviso vale no app (faixa
  em `components/conta/faixa-do-plano.tsx`). Cadastrar o domínio na Brevo,
  publicar o DNS e pôr as duas variáveis.
- As outras 5 organizações seguem no Essencial (só CRM): "Cliente 00" perdeu IA
  e conexão pela trava. Conferir se alguma precisa de outro plano.
- `acoes.test.ts` tem 5 falhas em ações de pessoas (`acaoSalvarAcesso`,
  `acaoTrocarFuncao`...), fora desta frente; não investigado.
- A tabela de pedidos ainda mede o uso sob demanda (lento).

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
