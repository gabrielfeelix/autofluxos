# Handoff de 16/set: os planos, a medição e a assinatura

Continua de `045842b`. Escrito para quem vai executar, depois de uma rodada que
fechou três itens e deixou o resto desenhado.

**A próxima migration sai do disco.** Rode `ls supabase/migrations/ | tail -1`
antes de escrever a sua, e não confie em número escrito em documento: este
parágrafo já esteve errado em três arquivos deste repositório, sempre porque
alguém confiou no que estava escrito. A `0066` já foi aplicada em produção, e o
que ela fez está em `BANCO-COMPARTILHADO.md`.

---

## O que mudou depois que este handoff foi escrito (16/set, mesma data)

**Os itens 1, 2 e 3 abaixo estão feitos.** Ficam escritos como estavam, porque a
razão de cada decisão continua valendo e é o que explica o código. O que mudou:

| Commit | O quê |
|---|---|
| `2b846ac` | item 1: os três planos, e `core/planos.ts` como único lugar onde preço existe |
| `daf73e1` | a `0066` aplicada em produção: `clients.plano`, as colunas do gateway, e as duas views de consumo |
| `e694d50` | item 2: `repos/plano.ts` e a tela `/admin/consumo` |
| `e658bf3` | item 3: `Configurações → Plano e consumo`, com o botão que pede a troca |

**Nada disso foi ao ar.** O preço não sobe ao site sem o rate card da Meta, que
continua sendo o portão descrito abaixo, e o deploy não foi feito.

**Três coisas que quem continuar precisa saber, e que só apareceram fazendo:**

1. **A medição de IA por dono da chave não foi feita, e não é esquecimento: não
   existe fonte de dado.** `ia_chamadas` (0038) não tem coluna de dono e registra
   **chamada de ferramenta**, não inferência: uma conversa com IA que não use
   ferramenta nenhuma não gera linha lá. E `escolherModelo` calcula
   `dono: '4yu' | 'cliente'` e o descarta em `receber-mensagem.ts:1112`, que faz
   `const { modelo } = ...`. Medir isso é migration nova (coluna `dono` em
   `ia_chamadas`, ou tabela de inferências) mais gravação no ponto de uso. Foi
   deixado de fora de propósito em vez de improvisado.

2. **O storage medido é só o dos recebidos.** O acervo mora em `storage.objects`
   sem tabela espelho, e a pasta é o `clienteId` (`repos/acervo.ts`, com
   `limit: 200` no `list`). A tela `/admin/consumo` diz isso em texto, para
   ninguém somar os dois números e achar que o disco encolheu.

3. **A regra do disparo já exclui gente no dado de hoje.** Na produção, 33
   contatos têm mensagem, **23 são bidirecionais e 1 é só saída**. Quem trocar a
   definição de conversa por "contato com mensagem" passa a cobrar esse um.

**O que continua valendo da lista abaixo:** o item 4 (o gateway) e o item 5 (o
bot que não volta do atendimento humano), inteiros, e o portão dos dois números
da Meta antes de qualquer preço ir ao ar.

---

## Comece por aqui

1. **`AGENTS.md`** na raiz. Curto, e tem a regra que mais custa quebrar: o
   Supabase de produção é dividido com outro produto (Verandi), e `supabase db
   push` e `db reset` são proibidos contra ele.
2. **`docs/BANCO-COMPARTILHADO.md`**, inteiro, antes de qualquer coisa que toque
   banco, migration, Auth, RLS, Storage ou Data API.
3. **`docs/PLANO-16-SET-PRODUTO-E-PRECO.md`**: a decisão de preço, por que ela é
   essa, e o que ficou em aberto. **É o documento que explica o porquê de tudo
   aqui.**
4. Este arquivo, para saber o que fazer.

```bash
npx vitest run src/core src/channels    # os puros, rápidos
npx tsc --noEmit | grep -v "^\.next/"
npx next build
ls supabase/migrations/ | tail -1
```

A suíte inteira demora e alguns testes de `src/server/repos/*` estouram por
timeout quando duas sessões falam com o Supabase ao mesmo tempo. Isso é
concorrência, não regressão.

**Travessão é proibido** em texto de tela, comentário, commit e documento. Cada
arquivo que você abrir sai sem, inclusive os que já tinham.

**Não aplique migration em produção sem autorização explícita do dono.**

---

## O que já está pronto, e que você vai usar

| Commit | O quê |
|---|---|
| `14ccec6` | diário do lead: anotação com autor e hora, em `eventos_do_contato` |
| `d1bc123` | chave de IA do próprio cliente, no Vault, com a nossa como rede |
| `1ef4e42` | tela de NPS no painel, em `core/nps.ts` + `Satisfacao` |
| `045842b` | a tabela do site parou de prometer o que não cumpria |

**Nada disso foi clicado no navegador.** Typecheck, build e 1072 testes passam, e
nenhum deles é sobre o que a pessoa vê.

Duas peças existentes que o trabalho abaixo depende:

- **`server/cofre.ts`**: guardar, ler e apagar segredo no Supabase Vault. Saiu
  de dentro de `repos/conexoes.ts` no `d1bc123`. É onde a credencial do gateway
  vai morar.
- **`repos/chave-de-ia.ts`**: o padrão de "referência no banco, valor no cofre,
  e nenhuma função devolve o valor para a tela". **Copie esse desenho** para o
  que for segredo do gateway.

---

## A decisão de preço, em três linhas

Cobrança **por faixa de conversa, com atendentes ilimitados**. Faixas: **R$ 297 /
R$ 597 / R$ 1.197**. O custo da Meta é **repassado a custo**, em linha separada,
sem markup. IA inclusa, com a chave própria do cliente como válvula no plano
alto. Setup zero.

O eixo que separa os planos é **custo, não recurso**: o que é software puro vai
em todos, o que custa dinheiro por uso sobe de plano. `PLANO-16-SET` tem a
divisão item a item.

⚠️ **Nenhum preço sobe ao site antes de dois números que ninguém tem:**

1. **O rate card da Meta em BRL** (Business Manager → WhatsApp Manager → Preços).
   As fontes de terceiros divergem **6 vezes** em utilidade. Sem ele não dá para
   saber a margem de faixa nenhuma.
2. **Se atendimento passa a ser pago em 1/out/2026.** Se passar, entra franquia
   de **1.000 mensagens de serviço por número, sem acúmulo**, e a faixa de
   entrada precisa nascer alinhada a ela.

**Os dois são do dono.** Não invente número para destravar o trabalho: construa
o que não depende deles, e deixe o preço parametrizável.

---

## O trabalho, em ordem

A ordem importa. Cada item usa o anterior, e o primeiro é o único que não
depende de decisão nenhuma.

### 1. Os cards de plano na landing page

**O mais simples, e o único que dá para terminar hoje.**

`src/app/page.tsx`, por volta da linha 408. Hoje são três cards
(`Essencial 197`, `Operação 397`, `Sob medida` sem preço) e o componente `Plano`
já existe na mesma pasta.

O que muda:
- Três planos com preço: **Essencial R$ 297**, **Operação R$ 597**,
  **Escala R$ 1.197**. O "Sob medida" sem preço sai: com três faixas nomeadas,
  ele vira uma quarta coluna que não vende nada.
- Cada card diz **quantas conversas** cabem, porque a unidade é conversa e o
  cliente precisa saber o que está comprando.
- A linha do custo da Meta **aparece no card**, não numa nota de rodapé: *"a
  tarifa da Meta vem à parte, pelo valor que a Meta cobra"*. É diferenciação real
  contra quem esconde markup dentro de "créditos", e esconder isso no rodapé
  desperdiça o argumento.
- `Atendentes ilimitados` já está nos três desde `045842b`. Não volte atrás.

**Cuidado:** o preço fica **num só lugar no código**, e a tela lê de lá. No item
3 o sistema vai precisar dos mesmos números, e duas listas de preço é como o site
passa a anunciar o que o sistema não cobra.

**Pronto quando:** os três cards mostram preço, conversas e a linha da Meta, e o
número do preço existe uma vez só no repositório.

### 2. Medir consumo, sem travar nada

**Não existe nada disto hoje.** Sem coluna de plano em `clients`, sem contador,
sem trava. `src/server/limite.ts` é rate-limit por IP, para abuso, e não serve
para cobrança.

**Medir vem antes de cobrar, e medir sem travar vem antes de travar.** Um mês de
número real diz se as faixas fazem sentido; ninguém descobre isso por dedução. Se
você travar junto com a primeira medição, o primeiro erro de contagem vira
cliente sem atender.

O que medir, por conta e por mês:

| Medida | De onde sai | Por que importa |
|---|---|---|
| **Conversas** | `messages` / `contacts`, por contato único com entrada e saída no mês | É a unidade da cobrança |
| **Chamadas de IA** | `ia_chamadas` (0038) já grava cada uma | É custo nosso **só quando a chave é da 4YU** |
| **Storage** | buckets do acervo e dos recebidos | Cresce e nunca encolhe sozinho |

**A definição de conversa é a decisão mais importante desta etapa**, e o mercado
já a padronizou: **interação bidirecional**. Broadcast enviado e não respondido
**não conta**. Wati, Respond.io e SleekFlow escrevem a mesma regra, e a razão é
prática: se o disparo contar, a conta do cliente explode no mês de campanha, que
é justamente quando ele mais precisa da ferramenta. Escreva isso na tabela de
preços, não no contrato.

A chamada de IA só é custo nosso quando roda na **nossa** chave. Depois do
`d1bc123`, `escolherModelo` devolve `dono: '4yu' | 'cliente'`, e meça os dois
separados, senão o cliente que paga a própria chave aparece como o mais caro.

**Pronto quando:** existe uma tela (pode ser em `/admin`) que mostra, por conta e
por mês, conversas, chamadas de IA por dono da chave, e storage. **E nada é
bloqueado por causa desses números.**

### 3. O plano dentro do sistema, e a tela de assinatura

Agora sim a conta sabe em que plano está.

**Banco (migration `0066`):** `clients.plano` com default no plano de entrada, e
o que o gateway precisar guardar depois (id do cliente lá, id da assinatura,
estado). **Aditiva, com default válido em toda linha**, que é o que torna seguro
mexer numa tabela com dado de produção. Veja a `0064` como modelo: ela fez
exatamente isso e está documentada em `BANCO-COMPARTILHADO.md`.

**Tela:** em **Configurações → grupo Conta**, ao lado de "Dados do negócio" e
"Equipe" (`src/app/clientes/[clienteId]/ajustes/page.tsx`, por volta da linha
290). É onde o dono já vai mexer em conta, e é onde ele vai procurar.

A tela mostra:
- **em que plano a conta está**, em palavras;
- **quanto já foi usado no mês**, contra o que o plano comporta, vindo do item
  2. Sem isso, "mudar de plano" é uma pergunta sem informação para responder;
- os três planos lado a lado, com o atual marcado;
- o botão de mudar de plano.

**O botão existe antes do gateway.** Ele pode abrir uma conversa ("fale com a
gente"), registrar a intenção, ou ficar desabilitado com o motivo escrito. O que
ele **não** pode é sumir: a tela sem botão não é metade da solução, é uma tela
que não faz nada.

**Só quem administra a conta** vê e mexe (`podeAdministrarConta`, em
`server/sessao.ts`). O padrão está em `acoes-chave-de-ia.ts`, do `d1bc123`.

**Pronto quando:** o dono abre Configurações, vê o plano, vê o consumo do mês e
consegue pedir para mudar de plano.

### 4. O gateway, quando o dono contratar

**Não comece por aqui, e não escolha o gateway sozinho**: é decisão comercial, e
o dono disse que vai contratar.

Quando vier, o que já está preparado:
- a credencial vai para o **cofre** (`server/cofre.ts`), nunca para coluna de
  texto. Copie `repos/chave-de-ia.ts`;
- o webhook de retorno entra como rota nova em `src/app/api/`. **Atenção ao
  proxy:** rota que não estiver em `PREFIXOS_ABERTOS` (`src/proxy.ts`) responde
  401 **em silêncio**, já custou tempo neste repositório, e está registrado em
  memória. Um `curl` no POST prova antes de você suspeitar do código;
- a mudança de plano passa a ser efeito do webhook, não do clique.

**A trava por plano é o último passo de todos**, e vem depois de um mês de número
real do item 2.

### 5. O bot que não volta do atendimento humano

Fica por último porque é o único que mexe em **conversa viva de produção**.

Hoje **nada tira uma conversa do estado `humano` sozinho**. Só o clique em "Já
atendi" (`repos/conversas.ts`, que faz `status='encerrada' where
status='humano'`). O consultor atende, esquece de fechar, e aquele contato fica
com o bot mudo para sempre. É a falha mais silenciosa que existe hoje: não dá
erro nenhum.

O desenho combinado com o dono: a conta configura *"conversa parada em
atendimento humano há N horas volta para o bot"*, com aviso antes, e **nunca**
voltando se o atendente falou há pouco. A infraestrutura de tarefas agendadas já
existe (`src/core/tarefas.ts`), então é regra nova, não mecanismo novo.

**Um detalhe operacional que vai te morder:** o cron da Vercel roda **uma vez por
dia** (`vercel.json`). O que faz as tarefas rodarem de verdade é a carona no
webhook (`rodarTarefas(5)` em `api/webhook/whatsapp/route.ts`). **Conta sem
tráfego só processa tarefa de madrugada**, e uma conta sem tráfego é exatamente
a que tem conversa parada esquecida. Considere isso no desenho, ou a regra vai
funcionar bem justamente onde não é necessária.

---

## O que continua sem prova, e não saiu da lista

Registrado porque some se não for escrito, e porque **recurso novo não conserta
recurso não provado**:

- **A distribuição nunca distribuiu em produção.** Nenhuma conta está em
  `balanceado`, então `escolherAtendente` nunca escolheu ninguém fora de teste.
- **Nenhuma foto saiu pela Cloud API real.**
- **Nada do caminho de modelo ou transmissão falou com um número real.**
- **Nada dos quatro commits desta rodada foi clicado no navegador.**
- **O deploy não foi feito.** O código está na `main`. Publicar é
  `npx vercel --prod --token "$VERCEL_TOKEN" --yes`, com o `.env` do
  `4yu-apps/.secrets/` carregado.

---

## Três coisas que vão economizar seu tempo

- **A numeração da próxima migration sai do disco**, nunca de documento,
  inclusive deste.
- **O Docker está indisponível nesta máquina** (integração do WSL desligada).
  Migration aditiva se prova com ensaio em transação (`begin; ...; rollback;`); a
  primeira que não for aditiva precisa do Docker de volta antes de tocar produção.
- **Console dizer que funcionou não é prova.** Vale para o GTM, para a Play, para
  a Meta e para o Supabase. Depois de aplicar, releia o objeto no banco. Está em
  `BANCO-COMPARTILHADO.md`, e cada linha de lá custou tempo de alguém.
