# Frentes por segmento

> Ideia registrada em 25/set/2026, a pedido do Gabriel. **Nada decidido nem
> construído.** Serve para quem for desenhar feature nova saber que ela pode
> pertencer a um segmento, e não ao núcleo comum.

## A ideia

Separar o AutoFluxos em frentes, cada cliente escolhendo a que faz sentido
para o negócio dele:

| Frente | Exemplo de cliente | Já existe hoje |
|---|---|---|
| E-commerce | PCYES (Magento) | busca, card, frete, pedido, drivers e manuais, cores pelo nome |
| Aulas | MGM Pilates (Verandi) | agenda, horários, marcar e desmarcar |
| Distribuição | (nenhum ainda) | nada específico |
| Saúde | farmácias, clínicas de manipulação | nada |
| Serviços | (nenhum ainda) | nada específico |

## Por que importa desde já

Cada frente muda **regra de negócio, fluxos, telas e permissionamento**. O que
hoje é um produto só já mistura as duas primeiras: `src/server/ia/prompt.ts`
só liga o bloco de venda quando há `loja_buscar`, e as consultas de agenda e de
loja convivem em `src/core/ferramentas.ts`, separadas por `integracao`.

Ao construir algo novo, vale anotar a qual frente ele serve e não amarrar a
regra de um segmento no núcleo comum.

## Saúde: o que já se sabe

Referência de fluxo que o Gabriel recebeu como paciente (25/set/2026, "Eliz",
assistente de uma clínica de imagem): abertura com nome e aviso "nunca
solicitamos pagamentos", botão que abre um formulário do WhatsApp pedindo o
CPF, o exame entregue como **PDF anexado com a explicação na legenda**, e
depois uma pesquisa de satisfação (NPS 0 a 10) também em formulário.

Ponto de atenção: dado de saúde é **dado sensível** na LGPD (art. 11), com
regra mais dura que o resto do produto. Esse fluxo manda senha de portal em
texto na conversa, e isso não é para copiar.
