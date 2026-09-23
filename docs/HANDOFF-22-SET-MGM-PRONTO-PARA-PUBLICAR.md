# Handoff: a MGM está corrigida e validada, esperando autorização

Escrito para: quem for publicar na MGM, ou continuar daqui.

A rodada anterior deixou dois blocos abertos: a MGM (produção) e a Verandi
(outro repositório). **A Verandi saiu** (commit `d9d7b18` no repo dela, ainda
sem push: falta credencial do GitHub nesta máquina). A MGM está pronta,
validada e rodada de ponta a ponta, e **não foi publicada**: publicação em
produção depende de autorização explícita, uma a uma.

## O que já está decidido e não volta a discussão

**Cancelamento de contrato nunca fecha pelo bot.** Decisão do Gabriel em 22/09,
fechando o que o handoff anterior deixou em aberto. Todo ramo de cancelamento
transfere para uma pessoa, com o motivo escrito. Não prometa que é presencial:
isso continua sem decisão.

## O estado real da MGM, que mudou desde o handoff anterior

Outra sessão publicou no meio do caminho. Confira sempre pelo banco, nunca pelo
doc:

| Fluxo | `flow_id` | No ar | Versão para voltar |
|---|---|---|---|
| Reagendamento | `45a9db71-d702-4f4f-8510-d0687145fb0e` | v7 | `91af1324-afaa-47b7-82ad-159f053bf31f` |
| Atendimento | `ae9f663f-933d-4953-bbb9-aefed2360b57` | v12 | `f18cbccd-5502-4916-8d04-a127cb7bc858` |
| Agendamento | `7d05c074-b07f-4d06-855b-ba7430412138` | v7 | `a761881a-28e4-4f58-817d-02cd9a5c891c` |

O handoff anterior dizia v6 e v10. Estava velho. **Releia antes de publicar.**

## Como publicar

Os grafos corrigidos estão em `/tmp/.../scratchpad/mgm/novo-*.json` e o script
em `.publicar-mgm.mjs` (raiz do repo, não commitado). Dry-run é o padrão:

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
set -a && . .env && set +a
node .publicar-mgm.mjs            # mostra o que faria
node .publicar-mgm.mjs --commit   # publica, e relê a produção para provar
```

Ele usa `public.publicar_fluxo`, nunca insert à mão, e relê `versao_publicada_id`
depois. Se o scratchpad tiver sido limpo, refaça: baixe os grafos, rode `.fix.mts`
e valide antes.

## O que muda em cada fluxo

**Reagendamento** (3 textos, 2 nós novos, 4 arestas)
- `aula(s)` vira ramo de verdade: `mais-de-uma` separa "uma aula" de "N aulas".
- `reposição(ões)` no motivo do handoff vira "em aberto", que serve a qualquer
  número.
- *"Qual delas vamos remarcar?"* vira *"Toque na aula que vamos remarcar:"*.
  Com uma reposição o WhatsApp mostrava um botão sozinho debaixo de uma
  pergunta de escolha: o mesmo defeito que `065a77d` corrigiu no lembrete.
- A lista deixa de ser dita no texto. `{{reposicoes_abertas}}` junta os itens
  com o separador interno, e com três reposições a aluna lia
  `"... Pilates solo;sábado 22/08 ..."`. O menu logo abaixo já lista uma opção
  por reposição, e era ele que devia listar desde o começo.

**Atendimento** (1 texto, 2 nós novos, 4 arestas)
- Mesmo ramo de singular e plural, sobre a variável `reposicoes`.

**Agendamento** (1 texto)
- `{{telefone}}` vira `{{telefone_br}}` **só na frase**. A URL e o corpo JSON
  seguem crus, porque é por eles que a agenda acha a pessoa.

## O que foi procurado e NÃO é defeito

- **A contagem antes do ramo**, o defeito grave do template, **não existe na
  MGM**: nos dois fluxos a condição já roda antes da frase. Só o parêntese era
  problema.
- **Pedir data digitada**: nenhum dos quatro fluxos pede. O relato do Edu
  (*"ele fala dia 14 e n tem"*) não se reproduz no grafo publicado de hoje.
- **Rótulos de 21 caracteres** no Atendimento: passam no validador do produto
  para este canal. Não são defeito.
- **`{data}` cru** no rótulo de `proxima_aula` (Atendimento): a variável é
  extraída e **nunca usada** em mensagem nenhuma. Corrigir não mudaria uma
  palavra do que alguém lê. Deixado como está, de propósito.

## O que é decisão de produto, e por isso ficou parado

- **Mais de uma reposição.** O template manda para uma pessoa, por decisão
  registrada de quem opera: *"o bot marca uma; escolher qual remarcar primeiro
  é conversa com gente"*. A MGM oferece o menu. Mantive o comportamento dela:
  é regra do cliente, não defeito nosso.
- **Aula experimental x outras terapias** (Atendimento): decisão do Gabriel às
  15:24, *"oferece só pilates aula experimental e se a pessoa seleciona os
  outros transfere"*. **Não implementado**: muda o que o bot oferece, não como
  ele escreve.
- **Agendamento de liberação e outras modalidades**: o Daniel pediu que não
  saia pelo zap, o Edu discorda e ia falar com ele. Não mude sem saber se essa
  conversa aconteceu.
- **Levar os dois modelos novos** (reagendamento sem data livre, aluno inativo)
  para a conta da MGM: é criar fluxo novo, e é publicação.

## Como conferir, e por que não basta o validador

Os três grafos passam limpos em `fluxoSchema`, `validar()` e
`validarPublicacao()`. **Isso não teria achado nada do que apareceu.** O `;`
vazando e o botão único só apareceram rodando a conversa e lendo o que a pessoa
recebe, exatamente como a rodada anterior avisou.

O jeito que funciona: um teste vitest temporário que carrega o grafo baixado da
produção, roda `executar()` de ponta a ponta e imprime as falas. Duas
armadilhas que custaram voltas:

1. **Use o `mapear` da ação, não o do preset do repo.** O grafo da MGM mapeia
   `pessoas.0.ativa`; o preset do repo mapeia outra coisa. Com o preset errado
   a conversa desviava para `ola-inativo` e parecia que a correção não pegara.
2. **O mock precisa de `ativa: true`**, senão `e-aluno-ativo` manda todo mundo
   para o ramo de inativo antes de chegar na reposição.

## Ambiente

- `qrcode` está no `package.json` e não instalado: um arquivo de teste falha só
  por isso, igual sem nenhuma mudança. `npm install` resolve. **2238 testes
  passam.**
- Na Verandi, 24 arquivos de teste exigem Supabase local de pé
  (`npx supabase status`), que está fora aqui. Os 470 unitários passam e o
  `tsc --noEmit` fica limpo.
- O repo da Verandi andou durante o trabalho (`f85d271`). Rebaseei e revalidei.
  **`git fetch` antes de começar** continua valendo para os dois repos.

---

# PUBLICADO em 22/set/2026, à noite

Autorizado pelo Gabriel. Quatro publicações, todas pela RPC `publicar_fluxo`,
todas relidas da produção depois e com a conversa rodada contra o grafo
**baixado de volta**, não contra o arquivo local.

| Fluxo | Era | Ficou | Versão para voltar |
|---|---|---|---|
| Reagendamento | v7 | **v8** | `91af1324-afaa-47b7-82ad-159f053bf31f` |
| Atendimento | v12 | **v13** | `f18cbccd-5502-4916-8d04-a127cb7bc858` |
| Agendamento (redação) | v7 | v8 | `a761881a-28e4-4f58-817d-02cd9a5c891c` |
| Agendamento (experimental) | v8 | **v9** | `46a52c8b-c489-4cae-97c2-2241b74b42c5` |

Zero fluxos apontando para versão inexistente.

## A aula experimental, e a correção do que estava escrito

O doc anterior registrava a decisão como *"oferece só pilates aula experimental
e se a pessoa seleciona os outros transfere"*. **Está errado**, e o Gabriel
corrigiu em 22/09: oferece experimental de **todas** as modalidades; Pilates
aparelho o bot marca sozinho no fluxo normal de disponibilidade; qualquer outra
vai para um atendente.

O que se descobriu implementando: o Agendamento **já tinha** a pergunta
`qual-modalidade`, alimentada por `servicosExperimentais[]`. Essa chave da API
filtra por `aceitaExperimental`, e no banco da Verandi **só Pilates aparelho
tem esse campo** — os outros oito serviços ativos estão todos `false`. Ou seja,
o menu chegava ao WhatsApp com **uma opção só**, e quem queria RPG não via a
modalidade nem tinha como pedir.

A correção, em três partes:

1. `catalogo` passa a mapear `servicos[]` no lugar de `servicosExperimentais[]`,
   então o menu lista as nove modalidades ativas.
2. `e-pilates` compara `servico_id` com `26f98ed0-a814-4015-88bd-2008921547fc`.
   Verdadeiro segue para `quando`, que é o fluxo automático de sempre.
3. Falso cai em `experimental-com-pessoa`, um handoff com a modalidade escrita
   no motivo: *"quer aula experimental de {{modalidade}}"*.

**Por que não marcar as outras no banco da Verandi:** seria a outra saída
(ligar `aceita_experimental` em mais serviços), e ela é alteração em produto que
não se toca a partir deste repositório. Além disso exigiria decidir quais das
oito realmente aceitam, o que é pergunta para o cliente, não para nós.

## Um defeito de dado que ficou, e é da Verandi

O rótulo do menu vem da API e o WhatsApp corta em 20 caracteres:
`Toque de Tensigridade` chega como **"Toque de Tensigridad"**. O validador do
produto não pega porque só confere rótulo escrito à mão, e estes nascem em
tempo de execução.

E o nome está grafado errado no banco: **"Liberação Miofacial"**, sem o "s" de
*miofascial*. Os dois são dado da Verandi, em `app_verandi.servico`, e este
repositório não altera objeto de lá. Levar para quem cuida da Verandi.

## Como provar, se precisar refazer

O caminho que funcionou está descrito acima, e a armadilha do `mapear` vale
também aqui: o fluxo de Agendamento pede o nome antes do menu quando a pessoa
não está na agenda, então o teste precisa responder texto livre para chegar na
modalidade. Sem isso a conversa para em *"Como posso te chamar?"* e o menu
parece vazio.

Os rótulos também não são `d0, d1, ...`: pegue o `id` real da opção pelo
rótulo, senão você escolhe Personal Pilates achando que escolheu Pilates
aparelho — aconteceu.
