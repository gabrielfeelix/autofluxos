# Plano de UI — Configurações com cara de produto

Continuação do `docs/PLANO-CONFIGURACOES.md`, que decidiu a **arquitetura de
informação** (grupos, nomes, rotas). Este aqui decide a **forma**: o dono olhou
a tela agrupada e disse que ela está feia e com cara de IA, e mandou a Brevo
como referência — nove prints, analisados um a um abaixo.

A crítica está certa e é específica: uma lista de linhas com um selo à direita
é o desenho mais barato que existe. Ele organiza e não convida. A Brevo resolve
o mesmo problema com o mesmo conteúdo, e a diferença inteira está em seis
decisões.

---

## 1. O que a Brevo faz, e o que disso serve aqui

### 1.1 Sidebar dupla — a global encolhe, a de Configurações aparece

Ao entrar em Settings, a navegação global vira **só ícones** e nasce uma segunda
barra com os destinos da seção, em grupos rotulados ("Configurações pessoais",
"Configurações da organização", "Gestão de dados", "CRM", "Marketing"). O item
aberto fica com fundo lilás e texto roxo.

**Serve, e é a mudança que mais muda a sensação.** Configurações deixa de ser
uma página com uma lista e passa a ser um **lugar** onde se circula: trocar de
tela não exige voltar ao índice. Os quatro grupos já estão decididos — Canais,
Atendimento, Integrações, Conta — e viram os rótulos da barra.

A global encolher não é enfeite: sem isso são duas colunas de texto competindo,
e a pessoa lê duas vezes antes de saber em qual delas clicar.

### 1.2 O índice em cards, com ícone

Cada destino é um card: ícone dentro de um círculo, título, uma frase do que
aquilo faz, e uma ação no rodapé. Cinco por linha.

**Serve** — com uma diferença: lá o card não é clicável e por isso precisa do
botão "Configurar". Aqui o card inteiro vira o link, e o botão some. Menos
clique e menos ruído, pelo mesmo motivo que a linha do índice já era clicável
por inteiro.

O selo de estado que o índice já tem (**"vazio"**, "3 chaves", "reconectar")
**fica** e vale mais em card do que em lista: é a única coisa que a Brevo não
tem, porque as configurações deles não sabem dizer se estão preenchidas.

### 1.3 Tabs dentro da tela, quando há mais de um assunto

Perfil tem "Informações · Senha · Documentos legais". Segurança tem
"Autenticação em dois fatores · IPs autorizados".

**Serve, e resolve um problema que já temos:** a tela do WhatsApp hoje empilha
número, fluxos, coexistência e endereço do webhook numa coluna só, e a de
Anúncios faz o mesmo com conta, páginas e formulários. Tab é o que separa
"configurar" de "conferir" sem inventar rota nova.

### 1.4 Formulário em duas colunas

Rótulo da seção à esquerda ("Informações pessoais", "Informações da Empresa",
"Preferências de comunicação"), campos à direita.

**Serve nas telas de formulário longo** (Dados do negócio, Horário). Dá ritmo e
mostra, pela coluna da esquerda, quanto ainda falta — coisa que uma pilha de
campos não faz.

### 1.5 Estado vazio com ilustração e **um** botão

"Nenhum e-mail individual conectado" tem desenho, título e um botão. "Configure
tudo primeiro" ocupa a tela inteira com ilustração grande.

**Serve, e é onde o produto está mais pobre.** Hoje um estado vazio nosso é uma
frase cinza. Ilustração não é enfeite aqui: ela diz "esta tela está vazia de
propósito, e você não quebrou nada" antes de qualquer texto ser lido.

As ilustrações serão **nossas**, em SVG, no mesmo vocabulário geométrico do
produto — círculo, folha, retângulo, linha —, na paleta de `globals.css`. Não se
copia o traço da Brevo; copia-se a decisão de ter traço.

### 1.6 Integrações com logo, tabs e card clicável

Header com título e uma linha de explicação, tabs "Todas as integrações ·
Minhas integrações · Webhooks", busca, filtros por categoria à esquerda, e cards
com **a logo da empresa**, o nome, quem criou, a descrição e uma tag.

**Serve em parte, e a parte que não serve importa:**

- **Logo da marca: serve, e é o detalhe mais valioso do print.** Reconhecer o
  WhatsApp pelo verde é mais rápido do que ler a palavra, e é o que faz a tela
  parecer um catálogo em vez de uma lista de configurações.
- **Tabs: servem**, com dois nomes — "Conectadas" e "Disponíveis".
- **Busca e filtro por categoria: não servem hoje.** São quatro conexões.
  Quinze categorias para quatro cards é moldura ocupando espaço, e é
  exatamente o tipo de coisa que se põe "porque a referência tem". Entram no dia
  em que houver catálogo.
- **Card com estado: nosso, e a Brevo não tem.** Conectado, precisa reconectar,
  não ligado — o que `core/saude-da-conexao.ts` já sabe responder.

---

## 2. As etapas

Deploys pequenos, como as anteriores.

**A. A moldura de Configurações.** `AjustesShell`: barra global recolhida, barra
secundária com os quatro grupos, item aberto aceso. As onze telas de `/ajustes/`
passam a usá-la.

**B. O índice em cards.** Grid com ícone, título, frase e o selo de estado que já
existe. Card inteiro clicável.

**C. A tela de Integrações.** `/ajustes/integracoes` com tabs Conectadas ·
Disponíveis, cards com logo de marca e estado da conexão.

**D. Ilustrações e estados vazios.** Um conjunto pequeno de SVGs próprios, usado
nos estados vazios das telas de configuração.

**E. Tabs dentro das telas densas** (WhatsApp, Anúncios) e formulário em duas
colunas onde ele for longo.

---

## 3. O que não se negocia, mesmo copiando referência

1. **Cor só em `globals.css`**, em `@theme inline` **e** `:root`. Nenhum hex em
   componente — nem o verde do WhatsApp, que entra como token de marca.
2. **O tema claro é o padrão e não se inverte.** A referência é clara; o nosso
   escuro continua sendo escolha, em `data-tema`.
3. **Logo de marca é ativo de terceiro.** SVG próprio, simplificado, sem baixar
   arquivo de CDN de ninguém — e usado só para identificar a integração, que é
   uso nominativo.
4. **Ilustração nossa.** Referência é para o vocabulário, não para o traço.
