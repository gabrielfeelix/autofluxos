# Decisões

Append-only. Cada entrada: data, decisão, porquê, onde está no código.

## 01/out/2026: chat do site no estilo tawk.to

- **Visitante do site não junta com o contato do WhatsApp de mesmo número.**
  O telefone do formulário não é verificado: qualquer um digita o número de
  outra pessoa. Juntar daria ao navegador do visitante (que lê a conversa pelo
  segredo) o histórico do WhatsApp do dono do número. O número fica em
  `campos.whatsapp` do contato do site, com origem `contato`; a equipe junta à
  mão se quiser. `src/server/receber-do-site.ts` (`guardarFicha`).
- **Formulário vai junto da primeira mensagem**, não numa rota própria: contato
  sem mensagem continua sendo robô testando a rota. Conferido antes do 202
  (`lerFicha` em `src/core/chat-do-site.ts`); erro volta ao formulário.
- **`pedirContato` antigo vira formulário**: `true` → nome obrigatório +
  WhatsApp opcional; `false` → sem formulário. Sem migration de dados, na leitura
  (`lerFormulario`).
- **Recentes sem login**: o servidor tem um fio por visitante; o balão guarda no
  `localStorage` o `ref` da primeira mensagem de cada conversa e fatia o fio por
  essas marcas. CPF e demais dados do formulário nunca vão para o
  `localStorage`. `public/chat/v1.js` (`conversas`, `marcar`).
- **Pergunta própria** grava em `campos.<chave da pergunta>` e cria a definição
  em `campos_definidos` (texto curto) só se a chave não existir.

## 01/out/2026: ligação de voz no chat do site

- **Áudio de navegador para navegador (WebRTC), sem servidor de mídia.** O
  servidor só guarda a sinalização em `public.chamadas` (0118): a oferta do
  visitante e a resposta do atendente, cada uma com todos os candidatos ICE
  dentro, então são duas escritas e nenhuma conexão longa na Vercel.
  `src/server/chamadas.ts`.
- **O Inbox toca pelo stream que já existe** (`/inbox/stream`, evento
  `chamadas`), só em conta com a opção ligada. Toca para quem está com o Inbox
  aberto; o primeiro que atende leva (`update ... where status = 'chamando'`).
- **Só STUN por padrão.** Rede com NAT simétrico (empresa, parte do 4G) precisa
  de TURN, que entra pela variável `CHAMADA_ICE_SERVERS` sem mudar código.
- **Só o visitante liga, e só depois da primeira mensagem**: contato sem
  conversa é robô, e o Inbox não toca para ele.

## 01/out/2026: ligação pelo WhatsApp pausada

- **Pausada pelo dono na fase 0**, antes de qualquer tela. Retomar pelo
  [handoff](HANDOFF-01-OUT-LIGACAO-WHATSAPP.md), seção "Andamento da fase 0".
- **Por que travou:** Calling exige limite de 2.000 no portfólio. A demo
  (`1301107846409860`) está em `TIER_250` com portfólio verificado; ligar o
  Calling volta `138015`. O `health_status` culpa o nome de exibição sem
  revisão, e editar o nome não abriu revisão (`AVAILABLE_WITHOUT_REVIEW`).
  Saída: chamado no suporte da Meta. Mesmo bloqueio vale para cliente.
- **O que ficou no ar:** o webhook grava eventos `calls` em `alertas`
  (`src/server/sonda-ligacao.ts`, `5a7ce51`). Inofensivo enquanto nenhum
  número tem Calling ligado; remover ou substituir na fase 1.


## 02/out/2026: o aviso de handoff diz conta, canal, porquê e a última fala

- **Por quê:** o dono recebeu "Um contato está esperando atendimento / a IA
  não soube responder, em \"loja_detalhes\": \"produtoId\" não é um
  identificador..." e não soube de qual conta era nem quem escreveu.
- **O que mudou:** título com nome ou telefone; corpo com `Conta · Canal`, o
  porquê em frase de gente (`resumoDoMotivo` em `src/core/aviso-de-handoff.ts`)
  e a última mensagem do contato, cortada em 90 caracteres. O Inbox mostra a
  mesma frase; o motivo cru fica no banco e na dica, para diagnóstico.
- **Revisto:** antes o aviso não levava conteúdo da conversa "porque atravessa
  o servidor de push". A carga do Web Push é cifrada de ponta a ponta
  (RFC 8291), o servidor não lê; é o que o WhatsApp já faz.
