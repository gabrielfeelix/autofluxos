# Ponte AutoFluxos e Verandi

Os dois produtos da 4YU dividem o projeto Supabase e **nenhum lê o schema do
outro** (`docs/BANCO-COMPARTILHADO.md`). A ponte é HTTP, com a chave `vr_` que a
conta guarda em Configurações > Credenciais (`NOME_DA_CREDENCIAL_DA_AGENDA`).
Código: `src/server/ponte-verandi.ts`. Feita em 22/out/2026.

## O que ela faz

| Sentido | O quê | Onde |
|---|---|---|
| Verandi → AutoFluxos | Avisos da agenda viram gatilho de automação, com `{{aluno_nome}}`, `{{aula_dia}}`, `{{aula_data}}`, `{{aula_hora}}`, `{{aula_servico}}`, `{{aula_professor}}` (e `{{tem_reposicao}}` na aula cancelada) | receptor `app/api/webhook/verandi/[clienteId]`, eventos em `core/eventos-da-verandi.ts` |
| AutoFluxos → Verandi | Ligar os avisos em um clique: cria o webhook de entrada `Verandi (avisos)` e manda endereço e segredo para `PUT /api/v1/webhook` | cartão da Verandi em Credenciais |
| AutoFluxos → Verandi | Cartão "Na Verandi" na conversa e na ficha: horários, próximas aulas, reposições, última aula, licença | `components/lead/aluno-da-verandi.tsx` |
| Verandi → AutoFluxos | Fora das 24h, o aviso sai pelo modelo aprovado do evento (`verandi_falta`, `verandi_aula_cancelada`, `verandi_vaga_aberta`, `verandi_aula_marcada`, `verandi_aula_desmarcada`), criados pelo botão "Criar modelos" no cartão de avisos. Sem modelo aprovado, nota na ficha | `server/aviso-por-modelo.ts`, `MODELOS_DA_VERANDI` |
| AutoFluxos → Verandi | Marcar aula pelo cartão "Na Verandi" (7 dias, só a modalidade do aluno; reposição quando há uma em aberto) e desmarcar (`DELETE /participacoes/:id`, diz se ficou reposição). Depois de marcar, oferece a confirmação na conversa | `components/lead/marcar-aula-na-verandi.tsx`, ações em `acoes-ponte-verandi.ts` |
| AutoFluxos → Verandi | Bloco Aulas em Análise > Vendas: presença, experimental que matriculou, matrículas, quem saiu, reposições | `GET /api/v1/relatorio` |

## Decisões

- **Modelo de fora das 24h por nome fixo, um por evento**, como o
  `lembrete_de_cobranca`: sem migration. Respeita bot pausado. Sem dia, hora
  ou aula no aviso, não manda (modelo com lacuna chega estranho).
- **Marcar pelo Inbox reacha o aluno pelo telefone da conversa a cada ação**,
  nunca pelo `pessoaId` vindo da tela; desmarcar só aceita uma das próximas
  aulas dele. Com o gatilho "Aula marcada" ligado, a tela não oferece a
  confirmação (a automação já manda).

- **Receptor próprio, não o webhook genérico.** A Verandi assina
  `instante.corpo` (hex, `Verandi-Signature`, `Verandi-Timestamp`) e manda o
  telefone em `dados`; o webhook genérico espera outra assinatura e telefone no
  topo. Antes da ponte, aviso da Verandi nunca entrava.
- **`PUT /api/v1/webhook` só aceita endereço do AutoFluxos**
  (`https://autofluxos.4yu.com.br/api/webhook/verandi/`). Chave vazada não
  desvia nome e telefone de aluno para outro lugar.
- **Aula cancelada vira uma conversa por aluno** (`dados.alunos`).
- **Faltas, experimental e evasão são contados na Verandi** e chegam só como
  números. Observação de saúde nunca sai de lá.
- **Ligar de novo troca o segredo dos dois lados**: é o conserto quando algo
  sai do lugar.

## Pendências

- `0085_vr_evento_de_falta` aplicada em produção em 22/out: `presenca.falta`
  já sai.
- Aviso fora das 24h e marcar pelo Inbox no ar em 22/out
  (`docs/HANDOFF-22-OUT-PONTE-VERANDI-2.md`, feito).
- Modelo é por nome fixo, um por evento, sem escolha por gatilho. Escolher o
  modelo por gatilho exige coluna nova: pedir autorização antes.
