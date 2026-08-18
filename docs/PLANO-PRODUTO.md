# Plano de produto — de editor de fluxo a plataforma de atendimento

Escrito em **17/ago/2026**, a partir de 13 prints do BotConversa **comentados por
quem opera**, e de uma leitura do nosso código para conferir o que já existe.

Este documento não substitui o [PLANO-MESTRE.md](PLANO-MESTRE.md) — ele responde
uma pergunta que o mestre não responde: **que produto isto é**. O mestre continua
sendo o índice de fases e critérios de aceite; quando divergirem na ordem, este
manda no *o quê* e o mestre manda no *como provar que terminou*.

Irmãos: [EXPANSAO.md](EXPANSAO.md) fez a análise das 31 telas em 13/ago e
continua valendo — os prints de agora são da **mesma conta** (MGM Studio Pilates,
workspace `210139`). A diferença é que agora eles vêm **com opinião de quem usa**,
e a opinião muda três decisões que estavam fechadas.

---

## 1. O diagnóstico, em uma frase

**Somos um editor de fluxo com um painel em volta; precisamos ser a ferramenta
onde o atendimento do cliente acontece.** A diferença não é de estética. É que
hoje quase tudo que um negócio faz por WhatsApp num dia normal — mandar uma foto
da sala, saber que "Rodrigão comedor delas" é o Rodrigo, atribuir a conversa pra
alguém, responder amanhã — o produto não faz.

A evidência mais dura já estava escrita e não foi lida como devia. O
[EXPANSAO.md §2.6](EXPANSAO.md) analisou doze dias de conversa real do MGM e
concluiu: **o bot não participou de nenhuma mensagem.** Falta, remarcação,
aniversário, cancelamento — tudo humano. O bot cuida da porta da frente; o resto
do dia é atendimento. Nós construímos muito bem a porta da frente.

---

## 2. O que os 13 prints provam, um a um

A coluna "nosso estado" foi conferida no código, não lembrada.

| # | O que o print mostra | O que o comentário diz | Nosso estado hoje | Vira |
|---|---|---|---|---|
| 1 | Seletor de workspace no canto inferior esquerdo | *"Esquerda é a empresa/clientes, superior direito é o seu usuário — ManyChat usa o mesmo modelo"* | O oposto: um painel com todos os clientes, entra-se e sai-se pela lista | **Decisão aberta §7** |
| 2 | Contatos | *"informações gerais de clientes que entraram em contato"* | Temos `/leads`, e o nome está errado — ver §4.2 | Renomear + §4.2 |
| 3 | Inbox com `Atribuído: Todos 55 · Nenhum 55 · Meus chats · Daniel · Eduardo` | *"chats"* | Inbox existe desde `d8b3671`, **sem atribuição, sem não-lidas, sem "meus chats"** — porque não há usuários | Fase D |
| 4 | Fluxos com `Conexões · Execuções · CTR% · Última alteração` e 4 fluxos padrão | *"Fluxos"* | Temos execuções; não temos conexões, CTR, pastas nem fluxo padrão | Fase E |
| 5 | Integrador (iPaaS alugado), 2 automações vazias, `0/5.000 ações` | *"caso queira integrar com outras ferramentas"* | Bloco `http` + cofre — **mais poderoso, menos usável** | Fase F |
| 6 | Configurações → WhatsApp: número, WABA, limites, CoEx | — | `/numero` mostra menos | Fase E |
| 7 | Marcado **"CONECTAR ZAP QR"**; grifados os ganchos: boas-vindas, resposta padrão, mídia, pós-suporte | — | **Nenhum dos quatro ganchos existe.** Um número → um fluxo | Fase E |
| 8 | Perfil da empresa (descrição, setor, e-mail, site, endereço) + Desconectar | *"sem clicar em botão nenhum você vê todas as informações... desconectar é fácil de achar, mas não é na 'cara', o que diminui as chances de algum imbecil clicar sem querer"* | Espalhado entre `/ajustes` e `/contexto`; o perfil da Meta não existe | Fase A |
| 9 | O fluxo `PRINCIPAL - ATEN…` truncado, canvas espalhado | *"deveria ter o nome completo do fluxo"* · *"parece meio bagunçado, cima para baixo acho que é uma forma boa"* | **Temos o mesmo defeito**: `editor.tsx:426` é `max-w-56 truncate` | Fase A |
| 10 | Menu de blocos · Compartilhar fluxo | *"a visualização mostra como o fluxo está funcionando (nome prático, eu manteria)"* · *"compartilhar não é o intuito de testar"* | Nossa aba `Testar` já é superior. O nome é que é pior | Fase A |
| 11 | Submenu Integração | *"o botão com nome de integração mudaria para: **Serviços externos**"* | `nos.tsx:50` chama de **"API"** — pior ainda | Fase A |
| 12 | Modelos (wizard 1/4) | *"o uso só é prático para quem tem muitos clientes ou migra de plataforma; eu colocaria dentro de configurações"* | Não temos, e **não devemos** virar item de menu | §8 |
| 13 | Contatos de novo | *"nada impede o cliente de ter escrito nome errado na planilha... o nome seria 'Rodrigo' e não 'Rodrigão comedor delas'"* | `contacts.nome` guarda o perfil do WhatsApp e ponto | **Fase C** |

### O print 13 é o mais importante do conjunto

Os outros doze descrevem telas. Este descreve um **problema de dado que quebra
tudo que vem depois**: relatório, transmissão segmentada, CRM, cobrança.

O WhatsApp entrega o nome que a pessoa escolheu pra si. O cliente tem o nome de
verdade numa planilha, com telefone errado ou faltando. **Nenhum dos dois lados
é confiável sozinho, e ninguém concilia.** Enquanto isso não existir, a lista de
contatos é um amontoado de apelidos e o cliente não reconhece o próprio aluno.

---

## 3. O buraco funcional: mídia

Você disse que eu afirmei que o sistema comportava imagem. **Não comporta, e a
documentação já registrava isso** — o [EXPANSAO.md §1.6](EXPANSAO.md), na "lista
honesta" de 13/ago, tem a linha: *"Mídia (imagem, vídeo, arquivo, áudio de
saída) — o motor só tem `enviar_texto` e `enviar_opcoes`"*. Conferido agora no
código, continua exato:

```
core/engine/types.ts  →  enviar_texto · enviar_opcoes · salvar_campo ·
                         chamar_ia · chamar_http · transferir_humano · encerrar
core/flow/schema.ts   →  mensagem · pergunta · condicao · salvar-campo ·
                         ia · handoff · http
```

Sete blocos, sete ações, **zero mídia**. `grep` por `image|audio|video|document`
em `src/channels/` não retorna uma linha.

O que existe é o lado de **entrada**: mídia recebida vira handoff em vez de "não
entendi" (`receber-mensagem.ts:484`). Isso é uma garantia boa e não é o que se
pede numa reunião.

**Isto sai de "gatilho: quando alguém pedir foto" e vira a Fase B.** O motivo é o
próprio MGM: um estúdio vende sala, aparelho e horário. Uma imobiliária vende
imóvel. Uma produtora vende portfólio. O catálogo **é** a conversa. Um bot que
não manda foto não está incompleto — está desligado do negócio.

---

## 4. Os dois lados que o produto precisa ter

Hoje existe **um** lado: uma senha, um operador, acesso a tudo. A pergunta "o que
o cliente vê quando loga" não tem resposta porque o cliente não loga.

### 4.1 Do nosso lado (operador 4YU)

O que já temos serve, e o que falta é agência de verdade: ver os clientes com o
número que importa, entrar num deles, desenhar, publicar, e sair. A tela de
clientes é a porta e hoje ela não informa nada — ver §5.

### 4.2 Do lado do cliente

Este é o produto que ainda não existe, e ele define até onde o cliente chega:

| Ele **vê** | Ele **faz** | Ele **nunca** |
|---|---|---|
| Inbox das conversas dele | Responder, atribuir, encerrar | Vê o editor de fluxo |
| Contatos com nome de gente | Etiquetar, anotar, corrigir nome | Vê credencial, cofre ou chave |
| Painel: quantos chegaram, quantos o bot resolveu, quanto tempo até a 1ª resposta | Exportar, filtrar, buscar | Vê outro cliente — nem a existência dele |
| Perfil do negócio dele | Pausar automação por contato | Publica versão |
| Horário de atendimento | Editar respostas rápidas | Toca `/api/simular` |

**"Lead" é o nome errado para essa tela e o print 2 confirma:** o comentário diz
*"informações gerais de clientes que entraram em contato"* — **clientes**, não
leads. O [EXPANSAO.md §2.6](EXPANSAO.md) já tinha chegado lá pelo outro caminho:
o Walter é aluno há meses e nunca vai ter coluna preenchida numa tabela de
qualificação. Lead é um **estado** por que um contato passa, não o nome dele.

> Nada disto é liberável antes da **Fase 4 do plano mestre** (papéis, isolamento,
> RLS, e o furo do `/api/simular` que manda credencial de qualquer cliente para
> a URL do corpo). A fase 4 deixou de ser só dívida de segurança: **ela é o que
> constrói o segundo lado do produto.**

---

## 5. A tela de clientes, que você odiou com razão

Ela é o retrato do problema geral, então vale destrinchar
([`src/app/page.tsx`](../src/app/page.tsx)):

1. **`max-w-[1120px]`** trava a página. Em tela larga sobra vazio à direita por
   decisão nossa, não por limitação.
2. **Cards de `min-h-[172px]`** numa grade `auto-fill minmax(310px, 1fr)`. Com
   três clientes, três caixas altas e um deserto.
3. **`comIa` aparece duas vezes no mesmo card** — como selo no canto superior
   direito (linha 82) e de novo na linha de números (linha 95). Não é escolha, é
   sobra.
4. **O conteúdo não é sobre o negócio.** Diz "cliente AutoFluxos" (o card já está
   na tela de clientes), "N automações" e "estrutura configurada". Nada sobre
   **quantas pessoas estão esperando resposta agora**, que é a única coisa que
   faria alguém abrir essa tela de manhã.

O conserto não é enfeitar o card: é **trocar o que ele diz** e deixar a largura
seguir a tela. Uma lista densa com conversas esperando, último movimento e o
número do mês responde a pergunta certa e não deixa buraco.

---

## 6. As fases

Ordem por dependência real. Cada uma cabe numa rodada — construir, você revisar,
validar.

### Fase A — o que está torto e é barato ✅

**Concluída em 17/ago/2026.** A lista de clientes virou fila de trabalho: cada
linha diz quantas pessoas esperam atendimento, quantos contatos, quantas
automações e o último movimento, ordenada por quem espera primeiro. Os números
saem da view `resumo_clientes` (migration `0016`), numa consulta só — chamar
`contarEsperandoPessoa` por cliente seria N+1 na primeira tela que abre.

Itens 5 e 6 **já estavam feitos** e a leitura do plano estava errada: a ficha do
cliente já lê fechada mostrando os dados sem clicar em nada, e o botão de apagar
já mora longe do resto, com o comentário no código dizendo exatamente o motivo
que o comentário do print 8 formula. Nada a fazer.

O item 4 também não virou trabalho, por outro motivo: a nossa aba se chama
**Testar**, e ela testa de verdade — executa o motor e chama API com a credencial
real do cliente. Chamar de "Visualização" seria o erro de nome que o próprio
EXPANSAO lista como regra ("um nome, uma coisa"). O que o print 10 pede de
verdade — separar compartilhar de testar — não se aplica: não temos
compartilhamento.

Sem migration além da `0016`. É a rodada que faz o sistema parar de parecer
estranho.

1. **Tela de clientes reescrita**: largura que acompanha a tela, densidade de
   lista, e os números que importam (esperando resposta, conversas no mês,
   último movimento). Fim do `comIa` duplicado.
2. **Nome completo do fluxo no editor** — tirar `max-w-56 truncate` de
   `editor.tsx:426`. É a reclamação do print 9, e é nossa também.
3. **Renomear o bloco `http` de "API" para "Serviços externos"** (print 11).
   "API" é o nome da tecnologia; "serviços externos" é o nome do que ele faz.
4. **Manter "Visualização"** como nome do teste (print 10) e separar
   explicitamente de compartilhar.
5. **Perfil do negócio numa tela só**, visível sem clicar em nada — juntar o que
   hoje está partido entre `/ajustes` e `/contexto` (print 8).
6. **Ação destrutiva achável, não proeminente** — a regra que o comentário do
   print 8 formula melhor do que qualquer guia: *fácil de achar, longe do
   caminho de quem não procura*.

### Fase B — mídia (§3) ✅

**Concluída em 17/ago/2026.** O oitavo bloco. Ação `enviar_midia` no motor,
bloco no schema/validador/editor, adaptador da Cloud API, acervo por cliente no
Storage (migration `0017`) e a mídia aparecendo no simulador, no Lead e no Inbox.

Três decisões que valem além desta fase:

- **A regra do formato mora no motor, não no adaptador.** Áudio não aceita
  legenda e documento tem nome de arquivo — se o WhatsApp saísse de cena amanhã,
  isso continuaria valendo. O adaptador repete a condição porque uma versão
  publicada antes desta regra pode carregar a legenda no grafo.
- **Envio por `link`, e não por upload com `media_id`.** O plano pedia `media_id`
  com reuso; o id expira em 30 dias e obrigaria a guardar validade e reenviar
  sozinho, que é um cache com invalidação para economizar um GET da Meta. O
  aceite mudou junto.
- **O bucket novo se chama `autofluxos-acervo`.** O das logos se chama `logos`,
  sem prefixo, e Storage é global — a Verandi tem dois buckets ali do lado.
  Renomear quebraria toda `logo_url` gravada; o bucket novo é que não repete o
  erro.

**Aceite alcançado:** 18 testes novos cobrem motor, validador e o caminho inteiro
pelo webhook; falha de envio de mídia vira handoff e **para o resto das ações**,
como já valia para texto. Falta a prova final: mandar uma foto no WhatsApp real.

### Fase C — identidade do contato (print 13)

Migration. É o que transforma a lista de apelidos em lista de gente.

1. Separar **nome do perfil do WhatsApp** de **nome de verdade**, com precedência
   explícita e visível: mostra-se o real, guarda-se o do WhatsApp.
2. Editar o nome na tela, e a edição vence a próxima mensagem que chegar.
3. **Importar a planilha do cliente** (CSV) e conciliar por telefone
   normalizado — E.164, com e sem o 9, com e sem DDI.
4. Tratar os dois casos que o comentário levanta: **telefone faltando** (fica
   pendente de conciliação, não some) e **nome divergente** (o humano decide, e a
   decisão persiste).
5. Notas e campos manuais no contato — hoje só existe o que o fluxo coletou.

**Aceite:** importar 300 linhas com telefone em quatro formatos casa com os
contatos existentes sem duplicar; um contato conciliado nunca volta a se chamar
pelo apelido do WhatsApp.

### Fase D — papéis e o produto do cliente (§4.2)

É a **Fase 4 do plano mestre**, com o escopo de produto somado ao de segurança.
Entregas e critérios de aceite continuam lá; o que este documento acrescenta é
que ela também entrega:

1. Atribuição de conversa no Inbox — `Todos · Nenhum · Meus chats · por pessoa`
   (print 3).
2. Contagem de não lidas.
3. Painel do cliente: chegaram, o bot resolveu, esperando pessoa, tempo até a
   primeira resposta.

### Fase E — os ganchos do canal (print 7)

Os quatro seletores grifados no print são **um contrato de configuração** que não
temos. Hoje é um número → um fluxo.

1. **Fluxo de boas-vindas** — quem nunca falou com o bot.
2. **Resposta padrão** — quando nada casa.
3. **Fluxo padrão para mídia** — hoje mídia recebida vira handoff, e nem sempre é
   o que o cliente quer.
4. **Fluxo pós-atendimento** — dispara quando o chat fecha; é onde mora pesquisa
   de satisfação.
5. **Palavras-chave por cliente**, somadas às garantias fixas do motor.
6. `/numero` mostrando o que a Meta já sabe: WABA, limite de mensagens,
   verificação, status, linha de crédito (print 6).

> **"CONECTAR ZAP QR" (print 7) merece uma resposta explícita, e ela é não.**
> Conectar por QR é o modelo do WhatsApp Web, que é o que a Evolution API faz — e
> o [ESTADO.md](ESTADO.md) já registra por que ficamos fora disso: *perder o
> número do cliente é o pior fracasso possível para uma agência*. O que dá a
> sensação de "conectei em dois cliques" pela via oficial é o **Embedded Signup
> v4 com Coexistence**, que depende da nossa verificação e do App Review. Está na
> Fase 8 do plano mestre e não é código nosso que destrava.

### Fase F — conectores de CRM (print 5)

Você levantou o RD Station, e a generalização está certa: **todo CRM grande tem
API própria**. O print 5 mostra o caminho errado — o BotConversa alugou um iPaaS
de terceiro, e o resultado no print é duas automações vazias e 5.000 ações que o
cliente paga sem usar.

Nosso caminho é o oposto e já está meio construído: **o bloco de serviços
externos + o cofre de credenciais já falam com qualquer API.** O que falta não é
motor, é **não obrigar ninguém a montar um POST na mão**:

1. **Conexão tipada por serviço** — escolher "RD Station" e informar o token, em
   vez de decorar URL, cabeçalho e formato.
2. **Presets de bloco** por serviço: criar lead, atualizar oportunidade, mover de
   etapa. Um preset é um `http` pré-preenchido — **não** um tipo novo de nó, e
   por isso alterar um preset não mexe em fluxo já publicado.
3. **RD Station primeiro**, porque é o cliente real. Depois, na ordem em que
   aparecerem: Pipedrive, HubSpot, Google Sheets.
4. **OAuth2 como tipo de conexão** quando o primeiro serviço exigir — hoje o
   cofre guarda chave estática.

A regra do [ESTADO.md](ESTADO.md) continua mandando: *ferramenta externa pode ser
destino de um webhook nosso, nunca requisito para funcionar*. Preset é atalho
pra quem tem CRM, não dependência pra quem não tem.

### Fase G — tempo

Fases 7 e 8 do mestre (subfluxos, agendador, sequências, timeout de pergunta,
horário de atendimento). Não muda; **depende do agendador** e o agendador não tem
trava externa.

---

## 7. A decisão que preciso de você — modelo de navegação

O print 1 mostra o modelo do BotConversa e do ManyChat: **entra-se dentro do
cliente**, troca-se por um seletor no canto inferior esquerdo, e o seu usuário
fica no canto superior direito. O nosso é o inverso: um painel com todos os
clientes.

O [EXPANSAO.md](EXPANSAO.md) concluiu em 13/ago que **o nosso é o certo para
agência** — quem opera três clientes quer ver os três. O comentário do print 1
aponta o contrário, e não é opinião solta: é o padrão das duas maiores
ferramentas do ramo.

Os dois estão certos, para pessoas diferentes. **A resposta muda com a Fase D:**

- o **operador da 4YU** cuida de N clientes e quer a visão de cima;
- o **cliente logado** só tem um e nunca deveria ver seletor nenhum.

Minha recomendação é **manter a lista de clientes como a casa do operador** e
adicionar o seletor de troca rápida **dentro** do cliente, para não precisar
voltar à lista a cada pulo. O usuário no canto superior direito entra junto com a
Fase D, quando existir usuário.

**O que preciso decidido antes da Fase D:** se você quer que o operador também
opere "dentro de um cliente por vez", como eles, ou se a visão de cima continua
sendo a nossa.

---

## 8. O que continua fora, e por quê

Mantido de [EXPANSAO.md §5](EXPANSAO.md), com uma entrada nova:

| Fora | Por quê |
|---|---|
| **iPaaS embutido** | O print 5 mostra o preço: automação vazia e cota paga sem uso. Fase F faz melhor com o que já temos |
| **Conectar por QR** | Perder o número do cliente é o pior fracasso possível. Só Cloud API oficial — §Fase E |
| **Kanban / CRM** | Outro produto. A Fase F integra com o CRM do cliente em vez de virar um |
| **Modelos como item de menu** | O próprio comentário do print 12: *"só é prático para quem tem muitos clientes"*. Vai para dentro de Configurações, se for |
| **Randomizador, eventos personalizados** | Volume não justifica; métrica sem pergunta é dado morto |

E a regra que o print 12 reforça: **não crescer a lateral por acumulação.** Eles
têm 11 itens; nós temos 5. Cada coisa nova precisa achar casa em `Fluxos`,
`Inbox`, `Contatos` ou `Ajustes` **antes** de virar item de menu.

---

## 9. Ordem sugerida

| Rodada | Fase | Por que aqui |
|---|---|---|
| ~~1~~ | ~~**A** — o que está torto~~ | ✅ 17/ago |
| ~~2~~ | ~~**B** — mídia~~ | ✅ 17/ago |
| 3 | **C** — identidade | Sem isso, todo relatório e toda segmentação nascem sujos |
| 4–5 | **D** — papéis e o lado do cliente | É o portão: nenhum cliente loga antes. Entrega o segundo produto |
| 6 | **E** — ganchos do canal | Depende de papéis para saber quem configura |
| 7 | **F** — conectores de CRM | Depois que houver um cliente com CRM de verdade em produção |
| 8+ | **G** — tempo | Fases 7–8 do mestre, sem mudança |

**Se for para escolher uma só: a B.** Mídia é a única da lista em que a resposta
hoje é "o produto não faz", e não "o produto faz de um jeito pior".

---

## 10. O que este documento mudou de premissa

Três coisas que estavam fechadas e não estão mais:

1. **Mídia deixou de ser item de gatilho** ("quando um cliente pedir") e virou a
   segunda rodada. Catálogo não é pedido eventual: é o assunto da conversa.
2. **"Lead" deixou de ser o nome da tela.** A tela é de contatos; lead é um
   estado por que alguns deles passam.
3. **A Fase 4 do mestre deixou de ser dívida de segurança** e virou a entrega do
   segundo lado do produto. Ela sempre foi obrigatória; agora ela também é
   desejável.

E uma que **não** mudou, apesar do print: nada de conectar número por QR.
