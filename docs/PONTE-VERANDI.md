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
| AutoFluxos → Verandi | Bloco Aulas em Análise > Vendas: presença, experimental que matriculou, matrículas, quem saiu, reposições | `GET /api/v1/relatorio` |

## Decisões

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

- `presenca.falta` precisa da migration `0085_vr_evento_de_falta` da Verandi
  em produção (lista fechada de tipos do outbox). Sem ela, a falta só não vira
  aviso.
- Fora das 24h o aviso vira nota na ficha e não sai: falta modelo aprovado
  por evento (próximo passo natural).
- Marcar aula pelo Inbox (humano) usando `disponibilidade` e `participacoes`.
