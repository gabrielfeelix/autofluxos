# Handoff — a primeira tela (Painel), hoje e o que ela devia ser

Para o agente que vai pegar esta frente. Leia inteiro antes de abrir código.
Você não precisa de nenhum contexto de conversa anterior.

**Há outro agente trabalhando neste mesmo repositório**, na tela de Quadros e
nos detalhes do Lead (`src/components/quadros/**`,
`src/app/clientes/[clienteId]/quadros/`, `src/app/clientes/[clienteId]/leads/[contatoId]/`,
`src/server/repos/crm.ts`). **Não encoste nesses arquivos.** Você vai querer ler
dados do funil — leia pelo repositório, não editando a tela dele. E há um
terceiro na tela de Configurações; combine antes de mexer em
`src/components/cliente/ficha.tsx`, que os dois handoffs citam.

---

## 0. O pedido, na palavra do dono

> "tá horrível esses dashboards com cara de IA, feios pra caramba."

Ele quer uma primeira tela **útil**, pensada para produto de chatbot e
atendimento: o que de fato precisa ser sabido ao abrir de manhã, botão de ação
rápida onde fizer sentido, e — isto ele frisou — **a tela funcionando bem nos
dois estados**: quando não há dado nenhum e quando há. Levantou a hipótese de um
checklist de primeiros passos no estado vazio (cadastrar automação, cadastrar
lead) e disse, com todas as letras, que **o especialista é você**: pesquise e
decida.

Não é pedido de repaginada visual. Um painel bonito que mostra os números
errados continua sendo o problema que ele descreveu.

---

## 1. O que existe hoje, exatamente

`src/app/clientes/[clienteId]/page.tsx`, 399 linhas, título **"Painel"**. Cinco
blocos empilhados, cada um num `<Suspense>` próprio:

| Bloco | O que mostra | De onde vem |
|---|---|---|
| `Atendimento` | se o bot está respondendo: precisa de fluxo publicado + número conectado + número apontando para fluxo no ar | consultas próprias |
| `Funil` | conversas, resolvidas pelo bot, esperando pessoa — mês atual contra o anterior | `medirFunil` |
| `Tempos` | até a primeira resposta, até o fechamento | `medirTempos` |
| série diária | gráfico do mês | `serieDiaria` |
| `Pessoas` | desempenho por atendente | `medirPessoas` |
| `FichaDoCliente` | **o cadastro do cliente e o logo, editáveis** | `components/cliente/ficha.tsx` |

Tudo em `src/server/repos/metricas.ts`.

**O bloco `Atendimento` é a melhor ideia que já está na tela e deve sobreviver a
qualquer redesenho.** O comentário no topo do arquivo explica: as três
condições para o bot responder moravam em três telas, e descobrir qual faltava
exigia visitar as três. Ele responde "o cliente está sendo atendido agora?"
antes de qualquer navegação, e quando a resposta é não, diz qual peça falta.
Guarde o princípio mesmo que mude a forma.

**O `FichaDoCliente` no fim é o corpo estranho.** Cadastro e logo são
configuração, e estão na primeira tela porque foi onde coube. Decidir para onde
vão é conversa com o agente de Configurações e com o dono.

### 1.1 Dado que a tela ainda não usa — e que mudou o jogo semana passada

As migrations `0057` e `0058` **já estão aplicadas em produção** e trouxeram
dado que nenhum bloco do Painel lê ainda:

- `contacts.estagio` — `novo · qualificado · negociando · cliente · perdido ·
  inativo`, mudando sozinho a partir dos fatos (ver `src/core/crm.ts`);
- `contacts.ultima_mensagem_em` — de quem se está devendo resposta;
- `quadro_cartoes.situacao` (`aberta/ganha/perdida`), `valor`, `fechado_em`,
  `responsavel` — ou seja, **funil com dinheiro e com taxa de fechamento**;
- `eventos_do_contato` — a linha do tempo do relacionamento;
- `mensagens_agendadas` — o que vai sair depois.

Confira o estado real antes de projetar em cima: `ls supabase/migrations` e os
arquivos `0057_*` e `0058_*`. E confirme com o outro agente o que já está
estável em `repos/crm.ts` antes de depender.

---

## 2. O que pesquisar, e a pergunta que a pesquisa precisa responder

O dono não quer mais gráfico. Ele quer que a tela responda o que a pessoa **faz
quando abre**. Pesquise e defenda por escrito.

**Produtos para estudar** — a home de operação, não a página de marketing:
Intercom, Front, Zendesk, Crisp, Chatwoot (código aberto, dá para ler),
HubSpot, ManyChat, Linear, Stripe, Shopify admin, Vercel.

**Perguntas que a pesquisa precisa responder:**

- **Quais são as métricas que o mercado de atendimento realmente acompanha?**
  Tempo até a primeira resposta, tempo de resolução, conversas não atribuídas,
  fila esperando humano, taxa de contenção do bot, CSAT. Descubra quais têm
  literatura e referência de valor, e **quais são vaidade** — total de mensagens
  é o exemplo clássico de número que não muda decisão nenhuma.
- **O que é dashboard e o que é fila de trabalho?** Muitos produtos descobriram
  que a home não deve ser relatório: deve ser *o que precisa de você agora*.
  Diga qual dos dois esta home deve ser, e por quê.
- **Ação rápida: quais, e onde?** O dono pediu. Descubra o padrão — botão no
  cabeçalho, cartão acionável, ou a própria fila sendo clicável.
- **O estado vazio.** Aqui há literatura sólida: onboarding em checklist
  (Stripe, Shopify "setup guide", Linear, Notion), progresso visível, primeiro
  valor no menor número de passos. Descubra o que faz um checklist ajudar em vez
  de infantilizar, e **quando ele deve sumir** — checklist que fica para sempre
  vira ruído permanente.
- **Como se sai do estado vazio para o cheio sem a tela pular de forma?**
  Conta nova, conta com um contato, conta com mil. Os três precisam parecer o
  mesmo produto.
- **Por que dashboard gerado por IA parece gerado por IA?** Vale uma passada
  séria: fileira de quatro cartões de número igual, gráfico sem pergunta,
  porcentagem sem base de comparação, cor por enfeite. O dono reconheceu isso de
  olho; a resposta escrita é o que evita repetir.

---

## 3. Antes de escrever código

**Entregue a decisão antes do diff.** O dono é designer, não desenvolvedor: quer
a decisão tomada e justificada, não um leque de opções. Escreva em
`docs/PLANO-HOMEPAGE.md`:

1. o que a tela responde, em uma frase;
2. o que entra, o que sai e o que **morre** — inclusive dos blocos atuais;
3. os dois estados desenhados, vazio e cheio, com o que dispara a troca;
4. de onde sai cada número, e se já existe consulta ou precisa de uma nova;
5. o que é enganoso e você decidiu não mostrar — essa lista vale tanto quanto a
   outra.

Depois implemente em deploys pequenos. Ele acompanha em produção, por print, e
prefere ver três vezes um pedaço a esperar um lote grande.

Há uma skill de design de front-end disponível no ambiente (`frontend-design`).
Use antes de decidir tipografia, hierarquia e layout — a casca deste produto já
tem gramática própria, descrita abaixo.

---

## 4. A gramática visual que já existe

Respeitar isto é o que faz a tela nova parecer parte do produto:

- **Duas famílias, com papéis.** Outfit é a casca — barra lateral, títulos,
  botões, pílulas. Inter é texto de leitura, e hoje só é usada dentro da
  conversa, pelo utilitário `font-texto`. Ver `src/app/layout.tsx` e o
  `@theme inline` do `globals.css`.
- **`app-card`, `app-field`, `app-primary-button`, `app-secondary-button`** já
  existem em `globals.css`. Use, não recrie.
- **Os tokens de cor** disponíveis como utilitário: `bg-canvas bg-panel
  bg-surface bg-surface-strong`, `border-line border-line-soft border-strong`,
  `text-ink text-soft text-muted text-dim`, `bg-primary text-primary
  bg-primary-weak text-primary-strong`, `text-perigo text-aviso text-ok
  text-info`, `shadow-pop shadow-menu shadow-modal`.
- **Componentes prontos** que economizam tempo: `components/design/dica.tsx`
  (tooltip do produto, CSS puro), `components/design/ilustracoes.tsx` (tem uma
  ilustração de estado vazio), e o padrão de `Selo` usado no índice de
  Configurações para mostrar estado numa linha.

---

## 5. As regras que não se renegociam

1. **Cor só em `src/app/globals.css`.** Nenhuma cor escrita à mão em
   componente. Token novo entra em **dois** lugares: `@theme inline` e `:root`
   (mais o bloco escuro). `:root` sozinho não gera utilitário no Tailwind 4 —
   esse defeito já custou caro, e o comentário no topo do arquivo conta a
   história.

2. **O tema claro é o padrão e não se inverte.** Sem
   `@media (prefers-color-scheme: dark)` em lugar nenhum. O escuro é escolha,
   posta em `data-tema` antes da primeira pintura por
   `src/components/design/tema.tsx`.

3. **Banco de produção é compartilhado com outro produto (Verandi).** Antes de
   qualquer migration, leia `docs/BANCO-COMPARTILHADO.md` **inteiro**. Nunca
   `supabase db push` nem `db reset` contra produção. A próxima migration se
   descobre com `ls supabase/migrations | tail -1` — nunca copiando número de
   documento, inclusive deste. Nada é aplicado sem autorização explícita do
   dono.

4. **Os testes falam com o Supabase de produção**, criando registros com prefixo
   `zz-` e apagando no fim. Rode `npm test` antes de qualquer coisa que toque
   servidor (~3min).

5. **Consulta de painel é a que mais dói.** A tela abre a cada navegação e cada
   bloco tem `Suspense` próprio de propósito: um número lento não pode segurar a
   tela inteira. Se acrescentar métrica, meça o custo — `metricas.ts` tem
   exemplos de contagem barata com `head: true` e índice parcial.

6. **Deploy é `git push origin main`** — a Vercel publica sozinha, domínio
   `autofluxos.4yu.com.br`. Antes de empurrar: `npm run typecheck`,
   `npm run lint`, `npm run build`, `npm test`.

7. **Escreva em português**, no tom dos comentários que já estão no
   repositório: eles explicam **por que**, não o que, e contam o defeito que a
   linha existe para evitar. Commit segue o mesmo padrão.

---

## 6. Onde começar

```bash
sed -n '1,80p' src/app/clientes/[clienteId]/page.tsx   # a tela e o porquê do bloco Atendimento
grep -n "^export" src/server/repos/metricas.ts          # o que já dá para medir
sed -n '1,60p' src/core/crm.ts                          # os estágios do contato (0058)
cat docs/PLANO-PRODUTO.md                               # o que o produto promete
cat docs/BRIEF-UI.md                                    # o que já foi decidido de interface
```
