# Handoff 25/set/2026: canal Site no ar, Inbox ao vivo

Para o próximo agente. Leia antes: `AGENTS.md` e `docs/BANCO-COMPARTILHADO.md`
(o banco de produção é dividido com a Verandi). Gabriel é designer, não dev:
quer decisão tomada e implementada, respostas curtas, e print em 1440 e 390
antes de entregar tela (`scripts/ux-local/`, porta própria com `PORTA=`).
O handoff anterior, que pediu esta frente, é
`docs/HANDOFF-25-SET-PCYES-E-CANAL-SITE.md`.

## 1. O que foi feito (tudo em `main`, deploy READY)

| Commit | O quê |
|---|---|
| `afd8adf` | canal Site inteiro: migration 0105, adaptador, API pública, tela, Inbox |
| `fe57e66` | salvar antes de ligar cria o canal pausado; ficha de contato depois da 1ª resposta |
| `f2451e0` | robô animado (acena em loop) no botão do balão |
| `7e689d5` | registro da 0105 em `docs/BANCO-COMPARTILHADO.md` |
| `2325210` | "Onde o balão aparece" vira lista Link 1, Link 2, "Adicionar outro link" |
| `0889728` | personagem próprio no botão (upload); o X de baixo volta a fechar |
| `66d0642` | fundo claro ou escuro no balão |
| `c7e27c8` | Inbox: fila atualiza linha por linha, sem `router.refresh()` |

### Como o canal Site funciona
- `channels.provider = 'site'`, com `site_chave` (pública, vai no HTML) e
  `site_config` jsonb: `dominios`, `cor`, `titulo`, `saudacao`,
  `pedirContato`, `mascote {url,tipo}`, `tema`. Leitor único:
  `lerConfigDoSite` em `src/core/chat-do-site.ts` (com teste).
- Visitante vira contato com `wa_id = site:<sha256(canal:segredo)>`; o segredo
  é gerado e guardado no navegador. Não vira `telefone` (a consulta de pedido
  no site só confere por CPF). Ver `core/contatos/visitante-do-site.ts`.
- Saída: `src/channels/site.ts` não envia nada; a linha em `messages` é a
  entrega, e o balão lê por `GET /api/site/[chave]/mensagens`.
- Entrada: `POST /api/site/[chave]/mensagens` responde 202 e trata no
  `after()` (`maxDuration 300`) via `receber-do-site.ts` → `tratarUma`.
- Portão: `src/server/api-do-site.ts` confere `Origin` contra os domínios
  (localhost só fora de produção) e limite por IP e por visitante.
- Widget: `public/chat/v1.js`, sem framework, Shadow DOM, herda a fonte da
  loja. Botão abre e fecha; ficha de nome e contato; "digitando" local.
- O site **roda os fluxos do WhatsApp** (`fluxoProprio: false` em
  `core/canais.ts`); ao ligar, copia os papéis do primeiro número ativo.
- Tela: `/clientes/<id>/conversas/canais/site`
  (`components/canais/configurar-chat-do-site.tsx`), com prévia ao vivo.
- Personagem: upload vai para o bucket `autofluxos-acervo`, prefixo
  `chat-do-site/<clienteId>/`. GIF vira WebP animado com `sharp` (import sob
  demanda). Nenhum bucket novo: Storage é global com a Verandi.

### Produção
- **0105 aplicada** em 25/set com autorização do Gabriel, pela Management API
  (ref `xxxynoshwirupkdzwxbj`, token no cofre). Verandi conferida: 35
  migrations, 40 tabelas, antes e depois.
- **PCYES** (`64dbc3a9-1f77-4892-9770-e3e4be9e14cd`): canal Site ligado,
  chave `hxwozkfG7NP4noT0c0qTK4ab`, domínio `pcyes-v3-codigo-fonte.vercel.app`,
  tema escuro, personagem = símbolo da PCYES animado (flutua + feixe de
  varredura, sem olhos acesos, pedido do Gabriel).
- **v3 da PCYES** (`~/dev/grupo-oderco/marcas/pcyes/projetos/v3-codigo-fonte`,
  commit `7262308`): a linha do script está no `index.html`. Conferido no ar:
  balão abre, fluxo "Boas-vindas e menu" responde com 6 opções.

## 2. Pendências

1. **Título e cor da PCYES**: o Gabriel salvou pela tela com os valores antigos
   ("Atendimento", `#DC2626`). Oficial seria "Atendimento PCYES" e `#DC1414`.
   É escolha dele; só lembrar.
2. **Domínios reais**: só o protótipo está cadastrado. Faltam `pcyes.com.br` e
   `dev.pcyes.com.br` quando for para o Magento (passos na própria tela).
3. **Inbox ao vivo, o que ainda não é vivo**: contadores do topo ("Não lidas",
   total) e, no modo paginado (conta acima de `TETO_DA_FILA_LOCAL`), conversa
   nova fora da página visível. Ver `components/inbox/fila-viva.ts`.
4. **Relatórios** contam conversa do site como WhatsApp (usam o `flows.canal`).
5. **Visitante anônimo** perde a conversa ao trocar de navegador. Futuro:
   cliente logado no Magento.
6. Erro de hidratação antigo no Inbox ("há 11 min" x "há 12 min" na virada do
   minuto). Não é desta frente.
7. Mensagens de teste no Inbox da PCYES (um "oi" anônimo do site) podem ser
   apagadas.

## 3. Onde trabalhar
- Worktree usado nesta frente: `../autofluxos-site` (branch `canal-site`,
  igual à `main`). Outra sessão pode estar em `autofluxos/`; conferir
  `git status` antes de mexer em `receber-mensagem.ts` ou no Inbox.
- Prints e testes de navegador ficaram em `.ux-local/*.mjs` (ignorado pelo
  git): `e2e-site.mjs`, `mascote.mjs`, `escuro.mjs`, `vivo.mjs`.
- Regras da casa: commit local por fase, um push no fim; validar com `tsc` e
  os testes do que mudou; ações otimistas; sem travessão; placeholder começa
  com "Exemplo:".
