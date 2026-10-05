# Handoff 05/out: planos v2 (narrativa do sócio + viewer + IA por autonomia)

Leia antes: `docs/PLANO-PRECOS-05-OUT.md` (tabela que está no ar) e a entrada
de 05/out em `docs/DECISIONS.md`. Banco: `docs/BANCO-COMPARTILHADO.md`
(regras, ensaio em transação, autorização explícita para produção).

## Onde está

- Tabela nova **no ar e aplicada em produção** (migration `0128`, commits
  `2e02201`, `737d9e7f`): Essencial 297 / Profissional (id `operacao`) 597 /
  Escala 1.197; atendentes 3/10/25, extra R$ 69/59/49; IA 1.500/3.000/6.000
  (soma transcrição, sem teto com chave própria); transmissões 2.000/mês no
  Essencial; teste grátis 14 dias pelo admin.
- O sócio mandou um documento de estratégia ("Organizar / Automatizar /
  Decidir"). Gabriel e eu avaliamos: **fica a tabela que está no ar** e entram
  4 pontos dele. Os pontos rejeitados e por quê estão no fim.

## O que fazer (4 itens, nesta ordem)

### 1. Perfil viewer (acesso de visualização), ilimitado e grátis
- Nova função **Leitor** em `src/core/funcoes.ts`: vê CRM, funis, relatórios,
  Início; **sem** `atender`, sem `exportar`, sem `registrar_venda`,
  `corrigir_venda`, `configurar_*`. `ler_valores` sim (o diretor quer ver
  valor). Escopo `todos` para leitura. Nível abaixo de Atendente.
- Conferir: a função nova precisa caber no `check`/coluna `af_membros.funcao_id`
  e na matriz do admin (`/admin/funcoes`, migration 0100). Se exigir migration,
  descobrir o número com `ls supabase/migrations | tail -1`.
- **Viewer não conta como atendente.** `tamanhoDaEquipe`
  (`src/server/repos/plano.ts`) hoje conta todo `af_membros`: passar a excluir
  quem é Leitor. Ajustar `custoDaEquipe` no modal (`acoes-pessoas.ts`) e na tela
  Plano e consumo (`escolha-de-plano.tsx`): "N de M atendentes · K leitores".
- Leitor não abre Inbox (é o que pesa: stream SSE consulta 1x/s). Esconder
  Conversas do menu (`secoes-do-cliente.tsx`) e as rotas de inbox já exigem
  `atender`, então barram sozinhas. Conferir.
- Argumento de venda: "sócio e financeiro acompanham de graça".

### 2. IA com ferramentas e sequências a partir do Profissional
Princípio do sócio, que adotamos: **o modelo é o mesmo em todos os planos; o
que sobe é autonomia e ferramenta.**
- Dois recursos novos em `RECURSOS_DO_PLANO` (`src/core/planos.ts`):
  `ia_ferramentas` ("IA que consulta e age: agenda, loja, pedido") e
  `sequencias` ("Sequências de acompanhamento").
- Essencial **não** tem; Profissional e Escala têm. Atualizar `PLANOS`
  (reserva) e as linhas da tabela `planos` por migration nova (só
  `recursos`, aditivo).
- Trava da IA: no Essencial a IA conversa com contexto, mas sem ferramentas
  (`src/core/ferramentas.ts`; quem monta a lista para o modelo está em
  `src/server/ia/` e `src/server/efeitos/resolver.ts`). Sem o recurso, a lista
  de ferramentas vai vazia; nada quebra no fluxo. O editor e o checklist
  "Antes de publicar" (`src/core/flow/antes-de-publicar.ts`) avisam.
- Trava das sequências: criar/ligar sequência pede `recusaDoPlano(clienteId,
  'sequencias')` (`src/server/sequencias.ts` e as ações de sequência). Quem
  perde fica só leitura, mesma regra de sempre (`recursos-do-plano.ts`).
- Atualizar testes de `core/troca-de-plano.test.ts` e `core/planos.test.ts`.

### 3. Site com a narrativa Organizar / Automatizar / Decidir
- `src/app/page.tsx`, seção `#precos`, e `resumo` de cada plano em
  `core/planos.ts` + migration (as linhas `resumo`/`itens` no banco).
- Headlines do documento:
  - Essencial: "Organize sua operação comercial." / "Centralize contatos,
    atendimento, funil e atividades em um único lugar."
  - Profissional: "Automatize o que hoje depende da equipe." / "Use chatbot,
    IA, sequências e automações para ganhar velocidade e consistência."
  - Escala: "Transforme dados em decisões." / "Gerencie múltiplos canais,
    permissões, integrações e inteligência com mais controle."
- Itens do card: só o que **existe**. Escala vende 5 números, loja conectada,
  webhooks, chave de IA própria, acesso por pessoa. Nada de forecast, ROAS,
  copiloto, dashboards customizados, SLA.
- Somar o viewer aos cards ("Leitores ilimitados").
- Print em 1440 e 390 antes de entregar (regra do Gabriel).

### 4. Roteiro de preço futuro
- Em `docs/PLANO-PRECOS-05-OUT.md`, seção nova "Quando o preço sobe": Meta
  Conversions API, atribuição campanha → venda → receita, copiloto de vendas,
  lead scoring, dashboards customizados. Quando cada um existir, o Escala sobe.
- Primeiro validar com as 15 empresas: adoção, retenção, uso de IA, volume de
  conversa, suporte, custo por conta.

## Decisão pendente do Gabriel
- Nome do plano do meio: **"Profissional"** (no ar) ou **"Operação"** (casa com
  a narrativa do sócio). Uma linha: `nome` em `core/planos.ts` + `update
  public.planos set nome = ... where id = 'operacao'`. Perguntar antes do item 3.

## Do documento do sócio, rejeitado (não refazer)
- **Essencial sem IA e sem transmissões**: todo concorrente tem IA na entrada
  (BotConversa R$ 199, Datacrazy R$ 297 com 4 usuários). Fica IA com teto.
- **Seat subindo por plano (39/59/79)**: pune quem sobe de plano. Fica
  decrescente (69/59/49).
- **Equipe 2/5/10**: apertada; mercado dá 3 a 4 por R$ 297. Fica 3/10/25,
  agora com leitores grátis.
- **Escala vendendo recurso que não existe** (forecast, CAC/ROAS, copiloto,
  scoring, dashboards, permissão por funil/canal, SLA): vira item 4, não card.
- **Limites de funis, campos e fluxos publicados**: exigem código sem gerar
  upgrade real; fora por ora.

## Regras do Gabriel que valem aqui
Sem travessão em nenhum arquivo aberto; resposta curta; commitar e publicar ao
fechar cada frente; validar com `tsc` e testes dos arquivos mexidos (não a
suíte inteira); nada em produção sem autorização explícita; sem subagente para
implementar.
