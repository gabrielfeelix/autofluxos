# Handoff 25/set/2026: automação da PCYES, o que está escapando

Para o próximo agente. Contexto da conta, dos fluxos e dos funis em
[HANDOFF-25-SET-PCYES-E-CANAL-SITE.md](HANDOFF-25-SET-PCYES-E-CANAL-SITE.md);
leia ele primeiro. Aqui está a análise da primeira conversa real de teste
(Eduardo Yamamoto, contato `143309ca-0e1b-49a1-9e68-3c7a636136db`, 25/set
13:50 a 14:00) e o que corrigir, em ordem de impacto.

Para reler a conversa: `messages` por `contact_id`, `ia_chamadas` por
`contato_id` e `handoffs` por `session_id` (via `sessions.contact_id`). Use a
Management API com o ref `xxxynoshwirupkdzwxbj` (o cofre desta máquina não tem
as variáveis `AUTOFLUXOS_*`).

## A conversa, resumida

| hora | pessoa | bot | problema |
|---|---|---|---|
| 13:50 | "quero um headset da redragon" | 23 s depois, "Deixa eu procurar 🔎" **e** a resposta no mesmo segundo; "trabalhamos com a linha PCYES... posso te mostrar?" | aviso chega junto da resposta; pede licença em vez de mostrar os cards |
| 13:51 | "mas qual a vantagem?" | parágrafo genérico de marketing, sem card | não mostra produto nenhum |
| 13:52 | "Quem é pablo vittar?" | "Vou te passar para um atendente" | pergunta fora do assunto vira handoff |
| 13:55 | "oi" | silêncio | conversa em modo humano, ninguém respondeu e nada avisou |
| 13:59 | headset com isolamento + teclado mecânico + cadeira ergonômica | "Deixa eu procurar", uma busca, depois handoff | **429 (cota) do Gemini** e pedido com 3 produtos |

Também: o menu chama a pessoa de "Eduardo Yamamoto | Gestor de Growth", que é
o nome de perfil inteiro do WhatsApp.

## O que corrigir, por prioridade

### 1. Cota do Gemini (429) derruba a conversa inteira
Handoff das 14:00: "o modelo respondeu 429". Com 429 a terceira tentativa não
roda (de propósito, `src/server/ia/gemini.ts`), e se a reserva também estiver
sem cota, a conversa vai para humano. A chave parece ser do free tier (cota
diária por modelo). **Decisão do Gabriel:** ativar faturamento na chave do
Gemini (Google AI Studio) ou aceitar o risco. Enquanto isso, o 429 também
poderia cair no `MODELO_ULTIMO_RECURSO`, porque a cota é por modelo e ele é
outro balde. Meça antes: 429 em qual modelo e a que horas.

### 2. O aviso "Deixa eu procurar" chega junto com a resposta
O bloco de mensagem antes da IA (fluxo "Vendas com IA", versão 2) não ajuda:
o motor junta as ações da rodada e `aplicar()` só envia depois que
`executarComEfeitos` termina (`src/server/receber-mensagem.ts`,
`avancarConversa`). Precisa de um jeito de despachar as mensagens que vêm
antes de um nó `ia` antes de chamar o modelo. Isso também resolve a sensação
de travado, porque o "digitando" da Meta some em ~25 s.

### 3. Pergunta fora do assunto não deveria ir para humano
"Quem é pablo vittar?" virou handoff. A regra 3 do prompt
(`src/server/ia/prompt.ts:45`) manda `NAO_SEI` para fora do escopo, e todo
`NAO_SEI` vira handoff. O motivo já é gravado separado ("a pergunta saiu do
que a empresa informou"), então dá para tratar: fora do escopo responde uma
recusa curta e volta ao assunto ("Aqui eu só consigo te ajudar com produtos e
pedidos da PCYES 🙂"), sem ocupar ninguém. Só "pediu pessoa" e "irritado"
devem virar handoff. Cuidado com a política da Meta (assistente de propósito
geral é proibido): recusar continua obrigatório, só não precisa chamar gente.

### 4. A IA vendedora pede licença em vez de mostrar
Nas duas primeiras respostas ela descreveu a linha e perguntou "posso te
mostrar?". A instrução do nó `vendedor-ia` (fluxo `baff0b15-…`) precisa dizer:
marca que não vendemos (Redragon, HyperX...) → diga que a loja é PCYES e
**mostre na hora** até 3 similares com `loja_mostrar`; pergunta de "vantagem"
→ responda em uma frase **e** mostre o card. Nunca termine sem card quando a
busca trouxe produto.

### 5. Pedido com vários produtos e atributos que não estão no nome
"headset com isolamento acústico" virou busca literal e não achou. A busca da
loja é por termo no nome. Instrução: buscar pela categoria ("headset",
"teclado mecânico", "cadeira"), usar a `descricao` para filtrar o atributo, e
tratar um produto por vez quando vierem vários ("começando pelo headset...").
As voltas de ferramenta são limitadas (`MAX_VOLTAS_DE_FERRAMENTA = 2` em
`src/server/efeitos/resolver.ts`); três produtos numa rodada não cabem.

### 6. Silêncio no modo humano
Depois do handoff, o "oi" das 13:55 ficou 3 minutos sem nada. Em
`avancarConversa`, sessão `humano` só vincula a mensagem e sai. Falta um aviso
automático, uma vez por handoff, quando ninguém assumiu em X minutos ("nosso
time já vai te responder; atendemos seg a sex, 8h às 18h"). Dentro do horário
e fora dele são textos diferentes (`contextoDeAtendimento`).

### 7. Nome no menu
`{{nome}}` usa o nome de perfil inteiro. Usar só o primeiro nome, e limpar o
que vem depois de `|`, `-` ou emoji. Ver `varsIniciais` em
`src/core/contatos/vars-iniciais.ts`.

### 8. Lentidão
23 s até a primeira resposta da IA nesta conversa, 75 s num caso anterior. Os
números e o caminho estão na seção 3 do outro handoff: a suíte real de
`gemini.test.ts` não roda hoje, e sem ela não se troca o modelo padrão.

## Como validar
Depois de cada correção, peça ao Gabriel para refazer o roteiro acima no
WhatsApp de teste (+55 44 7400-7438). Fluxo mudou? Publique via editor ou via
`publicar_fluxo` depois de `validar()`, nunca editando `flow_versions` à mão.

## Observação
Existe na PCYES um contato `site:4ec7fbc4…`: outra sessão já começou o canal
Site. Confira `git log` antes de mexer em canais para não duplicar.

Regras da casa (deploy só no fim da frente, sem suíte inteira, sem travessão,
print 1440 e 390 em tela) estão no outro handoff e na memória do projeto.
