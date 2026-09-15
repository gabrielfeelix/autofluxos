# Plano — a primeira tela (Painel)

Resposta ao `docs/HANDOFF-HOMEPAGE.md`. A decisão está tomada aqui; o diff vem
depois, em pedaços pequenos. Quem discordar, discorde deste arquivo antes de
discordar do código.

---

## 1. O que a tela responde, em uma frase

> **Quem está esperando por mim agora — e, se ninguém está, o negócio andou?**

Nessa ordem, e a ordem é a decisão inteira. Tudo que não ajuda a responder isso
sai da primeira tela, mesmo que seja verdadeiro, bonito e caro de calcular.

---

## 2. A pesquisa, e o que ela decidiu

### 2.1 Home de operação não é relatório. É fila.

Intercom, Front, Zendesk, Chatwoot e Crisp convergiram na mesma forma, e não por
moda: a tela de abertura de um produto de atendimento é **uma lista de conversas
que precisam de gente**, com contadores no topo servindo de filtro, não de
painel. O relatório existe, mas mora numa aba separada, visitada por semana ou
por mês — e por quem cobra, não por quem atende.

Linear e Stripe chegam ao mesmo lugar por outro caminho: a home é "o que está
atribuído a você / o que exige ação", e o gráfico é a segunda tela.

O Painel de hoje fez o oposto: cinco blocos de medida e nenhuma lista. Ele conta
o mês para alguém que abriu o navegador querendo saber a próxima meia hora.

**Decisão: o Painel vira fila com placar em cima, não placar com gráfico
embaixo.**

### 2.2 Quais métricas o mercado acompanha de verdade

| Métrica | Vale? | Por quê |
|---|---|---|
| Tempo até a primeira resposta (FRT) | **sim** | é a que mais correlaciona com satisfação, e a única cujo valor de referência existe publicado; é também a única que o dono consegue mudar mudando escala |
| Fila esperando pessoa **agora** | **sim** | não é métrica, é trabalho; muda decisão no minuto |
| Conversas sem dono | **sim** | trabalho que ninguém pegou é o defeito mais barato de corrigir |
| Taxa de contenção do bot | **sim, com base** | "26%" sozinho não é nada; "26% de 412, contra 31% de 380" é |
| Tempo até resolver | com ressalva | some fila esquecida dentro de mediana; fica, compacto, com mediana **e** média |
| Negócio ganho/perdido e valor | **sim** (novo) | é o único número que o dono do negócio, não o atendente, abre a tela para ver |
| Total de mensagens | **não** | vaidade clássica: sobe quando o bot fala demais e quando o cliente está confuso |
| Conversas por dia, em gráfico | **não** | responde "houve movimento?", pergunta que ninguém tinha |
| CSAT | não ainda | não há coleta; métrica sem fonte é cartão vazio |

### 2.3 Ação rápida: onde

O padrão que funciona não é botão no cabeçalho — é **a própria linha da fila ser
o botão**. Front e Intercom levam direto à conversa; a ação secundária (atribuir,
adiar) aparece na linha, não num menu. Um "Nova conversa" no topo é útil e raro,
então fica discreto, à direita do título.

### 2.4 O estado vazio

Literatura sólida (Stripe, Shopify setup guide, Linear): checklist ajuda quando
tem **três a cinco passos**, cada um levando a uma tela concreta, com progresso
visível — e infantiliza quando lista o óbvio, se repete depois de pronto ou fica
para sempre. O checklist deve **morrer sozinho**, sem alguém precisar fechá-lo.

Aqui os passos já existem, escritos na lógica do bloco `Atendimento` de hoje:
desenhar automação → publicar → conectar número → apontar número para a
automação. São quatro, e a quarta é consequência da terceira, então viram três na
tela, com a quarta aparecendo só quando é o que falta.

**O checklist morre quando a conta recebe a primeira conversa de verdade.** Não
quando os passos terminam — porque terminar a configuração e ninguém escrever é
exatamente o momento em que a pessoa mais precisa ver "está no ar, aguardando a
primeira mensagem".

### 2.5 Por que dashboard de IA parece dashboard de IA

Levantado porque é o pedido do dono, e porque a resposta escrita é o que impede
de repetir:

1. **Fileira de quatro cartões iguais.** Quatro números sem hierarquia dizem que
   nenhum importa mais que os outros — o que é sempre mentira.
2. **Gráfico sem pergunta.** A série diária existe porque série diária é o que se
   desenha, não porque alguém queria saber a forma do mês.
3. **Porcentagem sem base.** "26%" sem o denominador e sem o mês passado.
4. **Cor de enfeite.** Verde/âmbar/rosa por decoração, e não por estado.
5. **Rótulo em caixa alta acima de tudo.** Etiqueta em toda seção vira ruído.
6. **Tudo é cartão.** Cartão dentro de cartão, mesmo raio, mesma sombra, mesmo
   peso — a página inteira com a mesma voz.

O Painel de hoje comete 1, 2, 3, 5 e 6. O redesenho corrige os seis: **uma
hierarquia (fila), um lugar com peso visual (a linha de estado), o resto quieto.**

---

## 3. O que entra, o que fica, o que morre

| Bloco de hoje | Destino |
|---|---|
| `Atendimento` (as três condições) | **fica**, vira faixa fina no topo — princípio intacto, cartão a menos |
| `Funil` (mês atual × anterior) | **fica**, comprimido em uma linha de placar, com base e comparação |
| `Tempos` | **fica**, comprimido; continua sumindo quando ninguém entrou na fila |
| série diária (`GraficoDaSerie`) | **morre no Painel** — §2.2; o componente e `serieDiaria` continuam existindo para quando houver a tela de relatório |
| `Pessoas` | **desce** para o fim e só aparece com duas ou mais pessoas atendendo: com uma, é a própria pessoa lendo o próprio volume |
| `FichaDoCliente` | **sai da primeira tela** para `/ajustes/cadastro` (rota nova, arquivo novo — ver §6) |
| — | **entra: a fila "Precisa de você"** |
| — | **entra: fechamentos e valor** (0058), quando existir quadro |
| — | **entra: o checklist de estreia**, no lugar da fila, enquanto não há conversa |

---

## 4. Os dois estados

**Vazio** (conta sem nenhuma conversa recebida):

```
┌────────────────────────────────────────────────────────┐
│ ● Ainda não está atendendo                             │
├────────────────────────────────────────────────────────┤
│ Faltam três coisas para o WhatsApp responder sozinho   │
│                                                        │
│ ✓ 1  Desenhar a automação            [ver]             │
│ ○ 2  Publicar a automação            [publicar →]      │
│ ○ 3  Conectar o número               [conectar →]      │
│                                                        │
│ 1 de 3 prontos                                         │
└────────────────────────────────────────────────────────┘
```

**Cheio**:

```
● Atendendo no WhatsApp · 2 automações no ar · 1 número        [Novo contato]
┌────────────────────────────────────────────────────────┐
│ Precisa de você                                   4    │
│                                                        │
│ Marina Alves      pediu uma pessoa      há 12 min   →  │
│ (11) 99312-8877   esperando resposta    há 1h20     →  │
│ Rafael Lima       esperando resposta    há 3 dias   →  │
│ Júlia Prado       esperando resposta    há 5 dias   →  │
│                                       ver os 4 na fila │
└────────────────────────────────────────────────────────┘

Este mês  412 conversas · bot resolveu 26% (mês passado 31%) · 1ª resposta 8 min
Fechamentos (30 dias)  7 ganhos · R$ 12.400 · 3 perdidos
Quem atendeu  …                          (só com duas pessoas ou mais)
```

A troca é **a fila virar checklist e nada mais**: mesma moldura, mesma posição,
mesmo peso. Conta nova, conta com um contato e conta com mil têm a mesma forma —
é a lista que enche.

---

## 5. De onde sai cada número

| Dado | Fonte | Existe? |
|---|---|---|
| automações publicadas, números, número apontando | `listarFluxos` + `listarCanais` | sim, hoje |
| quem pediu pessoa | `leads.handoff_em` (`contarEsperandoPessoa`, `listarAlertasDeHandoff`) | sim |
| a quem se está devendo resposta | `leads` com `estado_efetivo = 'aberta'` e `ultima_direcao = 'entrada'`, ordenado pela mais antiga | **consulta nova**, `repos/painel.ts` |
| conversas, contenção, mês anterior | `medirFunil` | sim |
| tempo até a primeira resposta | `medirTempos` | sim |
| ganhos, perdidos e valor em 30 dias | `quadro_cartoes` (`situacao`, `valor`, `fechado_em`, `client_id`) | **consulta nova**, `repos/painel.ts` |
| quem atendeu | `medirPessoas` | sim |

As consultas novas moram em **`src/server/repos/painel.ts`**, arquivo novo, para
não disputar `repos/crm.ts` nem `repos/metricas.ts` com os outros dois agentes.

Custo, que é a regra 5 do handoff: a fila são duas leituras com `limit 6` sobre
índice existente, mais duas contagens `head: true`; os fechamentos são uma
leitura filtrada por `client_id` e janela de data. Cada bloco mantém o `Suspense`
próprio. Nenhuma migration é necessária — **este plano não pede nada ao banco de
produção.**

---

## 6. O que decidi **não** mostrar

Vale tanto quanto a lista do que entra:

- **Total de mensagens** — sobe quando o atendimento vai mal.
- **Série diária** — forma sem pergunta.
- **"Satisfação"** — não há coleta; inventar seria pior que omitir.
- **Tempo médio sozinho** — esconde a conversa esquecida no fim de semana. Sempre
  mediana e média juntas, como já é hoje.
- **Percentual sem base** — nenhum "%" aparece sem o denominador e sem o mês
  anterior ao lado.
- **Valor de funil aberto ("pipeline")** — soma de negócio que ainda não fechou é
  o número mais enganoso do CRM: cresce quando ninguém arquiva o que morreu. Só
  entra o que **fechou**, ganho ou perdido.
- **Estágio do contato em contagem** (`contacts.estagio`, 0058) — enquanto o
  estágio muda sozinho a partir dos fatos, a distribuição dele é consequência,
  não decisão. Ele é ótimo no filtro de Contatos e no cartão; na home seria mais
  um cartão de número.

---

## 7. O `FichaDoCliente`, e o combinado com os outros agentes

Cadastro e logo são configuração. Vão para **`/ajustes/cadastro`**, arquivo novo
(`src/app/clientes/[clienteId]/ajustes/cadastro/page.tsx`), que apenas monta o
componente já existente — `src/components/cliente/ficha.tsx` **não é tocado**.

Ao agente de Configurações fica **uma linha**: acrescentar "Cadastro do negócio"
no índice de `/ajustes`. Enquanto ela não existir, o caminho é o link na faixa de
estado do Painel, e nada fica órfão.

## 8. Ordem dos deploys

1. **A fila e o checklist** — `repos/painel.ts`, o novo `page.tsx`, a série
   morre, a ficha muda de rota. É a entrega que muda a tela.
2. **Fechamentos e valor** — depende do quadro existir; some sozinho quando não
   existe.
3. **Acabamento** — "Quem atendeu" só com dois, contagens do topo clicáveis para
   o Inbox já filtrado.
