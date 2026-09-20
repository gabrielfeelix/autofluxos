# Navegação, configurações e onboarding — Implementation Plan

**Goal:** organizar a navegação diária, tornar configurações encontráveis e preparar cada empresa com um assistente opcional e persistente.
**Architecture:** reutilizar componentes/tokens e modelos existentes. Estado do assistente por empresa, escrita autorizada no servidor e conclusão transacional/idempotente. Automação sempre nasce rascunho; não alterar canais, fluxos ou funis existentes.
**Tech Stack:** Next App Router, React, Tailwind, Supabase/Postgres, Vitest e Playwright.

## Contrato visual
- Manter fonte e tokens atuais: bg-panel, bg-surface, text-ink/muted/dim, border-line, primary/primary-weak. Sem novas cores de marca. Verde só para sucesso; âmbar para pendência.
- Sidebar 226px / recolhida 68px: Painel no topo; título DIA A DIA (Inbox, Atividades com contador de vencidas + hoje, Contatos, Funil); título AUTOMAÇÃO (Automações, Transmissões). Configurações no rodapé antes de conta/presença. Títulos discretos 10px, itens 13px, cantos 10px.
- Recolhida/celular: botão de conta abre painel com conta, disponibilidade e saída; presença visível no gatilho. Navegação diária continua acessível. Configurações continua acessível.
- Configurações: mesmas quatro categorias. Busca com sinônimos em cima; seletor agrupado no celular. Conhecimento da IA, Arquivos e mídias, Dados da empresa, Personalizar sistema e Captação por anúncios. Catálogo também no índice.
- Assistente: tela dedicada, largura máxima 960px. Cabeçalho com empresa e Continuar depois; indicador de quatro passos; cartão central branco/panel com escolhas em cartões radio, seleção azul. Rodapé Voltar / Continuar. No celular uma coluna, sem rolagem horizontal.

```text
Vamos preparar [empresa]                     Continuar depois
Objetivo ─ Atendimento ─ Preparação ─ Revisão
┌─────────────────────────────────────────────────────────┐
│ Pergunta curta + consequência concreta                   │
│ [ Opção              ] [ Opção              ]           │
│ Perguntas condicionais / modelo escolhido / prévia       │
│                                                         │
│ Voltar                                    Continuar →   │
└─────────────────────────────────────────────────────────┘
```

## Comportamentos
1. Objetivo atendimento/vendas/ambos; atendimento equipe/automação com equipe/depois; canal WhatsApp/Instagram.
2. Preparação condicional: funil comercial/agenda/pós-venda ou nenhum; chatbot triagem/menu de dúvidas ou nenhum. Usar modelos reais. Revisão mostra etapas e efeitos, permite voltar/editar.
3. Salvar progresso por empresa ao avançar/adiar. Responsável autorizado configura; membro vê orientação para Inbox/Atividades/Contatos no Painel. Empresas existentes acessam voluntariamente por Personalizar sistema. Primeiro acesso novo vai ao assistente.
4. Concluir em transação com lock da empresa e marcador concluído. Reenvio não duplica. Se já houver funil/fluxo, preservar e não criar outro automaticamente. Nenhum bot publicado/ativado, canal alterado ou contato importado.
5. Checklist respeita automação independente de vendas, quantidade dinâmica. Conclusão direciona para conectar canal, revisar rascunho e usar funil.

## Execução e arquivos
- [x] Navegação: secoes-do-cliente.tsx, barra-lateral.tsx, cliente-shell.tsx; promover rota atividades mantendo URL antiga compatível; contador respeita escopo.
- [x] Configurações: menu-de-ajustes.tsx, índice e títulos das páginas; busca e seletor mobile.
- [x] Domínio: core/onboarding.ts + testes; corrigir core/objetivo-da-conta.ts e testes.
- [x] Persistência: migration descoberta pelo diretório; clients.onboarding + RPC transacional em public; repos/onboarding.ts, acoes-onboarding.ts. Sem objetos Verandi/Auth/Storage.
- [x] Interface: components/onboarding/assistente.tsx, rota /clientes/[id]/configurar, primeiro acesso, Personalizar sistema e Painel.
- [x] Verificação: typecheck, lint dos arquivos alterados, unitários de domínio/autorização, replay SQL local e cenários de idempotência/rollback, navegador desktop/mobile/teclado.

## Publicação
Migration deve entrar antes do deploy. Não aplicar em produção sem autorização explícita, conforme AGENTS.md e docs/BANCO-COMPARTILHADO.md. Não incluir alterações concorrentes de atividades. Verandi verificado sem alterações locais em 20/09/2026.

## Entrega e validação
- Migration `0089_onboarding_guiado.sql` criada após conferir a última no disco (`0088`, de outra tarefa). Aplicada somente ao Supabase Docker local, sem produção. Independe da 0088.
- 2.128 testes unitários passaram na suíte completa; após ajuste do checklist, os 24 testes focados passaram (incluindo um cenário adicional).
- 5 integrações reais no Postgres local: salvar/adiar/retomar, idempotência, rascunho pausado, preservação de existentes, rollback integral, conclusões concorrentes, isolamento entre empresas e grants. Nenhuma fixture em produção.
- Typecheck e lint de todos os arquivos desta entrega passaram. Lint global tinha 3 erros anteriores; o do Painel foi corrigido ao separar o relógio da renderização. Restam os dois do Inbox (Date.now e setState no effect), além de cinco warnings anteriores.
- Browser isolado com componentes reais e ações simuladas: quatro passos, atendimento manual/híbrido, pausa/retomada, falha/retry, conta mobile/recolhida, Escape, busca por sinônimo, seletor mobile e ausência de overflow. Capturas em `/tmp/autofluxos-onboarding-preview/` (artefatos temporários, não fonte de verdade).
- `npm audit` apontou 5 alertas em dependências existentes (2 moderados, 2 altos, 1 crítico). Não houve alteração de dependências nesta tarefa; atualizações precisam de validação própria.

## Publicação concluída em 20/set/2026

Os quatro passos foram executados nesta ordem, em sessão seguinte à que escreveu
o plano, com autorização explícita do dono pedida para a `0089`.

1. **Autorização obtida** e migration aplicada pela Management API.
2. **Os dois testes exigidos, os dois limpos**: replay do zero em Docker
   (`0001`–`0089` em ordem, sem erro) e ensaio em transação contra a produção,
   que devolveu coluna e função criadas, `anon`/`authenticated` sem `EXECUTE`,
   `service_role` com, e zero clientes afetados antes do `rollback`.
3. **Releitura objeto a objeto depois de aplicar**: `clients.onboarding` é
   `jsonb` anulável e as **10 contas existentes têm `null`**, então nenhuma é
   empurrada para o assistente; `preparar_onboarding` está com
   `search_path=""` e `security invoker`; `anon` e `authenticated` respondem
   `false` para `EXECUTE` e `service_role` responde `true`; `crm_ativo` seguiu
   `true` nas 10 contas.

   **Data API dos dois produtos depois do `notify pgrst`**: `public.clients` e
   `public.atividades` respondem 200, a coluna nova já aparece no PostgREST, e
   `app_verandi.conta`, `.contrato`, `.avaliacao` e `.cobranca` respondem 200.
   (Um primeiro teste deu 404 em `contas`/`agendamentos`/`profissionais`: eram
   nomes inventados por quem conferiu, não dano do reload. Os nomes reais vieram
   de `information_schema`.)
4. **Código publicado depois da migration**, com a suíte inteira verde: 2.613
   testes unitários e 499 de integração no Postgres local.

### Um tropeço do ambiente, registrado para a próxima

O replay local com `drop schema public cascade` derruba os grants do stack do
Supabase, e restaurar só tabelas não basta: sem
`grant execute on all functions in schema public to service_role` as vendas e os
estágios falham com "expected false to be true", que **parece** defeito do
código e é do ambiente. Depois de restaurar, refazer o fechamento que as
migrations exigem: `af_auditoria` volta a `select, insert` (0042) e
`preparar_onboarding` volta a ser revogada de `public, anon, authenticated`.

## Decisões para manutenção
- `/quadros/atividades` redireciona para `/atividades`; ações invalidam a página nova e a moldura para atualizar o contador. Contador limitado a 200 é mostrado como `200+`, sempre com o escopo do usuário.
- Atividades permanece visível sem CRM. Conta/perfil abre dialog nativo em todos os tamanhos, com estado de disponibilidade no gatilho. Notificações continuam montadas uma única vez.
- Assistente concluído abre resumo; edição posterior acontece nas telas de objetivo/recursos, funil e automação. Concluir novamente não reconfigura nada.
- Modelos são escolhidos no servidor a partir de enums; nenhum grafo vem do navegador. RPC bloqueia a linha da empresa e é executável só por service_role/postgres, com search_path vazio.
- Escolhas de modelos adiadas não viram pendência obrigatória. Trocar o objetivo nas configurações para um objetivo diferente volta às regras desse objetivo.
- Não ativar bots, criar gatilhos, associar canais ou importar contatos automaticamente.
