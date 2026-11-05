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

## Estado da Sessão B (05/nov/2026)

- **Conta:** "Solar Buy-Side", `3d149933-40e6-4aa0-9d6e-4cb4498ace0d`, plano
  `solar-buy-side` (R$ 259, `teto_ia` 3.000, fora de venda). É o destino do
  item 4 da Sessão A.
- **Greenn:** `/api/webhook/greenn/[clienteId]?token=` (commit `41c7cea0`), o
  endereço pronto aparece na aba Eventos (`56792031`). `paid` etiqueta
  Comprou + estágio cliente + etapa "Comprou" se existir; `waiting_payment`
  etiqueta Pagamento pendente; `refunded`/`chargedback` etiqueta Reembolso,
  sai das sequências e do marketing. Mensagens = sequências por etiqueta
  (boas-vindas na Comprou; lembrete na Pagamento pendente, saída pela Comprou),
  montadas quando os modelos forem aprovados.
- **IA paga:** `GEMINI_API_KEY_PAGA` liga Gemini pago + Grok (`XAI_API_KEY`),
  sem free tiers (`f69968e1`). Sem a variável, nada muda.
- **Chat do site:** canal `11de982c-afec-4c00-8bcd-20c3de7cbdd6` **pausado**,
  domínios solarbuyside.com.br e www; snippet no ar na landing
  (`solarbuy-side-platform` `141ef30`). Ligar o canal depois que o fluxo for
  copiado: sem fluxo, o balão abriria sem resposta.
- **Pendente:** o que depende do Gabriel está em `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.

## Estado da Sessão A (05/nov/2026)

- **Hora na IA:** `HOJE` e `AGORA` no topo do prompt (`horaNaConta`,
  `fb18fe9b`); a promoção vira sozinha às 21h de 1º/12 e acaba às 21h de
  3/12. Testado em 4 horários. O simulador aceita `SIMULAR_HOJE` e
  `SIMULAR_AGORA`.
- **Botão de compra:** parte "Botão com link" na mensagem e "Mandar o botão
  de compra" no bloco de IA (`69ec5341`). O card aprovado pelo Gabriel está
  em `SOLAR_BOTAO` e substitui a frase da IA.
- **Bateria:** 60 perguntas em 6 conversas, corrigidas até acertar
  (`5b0144f5`). Depois de concluir, a conversa volta para a IA em vez de cair
  num menu que só aceita toque.
- **Conta do Francis:** `scripts/solar/conta.mts --gravar` publica
  "Atendimento Solar Buy-Side" (`fe6ae38e-936f-457a-8df1-b1352ab0d01c`),
  copia os 275 trechos da conta demo e liga o fluxo em todos os canais da
  conta **sem mudar o status** (o chat do site segue pausado). Conteúdo único
  em `scripts/solar/conteudo.mts`, usado pelo demo e pela conta.
- **Pendente:** ligar o chat do site (decisão do Gabriel); rodar
  `conta.mts --gravar` de novo depois de conectar o WhatsApp, para o canal
  novo receber o fluxo; link da Greenn da promoção, se for outro.
