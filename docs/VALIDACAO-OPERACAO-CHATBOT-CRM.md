# Validação da operação chatbot/CRM: A01 a A32, com evidência

> Escrito em 22/set/2026, na execução da **T9.1** (F9) do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **O que este documento é:** o checklist dos 32 cenários de aceite da proposta
> (`PROPOSTA-19-SET-CHATBOT-FIRST.md`, §15.2) com **onde cada um é provado** e,
> quando não é, a falha aberta dita pelo nome.
>
> **O que ele não é:** uma lista de vistos. O plano pede "checklist com
> evidência e falhas abertas", e um checklist todo verde sem evidência não vale
> nada, enquanto um com falha nomeada vale muito. Sete aceites aqui estão
> marcados como **parciais** e três como **descobertos**, e essa é a parte mais
> útil do arquivo.

## Como ler

| Marca | Quer dizer |
|---|---|
| **provado** | existe teste automatizado que falha se o comportamento quebrar |
| **parcial** | o essencial está coberto, e um ângulo nomeado do aceite não está |
| **descoberto** | nenhum teste cobre; é falha aberta |

A evidência é sempre `arquivo:linha`. Teste de integração roda contra o Postgres
local em Docker (`npm run test:integration:local`); teste puro roda em
`npm run test:unit`; jornada de navegador roda em `npm run test:e2e:local`.

**Uma armadilha de busca, registrada porque morde:** `A01` também existe em
`docs/SEGURANCA.md`, onde é o **OWASP A01 (Broken Access Control)**, coisa
completamente diferente do aceite A01 daqui. Um `grep` por `A01` nos docs
devolve os dois. Os aceites moram **só** na proposta, §15.2.

## O estado medido quando isto foi escrito

```
unitários     2117 passam · 14 pulados
integração     492 passam
navegador        3 passam
typecheck      limpo
lint           8 problemas, 3 errors anteriores e não tocados
```

Produção conferida por consulta direta, e não por leitura de handoff:

```
37 contatos · 29 cartões · 8 handoffs · 15 sessões · 6 contas · 0 vendas
handoffs com origem: 0   (esperado: a 0086 não fez backfill, de propósito)
Verandi: 32 migrations · 42 tabelas · 16 policies de storage.objects
```

## O checklist

| ID | O cenário | Situação | Evidência |
|---|---|---|---|
| A01 | empresa sem CRM recebe mensagem e assume atendimento | **provado** | `test/e2e/jornada-chatbot-crm.spec.ts` (cadastro pela tela até o Inbox, sem passar por funil); regra em `test/fixtures/operacao.ts:56` |
| A02 | bot pausado recebe entrada de anúncio | **parcial** | origem registrada: `src/server/receber-mensagem.test.ts:190`, `:225`, `:248`. Bot calado: `src/server/agendador.test.ts:218`. **Os dois lados nunca no mesmo teste** |
| A03 | humano primeiro com equipe indisponível | **parcial** | `src/core/rodizio.test.ts:70` e `:75` (ninguém recebe, conversa fica sem dono); fila mostra sem-dono em `src/components/inbox/fila-local.test.ts:40`. Falta a ponta a ponta |
| A04 | formulário reenviado para contato existente | **provado** | `src/server/repos/porta-de-entrada.test.ts:174` (chave externa separa reenvio de submissão nova), `:106` e `:231` (não abre janela), `src/server/receber-lead-do-formulario.test.ts:153` |
| A05 | webhook idêntico duas vezes | **provado** | `src/server/receber-mensagem.test.ts:307`; corrida em `:637` |
| A06 | coleta sem critério completo | **provado** | `src/core/qualificacao.test.ts:53`, `:90`; integração `src/server/repos/qualificacoes.test.ts:218`, `:194`; temperatura nula `src/server/repos/oportunidades.test.ts:89` |
| A07 | fora do critério pede funcionário | **provado** | `src/core/qualificacao.test.ts:176`; motor `src/core/engine/executar.test.ts:199` e `:1141` |
| A08 | dois atendentes simultâneos | **provado** | `src/core/controle-da-conversa.test.ts:34`; integração `src/server/controle-da-conversa.test.ts:92` |
| A09 | IA termina depois do humano assumir | **provado** | `src/core/controle-da-conversa.test.ts:130`, `:159`; integração `src/server/controle-da-conversa.test.ts:164` com contraponto `:181` |
| A10 | devolver à fila e depois retomar o bot | **parcial** | `src/core/controle-da-conversa.test.ts:93`, `:100`, `:107`; integração `src/server/controle-da-conversa.test.ts:196`. **Falta:** que a retomada use a versão publicada escolhida |
| A11 | atendimento resolvido não é venda | **provado** | `src/server/repos/venda-nao-e-atendimento.test.ts` (a T8.1 inteira) |
| A12 | compra de novo no mesmo processo | **provado** | `src/server/repos/vendas.test.ts`, `src/core/continuidade.ts`, `test/fixtures/operacao.ts:143` |
| A13 | venda com duplo clique e falha de resposta | **provado** | `src/server/repos/vendas.test.ts`, `src/server/servicos/registrar-venda.test.ts`, `src/server/servicos/concluir-processo.test.ts` |
| A14 | compra válida com valor desconhecido | **provado** | `src/core/vendas.test.ts`, `src/server/repos/vendas.test.ts` (a T8.1: quem comprou sem valor é `bronze`, não `sem_compra`) |
| A15 | venda corrigida ou cancelada | **provado** | `src/core/vendas.test.ts`, `src/server/repos/vendas.test.ts` |
| A16 | critérios de qualificação mudam | **provado** | `src/server/repos/qualificacoes.test.ts:109`, `:53`; `src/core/qualificacao.test.ts:134` |
| A17 | filtro cruzado de temperatura e etapa | **provado** | `src/server/consultas/contatos.test.ts:176` (fria E aberta têm que ser a mesma negociação) |
| A18 | segmento com mais de uma página | **parcial** | congelamento e contagem em `src/server/repos/segmentos.test.ts:159`. **Falta:** "selecionar todos os 340 do filtro" não existe como gesto (RB-37) |
| A19 | operador acessa link/API/CSV de outra equipe | **provado** | `src/server/permissoes.test.ts`, `src/core/permissoes.test.ts`, `src/server/repos/equipes.test.ts` |
| A20 | arquivar item com automação dependente | **descoberto** | bloqueio existe para casos vizinhos (`src/server/repos/sequencias.test.ts:146`, `:152`; `src/server/repos/quadros.test.ts:272`). **Para etapa/campo com automação dependente, nada** |
| A21 | bot publicado com edição não publicada | **parcial** | `src/server/repos/repos.test.ts:223`, `:258`; sessão em andamento `src/server/receber-mensagem.test.ts:478`. **Falta:** asserção de que sessão **nova** pega a publicada |
| A22 | fechar modal alterado sem perder o digitado | **provado** | `test/e2e/jornada-chatbot-crm.spec.ts` (Esc com campo preenchido pergunta e preserva; intocado fecha direto); regra pura em `src/components/design/rascunho-do-modal.ts` |
| A23 | migração roda novamente | **provado** | `src/server/importar-duas-vezes.test.ts` (não duplica contato nem cartão, **e não envia mensagem**; e não reabre conversa já resolvida) |
| A24 | segmento muda após confirmar transmissão | **provado** | `src/server/repos/segmentos.test.ts:159`, `:196`; revalidação `src/server/disparar-transmissao.test.ts:237`, `src/server/repos/segmentos.test.ts:272` |
| A25 | entrada padrão desativada com quadro antigo | **provado** | `src/core/regras-de-entrada.test.ts:158`, `:185`; integração `src/server/repos/quadros.test.ts:320`, `:329`; ponta a ponta `src/server/receber-mensagem.test.ts:838` |
| A26 | concluir SDR e o destino falha | **provado** | `src/server/servicos/concluir-processo.test.ts`, `src/server/servicos/concluir-processo.ts` |
| A27 | valor comercial restrito, conversa acessível | **provado** | `src/server/permissoes.test.ts`, `src/core/permissoes.test.ts`, `src/components/quadros/painel-do-contato.tsx` |
| A28 | histórico importado é sincronizado | **provado** | `test/fixtures/operacao.ts:232`; e a segunda metade em `src/server/importar-duas-vezes.test.ts` (nenhuma mensagem sai) |
| A29 | campanha nova reutiliza oportunidade aberta | **parcial** | `src/server/receber-mensagem.test.ts:248`, `:291`, `:893`. **Falta:** que a origem **da oportunidade** (e não a do contato) não seja substituída |
| A30 | mensagem humana pelo celular em coexistência | **parcial** | `src/server/receber-coexistencia.test.ts:374`, `:447`, `:84`. **Falta:** asserção de que o bot para por causa do eco humano |
| A31 | sequência com passos vencidos após atendimento | **parcial** | `src/server/prioridade-humana.test.ts:134`, `:154`, `:166`; `src/server/fluxos-padrao.test.ts:355`. **Falta:** que a retomada não despeje os passos acumulados de uma vez |
| A32 | critérios com valor conhecido e ausente | **provado** | `src/core/qualificacao.test.ts:66`, `:79`, `:53`, `:90`, `:100` em diante |

## As falhas abertas, em ordem de quanto custam

### 1. A20: arquivar com automação dependente (descoberto)

O aceite pede que arquivar uma etapa ou campo com automação apontando para ele
**resolva a dependência ou bloqueie com explicação**. Existe bloqueio para os
casos vizinhos: `apagarFluxo` recusa quando ele é passo de sequência, e
`apagarEtiqueta` recusa quando ela dispara uma. Para **etapa de quadro** e
**campo definido**, não há nada.

É o mais caro da lista porque o modo de falha é silencioso: a automação continua
existindo apontando para um alvo arquivado, e só se descobre quando ela roda.

### 2. A31: a retomada em rajada (parcial)

`prioridade-humana` prova que passo vencido não derruba atendimento em curso, e
`fluxos-padrao` prova que o bot pausado não fala. O que ninguém prova é o
momento seguinte: quando o atendimento encerra e a sequência volta a valer, os
passos que venceram durante o atendimento saem **todos de uma vez**?

A `por_sumico_em` da 0070 existe para impedir o caso análogo na régua de
retomada, e o handoff registra o porquê: sem ela, seria uma mensagem por dia
para o mesmo cliente. Aqui a pergunta é a mesma, para outro caminho.

### 3. A02, A03, A10, A21, A29, A30: ângulos nomeados (parciais)

Nenhum destes é buraco aberto: em todos, o essencial tem teste e falta um
ângulo, listado na tabela. Vale registrar que os seis têm o mesmo formato de
lacuna: **o teste cobre cada metade em separado e nunca as duas juntas**. É a
forma típica de cobertura que passa por completa numa auditoria por ID.

### 4. A18: a seleção em lote (parcial, e é produto e não teste)

"Selecionar todos os 340 do filtro" não existe como gesto. Está registrado como
pendência desde quatro handoffs atrás (RB-37), e não é falta de teste: é
funcionalidade que não foi construída. Fica aqui para não sumir da conta.

## O que foi corrigido durante esta validação

**A auditoria do item 5 (isolamento AutoFluxos/Verandi) achou um defeito real**,
e ele virou a migration `0087`: três das 31 funções de `public` eram executáveis
por `anon` e `authenticated`, porque `revoke ... from anon, authenticated` não
fecha função (o `EXECUTE` vem de `PUBLIC`). O alcance foi medido e nenhum dado
vazou, porque o `grant` de tabela da 0041 barrou a camada seguinte. O registro
completo está no cabeçalho de `supabase/migrations/0087_execute_de_public.sql` e
a guarda contra regressão em `src/server/isolamento-do-schema.test.ts`.

**A `0087` foi aplicada em produção em 22/set/2026**, com autorização explícita
do dono. Releitura objeto a objeto limpa, e o gatilho `reabrir_ao_receber`
provado lá num `begin/rollback`.

## O isolamento AutoFluxos/Verandi (item 5)

Conferido por consulta direta à produção em 22/set/2026:

| Conferência | Resultado |
|---|---|
| tabelas e views de `public` alcançáveis por `anon`/`authenticated` | **0** |
| funções de `public` executáveis por `anon`/`authenticated` | **3**, corrigidas pela `0087`, **aplicada em 22/set/2026** |
| tabelas de `public` sem RLS | **0** |
| policies de `storage.objects` sem filtro de `bucket_id` | **0** |
| objetos nossos dentro de `app_verandi` | **0** |
| `app_verandi`: migrations, tabelas, policies | **32 · 42 · 16**, iguais ao registro anterior |

Nenhuma alteração foi feita em Auth, Storage, extensões ou Data API nesta fase.

**Uma coisa que quem auditar vai encontrar e não é falha:** `service_role` tem os
7 privilégios em objetos novos de `public`, e não só o `SELECT` que as migrations
escrevem. É o `grant all on all tables in schema public to service_role` da
**0041** alcançando objeto novo, o mesmo efeito que a **0042** documenta.

## Medição (item 4)

**Não há número de latência aqui, de propósito.** O plano tem o aviso escrito
dentro dele: "evitar prometer latência arbitrária neste documento". O Postgres
local tem dezenas de linhas, e cronometrar consulta sobre isso mediria a rede do
Docker, não o produto.

O que dá para afirmar hoje:

- **contagem de consultas** é a medida honesta em base pequena, e foi assim que
  a T7.1 achou as 14 idas ao banco por visita;
- a T8.1 reduziu `relacionamentoDeMuitos` de duas consultas para uma, ao trocar
  a fonte para a view `contatos_comerciais` (0082);
- **`contatosDoNivel` ainda devolve ids com teto de 5.000**
  (`src/server/consultas/nivel.ts`), e esse é o limite conhecido mais próximo de
  virar problema com base real.

**Meta com percentil e tamanho de base fica pendente de base real**, que é o que
o próprio plano manda: "definir metas com baseline e infraestrutura reais antes
do piloto". Hoje a produção tem 37 contatos.
