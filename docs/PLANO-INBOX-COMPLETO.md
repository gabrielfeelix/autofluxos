# O Inbox que parece WhatsApp — o que dá, o que não dá, e em que ordem

> Levantado em 15/set/2026, com a doc da Cloud API e o estado real do código.
> O pedido foi "quase uma cópia do WhatsApp, só que mais interessante". Este
> documento separa o que a Meta permite do que ela simplesmente não expõe —
> porque metade da resposta é essa.

## O ponto de partida

Hoje a caixa de resposta **só manda texto**. E isso é o mais estranho do
estado atual: o motor já sabe enviar foto, vídeo, áudio e PDF — o adaptador
está pronto em `src/channels/cloud-api.ts:122`, o bloco de mídia do fluxo usa —
e **nenhuma tela do Inbox chama**. Quem atende não consegue mandar nem uma foto
de tabela de preço.

Do lado de receber, já reconhecemos dez tipos (`src/core/tipo-da-mensagem.ts`):
foto, áudio, vídeo, documento, figurinha, localização, contato, reação, pedido
e botão. Eles aparecem na prévia da fila com ícone e nome. O que falta é a
conversa **mostrar o conteúdo** e a caixa **produzir** cada um.

## O que a Meta permite, item por item

| Recurso | Enviar | Receber | Observação que decide o desenho |
|---|---|---|---|
| Foto, vídeo, áudio, PDF | ✅ | ✅ | já pronto no motor; falta só a tela |
| **Reagir** a uma mensagem | ✅ `type: reaction` | ✅ | **não dá para reagir a mensagem com mais de 30 dias** |
| **Responder citando** | ✅ `context.message_id` | ✅ | o campo já vem em toda mensagem recebida |
| **Figurinha** | ✅ `type: sticker` | ✅ | **só WebP**: 100 KB estática, 500 KB animada |
| Localização | ✅ | ✅ | |
| Contato (cartão) | ✅ | ✅ | formato estruturado, não vCard cru |
| Marcar como lida | ✅ | — | dentro de 30 dias |
| "Digitando…" | ✅ | — | ligado ao ato de marcar como lida |
| **GIF** | ⚠️ | — | a lista oficial de formatos **não inclui GIF**. O caminho é converter para MP4 e mandar como vídeo — prática de mercado, **não confirmada em doc** |
| **Chamada perdida** | — | ⚠️ | existe webhook de chamada (`connect`/`terminate`), mas **não existe evento "perdida"**: dá para inferir de um `terminate` sem atendimento |
| **Editar enviada** | ❌ | ❌ | não existe na Cloud API |
| **Apagar enviada** | ❌ | ⚠️ | não há endpoint; quando o usuário apaga do lado dele, chega como tipo não suportado |
| **Enquete** | ❌ | ❌ | não existe na Cloud API. O que aparece por aí é provedor não oficial rodando WhatsApp Web |

**Emoji não está na tabela porque não é recurso de API**: é texto puro. Já
funciona hoje — digitar 🎉 no campo e mandar entrega 🎉. O que falta é o
seletor, que é tela e nada mais.

## Limites de tamanho (Cloud API)

```
imagem     JPEG/PNG                    5 MB
vídeo      MP4/3GP (H.264 + AAC)      16 MB
áudio      AAC/AMR/MP3/M4A/OGG        16 MB
documento  PDF/Office/TXT            100 MB
figurinha  WebP     estática 100 KB · animada 500 KB
```

Isso precisa ser conferido **antes** de subir, com mensagem clara: descobrir
que o vídeo tinha 18 MB depois que a Meta recusou é o tipo de erro que o
atendente lê como "o sistema não funciona".

## O plano, em cinco camadas

A ordem é por **quanto cada uma muda o atendimento**, não por dificuldade.

### Camada 1 — Mandar mídia pelo Inbox

A que falta de verdade. Botão de anexo na caixa de resposta, com foto, vídeo,
áudio e PDF.

Três decisões que já dá para tomar:

- **Reusar o Acervo.** Ele já guarda arquivo no Storage, já tem upload
  assinado (`pedirEnvioAssinado`) e já é limpo quando o cliente é apagado. Um
  caminho paralelo de upload seria um segundo lugar para vazar arquivo e um
  segundo lugar para esquecer de limpar na LGPD.
- **Conferir tipo e tamanho no navegador**, antes de subir. Erro que só
  aparece depois da Meta recusar é erro que chega tarde demais.
- **A janela de 24h vale igual.** Mídia fora da janela é recusada pela Meta
  como qualquer texto livre — a caixa já sabe disso e o botão herda a regra.

### Camada 2 — Reagir e responder citando

As duas coisas que mais aparecem numa conversa real de atendimento, e as duas
que o WhatsApp tem e nenhum inbox pesquisado entrega bem.

- **Reagir**: passar o mouse na mensagem, escolher o emoji. `type: reaction`.
  O teto de 30 dias tem de aparecer na tela — botão que some sem explicação
  vira chamado de suporte.
- **Citar**: já recebemos o `context` em toda mensagem; falta guardar e
  desenhar. É o que resolve a conversa em que a pessoa responde três perguntas
  de uma vez.
- **Receber reação** precisa parar de virar mensagem solta na conversa. Hoje
  ela entra como linha própria; o certo é grudar na mensagem que foi reagida.

### Camada 3 — Figurinha e GIF

- **Figurinha**: exige WebP e respeitar 100 KB / 500 KB. O caminho honesto é
  um acervo de figurinhas por cliente — deixar o atendente subir qualquer
  imagem e converter na hora é onde isso vira um problema de CPU e de formato.
- **GIF**: converter para MP4 e mandar como vídeo. Funciona na prática e **não
  é documentado** — então entra com teste real antes de prometer na tela.

### Camada 4 — Chamada

A Meta avisa que houve chamada, mas **não diz "perdida"**. Dá para inferir de
um `terminate` que não teve atendimento, e mostrar na conversa como "📞 chamada
não atendida, 14:32".

Vale a pena porque hoje isso é invisível: o cliente liga, ninguém atende, e o
atendimento não fica sabendo que a pessoa tentou.

**Não prometer mais que isso** enquanto não houver teste com chamada real — o
mapeamento de `terminate` para "perdida" é inferência nossa, não contrato.

### Camada 5 — Acabamento

- **Seletor de emoji** na caixa. Pequeno, e some a distância entre "campo de
  texto" e "WhatsApp".
- **Localização e contato**: receber já funciona; desenhar o mapinha e o
  cartão é tela.
- **"Digitando…"** enquanto o atendente escreve.
- **Marcar como lida** ao abrir a conversa — hoje a pessoa do outro lado nunca
  vê o segundo tique.

## O que não vamos fazer, e por quê

**Enquete.** Não existe na Cloud API. O que se vê no mercado são provedores
não oficiais rodando WhatsApp Web por baixo — o mesmo caminho que arrisca o
banimento do número do cliente, e que este produto recusou desde o começo (ver
o topo de `cloud-api.ts`).

**Editar mensagem enviada.** Não existe endpoint. Prometer isso na tela seria
mentir.

**Apagar para todos.** Idem. Dá para apagar da nossa tela, mas a mensagem
continua no celular da pessoa — e um botão "apagar" que não apaga do outro lado
é pior que não ter botão.

## Onde isto se encaixa no plano-mestre

A Camada 1 é a **Fase 11 — Mídia de saída**, que o `PLANO-MESTRE.md` já
descreve como *"o único item da fila em que a resposta hoje é 'o produto não
faz', e não 'o produto faz de um jeito pior'"*. As camadas 2 a 5 são novas.

Uma restrição que vale para todas: o Storage é **global ao projeto compartilhado
com a Verandi**. Bucket novo precisa identificar o produto no nome, e a remoção
de cliente precisa limpá-lo explicitamente — ver `BANCO-COMPARTILHADO.md`.

## O que precisa ser testado antes de prometer

1. **GIF como MP4** — não documentado; testar com arquivo real.
2. **Remover reação** mandando emoji vazio — prática comum, não confirmada.
3. **Chamada perdida** — inferir de `terminate` precisa de uma chamada real
   para saber quais campos vêm.
4. **Dimensões de figurinha** — a doc dá o peso em KB, não os pixels.
