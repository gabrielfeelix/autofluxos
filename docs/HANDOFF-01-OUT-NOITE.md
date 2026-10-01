# Handoff 01/out/2026 (noite): chat do site no estilo tawk.to, IA e pendências

Para o próximo agente. Substitui `HANDOFF-01-OUT-TARDE.md`. Leia inteiro antes
de mexer. Regras do repo continuam valendo (`AGENTS.md`,
`docs/BANCO-COMPARTILHADO.md`); o jeito de trabalhar (resposta curta, publicar
na hora, print em 1440 e 390 antes de entregar UI, `tsconfig.json` do `next dev`
não se commita) está no handoff da tarde e nas memórias.

## Tarefa principal: chat do site no estilo do tawk.to

Pedido do Gabriel, com prints do widget da Oderço (tawk.to). Ele quer algo
nesse estilo, configurável. É trabalho de design: Opus no fio principal, sem
subagente para a parte visual. Use `superpowers:brainstorming` antes.

### O que existe hoje

- Widget: `public/chat/v1.js` (script embutido no site do cliente).
- API pública: `src/app/api/site/[chave]/route.ts`; produto em
  `src/app/api/site/produto`.
- Config: `src/core/chat-do-site.ts`, tipo `ConfigDoSite` com `dominios`,
  `cor`, `titulo`, `saudacao`, `pedirContato` (só liga/desliga), `mascote`,
  `tema`. Gravada em `channels.site_config`.
- Tela de config: `src/components/canais/configurar-chat-do-site.tsx`;
  ações em `src/server/acoes-site.ts`; repo `src/server/repos/canais-site.ts`.
- Mensagem pública (`MensagemPublica`) já leva opções, cards de produto e mídia.

### O que o Gabriel quer (do print da Oderço)

1. **Duas abas no rodapé do widget**: Início (saudação grande, "Precisa de
   alguma ajuda? Inicie uma conversa", card "Nova conversa" com "costumamos
   responder em minutos") e Mensagens ("Iniciar um novo chat" + "Recentes" com
   as conversas anteriores do visitante, que ele reabre).
2. **Formulário antes do chat, configurável na tela de config**: escolher quais
   campos pedir (nome, e-mail, telefone com DDI, CPF, CNPJ, e campo próprio),
   e se cada um é obrigatório. Um campo, dois, todos. CPF e CNPJ com validação
   de dígito; telefone normalizado com `src/core/contatos/telefone.ts`.
3. **Os dados viram o lead**: nome, e-mail e telefone no contato; CPF, CNPJ e
   campo próprio como campos do contato (ver `src/server/acoes-campos.ts`,
   origem `contato`). Telefone que já existe junta com o contato do WhatsApp em
   vez de duplicar (decidir e anotar em `docs/DECISIONS.md`).
4. **Histórico sem login**, guardado no navegador do visitante (como o tawk.to):
   ele volta ao site e vê as conversas dele na aba Mensagens.

Pontos de atenção: `pedirContato` vira a lista de campos (migrar o valor antigo
sem quebrar quem já tem o widget no ar); CPF é dado pessoal sensível para a LGPD,
então só pedir quando o dono escolher, e conferir `src/app/privacidade` e a
exclusão de dados; o widget roda em domínio de terceiro (PCYES), então nada de
CSS vazando nem dependência pesada. Texto de UI no tom de SaaS B2B, placeholder
com "Exemplo:".

## O que entrou hoje (tudo no ar, último deploy `fc49479`)

- `0ce51e9` tom profissional nos textos (bloco "Transferir para atendente").
- `485357a` modais: clique dentro do quadro não fecha (`useCliqueNoFundo`);
  rótulo não envolve mais `Dropdown`.
- `35b2545` IA: filtro de `[Card: ...]` (`semMarcacaoDeCard`), card antigo
  entra no histórico como dado de `loja_mostrar`, cupom e pagamento só sob
  pergunta.
- `ba35aa7` frase que abre a conversa vira assunto quando o menu entende texto
  (`soCumprimento`); resposta descartada quando chega mensagem nova no meio.
- `37ada7c` bloco "JEITO DE CONVERSAR" no prompt e `semElogioDeAbertura`.
- `f3afc54` e `9770046` busca: nono dígito, busca em todas as abas e no texto
  das mensagens (`contatosPorMensagem`, 13 conversas da PCYES com "suporte
  técnico").
- `fc49479` conserto de um erro meu do `ba35aa7`: o descarte usava
  `ultimaEntradaDeTexto`, que ignora foto, e engolia toda resposta a foto.
  Agora `chegouEntradaDepois`. Foto com legenda vale como texto.
- PCYES no banco: Vendas Corporativas agora é **(44) 2101-1369** no fluxo
  "Compra para empresa" (publicado v6) e na ficha.

## Pendências, em ordem

1. **Rodrigo (PCYES, final 2774) está sem resposta** desde 14:02, pela falha do
   `ba35aa7`. Alguém da PCYES responde à mão; o Gabriel foi avisado.
2. **`ia_chamadas` não grava nada da PCYES desde 30/set 17:50**, embora a IA
   tenha respondido em 01/out (Guto, 11:45). Achar onde o log parou.
3. **Ver acontecer**: abertura com assunto, rajada com descarte, foto com
   legenda, tom novo. Conferir em `messages` depois de conversas reais.
4. **Avaliação contínua da IA**, da pesquisa de mercado: cada conversa ruim
   vira teste de regressão; um juiz com rubrica fixa (pergunta respondida, nada
   não pedido, sem repetir card, sem marcador, sem elogio, no máximo uma
   pergunta, tamanho). Ainda não existe.
5. Continuam do handoff da tarde: galeria de integrações com logo, vídeos do
   App Review do Instagram, saudação automática do app no celular da PCYES,
   forma de pagamento na WABA (PCYES e MGM), MGM.

## Pesquisa de mercado (01/out, só web)

Regras que ainda não estão no código: reconhecer frustração antes de resolver;
gatilhos de escalonamento escritos (pedido de humano, reclamação repetida, dois
mal-entendidos seguidos); transferência com resumo para o atendente, para o
cliente não repetir (lição da Klarna); "ok" sem pergunta pendente não chama o
modelo. O Decreto 11.034/2022 (SAC) exige acesso a humano em reclamação e
cancelamento. Fontes: intercom.com/blog/fin-guidance,
sierra.ai/blog/agent-development-life-cycle,
developers.google.com/assistant/conversation-design.

## Pegadinhas novas

- Entrada de foto chega como `midia` com `legenda`; `ultimaEntradaDeTexto` só
  conta `text`, `interactive` e `button`. Não use ela para "chegou algo depois".
- A conversa nova pode começar por dois caminhos em `receber-mensagem.ts`
  (abertura normal e gatilho, por volta da linha 1470). Só o primeiro leva o
  texto para o ramo `inicio` do motor; o segundo ainda não.
- Logs de runtime da Vercel pela API só vêm ao vivo (streaming), sem histórico.
