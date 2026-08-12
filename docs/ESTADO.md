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

## O que está travado — **uma coisa só**

**O número precisa ser verificado.** Nada além disso.

Estado do número (`+55 44 7400-7438`, phone_number_id `1301107846409860`):

- nome `4YU Tech` — **aprovado sem análise**
- `code_verification_status: NOT_VERIFIED`
- `status: PENDING`

Enviar falha com **`(#133010) Account not registered`** — que é exatamente o
esperado para número não verificado. Testado chamando a Cloud API direto.

Pedir o código muitas vezes derrubou no limite (`You have requested a
verification code too many times`). É por tempo; passa sozinho.

### Quando o limite liberar

1. Em **Contas do WhatsApp → 4YU Tech → Phone numbers**, confirmar que o número
   listado é o certo antes de gastar tentativa.
2. Verificar por **Ligação telefônica**, **uma vez só**, sem pedir reenvio.
3. Depois de verificado, falta registrar com um PIN de 2 fatores —
   `POST /{phone_number_id}/register`. Dá para fazer pela API com o token que já
   está no cofre; não precisa de painel.
4. Mandar "oi" do WhatsApp e ver o bot responder.

### O que já está pronto e testado em produção

- Webhook configurado na Meta e **assinado no campo `messages`**
- Assinatura HMAC validada com a chave real: correta → 200, errada → 401,
  ausente → 401, verificação GET → 200
- **Mensagem de verdade já entrou pelo webhook**, criou contato, criou sessão
  presa na versão publicada e **o motor avançou até a primeira pergunta**. Só o
  envio falhou, pelo número não registrado.
- Painel já tem `Cliente 00 — Gabriel` com o fluxo de triagem **publicado (v1)**
  e o número conectado.

### Segredos já no cofre (`.secrets/4yu.env`, prefixo `AUTOFLUXOS_`)

`META_APP_SECRET`, `WA_TOKEN` (usuário do sistema, permanente),
`WA_PHONE_NUMBER_ID`, `WA_WABA_ID`, `WA_VERIFY_TOKEN`, `PAINEL_SENHA`,
`SUPABASE_*`.

Todas já publicadas na Vercel e em produção.

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
