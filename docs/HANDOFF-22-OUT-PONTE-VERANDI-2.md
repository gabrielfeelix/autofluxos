# Handoff: 22/out/2026, ponte Verandi, próxima rodada

Para o agente que continua. Leia antes `docs/PONTE-VERANDI.md` (o que já está
no ar e as decisões). Commits: AutoFluxos `b014976a`, Verandi `318cda3`; a
`0085_vr_evento_de_falta` da Verandi foi aplicada em produção com
autorização (registro em `verandi/docs/BANCO-COMPARTILHADO.md`). Os cinco
avisos (`presenca.falta`, `sessao.cancelada`, `vaga.aberta`,
`participacao.criada`, `participacao.cancelada`) já chegam e viram gatilho.

O Gabriel aprovou as duas frentes abaixo ("que foda a ideia"). Faça as duas,
decidindo os detalhes; ele quer decisão tomada e implementada.

## 1. Aviso da Verandi fora das 24 horas

**Hoje:** fora da janela, `tratarEvento` (`src/server/receber-evento.ts`, ramo
`janela_fechada`) só grava nota na ficha. Na prática quase todo aluno está
fora da janela quando a aula é cancelada, então o aviso mais importante
quase nunca sai.

**Decidido:** modelo aprovado da Meta por evento, com nome fixo, do mesmo
jeito que a cobrança já faz com `lembrete_de_cobranca`:

- Modelos prontos por evento (ex.: `verandi_aula_cancelada`,
  `verandi_vaga_aberta`, `verandi_falta`), categoria utilidade, corpo com
  `{{1}}` nome, `{{2}}` dia, `{{3}}` hora, `{{4}}` aula. Criados por um botão
  no cartão de avisos (`src/components/conexoes/avisos-da-verandi.tsx`),
  copiando `acaoCriarModeloDeCobranca` (`src/server/acoes-mensalidades.ts`,
  ~linha 188: apaga o anterior, `acaoCriarTemplate`).
- No ramo `janela_fechada`: procura o modelo aprovado do evento
  (`listarTemplatesAprovados`), manda com `canal.enviarTemplate` e registra a
  saída, como `mandarLembretePorModelo` em `src/server/mandar-cobranca.ts`.
  Sem modelo aprovado, segue a nota de hoje.
- Variáveis: `destinatariosDoEvento` (`src/core/eventos-da-verandi.ts`) já
  monta `aluno_nome`, `aula_dia`, `aula_data`, `aula_hora`, `aula_servico`.
- **Custo:** modelo de utilidade a Meta cobra (ver a memória "Meta cobra
  mensagem de serviço"). Dizer isso na tela, uma linha, ao ligar.
- Nome fixo evita migration. Se precisar de coluna nova (escolher o modelo
  por gatilho), **não há autorização**: peça ao Gabriel antes.

## 2. Marcar aula direto pelo Inbox

**Hoje:** o cartão "Na Verandi" (`src/components/lead/aluno-da-verandi.tsx`)
só mostra. Quem marca é o bot ou a recepção na Verandi.

**Decidido:** botão "Marcar aula" no cartão (conversa e ficha):

- Abre um painel com os próximos dias e os horários livres:
  `horariosLivres(chave, de, ate)` em
  `src/server/formularios-do-whatsapp/agenda.ts` (já usado pelo formulário
  de agendamento). Filtrar pela modalidade do aluno quando houver
  (`modalidadeUnica` de `GET /pessoas/:id`).
- Marcar: `pessoaNaAgenda` + `marcarNaAgenda` (mesmo arquivo). 409 da Verandi
  é conversa normal ("horário encheu"): mostrar a frase dela.
- Tipo: reposição quando o aluno tem `reposicoesAbertas`, senão avulsa. Ver
  `POST /participacoes` na Verandi (`origem`: `avulso`, `reposicao`,
  `experimental`).
- Depois de marcar, oferecer mandar a confirmação na conversa (dentro da
  janela) e atualizar o cartão na hora (ação otimista, sem recarregar).
- Desmarcar pela mesma tela: `DELETE /api/v1/participacoes/:id`, que devolve
  `temCredito` (a frase muda se ficou ou não reposição).
- Capacidade: `atender`, como responder a conversa.

## Regras e armadilhas já pagas

- Nenhum dos dois lê o schema do outro: tudo pela API v1 da Verandi.
  Rota nova na Verandi exige entrada em `src/core/api-doc/referencia.ts` (o
  teste cobra) e caso em `e2e/api-v1.spec.ts`. O teste da documentação já
  falha por `GET /funcionamento` sem descrição; não é seu.
- O dev server local (`scripts/ux-local/dev.sh`, porta 3100) nesta WSL não
  vê edição feita por sed/python/cat: reinicie antes do print.
- Local não fala com a Verandi de produção sem chave real: para tela que
  depende dela, simule a resposta ou teste o receptor com aviso assinado
  (script de exemplo: HMAC de `instante.corpo` com o segredo do webhook
  `Verandi (avisos)` criado no banco local).
- MGM Pilates (`5de5a891-...`, ramo aulas) tem a chave da Verandi: o que for
  acréscimo aparece para o Daniel, e isso está liberado. Nada que mande
  mensagem sozinho para aluno do MGM sem alguém ligar.
- pt-BR, curto, sem travessão; print 1440 e 390; `tsc` limpo, lint e só os
  testes mexidos; push com o `GITHUB_TOKEN` do cofre nos dois repos e
  conferir `READY`. Feature nova em `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`.
