# Varredura das conversas MGM e 4YU, 19/out/2026

Leitura de produção (só leitura), mensagens não históricas, foco em set e out.
Horários em America/Sao_Paulo. Contato pelo final do número.

## Panorama

- **4YU** (canal do Eduardo, coexistência): sem fluxo ligado, o bot não fala.
  14.651 mensagens em 36 contatos, quase tudo conversa humana e ecos do
  celular; o maior volume é teste do Gabriel (final 5978). Nada de laço.
- **MGM**: 721 mensagens fora do histórico, 246 do bot. Nenhuma
  `situacao='falhou'`, nenhum `wa_message_id` duplicado, nenhuma
  `ia_chamadas` nem alerta próprio em 30 dias.
- Latência do bot na MGM: mediana 6 s em texto (janela de rajada), 1,4 s em
  botão, máximo 19,6 s.

## Buraco do bloqueio (17/out 19:22 a 19/out 08:20)

- 4YU: nada entre 17/out 19:17 e 19/out 08:26; o sábado 18/out tem zero
  mensagens (fins de semana anteriores: 6 e 22). Perda provável de dezenas.
- MGM: última entrada 17/out 16:21; domingos costumam ter zero, perda
  provável pequena.
- **A Meta não reenviou**: o webhook respondia 200 antes de gravar, e o
  `after()` falhava com o 402. Nos números em coexistência as mensagens
  existem só no celular. Corrigido (abaixo).

## Corrigido neste commit (bug claro)

1. **Webhook só responde 200 com o banco no ar**
   (`src/app/api/webhook/whatsapp/route.ts`, `bancoResponde`). Banco em 402,
   5xx ou sem resposta em 5 s devolve 503 e a Meta reenvia por até 7 dias.
2. **Saudação dupla ao tocar opção de menu antigo**
   (`escolhaNoMenuDoInicio`, `src/core/engine/executar.ts`). Ex.: Thais
   (final 1976) 15/out 11:35, Emilia (1840) 14/out 07:57, Luz (9171) 09/out
   10:57.
3. **"Formato não suportado" falando fora de hora**
   (`pedirOutroFormato`, `src/server/receber-mensagem.ts`): agora calado com
   automação desligada ou conversa com humano, e ignora `album` (as fotos
   chegam separadas). Ainda não tinha acontecido na MGM/4YU, só na PCYES.

## Bug claro, mas precisa de migration (pede autorização)

- **"Voltar" dentro de subfluxo reinicia o subfluxo** em vez de voltar ao
  menu principal (`executar.ts`, `pediuReinicio` usa `fluxo.inicio`, e depois
  de um `ir-fluxo` o fluxo é o de destino). Amilcar (4425), 15/out 06:19:
  recebeu 3 vezes "Só confirmando: o telefone" e desistiu. Correção: guardar
  na sessão o fluxo de origem do salto (coluna nova em `public.sessions`) e
  saltar de volta a ele no "voltar".
- **Nome aceito sem validação** no nó de pedir nome do Agendamento: Thiene
  (9701), 16/out 11:30, endereço com CEP salvo como nome. Correção: tipo de
  resposta "nome" na pergunta (sem dígitos, até 60 caracteres, sem quebra de
  linha), sem migration; muda o texto de erro que o aluno vê, por isso está
  aqui.

## Para decidir (regra ou texto que o aluno vê)

1. **Timeout no menu não vira handoff** para contato desconhecido: encerra.
   Hoje 12 dos 28 handoffs da MGM são "ninguém respondeu dentro do prazo",
   incluindo spam (Dr Climatização, Parcerias), e escondem os reais. 27 de 28
   seguem com `resolvido_em` vazio. Somar: handoff sem resposta em 30 min
   avisa a equipe de novo.
2. **"Reagendar aula" oferece mover a próxima aula** quando não há
   reposição. Hoje responde "não vi aula sua em aberto para repor" e cai na
   recepção (Bru Valim 5042, Claudio 0725, Amilcar, Luz).
3. **Tirar "Personal Pilates" da experimental** ou explicar: as 3 escolhas
   reais eram aula em grupo.
4. **Gatilhos de texto**: "não vou conseguir/vou faltar" vai para Não
   Comparecimento; "Wellhub/Gympass/TotalPass" vai para resposta própria.
   Hoje caem no "escolha uma das opções" (Michaeli 4032 recebeu 3 vezes).
5. **"Outro assunto" do aluno vai para a recepção**, não para o menu de
   interessado (Emilia 1840, Maria S R 2904).
6. **Textos**: primeiro nome em vez do nome completo; lembrete de
   inatividade do Agendamento não diz "aula experimental" para aluno.

## Verandi (outro repositório)

- Cancelamento fora do prazo responde "não entra como reposição" e, 30 s
  depois, "você tem 1 aula para repor" da mesma aula (Vera 1569, 05/out
  17:19).
- Aviso de confirmação com data ISO ("2026-10-05 às 18:00").

## Configuração MGM

- `flow_midia_id` do canal aponta para o próprio fluxo principal: cada mídia
  abre sessão nova (Marlene 9745 recebeu as boas-vindas 5 vezes em 15 min em
  05/out) e deixa sessão órfã ativa (Isa 4279 17/out, Arte 9980 14/out).
  Desligar no painel do canal.
- Eco do Daniel no meio de uma confirmação cala o bot (Luz 9171, 05/out
  18:00): a reposição provavelmente nunca foi marcada. Conferir com ele.
