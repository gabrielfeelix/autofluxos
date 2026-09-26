# Handoff 26/set: frentes (nichos) do AutoFluxos

> Para o próximo agente. Leia inteiro antes de mexer. Depois leia
> `docs/NICHOS.md` (visão e decisões) e `docs/PLANO-NICHOS.md` (como construir).
> Sempre `git fetch` e `git pull --rebase` antes: há outras sessões no repo.

## 1. O que o Gabriel quer, nas palavras dele resumidas

O AutoFluxos deixa de ser um construtor em branco e vira **um sistema por
frente** (ramo, nicho, departamento: ele ainda não fechou o nome). A pessoa
diz o tipo de negócio e **o sistema inteiro se adapta**: nomes da barra
lateral, telas que aparecem, telas que somem, modelos de fluxo, funil,
Configurações, o que a IA sabe. "Não faz sentido uma automação de e-commerce
para um lugar que não vende isso."

**Prioridade: o que dá renda agora.** As duas contas que pagam plano Escala
são a **MGM Pilates** (aulas) e a **PCYES** (e-commerce). Então:

1. Frente **Aulas / serviço com horário** (nome a definir: "Aulas e serviços",
   "Educação e bem-estar"...), pronta para a MGM.
2. Frente **E-commerce**, redonda para a PCYES.
3. Restaurante (demo de venda na rua) e comércio de rua vêm depois.

## 2. Regra dura: a MGM não muda

"Não mude nada da MGM, nada mesmo. Automação, tudo lindo." Os fluxos, gatilhos,
integração com a Verandi e configurações da MGM (`5de5a891-790f-4c14-b60b-ce0a573fe1c7`)
**não se tocam**. A frente de aulas é construída ao redor dela: vocabulário,
barra e modelos que **batem com o que a MGM já usa**. Pôr a MGM na frente
(`clients.nicho`) só depois que o pacote estiver pronto, provado por teste que
muda só palavras e menu, e **com confirmação do Gabriel antes**.

A agenda de quem dá aula continua vindo do sistema do cliente por integração
(no caso da MGM, a Verandi por API: nunca pelo banco). O AutoFluxos não vira
sistema de gestão de alunos.

## 3. O que já está pronto (todos em `main`, no ar)

| Etapa | O quê | Commits |
|---|---|---|
| 1 | `src/core/nichos.ts`: pacote por ramo (restaurante, ecommerce, comercio); barra muda a seção Comércio; teste que recusa nome de ramo fora do pacote | `8b3ec09` |
| 2 | Migration `0106` na produção: `clients.nicho`, `clients.ia_limite_contato_dia`, `produtos.categoria/ordem`, tabela `materiais` | `d00d1e7` |
| 3 | IA contínua (`conversar: { maxTurnos }` no nó `ia`), limite de IA por contato | `4c0c4d9`, `f09f032`, `a45a7eb` |
| 4 | Catálogo com categoria e ordem, grade com foto no restaurante, cardápio em PDF/imagem (bucket `autofluxos-acervo`), ferramenta `enviar_cardapio`, busca por categoria | `8ea0f7b`, `bbdac87`, `eb6106f`, `1bbf6c3` |
| 5 | Modelos `cardapio-botoes`, `atendente-ia-restaurante`, `voces-tem`, `horario-e-local`; funil `pedidos`; galeria mostra primeiro os modelos do ramo | `198dfa8` a `a46bcea` |
| 6 (código) | `fonteDoCatalogo` no nó de IA; IA contínua que conclui o pedido; "Sobre a empresa" próprio no bloco de IA (feito por outra sessão) | `9915f76`, `19037f0` |
| extra | NPS: nota pendente gravada na sessão (migration `0107` na produção) | `d7f88ea` |
| extra | 3 testes do resolver com espaço antigo | `5f7da17` |

Nenhuma tela nova foi aberta no navegador ainda. Conferido só por `tsc` e
vitest.

## 4. O que falta, em ordem

### 4.1 Frente de aulas (prioridade 1)

- Novo ramo no pacote (`core/nichos.ts` + check da coluna `clients.nicho`, que
  hoje aceita só três valores: **migration, pedir autorização**).
- Vocabulário: contato vira Aluno? Negócios vira Matrículas? Levantar o que a
  MGM já usa nos fluxos e na Verandi e **escolher palavras que batem com ela**.
- Modelos que já existem e servem: `agendamento`, `reagendamento`,
  `nao-comparecimento`, `aluno-inativo`, `lembrete`, funil `agendamento`.
- Esconder o que não faz sentido (loja/cardápio, carrinho abandonado).
- Ler as memórias do projeto sobre MGM antes: `fluxos-do-mgm-em-producao`,
  `fluxo-nao-comparecimento`, `cancelamento-sempre-humano`,
  `prazo-cancelamento-em-minutos`, `verandi-fala-por-api`.

### 4.2 Revisão tela a tela, por frente (pedido explícito)

Inventariar **toda rota** em `src/app/clientes/[clienteId]/` e decidir, por
frente: a tela aparece? com que nome? que modelos oferece? que textos e estados
vazios? Entregar a tabela em `docs/NICHOS-REVISAO-POR-TELA.md` e depois
implementar **tudo pelo pacote** (plano 1.6). Galeria de modelos: por decisão
do Gabriel, a conta com frente vê **só os modelos da frente** (hoje o resto
fica em "Outros modelos" recolhido: rever). Conta sem frente vê tudo.

### 4.3 Colocar cada conta existente na sua frente

Proposta, a confirmar com o Gabriel antes de gravar:

| Conta | Frente proposta | Observação |
|---|---|---|
| MGM Pilates | aulas | só depois da 4.1 pronta e confirmação (regra 2) |
| Academia de Boxe | aulas | sem canal, sem fluxo |
| Estúdio de exemplo | aulas | conta de demonstração criada pelo sistema |
| PCYES | ecommerce | a demo da pizzaria roda dentro dela, com `fonteDoCatalogo: 'catalogo'` |
| 4YU | ? | a própria agência (marketing): falta frente de serviços |
| Vitória Guedes | ? | marketing para pequenos negócios: mesma dúvida |
| Cliente 00 (Gabriel) | nenhuma | conta de teste |

### 4.4 Troca de frente no topo, como a RD Station

Ideia do Gabriel: no topo à esquerda, "AutoFluxos Food" (ou "AutoFluxos
Restaurantes") com um menu para as outras frentes. Trocar de frente pode
exigir outra conta e talvez **outro plano** ("acho que na RD é por plano").
**Pesquisar como a RD faz** (RD Station Marketing, CRM, Conversas: produtos e
planos separados?) e trazer 2 ou 3 opções com prós e contras. Não mexer em
plano nem preço sem decisão: preço mora só em `src/core/planos.ts`.

### 4.5 Demo da pizzaria (etapa 6, parte de produção)

Falta montar na conta PCYES, com autorização já dada pelo Gabriel: cardápio da
"Pizzaria Exemplo" com fotos de licença livre no `autofluxos-acervo`, cardápio
em PDF e PNG em `materiais`, fluxo de entrada (aviso de demonstração, texto do
QR vai direto, senão pergunta Pizzaria ou Loja virtual; Loja virtual vai ao
fluxo atual `abd4df71-cfa0-4e5c-a39d-af2aa57866cb`), `ia_limite_contato_dia = 40`,
canal `fa673a09-e90d-4a86-ac21-d75ee5fdca26` apontado para a entrada (guardar
ids antigos), teste ponta a ponta pelo simulador, QR em `docs/demo/`,
`docs/DEMO-PIZZARIA.md`. Não mudar `clients.nicho` da PCYES por causa da demo.
Número: +55 44 7400-7438.

### 4.6 Ficha do assistente de IA (plano 1.7)

Formulário por frente no lugar da caixa livre de conhecimento, com perguntas
obrigatórias do ramo, o que pode, o que nunca faz, quando passar para pessoa,
placar "responde 8 de 10" e botão Testar. Coluna jsonb nova: **autorização**.
A PCYES é a primeira ficha, convertida do texto atual (que é o modelo de
formato). Frente de aulas precisa das perguntas dela também (horários,
cancelamento, reposição, planos, experimental).

### 4.7 Restante do plano

Etapa 7 (onboarding com a pergunta da frente e perguntas extras que ligam
fluxos), 7.1 (sistema inteiro pela frente), 8 (loja e comércio na demo),
9 (admin: ver e trocar frente, auditoria).

## 5. Regras da casa que já custaram caro

- **Sem travessão** em tela, comentário, commit e doc: use dois pontos.
- **Nada de `git stash` nem `git reset`**: leva o trabalho de outra sessão.
- **Migration**: número pelo diretório (`ls supabase/migrations | tail -1`),
  ler `docs/BANCO-COMPARTILHADO.md`, conferir Verandi antes e depois, ensaio
  em transação, aplicar pela Management API, **antes** do push do código que
  lê. Nunca sem autorização explícita do Gabriel.
- Consulta à produção por heredoc (`python3 - <<'PY'` ou script `.cjs` com
  `pg`), nunca `python3 -c` com aspas aninhadas. Nunca imprimir segredo.
- Regra de governança: comportamento por frente sai do pacote em
  `core/nichos.ts`; nunca `if (nicho === ...)` fora dele (há teste).
- O ramo não muda permissão nem cobrança.
- Com o Gabriel: respostas curtas, sem jargão, conclusão primeiro.
- Tela nova: abrir no navegador antes de dizer que está pronta.
