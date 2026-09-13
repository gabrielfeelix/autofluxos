# Handoff — 13/set/2026, tarde: Coexistence, cadastro aberto, e cinco erros caros

> Escrito no fim da sessão, para outra sessão continuar. O que importa está em
> **"Onde estamos agora"**; o resto explica o porquê e existe para ninguém
> repetir o que já custou caro hoje.
>
> Leia também [HANDOFF-COEXISTENCE.md](HANDOFF-COEXISTENCE.md) — ele continua
> válido **exceto** na decisão Hosted × SDK, que foi revertida hoje. Ver
> "O erro mais caro" abaixo.

## Onde estamos agora

**Falta uma coisa só: o cliente clicar e o canal aparecer no banco.**

Tudo o mais está feito, no ar e conferido. O último teste real foi com o amigo
do dono (WhatsApp Business de verdade, da academia). Ele foi até o fim — clicou
em Concluir, a Meta disse *"sua conta está conectada ao portfólio 4YU"* — e o
nosso banco não recebeu nada. **Nem canal, nem alerta.**

A causa foi encontrada e corrigida no último commit (`0034714`), mas **ainda não
foi testada com número real**. O próximo passo é exatamente isso.

### Como conferir se funcionou

Não olhe a tela: consulte o banco. Zero canal novo = não funcionou.

```bash
# credenciais de produção
vercel env pull /tmp/.env.prod --environment=production --yes \
  --token "$VERCEL_TOKEN" --scope team_hmVHyYO1YFO9fuAtpG9Ym2hm
```

```sql
select phone_number_id, waba_id, is_on_biz_app, coexistencia_em,
       contatos_sync_em, historico_sync_em, criado_em
from public.channels order by criado_em desc limit 4;

select criado_em, titulo, left(detalhe, 200) from public.alertas
where criado_em > now() - interval '30 minutes' order by criado_em desc;
```

Hoje os canais são **três, todos velhos** (o mais novo é de 04/set) e nenhum tem
`coexistencia_em`. Qualquer linha nova ali é sinal de sucesso.

**Alerta vazio não é boa notícia** — significa que a rota do servidor nem foi
chamada, e o problema está no navegador. Foi assim o dia inteiro.

## O que foi feito hoje, e funciona

| O quê | Estado |
|---|---|
| Cadastro aberto ao público (`/cadastrar`) | ✅ no ar |
| Primeiro acesso que cria a empresa (`/primeiro-acesso`) | ✅ no ar |
| Máscara de telefone `(44) 90000-0000` | ✅ 23 testes |
| Botão verde do WhatsApp com a logo | ✅ |
| Trilha "Configurações / X" em 9 telas | ✅ |
| Ilustrações nos 4 estados vazios | ✅ autorais, sem licença de terceiro |
| Embedded Signup **pelo SDK** (`FB.login`) | ✅ no ar, **não testado com sucesso ainda** |
| `PARTNER_ADDED` tratado | ✅ |
| Domínio do SDK e config_id no painel da Meta | ✅ conferido pela API |

Migration: **nenhuma nova hoje**. A última continua sendo `0047_coexistencia`.

## O erro mais caro: Hosted × SDK

**O handoff anterior decidiu errado, e a decisão custou o dia.**

Ele diz *"DECIDIDO (13/09): é o Hosted. Não construa SDK de Embedded Signup"*.
Isso está errado por dois motivos, ambos confirmados na doc oficial:

1. **O Hosted não faz coexistência.** A doc é literal: *"Hosted Embedded Signup
   can only be used to onboard business customers to Cloud API, and the flow
   cannot be customized."* Sem customização não há `featureType`, e sem
   `featureType` o cliente **perde o WhatsApp do celular** — o oposto do que o
   produto promete.
2. **O Hosted não redireciona de volta.** Nunca redirecionou. A doc não descreve
   retorno nenhum, só o webhook `PARTNER_ADDED`.

As duas primeiras conexões reais do dia terminaram com o cliente vendo "pronto"
na tela da Meta e o banco vazio por causa disso — e uma tarde foi gasta
investigando um "redirect quebrado" que não existia.

O `redirect_uri`, o `config_id` e o `extras` que o handoff manda montar na URL
do Hosted **não são lidos por ele**. Aquela URL foi inventada.

**Hoje o fluxo é o SDK** (`src/components/cliente/conectar-whatsapp.tsx`), e a
rota que recebe o `code` é `/api/whatsapp/concluir` — não mais `/retorno`.

## Os cinco erros do dia, para não repetir

Cada um destes custou pelo menos uma hora. Todos tinham o mesmo formato: **o
sintoma apontava para longe da causa**.

### 1. O proxy respondia 401 e a rota nunca rodava

`/api/whatsapp/retorno` não estava em `PORTAS_ABERTAS`. O navegador voltava do
`facebook.com` — navegação cross-site — e o cookie `SameSite=Lax` não
acompanha. O proxy via "sem cookie" e devolvia 401 **antes** da rota existir.

Nada nos alertas, porque o código que alerta está depois do ponto que nunca era
alcançado. Corrigido em `50fa88c`. O Instagram tinha o bug idêntico.

### 2. `{"success":true}` da Meta é mentira

Tentei gravar `js_sdk_host_domains` pela Graph API. Respondeu `success: true` e
**não gravou nada** — confirmei mandando dois `oauth_redirect_uris` e relendo:
continuava um.

O CLAUDE.md da raiz já avisava disso. **Esses campos não são escrevíveis por
API**, com app token nem com user token (a Meta se contradiz: com user token diz
"precisa app token", com app token aceita e descarta). É UI, e ponto.

### 3. Um `\n` na variável de ambiente

Gravei `META_WHATSAPP_CONFIG_ID` com `echo`, que acrescenta quebra de linha. Ela
viajou até o `FB.login` e apareceu na URL como `config_id=1616632909867069%0A`.

A Meta não achou a configuração e respondeu **"Falha ao iniciar sessão"** — um
erro genérico que me fez investigar permissão, domínio e propagação. Nada disso
era o problema.

O valor **parece certo em toda tela que o mostra**: o painel da Vercel não exibe
o caractere. Só a URL do popup denunciou.

**Grave variável com `printf`, nunca `echo`.** E há `.trim()` na leitura agora.

### 4. Deploy antes da variável existir

Troquei a env e disparei o deploy no mesmo minuto. O build leu o valor antes de
ele estar gravado e pegou vazio — o `config_id` sumiu da URL.

**Variável lida em build não entra em deploy que já rodou.** Grave primeiro,
confira, depois deploy.

### 5. `event.data` nem sempre é string

O que estava travando no fim do dia. O `message` de session logging chega como
**objeto** em parte dos casos. O código fazia `JSON.parse(evento.data)` dentro de
um `try` com **`catch` vazio**: o parse estourava, o catch engolia, e o
`phone_number_id` sumia sem rastro.

Como o envio só acontece quando as duas metades chegam (o `code` **e** o
número), e uma nunca chegava, a rota do servidor jamais foi chamada.

`catch` vazio é o que transformou um bug de uma linha numa tarde: não havia como
distinguir "não veio" de "veio e foi jogado fora". Corrigido em `0034714`.

## Quatro defeitos achados na revisão (antes do teste real)

Uma revisão do código foi pedida antes de gastar a janela de 24h, e valeu:

1. **O bot responderia ao próprio dono.** `receberMensagem` não lia o `field` do
   webhook, e `smb_message_echoes` tem a mesma forma de uma mensagem recebida —
   o `from` (número do negócio) virava contato, e o motor respondia.
2. **Nada sairia.** `adaptadorDoCanal` usava `WHATSAPP_TOKEN` da 4YU para todo
   WhatsApp, ignorando o `token_ref` do cliente. Erro `131030` em todo envio.
3. **A janela de 24h ficaria errada.** Histórico importado (até 180 dias) conta
   como `direcao: 'entrada'` e abriria a janela indevidamente. Agora filtra
   `historico = false`.
4. **`desembarcado_em` era gravado e nunca lido** antes de enviar.

Todos corrigidos em `8df1f6d`.

## O que está configurado na Meta (conferido pela API, não pela tela)

```
app_id                1063817842847269   live_mode
config_id             1616632909867069   "Cadastro Incorporado do WhatsApp, token 60 dias"
oauth_redirect_uris   ["https://autofluxos.4yu.com.br/api/whatsapp/retorno"]
js_sdk_host_domains   ["https://autofluxos.4yu.com.br/"]   ← a barra é normalização da Meta
permissões            whatsapp_business_messaging + management = DEVOPS_APPROVED / advanced
webhooks              history, smb_app_state_sync, smb_message_echoes = assinados
```

**A barra no fim do domínio é a Meta normalizando** — você digita sem, ela salva
com. Não é problema, já foi investigado. Não perca tempo com isso.

O `config_id` antigo (`1071840912286349`, "Tech Provider Meta-hosted") **não
serve** — era do fluxo hospedado. Foi substituído.

### O que não é pendência, e já foi investigado a fundo

- `screencast: is_completed: false` — descreve a composição de um envio, não o
  que está vigente. O que vale é `privileges`.
- `contact_email_verified: false` — a flag está errada, o e-mail foi validado.
- `description` / `short_description` — impossíveis neste formato de app.
- A barra em `js_sdk_host_domains`.
- **Não precisa de App Review nem vídeo** para nada disto. Adicionar produto ao
  app é instantâneo e não é review.

## O teste, e por que não dá para simular

Precisa de **WhatsApp Business App real** (2.24.17+) num celular, com o número já
em uso nele. O dono não tem; o amigo dele tem e já autorizou, sabendo que o
histórico vem para o nosso banco.

**Sandbox não serve** para o que importa: ela simula a papelada, não o aparelho.
Não testa a mensagem da Conta Oficial chegando no app, nem os echoes quando ele
responder pelo celular. E o relógio de 30 dias dela corre à toa.

Ela serviria só para confirmar que o JavaScript está certo — se for usar, use
com esse propósito e sabendo do custo.

### O caminho

1. `/clientes/<id>/numero` → **Ctrl+Shift+R** → botão verde
2. Abre popup da Meta. **O sinal que importa:** deve oferecer *"conectar sua
   conta existente do WhatsApp Business"*. Se pedir para escolher WABA, o
   `featureType` não pegou — e aí é o `config_id`, não o código.
3. No celular: mensagem da **Conta Oficial do Facebook Business** → *Connect* →
   *Confirm* → colar o código. **Não é QR code.**
4. Conferir no banco (consultas no topo deste documento)

**Cada sync dispara uma vez só, e a janela é de 24h.** Como nada foi gravado até
agora, nenhum sync foi gasto — está tudo intacto.

## Se falhar de novo

A ordem que funciona, aprendida hoje:

1. **Banco primeiro.** Canal novo? Alerta? Alerta vazio = o navegador nem chamou
   o servidor.
2. **A URL do popup.** Foi ela que denunciou o `%0A` e o `config_id` faltando.
   Peça para o cliente copiar a URL da barra de endereço do popup.
3. **Console do navegador** (F12 → Console), se os dois acima não disserem nada.
4. Só então doc e painel.

**Console da Vercel não guarda log** — `vercel logs` só transmite em tempo real.
Os alertas no banco são a única memória que existe.

## Pendências conhecidas, fora do caminho crítico

- **React #418** (hydration mismatch) no console da tela de número. Ruído, não
  atrapalha o popup. Provável origem: `useState(() => mascaraDeTelefone(...))`.
- **404 do favicon.**
- **4 erros de lint pré-existentes** em `(site)/numero-que-sobe.tsx`,
  `page.tsx` e `core/flow/resposta.ts`. Não são de hoje.
- **Sem confirmação por e-mail no cadastro** — decisão do dono, porque exige SMTP,
  que é global ao projeto compartilhado com a Verandi.
- **Sem login social** (Google/Facebook/Apple), por ora.
