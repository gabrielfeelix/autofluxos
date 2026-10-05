# Handoff 05/out/2026: caça a bug antes de abrir ao público

Leia antes: `AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`, `test/e2e/README.md`.
Gabriel é designer, não dev: quer decisão tomada e implementada, resposta curta,
commit e push na hora (push na `main` publica na Vercel). Sem travessão em
arquivo nenhum. Validar com `tsc`/`eslint`; suíte inteira não.

## A missão

Gabriel vai abrir o sistema ao público e quer garantia de que nada quebra.
Pedido literal: testar fluxos, filtros, dropdowns e botões que não funcionam,
todas as páginas, os fluxos mais importantes primeiro, **principalmente
Configuração**, e conferir se o que a tela muda **muda de verdade no banco**.
Ele vai ligar o Docker. Ele perguntou se dá para usar vários agentes Haiku.

**Primeira entrega: o plano de teste**, antes de sair testando. Mostre o plano
em uma tela curta e comece.

## Resposta sobre Haiku (já dada a ele, sustente)

Sim, com divisão de trabalho:

- **Haiku, em paralelo, só leitura**: varredura estática por área (uma rota ou
  pasta de componentes por agente) atrás de botão sem `onClick` ou com handler
  vazio, `Dropdown` cujo `aoMudar` não chega a ação nenhuma, filtro lido da URL
  e não aplicado na consulta, Server Action que não grava o campo que a tela
  mostra, `revalidatePath` faltando, texto "em breve". Saída: lista
  `arquivo:linha` + suspeita. Barato e não pesa na máquina.
- **Sonnet**: escrever specs Playwright a partir das suspeitas confirmadas.
- **Opus (thread principal)**: confirmar suspeita, corrigir, decidir. Correção
  é inline, nunca por subagente (preferência registrada do Gabriel).
- **Navegador e e2e: um por vez.** Ver restrições.

Workflow com muitos agentes é caro: diga o tamanho (quantos agentes, por quê)
e confirme com ele antes de disparar. Guia da sessão: até ~10 agentes.

## Restrições que custaram caro

- **Não derrubar a WSL**: um processo pesado por vez. Um `next dev` (ou
  `build`) e **um** spec Playwright por vez, nunca em paralelo com build.
  Vários Haiku lendo código em paralelo é ok; vários navegadores não.
- **Nunca testar contra produção.** O e2e e o `scripts/ux-local/dev.sh` leem
  `.env.teste-local` e recusam banco remoto. Produção é compartilhada com a
  Verandi (`app_verandi`); conta criada lá é dado em cliente de verdade.
- Leitura de produção para conferir dado: Management API com
  `SUPABASE_ACCESS_TOKEN` do cofre e ref literal `xxxynoshwirupkdzwxbj`,
  `read_only: true`. Escrita ou migration em produção só com autorização
  explícita dele.
- Telefone com DDD 44 em dado de cliente é teste do Gabriel, não cliente real.

## Como subir o ambiente local

```bash
npx supabase start                      # Docker precisa estar ligado
PORTA=3100 scripts/ux-local/dev.sh      # painel contra o banco local, tokens desligados
node scripts/ux-local/cadastro.mjs      # cria a conta de teste (antes do seed)
npx tsx scripts/ux-local/seed.mts       # dados de exemplo (ver também seed-vendas / seed-relatorios)
node scripts/ux-local/entrar.mjs        # login automatizado (leia o cabeçalho do script)
node scripts/ux-local/prints.mjs        # prints 1440 e 390
npx playwright test test/e2e/<um>.spec.ts   # um spec por vez
```

Specs já existentes em `test/e2e/`: agenda, contatos, contexto, duas-etapas,
esqueci-senha, jornada-chatbot-crm, perfil-atendimento, troca-de-conversa,
revisao-03-out. Atenção ao limite de 5 cadastros por IP em 5 min (README).

## Mapa para o plano (rotas em `src/app/clientes/[clienteId]/`)

Prioridade sugerida, do que mais quebra a confiança de quem chega:

1. **Cadastro, login, esqueci a senha, duas etapas** (porta de entrada).
2. **`configurar/`** (onboarding, objetivo e recursos) e **`ajustes/`**
   (conexões, credenciais, anúncios, equipe, horário, retomada do bot):
   salvar, recarregar, conferir no banco local.
3. **`fluxos/`** (editor, publicar, simulador) e o motor
   (`src/core/engine/executar.ts`, já tem testes unitários).
4. **`inbox/`**: filtros (abertas, meus atendimentos, não lidas,
   classificar), assumir, devolver à fila, transferir (modal novo), finalizar,
   agendar, marcar atividade, anotar, etiquetar, favoritar, emoji, anexos.
5. **`leads/`** (Contatos: filtros, colunas, ficha com abas Visão geral,
   Atividades, Automático, Histórico, Dados e origem, Conversa; apagar).
6. **`quadros/` e `negocios/`** (funil: mover, ganhar, perder com motivo,
   atribuir, menu do cartão).
7. **`atividades/`, `transmissoes/`, `respostas/`, `favoritas/`, `loja/`**.
8. **`relatorios/`** (Atendimento e Vendas: filtro de período, escopo, funil).
9. **Início** (`page.tsx`).

Para cada item: a ação grava? recarregar mantém? o banco local tem o valor?
o filtro muda a lista? o erro do servidor aparece na tela?

## O que entrou hoje (05/out), tudo no ar

| Commit | O quê |
|---|---|
| `bc147f5` | Ficha: apagar vermelho, largura toda, histórico com ícone por evento, dados em linha, Atividades com "+ Atividade" (modal), aba Automático |
| `7e4994f` | IA lê imagem na conversa com a IA (`server/ler-imagem.ts`); sem leitura, pede para escrever |
| `5816a7d` | Inbox: transferir virou avião de papel com modal da equipe |
| `d1a1b4e` | Funil: menu do cartão por portal (abria deslocado) |
| `3778f77` | Ficha: cartões vazios com ilustração (`lead-crm/vazio-do-cartao.tsx`) |
| `a8f86f9` | IA: esgotado nunca sozinho, busca põe estoque primeiro, uso leve começa pelo mais barato |
| `d154d42` | Relatórios: balão no mapa de horários |
| `49a623c` | Hotfix: Vendas caiu com `permission denied for table vendas`; seletor de emoji carregando |
| `116aa24` | Início: fila da equipe embaixo de Hoje; negócios parados como termômetro de frio |
| `0a8ce84`, `a07b0ac` | Estrela de favorita amarela, com folga na bolha |
| `00cf49f` | Início: "Precisa de você" pela janela de 24h (Responder agora / Janela vencida) |

**Nada disso foi visto em print** (Docker estava desligado). Bom primeiro
passo do plano: print 1440 e 390 dessas telas.

## Pendências abertas

- **Permissão de leitura de `vendas`/`venda_itens` para `autofluxos_dados`**:
  sem ela, "O que mais vende" usa o produto de interesse e o ranking não
  usa quem registrou a venda. Precisa migration em produção: pedir
  autorização. Próximo número pelo diretório (`ls supabase/migrations | tail -1`).
- `src/server/repos/painel.test.ts` (integração) pode esperar a ordem antiga
  da fila do painel; não foi rodado.
- Na conta PCYES, 0 de 78 negócios tem responsável: o cartão nasce sem dono.
  Vale avaliar se deveria herdar o dono do contato.
- Antigas: custo da Meta no Início do proprietário (`consumo_da_meta`, 0104);
  IA da PCYES sem mudanças por ora; telefone da SARAH CARVALHO na Verandi.
