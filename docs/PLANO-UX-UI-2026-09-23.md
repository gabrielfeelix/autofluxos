# Plano de execução: UX, UI e regras de negócio (revisão de 23/09/2026)

> **Para o agente que executar:** siga as tarefas na ordem, uma por vez, marcando
> os checkboxes (`- [ ]`) deste arquivo conforme avança. Use a skill
> `superpowers:executing-plans`. **Não use subagente para implementar**: neste
> projeto o trabalho é feito na conversa principal. Cada tarefa termina com
> commit e push na `main`, sem perguntar.

**Objetivo:** transformar a revisão de UX/UI de 23/09 em produto: agenda de
Atividades de verdade, Contatos operável, Automações sem armadilha, Transmissões
e conexões com estado honesto, acesso compreensível, Configurações organizada,
Início que manda agir e uma primeira tela de Relatórios.

**Arquitetura:** Next.js (App Router, versão nova: ler
`node_modules/next/dist/docs/` antes de usar API do Next que você não viu neste
repositório) com Server Components e Server Actions; regra de negócio pura em
`src/core/`, acesso a banco em `src/server/repos/`, ações em `src/server/acoes*.ts`,
telas em `src/app/clientes/[clienteId]/`, componentes em `src/components/`.
Supabase (Postgres) com o banco de produção **dividido com a Verandi**.

**Stack:** TypeScript, React, Tailwind, Supabase, Vitest (unit e integração
local), Playwright (e2e e prints).

**Especificação (ler antes de começar):**

- `docs/REVISAO-UX-UI-2026-09-23.md` (resumo)
- `docs/revisao-ux-ui-2026-09-23/08-handoff-execucao.md` (pacotes H01 a H10)
- Relatórios por área: `01-operacao.md`, `02-estrutura.md`, `03-conexoes.md`,
  `04-automacoes.md`, `05-atendimento-crm.md`, `06-configuracao-acesso.md`,
  `07-transmissoes-conexoes.md`
- Prints de referência de antes: `docs/revisao-ux-ui-2026-09-23/prints-antes/`

Os IDs entre colchetes em cada tarefa (H01, A05, X03, E7...) apontam para o
ticket do relatório. Leia o ticket antes de implementar; este plano diz **o que
fazer e em que ordem**, o ticket diz o porquê e as evidências.

---

## Regras globais (valem para toda tarefa)

- **Travessão (U+2014, o traço longo) proibido** em texto de tela, comentário, nome de teste e doc.
  Todo arquivo que você abrir sai sem travessão, inclusive os antigos. Troque por
  vírgula, dois-pontos ou parênteses. **Cuidado:** a limpeza anterior trocou
  alguns travessões que eram *valor vazio* por `,` (ver tarefa 0.1). Placeholder de
  vazio em tabela é `·` ou texto (`sem dado`), nunca `,`.
- **Banco:** ler `docs/BANCO-COMPARTILHADO.md` antes de qualquer migration.
  Nunca `supabase db push` nem `db reset` contra produção. Próxima migration se
  descobre com `ls supabase/migrations | tail -1` (em 23/09 a última é `0093`, catálogo com
  card, do trabalho de produtos; a próxima deste plano seria `0094`, mas confira
  o diretório, porque outro agente trabalha em paralelo). Migration nova começa
  com `set search_path = public, extensions`. **Não aplique nada em produção**:
  migration é aplicada só no Supabase local; produção fica para o Gabriel
  autorizar, e a tarefa registra isso no fim do commit.
- **Permissão mora no servidor.** Esconder menu ou botão nunca substitui
  `exigirCapacidade` na ação. Mudança visual não pode ampliar nem reduzir acesso
  em silêncio.
- **Nada de produção como fixture.** Toda validação visual usa o ambiente local
  descrito abaixo.
- **Validação:** `npm run typecheck` + os testes da área tocada (arquivo por
  arquivo). **Não rode a suíte inteira.** Teste de integração local:
  `npx vitest run --config vitest.integration.config.ts <arquivo>`. Unit:
  `npx vitest run --config vitest.unit.config.ts <arquivo>`.
- **Tela mexida = print antes e depois**, desktop e celular, com o script de
  prints. Olhe os prints de verdade antes de dar a tarefa por feita.
- **Texto de tela em português do Brasil**, frases curtas, sem jargão técnico
  (`owner`, `member`, `webhook` só onde o público for técnico).
- **Commits** em Conventional Commits, em português, um por tarefa, e push na
  `main` logo em seguida.
- **Trabalho em paralelo:** outro agente mexe no mesmo repositório (catálogo,
  loja, Inbox). Antes de cada tarefa: `git pull --rebase` e `git log --oneline -10`;
  se um commit novo tocou arquivo da tarefa, leia o diff antes de editar.
- **Peças que já existem e devem ser reaproveitadas:**
  - `telefoneLegivel` (`src/core/contatos/telefone.ts`): todo telefone na tela
    sai como `+55 (44) 99877-5978`. Nunca mostrar `wa_id` cru.
  - `AjudaDaTela` (`src/components/design/ajuda-da-tela.tsx`): o `?` ao lado do
    título que abre a explicação da tela. Descrição embaixo do título fica em
    até duas linhas; passo a passo e regras vão para dentro do `?`. Exemplo de
    uso: `src/app/clientes/[clienteId]/ajustes/produtos/page.tsx:97`.
- **Atualizar este arquivo:** ao terminar uma tarefa, marque os checkboxes e,
  se algo saiu diferente do plano, escreva uma linha em "Registro de execução"
  no fim do arquivo, com o hash do commit.

## Foco de revisão (o que mais pode morder quem usa)

1. **Fuso na agenda:** atividade com hora marcada às 22h (horário de Brasília)
   vira dia seguinte em UTC. Os filtros Vencidas/Hoje/Próximas precisam usar a
   mesma regra de `urgenciaDe` (`src/core/atividades.ts:155`), senão o contador
   do filtro e o grupo da linha discordam. Teste na tarefa 1.1.
2. **Busca com acento e telefone:** "joao" precisa achar "João"; "9990 1021"
   precisa achar `5544999010 21`. Teste na tarefa 1.1 e 2.3.
3. **Escopo "só os meus":** pessoa com escopo `proprios` não pode ver nem
   atribuir atividade de outra pessoa, nem por URL (`?responsavel=<id>`). Teste
   na tarefa 1.1.
4. **Ação que falha não some com a linha:** concluir, reagendar e cancelar com
   erro do servidor mantêm a linha e mostram o erro nela. Teste na tarefa 1.4.
5. **Gatilho ligado para fluxo em rascunho:** ligar precisa recusar com motivo
   (servidor, não só tela). Teste na tarefa 3.1.

---

## Ambiente local para ver as telas (tarefa zero de toda sessão)

Scripts em `scripts/ux-local/`. Tudo roda contra o Supabase **local** em Docker.

```bash
npx supabase status                  # precisa estar de pé; se não: npx supabase start
scripts/ux-local/dev.sh              # painel em http://localhost:3100 (deixe rodando em segundo plano)
node scripts/ux-local/cadastro.mjs   # só na primeira vez: cria revisao@local.test e a empresa
npx tsx scripts/ux-local/seed.mts    # só na primeira vez: 60 contatos, 250 atividades, fluxos...
node scripts/ux-local/entrar.mjs     # sessão nova quando a antiga expirar
node scripts/ux-local/prints.mjs .ux-local/antes atividades      # print antes
node scripts/ux-local/prints.mjs .ux-local/depois atividades     # print depois
```

- Login manual no navegador: `revisao@local.test` / `senha-local-123456`.
- Telas disponíveis no script de prints: `inicio atividades contatos funil
  inbox ficha fluxos fluxos-palavras fluxos-sequencias editor transmissoes
  ajustes equipe integracoes relatorios`. Tela nova: acrescente no objeto
  `TELAS` do script.
- `.ux-local/` está no `.gitignore`. Os prints de referência versionados ficam
  em `docs/revisao-ux-ui-2026-09-23/prints-antes/`.
- O `dev.sh` sobrescreve os tokens de WhatsApp, Meta e Gemini com valor
  inválido: nenhum clique local manda mensagem ou gasta IA de verdade.
- Emoji aparece como quadrado no Chromium sem fonte de emoji. Isso é do
  navegador de teste, não defeito do produto.

---

## Decisões de produto já tomadas (não reabrir)

O Gabriel delegou estas decisões. Siga-as; não pergunte de novo.

| Tema | Decisão |
|---|---|
| Sequência em andamento (A06) | **Mudar conteúdo de um passo** (fluxo ou modelo) vale para quem ainda não recebeu aquele passo. **Mudar horário** vale também para quem já está na sequência e ainda não chegou no passo: o envio agendado é remarcado. **Não existe botão de reordenar**: o horário novo precisa ficar entre o do passo anterior e o do seguinte; para trocar a ordem, troca-se o conteúdo. |
| Automações | Abas viram **Fluxos · Gatilhos · Sequências**. Gatilhos tem sub-abas Palavras-chave, Eventos, Campanhas (e Webhooks dentro de Eventos, como hoje). Modelos de chatbot sai da barra e entra no botão "Nova automação" (Em branco / Usar modelo / Importar arquivo). As URLs antigas (`?aba=palavras`, `?aba=templates`...) continuam funcionando. |
| Selecionar todos (X11) | Continua sendo **só a página**. O texto passa a dizer "os N desta página". Selecionar o resultado inteiro não entra neste plano. |
| Consultor | **Não vira papel novo.** Os modelos Gestor/Operador passam a se chamar "Acesso de gestão" e "Acesso de atendimento". Quem o negócio chama de consultor recebe "Acesso de atendimento". |
| Nomes de papel da conta (E2, E3) | `owner` = "Proprietário", `admin` = "Administrador da conta", `member` = "Membro". Some o "Atende" (enganoso: membro tem acesso amplo). Admin da plataforma = "Suporte 4YU". |
| Menu por capacidade (E7) | Item de menu que a pessoa não pode usar **some**. A rota direta mostra uma tela de "sem acesso" com o motivo; a ação continua recusada no servidor. |
| Estado de conexão | Quatro camadas separadas: **configurado**, **autorização válida**, **último evento** (com data), **falha conhecida**. Sem tráfego recente não é falha. |
| Relatórios | Rota nova `/clientes/[clienteId]/relatorios`, só com métricas que já existem em `src/server/repos/metricas.ts`, período escolhível, comparação com o período anterior e série diária com os dias zerados. Sem exportação nesta rodada. |
| Convite por e-mail (E6) | Fica para o fim (Fase 10), porque depende do envio transacional da Brevo por `autofluxos.mail.4yu.com.br`. Até lá, o cadastro com senha continua, com aviso "acesso provisório". |
| Atividades por página | 50 por página, com total e navegação de página. |

---

## Achados da abertura no navegador (não estavam na revisão)

Conferidos em 23/09 com o ambiente local e os prints em `prints-antes/`.

| ID | O que o print mostrou | Onde |
|---|---|---|
| N01 | Célula vazia de campo personalizado mostra **`,`** (a limpeza de travessão trocou o placeholder de vazio, que era travessão, por vírgula). | `src/app/clientes/[clienteId]/leads/page.tsx:530`, `src/app/clientes/[clienteId]/respostas/page.tsx:431` |
| N02 | Erro de hidratação em **toda tela** (overlay "1 Issue"): o botão de notificações renderiza `<form>` no servidor e `<button disabled>` no navegador, conforme a permissão de notificação. | `src/components/inbox/notificacoes-da-fila.tsx` |
| N03 | Início diz "**1 de 5 passos** para preparar" com a barra em "**4 de 5**". O número do texto é o que *falta*; lido junto da barra, parece contradição. | `src/components/cliente/primeiros-passos.tsx:46` |
| N04 | Início diz "Precisa de você: **Ninguém esperando**" com 67 atividades vencidas ou de hoje. A home ignora a agenda. | `src/app/clientes/[clienteId]/page.tsx` (tarefa 9.1) |
| N05 | Atividades não mostra **o nome do contato**: a linha é "Enviar contrato · tarefa · vencida · Gabriel Teste" e um link "abrir contato". Com 60 vencidas, não dá para saber de quem é cada uma. | `src/app/clientes/[clienteId]/atividades/page.tsx`, `agenda()` não junta `contacts` |
| N06 | Contatos: etiquetas na linha com texto claro sobre fundo claro, **ilegíveis**. | componente de etiqueta da tabela em `leads/page.tsx` |
| N07 | Contatos: cabeçalho diz "**30 pessoas**" com 60 contatos na conta; o número é da página, não do total. | `leads/page.tsx:259` região do cabeçalho |
| N08 | Fluxos: automação em **RASCUNHO com o interruptor ligado** (verde). Ligado + nunca publicado = não responde nada, e a tela não avisa. | `src/app/clientes/[clienteId]/fluxos/page.tsx:589-599` |
| N09 | Fluxos: cada linha tem 8 controles no mesmo peso (respostas, selo, setas, interruptor, seletor de pasta, Duplicar, Apagar). | `fluxos/page.tsx:386-665` |

---

## Mapa das fases

| Fase | O que entrega | Tickets |
|---|---|---|
| 0 | Defeitos rápidos achados no navegador | N01, N02, N03, N07, P3 de `01` (quadro/funil) |
| 1 | **Atividades como agenda de trabalho** | H01, N05, `01` P1 |
| 2 | Contatos operável | H02, H03, X11, N06 |
| 3 | Automações: armadilhas e lista | A05, N08, A16, A03, A01, A15, N09, A07, A08 |
| 4 | Automações: sequência editável | A06 |
| 5 | Automações: reorganização e editor | Gatilhos, A04, A02, A09, A10, A11, A12, A13, A14 |
| 6 | Transmissões e conexões | T03/C10, C09, T02, C11, C01, C02, C04, C05, T04/S06/C03, T05/S05, T06/C07 |
| 7 | Acesso e papéis | E2, E3, E1, E4, E13, E7, E8, E9, E14, E15, E5/E20, S07 |
| 8 | Atendimento, Inbox e ficha | X03, X05, X09, X12, X07, X08, X10, X04, X01, X02, X16, X17, X06, X13, X14, X15, X18, X19, X20 |
| 9 | Início orientado a pendência | H05 (Início), C01, N04 |
| 10 | Configurações reorganizadas | E17, E18, E19, E20, E21, E22, S01, S02, S03, S04, S08, S09, S10/E16, S11, S12, E10, E11, E6 |
| 11 | Relatórios | C13, C14, H05 (Relatórios) |
| 12 | Validação integrada | H10 |

Fases 0 a 4 são a prioridade. As demais podem ser executadas em sessões
separadas, cada uma começando pela "tarefa zero" (ambiente local).

---

## Fase 0: defeitos rápidos

### Tarefa 0.1: placeholder de vazio volta a ser legível [N01]

**Arquivos:**
- Modificar: `src/app/clientes/[clienteId]/leads/page.tsx:530`
- Modificar: `src/app/clientes/[clienteId]/respostas/page.tsx:431`

- [x] **Passo 1:** procurar outros placeholders estragados pela limpeza:
  `grep -rnE ">,</|\\? ',' :|\\|\\| ','" src --include=*.tsx`. Cada ocorrência em
  que a vírgula está sozinha como conteúdo de célula vazia entra nesta tarefa.
- [x] **Passo 2:** trocar o conteúdo por `·` com rótulo acessível:

```tsx
{lead.campos[coluna] || <span className="text-dim" aria-label="sem dado">·</span>}
```

- [x] **Passo 3:** `npm run typecheck`.
- [x] **Passo 4:** print `contatos` e conferir a coluna "Indicado por".
- [x] **Passo 5:** commit `fix(contatos): célula vazia volta a mostrar ponto, não vírgula`.

### Tarefa 0.2: erro de hidratação do botão de notificações [N02]

**Arquivos:**
- Modificar: `src/components/inbox/notificacoes-da-fila.tsx`

O componente decide entre `<form>` e `<button disabled title="Os alertas foram
bloqueados...">` lendo `Notification.permission` durante a renderização. O
servidor não tem `Notification`, então renderiza o formulário; o navegador
renderiza o botão; o React acusa hidratação divergente em todas as telas.

- [x] **Passo 1:** ler o componente inteiro.
- [x] **Passo 2:** mover a leitura da permissão para um estado inicializado em
  `useEffect` (primeira renderização igual à do servidor, com o estado
  "desconhecido"), e só depois trocar para bloqueado/permitido. Padrão:

```tsx
const [permissao, setPermissao] = useState<NotificationPermission | 'desconhecida'>('desconhecida')
useEffect(() => {
  if (typeof Notification !== 'undefined') setPermissao(Notification.permission)
}, [])
```

  Na renderização, `'desconhecida'` desenha exatamente o que o servidor desenha
  hoje.
- [x] **Passo 3:** `npm run typecheck`; subir o `dev.sh`, abrir `/inbox` e duas
  outras telas; o overlay do Next não pode mostrar "Issue". Conferir também no
  log do `dev.sh` que não aparece `Hydration failed`.
- [x] **Passo 4:** commit `fix(inbox): notificações renderizam igual no servidor e no navegador`.

### Tarefa 0.3: textos que se contradizem [N03, N07, `01` P3]

**Arquivos:**
- Modificar: `src/components/cliente/primeiros-passos.tsx:46`
- Modificar: `src/app/clientes/[clienteId]/leads/page.tsx` (cabeçalho com "N pessoas")
- Modificar: `src/components/quadros/fechar-cartao.tsx:59`, `src/components/quadros/barra-do-quadro.tsx:78`

- [x] **Passo 1:** primeiros passos: trocar o texto para o que falta, sem
  competir com a barra:

```tsx
? `Falta${passos.length - prontos === 1 ? '' : 'm'} ${passos.length - prontos} ${passos.length - prontos === 1 ? 'passo' : 'passos'} para preparar seu atendimento.`
```

- [x] **Passo 2:** Contatos: o selo do cabeçalho mostra o **total do filtro**,
  não o tamanho da página. Ler como o total chega à página (`listarLeads` /
  `paginarLeads`); se o total já existe, usar; se não existe, acrescentar
  `count: 'exact'` na consulta existente. Texto: "60 contatos" (e "12 de 60
  contatos" quando houver filtro ou busca).
- [x] **Passo 3:** Funil: "O cartão fica no quadro" → "O negócio continua no
  funil"; "Filtros do quadro" → "Filtros do funil". Procurar outros "quadro"
  visíveis ao usuário na pasta `src/components/quadros/` (`grep -n "quadro" ...`
  só em strings de tela) e trocar por "funil" ou "etapa" conforme o sentido.
- [x] **Passo 4:** typecheck; prints `inicio contatos funil`.
- [x] **Passo 5:** commit `fix(textos): contagens e nomes que contradiziam a tela`.

---

## Fase 1: Atividades como agenda de trabalho [H01]

Hoje (print `prints-antes/atividades.png`): coluna de 900 px, sem nome do
contato, sem hora, sem ícone, sem ações, sem busca, sem filtro, corte
silencioso em 200. O alvo usa a gramática do Funil (barra única com busca,
filtros em popover, contagem viva) e as peças que já existem na ficha
(`src/components/lead-crm/atividades.tsx`) e no Inbox
(`src/components/inbox/marcar-atividade.tsx`).

**Desenho alvo (desktop):**

```
Atividades                                             [+ Nova atividade]
Lembretes internos da equipe. Nada aqui é enviado ao cliente.

[Vencidas 60] [Hoje 12] [Próximas 150] [Sem prazo 8]      ← atalhos (contagem do escopo)
[🔍 Buscar por título ou contato     ] [Situação: Abertas ▾] [Filtros ▾] [Minhas | Equipe]
Filtros ativos: Responsável: Ana ✕   Tipo: Ligação ✕   Limpar tudo

 PRAZO            ATIVIDADE                         CONTATO              RESPONSÁVEL   AÇÕES
 ● 20/09 · 14h    📞 Ligar para confirmar aula      Mariana Alves        (AS) Ana      [✓ Concluir] [Reagendar] [⋯]
   vencida        Matrículas · Aula experimental    +55 44 99901-000
                  "Cliente pediu para ligar..."
 ● Hoje           🤝 Avaliação postural  ↗ meet...  João Pedro Rocha     (BL) Bruno    [✓ Concluir] [Reagendar] [⋯]
 ...
                                      1–50 de 230   [‹ Anterior] [Próxima ›]
```

- Ícone por tipo reaproveitando `FORMATO_DO_TIPO` de `src/core/atividades.ts:61`.
- Cor de urgência sempre acompanhada de texto ("vencida", "hoje").
- `onde` vira link quando é URL (abre em nova aba) e texto quando é endereço.
- Menu `⋯`: Abrir contato, Abrir conversa, Cancelar (pede motivo), e em
  concluídas/canceladas: Reabrir.
- Celular: cada linha vira cartão empilhado (prazo e ações em cima, contato
  embaixo); a barra de filtros vira busca + botão "Filtros".

### Tarefa 1.1: consulta paginada e filtrada da agenda (servidor)

**Arquivos:**
- Modificar: `src/core/atividades.ts` (tipos e leitura do filtro, puros)
- Criar: `src/core/atividades-agenda.test.ts`
- Modificar: `src/server/repos/atividades.ts` (função `paginaDaAgenda`)
- Modificar: `src/server/repos/atividades.test.ts` (integração local)

**Interfaces produzidas:**

```ts
// src/core/atividades.ts
export const POR_PAGINA_DA_AGENDA = 50
export type RecorteDaAgenda = 'vencidas' | 'hoje' | 'proximas' | 'sem-prazo'
export type FiltroDaAgenda = {
  situacao: SituacaoDaAtividade          // padrão 'aberta'
  recorte: RecorteDaAgenda | null        // null = todos
  busca: string                          // '' = sem busca; já aparada, máx. 80 caracteres
  tipo: TipoDeAtividade | null
  responsavel: string | 'ninguem' | null // id do membro, 'ninguem' = sem responsável
  alcance: 'minhas' | 'equipe'           // 'equipe' só vale se o escopo permitir
  pagina: number                         // começa em 1
}
export function lerFiltroDaAgenda(params: Record<string, string | string[] | undefined>): FiltroDaAgenda
export function paraParametros(filtro: FiltroDaAgenda): URLSearchParams // omite os valores padrão

// src/server/repos/atividades.ts
export type ItemDaAgenda = Atividade & {
  contato: { id: string; nome: string; telefone: string }
  negocio: { id: string; titulo: string | null; funil: string; etapa: string } | null
}
export type PaginaDaAgenda = {
  itens: ItemDaAgenda[]
  total: number
  contagens: Record<RecorteDaAgenda, number>   // da situação 'aberta', respeitando escopo, alcance, busca, tipo e responsável
}
export async function paginaDaAgenda(
  clienteId: string,
  escopo: FiltroDeEscopo,
  usuarioId: string,
  filtro: FiltroDaAgenda,
  agora: number,
): Promise<PaginaDaAgenda>
```

**Regras:**
- Recorte por dia usa **a mesma regra de `urgenciaDe`** (dia UTC). Calcule as
  fronteiras uma vez: `inicioDeHoje = Date.UTC(...)`, `inicioDeAmanha`.
  `vencidas`: `prazo < inicioDeHoje`; `hoje`: `inicioDeHoje <= prazo <
  inicioDeAmanha`; `proximas`: `prazo >= inicioDeAmanha`; `sem-prazo`: `prazo is null`.
- `alcance: 'minhas'` filtra `responsavel = usuarioId`. `alcance: 'equipe'` usa
  o escopo do acesso exatamente como a `agenda()` faz hoje (proprios / equipes /
  todos). Com escopo `proprios`, `equipe` é tratado como `minhas` e
  `responsavel` diferente do próprio id é ignorado.
- Busca: sem acento e sem diferença de maiúscula no título (`ilike` com o termo
  normalizado; se o banco não tiver `unaccent`, normalizar os dois lados em
  JS não é possível no servidor, então consulte primeiro os contatos cujo
  `nome`, `nome_real` ou `wa_id` casem com o termo, limite 500 ids, e junte com
  `or(titulo.ilike.%termo%, contact_id.in.(ids))`). Dígitos na busca casam com
  `wa_id` ignorando tudo que não é dígito: quem copia `+55 (44) 99877-5978` da
  tela precisa achar o contato (`wa_id` é só dígitos).
- Junta contato (`contacts(id, nome, nome_real, wa_id)`) e negócio
  (`quadro_cartoes(id, titulo, quadros(nome), quadro_colunas(nome))`) na mesma
  consulta. Nome exibido: `nome_real ?? nome ?? telefoneLegivel(wa_id)`; o telefone
  da linha também sai por `telefoneLegivel`.
- Ordenação: `prazo asc nulls last`, depois `criado_em asc`. Concluídas e
  canceladas: `concluida_em desc`.
- Paginação com `range((pagina-1)*50, pagina*50-1)` e `count: 'exact'`.
- Contagens: quatro `count` com `head: true`, mesmos filtros exceto recorte e
  situação.
- A função `agenda()` antiga continua existindo enquanto outra tela a usar
  (`grep -rn "agenda(" src`); se só a página de Atividades usa, remova-a no fim
  da tarefa 1.3.

- [x] **Passo 1: teste puro que falha** em `src/core/atividades-agenda.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lerFiltroDaAgenda, paraParametros } from './atividades'

describe('filtro da agenda lido da URL', () => {
  it('sem parâmetro nenhum é abertas, minhas, página 1', () => {
    expect(lerFiltroDaAgenda({})).toEqual({
      situacao: 'aberta', recorte: null, busca: '', tipo: null, responsavel: null, alcance: 'minhas', pagina: 1,
    })
  })
  it('valor desconhecido cai no padrão, nunca quebra', () => {
    const f = lerFiltroDaAgenda({ situacao: 'xpto', tipo: 'foguete', pagina: '-3', recorte: 'ontem' })
    expect(f.situacao).toBe('aberta')
    expect(f.tipo).toBeNull()
    expect(f.pagina).toBe(1)
    expect(f.recorte).toBeNull()
  })
  it('busca é aparada e cortada em 80', () => {
    expect(lerFiltroDaAgenda({ q: `  ${'a'.repeat(100)}  ` }).busca).toHaveLength(80)
  })
  it('ida e volta pela URL preserva o filtro e omite o padrão', () => {
    const f = lerFiltroDaAgenda({ q: 'joão', tipo: 'ligacao', alcance: 'equipe', pagina: '3' })
    const p = paraParametros(f)
    expect(p.get('situacao')).toBeNull()
    expect(lerFiltroDaAgenda(Object.fromEntries(p))).toEqual(f)
  })
})
```

- [x] **Passo 2:** `npx vitest run --config vitest.unit.config.ts src/core/atividades-agenda.test.ts` → FAIL (função não existe).
- [x] **Passo 3:** implementar `lerFiltroDaAgenda` e `paraParametros` em
  `src/core/atividades.ts` (nomes de parâmetro na URL: `situacao`, `recorte`,
  `q`, `tipo`, `responsavel`, `alcance`, `pagina`). Rodar → PASS.
- [x] **Passo 4: testes de integração que falham** em
  `src/server/repos/atividades.test.ts`, num `describe.skipIf(!temCredencial)('agenda paginada', ...)`
  com fixture própria (cliente novo, 2 membros, 3 contatos, 60 atividades):
  - `acha atividade além das primeiras 50 pela busca do nome do contato, sem acento` (contato "João", busca "joao").
  - `busca por telefone ignora espaço e traço`.
  - `recortes somam o total de abertas` (vencidas + hoje + próximas + sem prazo = total com situação aberta).
  - `atividade de hoje às 23h30 UTC conta como hoje, igual a urgenciaDe`.
  - `escopo proprios não vê a de outra pessoa nem pedindo responsavel na URL`.
  - `concluídas vêm em ordem de conclusão, a mais recente primeiro`.
  - `total e página: 60 abertas dão página 2 com 10 itens`.
  - `não lê atividade de outra conta`.
- [x] **Passo 5:** `npx vitest run --config vitest.integration.config.ts src/server/repos/atividades.test.ts` → FAIL.
- [x] **Passo 6:** implementar `paginaDaAgenda` seguindo as regras acima.
- [x] **Passo 7:** rodar de novo → PASS. `npm run typecheck`.
- [x] **Passo 8:** commit `feat(atividades): agenda paginada com busca, recortes e escopo no servidor`.

### Tarefa 1.2: reagendar e atribuir (servidor)

**Arquivos:**
- Modificar: `src/server/repos/atividades.ts` (`reagendarAtividade`, `atribuirAtividade`)
- Modificar: `src/server/acoes-atividades.ts` (`acaoReagendarAtividade`, `acaoAtribuirAtividade`)
- Modificar: `src/server/repos/atividades.test.ts`

**Interfaces:**

```ts
export async function reagendarAtividade(
  clienteId: string, atividadeId: string,
  novo: { prazo: string | null; horaMarcada: boolean },
): Promise<{ ok: true } | { ok: false; motivo: string }>

export async function atribuirAtividade(
  clienteId: string, atividadeId: string, responsavelId: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }>

export async function acaoReagendarAtividade(
  clienteId: string, atividadeId: string, dia: string /* AAAA-MM-DD ou '' */, hora: string /* HH:MM ou '' */,
): Promise<RespostaDaAtividade>

export async function acaoAtribuirAtividade(
  clienteId: string, atividadeId: string, responsavelId: string /* '' = ninguém */,
): Promise<RespostaDaAtividade>
```

**Regras:**
- Só atividade `aberta` pode ser reagendada ou atribuída (recusa com motivo
  "só dá para mudar atividade aberta").
- Montar o prazo com **a mesma função que `acaoCriarAtividade` usa** para
  dia/hora (ler `src/server/acoes-atividades.ts:37-118`; dia sem hora vira
  `T12:00:00Z` e `hora_marcada = false`). Não inventar outra conversão.
- Responsável precisa ser membro da conta (mesma checagem da criação).
- Capacidade: a mesma de concluir (`criar_oportunidade`, `proprios`). Com
  escopo `proprios`, só mexe em atividade cujo responsável é a própria pessoa e
  só pode atribuir para si mesma.
- `recarregar(clienteId, contatoId)` depois de mudar, para ficha e agenda
  atualizarem.

- [x] **Passo 1:** testes de integração que falham: `reagendar muda dia e hora e mantém tipo, contato e responsável`; `reagendar sem hora grava meio-dia UTC e hora_marcada falso`; `não reagenda concluída`; `atribuir para quem não é membro é recusado`; `não mexe em atividade de outra conta`.
- [x] **Passo 2:** rodar → FAIL. **Passo 3:** implementar repo e ações. **Passo 4:** rodar → PASS; typecheck.
- [x] **Passo 5:** commit `feat(atividades): reagendar e atribuir pela agenda`.

### Tarefa 1.3: a página nova de Atividades

**Arquivos:**
- Modificar: `src/app/clientes/[clienteId]/atividades/page.tsx` (vira Server Component que lê `searchParams`, chama `paginaDaAgenda` e monta a tela)
- Criar: `src/components/atividades/barra-da-agenda.tsx` (cliente: busca, situação, popover de filtros, alcance, chips ativos, limpar; tudo via URL com `paraParametros`)
- Criar: `src/components/atividades/linha-da-agenda.tsx` (linha desktop e cartão celular)
- Criar: `src/components/atividades/paginacao.tsx`
- Referência visual e de código: `src/components/quadros/barra-do-quadro.tsx` (popover, `aria-live`, chip removível)

- [x] **Passo 1:** print antes: `node scripts/ux-local/prints.mjs .ux-local/antes atividades`.
- [x] **Passo 2:** página: remover `max-w-[900px]`; usar a largura do shell como
  Contatos e Funil. Cabeçalho com título, `AjudaDaTela` (o que é atividade, que
  nada é enviado ao cliente, diferença para mensagem agendada, o que conta no
  número da barra lateral), subtítulo de uma linha ("Lembretes internos da
  equipe. Nada aqui é enviado ao cliente.") e botão "+ Nova atividade" (a
  tarefa 1.5 liga o botão; aqui ele já aparece).
- [x] **Passo 3:** atalhos de recorte com as contagens de `PaginaDaAgenda.contagens`;
  o ativo tem `aria-pressed="true"`; clicar no ativo desliga.
- [x] **Passo 4:** barra: busca com `max-w-[360px]` (enviar ao apertar Enter e
  após 400 ms sem digitar), seletor Situação (Abertas / Concluídas /
  Canceladas), popover Filtros (Tipo, Responsável com "Sem responsável"),
  alternância Minhas/Equipe **renderizada só quando o escopo do acesso for
  `equipes` ou `todos`**. Chips de filtro ativo com ✕ e "Limpar tudo". Mudar
  filtro volta para a página 1.
- [x] **Passo 5:** lista em tabela no desktop (`<table>` com cabeçalho) e cartões
  no celular (`md:` breakpoint), colunas e conteúdo do desenho acima. Nome do
  contato é link para a ficha **levando a URL atual em `?volta=`** para o botão
  voltar da ficha (a ficha passa a respeitar `volta` na tarefa 8.5; aqui só
  mandar). Avatar com iniciais + nome do responsável (não só iniciais).
- [x] **Passo 6:** estados vazios distintos: "Nenhuma atividade aberta. Crie uma
  pela ficha do contato, pelo Inbox ou pelo botão acima." versus "Nada com estes
  filtros." + botão "Limpar filtros".
- [x] **Passo 7:** paginação "1–50 de 230" com Anterior/Próxima (links, não
  botões JS).
- [x] **Passo 8:** badge da barra lateral (`src/components/design/cliente-shell.tsx:255`):
  manter a soma vencidas + hoje, mas `title`/`aria-label` "N atividades vencidas
  ou de hoje", e o clique leva a `/atividades?recorte=vencidas` quando houver
  vencida, senão `?recorte=hoje`.
- [x] **Passo 9:** typecheck; prints depois (desktop e celular); comparar com o
  antes. Conferir: nome do contato visível, hora quando marcada, ícone, link de
  reunião clicável, 230 abertas navegáveis até a última página.
- [x] **Passo 10:** commit `feat(atividades): agenda em largura total com busca, filtros e paginação`.

### Tarefa 1.4: ações na linha (concluir, reagendar, cancelar, reabrir, atribuir)

**Arquivos:**
- Criar: `src/components/atividades/acoes-da-linha.tsx` (cliente)
- Reaproveitar: o diálogo de cancelamento com motivo e o fluxo de concluir/reabrir de `src/components/lead-crm/atividades.tsx` (extraia para `src/components/atividades/` o que for compartilhado e faça a ficha importar de lá; não duplicar)

- [x] **Passo 1:** Concluir: botão na linha, chama `acaoResolverAtividade(..., 'concluida')`,
  estado pendente na própria linha (botão desabilitado e "Concluindo..."). Sucesso:
  a linha sai da lista de abertas com anúncio `aria-live` "Atividade concluída.
  Desfazer" por 6 s; "Desfazer" chama `acaoReabrirAtividade`. Erro: a linha fica,
  com a mensagem do servidor embaixo dela (`role="alert"`).
- [x] **Passo 2:** Reagendar: popover curto com dia (atalhos Hoje, Amanhã, Próxima
  segunda) e hora opcional, confirmar chama `acaoReagendarAtividade`. Esc fecha
  sem salvar e devolve o foco ao botão.
- [x] **Passo 3:** menu `⋯`: Atribuir (lista de membros, só com escopo que
  permita), Abrir contato, Abrir conversa (`/inbox?conversa=<contatoId>`),
  Cancelar (diálogo com motivo obrigatório, como na ficha). Em concluídas e
  canceladas: Reabrir.
- [x] **Passo 4:** teste e2e novo `test/e2e/agenda.spec.ts` (usa o mesmo
  padrão de cadastro único e `storageState` de `jornada-chatbot-crm.spec.ts`):
  cria contato e 2 atividades pela ficha, abre `/atividades`, conclui uma pela
  linha e confere que some e que "Desfazer" a traz de volta; reagenda a outra
  para amanhã e confere o texto do prazo; busca pelo nome do contato sem acento.
- [x] **Passo 5:** `npm run test:e2e:local -- test/e2e/agenda.spec.ts` → PASS (lembrar do limite de 5 cadastros em 5 min descrito em `test/e2e/README.md`).
- [x] **Passo 6:** prints depois; commit `feat(atividades): concluir, reagendar, atribuir e cancelar na própria agenda`.

### Tarefa 1.5: "Nova atividade" pela agenda

**Arquivos:**
- Criar: `src/components/atividades/nova-atividade.tsx`
- Reaproveitar: formulário de `src/components/inbox/marcar-atividade.tsx` (tipo, título, dia, hora, onde) e `acaoCriarAtividade`

- [x] **Passo 1:** diálogo com seletor de contato (busca por nome ou telefone,
  reaproveitar a consulta de busca de contatos que Contatos usa; mínimo 2
  caracteres), depois os mesmos campos do marcador do Inbox, responsável
  (padrão: quem cria) e negócio opcional (lista os negócios abertos do contato
  escolhido).
- [x] **Passo 2:** extrair do `marcar-atividade.tsx` os campos para um componente
  compartilhado `CamposDaAtividade` e fazer Inbox e agenda usarem o mesmo. Não
  pode existir segunda regra de criação.
- [x] **Passo 3:** ao salvar, fechar, manter filtros e mostrar a atividade nova
  (se ela couber no filtro atual; se não couber, anúncio "Atividade criada para
  <data>. Ela não aparece com os filtros atuais." com link "Ver").
- [x] **Passo 4:** acrescentar no `agenda.spec.ts`: criar pela agenda e ver na ficha do contato.
- [x] **Passo 5:** typecheck, e2e, prints; commit `feat(atividades): criar atividade direto da agenda`.

### Tarefa 1.6: alternar entre Lista e Agenda (pedida pelo Gabriel em 23/09)

- [x] **Passo 1:** `vista`, `escala` e `dia` no filtro da URL (`?vista=agenda&escala=mes&dia=AAAA-MM-DD`), padrão lista e semana.
- [x] **Passo 2:** `agendaDoIntervalo` com a mesma preparação de `paginaDaAgenda` (escopo, busca, filtros, recorte) trocando paginação por intervalo de prazo; sem prazo lidas à parte.
- [x] **Passo 3:** calendário de semana (colunas por dia, com hora) e de mês (grade, "+N mais" leva à semana), faixa "Sem prazo", celular como lista por dia.
- [x] **Passo 4:** clicar na atividade abre as mesmas ações da linha (`useAcoesDaAgenda`, extraído da lista).
- [x] **Passo 5:** testes (unit da régua de dias, integração do intervalo, e2e alternar e concluir pelo diálogo), prints; commit.

### Tarefa 1.7: "Atribuir tarefa…" em modal com busca (pedida pelo Gabriel em 23/09)

- [x] **Passo 1:** seletor pesquisável de pessoa (busca por nome, lista com rolagem, "Ninguém" como opção) em componente próprio.
- [x] **Passo 2:** menu `⋯` da linha com um item só, "Atribuir tarefa…", que abre o modal.
- [x] **Passo 3:** o filtro "Responsável" do popover Filtros usa o mesmo seletor.
- [x] **Passo 4:** typecheck, e2e, prints; commit.

---

## Fase 2: Contatos operável

### Tarefa 2.1: seleção e contato fixos na rolagem horizontal [H02]

**Arquivos:**
- Modificar: `src/app/clientes/[clienteId]/leads/page.tsx:459-530` (tabela)
- Modificar: `src/components/lead/colunas-da-tabela.tsx` (não permitir ocultar Contato)

- [x] **Passo 1:** print antes `contatos`.
- [x] **Passo 2:** primeira coluna (checkbox) `sticky left-0 z-[2]` com largura
  fixa `w-12 min-w-12`; segunda (Contato) `sticky left-12 z-[2]` com `min-w-[260px]`
  e sombra de separação `shadow-[inset_-1px_0_0_var(--border)]` (usar o token de
  borda que a tabela já usa). Cabeçalho das duas com `z-[3]` e o mesmo fundo do
  cabeçalho. Células com fundo opaco nos três estados: normal, hover e
  selecionada (o fundo de linha selecionada precisa existir na célula fixa, senão
  o texto de trás aparece por baixo).
- [x] **Passo 3:** o controle Colunas não oferece mais ocultar "Contato".
- [x] **Passo 4:** conferir com Playwright: rolar a tabela até o fim à direita
  (`page.locator('<contêiner da tabela>').evaluate(e => e.scrollLeft = e.scrollWidth)`)
  e tirar print; checkbox e nome visíveis, cabeçalho alinhado. Repetir com zoom
  200% (`page.evaluate(() => document.body.style.zoom = '2')`) e no celular.
- [x] **Passo 5:** commit `feat(contatos): seleção e nome fixos ao rolar a tabela`.

### Tarefa 2.2: etiquetas legíveis na tabela [N06]

- [x] **Passo 1:** achar o componente que desenha as etiquetas da linha
  (`grep -rn "etiqueta" src/app/clientes/[clienteId]/leads/page.tsx`) e o
  componente compartilhado `src/components/etiquetas/ficha.tsx`.
- [x] **Passo 2:** garantir contraste AA (4.5:1) entre texto e fundo para todas
  as cores de etiqueta: texto na cor escura da família, fundo na clara. Se o
  componente compartilhado já resolve, a tabela passa a usar ele.
- [x] **Passo 3:** mostrar no máximo 2 etiquetas por linha e "+N" com `title`
  listando as outras.
- [x] **Passo 4:** prints; commit `fix(contatos): etiquetas legíveis na tabela`.

### Tarefa 2.3: barra única de busca e filtros [H03]

**Arquivos:**
- Modificar: `src/app/clientes/[clienteId]/leads/page.tsx:259-360`
- Criar: `src/components/contatos/barra-de-contatos.tsx`
- Referência: `src/components/quadros/barra-do-quadro.tsx`

**Desenho alvo:**

```
Contatos  60 contatos                                  [Importar] [⋯ Mais]  [+ Novo contato]
[🔍 Buscar por nome ou telefone   ] [Filtros ▾] [Colunas ▾]
Filtros ativos: Cliente: Ouro ✕   Etiqueta: Plano anual ✕   Limpar tudo
```

- "⋯ Mais": Segmentos, Baixar CSV (com texto "baixa os N do filtro atual").
- Popover Filtros com duas seções: Cliente (Qualquer, Ouro, Prata, Bronze,
  Ainda não comprou) e Etiquetas (automáticas e manuais, com contagem).
- Filtro ativo sempre com texto + ✕; `aria-pressed` nas opções.

- [ ] **Passo 1:** manter **os mesmos parâmetros de URL** que a página usa hoje
  (ler o código antes); a barra só muda a apresentação.
- [ ] **Passo 2:** busca `max-w-[360px]`, botão Buscar some (Enter e 400 ms).
- [ ] **Passo 3:** remover as duas faixas de pills; chips só dos ativos.
- [ ] **Passo 4:** estado vazio com filtros: "Nenhum contato com estes filtros" + Limpar.
- [ ] **Passo 5:** teste e2e (acrescentar em `test/e2e/jornada-chatbot-crm.spec.ts`
  ou arquivo novo `contatos.spec.ts`): aplicar dois filtros e uma busca, remover
  um filtro e conferir que o outro e a busca continuam; recarregar a URL e
  conferir o mesmo resultado.
- [ ] **Passo 6:** prints desktop e celular; commit `feat(contatos): busca e filtros numa barra só`.

### Tarefa 2.4: seleção diz o alcance [X11, X17]

- [ ] **Passo 1:** em `src/components/lead/selecao.tsx`, o checkbox do cabeçalho
  ganha `aria-label="Selecionar os N contatos desta página"` e, com seleção
  ativa, a barra de ações diz "N selecionados nesta página".
- [ ] **Passo 2:** a confirmação de ações em massa (etiqueta, funil, apagar)
  repete o número e mostra o resultado parcial devolvido pelo servidor
  (adicionados / já existiam / falharam), reaproveitando o retorno que as
  ações já dão.
- [ ] **Passo 3:** prints; commit `feat(contatos): seleção em massa diz exatamente quem será afetado`.

---

## Fase 3: Automações, armadilhas e lista

### Tarefa 3.1: nada liga apontando para rascunho [A05, N08]

**Arquivos:**
- Modificar: `src/server/acoes.ts` (`acaoAlternarGatilho` :714, `acaoAlternarGatilhoDeEvento` :608, `acaoAlternarCampanha` :957, `acaoAlternarFluxoAtivo` :535)
- Criar: `src/core/entrada.ts` + `src/core/entrada.test.ts`
- Modificar: `src/app/clientes/[clienteId]/fluxos/page.tsx` (interruptores e avisos)

**Interfaces:**

```ts
// src/core/entrada.ts
export type MotivoDeRecusa = 'destino_nao_publicado' | 'destino_apagado'
export function podeLigar(destino: { existe: boolean; publicado: boolean }):
  { ok: true } | { ok: false; motivo: MotivoDeRecusa; texto: string }
```

Textos: `destino_nao_publicado` → "A automação de destino ainda não foi
publicada. Publique antes de ligar, senão ninguém recebe resposta.";
`destino_apagado` → "A automação de destino foi apagada. Escolha outra."

**Regras:**
- Ligar (ativo = true) consulta o fluxo de destino e recusa com o texto acima.
  Desligar sempre pode.
- Para o **próprio fluxo** (`acaoAlternarFluxoAtivo`): ligar um fluxo sem
  `versao_publicada_id` também é recusado. Fluxos que **já estão** ligados em
  rascunho (caso do print) continuam como estão no banco; a lista mostra o aviso
  (passo 4) e o interruptor deles fica visualmente "Ligado, mas sem versão
  publicada".
- Criar gatilho apontando para rascunho continua permitido (preparar antes de
  publicar), mas ele nasce **desligado** quando o destino não está publicado.

- [ ] **Passo 1:** teste puro de `podeLigar` (3 casos) → FAIL → implementar → PASS.
- [ ] **Passo 2:** teste de integração em `src/server/acoes.test.ts` ou no teste
  do repositório de gatilhos: `ligar palavra-chave para fluxo em rascunho é recusado com motivo`;
  `ligar para fluxo publicado funciona`; `desligar sempre funciona`; `criar para rascunho nasce desligado`.
  (Se as ações não forem testáveis direto por causa de sessão, testar a função
  de repositório nova `destinoPodeReceber(clienteId, fluxoId)` e chamar ela nas
  ações.)
- [ ] **Passo 3:** implementar nas quatro ações e na criação.
- [ ] **Passo 4:** tela: interruptor desabilitado com `title` e texto curto ao
  lado ("Publique o destino para ligar") quando o destino não está publicado;
  erro devolvido pelo servidor aparece junto do interruptor.
- [ ] **Passo 5:** typecheck, prints `fluxos fluxos-palavras`; commit `fix(automacoes): gatilho e automação não ligam sem versão publicada`.

### Tarefa 3.2: o Testar avisa que IA e HTTP são reais [A16]

**Arquivos:**
- Modificar: `src/components/conversa.tsx:535-600` (o aviso de HTTP já existe; estender)
- Ler antes: `src/app/api/simular/route.ts` para saber se ferramentas de IA que **gravam** (catálogo em `src/core/ferramentas.ts`) executam no simulador

- [ ] **Passo 1:** descobrir, lendo `route.ts` e `executarComEfeitos`, se uma
  ferramenta de escrita da IA grava dado real durante o teste. Registrar a
  resposta em uma linha no "Registro de execução" deste arquivo.
- [ ] **Passo 2:** se grava: o simulador passa a executar ferramentas de escrita
  em modo simulado (responde "simulado: pedido não gravado") e só ferramentas de
  leitura executam de verdade. Teste de integração cobrindo: `no simulador, ferramenta de escrita não grava`.
  Se não grava: pular para o passo 3.
- [ ] **Passo 3:** aviso antes da primeira mensagem, no mesmo estilo do aviso
  de HTTP, quando o fluxo tem bloco IA: "Este teste usa a IA de verdade e conta
  no consumo da conta. Nenhuma mensagem sai pelo WhatsApp."
- [ ] **Passo 4:** prints do editor com a aba Testar aberta; commit `feat(editor): Testar avisa o que roda de verdade`.

### Tarefa 3.3: publicação e entrada como duas informações [A03]

- [ ] **Passo 1:** na linha da lista e no cabeçalho do editor, trocar o selo
  único (`RASCUNHO`/`ATIVA`/`DESLIGADO`) por dois textos curtos:
  "Publicada v3" ou "Nunca publicada" (e "Rascunho com mudanças" quando o
  rascunho difere do publicado, informação que o editor já tem) + "Entrada
  ligada" / "Entrada desligada".
- [ ] **Passo 2:** ao desligar, anúncio: "Novas conversas não entram mais.
  Quem já está no meio continua na versão em que começou."
- [ ] **Passo 3:** prints; commit `feat(automacoes): publicação e entrada aparecem separadas`.

### Tarefa 3.4: lista de fluxos enxuta com busca e filtros [A01, N09, A15]

**Desenho alvo da linha:**

```
● Agendar aula experimental   [WhatsApp]  IA      Publicada v1 · Entrada ligada    12 respostas   [Editar] [⋯]
  11 blocos · Recepção
```

- Menu `⋯`: Ligar/Desligar, Mover para pasta, Subir, Descer, Duplicar, Apagar.
- Alertas só quando acionáveis: destino/validação pendente, nunca publicada e ligada.

- [ ] **Passo 1:** busca por nome (`?q=`), filtros Canal, Estado (publicadas,
  nunca publicadas, ligadas, desligadas, com pendência) e Pasta, com a mesma
  barra da tarefa 2.3 (reaproveitar o componente se ele ficou genérico; se não,
  extrair `BarraDeLista` de 2.3 para `src/components/design/`).
- [ ] **Passo 2:** reorganizar a linha como no desenho; a linha inteira continua
  abrindo o editor.
- [ ] **Passo 3:** pastas: acrescentar **Renomear pasta** (ação nova
  `acaoRenomearPasta(clienteId, pastaId, nome)` com teste de integração
  `renomear não mexe nos fluxos da pasta`), mantendo "Apagar pasta devolve os
  fluxos para Sem pasta".
- [ ] **Passo 4:** as outras abas (palavras, eventos, campanhas, sequências)
  ganham a mesma busca por texto.
- [ ] **Passo 5:** prints desktop e celular; commit `feat(automacoes): lista com busca, filtros e ações secundárias no menu`.

### Tarefa 3.5: salvamento automático com estado claro [A07]

- [ ] **Passo 1:** no cabeçalho do editor (`src/components/editor/editor.tsx:1329`),
  o indicador passa a dizer "Salvo às 14:32", "Salvando...", "Não salvo:
  sem conexão. [Tentar de novo]".
- [ ] **Passo 2:** o botão Publicar mostra a versão que vai nascer ("Publicar v4")
  e a confirmação diz "Só novas conversas usam a versão nova".
- [ ] **Passo 3:** prints; commit `feat(editor): salvamento e publicação dizem o que aconteceu`.

### Tarefa 3.6: ações do bloco sem botão direito [A08]

- [ ] **Passo 1:** bloco selecionado mostra botão "⋯" acessível por teclado com
  Duplicar, Excluir, Marcar como início; aresta selecionada mostra "Remover
  ligação". Reaproveitar os handlers do menu de contexto (`editor.tsx:957-985`,
  `:2040-2184`).
- [ ] **Passo 2:** Excluir informa quantas ligações somem e oferece Desfazer
  (o undo já existe).
- [ ] **Passo 3:** prints; commit `feat(editor): ações do bloco alcançáveis sem mouse`.

---

## Fase 4: sequência editável [A06]

### Tarefa 4.1: editar passo (servidor)

**Arquivos:**
- Modificar: `src/server/repos/sequencias.ts` (`editarPasso`)
- Modificar: `src/server/acoes.ts` (`acaoEditarPassoDaSequencia`, perto de `:1366`)
- Modificar: `src/server/sequencias-passo.ts` (remarcar agendamento)
- Testes: `src/server/repos/sequencias.test.ts` (criar se não existir; integração local)

**Interfaces:**

```ts
export async function editarPasso(
  clienteId: string, passoId: string,
  mudanca: { atrasoMinutos?: number; fluxoId?: string | null; templateId?: string | null },
): Promise<{ ok: true; remarcadas: number } | { ok: false; motivo: string }>
```

**Regras (decisão da tabela do topo):**
- Horário novo precisa ficar **estritamente entre** o passo anterior e o
  seguinte; senão recusa: "Esse horário mudaria a ordem dos passos. Escolha
  entre X e Y."
- Mesmas validações de `criarPasso` (teto, janela de 24h exige modelo, destino
  existente). Ler `criarPasso` (`sequencias.ts:250`) e reaproveitar a validação,
  extraindo para função comum se precisar.
- Conteúdo novo: nada a remarcar; o executor lê o passo na hora de enviar
  (`sequencias-passo.ts:64`).
- Horário novo: para inscrições `ativa` cujo `passo_atual` aponta para este
  passo, remarcar a tarefa agendada `passo_de_sequencia` correspondente para
  `inicio_da_inscricao + atrasoNovo`. Ler como `agendar()` grava a tarefa e
  qual chave identifica a tarefa daquela inscrição e passo antes de escrever.
  Se o novo horário já passou, a tarefa roda na próxima passada (não pular).
- Devolver quantas inscrições foram remarcadas, para a tela dizer.

- [ ] **Passo 1:** testes que falham: `editar conteúdo vale para quem ainda não recebeu`; `editar horário remarca a tarefa de quem está esperando este passo`; `horário que troca a ordem é recusado`; `acima de 24h sem modelo é recusado`; `não edita passo de outra conta`.
- [ ] **Passo 2:** FAIL → implementar → PASS; typecheck.
- [ ] **Passo 3:** commit `feat(sequencias): editar passo, remarcando quem está esperando`.

### Tarefa 4.2: editar passo (tela)

- [ ] **Passo 1:** em `fluxos/page.tsx:1153-1313`, cada passo ganha "Editar",
  que abre o mesmo formulário da criação preenchido. Mostrar a ordem, o atraso
  acumulado ("2º passo · 12 h depois da entrada") e, ao salvar horário, "3
  pessoas que estavam esperando este passo foram remarcadas".
- [ ] **Passo 2:** apagar passo mostra quantas inscrições estão esperando por ele antes de confirmar.
- [ ] **Passo 3:** prints `fluxos-sequencias`; commit `feat(sequencias): editar passo pela tela`.

---

## Fase 5: Automações, reorganização e editor

### Tarefa 5.1: abas Fluxos · Gatilhos · Sequências

**Arquivos:** `src/app/clientes/[clienteId]/fluxos/page.tsx:78-170`

- [ ] **Passo 1:** barra principal com três abas. `?aba=gatilhos` mostra sub-abas
  Palavras-chave, Eventos, Campanhas (`?aba=gatilhos&tipo=palavras`).
- [ ] **Passo 2:** compatibilidade: `aba=palavras|eventos|campanhas` redireciona
  (ou renderiza) como `aba=gatilhos&tipo=...`; `aba=templates` abre Fluxos com o
  diálogo "Nova automação" já na opção "Usar modelo". Aba inválida continua
  caindo em Fluxos.
- [ ] **Passo 3:** descrição de Gatilhos: "O que faz uma automação começar."
  Campanhas ganha subtítulo "Por frase ou link de anúncio. Para mandar mensagem a
  uma lista, use Transmissões." com link.
- [ ] **Passo 4:** contadores na aba Gatilhos somam os três tipos; sub-abas têm os seus.
- [ ] **Passo 5:** prints (acrescentar `fluxos-gatilhos` no script); commit `feat(automacoes): abas Fluxos, Gatilhos e Sequências`.

### Tarefa 5.2: "Nova automação" com as quatro origens [A04]

- [ ] **Passo 1:** o botão abre um diálogo com Em branco, Usar modelo (galeria
  atual `GaleriaDeTemplates`, `src/components/fluxos/templates.tsx`), Importar
  arquivo (`importar-json.tsx`) e Duplicar existente (lista com busca). Cada
  opção diz o que nasce: "Nasce como rascunho, desligada."
- [ ] **Passo 2:** remover os botões soltos "Importar JSON" do cabeçalho da lista.
- [ ] **Passo 3:** prints; commit `feat(automacoes): criar automação por um caminho só`.

### Tarefa 5.3: checklist depois de importar ou duplicar [A13]

- [ ] **Passo 1:** ao abrir o editor de um fluxo recém-importado/duplicado
  (`?origem=importado|duplicado`), painel lateral "Antes de publicar": canal,
  blocos que precisam de conexão, etiquetas/etapas/variáveis que não existem
  nesta conta, IA removida, gatilhos desligados. Cada item com link.
- [ ] **Passo 2:** compartilhar: versão e validade ao lado do botão copiar;
  link expirado diz "expirou em <data>" e revogado diz "foi revogado".
- [ ] **Passo 3:** commit `feat(editor): checklist do que falta depois de importar`.

### Tarefa 5.4: catálogo de blocos agrupado [A09]

- [ ] **Passo 1:** agrupar os 14 tipos (`editor.tsx:121-141`) em Conversar
  (mensagem, mídia, pergunta, NPS), Decidir (condição, voltar, ir para
  automação), Organizar (salvar campo, etapa, etiqueta, nota), Integrar (IA,
  HTTP, falar com humano). Busca por nome e descrição no topo.
- [ ] **Passo 2:** nomes consistentes com a tela: "Etapa do quadro" → "Etapa do funil".
- [ ] **Passo 3:** prints `editor`; commit `feat(editor): catálogo de blocos por intenção, com busca`.

### Tarefa 5.5: HTTP e IA explicam o que fazem [A10, A11]

- [ ] **Passo 1:** HTTP: ao lado da URL, "Só endereço HTTPS público. O segredo
  fica na conexão, nunca aqui." e, antes de publicar, erro de validação legível
  para URL inválida.
- [ ] **Passo 2:** IA: ferramentas separadas em "Só consulta" e "Grava dados"
  (as ferramentas de loja do commit `e760fe6`, buscar produto e consultar
  estoque, são "Só consulta");
  para as que gravam, mostrar a política efetiva da conta (automático, pede
  confirmação ao contato, passa para humano) lida de `src/server/ia/politica.ts`.
- [ ] **Passo 3:** commit `feat(editor): blocos HTTP e IA explicam o alcance`.

### Tarefa 5.6: histórico com comparação [A12]

- [ ] **Passo 1:** em `src/components/editor/versoes.tsx`, cada versão tem "Ver"
  (abre o grafo em modo leitura) e o resumo do que muda em relação ao rascunho
  atual: blocos acrescentados, removidos e alterados (comparar por id de nó;
  função pura nova `compararGrafos(a, b)` em `src/core/` com teste unitário de 3
  casos).
- [ ] **Passo 2:** a confirmação de republicar repete "vira a versão vN+1; só
  novas conversas usam".
- [ ] **Passo 3:** commit `feat(editor): comparar versão antes de republicar`.

### Tarefa 5.7: webhook de entrada com teste e status [A14]

- [ ] **Passo 1:** em `src/components/gatilhos/webhooks-de-entrada.tsx`: botão
  copiar URL e exemplo `curl` com assinatura; status da última chamada:
  "nunca chamado", "autenticada em <data>", "assinatura inválida em <data>"
  (ler se a última chamada já guarda o resultado; se não guarda, acrescentar
  coluna numa migration nova e aplicar só no local).
- [ ] **Passo 2:** apagar explica que integrações externas deixam de funcionar.
- [ ] **Passo 3:** commit `feat(gatilhos): webhook mostra a última chamada`.

### Tarefa 5.8: abas responsivas [A02]

- [ ] **Passo 1:** print celular de Automações; se as abas cortarem, rolagem
  horizontal com indicador de mais conteúdo e aba ativa sempre visível
  (`scrollIntoView` no carregamento).
- [ ] **Passo 2:** commit `fix(automacoes): abas utilizáveis no celular`.

---

## Fase 6: Transmissões e conexões

### Tarefa 6.1: consumo real do dia na prévia [T03, C10]

**Arquivos:** `src/components/transmissoes/nova-transmissao.tsx:101-147`,
`src/server/acoes-transmissoes.ts:441-466`, repositório de transmissões.

- [ ] **Passo 1:** função de repositório `enviadasHojePelaConta(clienteId, agora)`
  (conta destinatários de transmissões aceitas no dia, no mesmo critério que o
  limite usa) com teste de integração: `conta as de hoje e ignora as de ontem e as canceladas antes de sair`.
- [ ] **Passo 2:** a página passa o valor real para `NovaTransmissao` (não mais
  `0`) e a ação recalcula no servidor antes de criar; se estourar, devolve erro
  com os números ("Hoje já saíram 180 de 250. Esta lista tem 120.").
- [ ] **Passo 3:** a prévia mostra "Cabem 70 hoje" / "Passa do limite de hoje em 50".
- [ ] **Passo 4:** commit `fix(transmissoes): prévia usa o consumo real do dia`.

### Tarefa 6.2: progresso sem uma consulta por linha [C09]

- [ ] **Passo 1:** trocar `progressoDa` por transmissão
  (`transmissoes/page.tsx:89`) por uma consulta agregada `progressoDas(ids)`
  que devolve um mapa. Teste de integração comparando o resultado com o antigo
  para 3 transmissões.
- [ ] **Passo 2:** commit `perf(transmissoes): progresso da lista numa consulta só`.

### Tarefa 6.3: lista com filtros, detalhe e próxima ação [C11, T02]

- [ ] **Passo 1:** filtros Estado e Período na lista (mesma barra de lista).
- [ ] **Passo 2:** detalhe da transmissão (rota nova
  `transmissoes/[transmissaoId]`): números entregue/retida/falha, lista paginada
  de destinatários com estado e motivo, link para o contato.
- [ ] **Passo 3:** para cada motivo de parada, a próxima ação: modelo pausado →
  link para o modelo; falha sem retry → "não há nova tentativa automática".
- [ ] **Passo 4:** commit `feat(transmissoes): filtros, detalhe por destinatário e próxima ação`.

### Tarefa 6.4: estados de conexão em camadas [C01, C04, C05, C02]

- [ ] **Passo 1:** função pura `estadoDaConexao(dados)` em
  `src/core/conexoes.ts` que devolve `{ configurado, autorizacao: 'valida' |
  'vence_em_breve' | 'vencida' | 'nao_se_aplica', ultimoEvento: string | null,
  falha: string | null, proximaAcao: { texto, href } | null }`. Teste unitário
  cobrindo: canal sem evento recente continua "valido" (não é falha); token
  vencido pede reconectar; página de anúncio sem webhook pede reinscrever.
- [ ] **Passo 2:** usar a função em Integrações, WhatsApp, Instagram, Anúncios e
  no selo do Início ("Atendendo agora" vira "Configurado · último evento há 2 h").
- [ ] **Passo 3:** o resumo "N de M" das integrações passa a ser derivado da
  mesma lista do catálogo (C02), Telegram como "indisponível", fora da conta.
- [ ] **Passo 4:** commit `feat(conexoes): estado separa configurado, autorização, último evento e falha`.

### Tarefa 6.5: cartões de integração com ação explícita [T04, S06, C03]

- [ ] **Passo 1:** cada cartão diz a ação em texto ("Conectar", "Configurar",
  "Em breve"); cartão sem tela não parece clicável. Categoria visível (Canal,
  Anúncios, Loja, API). Texto do Telegram: "Telegram ainda não está disponível."
- [ ] **Passo 2:** commit `feat(integracoes): cartões dizem o que dá para fazer`.

### Tarefa 6.6: WhatsApp separado em saúde, respostas e webhook [T05, S05]

- [ ] **Passo 1:** no cartão do número: bloco "Estado da conexão" (sincronização,
  reconectar), bloco "O que o bot responde" com resumo "Responde em 3 de 4
  situações" e link para a situação sem fluxo publicado, bloco "Webhook".
- [ ] **Passo 2:** commit `feat(whatsapp): cartão do número separa saúde, respostas e webhook`.

### Tarefa 6.7: chaves de API com ciclo claro [T06, C07, C08]

- [ ] **Passo 1:** estado "testada em <data>" / "nunca testada" / "não dá para
  testar daqui"; "Trocar segredo" separado de "Excluir"; excluir lista os blocos
  que usam a chave. Nada de testar URL arbitrária (manter a regra C08).
- [ ] **Passo 2:** commit `feat(chaves): testar, trocar e excluir com efeito explicado`.

---

## Fase 7: acesso e papéis

### Tarefa 7.1: nomes de papel e resumo de acesso [E2, E3, E1, E4, E13]

**Arquivos:** `src/app/clientes/[clienteId]/ajustes/equipe/page.tsx:19-23`,
`src/components/conta/linha-da-equipe.tsx`, `src/components/conta/editor-de-acesso.tsx`,
`src/core/permissoes.ts` (só textos e função de resumo; **não mudar política**)

- [ ] **Passo 1:** função pura `resumoDoAcesso(regras)` em `src/core/permissoes.ts`
  que devolve frases humanas ("Vê só os contatos dela", "Vê a equipe Norte",
  "Pode exportar", "Não vê valores"). Teste unitário para `owner`, `member` sem
  sobrescrita, preset de atendimento com escopo próprio, escopo de equipe sem
  equipe ("não alcança nenhum contato").
- [ ] **Passo 2:** rótulos: Proprietário / Administrador da conta / Membro;
  presets "Acesso de gestão" e "Acesso de atendimento"; bloco "Ajustes
  avançados" recolhido com a matriz de capacidades.
- [ ] **Passo 3:** a linha de cada pessoa mostra o resumo e alertas ("toda a
  conta", "sem alcance", "2 equipes").
- [ ] **Passo 4:** escopo de equipe sem equipe: salvar mostra o aviso e pede
  confirmação [E14].
- [ ] **Passo 5:** commit `feat(equipe): papéis com nome claro e resumo do acesso`.

### Tarefa 7.2: menu por capacidade e tela de sem acesso [E7, E8, E12]

- [ ] **Passo 1:** `secoesVisiveis` (`src/components/design/secoes-do-cliente.tsx:96`)
  recebe o mapa de capacidades e esconde o que a pessoa não pode usar. Teste
  unitário: membro com acesso de atendimento não vê Automações nem Transmissões.
- [ ] **Passo 2:** `exigirCapacidadeNaPagina` recusada renderiza componente
  `SemAcesso` com motivo ("Seu acesso não inclui Automações. Fale com o
  proprietário da conta.") em vez de 404/redirect silencioso. Recurso desligado
  (CRM desativado) tem outra tela: "O funil está desligado nesta conta" com link
  para Objetivo e recursos (se a pessoa puder).
- [ ] **Passo 3:** percorrer as rotas com um membro de acesso de atendimento no
  ambiente local e registrar num quadro no "Registro de execução" quais rotas
  abrem, quais mostram SemAcesso (E12).
- [ ] **Passo 4:** commit `feat(acesso): menu mostra só o que a pessoa pode usar`.

### Tarefa 7.3: suporte 4YU inequívoco [E9]

- [ ] **Passo 1:** faixa fixa no topo quando `af_usuarios.role = 'admin'` e não é
  membro da conta: "Você está nesta conta como Suporte 4YU. Suas ações ficam
  registradas com o seu nome." com link "Sair da conta".
- [ ] **Passo 2:** commit `feat(suporte): faixa de modo suporte em toda tela da conta`.

### Tarefa 7.4: Pessoas e acesso, e remoção com destino [E5, E20, E15, S07, E6 parcial]

- [ ] **Passo 1:** página renomeada "Pessoas e acesso" com três blocos: Pessoas,
  Equipes, Distribuição do atendimento.
- [ ] **Passo 2:** remover pessoa com pendências exige escolher destino
  (reatribuir para X, deixar sem responsável) antes de confirmar; ação no
  servidor faz a reatribuição e a remoção juntas. Teste de integração:
  `remover com destino reatribui conversas, cartões e atividades abertas`.
- [ ] **Passo 3:** arquivar equipe lista quem perde alcance.
- [ ] **Passo 4:** cadastro de pessoa com senha ganha o aviso "Acesso
  provisório: peça para a pessoa trocar a senha no primeiro acesso." (convite
  por e-mail fica na tarefa 10.6).
- [ ] **Passo 5:** commit `feat(equipe): pessoas e acesso, remoção com destino das pendências`.

### Tarefa 7.5: "Você": perfil próprio no rodapé da barra lateral (pedida pelo Gabriel em 23/09)

**Por quê:** o rodapé mostra o nome da **empresa** ("MGM Pilates", "dono da
conta") e não diz **quem está usando**. E quem tem acesso de atendimento não
entra em Configurações (tarefa 7.2), então nome, foto e senha próprios não
podem morar lá. O perfil é da pessoa, não da conta: vale igual para
proprietário, gestão e atendimento.

**Arquivos:** `src/components/design/barra-lateral.tsx` (rodapé e o diálogo
"Conta e perfil"), `src/components/design/cliente-shell.tsx` (`PAPEIS`, dados
da sessão), `af_usuarios.image` (coluna já existe, `0019_login_por_usuario.sql`).

- [ ] **Passo 1: rodapé mostra a pessoa.** Foto (ou iniciais) + **nome da
  pessoa** + estado (Disponível/Ausente, com a bolinha). O nome da **conta** sobe
  para o topo da barra, logo abaixo do logo (junto de "Todos os clientes" para
  quem tem mais de uma): continua respondendo "estou na conta certa?", que era
  o motivo de ele estar no rodapé.
- [ ] **Passo 2: o diálogo vira "Você".** Em cima, a pessoa: foto, nome, e-mail
  e o papel nesta conta com os nomes da 7.1 ("Proprietário · MGM Pilates",
  "Acesso de atendimento · MGM Pilates"; nunca mais "dono da conta"). Embaixo, as
  ações: **Editar perfil**, **Trocar senha**, Disponível/Ausente, Avisos, Tema,
  **Trocar de conta** (só com mais de uma), Sair.
- [ ] **Passo 3: o que cada um vê.** Proprietário e administrador da conta: tudo
  acima + atalho "Configurações da conta". Acesso de gestão: igual, e o atalho
  só aparece se o acesso incluir alguma configuração. Acesso de atendimento: só
  o perfil próprio, sem atalho nenhum para Configurações. Suporte 4YU: selo
  "Suporte 4YU" no lugar do papel (casa com a faixa da 7.3).
- [ ] **Passo 4: Editar perfil** (modal): nome e foto. A ação no servidor só
  mexe na **própria** sessão (`sessaoAtual().usuario.id`), nunca aceita id vindo
  da tela, e não pede capacidade nenhuma. Foto: jpg/png/webp até 2 MB, recortada
  quadrada. **Storage é global ao projeto dividido com a Verandi**: bucket
  próprio `autofluxos-avatares`, criado por migration **só no Supabase local**;
  produção fica pendente no fim deste plano para o Gabriel autorizar. Sem foto,
  iniciais.
- [ ] **Passo 5: Trocar senha** (modal): senha atual + nova (mínimo do cadastro),
  pela troca de senha do Better Auth. Resolve o "acesso provisório" da 7.4
  ("peça para a pessoa trocar a senha no primeiro acesso").
- [ ] **Passo 6:** testes: integração "editar perfil só altera o próprio usuário"
  e "nome vazio é recusado"; e2e com um membro de acesso de atendimento: troca o
  próprio nome e a foto pelo rodapé, e o menu não mostra Configurações. Prints
  do rodapé e do diálogo para proprietário e atendimento, desktop e celular.
- [ ] **Passo 7:** commit `feat(perfil): você no rodapé, com nome, foto e senha próprios`.

---

## Fase 8: atendimento, Inbox e ficha

Ler `05-atendimento-crm.md` inteiro antes. Preservar os invariantes da seção
"Invariantes do sistema interligado" daquele arquivo.

### Tarefa 8.1: estado do atendimento num lugar só [X03, X02]

- [ ] **Passo 1:** função pura `estadoDoAtendimento(contato, conversa)` →
  `'bot' | 'aguardando_humano' | 'com_humano' | 'encerrado'` com dono e efeito,
  teste unitário dos quatro.
- [ ] **Passo 2:** cabeçalho da conversa (Inbox e ficha) mostra o estado, o dono
  e a próxima ação (Assumir / Finalizar atendimento / Devolver ao bot). Finalizar
  confirma "Na próxima mensagem o bot volta a responder".
- [ ] **Passo 3:** a fila separa "não lida para você" de "com responsável";
  abrir nunca atribui.
- [ ] **Passo 4:** commit `feat(inbox): estado do atendimento claro e igual no Inbox e na ficha`.

### Tarefa 8.2: um compositor com três modos [X05, X20]

- [ ] **Passo 1:** fora da janela de 24h o compositor continua na tela em modo
  "modelo" (texto livre desabilitado com o motivo), rascunho preservado ao trocar
  de modo e de aba.
- [ ] **Passo 2:** respostas rápidas viram busca com teclado (`/` abre), sem
  empurrar o compositor. **Preservar** o seletor de produto que o outro agente
  pôs na barra do compositor (`src/components/lead/seletor-de-produto.tsx`,
  `icones-da-barra.tsx`, commit `5e736ef`): produto e resposta rápida são duas
  entradas da mesma barra, com o mesmo padrão de busca por teclado. Ler
  `responder.tsx` inteiro antes, ele mudou depois da revisão.
- [ ] **Passo 3:** commit `feat(inbox): compositor único com texto livre, modelo e bloqueado`.

### Tarefa 8.3: próximos passos separados por tipo [X04, X10, X08]

- [ ] **Passo 1:** ações rápidas agrupadas: "Para a equipe" (atividade, adiar)
  e "Para o contato" (agendar mensagem).
- [ ] **Passo 2:** na ficha, aba Atividades mostra três tipos com rótulo de quem
  executa (Pessoa / Mensagem agendada / Acompanhamento automático) e a contagem
  da aba diz o que conta.
- [ ] **Passo 3:** resumo fixo no topo da ficha: dono, estágio, última entrada,
  próxima atividade, mensagem agendada, estado do bot.
- [ ] **Passo 4:** commit `feat(ficha): próximos passos separados e resumo fixo`.

### Tarefa 8.4: ganhar, perder e segmento dizem o efeito [X09, X12, X13, X14]

- [ ] **Passo 1:** modal de ganhar/perder lista o que acontece (venda registrada,
  estágio do contato, próximo funil) e o que não acontece (a conversa não é
  encerrada).
- [ ] **Passo 2:** segmento sem condição mostra "Todos os contatos"; prévia
  antiga fica marcada como desatualizada quando a regra muda.
- [ ] **Passo 3:** adicionar ao funil diz adicionados / já estavam (com link) / falharam.
- [ ] **Passo 4:** commit `feat(crm): ganhar, perder, segmento e funil explicam o efeito`.

### Tarefa 8.5: contexto preservado entre telas [X07, X01, X16, H10]

- [ ] **Passo 1:** ficha aceita `?aba=` (visao, atividades, historico, dados,
  conversa) e `?volta=` (URL interna validada: precisa começar com
  `/clientes/<id>/`); o botão voltar usa `volta` quando existir.
- [ ] **Passo 2:** Inbox aberto por link de conversa fora do filtro mostra "Esta
  conversa está fora do filtro atual".
- [ ] **Passo 3:** mutações na ficha e no Inbox chamam o mesmo `recarregar` de
  contato; conferir com Playwright: concluir atividade na ficha e voltar ao
  Inbox mostra o estado novo sem recarregar.
- [ ] **Passo 4:** commit `feat(navegacao): ficha e Inbox preservam o contexto de onde a pessoa veio`.

### Tarefa 8.6: acessibilidade e lote de arquivos [X18, X19, X06, X15, X17]

- [ ] **Passo 1:** ações de fixar/não lida visíveis no foco e no toque, alvo mínimo 24 px.
- [ ] **Passo 2:** revisão de anexos: foco inicial, Esc fecha, foco volta ao botão.
- [ ] **Passo 3:** envio de vários arquivos lista enviados / pendentes / falhos por nome; tentar de novo só os pendentes.
- [ ] **Passo 4:** conferir rótulos de data e hora (dia sem hora nunca mostra hora; mensagem agendada mostra fuso).
- [ ] **Passo 5:** importação com pendências: tentar de novo só as linhas recusadas.
- [ ] **Passo 6:** commit `fix(atendimento): foco, toque e envios parciais`.

---

## Fase 9: Início orientado a pendência [H05, N04, C01]

### Tarefa 9.1: "Precisa de você" com o que existe

- [ ] **Passo 1:** o bloco lista, no escopo da pessoa: conversas aguardando
  humano, atividades vencidas, atividades de hoje, conexões com falha conhecida
  (da tarefa 6.4). Cada linha é link para a lista já filtrada
  (`/atividades?recorte=vencidas`, `/inbox?...`).
- [ ] **Passo 2:** "Ninguém esperando" só aparece quando tudo for zero.
- [ ] **Passo 3:** "Deixe o sistema com a sua cara" / "Personalizar sistema"
  some depois do onboarding concluído e o botão vira "Objetivo e recursos"
  (renomeação da Fase 10).
- [ ] **Passo 4:** métricas que ficaram na home saem para Relatórios (Fase 11);
  enquanto Relatórios não existe, deixar como está.
- [ ] **Passo 5:** prints `inicio`; commit `feat(inicio): o que precisa de você inclui agenda e conexões`.

---

## Fase 10: Configurações reorganizadas

### Tarefa 10.1: grupos e nomes novos [E17, E18, E19, E20, E21, E22]

**Arquivo:** `src/components/design/itens-de-ajustes.ts:19-66`

Estrutura alvo (rotas não mudam):

| Grupo | Itens |
|---|---|
| Organização | Dados da empresa · Pessoas e acesso · Objetivo e recursos · Plano e consumo |
| Canais | WhatsApp · Instagram |
| Automação de resposta | Conhecimento da IA · Horário e retomada |
| Ferramentas do atendimento | Respostas rápidas · Etiquetas · Catálogo · Arquivos e mídias |

**Catálogo mudou depois da revisão** (commits `68d0c59`, `e760fe6`, `8626880`,
`53c468a`): importa planilha, vira a loja do bot quando não há Magento, manda
card no Inbox e avisa quando o catálogo vem da Magento. Consequências:
descrição do item na busca e na Visão geral passa a ser "Produtos que a equipe
manda no Inbox e o bot consulta"; com Magento ligada, o cartão da Visão geral
mostra "vem da Magento" em vez da contagem local; Loja Magento continua em
Conexões e APIs. A tela de Produtos já tem `AjudaDaTela`: é o modelo para as
outras telas desta fase.
| Conexões e APIs | Todas as conexões · Anúncios · Chaves de API |

- [ ] **Passo 1:** aplicar a tabela; sinônimos na busca: "retomada" → Horário,
  "equipe" → Pessoas e acesso, "personalizar" → Objetivo e recursos,
  "integração" → Todas as conexões.
- [ ] **Passo 2:** commit `feat(configuracoes): grupos por intenção e nomes que dizem o que a tela faz`.

### Tarefa 10.2: trilha de primeira configuração [S01]

- [ ] **Passo 1:** no topo da Visão geral, enquanto houver pendência: Dados da
  empresa → Canal → Horário e conhecimento → Automação publicada → Testar. Cada
  passo com estado (feito, pendente, bloqueado e por quê) e link. Reaproveitar o
  cálculo de `primeiros-passos.tsx` (não duplicar a regra).
- [ ] **Passo 2:** commit `feat(configuracoes): trilha de primeira configuração`.

### Tarefa 10.3: formulários com resultado próprio [S02, S03, S04, S08]

- [ ] **Passo 1:** Dados da empresa: "Salvo" persistente depois de salvar; quem
  não pode editar vê os dados sem campos.
- [ ] **Passo 2:** Conhecimento da IA: dois cartões, "Conhecimento usado nas
  respostas" e "Credencial do provedor" (chave sempre mascarada).
- [ ] **Passo 3:** Horário: dois cartões com salvar e sucesso independentes,
  "Horário de atendimento" e "Retomada após inatividade".
- [ ] **Passo 4:** Plano: "Seu plano e consumo" (todos veem) separado de
  "Solicitar alteração" (proprietário/administrador), com estado do pedido.
- [ ] **Passo 5:** commit `feat(configuracoes): cada formulário mostra o próprio resultado`.

### Tarefa 10.4: entrada, erro e contexto [S09, S12, S11, E10, E11]

- [ ] **Passo 1:** títulos: `/cadastrar` "Criar seu acesso", `/primeiro-acesso`
  "Criar sua empresa", `/criar-conta` "Cadastrar administrador da plataforma";
  cada um diz o que acontece depois.
- [ ] **Passo 2:** `error.tsx` e `not-found.tsx` voltam para a conta ativa quando
  der, senão `/contas`; admin 4YU volta para `/admin/contas`.
- [ ] **Passo 3:** com uma conta só, o nome da conta no rodapé vira menu "Conta e
  perfil" (papel nesta conta, ajuda, sair).
- [ ] **Passo 4:** `/f/[token]` expirado mostra a data e o caminho para pedir outro.
- [ ] **Passo 5:** commit `feat(entrada): telas de acesso e erro dizem onde a pessoa está`.

### Tarefa 10.5: área admin com escopo escrito [S10, E16]

- [ ] **Passo 1:** subtítulo em cada tela admin ("Usuários da plataforma",
  "Contas de clientes", "Registro de auditoria da plataforma").
- [ ] **Passo 2:** commit `feat(admin): cada tela diz o próprio escopo`.

### Tarefa 10.6: convite por e-mail [E6] (depende do envio transacional)

- [ ] **Passo 0:** conferir se `autofluxos.mail.4yu.com.br` já tem DKIM da
  Brevo ativo (ver `4yu-apps/CLAUDE.md`, seção dos namespaces). Se não tiver,
  **parar esta tarefa** e registrar no fim deste arquivo o que falta.
- [ ] **Passo 1:** tabela `af_convites` já existe: ler o uso atual antes de
  desenhar. Convite com link de uso único e validade de 7 dias; a pessoa define
  a própria senha.
- [ ] **Passo 2:** commit `feat(equipe): convite por e-mail em vez de senha combinada`.

---

## Fase 11: Relatórios [C13, C14, H05]

### Tarefa 11.1: rota e primeira versão

**Arquivos:**
- Criar: `src/app/clientes/[clienteId]/relatorios/page.tsx`
- Modificar: `src/components/design/secoes-do-cliente.tsx` (item "Relatórios" no grupo do dia a dia, logo abaixo de Funil de vendas, visível só com a capacidade de ler métricas)
- Usar: `src/server/repos/metricas.ts` (`medirDesfechos`, `medirTempos`, `serieDiaria` :248)

- [ ] **Passo 1:** ler `metricas.ts` e listar no "Registro de execução" quais
  métricas existem, com a definição de cada uma.
- [ ] **Passo 2:** período (7, 30, 90 dias, personalizado) em `?de=&ate=`,
  comparação com o período anterior de mesmo tamanho.
- [ ] **Passo 3:** cartões com os totais do período e a variação; cada cartão
  tem um "?" com a definição e o fuso.
- [ ] **Passo 4:** série diária com **todos os dias do período**, zero incluído
  (função pura `completarDias(serie, de, ate)` com teste unitário), gráfico
  seguindo a skill `dataviz`.
- [ ] **Passo 5:** escopo: pessoa com escopo próprio vê só os números dela;
  teste de integração `relatório de quem vê só os próprios não soma a conta inteira`.
- [ ] **Passo 6:** métricas que estavam na home e agora estão aqui saem da home
  (a home fica com pendências e um link "Ver relatórios").
- [ ] **Passo 7:** prints `relatorios inicio`; commit `feat(relatorios): primeira versão com período, comparação e série diária`.

---

## Fase 12: validação integrada [H10]

### Tarefa 12.1: percorrer as jornadas

- [ ] **Passo 1:** com o ambiente local, percorrer a matriz "Ligações entre
  telas" de `08-handoff-execucao.md` e anotar cada jornada como OK ou com
  defeito (e o defeito vira tarefa nova no fim deste arquivo).
- [ ] **Passo 2:** personas: proprietário, membro com acesso de gestão, membro
  com acesso de atendimento (escopo próprio). Criar os dois membros no local
  com o script de seed ou pela tela.
- [ ] **Passo 3:** prints finais de todas as telas em
  `docs/revisao-ux-ui-2026-09-23/prints-depois/` e atualização de
  `docs/revisao-ux-ui-2026-09-23/00-cobertura.md` (coluna de cobertura passa a
  "Validada em navegador" onde for o caso).
- [ ] **Passo 4:** commit `docs(ux): validação integrada e prints finais`.

---

## Fora deste plano, de propósito

| Ticket | Por quê |
|---|---|
| T01 | Rascunho de transmissão é estado técnico de segundos; a revisão não achou jornada perdida. Regra preservada, sem tarefa. |
| C06 | Escape manual do WhatsApp só aparece em ambiente sem variáveis Meta, que não é o de cliente. |
| C12 | Abas de Transmissões como link não provaram perda de contexto. Rever só se a validação da Fase 12 mostrar problema. |
| C15 | Smoke com provedor falso é trabalho de teste, não de UX; entra num plano de confiabilidade. |
| X21 | Virtualizar histórico só se a medição mostrar lentidão em conversa longa. |
| Selecionar o resultado inteiro | Decisão do topo: seleção continua por página. |

## Registro de execução

Uma linha por tarefa concluída ou desvio: data, tarefa, commit, observação.

- 23/09: plano escrito; ambiente local e prints de antes em `prints-antes/`.
- 23/09: conferidos os commits do outro agente (`b211466` a `53c468a`: catálogo,
  loja, card de produto no Inbox, telefone legível). Plano ajustado: 0093 não é
  mais pendente, `telefoneLegivel` e `AjudaDaTela` viram peças obrigatórias,
  compositor do Inbox preserva o seletor de produto, Catálogo com nova descrição.
  Nenhuma tarefa do plano foi feita por eles; nenhuma sai do plano.
- 23/09, tarefa 0.3: o "30 pessoas" não era o tamanho da página. Contatos e o
  CSV chamavam `paginarLeads` sem `estado`, e o padrão é o do Inbox (`aberta`):
  quem teve a conversa resolvida sumia da lista e do total. Os dois passam
  `estado: 'todas'`. O "de N" com filtro usa `contarLeads`.
- 23/09, tarefa 1.1: busca sem acento sem `unaccent` (extensão é global ao
  banco dividido): o termo vira regex com classes de acento e vai por `imatch`
  (`padraoSemAcento` em `src/core/atividades.ts`). Responsável `ninguem` com
  escopo de equipe devolve vazio (sem responsável não é de equipe nenhuma).
- 23/09, tarefa 1.2: a criação não conferia se o responsável é da conta (o plano
  dizia "mesma checagem da criação"). A checagem nova mora em
  `atribuirAtividade` (`af_membros`). `prazoDoDia` saiu da ação para
  `src/core/atividades.ts`, e criar e reagendar usam a mesma. Com escopo
  `proprios`, reagendar/atribuir conferem o dono (`conferirDono`).
- 23/09, tarefa 1.3: o botão "+ Nova atividade" entra junto com o diálogo, na
  1.5 (botão sem ação na tela seria pior). `agenda()` foi removida (só a
  página e o menu a usavam); o contador do menu passou a usar
  `contagensDaAgenda` (contagem exata, mesma regra dos atalhos, sem o teto de
  200). O clique no número leva a `?recorte=vencidas` (ou `hoje`).
- 23/09, tarefa 1.4: a ficha não tinha diálogo de cancelar para extrair; ele
  nasceu em `src/components/atividades/cancelar-atividade.tsx`. O e2e cria o
  contato direto no banco local: **conta nova sem canal não mostra "+ Criar
  contato"** (a tela vazia de Contatos só manda conectar número). Achado para a
  Fase 2. `.env.teste-local` precisou de `DATABASE_URL` local para o e2e subir.
  Helpers de cadastro do e2e foram para `test/e2e/cadastro.ts`.
- 23/09, tarefa 1.5: a criação passou a conferir o responsável escolhido
  (`ehMembroDaConta`, extraída de `atribuirAtividade`; escopo `proprios` só cria
  para si) e o negócio (precisa estar em `oportunidadesAbertasDoContato` do
  contato, no escopo de quem cria). A busca de contato do diálogo é
  `paginarLeads` e **ainda depende de acento** ("marcia" não acha "Márcia"):
  herda a correção da tarefa 2.3. "Ver" no aviso leva à agenda aberta, sem
  recorte nem busca, no alcance do responsável. A ficha continua com o
  formulário dela (fora do escopo da 1.5).
- 23/09, tarefa 1.6: a semana do calendário vai de segunda a domingo e o dia de
  cada atividade é o dia UTC (`diaDoPrazo`), a régua de `urgenciaDe`. O
  calendário lê no máximo 600 com prazo (`TETO_DO_CALENDARIO`) e avisa quando
  corta; a faixa "Sem prazo" mostra 6 e leva à lista para ver todas. A semana
  não é grade de horas: as atividades vêm em ordem de hora dentro do dia, com a
  hora escrita (grade de horas com 5 tipos e poucas com hora ficaria vazia).
- 23/09, tarefa 1.7: `SeletorDePessoa` (modal, busca sem acento no navegador,
  opções fixas no topo, Enter com um resultado só escolhe) serve o "Atribuir
  tarefa…" do menu, o filtro Responsável e também o responsável de "Nova
  atividade" (tinha o mesmo problema da lista longa).
- 23/09: tarefa 7.5 (perfil próprio no rodapé) entrou no plano a pedido do
  Gabriel. Os nomes dos papéis continuam os da tabela de decisões.
- 23/09, tarefa 2.1: o passo 3 já valia (Contato nunca foi oferecido no
  "Colunas"). Achado: no celular a página inteira rolava 913px para o lado,
  porque o `sr-only` do cabeçalho de Ações é `absolute` e o contêiner de
  rolagem não era `relative`; agora é. No celular a coluna Contato fixa tem
  176px (o nome trunca), senão as duas fixas tomavam a tela.
- 23/09, tarefa 2.2: a causa estava na origem, `CLASSE_DA_COR`
  (`src/core/etiquetas.ts`), que só tinha a versão do tema escuro; a correção
  vale para toda ficha de etiqueta (tabela, ficha, Inbox, seletor, barra de
  seleção). `dark:` do Tailwind passou a seguir `data-tema` (antes seguia o
  sistema): corrige de quebra os três `dark:` que já existiam.
