# Decisões técnicas: operação chatbot e CRM conectado

> Registro de implementação, aberto em 19/set/2026 pela F0 do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **Este documento não substitui o contrato.** Quem manda em regra de negócio e
> interface é a [proposta principal](PROPOSTA-19-SET-CHATBOT-FIRST.md). Aqui
> ficam as decisões de execução: o que foi medido no código, o que foi escolhido
> ao implementar e por quê.
>
> Cada achado diz **onde** está no código, para não virar afirmação solta.

## 1. Ambiente de teste (T0.1 — implementado e verificado)

### O que estava acontecendo

`vitest.config.ts` carregava o `.env` inteiro para dentro de todo teste, e os 25
arquivos de integração se ligavam sozinhos assim que enxergavam `SUPABASE_URL` e
`SUPABASE_SECRET_KEY`:

```
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
```

O `.env` desta máquina aponta para o Supabase de **produção**, que é o mesmo
projeto da Verandi. Quer dizer: `npm test` criava e apagava registro no banco que
atende cliente. Os próprios comentários do arquivo diziam isso ("boa parte desta
suíte fala com o Supabase de produção em `sa-east-1`"), como constatação, não
como problema.

### A decisão

**Credencial disponível deixou de ser autorização.** Para falar com um banco, o
teste precisa das duas coisas ao mesmo tempo:

1. `SUPABASE_URL` com host comprovadamente local (`URL().hostname` numa lista
   fechada, não `includes('localhost')` — que aceitaria `localhost.evil.com`);
2. `AUTOFLUXOS_TESTE_LOCAL=sim`, escrito de propósito.

Faltando uma, `test/ambiente-local.ts` recusa no `setupFiles`, antes de qualquer
`beforeAll` abrir conexão, e diz o motivo. Recusa sem imprimir a chave.

| Comando | O que faz |
|---|---|
| `npm test` / `npm run test:unit` | sem `.env`, sem rede, sem banco |
| `npm run test:integration:local` | lê `.env.teste-local`, só host local |
| `npm run test:e2e:local` | Playwright (pendente: F2) |

### Escolhas de execução

- **Lista explícita em vez de sufixo de nome.** Separar por `*.integracao.test.ts`
  exigiria renomear 25 arquivos e perderia o `git log --follow` deles. A lista de
  `test/suites.ts` é auditável num relance, e
  `test/integracao/lista-de-integracao.test.ts` varre nos dois sentidos: recusa
  arquivo listado que não use credencial, e arquivo que use credencial sem estar
  listado. Sem isso, um teste novo cairia na suíte unitária e se pularia para
  sempre — verde silencioso é pior que vermelho.
- **`rede-bloqueada.ts` troca o `fetch` na carga do setup, não num `beforeAll`.**
  Vários testes instalam o próprio mock com `vi.stubGlobal` no corpo do módulo,
  que roda antes dos hooks. Um `beforeAll` sobrescreveria esse mock depois de
  instalado: foi o que quebrou `src/server/whatsapp/conexao.test.ts` na primeira
  tentativa.
- **`fileParallelism: false` na integração.** As fixtures dividem um banco só; em
  paralelo a limpeza de uma suíte apaga o cenário da outra e a falha aparece
  longe da causa.
- **Banco local subido pelas migrations do disco.** O stack em Docker estava na
  `0061` e o diretório tem até a `0070`; as nove faltantes foram aplicadas no
  **local**. Portas 5643x, separadas das 5642x da Verandi, como o `config.toml`
  já previa.

### Evidência

| Suíte | Resultado |
|---|---|
| Unitários | 1724 passam, 0 falham, 14 pulados (só os que chamam serviço externo real) |
| Integração local | 294 passam, 0 falham, contra Docker |
| Typecheck | limpo |

Os 295 testes que antes **pulavam** por falta de credencial agora rodam de
verdade. Prova do guarda: com `AUTOFLUXOS_TESTE_LOCAL=sim` e credencial válida
apontando para produção, a suíte cai no guarda antes do primeiro teste.

Os 3 erros de lint do repositório (`inbox/page.tsx`, `clientes/[clienteId]/page.tsx`,
`fila.tsx`) são **anteriores** a este trabalho e continuam abertos.

## 2. Janela de envio do WhatsApp (T0.2 — pendência resolvida)

### A dúvida que o plano mandou fechar

A proposta (§5.3 e §16) e a análise (§2.2) registraram divergência entre fontes
sobre texto livre dentro da janela gratuita de 72h, com a documentação técnica da
Meta respondendo 429 durante a pesquisa. A instrução era **não ampliar permissão
de envio sem evidência aplicável ao canal**.

### A resposta, com fonte

Consultada em **19/set/2026**, a documentação oficial da Meta responde sem
margem. Página de preços vigente
([developers.facebook.com/documentation/business-messaging/whatsapp/pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)):

> "the customer service window is **independent of the FEP window**, so if the
> customer service window closes, you will only be able to send template messages."

E a página de preços por conversa, com exemplo numérico:

> "The free entry point conversation starts at 10pm and lasts 72 hours. You can
> send **template messages** at no charge in those 72 hours. You can send
> **non-template messages until 10am the next day**, at which point the customer
> service window closes, **as it is independent of the free entry point
> conversation**."

**Conclusão: as 72h são sobre cobrança, não sobre permissão de texto livre.**
Quem autoriza texto livre é sempre a janela de 24h, contada da última mensagem
da pessoa. A leitura da Salesforce estava correta; a da 360dialog, não, para
este efeito.

Condição adicional que o código hoje ignora: a janela gratuita **só abre se a
empresa responder em até 24h** do clique. Sem resposta, ela nunca existiu.

### O que isso obriga a mudar (F3 · T3.3)

`src/channels/janela.ts` faz hoje:

```
export function restaDaJanela(janela, agora) {
  ...
  return Math.max(daConversa, daPorta)   // <- o defeito
}
```

Devolver o **maior** dos dois prazos trata as 72h como autorização de envio. Um
contato que clicou no anúncio e nunca escreveu aparece com janela aberta por três
dias, e o compositor de texto livre abre para uma mensagem que a Meta recusa com
`(#131047) Re-engagement message`.

O módulo precisa passar a representar separadamente, como a proposta §5.3 pede:
**permissão de envio**, **formato permitido**, **causa** e **elegibilidade de
cobrança** — com desconhecido explícito, nunca inferido.

Registrado em `src/channels/janela.test.ts`, no bloco "as 72h do anúncio não
autorizam texto livre": os testes descrevem o comportamento atual com o correto
anotado ao lado, para que a correção da T3.3 seja visível na mudança do `expect`.

## 3. Formulário abrindo janela de 72h (achado novo da T0.2)

**Defeito, provado contra banco.** A view `public.leads` (migration `0065`) deriva
`porta_de_entrada_em` de **qualquer** linha da tabela `passagens`:

```sql
porta.criado_em as porta_de_entrada_em
```

Só que `passagens` **não tem coluna de tipo de entrada**, e dois caminhos bem
diferentes escrevem nela:

| Origem | Onde | A Meta abre janela? |
|---|---|---|
| Clique em anúncio CTWA | `receber-mensagem.ts:497`, com o `referral` do webhook | sim, 72h gratuitas |
| Lead de formulário | `receber-lead-do-formulario.ts:188`, título "Formulário — …" | **não** |

Resultado: um lead de formulário concede 72h de texto livre a quem nunca escreveu
e nunca abriu conversa. Contraria a **RB-09** ("formulário não é conversa… não
abre janela de conversa do WhatsApp por si só").

A suspeita estava levantada na análise (§2.2, "auditar a derivação de
`portaDeEntradaEm`"); agora está **confirmada** por teste contra o banco local, em
`src/server/repos/porta-de-entrada.test.ts`. O teste registra o comportamento
atual; quando a F3 separar os tipos, ele passa a exigir `toBeNull()`.

**Correção na F3 (T3.1/T3.3), não agora:** exige coluna de tipo em `passagens`,
migration, e mexer na view — e a F1 pode precisar tocar a mesma view. Antecipar
criaria duas migrations concorrentes sobre o mesmo objeto.

## 4. Inventário do legado que a F1 vai encontrar

Leitura de código, ainda não de dados de produção.

### 4.1 Sucesso operacional marcado como ganho

`src/core/quadros-modelos.ts` usa `tipo: 'ganho'` para três desfechos que **não
são venda**:

| Modelo | Etapa marcada `ganho` | O que realmente aconteceu |
|---|---|---|
| Atendimento | `Resolvido` | dúvida respondida |
| Captação (SDR) | `Qualificado` | pessoa serve para o negócio |
| Agenda e avaliação | `Compareceu` | pessoa apareceu |

É a origem do A11 ("atendimento resolvido ou agendamento concluído → zero novas
vendas"). Hoje `src/server/repos/crm.ts` deriva compra de cartão ganho, então
atendimento vira receita.

### 4.2 Um cartão por pessoa em cada quadro

`quadro_cartoes_unico_idx` (migration `0032`) garante unicidade permanente de
contato por quadro. A segunda compra do mesmo cliente no mesmo funil **não tem
onde existir** — é o A12. A F1 troca isso por identidade de ocorrência, mantendo
unicidade só do evento de criação.

### 4.3 Temperatura nasce "morno"

`src/core/crm.ts` documenta a escolha: "Quem não opinou fica em `morno`, que é o
que 'ninguém disse' honestamente significa". A proposta decidiu o contrário
(**RB-18**: "Não iniciar todos os contatos como mornos"; "Não avaliada" é estado
real). A F5 migra a temperatura global para informação legada.

### 4.4 Origem pulada com bot pausado

`src/server/receber-mensagem.ts`: o retorno por `automacaoAtiva` acontece antes
de `atribuirOrigem`, então bot pausado deixa de registrar origem e passagem
(**RB-07**, aceite A02). Confirmado por leitura; a F3 corrige.

## 5. Fixtures

`test/fixtures/operacao.ts` traz os sete cenários da T0.2 como **dados puros**,
sem banco nem rede: empresa sem CRM, atendimento, cadeia SDR → vendas →
pós-venda, recompra, múltiplos times, legado ambíguo e histórico importado.

Eles guardam o estado **errado** de propósito, onde ele existe hoje (`Resolvido`
como `ganho`, por exemplo): é o que a migração da F1 vai encontrar no banco dos
clientes, e um teste que só conhecesse o mundo corrigido não provaria a migração.

## 6. A separação entre sucesso e venda (T1.1 — implementada)

### O que mudou

Migration **0071** (número lido do diretório no momento de escrever, como manda
o `BANCO-COMPARTILHADO.md`), toda aditiva:

| Mudança | Por quê |
|---|---|
| `quadros.finalidade` | distinguir processo comercial de operacional (RB-03) |
| `quadro_cartoes_aberto_unico_idx` | unicidade só entre **abertos**: recompra passa a existir (RB-02, A12) |
| `quadro_cartoes.chave_de_criacao` | idempotência da criação de ocorrência (RB-10) |
| tabelas `vendas` e `venda_itens` | a compra com registro próprio (RB-05, RB-29) |

**Todo quadro existente nasce `operacional`.** É deliberado: marcar os antigos
como comerciais transformaria, de uma vez, todo "Resolvido" acumulado em compra
— o defeito que esta fase veio corrigir. Quem vende marca o funil como comercial
numa ação explícita, que a F5 entrega na tela.

Nenhuma coluna foi apagada. `quadro_cartoes` mantém `valor`, `fechado_em` e
`situacao` porque há leitores vivos, e porque converter ganho antigo em venda
seria decidir por suposição o que a RB-32 manda mandar para revisão humana.

### A regra, agora em um lugar só

`core/oportunidades.ts` responde **o que conta como compra**:

```
contaComoCompra(situacao, finalidade) === situacao === 'ganha' && finalidade === 'comercial'
```

`core/vendas.ts` responde **quanto**, e a regra dele é que desconhecido não é
zero: `totalDosItens` devolve `null` se faltar qualquer parte, e `resumirVendas`
devolve `semValor` para a tela poder dizer "3 compras, R$ 500 conhecidos" em vez
de apresentar R$ 500 como se fosse tudo.

### Compatibilidade de leitura do legado

`jaComprou` e `resumoDoContato` passaram a contar, nesta ordem:

1. **vendas válidas** — a fonte oficial;
2. ganho em quadro **comercial** que ainda não tem venda registrada — porque há
   empresas que fecharam venda de verdade antes da tabela existir, e retirá-las
   apagaria clientes reais da base de um dia para o outro.

Ganho em quadro **operacional** não conta mais. É a correção do A11.

### Consequência encontrada na execução

O `upsert ... onConflict: 'quadro_id,contact_id'` de `repos/quadros.ts` (três
chamadores) parou de funcionar: o PostgREST não aceita `onConflict` apontando
para índice **parcial**, e responde "there is no unique or exclusion constraint
matching the ON CONFLICT specification". A filtragem passou a ser explícita
(`jaAbertosNoQuadro`), com o `23505` ainda tratado como sucesso para cobrir a
corrida entre duas requisições.

Isso não estava previsto no plano e só apareceu ao rodar os testes — é o tipo de
coisa que justifica a ordem "escrever o cenário que falha antes de implementar".

### Evidência

| Aceite | Antes | Depois |
|---|---|---|
| A11 · atendimento resolvido | 1 compra, receita fictícia | **0 compras** |
| A11 · atendimento + venda comercial | 2 compras, R$ 500 | **1 compra**, R$ 500 |
| A12 · recompra no mesmo funil | recusada, 1 cartão | **2 ocorrências, 2 vendas** |
| A13 · duplo clique e corrida | — | **mesma venda**, 1 compra |
| A14 · compra sem valor | — | conta 1, total 0, `semValor: 1` |
| A15 · cancelar venda | — | sai dos indicadores, registro preservado |

Suítes: **1755 unitários** e **311 de integração local**, zero falhas.
Migration aplicada duas vezes no banco local sem erro (idempotência, A23).
`src/server/repos/venda-nao-e-atendimento.test.ts` nasceu medindo o defeito e
hoje exige o comportamento correto; a diferença está no histórico do git.

## 7. Numeração de migration

A `0071` foi criada e aplicada **somente no Docker local**. A próxima virá de
`ls supabase/migrations/ | tail -1` **no momento de escrevê-la**, nunca deste
documento — a regra do `BANCO-COMPARTILHADO.md`, que já errou três vezes por
documento afirmar número. Em 19/set/2026 o disco terminava em `0070` e a `0071`
foi escrita a partir disso; esta linha é registro histórico, não fonte.

## 8. Estado por fase

| Fase | Situação |
|---|---|
| F0 · T0.1 | **implementado e testado localmente** |
| F0 · T0.2 | **implementado**: inventário, fixtures, pendência de canal resolvida |
| F1 · T1.1 | **implementado e testado localmente**: finalidade, ocorrência recorrente, venda |
| F1 · T1.2 | não iniciada (transações, histórico e continuidade) |
| F2 a F9 | não iniciadas |

Nada foi liberado em produção. Nenhuma migration aplicada fora do Docker local.
Nenhuma mensagem real enviada.
