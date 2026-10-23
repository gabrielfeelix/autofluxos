# Mensalidade do AutoFluxos pelo Asaas

Decidido em 22/out/2026 (ver `DECISIONS.md`). Este é o plano de execução. A
4YU cobra a mensalidade dos clientes do AutoFluxos pela conta Asaas da própria
4YU, aberta com o CNPJ da 4YU. A cobrança no chat (o cliente cobrando o aluno
dele) é outra coisa e continua usando a conta Asaas de cada cliente.

## O que já existe e será reaproveitado

| Peça | Onde |
|---|---|
| Planos, preços, anual, atendente extra, excedente | `src/core/planos.ts` |
| Colunas da assinatura (`assinatura_cliente_ref`, `assinatura_ref`, `assinatura_estado`) | `clients`, migration `0066` |
| Pedido de troca de plano e descida agendada | `server/acoes-plano.ts`, `server/passada-do-plano.ts` |
| Teste grátis de 14 dias e os avisos de fim do teste | `core/planos.ts`, `passada-do-plano.ts` |
| Cliente da API do Asaas (sandbox e produção, aviso autenticado, `UNDEFINED`, Pix Automático) | `src/channels/asaas.ts` |
| Suspender e reativar organização | administração (`acoes-admin`) |

## Como funciona para o cliente

1. Ele testa por 14 dias sem cadastrar cartão, como hoje.
2. Em **Configurações, Plano e consumo** (e no aviso de fim do teste), clica em
   **Assinar**. O servidor cria o cliente e a assinatura no Asaas e abre a
   **página de pagamento do Asaas**. Os dados do cartão nunca passam por nós.
3. Ele escolhe entre cartão, Pix (com Pix Automático) e boleto. Todo mês o
   Asaas cobra sozinho, manda a régua de lembretes e emite a NFS-e.
4. O aviso do Asaas (webhook) muda o estado da assinatura. **O plano muda pelo
   aviso, nunca pelo clique.**

## Decisões já tomadas (padrões; o Gabriel muda se quiser)

- **Forma de pagamento livre** (`billingType: UNDEFINED`): o cliente escolhe.
- **Dia da cobrança**: o dia em que ele assinou.
- **Excedente** (conversas acima da faixa, R$ 0,40 cada): cobrança avulsa
  no fechamento do mês, separada da mensalidade, para a fatura ficar clara.
- **Atendente extra**: entra no valor da assinatura (R$ 69 cada).
- **Subir de plano**: vale na hora, e o valor da assinatura é atualizado.
  **Descer de plano**: continua agendado para a virada do mês, como hoje.
- **Atraso**: lembretes do Asaas. **Suspende no 7º dia de atraso**, com aviso
  antes; reativa sozinho quando o pagamento entra.
- **Anual**: assinatura com ciclo anual, no preço de `precoAnual`.

## Fases

**Fase 1, sandbox e banco.** Migration nova (o número sai de `ls
supabase/migrations | tail -1`), só aditiva: tabela de pagamentos da assinatura
(id no Asaas, valor, vencimento, estado, link de pagamento, nota fiscal).
Chave da 4YU em variável de ambiente (`ASAAS_4YU_CHAVE`, valor só no cofre e
na Vercel). Rota de aviso nova, em `PREFIXOS_ABERTOS` de `src/proxy.ts`, com o
token conferido. Funções: criar cliente, criar assinatura, atualizar valor,
cancelar, gerar o link de pagamento.

Feita em 23/out/2026: `0147_mensalidade_da_4yu.sql` (aplicada em produção no
mesmo dia), `channels/asaas-da-4yu.ts`, `server/mensalidade-da-4yu.ts`,
`repos/faturas-da-conta.ts`, rota `api/webhook/assinatura`. O aviso se cadastra
sozinho na conta da 4YU na primeira assinatura (`garantirAviso`). O plano muda
quando a fatura chega paga, por `aplicarAvisoDaMensalidade`. Falta provar no
sandbox com `ASAAS_4YU_CHAVE`.

**Fase 2, tela.** Botão **Assinar** em Plano e consumo e no fim do teste.
Lista das faturas com estado e link para pagar. Faixa de aviso no painel quando
a fatura atrasar.

Feita em 23/out/2026: botão **Assinar** nos cartões de Plano e consumo
(`acoes-mensalidade-da-4yu.ts`), aviso "aguardando o pagamento", seção
Faturas (`components/plano/faturas-da-conta.tsx`) e a faixa de fatura vencida
em `faixa-do-plano.tsx`. Com chave de sandbox, só o administrador da 4YU vê o
botão (`mensalidadeLiberada`). Com assinatura ativa, mudar de plano continua
sendo pedido até a fase 3.

**Fase 3, regras.** Excedente no fechamento do mês, atendente extra no valor,
troca de plano ligada ao Asaas, suspensão no 7º dia e reativação no pagamento.

Feita em 23/out/2026: `server/passada-da-mensalidade.ts`, na manutenção
diária **antes** de `passadaDoPlano` (o excedente mede contra a faixa de antes
da descida da virada). Excedente: dias 1 a 5, cobrança avulsa com referência
`excedente:<conta>:<aaaa-mm>`, consultada antes de criar. Atraso: e-mail
`mensalidadeAtrasada` no 5º dia, suspensão no 7º (`assinatura_estado =
'suspensa'`); o aviso de pago reativa só a suspensão feita pela mensalidade.
Troca com assinatura ativa: `mudarAssinatura` (sobe na hora, desce agendado) e
`sincronizarAssinatura` na descida aplicada e em toda mudança de equipe
(`acompanharEquipe`, nunca lança).

Tela de Faturas (23/out/2026): `ajustes/faturas`, separada de Plano e
consumo. Resumo da assinatura com cancelar, números do topo, filtros, CSV
(`api/clientes/[id]/faturas/csv`) e painel de detalhe lido do Asaas na hora
(composição pela descrição da assinatura, forma de pagamento, nota fiscal).
A nota chega pelo aviso `INVOICE_AUTHORIZED`. O Assinar pede CNPJ ou CPF e
e-mail no próprio modal quando faltam.

**Fase 4, produção.** Conta da 4YU aprovada, NFS-e configurada no painel do
Asaas, chave de produção no cofre e na Vercel, aviso cadastrado, e uma
assinatura real de R$ 5 paga e estornada para provar o ciclo.

## Depende do Gabriel

- Conta Asaas da 4YU com o CNPJ (está em `PENDENCIAS-DO-GABRIEL.md`).
- Chave do sandbox: a mesma da pendência da cobrança no chat serve para as duas.
- Configurar a NFS-e no painel do Asaas (código de serviço da prefeitura).
