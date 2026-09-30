# Handoff 30/set/2026: bot da PCYES no ar, e a missão de deixá-lo excelente

Para o próximo agente. Leia inteiro antes de mexer. Regras do repo continuam
valendo (`AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`): **nada em produção sem o
Gabriel autorizar nomeando o recurso** ("pode editar o banco de produção",
"pode mexer na Vercel de produção").

## Onde estamos

O WhatsApp oficial da PCYES, **(44) 2101-1387**, está conectado à conta PCYES
(`64dbc3a9-1f77-4892-9770-e3e4be9e14cd`) em **coexistência**: o chefe do
Gabriel continua usando o app WhatsApp Business no celular, e o bot atende junto.
Como conectar número: `docs/CONECTAR-NUMERO-WHATSAPP.md`.

A loja é o Magento de **produção** (`https://www.pcyes.com.br`), com integração
só de leitura (pedidos, produtos, Sales Stock; token no Vault). Rastreio vem da
**Frete Rápido** (`src/loja/frete-rapido.ts`, só GET, token no Vault,
`lojas_integradas.frete_rapido_ref`).

### Fluxos publicados (conta PCYES)

| Fluxo | O que faz |
|---|---|
| Boas-vindas e menu | **Principal do número.** Saudação com nome + lista: Quero comprar, Meu pedido, Drivers e manuais, Suporte técnico, Garantia e devolução, Compra para empresa, Parcerias |
| Vendas com IA | IA vendedora, modo `conversar`, `loja_buscar/mostrar/combina_com/detalhes` |
| Meu pedido | pede nº do pedido ou CPF; IA com `loja_pedido` (Magento + Frete Rápido) |
| Drivers e manuais | pede o produto; IA com `loja_manuais/loja_enviar_manual` (página pública `/drivers`) |
| Suporte técnico | bloco **Encaminhar** → WhatsApp do Suporte (44) 2101-1428 (garantia também vai aqui) |
| Compra para empresa | Encaminhar → (44) 2101-1485 |
| Parcerias e marketing | Encaminhar → (44) 98809-1552 |
| Pós-atendimento | ligado ao canal: "Atendimento finalizado ✅ … escreva INICIO" |
| Garantia e devolução | **desligado** (garantia foi para o Suporte) |

Os três fluxos com IA terminam com `concluir` → `assunto_ia` → condições
`contem` que saltam para o fluxo do assunto (compra, pedido, drivers, suporte,
empresa, parceria) ou anotam "fim". Os grafos foram montados por script;
`validar()` passou nos três.

### O que mudou no código hoje (tudo com push e deploy)

- Bloco **Encaminhar contato** (`src/core/encaminhar.ts`): texto + botão
  `cta_url` para `wa.me` com mensagem pronta; cartão de contato opcional
  (desligado: cada mensagem é cobrada, ver abaixo).
- **Saudação/ausência automática do app não cala o bot**: ecos cujo texto
  começa com U+200E são automáticos (`ehMensagemAutomaticaDoApp`).
- **INICIO** (e reiniciar, recomeçar, menu inicial) recomeça pelo fluxo
  principal do número, de qualquer ponto.
- **Tocar numa opção do menu antigo** troca de assunto (fecha a conversa viva e
  segue pela opção), mesmo dentro da IA; botões da conversa corrente (Pedir dos
  cards) seguem para a IA.
- **Responder pelo Inbox ou pelo celular invalida a execução da IA em
  andamento** (`subirRevisaoDoControle`); antes ela respondia por cima e
  devolvia a conversa ao bot.
- Login: `0114` (Better Auth 1.7.5 derrubava todo login) e alerta de erro
  interno. `0113` (Frete Rápido).

## Problemas conhecidos, em ordem de impacto

1. **Lentidão da IA (até ~1 min).** A cadeia de produção é Groq → Gemini, as
   duas em **cota grátis** (`src/server/ia/modelo.ts`). Com contexto grande
   (lista de produtos, conversa longa) o Groq estoura TPM e o Gemini devolve
   **503**; os timeouts somam ~50 s. Medido hoje: prompt curto 1,6 s; prompt
   grande 503. **Correção real: chave paga do Gemini** (decisão do Gabriel,
   custa <1 centavo por conversa no flash-lite) e pôr o Gemini primeiro na
   cadeia. Depois disso, medir de novo e reduzir contexto (histórico e
   resultado de ferramenta) se ainda passar de ~5 s.
2. **Cards de produto**: numa conversa, `loja_mostrar` recebeu 3 ids e chegou 1
   card. Não investigado.
3. **Custo por mensagem desde 1/out/2026**: a Meta cobra cada mensagem de
   serviço. Menos mensagens por resposta = menos custo. Hoje a IA pode mandar
   texto + cards + aviso; vale medir quantas mensagens sai por conversa.
4. **Quem ficou sem resposta desde 29/set 15h**: a ideia era, depois da
   importação do histórico (6 meses), mandar o menu para quem escreveu e não
   foi respondido, usando `abrirFluxoParaContato` (confere janela de 24h,
   automação pausada e atendimento humano). A importação estava em andamento
   (12 contatos às ~12h30). **Mostrar a lista ao Gabriel antes de mandar.**
   A janela de 24h já fechou para quem escreveu ontem cedo; hoje as mensagens
   já são cobradas.
5. Tela do canal (`/clientes/<id>/conversas/canais/whatsapp`): técnica demais.
   Pedido do Gabriel: deixar à vista só o estado da conexão e o que o bot
   responde, e o resto num bloco **"Avançado"** recolhido.

## A missão

O Gabriel quer o bot **muito** bom: natural, resolutivo, profissional, fácil.
Pesquise a fundo na web boas práticas reais (não genéricas) de chatbot de
e-commerce no WhatsApp, com e sem IA, e aplique na PCYES:

- como empresas que fazem isso bem desenham a conversa com IA: qualificação
  (uso, orçamento) antes de indicar, quantos produtos mostrar, tom, tamanho de
  mensagem, quando perguntar e quando não, como encerrar;
- roteamento por intenção sem menu engessado; quando menu de botões é melhor
  que IA (o Gabriel quer botões para o que não é venda, IA para venda e
  drivers);
- latência: o que é aceitável, indicador de digitando, mensagem de espera;
- recuperação de erro sem jogar para humano; handoff bom quando precisa;
- métricas para saber se melhorou (resolução sem humano, tempo de resposta,
  abandono), e o que o AutoFluxos já mede (`relatorios`, `ia_chamadas`).

Antes de mudar instrução de IA, **leia conversas reais** da PCYES no banco
(read-only, com autorização) e avalie com olhar cético, como o Gabriel fez
com a do Arthur Matos em 30/set: pergunta dupla, repetição, IA fora do papel,
silêncio, transferência por "Oi". Teste cada mudança numa conversa de verdade
pelo WhatsApp antes de dizer que ficou bom.

Os IDs dos fluxos e o script de montagem estão reproduzíveis a partir do banco
(`flows.rascunho`); publique sempre por `publicar_fluxo` depois de rodar
`validar()` com `iaHabilitada: true`.

## Outras frentes abertas

- **Conexão do login separada da de dados**: `docs/HANDOFF-30-SET-CONEXAO-DO-LOGIN.md`.
  Outro agente fez o código (`7c14302`, já na main) e ia aplicar a `0115` e
  trocar as variáveis na Vercel. Confira o estado antes de mexer em banco.
- **Cupom** (primeira compra, aniversário): frente futura. A integração do
  Magento já tem permissão de cupom; o bot ainda não tem ferramenta.
- Avisos proativos (pedido saiu, entregue) via webhook da Frete Rápido:
  adiado por custo; hoje segue por e-mail.
