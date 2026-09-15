# Handoff — a tela de Configurações e a ideia de Integrações

Para o agente que vai pegar esta frente. Leia inteiro antes de abrir código.
Você não precisa de nenhum contexto de conversa anterior: o que importa está
aqui, e o que não está, está no repositório.

**Há outro agente trabalhando neste mesmo repositório**, na tela de Quadros e
nos detalhes do Lead (`src/components/quadros/**`,
`src/app/clientes/[clienteId]/quadros/`, `src/app/clientes/[clienteId]/leads/[contatoId]/`,
`src/server/repos/crm.ts`). **Não encoste nesses arquivos.** Se precisar de algo
deles, diga ao dono em vez de editar.

---

## 0. O pedido, em uma linha

O dono não sabe se os nomes e os caminhos da configuração estão certos, e
desconfia que deveria existir uma seção **Integrações** dentro de Configurações,
onde se escolhe conectar Facebook, WhatsApp, Instagram e o que vier depois. Ele
quer que isso seja **pesquisado contra a prática de mercado**, não inventado.

Você é o especialista aqui. A decisão é sua, com o raciocínio escrito.

---

## 1. O que existe hoje, exatamente

### 1.1 A barra lateral

`src/components/design/cliente-shell.tsx`, a lista `ITENS`:

```
Painel · Inbox · Contatos · Quadros · Automações · Configurações
```

### 1.2 Configurações é um índice, e isso é uma decisão boa

`src/app/clientes/[clienteId]/ajustes/page.tsx` não é um menu: **cada linha
mostra o estado atual** antes de mandar para a tela — "vazio", "3 credenciais",
"12 etiquetas". O comentário no topo do arquivo explica por quê, e vale manter:
conferir se o contexto está preenchido deixa de exigir abrir e voltar.

As dez linhas de hoje, na ordem em que aparecem:

| Linha | Para onde vai | O que é |
|---|---|---|
| Contexto do negócio | `/contexto` | o texto que o bloco de IA pode usar |
| Horário de atendimento | `/ajustes/horario` | faixas por dia + fuso |
| Anúncios | `/anuncios` | conta de anúncios da Meta + páginas do Facebook, para Lead Ads |
| Credenciais | `/conexoes` | chaves que os blocos de Serviços externos usam |
| Acervo | `/acervo` | mídia que o bloco de Mídia envia |
| Equipe | `/ajustes/equipe` | quem entra e o que pode |
| Etiquetas | `/ajustes/etiquetas` | as manuais, que viram filtro |
| Respostas rápidas | `/ajustes/respostas-rapidas` | frases prontas do Inbox |
| Número do WhatsApp | `/numero` | qual número atende e que fluxo ele executa |
| Instagram | `/instagram` | ligar o direct de uma conta profissional |

### 1.3 Os quatro problemas que já dá para enxergar sem pesquisa nenhuma

Confira cada um antes de aceitar: um handoff que afirma e não é conferido vira
plano errado com cara de plano pronto.

1. **A rota e o título discordam.** `/conexoes` renderiza `<h1>Credenciais</h1>`
   (`conexoes/page.tsx:87`). Quem lê a URL e quem lê a tela veem produtos
   diferentes, e a palavra "conexões" é justamente a que o mercado usa para
   *conectar canal* — que é outra coisa.

2. **Conectar canal está espalhado por quatro telas que não se parecem.**
   `/numero` (WhatsApp), `/instagram`, `/anuncios` (Meta Ads + páginas) e
   `/conexoes` (chaves de terceiros). Cada uma com layout próprio. São quatro
   respostas para a mesma pergunta: *o que está ligado nesta conta e está
   funcionando?*

3. **Configuração de produto e configuração de conta moram na mesma lista.**
   Etiqueta, resposta rápida e horário são como o atendimento funciona.
   Equipe é quem tem acesso. Contexto é o que a IA sabe. Integrações é com quem
   o sistema fala. O mercado separa esses grupos, e a lista plana de dez linhas
   já está no tamanho em que a falta de grupo custa.

4. **Há configuração fora de Configurações.** O cadastro do cliente e o logo
   (`FichaDoCliente`, `src/components/cliente/ficha.tsx`) moram no **Painel**,
   `src/app/clientes/[clienteId]/page.tsx`. Isso é assunto do outro handoff (o
   da homepage), mas a decisão de onde ele deve morar é sua — combine com o
   dono, porque as duas frentes tocam o mesmo componente.

### 1.4 O que o produto realmente conecta hoje

- **WhatsApp Cloud API**: o canal de verdade, via Embedded Signup. Ver
  `src/server/repos/coexistencia.ts` e `docs/META-TECH-PROVIDER.md`.
- **Instagram Direct**: existe tela, e o canal está **`disponivel: false`** em
  `src/core/canais.ts`. Confira lá antes de desenhar: prometer na tela um canal
  que o adaptador não entrega é o defeito que aquele arquivo existe para evitar.
- **Meta Ads / páginas do Facebook**: só para receber Lead Ads. Ver
  `docs/LEAD-ADS.md` e `docs/PLANO-LEAD-ADS.md`.
- **Credenciais genéricas**: chaves que os blocos de Serviços externos do motor
  de fluxo usam. É outra categoria — é o cliente falando com o sistema **dele**,
  não a 4YU falando com uma plataforma.

Essa última distinção importa e o mercado a resolve de formas diferentes.
Decidir onde ela cai é metade do trabalho.

---

## 2. O que pesquisar, e onde

O dono pediu prática de mercado. Não copie layout: extraia **o modelo mental**,
e depois decida o que serve a um produto de atendimento no WhatsApp.

**Produtos que resolveram o mesmo problema** (olhe a estrutura de navegação das
configurações, não a estética): Intercom, Zendesk, HubSpot, Front, Crisp,
Chatwoot (tem o código aberto — dá para ler as rotas), ManyChat, Twilio, Stripe,
Slack, Linear.

**Perguntas que a pesquisa precisa responder**, e que você vai defender por
escrito:

- **Integrações é seção de Configurações ou item de primeiro nível?** Os dois
  existem no mercado e a escolha depende de quantas integrações há e de quem as
  liga. Diga qual e por quê, para **este** produto.
- **Onde termina "Canal" e começa "Integração"?** WhatsApp é por onde o
  atendimento acontece — não é o mesmo tipo de coisa que uma chave de CRM
  externo. Vários produtos separam *Channels* de *Apps/Integrations*.
- **Qual é o ciclo de vida de uma conexão na tela?** Conectar → estado de saúde
  → o que ela tem permissão de fazer → reconectar → desconectar, e o que
  acontece com os dados quando se desconecta. Hoje isso está incompleto e é o
  que mais gera chamado em produto de canal.
- **Como se mostra que uma conexão quebrou?** Token expirado, permissão
  revogada, número desconectado pela Meta. Onde isso aparece: na integração, no
  Inbox, ou nos dois? Um canal caído em silêncio é a pior falha deste produto.
- **O que é conta e o que é espaço de trabalho?** Aqui há vários clientes por
  instância (`/clientes/[clienteId]`). Veja como os produtos separam
  configuração da organização, do espaço e do canal.
- **Quantos níveis de navegação aguentam?** Índice plano de dez linhas, grupos
  com cabeçalho, ou duas colunas com menu à esquerda. Há literatura e há padrão
  dominante; encontre qual e diga.

Onde procurar além dos produtos: documentação de design system dos próprios
(Intercom e Shopify Polaris publicam padrão de "settings" e de "integração"),
Nielsen Norman Group sobre arquitetura de informação em configurações, e
qualquer post de engenharia sobre "connection health".

---

## 3. Antes de escrever código

**Entregue a decisão antes do diff.** O dono é designer, não desenvolvedor: ele
quer a decisão tomada e justificada, e não uma lista de opções para ele
escolher. Escreva em `docs/PLANO-CONFIGURACOES.md`:

1. o mapa novo — o que vira o quê, rota por rota, incluindo o que some;
2. o que cada nome passa a significar, e por que o nome antigo estava errado;
3. o que é renomeação de tela e o que exige mudar banco (se exigir);
4. redirecionamentos: rota antiga que muda de endereço precisa continuar
   respondendo, porque o dono tem link salvo e manda print com URL.

Depois implemente em deploys pequenos. Ele acompanha em produção, por print, e
prefere ver três vezes um pedaço a esperar um lote grande.

---

## 4. As regras que não se renegociam

1. **Cor só em `src/app/globals.css`.** Nenhuma cor escrita à mão em
   componente. Token novo entra em **dois** lugares: `@theme inline` e `:root`
   (mais o bloco de tema escuro). `:root` sozinho não gera utilitário no
   Tailwind 4 — esse defeito já custou caro, e o comentário no topo do
   `globals.css` conta a história.

2. **O tema claro é o padrão e não se inverte.** Não existe
   `@media (prefers-color-scheme: dark)` em lugar nenhum, e não deve existir. O
   escuro é escolha, guardada em `data-tema` por
   `src/components/design/tema.tsx`.

3. **Banco de produção é compartilhado com outro produto (Verandi).** Antes de
   qualquer migration, leia `docs/BANCO-COMPARTILHADO.md` **inteiro**. Nunca
   `supabase db push` nem `db reset` contra produção. A próxima migration se
   descobre com `ls supabase/migrations | tail -1` — nunca copiando número de
   documento, inclusive deste. Nada é aplicado sem autorização explícita do
   dono.

4. **Os testes falam com o Supabase de produção**, criando registros com prefixo
   `zz-` e apagando no fim. Rode `npm test` antes de qualquer coisa que toque
   servidor, e não estranhe a lentidão (~3min).

5. **Deploy é `git push origin main`** — a Vercel publica sozinha, domínio
   `autofluxos.4yu.com.br`. Antes de empurrar: `npm run typecheck`,
   `npm run lint`, `npm run build`, `npm test`.

6. **Escreva em português**, no tom dos comentários que já estão no
   repositório: eles explicam **por que**, não o que, e contam o defeito que a
   linha existe para evitar. Commit segue o mesmo padrão.

7. **A plataforma é plano Hobby na Vercel.** Tarefa agendada dispara uma vez por
   dia e o número delas é limitado — uma quarta que a plataforma recuse reprova
   o deploy inteiro. Se precisar de trabalho periódico, o desenho usado aqui é
   carona no webhook, com o cron como piso (`src/server/enviar-agendadas.ts`
   explica).

---

## 5. Onde começar

```bash
sed -n '1,60p' src/app/clientes/[clienteId]/ajustes/page.tsx   # o índice e o porquê dele
sed -n '40,60p' src/components/design/cliente-shell.tsx        # a barra lateral
sed -n '1,60p' src/core/canais.ts                              # o que é canal e o que está disponível
cat docs/META-TECH-PROVIDER.md                                 # como o WhatsApp é conectado
cat docs/LEAD-ADS.md                                           # o que Anúncios faz de verdade
```
