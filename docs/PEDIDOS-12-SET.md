# Os pedidos do Eduardo — 12/set/2026

Nove pedidos chegaram por WhatsApp, em prosa, misturando três coisas
diferentes: o que virou código, o que é configuração de tela, e o que é o
desenho do fluxo — que é dele, não nosso.

Esta é a separação, item a item, com o endereço de cada um.

---

## O que já está feito

### 1. Aula experimental só de Pilates aparelho, com grade própria — ✅

> *"Aula experimental - somente pilates aparelho (SEGUNDA FEIRA - 13 - 15H)"*,
> e a grade de segunda a sexta.

**Onde ficou:** na Verandi, como dado. `servico.aceita_experimental` e
`servico.janela_experimental` (migration `0060_vr_aula_experimental`), com
`GET /disponibilidade?experimental=1` filtrando.

**Por que não no fluxo.** A tentação era escrever a grade como condição no
editor. A regra passaria a existir em dois lugares — a agenda real e o desenho
—, e quem muda a grade é o Daniel, que não abre editor de fluxo. O próprio
pedido já dizia o destino certo: *"depois que ele tiver com sistema ele mesmo
disponibiliza ou não de acordo com necessidade manualmente"*.

**O que está gravado em produção**, no Pilates aparelho e só nele:

| Dia | Experimental |
|---|---|
| segunda | 07h–12h e 14h–21h |
| terça | 07h–10h, 11h–12h e 13h–21h |
| quarta | 15h–21h |
| quinta | 07h–12h e 14h–21h |
| sexta | 07h–12h e 14h–21h |
| sábado e domingo | nenhum |

`tests/unit/grade-mgm.test.ts` confere essa tradução — a prosa do WhatsApp virou
faixa, e é aí que se erra.

**Falta no fluxo (é do Eduardo):** o bloco `buscar-dias` e `buscar-horarios` do
*Fluxo - Agendamento* precisa levar `&experimental=1` na URL **quando a pessoa
veio pelo caminho da aula experimental**. Sem isso, a API continua devolvendo a
agenda inteira — o filtro existe, mas ninguém pediu por ele.

### 2. Cancelar com 2h de antecedência — ✅

> *"O aluno para ter direito a repor a aula precisa avisar com 2h de
> antecedência"*

**Onde ficou:** Verandi, migration `0061_vr_prazo_de_cancelamento`.
`participacao.avisado_em` (quando **a pessoa** avisou, diferente de
`registrado_em`, que é quando a recepção digitou) e
`conta.horas_minimas_cancelamento`, que no MGM vale `2`.

Fora do prazo, `DELETE /participacoes/:id` grava `falta` em vez de
`falta_avisada`. As duas liberam a vaga; só a segunda dá direito a repor.

**A resposta agora diz `temCredito`**, e é isso que o fluxo usa para fazer a
pergunta do pedido:

> *"Você está tentando cancelar a aula do dia xxxx fora do período permitido,
> caso realize o cancelamento essa aula não poderá ser reposta, deseja
> prosseguir?"*

Isso responde também ao recado de 19:22: *"na verandi tem que identificar sobre
o tempo que está pedindo esse cancelamento"*. Era exatamente o que faltava — a
migration `0037` já tinha anotado a falta em comentário, em agosto.

### 3. Duplicar fluxo — ✅

> *"Tem que ser possível duplicar algum fluxo existente também"*

Botão **Duplicar** na lista de automações. A cópia nasce **desligada e sem
publicar**: copiar o estado de publicação colocaria no ar um bot que ninguém
revisou.

### 4. Reordenar os fluxos — ✅

> *"Também deixa possível reordenar a ordem dos fluxos"*

Setas de subir/descer na lista (`flows.ordem`, migration `0046`). Quem nunca foi
movido continua no fim, pela ordem de criação — nada embaralhou.

---

## O que depende de uma decisão que não é nossa

### 5. "Fora do horário, avise que a equipe está indisponível"

> *"1 parte fluxo (já sou aluno) sistema precisar reconhecer horário de
> atendimento para caso a pessoa mande mensagem fora do horário (...) 'Nossa
> equipe esta indisponível no momento, lhe contataremos o quanto antes!'"*

**O código já existe** desde `c3ef4e6`: `{{atendimento_aberto}}` (vale `sim` ou
`nao`) e `{{proxima_abertura}}` são variáveis nativas, usáveis em condição e
dentro de qualquer mensagem.

**O que falta é dado, e ele é do estúdio:** `MGM Pilates` está com
`horario_atendimento = null`, que significa **atende sempre**. Enquanto estiver
assim, `{{atendimento_aberto}}` responde `sim` às 3h da manhã e a condição nunca
desvia.

O horário da **recepção** (não o das aulas) não estava em nenhum dos recados.
Assim que o Eduardo disser as faixas, elas entram em
`/clientes/<id>/ajustes/horario` — a tela mostra, ali mesmo, se agora está
aberto e o que a pessoa ouviria.

Depois disso o desenho fica:

```
condição {{atendimento_aberto}} = nao
  → mensagem "Nossa equipe está indisponível no momento…"
  → (opcional) "Voltamos {{proxima_abertura}}"
senão
  → handoff
```

### 6. "Quanto tempo precisa para mandar mensagem novamente?"

Pergunta aberta no recado, sem resposta. Não dá para implementar uma regra que
ninguém decidiu. Quando houver número, ele vira `timeoutMinutos` no bloco de
pergunta.

---

## O que é desenho de fluxo — do Eduardo, no painel

Estes **não são código**. O desenho do MGM mora no rascunho de cada automação,
e quem o escreve é o Eduardo. Mexer nele por baixo, pelo banco, seria tirar da
mão dele o que é dele.

### 7. Renomear as opções

| De | Para |
|---|---|
| "Marcar uma aula" | "Marcar uma reposição de aula / agendar reagendamento" |
| *(nova)* | "Comunicar cancelamento de aula" / "Avisar ausência" |

### 8. Correção de planos

> *"Planos começam a partir de x valor 1x por semana, quanto maior o período e
> quantidade de aulas semanais descontos são embutidos."*

É o texto do nó `valores` do *Fluxo - Atendimento*.

### 9. "Se escolhe fisioterapia ele está jogando para aula experimental"

**Diagnosticado, e não é bem onde parecia.** O caminho da Fisioterapia está
certo:

```
menu-servicos --fisio--> fisio (texto) --> fisio-humano (handoff)
```

O que joga para a aula experimental é **todo o resto do menu institucional**:
`endereco`, `valores`, `sobre-pilates`, `metodologia` e `como-funciona` caem
todos em `oferecer-aula`. Quem entra por "Modalidades → Fisioterapia" sai no
handoff certo; quem passa por qualquer outro galho institucional é empurrado
para a experimental — inclusive depois de ler sobre Fisioterapia, se voltou pelo
menu.

**A correção é no desenho:** ou `oferecer-aula` deixa de ser o destino de todo
galho, ou ele passa por uma condição em `{{servico_de_interesse}}` (a variável
já é gravada pelo `menu-servicos`) e não oferece experimental para quem escolheu
Fisioterapia — que não tem aula experimental, como o próprio recado diz.

---

## Onde cada coisa foi mexida

| Repo | Arquivo |
|---|---|
| verandi | `supabase/migrations/0060_vr_aula_experimental.sql` |
| verandi | `supabase/migrations/0061_vr_prazo_de_cancelamento.sql` |
| verandi | `src/core/agenda/experimental.ts`, `cancelamento.ts` |
| verandi | `src/server/agenda/disponibilidade.ts` |
| verandi | `src/app/api/v1/disponibilidade/route.ts`, `participacoes/[id]/route.ts` |
| autofluxos | `supabase/migrations/0046_ordem_do_fluxo.sql` |
| autofluxos | `src/server/repos/fluxos.ts`, `src/server/acoes.ts` |
| autofluxos | `src/components/fluxos/duplicar.tsx`, `ordenar.tsx` |

As três migrations estão **aplicadas em produção** e conferidas no banco depois
de aplicar — coluna a coluna, mais os `grant` de `public.flows`, que continuam
alcançando só `postgres` e `service_role`.
