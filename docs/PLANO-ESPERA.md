# Plano da espera — o que fazer enquanto a Meta analisa

Escrito em **06/set/2026**, no dia em que a única coisa que falta para vender no
número do cliente é a aprovação da Meta — enviada em 04/set, prazo real de 3 a 5
semanas (o painel diz 20 dias; os tópicos do fórum oficial da Meta se chamam
"stuck 22+ days" e "20+ days", e não há canal de escalonamento).

Este plano não inventa fase nova. Ele **escolhe**, entre o que já está escrito em
[PLANO-PRODUTO.md](PLANO-PRODUTO.md), [PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md)
e [HANDOFF.md](HANDOFF.md), o que faz sentido fazer numa janela de três a cinco
semanas em que **nenhum cliente novo pode ser embarcado**.

---

## 0. Correção: o Kanban existe, e faz mais do que se pediu

**A primeira versão deste plano abriu com uma pergunta errada.** Ela dizia que
não havia Kanban no código e propunha decidir se deveríamos ter um. Estava
errado, e o erro foi de busca: procurei por `*kanban*` no nome do arquivo, e no
código a coisa se chama **quadros**.

O que existe, conferido arquivo a arquivo em 06/set:

| Camada | Onde |
|---|---|
| Motor puro | `src/core/quadros.ts` — até 8 etapas, ordenação estável, "parado há quanto tempo" |
| Persistência | `src/server/repos/quadros.ts` |
| Tela | `/clientes/[clienteId]/quadros` + `src/components/quadros/quadro.tsx` (745 linhas) |
| Banco | migrations `0032`–`0035` |
| Testes | `src/core/quadros.test.ts` e `src/server/repos/quadros.test.ts` |

A tela já tem **arrastar e soltar**, criar/renomear/apagar/reordenar etapa,
busca com respiro e adicionar contatos em lote.

**Mas o automático não acontece na prática, e o dono está certo: hoje é clicar e
puxar.** A peça existe e não vem montada. São dois buracos, e o segundo é o que
dói:

**a) O cartão não nasce.** Quando chega mensagem de um contato novo, ninguém
chama `porNoQuadro`. As duas únicas chamadas estão em `acoes.ts` (a tela) e o
`porContatoNaEtapa` do webhook **move** quem já é cartão — não cria. Contato que
nunca foi adicionado à mão simplesmente não aparece no quadro. É a causa direta
do "o lead não vai automático".

**b) Mover exige o bloco desenhado.** O bloco `etapa` existe no editor e o motor
o executa (`executar.ts:530` → `mover_etapa` → `receber-mensagem.ts:1031`), mas
só age se alguém tiver **arrastado o bloco para dentro do fluxo** e escolhido
quadro e coluna. Fluxo que ninguém equipou nunca move nada.

O que está escrito está bem escrito — quadro sumido vira log e a conversa segue,
porque versão publicada é imutável e etapa é estado vivo; e `etapa_alcancada` é
um dos três eventos que inscrevem em sequência (0034). **O que falta é o
padrão**: o quadro deveria se manter sozinho sem exigir que cada cliente monte a
fiação.

### A correção: entrar no quadro é o padrão, não uma tarefa

1. **Contato novo entra na primeira etapa sozinho**, no mesmo ponto em que o
   contato é criado no `receber-mensagem`. Se o cliente tem quadro, o lead
   aparece nele — sem bloco, sem configuração. Falhar aqui não pode derrubar a
   mensagem: mesmo tratamento do `mover_etapa`, log e segue.
2. **Uma etapa marcada como destino de handoff.** Quando o fluxo transfere para
   humano (`transferir_humano`, que já existe), o cartão anda. É o movimento que
   todo negócio quer e que ninguém deveria precisar desenhar.
3. **O bloco `etapa` continua existindo** para quem quer controle fino. Ele passa
   a ser o ajuste, não o requisito.

Isso é o que transforma o quadro de "tela que eu mantenho" em "tela que me
conta o que está acontecendo" — que é a diferença que o dono descreveu quando
falou do funcionário que vai mexendo sozinho.

**Consequência para a fronteira do dado:** a decisão que este plano apresentava
como aberta **já foi tomada**, e foi na direção que ele ia recomendar. O §8 do
[PLANO-PRODUTO.md](PLANO-PRODUTO.md) ("Kanban / CRM — outro produto") é de
17/ago; os quadros vieram depois e o superaram. As colunas descrevem
**atendimento**, não venda — `ETAPAS_INICIAIS` é `Novo · Em conversa · Fechado`,
e o comentário do código explica por que são neutras: empty state ensina o
negócio de quem olha.

Fica valendo, porém, o que a fronteira protege: **etapa é estado de execução, e
por isso é nossa.** Valor de negócio (preço fechado, contrato, histórico de
compra) continua sendo do sistema do cliente — ver [[fronteira-dado-autofluxos]].

---

## 1. O que NÃO fazer nesta janela

- **Não mexer no que o revisor da Meta vai abrir.** O login
  `revisor.meta@4yu.com.br` é dono do `Estúdio de exemplo`, e o revisor vai
  seguir o passo a passo escrito na justificativa de cada permissão: entrar,
  abrir Clientes → Estúdio de exemplo, conectar, abrir o Inbox. **Mudar o
  caminho dessas telas durante a análise é reprovar por conta própria.**
  Consequência direta: a reforma do painel direito do Inbox (item 3) é a única
  mudança de UI desta lista que toca o caminho do revisor — e ela é aditiva
  (esconder é reversível), nunca uma mudança de rota ou de nome de menu.
- **Não trocar a senha do revisor ainda.** Está no `.env` e no formulário da
  Meta. Só depois da aprovação.
- **Não ligar `instagram.disponivel: true`** em `canais.ts`. Continua `false` de
  propósito até o Advanced Access sair.
- **Não abrir frente nova de canal** (SMS, Telegram, e-mail). Nada disso tem
  cliente pedindo, e cada canal novo é superfície que ninguém está testando.

---

## 2. Segurança — o medo do dono, respondido com o que já existe

> *"meu medo é ficar muito fácil de ser hackeado, e as pessoas perderem dinheiro"*

O medo é legítimo, e a resposta honesta é: **este projeto está acima da média em
segurança, e a maior parte do trabalho já foi feita.** Sete dos nove blocos do
[PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md) estão fechados: CI, corrida de
sessão, portas abertas, escrita cruzada, rollback, observabilidade e sessão do
painel. A `0041` fechou os grants públicos que 13 dos 42 objetos herdaram do
default do Supabase, e a `0042` devolveu a auditoria a append-only.

**O nome que o dono não lembrava é OWASP** — especificamente o *OWASP Top 10* e
o *ASVS* (Application Security Verification Standard). É a referência de boas
práticas que ele procurava. Não é preciso adotar o ASVS inteiro; ele serve como
checklist de auditoria.

### 2.1 O que ainda merece atenção — nesta ordem

| # | O quê | Por que importa | Tamanho |
|---|---|---|---|
| 1 | **Auditoria OWASP Top 10 escrita** | Hoje a segurança está boa **e espalhada**. Uma passada explícita pelos 10 itens, com o veredito de cada um e a evidência, transforma "acho que está seguro" em documento. É também o que um cliente maior vai pedir | 1 rodada |
| 2 | **Bloco 8 — leads que aguentam** | Paginação, busca, CSV e **apagar (LGPD)**. O apagar é obrigação legal, não recurso. É o único bloco do endurecimento com pendência de lei | 1–2 rodadas |
| 3 | **Revisar RLS objeto a objeto** | A `0041` provou que documento não é fonte de verdade sobre grant. Conferir **no banco**, não no doc, todos os 42 objetos | 1 rodada |
| 4 | **Rate limit por conta no Inbox e nas ações** | O bloco 3 fechou as portas públicas. As ações autenticadas não têm teto: um membro com sessão válida pode martelar | meia rodada |

O item 1 é o que responde exatamente o que foi pedido, e é barato.

---

## 3. O painel direito do Inbox — a causa está localizada

> *"tem muita informação técnica na direita, código, número esquisito, e eu
> nunca vou usar aquilo"*

Achado, e é uma linha:

```ts
// src/app/clientes/[clienteId]/inbox/page.tsx:831
const campos = Object.entries(lead.campos)
```

`lead.campos` é **tudo que o fluxo coletou**, despejado sem limite, e a chave é
renderizada crua em `font-mono` (linha ~895) — ou seja, **o nome da variável do
fluxo**, que é um identificador técnico que o cliente nunca escolheu ver. Um
fluxo com 20 perguntas produz 20 blocos. É por isso que rola sem parar e parece
técnico: **é** técnico.

O mesmo diagnóstico vale para a sidebar do editor de fluxo que o dono citou —
mesma doença, tela diferente.

### A correção, sem inventar tela

1. **Rótulo em vez de chave.** O bloco de pergunta já sabe o texto que perguntou;
   guardar o rótulo junto do campo e exibir *"Qual seu objetivo?"* em vez de
   `objetivo_aluno`. Onde não houver rótulo, formatar a chave (`_` → espaço,
   capitalizar) — nunca mostrar `font-mono` cru.
2. **Teto de 4 campos + "ver mais".** O resto continua na Ficha, que já existe e
   já tem link ali do lado.
3. **Ordem por utilidade, não por ordem de coleta.** Os campos que o cliente
   configurou como importantes primeiro.
4. **Anotação da equipe sobe.** Hoje está no fim, depois do despejo de campos —
   é o que mais se usa e o que mais custa alcançar.

É mudança **aditiva e reversível** (esconder não apaga), e por isso é a única
desta lista que pode acontecer durante a análise da Meta.

---

## 4. Automação que parece gente — o que o dono descreveu

> *"no BotConversa é como se fosse um funcionário mexendo: vai colocando tags,
> escrevendo observações, qualificando a temperatura"*

Isso **não é um recurso**, são quatro, e três já têm metade construída:

| O quê | Estado hoje | O que falta |
|---|---|---|
| **Etiquetas** | Existem, e o Inbox já tem `SeletorDeEtiquetas` | O **fluxo** aplicar etiqueta sozinho — hoje é manual |
| **Anotação** | Existe (`NotaRapida`), manual | O bot escrever nota ao encerrar |
| **Etapa / quadro** | Tela completa, mas **o cartão não nasce sozinho** | Entrada automática no quadro — ver §0 |
| **Temperatura** | Não existe | Provavelmente **não deve existir** como campo: é etapa com outro nome. Ver abaixo |

**A lacuna real são as duas primeiras linhas.** O `switch` de ações do fluxo em
`receber-mensagem.ts` tem dez casos — `enviar_texto`, `enviar_midia`,
`enviar_opcoes`, `salvar_campo`, `pausar_automacao`, `mover_etapa`,
`transferir_humano`, `chamar_ia`, `chamar_http`, `encerrar` — e **nenhum deles
aplica etiqueta ou escreve nota**. Etiqueta e anotação existem só como ação
humana no Inbox.

São duas ações novas no mesmo `switch`, ao lado de `mover_etapa`, que é o molde
pronto: mesma forma, mesma regra de não derrubar a conversa quando o alvo sumiu.
É o item mais barato desta lista com efeito visível — é o que faz o bot "parecer
um funcionário mexendo".

**Sobre temperatura:** antes de criar campo, vale perguntar se ela não é a
própria etapa. Um quadro com `Novo · Aquecendo · Quente · Fechado` responde
"temperatura" sem inventar dado novo, e mantém uma coisa só para manter. Campo
separado só se o dono quiser temperatura **cruzando** etapas (um lead frio no
fim do funil), que é uma pergunta diferente.

---

## 5. Assinatura e cobrança — o que decidir antes de escolher gateway

O dono citou Pagar.me e Stone. A escolha do gateway é a **última** decisão, não
a primeira. Antes dela, três perguntas cuja resposta muda o gateway:

1. **O que é cobrado?** Assinatura mensal por conta? Por número conectado? Por
   conversa? A Meta já cobra por conversa na Cloud API — **cobrar por conversa
   em cima de um custo por conversa é a única modelagem que não quebra** quando
   um cliente cresce 10×.
2. **Quem é o titular?** Se a WABA é do cliente (que é o ponto do Tech Provider),
   a Meta cobra **ele**, não nós. Então a nossa cobrança é software, e o custo de
   mensagem é dele. Isso simplifica: assinatura pura.
3. **Pix, cartão, ou os dois?** Pix tem taxa menor e cai na hora, mas **não
   renova sozinho** — assinatura em Pix é boleto disfarçado, com inadimplência de
   quem esquece. Cartão recorrente é o que sustenta SaaS.

**Recomendação:** assinatura mensal em cartão recorrente, Pix como alternativa
para plano anual (onde a renovação manual acontece uma vez por ano e o desconto
paga o incômodo).

Sobre o gateway, com o critério que o dono deu (*"fácil de desconectar"*):

| | Taxa cartão | Pix | Observação |
|---|---|---|---|
| **Pagar.me** | ~3,79% + antecipação | ~0,99% | API boa, assinatura nativa, é da Stone |
| **Stone** | negociável | negociável | Melhor taxa **se houver volume**; sem volume, atendimento comercial |
| **Asaas** | ~2,99% | ~0,99% | Assinatura + cobrança recorrente + nota fiscal, mais barato para começar |

Como **não há cliente pagante ainda**, a taxa importa menos que sair fácil.
Qualquer um dos três serve; o que **não** pode acontecer é o dado de assinatura
morar só no gateway. A regra do [ESTADO.md](ESTADO.md) vale aqui:
*ferramenta externa pode ser destino, nunca requisito para funcionar*.

**Esta é uma decisão do dono e nada trava enquanto ela não sai** — não há cliente
pagante até a Meta aprovar.

---

## 6. Ordem sugerida para a janela

Assumindo 3 a 5 semanas e que a análise pode voltar a qualquer momento:

| Rodada | O quê | Por que aqui |
|---|---|---|
| 1 | **Decisão do item 0** (dono) + **auditoria OWASP** (código) | A decisão destrava 4; a auditoria é independente e responde o medo declarado |
| 2 | **Painel direito do Inbox** (item 3) | Barato, aditivo, e melhora a tela que o revisor abre |
| 3 | **Bloco 8 — leads que aguentam** | Fecha a pendência de LGPD, que é lei |
| 4 | **Etiqueta e nota automáticas** (item 4, metade de cima) | Não depende da decisão de fronteira |
| 5 | **Entrada automática no quadro** (§0) | É o que faz o quadro parar de exigir clique e puxar |

O item 5 da cobrança corre **em paralelo**, porque é decisão, não código.

---

## 7. O que este plano assume, e que pode estar errado

- Que a Meta aprova sem pedir nada. Se voltar pedindo, **o que ela pedir vira
  prioridade 1** e esta ordem inteira cede o lugar.
- Que o dono responde o item 0. Sem resposta, os itens 4 (metade de baixo) e 5
  ficam parados — e é melhor pararem do que serem construídos na direção errada.
- Que não aparece cliente pagante nesta janela. Se aparecer, a cobrança sobe
  para primeiro lugar.
