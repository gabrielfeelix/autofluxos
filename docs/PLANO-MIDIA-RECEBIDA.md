# Espelhar a mídia que o cliente manda

> Levantamento de **15/set/2026**. Escrito para quem for implementar — e para
> quem for decidir se vale.
>
> **A regra deste documento é a mesma da auditoria de segurança:** toda
> afirmação cita arquivo e linha, ou URL de fonte primária. Onde não houve
> confirmação, está escrito "não confirmado". Onde a pesquisa devolveu citação
> errada, está escrito o que era e o que se provou.

---

## O problema, em uma frase

O cliente manda a foto do comprovante e quem atende vê `(áudio, imagem ou
documento)`.

O webhook chega com o `id` da mídia, guardamos o `payload` cru e passamos o
`midiaId` adiante ([receber-mensagem.ts:1397-1408](../src/server/receber-mensagem.ts#L1397-L1408)),
e **nunca baixamos o arquivo** — `grep` por `media` em `src/` não acha nenhuma
chamada de download. O `anexo` que a bolha desenha
([anexo.tsx](../src/components/lead/anexo.tsx)) só existe para a mídia que
**nós** mandamos.

Com legenda, a bolha mostra a legenda. Sem legenda, mostra a frase genérica.

---

## O relógio que decide tudo

Da referência de mídia da Cloud API
(https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media):

| O quê | Prazo |
|---|---|
| `id` de mídia que chega no webhook | **7 dias** |
| URL devolvida pelo `GET /{media-id}` | **5 minutos** |
| `id` de mídia que **nós** subimos | 30 dias |
| Teto de download | 100 MB |

E dos termos da Cloud API, seção 4.5
(https://www.facebook.com/legal/WhatsApp-Business-Platform-Cloud-API):

> *"Meta does not offer archiving service or backup features, and you will be
> the sole person responsible for creating backups."*

Quando o negócio para de usar a Cloud API, a Meta apaga o conteúdo remanescente
do lado dela em **90 dias**.

**Consequência, e é a frase que decide o projeto:** o histórico de mídia só
existe se nós o guardarmos. Passados 7 dias não há de onde recuperar — nem
pagando, nem pedindo à Meta. Cada dia sem isto no ar é mídia perdida para
sempre.

### Tetos por tipo, que mudam o dimensionamento

| Tipo | Teto |
|---|---|
| Figurinha estática (WebP) | **100 KB** |
| Figurinha animada (WebP) | **500 KB** |
| Imagem (JPEG, PNG) | **5 MB** |
| Áudio (AAC, AMR, MP3, M4A, OGG) | 16 MB |
| Vídeo (MP4, 3GPP) | 16 MB |
| **Documento** (PDF, Word, Excel, PPT, TXT) | **100 MB** |

Isto corrige o comentário da própria migration `0017`, que diz *"16 MB é o teto
da própria Cloud API para vídeo e documento"*. Para documento o teto é 100 MB —
irrelevante para a mídia que sai, decisivo para a que entra: **um único PDF pode
ocupar 10% do plano gratuito inteiro.**

---

## O que o mercado faz de verdade

Só dois casos são verificáveis em código aberto, e são os que valem:

**Chatwoot** (`app/services/whatsapp/incoming_message_base_service.rb`):
baixa da Graph API e faz **cópia permanente** no próprio storage via
ActiveStorage (S3/GCS/Azure/MinIO). Nunca volta a referenciar a URL da Meta.
Trata `location` e `contacts` em caminho separado da mídia — o mesmo desenho a
que chegamos aqui em 15/set. **Não tem rotina de expurgo.**

**Evolution API**: S3/MinIO com `presignedGetObject` — URL **assinada**, com
expiração fixa de 7 dias, não configurável (issue #1404).

**360dialog** é o único fornecedor que publica número
(https://docs.360dialog.com/partner/messaging/media-messages/upload-retrieve-delete-media):
mídia enviada 30 dias após o último uso, mídia recebida 7 dias, URL de download
assinada por hash e válida por **5 minutos**.

**Take Blip, Kommo, Zenvia, Digisac, Huggy, Respond.io, Sleekflow não publicam
prazo de retenção nem tipo de URL.** Blip documenta criptografia e diz não ter
acesso ao conteúdo, sem prazo. O resto é página de marketing, e afirmação de
marketing sobre segurança entra aqui como **não verificada**.

**O padrão real, então, é URL assinada de validade curta — não link público.**

### O que já deu errado nos outros

Duas issues do Chatwoot, conferidas na API do GitHub, não só citadas:

- **#15072**, fechada, criada em 19/07/2026: *"Unauthenticated ActiveStorage
  direct-upload (missing authentication) on the conversation direct_uploads
  endpoint"*. Corrigida pela **#15329**.
- **#11019**, **aberta desde 04/03/2025**: *"Configurable Signed URLs expiration
  time for active_storage"* — a maior plataforma aberta do ramo ainda não deixa
  configurar a expiração da URL assinada.

> **Nota de método.** A pesquisa devolveu um identificador de advisory
> (`GHSA-5h82-j98m-7r5c`) que **não existe** — 404. As issues existem e batem
> com a descrição. O número estava errado, o fato estava certo, e é por isso que
> este documento só cita o que foi aberto e lido.

**Vazamento público de mídia de atendimento por bucket aberto: nenhum caso
encontrado** em nenhuma das plataformas pesquisadas.

**A dor real do usuário não é vazamento, é perda.** Digisac e Huggy no Reclame
Aqui com instabilidade e perda de mensagem; Chatwoot com anexo que some quando o
Redis reinicia (#6402) e áudio que dá 404 no primeiro load (#14511, #14644).

---

## O que a Meta exige de nós, por contrato

Os Meta Platform Terms entram na Cloud API por incorporação (Cloud API Terms,
seç. 1.3.2). Valem para nós como Tech Provider
(https://developers.facebook.com/terms):

- **3.d.i.2 — apagar "assim que razoavelmente possível"** quando não houver mais
  propósito comercial legítimo, quando o produto parar de operar, quando a Meta
  pedir para proteger usuários, **quando o usuário pedir a exclusão ou deixar de
  ter conta**, ou quando a lei exigir.
- **3.d.i.1** — oferecer "uma forma facilmente acessível e claramente marcada" de
  pedir alteração ou exclusão.
- **6.a.i** — proteções que "cumpram ou excedam padrões do setor, **considerando
  a sensibilidade** dos dados", impedindo qualquer processamento não autorizado.
- **7.c.i** — a Meta pode auditar **uma vez por ano civil**, e a 7.c.iii obriga a
  dar acesso a registros e sistemas.

**O que NÃO existe, e é importante não inventar:**

- **Não há exigência explícita de criptografia em repouso** para a mídia que o
  Tech Provider baixou. O texto dos Platform Terms não contém a palavra
  criptografia; a exigência explícita que existe é para **senhas**, em outro
  documento cuja aplicabilidade à Cloud API não foi confirmada.
- **Não há webhook de exclusão** para o usuário final do WhatsApp. O "Data
  Deletion Callback" da Meta é do Facebook Login. A obrigação de apagar é
  contratual; o mecanismo automático não existe — **o botão é nosso para
  construir**.
- Nenhuma cláusula proíbe nem autoriza expressamente reter mídia baixada
  indefinidamente. O limite vem do dever de apagar quando não há mais propósito,
  que é o mesmo teste da LGPD.

**E quem é o quê:** os WhatsApp Business Data Processing Terms (seç. 3.f) põem o
negócio como **Controller** e a WhatsApp apenas assistindo. No nosso arranjo, o
cliente (o estúdio, a clínica) é **controlador** e o AutoFluxos é **operador**.
Isso não nos isenta — operador responde solidariamente quando descumpre a lei ou
as instruções do controlador —, mas define que o **contrato com o cliente
precisa dizer o prazo de retenção e quem atende o pedido do titular.**

---

## O que a LGPD cobra, e o que já foi punido de verdade

**O risco muda de categoria.** Hoje guardamos texto de conversa. Passar a
guardar arquivo significa guardar RG, comprovante de pagamento e exame médico —
dado sensível e dado financeiro, que são exatamente os agravantes que disparam
obrigação de comunicar incidente.

**Resolução CD/ANPD nº 15/2024**, confirmada em fonte oficial
(https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca):
comunicar ANPD e titulares em **3 dias úteis** da ciência do incidente. A
obrigação nasce quando há risco relevante somado a agravante — **dado sensível,
dado financeiro, dado de criança, credencial, ou larga escala**.

**O que a ANPD já puniu:**

- **TikTok/ByteDance — R$ 153,7 milhões**, DOU de 25/08/2026, por falhas na
  proteção de dados de crianças e adolescentes. A sanção inclui **determinação
  de eliminar os dados coletados irregularmente**
  (https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-multa-tiktok-em-r-153-7-milhoes-por-falhas-na-protecao-de-dados-de-criancas-e-adolescentes).
- **Telekall Infoservice** — R$ 14.400 e advertência, processo
  00261.000489/2022-62, primeira multa da LGPD, por venda de lista de contatos
  de WhatsApp sem base legal.
- **Instituto Saúde e Cidadania** — ransomware com ~500 mil pacientes, processo
  aberto em 08/07/2026, **sem sanção definida ainda**.

**Vazamentos brasileiros por bucket S3 aberto** (todos documentados, nenhum com
sanção da ANPD confirmada): WSpot (~2,5 milhões de pessoas, com CPF), Prisma
Promotora (717 mil arquivos, ~10 mil clientes — **fotos de documento, cartão e
gravações de áudio**), FutebolCard/Palmeiras.

**Jurisprudência:**

- **STJ, REsp 1.903.273-PR** (Nancy Andrighi, 24/08/2021): divulgar conversa de
  WhatsApp sem autorização gera dever de indenizar quando há dano.
- **STJ, AREsp 2.130.619** (17/03/2023): para dado **comum**, é preciso provar
  dano efetivo — condenação de R$ 5 mil contra a Eletropaulo foi reformada.
- **TJ-AC, 0700406-91.2019.8.01.0007**: clínica divulgou resultado de exame em
  grupo de WhatsApp; R$ 4.000 de dano moral.

**O achado mais honesto da pesquisa, e o que mais calibra a decisão:**
**nenhum caso encontrado** de sanção ou condenação por **reter passivamente**
histórico de atendimento além do necessário. O padrão real de punição no Brasil
é **divulgação ativa** ou **falha técnica que expõe**. Guardar não é o que pune;
**vazar é.**

Isso inverte a prioridade: o prazo de retenção é higiene e obrigação contratual
com a Meta, mas **o que decide se isto dá certo ou vira processo é o controle de
acesso ao arquivo.**

---

## Onde isto encosta no nosso código

**O bucket de hoje não serve, e quem o criou já disse isso.** A migration
[`0017_acervo_de_midia.sql`](../supabase/migrations/0017_acervo_de_midia.sql)
cria `autofluxos-acervo` **público**, e escreve a fronteira:

> *"Público, e a decisão é consciente. A Cloud API baixa o arquivo do `link` que
> mandamos... O que entra aqui é material que o cliente publica no WhatsApp de
> qualquer forma — catálogo, foto de sala, PDF de plano. **Documento pessoal não
> entra, e isso é regra de uso, não de banco.**"*

Mídia recebida é exatamente o documento pessoal que aquele parágrafo exclui.
Ela precisa de bucket próprio, privado, com URL assinada — **caminho novo, não
extensão do atual.**

**O encaixe é limpo.** O webhook já responde `200` na hora e processa no
`after()`, com `maxDuration = 60`
([webhook/whatsapp/route.ts:35-87](../src/app/api/webhook/whatsapp/route.ts#L35-L87)).
O download cabe ali sem inventar fila.

**A retenção já existe e vira requisito.**
[`repos/retencao.ts`](../src/server/repos/retencao.ts) tem
`MESES_DE_RETENCAO_PADRAO = 12`, cron diário na Vercel às 07:00 UTC
([vercel.json](../vercel.json)), e apagar contato cascateia as mensagens. **Se o
expurgo não apagar o arquivo do Storage junto, sobra dado pessoal órfão no
bucket** — o mesmo cuidado que
[`repos/clientes.ts`](../src/server/repos/clientes.ts) já toma com logo e
acervo.

**O que aperta:** Supabase no plano **free** (org `4YU Systems`, confirmado pela
Management API) — **1 GB de storage, 5 GB de egress/mês, sem backup**,
compartilhados com a Verandi. Pro custa **US$ 25/mês** com 100 GB de storage,
250 GB de egress e backup diário de 7 dias.

**O número, medido em 15/set:** 17 arquivos de mídia em três dias, com um cliente
piloto, e **nenhum documento** ainda. O Storage tem 12 MB usados de 1 GB. A conta
completa está em [A.1](#a1-volume-real-em-produção-medido-não-estimado): no ritmo
de hoje o free dura meses, com dez clientes dura 22 dias, e o vídeo é 88% dos
bytes.

---

## O desenho proposto

1. **Bucket novo `autofluxos-recebidos`, privado.** Nunca o acervo público.
2. **URL assinada e curta (5 min), gerada no servidor na hora de desenhar a
   bolha.** Nunca gravar URL assinada no banco: URL persistida é link público com
   passo extra.
3. **Download no `after()` do webhook**, reusando o padrão que já existe.
4. **Coluna `arquivo jsonb` em `messages`** (migration `0055`), e não mais chaves
   nossas dentro do `payload` cru — o `payload` é o que a Meta mandou, e misturar
   os dois já confunde quem lê `anexoDoPayload`.
5. **A mídia não tem prazo próprio: ela herda o do contato.** — *decidido em
   15/set, e a proposta anterior de 90 dias foi descartada.*

   A ideia de expurgar mídia em 7, 14 ou 90 dias parecia certa por analogia com
   o WhatsApp, e a analogia é falsa: **o WhatsApp não apaga mídia antiga do
   celular.** O que expira em 7 dias é a cópia nos servidores da Meta — no
   aparelho o arquivo fica até alguém limpar, e é por isso que o WhatsApp Web
   diz "baixando" ao abrir conversa velha: ele busca do celular, não da nuvem. O
   celular é o arquivo permanente. No nosso caso não existe celular.

   E o mercado não expurga: o Zendesk arquiva o ticket em 120 dias mas não apaga
   anexo sem o admin configurar um *deletion schedule*; o Freshdesk só apaga 90
   dias depois de a conta ser encerrada; o Chatwoot não tem expurgo nenhum. Há
   até um mercado de apps de terceiros que existem só para apagar anexo do
   Zendesk — sinal de que não é nativo e de que há demanda.

   **Mas "nunca apagar" não se sustenta**, e não por gosto: os Meta Platform
   Terms 3.d.i.2 obrigam a apagar quando não há mais fim comercial legítimo, e a
   Meta pode auditar uma vez por ano. O Chatwoot não apaga por **falta do
   recurso**, não por ter decidido que não deve.

   A saída não precisa de regra nova, porque a regra já existe: o arquivo vive
   enquanto a conversa viver, e **o expurgo de 12 meses do contato leva o
   arquivo junto**. Isso é política de retenção escrita e defensável, sem prazo
   mágico que alguém teria de justificar depois.
6. **Expurgo real:** o cron de retenção apaga o objeto do bucket junto com a
   linha, e apagar contato apaga os arquivos dele.
7. **Botão de exclusão a pedido do titular** — exigência contratual da Meta
   (3.d.i.1), não item de backlog. Conferir se a página `/exclusao-de-dados` que
   já existe cobre a mídia.
8. **Teto por arquivo.** Documento de 100 MB não entra no plano free. Definir
   teto (sugestão: 16 MB) e, acima dele, guardar só o registro de que chegou,
   com o aviso de que o arquivo está no celular — sabendo que em 7 dias ele some
   de lá também.

### O que NÃO fazer, e por quê

- **Não reaproveitar `autofluxos-acervo`.** Ele é público por decisão escrita, e
  a decisão continua certa para o que ele guarda.
- **Não persistir a URL assinada** em coluna nem em cache de página.
- **Não baixar tudo cegamente.** Sem teto, um PDF de 100 MB derruba a cota
  compartilhada com a Verandi.
- **Não prometer na tela mídia de antes desta mudança.** O que passou dos 7 dias
  não volta.

### Riscos que ficam de pé

- **A cota é compartilhada com a Verandi**, e Storage é global ao projeto (ver
  [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md)). Estourar 1 GB afeta os dois
  produtos.
- **Sem backup no plano free.** Guardar documento de cliente sem backup é uma
  aposta que hoje é aceitável e deixa de ser no dia em que houver cliente
  pagante — é a mesma frase que já está no `BANCO-COMPARTILHADO.md`, agora com
  arquivo pessoal dentro.
- **O contrato com o cliente precisa mudar**, porque é ele o controlador. Prazo
  de retenção e atendimento ao titular não podem ficar só no código.

---

## O que este documento não é

Não é parecer jurídico. As citações dos termos da Meta vieram de leitura de
página, não de conferência palavra por palavra do texto vigente em cada idioma —
e os termos da Meta mudam. Antes de virar cláusula de contrato com cliente, isso
se confere nas URLs citadas.

---

# Anexo — a pesquisa inteira, com fonte

> Acrescentado em **15/set/2026**, depois de o dono liberar a leitura de
> produção. O corpo do documento resume; este anexo guarda o material bruto,
> para ninguém ter que pesquisar de novo — e para dar de onde discordar.

## A.1 Volume real em produção (medido, não estimado)

Consulta na `public.messages` do projeto `xxxynoshwirupkdzwxbj`, em 15/set/2026.

**Mensagens de entrada, por tipo:**

| Tipo | Total | Primeira | Última |
|---|---|---|---|
| `text` | 128 | 12/08 | 15/09 |
| `interactive` | 36 | 03/09 | 09/09 |
| `image` | 8 | 14/09 | 14/09 |
| `video` | 4 | 13/09 | 14/09 |
| `revoke` | 3 | 14/09 | 14/09 |
| `audio` | 3 | 14/09 | 15/09 |
| `sticker` | 2 | 13/09 | 14/09 |
| `reaction` | 2 | 14/09 | 14/09 |
| `unsupported` | 1 | 14/09 | 14/09 |

**Documento: zero.** Nenhum PDF ou planilha chegou até hoje — o que não quer
dizer que não vá chegar, e é justamente o tipo com teto de 100 MB.

**Storage hoje:** `autofluxos-acervo` com **5 arquivos e 12 MB**. Nenhum outro
bucket tem objeto. Ou seja, o 1 GB do plano free está praticamente intocado.

### A conta de storage

17 arquivos de mídia em 3 dias, com um cliente piloto. Com tamanho típico de
WhatsApp — imagem já comprimida pela Meta ~150 KB, vídeo 1–5 MB, áudio de um
minuto ~100 KB, figurinha ~60 KB — isso dá **~14 MB**, ou **~4,5 MB/dia**.

| Cenário | Consumo | 1 GB dura |
|---|---|---|
| Hoje (1 piloto) | 4,5 MB/dia | ~7 meses |
| 10 clientes no mesmo ritmo | 45 MB/dia | **22 dias** |

Com expurgo de 90 dias o volume **estabiliza** em vez de crescer: ~400 MB no
ritmo de hoje, ~4 GB com dez clientes.

**O vilão é o vídeo.** São 23% dos arquivos e cerca de **88% dos bytes**. Foto
de WhatsApp é barata porque a Meta já comprime; vídeo vai até 16 MB. Apertar só
o vídeo corta o storage quase oito vezes.

**O que aperta antes do storage é o egress: 5 GB/mês no free.** Storage se paga
uma vez por arquivo; egress se paga **toda vez que alguém abre a conversa**. Um
atendente revendo conversas o dia inteiro consome isso mais rápido que o
acúmulo.

### O gatilho para sair do free

Não é data, é cliente: **o terceiro cliente pagante**. Até lá o free cabe com
folga. A partir dele, o Pro (US$ 25/mês) resolve storage, egress e backup de uma
vez — e o "sem backup" deixa de ser aposta aceitável quando há dinheiro de
terceiro em jogo.

## A.2 Meta — prazos e limites (fonte primária)

https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media

- `id` de mídia do webhook: **7 dias**.
- URL do `GET /{media-id}`: **5 minutos**.
- `id` de mídia que subimos: 30 dias.
- Download exige o token no header; sem token, falha.
- Teto de download: 100 MB.
- Tetos por tipo: figurinha estática **100 KB**, animada **500 KB**; imagem
  JPEG/PNG **5 MB**; áudio (AAC, AMR, MP3, M4A, OGG) 16 MB; vídeo (MP4, 3GPP)
  16 MB; documento (PDF, Word, Excel, PPT, TXT) **100 MB**.

Cloud API Terms, seç. 4.5
(https://www.facebook.com/legal/WhatsApp-Business-Platform-Cloud-API):
*"Meta does not offer archiving service or backup features, and you will be the
sole person responsible for creating backups."* Ao encerrar o uso, a Meta apaga
o conteúdo remanescente do lado dela em **90 dias**.

## A.3 Meta — obrigações contratuais (Platform Terms)

https://developers.facebook.com/terms — incorporados à Cloud API pela seç. 1.3.2
dos termos da Cloud API.

- **3.d.i.2** — apagar "assim que razoavelmente possível" quando: (a) não houver
  mais fim comercial legítimo; (b) o produto parar de operar; (c) a Meta pedir
  para proteger usuários; (d) **o usuário pedir exclusão ou deixar de ter conta**;
  (e) a lei exigir.
- **3.d.i.1** — oferecer forma "facilmente acessível e claramente marcada" de
  pedir alteração ou exclusão.
- **6.a.i** — proteções que "cumpram ou excedam padrões do setor, considerando a
  sensibilidade dos Dados da Plataforma", impedindo processamento não autorizado.
- **6.a.ii** — canal de reporte de vulnerabilidade.
- **7.c.i / 7.c.iii** — auditoria uma vez por ano civil, com acesso a registros e
  sistemas.
- **5.a.i / 5.a.iv** — contrato escrito com prestadores de serviço, e lista deles
  à Meta quando pedida.

**WhatsApp Business Data Processing Terms, seç. 3.f**
(https://www.whatsapp.com/legal/business-data-processing-terms/): o negócio é
**Controller**, a WhatsApp apenas assiste em pedidos de titular. No nosso
arranjo: o cliente é **controlador**, o AutoFluxos é **operador**.

**O que não existe (procurado e não achado):**
- Exigência explícita de criptografia em repouso para mídia baixada pelo Tech
  Provider. A palavra criptografia não aparece nos Platform Terms; a exigência
  explícita que existe é para **senhas**, em documento cuja aplicabilidade à
  Cloud API não foi confirmada.
- Webhook de exclusão para usuário final do WhatsApp. O "Data Deletion Callback"
  (https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/)
  é do Facebook Login.
- Cláusula que proíba ou autorize expressamente reter mídia baixada
  indefinidamente.

## A.4 Mercado — o que foi verificado em código e doc

**Chatwoot** (`app/services/whatsapp/incoming_message_base_service.rb`,
`incoming_message_service_helpers.rb`): baixa da Graph API e faz cópia permanente
via ActiveStorage (local/S3/GCS/Azure/MinIO por `ACTIVE_STORAGE_SERVICE`). Não
volta a referenciar a URL da Meta. `location` e `contacts` têm caminho separado
da mídia. **Sem rotina de expurgo.**

Issues conferidas na API do GitHub:
- **#15072** (fechada, 19/07/2026) — *"Unauthenticated ActiveStorage
  direct-upload (missing authentication) on the conversation direct_uploads
  endpoint"*. Corrigida pela **#15329**.
- **#11019** (**aberta desde 04/03/2025**) — *"Configurable Signed URLs
  expiration time for active_storage"*.
- #6402 — anexo some quando o Redis reinicia. #14511 e #14644 — áudio dá 404 no
  primeiro carregamento. #15540 — anexo não carrega no navegador de quem enviou,
  porque `message.created` é transmitido antes de o upload terminar.

**Evolution API**: S3/MinIO opcional (`S3_ENABLED`), URL por `presignedGetObject`
— assinada, expiração fixa de **7 dias**, não configurável (issue #1404).

**360dialog** — o único fornecedor com número público
(https://docs.360dialog.com/partner/messaging/media-messages/upload-retrieve-delete-media):
mídia enviada 30 dias após o último uso; mídia recebida **7 dias**; URL de
download assinada por hash, válida por **5 minutos**.

**Sem número público:** Take Blip (documenta criptografia e diz não ter acesso ao
conteúdo, sem prazo), Kommo (Files API documenta escopo de acesso e deleção, sem
retenção), Zenvia, Digisac, Huggy, Respond.io, Sleekflow. Afirmação de marketing
sobre segurança entra aqui como **não verificada**.

**Reclamações de usuário** (relato, não código): Digisac e Huggy no Reclame Aqui
com instabilidade e perda de mensagem; Chatwoot com os anexos acima. **A dor real
é mídia que some, não mídia exposta.**

**Vazamento de mídia de atendimento por bucket aberto nessas plataformas:
nenhum caso encontrado.**

**Custo publicado com premissa realista de mídia de WhatsApp: nenhum encontrado.**

### Erro da pesquisa, registrado de propósito

A pesquisa devolveu o advisory `GHSA-5h82-j98m-7r5c` para a falha do Chatwoot.
**Esse identificador não existe** — 404. As issues existem e batem com a
descrição. Fica aqui porque o próximo levantamento vai usar as mesmas
ferramentas, e saber que elas inventam identificador plausível vale mais que a
citação certa.

## A.5 LGPD — o que já foi punido

**Sanções da ANPD:**
- **TikTok/ByteDance — R$ 153,7 milhões**, DOU 25/08/2026, falhas na proteção de
  dados de crianças e adolescentes; inclui **determinação de eliminar os dados
  coletados irregularmente**
  (https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-multa-tiktok-em-r-153-7-milhoes-por-falhas-na-protecao-de-dados-de-criancas-e-adolescentes).
- **Telekall Infoservice** — R$ 14.400 (2 × R$ 7.200) e advertência por falta de
  encarregado; venda de lista de contatos de WhatsApp sem base legal. Processo
  00261.000489/2022-62, DOU 06/07/2023. Primeira multa da LGPD.
- **INSS** — exposição de CPF e dados bancários; sanção foi comunicado público
  de 60 dias (órgão público não leva multa). Processo 00261.001888/2023-21.
- **Instituto Saúde e Cidadania** — ransomware, ~500 mil pacientes; processo
  aberto em 08/07/2026, **sem sanção definida**.

**Vazamentos brasileiros por bucket S3 aberto** (documentados, nenhum com sanção
da ANPD confirmada):
- **WSpot** (Wi-Fi de Pizza Hut, Sicredi, Unimed) — ~2,5 milhões de pessoas, com
  CPF.
- **Prisma Promotora** — 717.068 arquivos, ~10 mil clientes: **fotos de
  documento, cartão e gravações de áudio**.
- **FutebolCard/Palmeiras** — sócio-torcedor, CPF exposto.

**Jurisprudência:**
- **STJ, REsp 1.903.273-PR** (Nancy Andrighi, 24/08/2021) — divulgar conversa de
  WhatsApp sem autorização gera dever de indenizar quando há dano.
- **STJ, AREsp 2.130.619** (17/03/2023) — para dado **comum**, é preciso provar
  dano efetivo; condenação de R$ 5 mil contra a Eletropaulo foi reformada.
- **TJ-AC, 0700406-91.2019.8.01.0007** — clínica divulgou exame em grupo de
  WhatsApp; R$ 4.000 de dano moral.
- **TJ-SP** — Sodimac condenada a R$ 2.000 por vazar dado de cliente em venda
  online.

**Resolução CD/ANPD nº 15/2024**, confirmada em fonte oficial
(https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca):
comunicar ANPD e titulares em **3 dias úteis** da ciência; prazo dobrado para
agente de pequeno porte; complementos em até 20 dias úteis. A obrigação nasce
com risco relevante somado a agravante: **dado sensível, dado financeiro, dado
de criança ou idoso, credencial, ou larga escala**.

**Retenção:** a LGPD não fixa prazo geral — elimina-se quando a finalidade se
esgota (arts. 15 e 16). O art. 27 do CDC é prazo **prescricional** para ação por
fato do serviço, **não** obrigação de guardar cinco anos; confundir os dois é
erro comum de mercado.

### O achado que mais calibra a decisão

**Nenhum caso encontrado** — nem sanção da ANPD, nem condenação judicial — por
**reter passivamente** histórico de atendimento além do necessário. Todo o
padrão real de punição no Brasil é **divulgação ativa** ou **falha técnica que
expõe**.

Guardar não é o que pune. **Vazar é.**
