# Handoff 26/set: ideias da conversa no Inbox da 4YU

> Para um agente dedicado **só** a isto. Existe outro agente trabalhando ao
> mesmo tempo nas frentes (nichos): `docs/HANDOFF-26-SET-NICHOS.md`. Leia a
> seção "Convivência" antes de mexer em código.

## 1. A tarefa

Ler **toda a conversa de hoje (26/set/2026)** no Inbox da conta **4YU**, entre
o número da 4YU e o contato **Gabriel Felix**, com calma: cada texto, **cada
imagem** e **cada áudio**. Entender as ideias que apareceram, separar o que foi
**validado**, o que faz sentido e o que não faz, e então **planejar e executar**
o que fizer sentido incluir no AutoFluxos.

Quem é quem: **Gabriel Felix** é quem desenvolve o produto (é o usuário desta
sessão). **Eduardo** é o dono da 4YU e do sistema. Mensagens `saida` saem do
número da 4YU; `entrada` são do Gabriel.

Se a conversa de hoje referir algo de dias anteriores, leia o trecho anterior
necessário para entender (a conversa é longa: 23 a 25/set têm centenas de
mensagens), mas o foco são as ideias de hoje.

## 2. Onde está

| O quê | Valor |
|---|---|
| Conta 4YU | `clients.id = f175bf85-7ce6-4cc4-a19a-e910df70a53e` |
| Contato | `contacts.id = 666af154-c1e5-4b34-9cb2-bdb44f7c6ab5` ("Gabriel Felix") |
| Mensagens | `public.messages` por `contact_id`, ordem `ts`; colunas úteis: `direcao`, `texto`, `payload`, `arquivo` (jsonb com `mime`, `midia`, `caminho`), `transcricao`, `cita`, `reacao` |
| Hoje | 117 mensagens (43 entrada, 74 saída), 37 com arquivo (imagens e áudios) |
| Arquivos | bucket `autofluxos-recebidos` (`src/server/repos/midia-recebida.ts`), baixar com a chave secreta do `.env` |
| Áudios | **nenhum transcrito** (`transcricao` nula): transcreva você, por exemplo com o Gemini (`GEMINI_API_KEY` no `.env`; ver `src/server/ia/gemini.ts`) |

Dia de hoje em São Paulo: `ts at time zone 'America/Sao_Paulo'`.

## 3. Cuidado com os dados

- O repositório é **público**. Imagens, áudios, transcrições e trechos da
  conversa **não entram no repo**. Baixe tudo para o scratchpad da sessão.
- No documento de ideias que for para o repo, escreva a ideia com as suas
  palavras, sem copiar dado pessoal, telefone, valor de cliente ou print.
- Só leitura na produção para esta análise. Nada de apagar ou marcar mensagem.
- Consulta à produção por heredoc ou script `.cjs` com `pg`; nunca imprimir
  segredo.

## 4. O que entregar

1. `docs/IDEIAS-26-SET-DA-CONVERSA.md`: cada ideia com: o que é, quem propôs,
   se foi validada na conversa (e por quem), se faz sentido para o produto
   (com o porquê), o que já existe no código, e o tamanho.
2. Um plano curto de execução, em ordem de valor (o que dá renda primeiro:
   hoje as contas pagantes são MGM Pilates e PCYES).
3. **Executar**, com commit e push por etapa, testes verdes (`npx vitest run
   -c vitest.unit.config.ts` e `npx tsc --noEmit -p .`), abrindo tela nova no
   navegador antes de dizer que está pronta.
4. Resumo final para o Gabriel: curto, simples, sem jargão.

## 5. Convivência com o agente das frentes

- Ele é dono de `src/core/nichos.ts`, das frentes, do onboarding por frente,
  da ficha do assistente e da demo da pizzaria. Ideia da conversa que cair
  nesses assuntos: **não implemente**; escreva numa seção "Para o agente das
  frentes" no seu documento de ideias.
- `git fetch` e `git pull --rebase` antes de começar e antes de cada push.
  Commits pequenos. **Nunca `git stash` nem `git reset`**: há trabalho da outra
  sessão no mesmo diretório.
- Se os dois precisarem de migration, o número vem do diretório na hora
  (`ls supabase/migrations | tail -1`), e a de um pode ocupar o número que o
  outro pensou. Migration só com autorização explícita do Gabriel, seguindo
  `docs/BANCO-COMPARTILHADO.md`.

## 6. Regras da casa

As mesmas do `docs/HANDOFF-26-SET-NICHOS.md`, seção 5: sem travessão (use dois
pontos), MGM não se toca, produção só com autorização, respostas curtas ao
Gabriel.
