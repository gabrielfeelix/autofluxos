# Handoff 30/set/2026: Inbox em tempo real, pente fino

Para o próximo agente. O Gabriel quer a Inbox **igual ao WhatsApp**: mensagem
nova aparece sozinha, nada de recarregar a tela, contadores que dizem o que
está pendente. A PCYES já usa em produção com cliente de verdade (Leonardo,
conversa de cupom, 30/set), então isto é atendimento ao cliente, não ajuste
visual. Regras do repo valem (`AGENTS.md`); memórias relevantes: ações
otimistas sem recarregar, print local em 1440 e 390 antes de entregar UI,
commit por fase e deploy no fim.

## O que ele viu (30/set, conta PCYES `64dbc3a9-1f77-4892-9770-e3e4be9e14cd`)

1. **Mensagem nova não aparece na conversa aberta.** A fila mostrou "Certo,
   top top" do Leonardo, mas o histórico aberto só mostrou depois de F5.
   Começar por `src/components/inbox/historico.tsx` (estado `aoVivo`, busca em
   `/api/clientes/<id>/inbox/conversa/<contatoId>`) e por quem avisa que chegou
   coisa (`fila-viva.ts`, `sinal-de-conversa.ts`, rota `inbox/stream`).
2. **A tela recarrega sozinha "do nada".** `pulso-do-inbox.tsx` chama
   `router.refresh()` (linha ~180) e faz `setInterval` de 5 s (linha ~291).
   Para ele isso é F5. Meta: nenhum `router.refresh` no uso normal; tudo por
   atualização local.
3. **O "(1)" na aba não some ao abrir a conversa.** O contador foi posto hoje
   em `fila.tsx` (`conversasSemLer`, commit `d1d2e43`) e conta `naoLidas.size`.
   A conversa aberta sai da conta pela memo `naoLidas`, mas a marcação de
   leitura (`marcarComoLida`, servidor) e o estado vivo (`viva.naoLidas`)
   provavelmente não se acertam sem recarregar.
4. **"Minhas conversas (4)" conta conversas, não pendências.** Ele quer o
   número de conversas **esperando resposta** (última mensagem é do cliente, ou
   com mensagem não lida). Contagem: `contarConversasDaBarra`
   (`src/server/repos/leads.ts:1791`) e `contagens-local.ts`.
5. **Clicar em "Minhas conversas" abre "Todas as conversas".** O item da barra
   aponta para `/inbox?de=minhas` (`secoes-do-cliente.tsx:101`); a leitura do
   `de` está em `inbox/page.tsx` (~linha 191). O destaque da barra também
   marcou "Todas".
6. **"envio não confirmado" que já foi.** Saraiva, 14:07: duas respostas
   ficaram marcadas na tela, mas no banco estão `entregue=true` com `wamid`. A
   transcrição pegou a linha antes de `confirmarEntrega` e nunca a relê.
   Corrigir junto com o item 1 (a linha já desenhada também precisa atualizar).

## Pedido novo: status do pedido pela Inbox

Nos botões de ação da resposta (ao lado do de produto, `acoes-produtos-do-inbox.ts`),
um ícone de localização que consulta o pedido da pessoa (a mesma
`loja_pedido` do bot: Magento + Frete Rápido, `src/loja/frete-rapido.ts`) e
manda o status pronto, como o bot faria. Busca por nº do pedido ou CPF;
sugerir pelo telefone do contato quando a loja deixar.

Aceite: abrir a Inbox em duas abas, mandar mensagem do celular para o número
da PCYES e ver aparecer nas duas sem recarregar, com a aba mudando para "(1)"
e voltando ao abrir. Testar e2e um spec por vez (memória: não derrubar a WSL).

## Também urgente: várias mensagens seguidas

A maioria dos clientes manda em rajada ("Olá boa tarde", "Tudo bem", "?").
Hoje cada uma é uma rodada: a primeira abre o menu e as outras caem na triagem
por cima do menu (Saraiva, 30/set 14:04). Proposta: juntar as mensagens que
chegam em poucos segundos numa rodada só (esperar ~3 s de silêncio) e, com o
menu recém-enviado, não responder cumprimento solto. Confirmar em conversa real.

Em 30/set o menu foi publicado com a triagem e `flows.ia_habilitada` em false
(corrigido às 14:1x); ver o aviso no topo de `scripts/fluxos/pcyes-triagem.mts`.

## Estado do bot da PCYES no fim do dia (tudo no ar, `bdffa46`)

- Carrossel: frase da IA + cards numa mensagem (`src/core/juntar-cards.ts`).
- Menu entende texto livre: saída "escreveu outra coisa" na pergunta
  (`entendeTextoLivre`) ligada a uma IA de triagem. Fluxos gerados por
  `scripts/fluxos/pcyes-triagem.mts` e publicados (menu v5, vendas v8,
  drivers v4, pedido v5). Perguntas sem prazo.
- Retomada: até 2 h depois do fim, texto novo vai direto à triagem, sem
  saudação (`VARIAVEL_DE_RETOMADA` em `receber-mensagem.ts`).
- Cadeia de IA grátis: Cerebras (sem chave ainda), Gemini, Groq. Groq grátis
  dá 8.000 tokens/min e estourava em turno de venda.
- Encaminhado pelo bot a outro time e terminou: conversa fica resolvida.
- Quem responde conversa sem dono vira responsável.
- Envio que cai na rede ("fetch failed") repete 2x; Inbox tem "Tentar de
  novo" em envio não confirmado (`src/components/inbox/reenviar.tsx`).
- Retomada do bot volta calada; prazo vencido vai para a fila sem avisar quem
  saiu.

Pendências do bot: métricas (resolução sem humano, mensagens por conversa,
clique no CTA); chave grátis do Cerebras (`CEREBRAS_API_KEY`, o Gabriel cria em
cloud.cerebras.ai); o Suporte (44) 2101-1428 pode não estar respondendo quem o
bot encaminha (Bruno Cunha escreveu "Suporte não responde." às 13:21).
