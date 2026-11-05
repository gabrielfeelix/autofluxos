# Handoff: Solar Buy-Side (Francis Poloni) como cliente, 5/nov/2026

Francis Poloni (Solar Buy-Side, Maringá) recebeu proposta em 5/nov/2026:
plano Dialogon a R$ 259/mês, IA que responde pelo Manual e pelo Código,
WhatsApp + Instagram + chat do site, CRM ligado à Greenn, **entrega até
sábado 7/nov** (prazo nosso; aprovação da Meta é externa). O bot já existe
como demo: fluxo `Demo · Energia solar` (`39037746-6900-451f-b550-941d1e11bed2`,
v15), fora dos menus. Base de conhecimento: `docs/BASE-DE-CONHECIMENTO.md`.

O trabalho foi dividido em duas sessões. **Não mexa nos arquivos da outra.**

## Sessão A (a que montou o bot): qualidade da IA e checkout

Dona de: `scripts/demo/fluxos.mts`, `scripts/demo/conhecimento-solar-*.json`,
`scripts/conhecimento/*`, `src/core/conhecimento.ts`, `src/server/conhecimento.ts`.

1. Bateria de 60+ perguntas no simulador (as do Francis, auditoria anterior,
   objeções, pessoa física) até acertar todas.
2. Virada da promoção: a IA precisa saber data e hora para trocar o preço às
   21h de 1º/12/2026 e voltar 48h depois.
3. Mensagem de checkout com botão "Comprar agora" (cta_url do WhatsApp) e a IA
   mandando o botão em vez do link solto. Texto passa pelo Gabriel antes.
4. No fim: copiar fluxo e base para a conta do Francis, sem a parte de demo.

## Sessão B (nova): Greenn, IA paga, plano e conta

Dona de: `src/server/ia/modelo.ts`, `src/server/ia/compativel-openai.ts`,
rotas e repos de webhook, `supabase/migrations/` (próximo número pelo
diretório; hoje a última é `0168`), plano e conta do Francis.

1. **Greenn → Dialogon.** Webhook de entrada existe
   (`src/server/repos/webhooks-de-entrada.ts`, migration 0044) mas não lê o
   formato da Greenn. Referência do payload real: repositório
   `solarbuy-side-platform`, `apps/platform/src/app/api/greenn/webhook/route.ts`
   e `apps/platform/src/lib/greenn/sales.ts` (status `paid` provisiona,
   `refunded`/`chargedback` bloqueia). Fazer: casar contato por telefone ou
   e-mail; venda paga → etapa "Comprou" no CRM + boas-vindas; boleto gerado e
   não pago → lembrete; reembolso/chargeback → etiqueta e sai das campanhas.
   Conferir se a Greenn aceita mais de uma URL de webhook (a plataforma do
   Francis já usa uma).
2. **IA paga.** Cadeia hoje: Gemini → Groq → Cloudflare, grátis
   (`modeloDa4yu` em `modelo.ts`). Principal vira Gemini pago (mesmo modelo
   em que o bot foi ajustado); reserva Grok da xAI (API compatível com OpenAI,
   entra como mais um provedor em `compativel-openai.ts`). Chaves e ativação
   de cobrança são do Gabriel: só o nome da variável em `.secrets/4yu.env`,
   nunca o valor.
3. **Plano próprio do Francis** pela administração (`acaoAdminCriarPlano` em
   `src/server/acoes-admin.ts`, modelo em `src/core/planos.ts`): R$ 259,
   `tetoIa` 3.000 (o Essencial tem 1.500 e estoura no lançamento), recursos
   `crm, ia, transcricao, transmissoes, ia_ferramentas, sequencias, webhook`.
4. **Conta do Francis** no Dialogon com esse plano; WhatsApp em modo
   coexistência (`src/components/cliente/conectar-whatsapp.tsx`), Instagram,
   chat do site (snippet em `src/components/canais/configurar-chat-do-site.tsx`)
   instalado no solarbuyside.com.br (repo `solarbuy-side-platform`,
   `apps/landing`).
5. **Modelos de mensagem para a Meta:** lembrete da live (marketing),
   recuperação de quem não comprou (marketing), boas-vindas pós-compra
   (utilidade). Texto passa pelo Gabriel antes de enviar para aprovação.

## Dependem do Gabriel ou do Francis

- Conectar o número (coexistência) e cadastrar cartão na conta do WhatsApp:
  sem cartão, nada passa das 1.000 respostas grátis nem sai mensagem ativa.
- Colar a URL do webhook no painel da Greenn.
- Chave da Gemini com cobrança ativa e chave da xAI.
- Lista de inscritos da live, só com consentimento para WhatsApp.

## Regras que valem para as duas

Banco compartilhado com a Verandi (`docs/BANCO-COMPARTILHADO.md`): nada de
`supabase db push`/`reset`, aplicar SQL pela Management API. Commit só dos
próprios arquivos, com `git add` nominal. Validar com `tsc`, não com a suíte
inteira. Sem travessão em arquivo nenhum. Respostas em pt-BR. Custo da Meta:
1.000 respostas grátis por número por mês, depois R$ 0,035; marketing R$ 0,32.
