# Handoff 05/out/2026 (noite): o que entrou e o pacote que falta

Leia antes: `AGENTS.md`, e `docs/BANCO-COMPARTILHADO.md` se tocar banco.
Gabriel é designer, não dev: quer decisão tomada e implementada, resposta curta,
commit e push na hora (push na `main` publica na Vercel). Sem travessão em
arquivo nenhum. Validar com `tsc`/`eslint`, não rodar a suíte inteira.

**Nada desta rodada foi visto em print**: Docker desligado, `scripts/ux-local/dev.sh`
não sobe. Com Docker ligado, tirar print em 1440 e 390 de tudo abaixo.

## O que entrou nesta sessão (tudo no ar)

| Commit | O quê |
|---|---|
| `4643196`, `3ec9e31` | Painel lateral do negócio (`components/quadros/painel-do-contato.tsx`): esqueleto; negócio como único cartão em destaque (temperatura e produto dentro); resto numa folha só com seções de ícone; histórico com ícone por evento (`marcaDoEvento`), repetidos agrupados "×N" |
| `ab950e0` | Produto de interesse virou dropdown que salva ao escolher (`quadros/interesse-da-oportunidade.tsx`); etiqueta nova ganhou × para cancelar |
| `00760a4` | Início pelo alcance de quem lê (`app/clientes/[clienteId]/page.tsx`): faixa só com problema, convite do assistente some com a conta de pé, fila com `alcanceDeConversas`, blocos Negócios parados, Fila da equipe, Hoje, Fechamentos. Ver `docs/PLANO-HOMEPAGE.md` §9 |
| `1a7c2d6` | Anúncios e Credenciais em cartões (`components/conexoes/cartao.tsx`, `CartaoDeConexao`) |
| `825972a` | Dúvidas do atendimento: cards "Principais dúvidas" e "Perguntas que a IA não respondeu" em Relatórios; passada diária `/api/manutencao/duvidas` (08:00 UTC); migrations **0125 e 0126 aplicadas em produção** (registradas no runbook) |

**A conferir no primeiro uso real:** os cards de dúvidas leem pelo papel
`autofluxos_dados`; os grants foram conferidos no catálogo, mas `set role` pela
Management API é recusado, então a prova é o card carregar sem `permission
denied`. A primeira passada roda às 05:00 de Brasília.

## O pacote que falta (pedido do Gabriel, tudo aprovado)

### 1. Botão Apagar da ficha do contato
`components/lead-crm/acoes-da-ficha.tsx` (botão com `tom="perigo"`, usado em
`apagar-contato.tsx`). Hoje aparece com fundo branco na casca azul. Pedido:
**fundo vermelho, texto e ícone brancos** (ou preto se o contraste pedir). É
ação perigosa, não pode parecer neutra.

### 2. Largura da ficha do contato
`app/clientes/[clienteId]/leads/[contatoId]/page.tsx`. Usar
`Miolo largura="toda"`, o padrão de Contatos, Início e Relatórios.

### 3. Abas da ficha do contato: UI no nível do resto do sistema
- **Histórico**: usar os ícones por tipo de evento que o painel do negócio já
  tem (`marcaDoEvento` em `painel-do-contato.tsx`; extrair para um módulo
  comum e usar nos dois). Componente atual: `components/lead-crm/historico.tsx`.
- **Dados e origem**: o "O que o fluxo coletou" tem célula cinza vazia
  (grade que sobra) e visual cru. Refazer no padrão novo (lista de
  propriedades como `.crm-props` em `globals.css`, ícones de
  `lead-crm/icones.tsx`). "Jornada de anúncios" vazia também.
- **Atividades** (a pior, segundo ele): tirar o formulário com input e
  dropdown do topo. No cabeçalho do card, à direita, **botão primário
  "+ Atividade"** que abre **modal** de criação.
- **Três seções na aba Atividades** (Atividades da equipe, Mensagens
  agendadas, Acompanhamentos automáticos): sugestão aprovada para avaliar,
  deixar só Atividades nessa aba e criar aba **"Automático"** com mensagens
  agendadas e acompanhamentos. Decidir e implementar.

### 4. IA lendo imagem (MUITO IMPORTANTE)
Hoje imagem do cliente vira passagem para a equipe com o motivo "a pessoa
mandou image e o bot só lê texto" (procurar esse texto no motor). Caso real:
cliente da PCYES mandou print do carrinho do site e disse "gostaria desses".
Pedido:
- a IA **ler a imagem** (Gemini é multimodal; ver como `server/transcrever-audio.ts`
  baixa a mídia e manda `inline_data`), identificar os produtos, **mandar os
  cards dos produtos** (a consulta `loja_buscar` já existe) e dizer que é só
  adicionar ao carrinho e finalizar pelo site;
- se não der para ler, **avisar que não consegue ler a imagem e pedir para a
  pessoa escrever** o que quer, em vez de passar calado para a equipe.

### 5. "Digitando…"
- **Do cliente para o Inbox: não existe.** A Cloud API do WhatsApp não manda
  evento de digitação do cliente. Já foi dito ao Gabriel.
- **Do bot para o cliente: fazer.** A Cloud API aceita `typing_indicator`
  junto do "marcar como lida" (`status: read` + `typing_indicator: {type:
  text}`). Mostrar enquanto a IA prepara a resposta.

## Pendências antigas que seguem abertas
- Custo da Meta no Início do proprietário: o dado existe em
  `public.consumo_da_meta` (0104). Não foi feito.
- IA da PCYES (peso do `FORA_DO_ASSUNTO`, bateria de modelos): dono disse
  "sem mudanças ainda".
- Telefone da SARAH CARVALHO na Verandi com um dígito a mais.
