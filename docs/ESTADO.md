# Onde paramos — 11/ago/2026

Documento de retomada. Quem chegar aqui sem ter acompanhado a construção
consegue continuar lendo só isto e o [ARQUITETURA.md](ARQUITETURA.md).

---

## O produto em uma frase

Sistema onde a 4YU desenha fluxos de atendimento no WhatsApp para clientes.
**Não é o bot de um cliente — é a chave mestre** onde o bot de qualquer cliente
cabe sem tocar em código.

Três etapas, cada uma vendável sozinha:

| Etapa | O que é | Estado |
|---|---|---|
| 1 | Automação pura, sem IA — botões, opções, lead na tela | **6 de 7 passos prontos** |
| 2 | Nó de IA, cobrado à parte, com a chave do cliente (BYOK) | não começou |
| 3 | Encaixar a Prelúdio **só configurando**, sem mexer no produto | não começou |

---

## Etapa 1 — o que está pronto

| # | Passo | Estado |
|---|---|---|
| 1 | Motor de fluxo + validador | ✅ |
| 2 | Simulador de conversa | ✅ |
| 3 | Clientes e fluxos no Supabase | ✅ |
| 4 | Editor visual (React Flow) | ✅ |
| 5 | Publicar + versionar | ✅ |
| 6 | Webhook + canal Cloud API | ✅ código pronto, **travado na Meta** |
| 7 | Tela de leads | ⬜ **próximo, não depende de ninguém** |

**57 testes** passando (`npm test`), `tsc` limpo, `next build` limpo. Os testes de
banco e webhook falam com o Supabase de verdade e se pulam sozinhos sem `.env`.

---

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Repositório | https://github.com/gabrielfeelix/autofluxos (**público**) |
| Painel no ar | https://autofluxos.4yu.com.br |
| Vercel | time `4-yu`, projeto `autofluxos`, região `gru1` (São Paulo) |
| Supabase | projeto `autofluxos`, ref `xxxynoshwirupkdzwxbj`, `sa-east-1` |
| App na Meta | `AutoFluxos`, id `1063817842847269`, portfólio `Portfólio - 4YU` (id `1494483661926723`) |
| Segredos | `4yu-apps/.secrets/4yu.env`, prefixo `AUTOFLUXOS_` |
| Token da Hostinger | `~/dev/radar-ofertas/.env`, variável `HOSTINGER_TOKEN` |

**Acesso ao painel:** usuário qualquer (só a senha é conferida), senha em
`AUTOFLUXOS_PAINEL_SENHA`. Ela apareceu uma vez no chat da construção — se
quiser trocar, gere outra e atualize a variável na Vercel.

**DNS:** `4yu.com.br` fica na Hostinger (nameservers `solar`/`lunar.dns-parking.com`).
O subdomínio é um `CNAME autofluxos → cname.vercel-dns.com`, criado pela API
deles. Mesmo padrão do `deixeiaqui` e do `www`.

---

## O que está travado, e por quê

**A Meta não entrega o número de teste.**

Na Etapa 1 do caso de uso "Conectar-se com clientes pelo WhatsApp", o botão
**Reivindicar número de teste** recarrega a página e não cria nada. O console
mostra só CSP bloqueando a telemetria da própria Meta
(`mpc-prod-*.run.app`, `*.on.aws`) — **a chamada que criaria o número nem sai**.

Reproduzido em janela anônima, sem extensão. É bug do console deles.

### Como destravar quando voltar

1. Tentar de novo o **Reivindicar número de teste** — esse tipo de quebra costuma
   cair sozinha em algumas horas.
2. Se não voltar: ir pela **Etapa 2 (Configuração da produção)** com um número
   real que não esteja em nenhum WhatsApp. Precisa de forma de pagamento no
   portfólio. É o caminho que vai ser necessário para cliente de verdade de
   qualquer forma.

### Quando o número existir, faltam 5 minutos

Pegar em **WhatsApp → Configuração da API** e escrever em
`4yu-apps/.secrets/4yu.env` (**nunca no repo, nunca no chat**):

```bash
AUTOFLUXOS_META_APP_SECRET=          # Configurações → Básico
AUTOFLUXOS_WA_TOKEN=                 # token de acesso (o temporário vale 24h)
AUTOFLUXOS_WA_PHONE_NUMBER_ID=       # identificação do número de telefone
AUTOFLUXOS_WA_WABA_ID=               # identificação da conta WhatsApp Business
AUTOFLUXOS_WA_VERIFY_TOKEN=          # frase inventada, repetida no painel da Meta
```

Depois:

1. Publicar essas variáveis na Vercel como `META_APP_SECRET`, `WHATSAPP_TOKEN`,
   `WHATSAPP_VERIFY_TOKEN` e fazer redeploy.
   (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` e
   `PAINEL_SENHA` **já estão configuradas**.)
2. No painel da Meta, apontar o webhook para
   `https://autofluxos.4yu.com.br/api/webhook/whatsapp`, usar o mesmo
   `verify_token`, e **assinar o campo `messages`**.
3. Adicionar o próprio número como destinatário de teste (campo "Para").
4. No painel do AutoFluxos: criar cliente → criar fluxo → publicar →
   conectar o número (colando o `phone_number_id`).
5. Mandar "oi" do WhatsApp e ver o bot responder.

---

## O que fazer em seguida (ordem sugerida)

1. **Passo 7 — tela de leads.** Não depende da Meta e é o que faz a demo valer:
   é onde o lead aparece para o cliente. Os dados já são gravados
   (`contacts.campos`, `messages`, `handoffs`); falta a tela.
2. **Gabriel testar o editor** de verdade — arrastar bloco, ligar setinha,
   conversar na aba Testar. Foi a única parte que não deu para verificar sem
   navegador; se algo estiver estranho no arrasto ou no autosave, é aqui.
3. **Verificação de empresa na Meta** (Portfólio - 4YU está "não verificada").
   Demora e não trava nada hoje, mas trava cliente real depois. Começar cedo é
   de graça.
4. **Etapa 2 (IA)** — vira um tipo de nó a mais e uma flag `ia_habilitada` no
   cliente. O resto do sistema não muda.

---

## Contexto de negócio que não está no código

**Cliente 00 é o número de freelance do Gabriel.** O bot roda nele primeiro; a
Prelúdio só entra depois que funcionar. Todo susto acontece com a gente.

**Cliente 01 é a Prelúdio Produtora** (produtora de vídeo em São Paulo,
[preludiovideo.com](https://preludiovideo.com) — *a confirmar se é essa mesma*).
Cliente do sócio do Gabriel. Tráfego pago → WhatsApp → triagem na mão → agenda
ou liga. **Já fecha contrato bom.**

O problema dele é específico: **quem está em dúvida no preço trava e não
avança.** Lead quente converte; morno esfria.

**A pergunta central do projeto continua sem resposta, e é do cliente:**

> A Prelúdio topa o bot falar **faixa de preço**?

A hipótese é que o morno trava por falta de âncora, não por objeção real —
perguntou preço, ouviu "depende", leu como "vai ser caro". Se ela não topar, o
bot resolve outro problema, não o que ele contou. **Vale perguntar antes de
desenhar e antes de vender.**

Faltam também: os arquivos de abordagem dele (viram o desenho do fluxo, o
contexto da IA e a suíte de teste), o ticket médio e o volume de conversas.

**Preço combinado entre os sócios:** R$1.800 de setup (R$900 cada) e ~R$700/mês
de manutenção. **Os custos variáveis têm que ser faturados no cliente** — Meta
cobra ~R$0,20–0,50 por conversa e a IA é BYOK. Com o WABA no nome do cliente
(Embedded Signup), a Meta cobra ele direto e a manutenção fica limpa.

---

## Armadilhas já mapeadas (não repetir a pesquisa)

- **IA de propósito geral está proibida** na Business API desde 15/jan/2026. Bot
  task-oriented é permitido. Por isso o nó de IA é sempre fechado no contexto do
  cliente.
- **Free tier do Gemini treina modelo com os dados**, inclusive revisão humana.
  Não pode ver conversa real. Dev com dado fictício; produção com chave paga do
  cliente.
- **Evolution API está sendo caçada.** Perder o número do cliente é o pior
  fracasso possível para uma agência. Só Cloud API oficial.
- **Coexistence** (app + Cloud API no mesmo número) existe e resolve o handoff:
  o celular do cliente continua sendo o inbox, então não precisamos construir
  um. Exige onboarding por parceiro que suporte "business app number onboarding".
- **Embedded Signup v2 morre em 15/out/2026** — nascer no v4.
- **Limite de blocos:** 3 opções viram botões, até 10 viram lista, acima disso a
  Meta recusa. O validador bloqueia.
- **Supabase free:** 2 projetos ativos no total. Hoje `radar-ofertas` +
  `autofluxos`. Retomar o `Otimiza Gestor` (pausado) estoura o limite. Projeto
  free pausa após 1 semana sem requisição.
