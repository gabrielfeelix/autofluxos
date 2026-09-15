# Handoff — o CRM do AutoFluxos: o que está pronto e o que falta

**15/set/2026.** Escrito para o próximo agente, que vai pegar isto sem nenhum
contexto da conversa. Leia `docs/MODELO-CRM.md` antes de qualquer coisa: é a
decisão de produto, e este arquivo só diz onde a execução parou.

O outro agente está no Inbox. **Não encoste** em `src/app/clientes/[clienteId]/inbox/**`,
`src/components/lead/**` nem `src/app/api/webhook/whatsapp/route.ts` sem
combinar antes. A tela de lead (`leads/[contatoId]/page.tsx`) está livre agora —
a árvore dele está limpa desde `ddd0c7e`.

---

## Regras de trabalho que o Gabriel deixou explícitas

1. **Não rode a suíte inteira.** `npx tsc --noEmit` a cada bloco, `npx next build`
   antes de commitar. Testes de repositório falam com o Supabase de produção e
   levam minutos; a espera irrita e não paga.
2. **Nada de subagente para implementar.** Trabalho inline, no fio principal.
3. **Decisão tomada, não menu de opções.** Ele não é dev: escolha, implemente,
   explique em uma linha.
4. **Sempre mandar o link clicável** quando mandar alguém a um painel externo.
5. Produção é dividida com a Verandi. Migration só em `public`, e **nada é
   aplicado sem autorização explícita**.

---

## O que está pronto e no ar

Commits em `main`, do mais antigo ao mais novo:
`946aab0` (decisão + migration + core) · `3ffc165` (repos) · `002e028` (regras
automáticas) · `fdd0e50` (cartão na tela) · `7d3d3f8` (papel da etapa e cadeia)
· `d4074ee` e `9ecdd36` (os dois defeitos que só o banco real pegou) ·
`ef0d365` (trazer contatos antigos) · `7d38d5b` (modelos de funil, menu, padrão
visual).

**Migration `0058_crm_funil.sql` está aplicada em produção.**

- `contacts.estagio` — `novo · qualificado · negociando · cliente · perdido ·
  inativo`. Muda sozinho pelos fatos (`src/core/crm.ts`), nunca por formulário.
  Cliente não regride; quem some vira `inativo`, não `perdido`.
- `quadro_cartoes` virou negociação: `titulo`, `valor`, `responsavel`,
  `situacao`, `motivo`, `fechado_em`.
- `quadros.seguinte_id` — funis encadeados. Ganhar no funil do SDR abre o cartão
  no do vendedor, que ao ganhar abre no pós-venda. Ciclo longo é barrado em
  `core/crm.ts` (o banco só vê `A → A`).
- `quadro_colunas.tipo` (`normal · ganho · perdido`) e `limite_de_dias` (o SLA
  que acende o aviso de parado).
- `motivos_de_perda` (lista fechada por conta) e `eventos_do_contato` (linha do
  tempo).
- Na tela de Quadros: cartão com avatar, valor, responsável e "falou há X";
  menu do cartão com ganhar, perder, reabrir, atribuir, mover, perfil; painel
  lateral com linha do tempo e quanto o cliente já rendeu; "ao ganhar, mandar
  para"; cinco modelos de funil na criação; faixa "trazer os contatos que ainda
  não estão no funil".

---

## O que falta — na ordem em que eu faria

### 1. A tela de perfil do lead (o pedido mais repetido, e não foi feito)

Hoje `/clientes/[id]/leads/[contatoId]` continua a tela antiga: etiquetas,
anotação, "o que o fluxo coletou" e a conversa. **Nada de CRM aparece ali** — nem
estágio, nem responsável, nem negociação, nem histórico. Foi a parte que eu
adiei para não colidir com o outro agente, e adiei demais: é a tela que o
Gabriel abre o tempo todo.

O servidor já está pronto para ela, é só consumir:

- `estagioDoContato(clienteId, contatoId)` e `resumoDoContato(...)` —
  `src/server/repos/crm.ts`
- `linhaDoTempo(clienteId, contatoId)` — `src/server/repos/eventos.ts`
- `quadrosDoContato(...)` — já devolve `titulo`, `valor` e `situacao` por cartão
- `membrosDaConta(contaId)` — `src/server/repos/usuarios.ts`
- ações: `acaoDefinirEstagio`, `acaoAtribuirCartao`, `acaoFecharCartao`,
  `acaoDescreverCartao` (`src/server/acoes-crm.ts`), `acaoAtribuirPara`
  (`acoes.ts`, atribui o contato)

**O desenho, como eu tinha pensado** (referência: a ficha do RD Station, com
dado à esquerda e histórico à direita):

```
┌───────────────────────────────────────────────────────────────────────┐
│ ‹ Leads                                                               │
│ (GS) Guti Santos                          [cliente ▾]  [Ana ▾]  [⋯]   │
│      +55 11 98851-9314 · WhatsApp · veio do anúncio "Pilates set/26"  │
├──────────────────────┬────────────────────────────────────────────────┤
│ JÁ RENDEU  COMPRAS   │  [ Conversa ]  [ Histórico ]  ← abas, como RD  │
│ R$ 1.500      2      │                                                │
│ última em 12/ago     │  (a conversa que já existe, sem mexer)         │
│                      │                                                │
│ NEGOCIAÇÕES          │  no Histórico: a linha do tempo de             │
│ • Comercial          │  eventos_do_contato, uma frase por linha       │
│   Proposta enviada   │  ("saiu de Novo para Proposta", "Ana assumiu", │
│   Plano trimestral   │   "ganhou — R$ 1.500", "perdeu — Preço")       │
│   R$ 890 · aberta    │                                                │
│   [ganhar] [perder]  │                                                │
│ • Pós-venda          │                                                │
│   Acompanhamento     │                                                │
│                      │                                                │
│ ETIQUETAS            │                                                │
│ ANOTAÇÃO             │                                                │
│ O QUE O FLUXO COLETOU│                                                │
└──────────────────────┴────────────────────────────────────────────────┘
```

Regras do desenho, para não virar outra tela genérica:

- **O estágio é um controle, não um texto.** Chip no cabeçalho que abre o
  `Dropdown` do design system. Mudar ali chama `acaoDefinirEstagio` e grava
  evento — é o ajuste manual, que existe e é exceção.
- **O responsável fica ao lado do estágio**, com o `Avatar` do Inbox. Sem dono é
  estado visível, não espaço vazio.
- **Negociações antes de etiquetas.** É o que responde "quanto essa pessoa vale"
  e é o que o quadro já sabe; etiqueta e anotação são apoio.
- **Abas Conversa/Histórico**, e a conversa continua sendo a primeira: quem abre
  a ficha quase sempre vai responder.
- Reaproveitar `FecharCartao` (`components/quadros/fechar-cartao.tsx`) para os
  botões de ganhar e perder — mesmo modal, mesma regra de motivo obrigatório.
- Componentes novos em `src/components/lead-crm/`, **não** em
  `components/lead/**`, que é território do outro agente.

### 2. A barra de ações do quadro (RD + Jira)

O quadro hoje só tem as colunas. Falta o que as duas referências têm e o
Gabriel pediu explicitamente para olhar com calma:

- **busca dentro do quadro** (Jira: "Pesquisar quadro") — filtra cartão por
  nome, telefone e título da negociação, no cliente, sem ida ao servidor;
- **filtro por responsável com avatares clicáveis** (Jira), mais "sem dono";
- **filtro por situação**: abertas · ganhas · perdidas · todas (RD: "Todos os
  status");
- **ordenação**: quem espera há mais tempo · maior valor · mais recente (RD:
  "Criadas por último");
- **contador geral** no topo: "19 contatos · R$ X em aberto" (RD mostra
  "0 Negociações" logo abaixo dos filtros).

Tudo isso é estado de cliente em cima de `cartoesIniciais` — nenhuma consulta
nova. Onde mora: `src/components/quadros/quadro.tsx`, acima do `<div>` que
espalha as colunas.

### 3. O estado vazio com ilustração

Quadro criado e sem nenhum contato hoje mostra três colunas com "Arraste um
cartão, ou use + abaixo". O RD põe ilustração, uma frase e dois botões
("Importar dados" / "Criar negociação"). Já existe `IlustracaoQuadros` em
`components/design/ilustracoes.tsx`. Os dois botões certos aqui são **"Trazer
meus contatos"** (`acaoTrazerTodosParaOQuadro`, já pronta) e **"Adicionar
contato"**.

### 4. O nome da seção

"Quadros" foi escolhido quando a tela era só posição no funil. Agora que ela
tem negociação, ganho e perda, o nome do mercado brasileiro é **Funil** — RD usa
"Funil Padrão" para o desenho e "Negociações" para a lista; Pipedrive e HubSpot
usam "Negócios"; Kommo usa "Pipeline".

Minha recomendação, e a razão: chamar a seção de **Funis** (plural, porque são
vários: captação, comercial, pós-venda) e continuar chamando cada coluna de
etapa. "Negociações" não serve como nome da seção — é o que está *dentro* do
funil, e com vários funis a palavra deixa de dizer qual. Trocar só o rótulo do
menu e os títulos; **manter a rota `/quadros`**, porque mudar URL quebra link
salvo em troca de nada.

### 5. Os controles que ainda não são do padrão da casa

Três defeitos de acabamento, todos vistos em print pelo Gabriel:

- **Checkbox cru.** O modal "Adicionar contato" da coluna usa `<input
  type="checkbox">` do navegador — quadrado, sem raio, sem cor da marca. O
  sistema não tem um componente de caixa de seleção; **crie um**
  (`components/design/caixa.tsx`), com o mesmo raio e a mesma cor de foco do
  `app-field`, e troque em todos os lugares que usam checkbox hoje. É o que
  falta para o painel parecer um produto e não uma tela de formulário.
- **Dropdown apertado.** O "Ao ganhar, mandar para" nasceu com 186px e truncava
  o próprio rótulo ("ning…", "fim da…"). Corrigido para 220px com `shrink-0` e
  rótulo curto, mas **a régua vale para todos**: o `Dropdown` mede a lista pela
  largura do gatilho, então gatilho estreito produz lista ilegível. Antes de
  usar `detalhe:`, confira se a largura comporta duas linhas.
- **Interruptor "Novo contato entra aqui".** Está com cara de checkbox de
  formulário ao lado de um dropdown. Deve virar o mesmo interruptor do Inbox
  (`components/inbox/pilulas.tsx`, `PilulaInterruptor`).

### 6. Visão futura: agenda e reunião (não implementar agora)

O Gabriel levantou, e vale registrar antes de esquecer: uma visão de calendário
no funil, e agendamento de reunião no cartão — link de Meet/Zoom para remoto,
endereço para presencial, e mais tarde vínculo com o Google Calendar. Hoje o que
existe é `mensagens_agendadas` (0057), que resolve follow-up, não compromisso
com hora marcada. Isso é fase própria: exige entidade nova (`compromissos`),
fuso, convite e lembrete.

---

## Duas armadilhas já pagas, para ninguém pagar de novo

- **`af_usuarios` tem a coluna `name`, não `nome`.** É tabela do better-auth; só
  o nome dela foi traduzido pelo `modelName`. Leia com apelido do PostgREST
  (`af_usuarios (nome:name)`), como `membrosDaConta` já fazia em SQL.
- **`upsert ... on conflict (client_id, nome)` não casa com índice de
  expressão.** O índice de `motivos_de_perda` é sobre `lower(trim(nome))`, e o
  `on conflict` falhava em silêncio deixando a lista vazia. Use `insert`
  tolerante a duplicata e releia.
- **Menu dentro de coluna que rola precisa sair do fluxo.** `overflow` recorta,
  `z-index` não resolve. O menu do cartão é medido no clique e desenhado em
  `position: fixed`; o `Dropdown` do design system faz isso com `popover`.
