# Handoff 25/set/2026: conta PCYES montada, próximo é o canal Site

Para o próximo agente. Leia antes: `AGENTS.md` e `docs/BANCO-COMPARTILHADO.md`
(o banco de produção é dividido com a Verandi). Gabriel é designer, não dev:
quer decisão tomada e implementada, respostas curtas, e print em 1440 e 390
antes de entregar tela (`scripts/ux-local/`).

## 1. O que existe hoje (feito nesta sessão)

### Conta PCYES em produção
- `clients.id = 64dbc3a9-1f77-4892-9770-e3e4be9e14cd`, slug `pcyes`, plano
  `escala`, logo no bucket `logos`, contexto do negócio preenchido a partir do
  site oficial (CNPJ 09.301.845/0001-91, Maringá/PR).
- Pessoas: `gab.feelix@gmail.com` é dono e **único no rodízio**
  (`distribuicao = balanceado`), recebe todo lead inicial. `gab.feelix1@gmail.com`
  é atendente na equipe "Suporte técnico", fora do rodízio. O gestor Rodrigo
  ainda **não** entra (decisão do Gabriel).
- WhatsApp: número de teste +55 44 7400-7438, `phone_number_id
  1301107846409860`, WABA `2245936116250161` ("4YU Tech", do portfólio dono do
  app). Canal `fa673a09-e90d-4a86-ac21-d75ee5fdca26`, **sem `token_ref`**: usa o
  `WHATSAPP_TOKEN` de sistema, como o "Cliente 00". Ligado por SQL depois de o
  Gabriel atribuir a WABA ao usuário de sistema `AutoFluxo-User`.
- Loja: Magento de **dev** (`https://dev.pcyes.com.br`) ligado na PCYES
  (`lojas_integradas.id ae0b0dfa-…`, conexão `3a7958c2-…`). O token foi copiado
  dentro do Vault a partir da conexão da conta 4YU, que continua com a dela.
- 5 funis: Atendimento e vendas (padrão), Suporte técnico, Garantia e devolução,
  Empresas (B2B), Parcerias e marketing. 6 etiquetas, 8 respostas rápidas,
  horário seg-sex 8h-18h, retomada do robô em 120 min.
- 7 fluxos publicados. "Boas-vindas e menu" é principal e boas-vindas do canal,
  e a palavra `menu` também dispara. O menu (lista de 6) leva a: Vendas com IA
  (`loja_buscar`, `loja_mostrar`, `loja_combina_com`), Meu pedido (IA com
  `loja_pedido`), Suporte técnico (pergunta com foto, anotação, avisa
  gab.feelix1), Garantia e devolução (idem), Compra para empresa e Parcerias
  (avisam gab.feelix). Cada fluxo move o contato no funil dele com o bloco
  `etapa`.
- Os fluxos foram montados por um script fora do repo que valida com
  `validar()` e `validarPublicacao()` e publica via `publicar_fluxo`. Para
  mudar, use o editor (`/clientes/<id>/automacoes`) ou repita o padrão.

### Código (commits em `main`, todos em produção)
- `2e0268e` botão "Número só na API, sem celular" (Embedded Signup sem
  coexistência) e inscrição + registro do número no fim do onboarding.
- `86896ae` ferramenta `loja_pedido` (`src/loja/magento-pedido.ts`): consulta
  pedido na REST de admin do Magento e só responde se o telefone da conversa
  (injetado) ou o CPF informado bater com o pedido. Teste em
  `src/loja/magento-pedido.test.ts`.
- `aa34b21` IA com terceira tentativa quando principal e reserva dão 503
  (medido: ~1 em 3 chamadas ao Gemini com 503 nesse dia).
- `96cbd8c` "digitando" liga assim que a mensagem chega e é renovado a cada
  20 s; webhook do WhatsApp passa de 60 s para 300 s (uma rodada de IA foi
  cortada calada nos 60 s).
- Presença: o rodízio só entrega para quem está "disponível". O Gabriel estava
  "ausente" e o lead caiu em "Sem responsável"; foi corrigido no banco.

### Pendências da PCYES (não bloqueiam o canal Site)
- **Não verificado:** se o token do Magento de dev tem permissão de ler pedidos
  (`Magento_Sales::sales`). Teste: "Meu pedido" com um pedido do dev feito com o
  telefone da conversa. Erro 401/403 vira "o token da loja não tem permissão
  para ler pedidos".
- "Comprou" no funil ainda é manual. Automatizar depende dos webhooks do Adobe
  Commerce (proposta em https://claude.ai/artifact/Le2ni4pgxmaAYHicthAw1i).
- Proposta de avisos de status com foto (modelos de utilidade), rastreio da
  Frete Rápido/Magento: frente 2 da proposta, não começada.

## 2. Próximo trabalho: canal Site (chat no site da PCYES)

Pedido do Gabriel: "construa tudo". Um balão de chat no site (Magento) que cai
na mesma Inbox e roda os mesmos fluxos, funis e IA. Não passa pela Meta, então
não tem custo por mensagem. Deixe claro para ele que a economia vs WhatsApp é
pequena (responder cliente no WhatsApp já é grátis); o ganho é conversão de
quem navega no site.

### Onde encaixar
- Canais hoje: `src/core/canais.ts:45` (`whatsapp`, `instagram`, `telegram`).
  Acrescentar `site`. **Telegram é o melhor molde**: canal fora da Meta, ver
  `src/channels/telegram.ts` e como ele entra em `receber-mensagem.ts`.
- Adaptador de envio em `src/channels/` implementando `types.ts`. Precisa
  representar texto, botões, lista, mídia e o card de produto
  (`enviar_produtos`, ver `cloud-api.ts:605`).
- Fluxos têm `flows.canal`; o validador usa `DEFINICAO_DO_CANAL` (limites de
  botão/lista por canal). Decidir se o site reaproveita os fluxos `whatsapp` da
  PCYES ou ganha cópias `site`. Preferência: reaproveitar sem duplicar, se o
  motor permitir; se não, documente o porquê.

### Peças
1. **Migration** (descubra o número pelo diretório; a última hoje é `0104`):
   provider `site` em `channels`, e o que faltar para contato sem telefone
   (visitante anônimo identificado por id de sessão; `contacts` hoje é centrado
   em telefone). `set search_path = public, extensions`. Aplicar em produção só
   com autorização explícita do Gabriel, e nunca `supabase db push`.
2. **API pública** (`src/app/api/site/...`): abrir sessão, enviar mensagem,
   receber respostas (polling curto ou SSE; o Vercel limita conexões longas).
   CORS restrito aos domínios cadastrados no canal, limite por IP e por sessão
   (há `limites_de_requisicao`), e nenhum dado de outra conversa acessível pelo
   id da sessão.
3. **Widget**: um `<script>` servido pelo AutoFluxos que o lojista cola no
   Magento. Leve, sem framework pesado, marca configurável (cor, logo, saudação),
   funciona no celular. É tela: passe pelo design com o Gabriel (skill
   frontend-design, print em 1440 e 390).
4. **Tela de configuração** em Canais: ligar o canal Site, domínios permitidos,
   aparência, e o trecho para copiar.
5. **Inbox**: selo do canal "Site" na fila e no cabeçalho, como os outros.
6. **Identidade**: visitante anônimo pede nome e WhatsApp/e-mail no meio da
   conversa (campo do contato). "Meu pedido" no site só confere pelo CPF,
   porque não há telefone da conversa. Futuro: cliente logado no Magento.
7. **Ligar na PCYES**: cadastrar `dev.pcyes.com.br` e `pcyes.com.br`, gerar o
   trecho, entregar ao Gabriel com o passo de colar no Magento.

### Regras da casa que valem aqui
- Commit local por fase; **um** push/deploy só no fim da frente (limite de
  deploy da Vercel). Conferir `READY` depois.
- Validar com `tsc` e testes do que mudou; não rodar a suíte inteira.
- Ações otimistas na UI, sem `revalidatePath` da rota aberta.
- Proibido travessão (o traço longo) em qualquer arquivo tocado.
- Placeholder de campo começa com "Exemplo:".
- Implementar no fio principal, sem subagente para implementar.
