# Plano de 16/set: o preço, a IA regularizada, e o que falta para cobrar

Escrito depois de uma conversa inteira de levantamento, em que quatro leituras
independentes do mercado e um inventário do repositório responderam perguntas
que estavam abertas há semanas. Este documento existe para **a conversa não
precisar acontecer de novo**.

Continua de `14ccec6`. A próxima migration é a **0066** (conferido no diretório,
nunca em documento, inclusive neste).

---

## O que ficou decidido, e o que continua em aberto

### Decidido: a unidade de cobrança

**Por faixa de conversa, com atendentes ilimitados.** Quatro leituras de mercado
chegaram à mesma conclusão por caminhos diferentes, e a razão que convence não é
estatística, é estrutural: **o AutoFluxos existe para o cliente precisar de menos
gente atendendo.** Cobrar por atendente é cobrar pela métrica que o produto
promete reduzir, e o cliente percebe.

O andar de baixo do mercado brasileiro já foi por aí. Nexloo, SURI e Blip Go dão
atendentes ilimitados e cobram por conversa. Quem ainda cobra por assento (Poli,
Umbler, Kommo) é a exceção, não a regra.

Consequência prática, e é uma correção ao site: **a tabela de preços hoje se
contradiz.** O título diz *"sem cobrar por atendente"* e a letra miúda limita a
3 e 10 usuários (`src/app/page.tsx:417` e `:432`). Os dois não podem coexistir.

### Decidido: a faixa

| Plano | Preço | O que separa |
|---|---|---|
| Essencial | **R$ 297** | O produto inteiro **sem custo variável** |
| Operação | **R$ 597** | Libera o que custa dinheiro por uso |
| Escala | **R$ 1.197** | Múltiplos números e o que é caro de suportar |

**O eixo é custo, não recurso.** Recurso barato de servir preso no plano alto só
faz o cliente pequeno achar o produto capado; recurso caro liberado no plano
baixo come a margem no primeiro cliente de volume. A divisão sai do inventário:

- **Essencial**: fluxos, Inbox inteiro, CRM e funis, etiquetas, respostas
  rápidas, horário de atendimento, importação de contatos, métricas, simulador
  com cota. Tudo isto é CPU e linha de banco: custo por cliente perto de zero.
- **Operação**: IA em conversa, transcrição de áudio, cota de transmissão e
  modelos da Meta, bloco de serviços externos, rodízio com a trava de dono.
- **Escala**: múltiplos números, coexistência, webhook de entrada, **chave de IA
  do próprio cliente**, auditoria exposta ao cliente, multiempresa.

**Sobre o R$ 197 do site:** sobe para R$ 297. Três das quatro leituras defendem
isso, e o argumento é o mesmo do parágrafo da unidade: o produto é oficial-only e
vende *"não toma ban"*. Competir em preço com quem roda QR code não ganha esse
cliente e corrói a margem no cliente que já ia comprar.

**Sobre setup:** zero. Cobrar setup é maioria no Brasil (Poli R$ 1.197, RD
R$ 1.999, SURI R$ 590), mas o repositório construiu um SaaS self-serve — cadastro
aberto, primeiro acesso, checklist de cinco passos. Pedágio de entrada em cima
disso é atrito na largada. O `R$ 1.800 + R$ 700/mês` registrado em
`docs/ESTADO.md:501` é **preço de agência**, vende hora e não escala: vira
serviço opcional de implantação para quem pedir, não tabela paralela do mesmo
produto.

### Decidido: o custo da Meta é repassado a custo

Sem markup, em linha separada e visível. Num mercado onde SURI, Zenvia e
Botconversa escondem markup dentro de "créditos" (a Zenvia chega a cobrar
R$ 0,069 por mensagem de serviço, **que a Meta entrega de graça**), repassar a
custo é diferenciação real e custa zero para entregar. É a mesma venda do
"não toma ban": honestidade estrutural.

O desenho mais limpo já estava previsto em `docs/ESTADO.md`: com o WABA no nome
do cliente via Embedded Signup, **a Meta cobra ele direto** e nós não tocamos no
dinheiro.

### Em aberto, e não é opinião: dois números da Meta

Nenhuma das quatro leituras conseguiu confirmar, e **nenhuma tabela deve ser
publicada antes disto**:

1. **O rate card em BRL.** A Meta serve CSV/PDF atrás de link e seletor em
   JavaScript, inalcançável por fetch. As fontes de terceiros divergem **6 vezes**
   em utilidade. Está em Business Manager → WhatsApp Manager → Preços. Meia hora.
2. **Se atendimento passa a ser pago em 1/out/2026.** A busca dentro do domínio
   da Meta devolve que os rate cards de outubro *"incluem service rates"*, e as
   páginas de documentação que dá para ler ainda dizem que serviço é grátis. Não
   deu para fechar a contradição. Se confirmar, entra uma franquia de **1.000
   mensagens de serviço por número, sem acúmulo** — e aí a faixa de entrada
   precisa nascer alinhada a essa franquia, não por acaso.

É o mesmo padrão do contêiner GTM errado: o console diz uma coisa, a fatura diz
outra. Conferir na conta real.

**Confirmado e a nosso favor:** a janela de **72h grátis do Click-to-WhatsApp**
continua de pé. Se o resto ficar pago, ela vale mais.

### Correções ao `docs/CONCORRENTES-15-SET.md`

Três números daquele documento não se sustentaram na conferência em página
oficial:

- O piso de oficial **não é R$ 270**: o SURI Lite daquele preço **não tem
  WhatsApp**. O piso é o Premium, **R$ 290**.
- **Botconversa R$ 189 não tem API oficial.** O plano com oficial é o Pro,
  R$ 199 no anual.
- **Kommo subiu para US$ 25–45** por usuário, com trava de 6 meses.

---

## O trabalho, em ordem

A ordem não é por tamanho, é por risco. O primeiro item é o único que tem
consequência fora do código.

### 1. A IA está rodando no free tier do Google, com dado de cliente real

**É o item mais urgente deste documento, e não é sobre margem.**

`src/server/ia/modelo.ts` escolhe o modelo e devolve `dono: '4yu' | 'cliente'`,
mas hoje só existe um caminho: a chave da 4YU, no free tier. **No free tier o
Google treina modelo com o que passa, inclusive com revisão humana.** Conversa de
paciente de estúdio de pilates e de lead de imobiliária está nesse caminho.

O código já previu a saída: `clients.ia_chave_ref` aponta para o Supabase Vault,
o tipo já distingue dono, e o cofre de chaves já existe inteiro
(`src/server/repos/conexoes.ts`, com o valor entrando e nunca saindo). **Falta
ligar as pontas.**

Resolve duas coisas de uma vez: tira o produto da irregularidade e vira feature
de plano alto — *"sua chave, seu dado, não vai para treino"*, que ninguém no
Brasil oferece.

**Pronto quando:** uma conta com chave própria gravada no Vault usa essa chave, a
tela mostra de quem é a chave em uso, e uma conta sem chave continua funcionando
como hoje.

### 2. A tela que lê o NPS

O bloco de Pesquisa de satisfação pergunta a nota, `repos/avaliacoes.ts` grava
com data própria, a migration `0060` está inteira em produção. **E nenhuma tela
lê.** O grep por `listarAvaliacoes` fora do próprio repositório devolve zero.

Hoje o dado entra e ninguém consegue ver. É a melhor razão esforço/valor do
repositório: custo de servir zero, e fecha o ciclo do painel.

**Pronto quando:** existe tela com a média, a distribuição entre promotor, neutro
e detrator, e a lista dos comentários com data e nome.

### 3. A tabela do site deixa de se contradizer

Trocar a franquia de 3 e 10 usuários por **atendentes ilimitados** nos três
planos. É o único ponto da decisão de preço que **não depende dos dois números
pendentes da Meta**, porque não é preço: é coerência entre o título e a lista.

O preço em si (R$ 297 / 597 / 1.197) **não sobe ao site** sem o rate card.

### 4. Medição de consumo

Não existe nada de plano no repositório: sem coluna de plano em `clients`, sem
contador de consumo, sem trava. `src/server/limite.ts` é rate-limit por IP, para
abuso, não para cobrança.

Vender três planos exige medir **conversa, chamada de IA e storage** por conta.
Medir vem antes de cobrar, e **medir sem travar vem antes de travar**: um mês de
número real diz se as faixas de 1.000 / 3.000 / 8.000 fazem sentido, e ninguém
descobre isso por dedução.

**Não começa antes do item 1**, porque a chave de IA por cliente muda o que
precisa ser medido (chamada na nossa chave custa a nós; na chave do cliente, não).

### 5. O bot que não volta

Levantado na conversa e continua valendo: **nada tira uma conversa do estado
`humano` sozinho.** Só o clique em "Já atendi" (`repos/conversas.ts`, que faz
`status='encerrada' where status='humano'`). O consultor atende, esquece de
fechar, e aquele contato fica com o bot mudo para sempre — sem erro nenhum para
investigar.

O desenho combinado: a conta configura *"conversa parada em atendimento humano há
N horas volta para o bot"*, com aviso antes, e **nunca** voltando se o atendente
falou há pouco. A infraestrutura de tarefas agendadas já existe
(`src/core/tarefas.ts`), então é regra nova, não mecanismo novo.

Fica depois do item 4 por ser o único desta lista que mexe em conversa viva de
produção.

---

## O que foi feito nesta rodada

**`14ccec6` — o diário do lead.** A queixa era *"não tem cheiro de CRM"*: a ficha
tinha sete blocos empilhados e nenhum lugar para escrever o que foi acontecendo,
porque `contacts.notas` é campo único e sobrescreve.

Não precisou de migration. `eventos_do_contato` já guardava fato com autor e hora
desde a 0058, `'nota'` já estava no enum e `comoFrase` já sabia lê-la: faltava
quem escrevesse.

Os dois campos continuam existindo porque respondem perguntas diferentes. A
Anotação responde *"o que preciso saber antes de falar com esta pessoa"* e por
isso é sobrescrita. O diário responde *"o que aconteceu, e quando"*, e por isso
nunca é reescrito.

---

## O que continua sem prova, e não saiu desta lista

Registrado porque some se não for escrito, e porque **recurso novo não conserta
recurso não provado**:

- **A distribuição nunca distribuiu em produção.** Nenhuma conta está em
  `balanceado`, então `escolherAtendente` nunca escolheu ninguém fora de teste.
- **Nenhuma foto saiu pela Cloud API real.**
- **Nada do caminho de modelo ou transmissão falou com um número real.**
- **O diário do lead não foi clicado no navegador.** Typecheck, build e 979
  testes de `src/core` passam, e nenhum deles é sobre o que a pessoa vê.

---

## Duas coisas que economizam tempo de quem continuar

- **A numeração da próxima migration sai do disco.** `ls supabase/migrations/ |
  tail -1`. Este parágrafo já esteve errado três vezes em outros arquivos, sempre
  porque alguém confiou no número escrito.
- **Travessão é proibido** em texto de tela, comentário e nome de teste. Cada
  arquivo aberto sai sem, inclusive os que já tinham.
