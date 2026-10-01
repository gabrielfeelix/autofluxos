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
