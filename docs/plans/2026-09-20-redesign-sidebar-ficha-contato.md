# Sidebar e ficha completa do contato — Implementation Plan

**Goal:** Transformar o painel do cartão e a ficha completa em interfaces consistentes com o novo funil, com hierarquia clara, edição contextual e ações funcionais.

**Architecture:** Reutilizar as Server Actions e regras do CRM existentes. Componentes client cuidam de edição, abas e diálogo; a página server continua carregando os dados e aplicando permissões. Nenhuma migration, alteração de Auth, Storage, schema ou dado de produção é necessária.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind 4, componentes nativos de diálogo/popover e design tokens existentes (Outfit, temas claro/escuro).

## Autorização e sequência

Pedido do usuário: primeiro escrever este plano, depois implementar a sidebar, validar, fazer commit e push, e **só então** implementar a ficha completa. Execução já autorizada, sem nova rodada de aprovação. Preservar trabalho alheio. Push em main aciona o deploy deste projeto e foi explicitamente solicitado.

- [x] Inspecionar componentes, ações e estado dos dois repositórios.
- [x] Registrar plano durável antes de escrever código.
- [x] Etapa 1: sidebar implementada e validada.
- [x] Etapa 1: commit e push concluídos: `1e7504e`, publicado em `origin/main`.
- [ ] Etapa 2: ficha completa implementada e validada.
- [ ] Etapa 2: commit/push e registro final.

## Direção de UX/UI

**Sidebar = contexto rápido e decisões.** Cabeçalho horizontal com avatar, nome editável, telefone legível e fechar. Contexto do funil/etapa visível. Resumo da oportunidade com título/valor editáveis, situação e tempo na etapa. Campos com os mesmos rótulos, tamanhos, espaçamentos e tratamento de foco. Ações de conclusão no contexto da negociação, dados do contato em seção separada, notas editáveis, etiquetas e histórico recente sem uma lista infinita. Rodapé com “Ver ficha completa”.

**Ficha = visão geral do relacionamento.** Identidade e ação de conversa no cabeçalho; fase/responsável/estado organizados; visão geral como primeira aba. Oportunidades e próximos passos em destaque. Informações, etiquetas e anotação em cards com largura útil. Atividades, histórico, origem/dados coletados e conversa em áreas próprias. A conversa só aparece quando o usuário a escolhe, mantendo rascunhos ao trocar de aba.

Não confundir estágio do contato com etapa do funil. Não inventar temperatura, origem ou valores. Não permitir editar telefone identificador, datas de sistema ou histórico como se fossem campos livres. Reutilizar regras atuais de venda/perda, escopo do responsável e permissões de valores.

## Etapa 1 — Sidebar

### 1.1 Estrutura e acessibilidade

Arquivos: `src/components/quadros/painel-do-contato.tsx`, `src/components/quadros/quadro.tsx`, `src/app/globals.css`.

1. Usar diálogo lateral nativo para foco preso, Escape e retorno ao cartão.
2. Header compacto, corpo rolável e rodapé fixo; largura confortável no desktop e tela inteira no mobile.
3. Exibir nome do funil e etapa atual, sem confundir com estágio do relacionamento.
4. Tratar carregamento, erro com tentar novamente, contato ausente e fechamento de diálogos internos.

### 1.2 Edição e consistência

Arquivos: `src/components/quadros/temperatura-da-oportunidade.tsx`, `src/components/quadros/interesse-da-oportunidade.tsx`; criar componentes em `src/components/lead-crm/` se a edição puder ser reutilizada na ficha.

1. Reutilizar `acaoCorrigirNome`, `acaoSalvarNotas` e `acaoDescreverCartao` para edições explícitas com salvar/cancelar, pendência e erro.
2. Estágio, responsável, etiquetas, temperatura e interesse continuam usando suas ações atuais.
3. Unificar controles, rótulos e espaçamentos. Temperatura nula continua “Não avaliada”; clicar na opção atual pode limpar.
4. Título e valor são da oportunidade; responsável geral é do contato. Mostrar essa distinção.
5. Guardar edições locais confirmadas para não depender de fechar/reabrir o painel. Não apagar rascunhos em erros.
6. Histórico recente limitado com expansão opcional, notas e outros funis organizados em seções.

### 1.3 Validar e publicar o primeiro marco

- `npm run typecheck`.
- `npx eslint` apenas arquivos alterados; rodar lint geral e registrar bloqueios externos, se houver.
- Testes unitários relevantes de `src/core/quadros.test.ts` e `src/core/crm.test.ts`.
- Preview isolado com ações simuladas; Playwright para desktop/mobile/escuro, abrir/fechar painel, foco, editar/salvar/cancelar, erro/retry e menus internos. Nenhuma ação de teste contra produção.
- Revisar diff, `git diff --check`, `git add` explícito, commit e `git push origin main` sem force.
- Registrar hash e resultado do push neste plano **antes de iniciar a etapa 2**.

## Etapa 2 — Ficha completa

Arquivos principais:
- `src/app/clientes/[clienteId]/leads/[contatoId]/page.tsx`.
- `src/components/lead-crm/abas.tsx`, `acoes-da-ficha.tsx`, `negociacoes.tsx`, `informacoes.tsx` e componentes compartilhados da etapa 1.
- `src/app/globals.css` (classes específicas do CRM, sem alterar globalmente formulários de outras telas).

### 2.1 Composição

1. Substituir a coluna de 280px e conversa dominante por cabeçalho, contexto e navegação horizontal.
2. “Visão geral” abre por padrão: oportunidades/funis, próximos passos, resumo de relacionamento, informações e notas em grid responsivo.
3. Agrupar tarefas e acompanhamentos em “Atividades”; registros em “Histórico”; origem e campos do fluxo em “Dados e origem”.
4. “Conversa” continua funcional com resposta, citações, anexos, reações, limites da janela e rascunho preservado, mas não abre automaticamente.
5. Ações principais visíveis; agendamento e exclusão em menu contextual, mantendo confirmação de exclusão.
6. Atalhos de anotar/etiquetar devem abrir a aba correta antes de focar o campo. Abas com semântica completa e teclado.

### 2.2 Validação e encerramento

1. Conferir todos os dados/fluxos antigos: negociações, ganho/perda, informação de contato, etiquetas, notas, diário, campos, agenda, histórico, jornada, automação/handoff e chat.
2. Testar abas por teclado, estado inicial, navegação direta, preservação de rascunhos, mobile e tema escuro.
3. Rodar tipos, lint dos arquivos alterados, testes pertinentes e diff check.
4. Atualizar este documento, commit e push do segundo marco. Relatar hashes, validações e limitações reais.

## Contexto de retomada

- Início com árvore limpa em `main`, HEAD `a5329ba`. O redesign anterior do funil já está versionado (inclui `6f784e3`).
- `docs/BANCO-COMPARTILHADO.md` foi lido inteiro; Verandi estava limpa em `43b39af`. Sem mudanças de banco planejadas.
- O painel atual busca `acaoAbrirPainelDoContato` sob demanda. Seus dados não se atualizam automaticamente só com revalidate da rota: considerar atualização local após edição.
- `Modal`/`Dropdown` existentes usam top layer. Não colocar diálogo dentro de popover que é ocultado; manter irmãos, como no seletor de funis.
- Não substituir fechamento comercial por marcação simples: `Quadro` já escolhe `RegistrarVenda` ou `FecharCartao` conforme finalidade.
- Preview anterior disponível em `/tmp/autofluxos-ui-preview/`, se ainda existir; adaptar mocks, nunca usar credenciais de produção para testar UI.
- Lint geral no trabalho anterior tinha erros fora do escopo em inbox/home/fila. Reavaliar o estado atual em vez de assumir que continuam iguais.

## Registro de execução

Etapa 1 implementada: diálogo nativo de 480px, cards por contexto, edição de nome/nota/título/valor, etapa editável pelo caminho do quadro, controles consistentes, histórico limitado e retry de carregamento. `Dropdown` e criação de etiqueta tratam Escape sem fechar o diálogo pai. Limites do domínio reutilizados (nome 120, título 60, nota 2000).

Validação: TypeScript e ESLint dos arquivos alterados passaram; Playwright isolado comprovou leitura, salvar/cancelar, falha preservando rascunho, retry, modal interno, dropdown, movimentação, mobile e tema escuro. Capturas em `/tmp/autofluxos-ui-preview/sidebar-{desktop,mobile,dark}.png`. Sem acesso a produção nos testes. Lint global tem 3 erros preexistentes em inbox/page.tsx, clientes/[clienteId]/page.tsx e inbox/fila.tsx, mais 5 warnings. Próxima ação: commit/push da etapa 1, antes da ficha.

## Contrato visual do resultado final — wireframes e especificações

Esta seção é a referência de composição para continuidade por outra IA. **Wireframe** é o desenho da disposição; **wordmark** é uma marca formada por texto/logotipo. O pedido do usuário é por wireframes e especificação visual. Manter a direção do funil já aprovado, sem inventar outro design system.

### Tokens compartilhados

Usar os tokens existentes de `src/app/globals.css`; os valores abaixo identificam a intenção, o arquivo CSS é a fonte exata de verdade.

| Elemento | Tema claro | Tema escuro | Uso |
|---|---|---|---|
| Fundo da página/painel | `--canvas`, cinza muito claro | `--canvas`, quase preto azulado | Área atrás dos cards |
| Cards e campos | `--panel`, branco | `--panel`, azul petróleo quase preto | Superfícies de leitura/edição |
| Fundo secundário | `--surface` | `--surface` | Chips, grupos de temperatura e apoio |
| Texto principal | `--ink` | `--ink` | Nome, títulos e valores |
| Texto secundário | `--muted` / `--soft` | Mesmos tokens adaptativos | Rótulos, telefone, datas |
| Bordas | `--line` | `--line` | 1px discreto, sem caixa pesada |
| Destaque | `--primary`, azul do funil | `--primary`, azul adaptado | Ação principal, edição, aba selecionada, foco |
| Sucesso/perda/atenção | `--ok`, `--perigo`, `--aviso` | Mesmos tokens adaptativos | Estados reais; não decoração |

- Fonte **Outfit**, já usada no produto. Nenhuma nova fonte ou pacote de ícones.
- Nome do contato: 20–24px, peso 600–700, tracking leve negativo.
- Títulos de seção: 13px, peso 600. Rótulos dos campos: 11px, peso 500, sentence case.
- Texto/valores normais: 12–13px, entrelinha 1.5–1.7. Valor monetário destacado: 18–22px, algarismos tabulares.
- Micro-rótulos de contexto: 10px, uppercase, tracking .07em; usar apenas em contexto de funil/área.
- Cards: raio 12px, borda 1px, padding 18px. Campos e botões: raio 8px, altura 36–40px.
- Espaçamento: base 4px; 8px entre label/campo, 12–16px entre campos, 20px entre seções.
- Foco visível azul de 2px com afastamento. Animação discreta (180ms); desativar com reduced motion.
- Azul identifica ações. Verde/vermelho não devem pintar dois botões enormes disputando o painel inteiro.

### Wireframe A — Sidebar do cartão (desktop)

Largura: **480px**, limitada a 100vw. Altura: **100dvh**, encostada à direita. Quadro permanece visível atrás de backdrop de 26% preto/azulado com blur de 2px.

```text
QUADRO VISÍVEL ATRÁS                  ┌──────────────────────────────────────┐
                                     │ CONTATO · VISÃO RÁPIDA             ×  │
                                     │ [Avatar 44] Paulo Corrêa     Editar  │ HEADER FIXO
                                     │             +55 (11) 96540-2764     │
                                     ├──────────────────────────────────────┤
                                     │ ┌──────────────────────────────────┐ │
                                     │ │ COMERCIAL             Em aberto │ │
                                     │ │ Plano anual              Editar │ │
                                     │ │ R$ 2.400,00                     │ │
                                     │ │ ────────────────────────────── │ │
                                     │ │ Etapa no funil                  │ │
                                     │ │ [Novo                        ▾] │ │
                                     │ │ Há 4 dias nesta etapa           │ │
                                     │ │ [Marcar ganha] [Marcar perdida] │ │
                                     │ └──────────────────────────────────┘ │
                                     │                                      │
                                     │ ┌ Qualificação da oportunidade ───┐ │
                                     │ │ Temperatura                     │ │
                                     │ │ [ Frio  |  Morno  |  Quente ]   │ │ CORPO ROLÁVEL
                                     │ │ Não avaliada (se nula)          │ │
                                     │ │ Produto/serviço de interesse    │ │
                                     │ │ Plano anual          [Trocar]   │ │
                                     │ └──────────────────────────────────┘ │
                                     │ ┌ Relacionamento ─────────────────┐ │
                                     │ │ Estágio contato | Responsável   │ │
                                     │ │ [Novo ▾]        | [Eduardo ▾]   │ │
                                     │ │ ────────────────────────────── │ │
                                     │ │ Contato desde        há 4 dias  │ │
                                     │ │ Última interação         ontem  │ │
                                     │ │ Origem                  Direto  │ │
                                     │ └──────────────────────────────────┘ │
                                     │ [Mensagens agendadas, se houver]    │
                                     │ [Etiquetas                  + …]   │
                                     │ [Anotação da equipe      Editar]   │
                                     │ [Total em compras] [Nº compras]    │ só com dado autorizado
                                     │ [Outros funis, se houver]          │
                                     │ [Histórico recente: 5 registros]  │
                                     │ [Ver mais N registros]             │
                                     ├──────────────────────────────────────┤
                                     │ [Ver ficha completa             ↗] │ RODAPÉ FIXO
                                     └──────────────────────────────────────┘
```

**Oportunidade:** borda azul muito sutil (mistura de 24% primary com line), fundo panel e sombra quase imperceptível. Etiqueta de situação pequena no canto superior direito. Título/valor são editados juntos num modal; valor vazio significa não informado, nunca zero inventado. Etapa usa dropdown e o mesmo caminho de movimentação/conclusão já existente no quadro.

**Nome:** “Editar” abre modal com um campo, Salvar alterações e Cancelar. Nome máximo 120 caracteres. O telefone é link `tel:`; não é campo editável porque identifica a conversa no WhatsApp.

**Temperatura:** controle segmentado de três opções, fundo surface, opção selecionada com tinta suave da cor semântica. Nula é “Não avaliada”; clicar de novo limpa. Não usar a temperatura legada do contato.

**Interesse:** leitura clara à esquerda, Escolher/Trocar à direita. Ao editar, dropdown do catálogo e Salvar/Cancelar. Itens arquivados já vinculados continuam legíveis. Erro preserva seleção.

**Relacionamento:** estágio do contato e responsável pelo contato em duas colunas de largura igual; no menor mobile, uma coluna. Não rotular como responsável da negociação, pois são entidades diferentes. Datas/origem em linhas chave/valor sem repetição de telefone.

**Anotação:** texto legível + Editar; modal com textarea até 2000 caracteres. Salvar atualiza o texto na sidebar; Cancelar não grava. Histórico tem cinco itens e expansão opcional. Totais e outros funis aparecem só quando relevantes.

**Rodapé:** somente Ver ficha completa, largura total, discreto. Ganhar/perder pertencem ao card da oportunidade, não ao rodapé global.

### Wireframe B — Ficha completa (desktop)

Página central com largura máxima aproximada de **1280px**, margem horizontal de 24–28px, padding superior de 24px. A página rola como documento; nada de uma sidebar independente de 280px com dezenas de cards empilhados.

```text
← Contatos                                      FICHA DO CONTATO

[Avatar 52] Paulo Corrêa  [editar]               [Abrir conversa] [⋮]
            +55 (11) 96540-2764 · WhatsApp

┌────────────────────────────────────────────────────────────────────────┐
│ Estágio do contato       Responsável             Atendimento           │
│ [Qualificado        ▾]   [Eduardo Yamamoto ▾]     Em atendimento / …     │
└────────────────────────────────────────────────────────────────────────┘

 Visão geral      Atividades (2)      Histórico      Dados e origem      Conversa
 ━━━━━━━━━━━

┌──────────────────────────────────────────┐  ┌───────────────────────────┐
│ Oportunidades e funis                    │  │ Próximos passos           │
│                                         │  │ Atividade aberta mais     │
│ COMERCIAL                 Em aberto     │  │ próxima / estado vazio    │
│ Plano anual                      Editar │  │ [Ver atividades]          │
│ R$ 2.400,00                             │  │ Mensagens já agendadas    │
│ ● Novo · há 4 dias                      │  └───────────────────────────┘
│ [Ganhar] [Perder] [Abrir funil ↗]        │  ┌───────────────────────────┐
│                                         │  │ Relacionamento            │
│ [Outras oportunidades, se houver]        │  │ Total · Compras · Última   │
└──────────────────────────────────────────┘  │ Só fatos disponíveis      │
                                             └───────────────────────────┘
┌──────────────────────────────────────────┐  ┌───────────────────────────┐
│ Informações do contato                   │  │ Anotação da equipe Editar │
│ Telefone / Canal / Origem / Datas         │  │ Texto com largura útil    │
│ Linhas claras em grade, não torre estreita│  ├───────────────────────────┤
└──────────────────────────────────────────┘  │ Etiquetas                 │
                                             └───────────────────────────┘
```

**Grid da visão geral:** duas colunas, principal ~1.5fr e apoio ~1fr, gap 20px. Oportunidades têm prioridade; cards de apoio não devem forçar altura da principal. Não usar sticky na coluna longa. Tablet/mobile (<900px): uma coluna, mantendo ordem lógica: oportunidades, próximos passos, relacionamento, informações, notas/etiquetas.

**Cabeçalho:** identidade à esquerda; abrir conversa como única ação azul à direita. Menu ⋮ para agendar mensagem e exclusão (separada, vermelha e com confirmação). Ações de anotar/etiquetar podem ser atalhos do menu, mas precisam selecionar a visão geral e focar o bloco correto. Não criar botões decorativos.

**Faixa de contexto:** estágio/responsável claramente rotulados, estado do atendimento como status, não pill grande em caps lock. Se houver handoff, mostrar motivo e ação “Já atendi”. Controle do bot só aparece quando a conta possui automação. Informação operacional detalhada pertence à conversa/atividades, sem repetir dois banners dizendo o mesmo.

**Visão geral:** primeira aba, aberta por padrão. Os dados coletados pelo fluxo não ocupam a visão geral; ficam em Dados e origem. Diário/histórico extensos não ocupam a visão geral.

**Atividades:** tarefas humanas, mensagens agendadas e acompanhamentos automáticos em seções identificadas. Reutilizar os componentes e operações existentes. Não misturar “agendar mensagem” com “criar atividade”.

**Histórico:** linha do tempo e diário da equipe, com largura de leitura confortável. Eventos são registros, não campos editáveis.

**Dados e origem:** informações coletadas em grade responsiva; títulos legíveis, valores longos quebram linha. Jornada de anúncios abaixo/em seção própria. Valores desconhecidos ficam como ausentes, sem fonte/origem inventada.

**Conversa:** área explícita com título/aba, indicador da janela do WhatsApp e composer no rodapé. Preservar mensagens, anexos, citação, reações, autoria, entregas e permissões existentes. Painel com altura controlada de cerca de 640–720px no desktop (ajustada ao viewport), rolagem interna só para mensagens. Não montar um segundo chat no lado da ficha. Trocar abas preserva o rascunho; nenhuma ação envia mensagem automaticamente.

### Estados e comportamento obrigatórios

1. **Carregando sidebar:** identidade do cartão aparece imediatamente, skeleton apenas nos dados pendentes.
2. **Erro de leitura:** mensagem legível + Tentar novamente. Não deixar “carregando…” eterno.
3. **Salvando:** botão desabilitado com “Salvando…”. Fechar/cancelar gravação pendente não pode sugerir que ela foi desfeita.
4. **Erro de edição:** manter rascunho/seleção, exibir erro próximo ao formulário, permitir retry.
5. **Sucesso:** fechar editor, atualizar valor visível; nome editado refletido também no cartão do quadro.
6. **Modal interno:** Escape fecha primeiro o editor/dropdown, mantendo a sidebar. Escape na sidebar devolve foco ao cartão. Diálogo contém foco; fundo não recebe cliques.
7. **Abas:** role tab/tablist/tabpanel, aria-controls/labelledby, setas/Home/End e foco visível. Conversa e rascunhos não são desmontados ao trocar.
8. **Mobile sidebar:** largura 100vw, sem margem desperdiçada; header e footer fixos, corpo rolável, nada extrapola horizontalmente.
9. **Mobile ficha:** header quebra em identidade e ações; aba horizontal rolável; cards empilhados; campos em uma coluna quando necessário.
10. **Dark mode:** usar tokens semânticos, nunca fundos brancos/rosa-claro fixos em botões que deveriam adaptar ao tema.

### Evidências a registrar antes de cada marco

Capturas desktop claro, mobile e escuro; testes de abrir/fechar, salvar/cancelar/erro, navegação por teclado e menus dentro do diálogo. Registrar diferenças justificadas entre este contrato e o resultado se a inspeção do código exigir adaptar algum item. Não tratar o desenho ASCII como uma autorização para inventar dados ou capacidades inexistentes.


Marco 1 publicado: `1e7504e`, push confirmado (`a5329ba..1e7504e main -> main`). Início da etapa 2 após essa confirmação.
