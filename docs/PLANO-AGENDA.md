# A conversa e a agenda — o que responde hoje, e o que falta

Escrito em 24/ago/2026, depois de quem opera perguntar exatamente isto: *"se eu
perguntar pro bot, ele vai saber qual aula tem dia 10, com qual professor? quais
estão disponíveis? ele consegue reservar uma aula na Verandi? ele oculta
informações pessoais?"*.

Este documento responde pergunta a pergunta, com o estado real do código, e
depois lista o que falta em ordem de valor. Ele existe porque a resposta honesta
para metade delas era "não", e "não" precisa de prazo e de dono.

---

## O que o bot responde hoje

| A pessoa pergunta | Responde? | Como |
|---|---|---|
| "quais horários tem dia 10/09/2026?" | **sim** | pergunta com formato `data` → `verandi-horarios` |
| "qual aula é, e com quem?" | **sim** | rótulo `{hora} · {servico}`, professor em `horarios_prof` |
| "quero aula com a Marina" | **sim** | `verandi-horarios-do-professor`, filtrando na origem |
| "tem aula quinta?" (e está lotada) | **sim** | `lotados` separa "não tem" de "tem e encheu" |
| "reserva pra mim" | **sim** | `verandi-marcar`, com o `sessaoId` da opção escolhida |
| "quais são meus horários?" | **sim** | `verandi-minha-agenda` |
| "quero desmarcar" | **sim** | menu das próximas → `verandi-desmarcar` |
| "quantas reposições eu tenho?" | **sim** | `reposicoes_abertas` |
| "quais professores vocês têm?" | **sim** | `verandi-catalogo` |
| "me avisa quando abrir vaga" | **não** | ver §2 — a fila é registrada, o aviso não chega |
| "quero aula toda terça" (matrícula fixa) | **não** | a API não escreve `vaga`; é decisão de quem atende |

### Como o bot entende data

Pergunta com formato `data` aceita `21/08/2026`, `21-08-2026`, `21.08.2026` e
`2026-08-21`. Guarda **duas** variáveis: o que a pessoa escreveu (para a
confirmação ler igual ao que ela mandou) e o padronizado `2026-08-21`, que é o
que a rota aceita.

**Ano de quatro dígitos é obrigatório**, e não é limitação: quem remarca em
dezembro e escreve "05/01" quer janeiro do ano que vem, e o palpite acerta metade
das vezes — a metade errada é um agendamento onze meses fora. "Amanhã" também não
passa: `core/` não tem relógio, de propósito. Quem quiser oferecer isso desenha
botões ("hoje", "amanhã") com um Guardar em cada.

---

## §1. Informação pessoal: o que sai e o que não sai

**A Verandi não devolve ficha pela API.** Observação (onde mora "lesão no ombro,
não pode carga axial") e data de nascimento ficam de fora por decisão, com teste
de navegador conferindo que a palavra não aparece na resposta. O bot marca aula;
ficha clínica é da tela, e quem lê tem papel para isso.

**O que o bot alcança é a pessoa do outro lado, e não terceiros.** O
reconhecimento é pelo telefone de quem está escrevendo, então `pessoa_id`,
`nome_na_agenda` e a agenda dela são dela.

**Onde ainda dá para errar, e a regra que fecha:** a rota `GET /pessoas?busca=`
procura por nome e devolve nome e telefone de **outras** pessoas da conta. Não há
preset para ela de propósito, mas o bloco de Serviços externos é genérico e
alguém pode montá-la à mão. A regra: **nunca monte uma consulta por nome dentro
de um fluxo.** Quem chega pelo WhatsApp é identificado pelo número, e um fluxo que
pergunta "qual seu nome?" e busca por ele entrega o telefone de um homônimo.

Ver §3.3 — a trava para isso está na lista.

---

## §2. O que falta, em ordem de valor

### 2.1 Webhook de entrada — o aviso que a agenda manda e ninguém recebe

**É a maior lacuna, e ela torna falsa uma promessa que o produto já faz.** O
preset de fila de espera diz "te aviso se abrir", a Verandi dispara o evento
`vaga.aberta` quando alguém desmarca — e o AutoFluxos **não tem rota para receber
webhook de terceiro**. Só existe `/api/webhook/whatsapp`.

Ela também é a peça que falta para os outros três eventos da Verandi:
`participacao.criada`, `participacao.cancelada` e `sessao.cancelada`. O estúdio
cancela a aula de quinta e ninguém avisa as oito pessoas.

O desenho, que é o mesmo de toda ferramenta de automação (Make, n8n, ManyChat
"external trigger"): **um evento de fora abre um fluxo**.

- `POST /api/webhook/entrada/[clienteId]` com assinatura HMAC conferida contra
  um segredo por cliente — a Verandi já assina o que envia;
- o corpo vira variáveis da sessão, do mesmo jeito que a resposta de uma chamada
  vira: `{{evento}}`, `{{pessoa_telefone}}`, `{{sessao_data}}`, `{{sessao_hora}}`;
- a conversa abre no contato que casa com o telefone do corpo, e o fluxo é
  escolhido por evento — como já se escolhe por palavra-chave e por campanha;
- **a janela de 24h manda.** Fora dela, começar conversa exige modelo aprovado da
  Meta, que este produto ainda não manda (C4). Então o webhook precisa dizer
  isso na tela em vez de falhar calado: aviso que não sai é pior que aviso que
  não existe.

Ordem de grandeza: rota + assinatura + tela de configuração + escolha do fluxo
por evento. Nada de migration nova além da tabela de segredo por cliente.

### 2.2 Matrícula fixa pelo bot

"Quero aula toda terça às 7h" hoje termina em handoff. A Verandi tem `vaga`
(horário recorrente), e a API v1 não escreve nela — de propósito: assumir uma
vaga fixa é compromisso mensal, não uma marcação avulsa. **Provavelmente deve
continuar assim**, com o bot coletando a intenção e entregando para a recepção.
Fica registrado como decisão consciente, e não como esquecimento.

### 2.3 O que o catálogo devolve e ninguém usa

`vocabulario` diz como cada conta chama as coisas — um estúdio diz "aula", uma
clínica diz "sessão". As mensagens do modelo dizem "aula" fixo. Barato de
resolver e é o que faz o mesmo fluxo servir a barbearia sem reescrever texto.

Também sobram `locais`, `duracaoMin` e `capacidadePadrao`.

### 2.4 Dia da semana legível

`horariosFixos[].diaSemana` vem como número (2 = terça). O fluxo não tem como
traduzir número em palavra, então "seu horário fixo é terça 07:00" não sai. É
uma linha do lado da Verandi (devolver o nome junto), e não vale um encadeamento
de condições aqui.

### 2.5 Uma trava para consulta por nome

§1 termina numa regra escrita, e regra escrita é a proteção mais fraca que
existe. O validador pode recusar publicar um bloco cuja URL aponte para
`/pessoas?busca=` — é específico demais para uma regra geral, e é exatamente o
tipo de erro caro o suficiente para merecer um caso especial.

---

## §3. O que já está escrito e não se renegocia

1. **A agenda é um sistema do cliente.** Turma, matrícula e presença não moram
   aqui. O fluxo lê e escreve pela API, e o dado fica lá.
2. **O robô não decide vaga.** Horário cheio não entra em `livres`, o bot não
   abre turma nem passa da lotação. Quem responde por uma vaga é quem está no
   balcão, e ela não estava na conversa.
3. **Uma credencial por cliente**, `bearer`, e ela nunca entra no fluxo — o que
   fica gravado é o id dela.
