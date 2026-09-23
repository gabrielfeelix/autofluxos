# Cobrar no chat: desenho

Item 2 do `PLANO-23-SET-O-QUE-CONSTRUIR.md`. Decidido com o Gabriel em
22/set/2026.

> **Estado: desenho aprovado em conversa, código ainda não escrito.**
> Este documento é o contrato. Quem for implementar lê daqui.

---

## Por que este item existe, e por que ele não é sobre pagamento

O CRM **nasce vazio**. A produção tem 0 ganhos e 0 cartões com valor: ninguém
registra venda à mão. Painel, LTV, nível por faixa e régua de retomada estão
todos construídos, testados, e sem dado nenhum para mostrar.

O pagamento não é o objetivo. Ele é **o único fato que entra sozinho**: quando
o dinheiro cai, alguém de fora confirmou a compra sem precisar que um humano
lembre de anotar. É essa entrada automática que liga o que já foi pago para
construir, e é por isso que este item vale mais do que parece.

---

## A tensão com o RB-29, e como ela se resolve

`src/server/servicos/registrar-venda.ts` diz, no cabeçalho:

> O que "registrada" quer dizer, e o que NÃO quer. Quer dizer que a empresa
> **confirmou a compra**. Não quer dizer que ela foi paga (RB-29). Não há nada
> aqui sobre pagamento, e a ausência é deliberada: pagamento tem origem própria
> e conciliação própria, e um campo `pago` neste caminho viraria um número que
> o financeiro não reconhece.

O plano, por sua vez, diz "o webhook registra a venda sozinho". Lido de um
jeito, isso contradiz o RB-29.

**Não contradiz, e o próprio RB-29 diz por quê:** *"Integração futura com
pagamento terá sua própria origem e conciliação."* O RB-29 nunca proibiu que
pagamento gerasse venda. Ele proibiu **colapsar as duas coisas na mesma
tabela**.

A fronteira, então:

- **`cobrancas` é a origem do pagamento.** "Pago" vive ali, com id do PSP, data
  e valor recebido. É a conciliação própria que o RB-29 pediu.
- **`vendas` continua sendo confirmação comercial**, sem ganhar campo nenhum.
- Quando a cobrança é recebida, ela **chama o serviço que já existe** para criar
  a venda. A venda passa a ter uma origem a mais, e nenhuma regra a menos.

Consequência que precisa estar escrita: **venda criada por pagamento é venda
confirmada**, porque dinheiro que caiu é a confirmação mais forte que existe.
O contrário não vale: venda registrada à mão continua sem dizer nada sobre
pagamento, e continua aparecendo como *Não acompanhado*.

---

## Arquitetura

### 1. `cobrancas`: a origem própria

Tabela nova em `public`. Uma linha por cobrança emitida.

| coluna | o que é |
|---|---|
| `id` | nosso |
| `client_id` | a conta |
| `contact_id` | para quem foi cobrado |
| `cartao_id` | a oportunidade, quando houver. `null` é cobrança avulsa |
| `psp` | `'asaas'`. Existe para o dia do segundo PSP |
| `psp_cobranca_id` | o id **no PSP**. Único por `(psp, psp_cobranca_id)` |
| `valor` | `numeric(12,2)`, o que foi cobrado |
| `status` | `pendente` · `recebido` · `vencido` · `cancelado` · `estornado` |
| `link` | a URL de pagamento que foi ao cliente |
| `recebido_em` | quando o dinheiro caiu. `null` enquanto não caiu |
| `valor_recebido` | o que **realmente** caiu, que pode diferir de `valor` |
| `venda_id` | a venda que ela gerou. `null` até receber |
| `criado_em`, `atualizado_em` | |

**`valor_recebido` separado de `valor` não é preciosismo.** Pix com desconto,
juros por atraso e pagamento parcial fazem os dois divergirem, e sobrescrever
`valor` apagaria o que foi cobrado. A venda usa o recebido; a cobrança guarda
os dois.

**O índice único em `(psp, psp_cobranca_id)`** é o que faz o webhook repetido
não virar segunda cobrança.

### 2. O adaptador de PSP

Espelha `src/server/adaptador-do-canal.ts`, que já resolve este mesmo problema
para WhatsApp e Instagram: uma interface, um ponto de despacho, credencial por
cliente no Vault.

```
src/psp/types.ts      a interface Psp
src/psp/asaas.ts      a implementação
src/psp/falso.ts      o PSP de teste (ver "Como se testa")
src/server/adaptador-do-psp.ts   quem escolhe
```

A interface, mínima e só com o que o item 2 usa:

```ts
type Psp = {
  criarSubconta(dados: DadosDaSubconta): Promise<{ contaId: string; apiKey: string }>
  emitirCobranca(pedido: PedidoDeCobranca): Promise<CobrancaEmitida>
  lerEvento(corpo: string, assinatura: string | null): EventoDoPsp | null
}
```

`lerEvento` faz as duas coisas juntas de propósito: **conferir a assinatura e
interpretar** o corpo. Separar convidaria alguém a interpretar sem conferir.

**Por que trocável, e não Asaas cravado:** R$ 1,99 fixo é 1,3% numa mensalidade
de R$ 150 e **4% numa aula avulsa de R$ 50**. O ticket médio da base ainda não
foi medido. Se ele for baixo, Woovi (0,80%, teto R$ 5) passa a ser melhor, e
o adaptador é a diferença entre uma implementação nova e uma reescrita.

### 3. A chave da subconta vai para o Vault

Exatamente como a 0040 fez com o token do Instagram: a tabela guarda
`api_key_ref uuid`, apontando para `vault.secrets`. O valor **nunca** toca a
tabela; quem precisa chama `public.ler_segredo()`, que só a `service_role`
executa. Apagar a ligação apaga o segredo junto, por trigger, senão o Vault
acumula chave órfã.

Isto não é escolha nova: é o padrão que o repositório já usa para credencial
por cliente, e a chave de subconta de PSP é a credencial mais forte que vamos
guardar, porque **ela movimenta dinheiro de terceiro**.

### 4. O webhook

Rota: `src/app/api/webhook/pagamento/route.ts`.

**Tem que entrar em `PREFIXOS_ABERTOS` do `src/proxy.ts`.** O prefixo
`/api/webhook/` já está aberto, então a rota nasce alcançável, mas isso precisa
ser **provado e não suposto**: este arquivo já registra três ocorrências do
mesmo bug, e a de 13/set/2026 custou o Inbox inteiro com tudo "certo" dos dois
lados. A prova é de trinta segundos:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<producao>/api/webhook/pagamento
```

401 quer dizer que o proxy comeu a chamada. Qualquer outra coisa quer dizer que
a rota está executando e se defendendo sozinha.

**Como ela se defende:** assinatura do PSP conferida em `lerEvento`, antes de
qualquer leitura do corpo. Sessão de usuário não existe nesta chamada e nunca
vai existir; exigir uma só garantiria que o webhook nunca funcione.

### 5. Receber: o caminho inteiro

```
PSP  --POST-->  /api/webhook/pagamento
                       |
                 lerEvento(corpo, assinatura)     assinatura não confere -> 401, fim
                       |
                 acha a cobranca por psp_cobranca_id   não achou -> 200 e log, fim
                       |
                 status != 'recebido'  -> só atualiza o status, fim
                       |
                 registrarVendaEConcluir(... chave = 'cob:' + cobranca.id)
                       |
                 grava venda_id, recebido_em, valor_recebido na cobranca
```

**A idempotência é de graça, e é o melhor pedaço deste desenho.** A RPC
`registrar_venda_e_concluir` (0080) já devolve a venda existente quando a
`chave_da_operacao` repete, **antes de escrever qualquer coisa**. Derivando a
chave do id da cobrança, o retry do PSP (que acontece: todo PSP reentrega
quando não recebe 200) encontra a venda que já existe e devolve ela. Nenhuma
segunda venda, nenhum código novo de idempotência.

**Não achou a cobrança responde 200, e não 404.** 404 faz o PSP reentregar para
sempre uma cobrança que não é nossa. O que houve fica no log.

**Cobrança sem `cartao_id`** não cria venda: `registrarVendaEConcluir` exige
cartão, porque venda e fechamento de oportunidade são atômicos (RB-30). A
cobrança fica `recebido` com `venda_id` nulo, e a tela mostra isso como
"recebido, sem oportunidade ligada". É estado legítimo, não defeito.

### 6. Cobrar: quem aperta o botão

**O atendente, no inbox.** Não o bot, nesta rodada.

A razão é uma só: bot errando valor é **dinheiro de terceiro cobrado errado**,
e o desfazer disso não é um `delete` nosso, é um estorno na conta de outra
pessoa. O humano vê o valor antes de enviar.

O caminho do bot não fica fechado: quando ele vier, é uma sexta ferramenta em
`core/ferramentas.ts` chamando o mesmo serviço. Quem aperta o botão muda; o que
o botão faz, não.

O preço sugerido vem do **item 1**, que já está em produção: se a oportunidade
tem interesse apontado e o produto tem preço, o campo já vem preenchido. Item
sem preço não sugere nada, pela mesma razão de sempre: `null` é "não
informado", e não zero.

---

## O piloto, e o teto que ninguém pode descobrir tarde

O Asaas tem **avaliação regulatória de até 60 dias**, limitada a **10 subcontas
e R$ 2.000 de emissão por subconta**. Estourou qualquer um, bloqueia criação e
emissão.

Por isso:

- O recurso nasce atrás de um **liga/desliga por cliente** (`cobranca_ativa` em
  `clients`), desligado por padrão;
- A tela diz, para quem está no piloto, que está em avaliação e qual é o teto;
- O erro de teto do Asaas vira **frase**, não 500: "o limite do período de
  avaliação foi atingido".

O pior caminho seria descobrir o teto com um cliente final esperando o Pix.

### O que trava o piloto de verdade

**A conta-pai do Asaas ainda não existe.** O CNPJ da 4YU existe; a conta, não.
Sem ela não há como criar subconta nem emitir cobrança.

Então esta rodada entrega **tudo menos a chamada real**, e isso está escrito
aqui para ninguém ler o código pronto e concluir que está no ar. Quando a conta
existir: criar a conta-pai na UI do Asaas, pôr a chave em
`.secrets/4yu.env` (nunca no repositório, nunca em doc, só o nome da
variável), e ligar o piloto numa conta.

---

## Como se testa, e o que o teste NÃO prova

`src/psp/falso.ts` é um PSP completo em memória: emite, assina evento, entrega.
Com ele dá para provar, sem rede:

- webhook com assinatura errada é recusado;
- webhook repetido não cria segunda venda (a prova da idempotência);
- pagamento parcial grava `valor_recebido` diferente de `valor`;
- cobrança de outra conta não é encontrada;
- cobrança sem cartão fica recebida sem venda.

**O que isso não prova:** que o Asaas responde o que a documentação dele diz.
Formato de assinatura, nome de campo e código de erro só se conhecem contra a
API real, e a primeira cobrança de verdade vai achar diferença. Isso é normal,
e está escrito aqui para não ser esquecido no dia.

Os testes que tocam banco ficam no padrão do repositório: `describe.skipIf`
por credencial, fora da lista de exclusão do `vitest.unit.config.ts`.

---

## O que este item NÃO faz

Registrado para não voltar como ideia nova:

- **Não vira facilitador de pagamento.** O dinheiro vai **direto para o dono da
  PME**, na subconta dele. Decisão do Gabriel, e ela nos mantém fora do fluxo
  financeiro.
- **Não usa `order_details` do WhatsApp.** Ele é mais bonito, mas a Meta **não
  gera o Pix e não concilia** (*"WhatsApp does not support payment
  reconciliations"*): somaria uma fila da Meta a um trabalho de PSP que
  precisaria ser feito igual. A confirmação automática, que é o que importa,
  funciona igual com link.
- **Não é catálogo comercial.** Sem carrinho, estoque, proposta ou contrato: a
  recusa do `MODELO-CRM.md:209-213` continua valendo.
- **Não marca venda antiga como paga.** Não há migração de dado: cobrança só
  existe daqui para a frente.
- **Não estorna.** Estorno é na conta do dono, pelo PSP. Se o PSP avisar, a
  cobrança vira `estornado`; cancelar a venda continua sendo decisão humana,
  com motivo, como o RB-31 exige.

---

## Ordem de construção

1. Migration: `cobrancas`, `api_key_ref`, `cobranca_ativa`, trigger do Vault
2. `src/psp/types.ts` e `src/psp/falso.ts`
3. `core/cobrancas.ts`: régua pura (valor, status, transição)
4. `repos/cobrancas.ts`
5. `servicos/conciliar-pagamento.ts`: o pedaço que liga recebido -> venda
6. `src/psp/asaas.ts`
7. A rota do webhook, e a prova do `curl`
8. Botão no inbox
9. Liga/desliga do piloto e os avisos de teto

Os passos 1 a 5 não dependem do Asaas existir. O 6 e o 7 são escritos contra a
documentação e só se provam de verdade no dia da conta-pai.

---

## Riscos, em ordem de quanto doem

1. **Dinheiro de terceiro não tem desfazer nosso.** Cobrança errada se resolve
   na conta do dono. Por isso humano aperta o botão nesta rodada.
2. **O proxy comendo o webhook.** Três ocorrências no `proxy.ts`, uma delas
   custou o Inbox. Mitigado pelo `curl`, que é prova e não suposição.
3. **O teto do Asaas no meio de uma cobrança real.** Mitigado pelo piloto
   explícito e pela frase em vez de 500.
4. **A API real diferir da doc.** Não mitigável antes da conta-pai. Assumido e
   escrito.
5. **Cobrança órfã**, emitida no PSP com a gravação falhando do nosso lado.
   Grava-se `pendente` **antes** de chamar o PSP, e o id do PSP entra depois:
   assim o pior caso é uma linha pendente sem id, visível, e não um Pix no
   mundo que o sistema desconhece.
