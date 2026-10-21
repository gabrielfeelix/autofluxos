# Handoff: 21/out/2026, próximas features do AutoFluxos

Para o agente que continua as features. Em 21/out foram feitos os 9 recursos
**rápidos** tirados da Colmeia (`docs/PLANO-9-DA-COLMEIA.md`, todos no ar até
`b3a3a022`). Ficaram os **grandes**, que pedem decisão de produto antes de
código.

## Leia antes (nesta ordem)

1. `docs/COMPARATIVO-COLMEIA.md`: matriz contra a Colmeia e top 5 lacunas.
2. `docs/MERCADO-COBRANCA-NO-CHAT.md`: como o mercado cobra pelo chat (5
   frentes de pesquisa), gateways, Banco Central, nota fiscal, loja pequena.
3. `docs/PLANO-9-DA-COLMEIA.md`: o que já foi feito e os limites conhecidos.
4. `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`: **toda feature nova entra aqui
   no mesmo dia**, escrita como benefício, com a data.
5. `docs/BANCO-COMPARTILHADO.md` e `AGENTS.md` antes de qualquer migration. A
   última aplicada em produção é a `0140`; confira o diretório mesmo assim.

## Fila, em ordem de prioridade

### 1. Opt-out "SAIR" e registro de opt-in · **feito em 21/out**
Sem migration (usa `public.consentimentos` da 0059). Núcleo em
`src/core/consentimento.ts`, gravação em `src/server/consentimento.ts`.
- "SAIR", "PARAR", "STOP", "parar promoções" e afins, **como mensagem
  inteira**, no WhatsApp: grava a saída, confirma, não acorda o bot. Vence a
  leitura de "sair da IA" de propósito.
- Transmissão com modelo MARKETING exclui quem saiu (motivo `pediu_para_sair`);
  modelo UTILITY continua chegando.
- Erro `131050` da Meta (pessoa parou pelo próprio WhatsApp) virou `desistir`
  (antes repetia) e grava a mesma saída, no envio e no webhook de status.
- Ficha: cartão "Promoções pelo WhatsApp" com interruptor (origem `manual`).
- Chat do site: caixa de aceite desmarcada quando o formulário pede WhatsApp;
  grava só no visitante (número digitado não é prova de dono).
- Lead Ads: lê `custom_disclaimer_responses`; sem caixa no formulário, nada é
  gravado. **Não validado ao vivo**: o campo `legal_content` do formulário
  (texto da caixa). Se falhar, grava só a chave da caixa.

### 2. Cobrança própria, camada 1 (10 a 14 dias) · decidir com o Gabriel antes
Desenho já pesquisado em `MERCADO-COBRANCA-NO-CHAT.md`:
- conta do **dono** no gateway, o AutoFluxos **nunca toca no dinheiro** e não
  cobra porcentagem (Resolução BCB 494/2025);
- **Mercado Pago primeiro** (conectar por OAuth, um clique), Asaas depois
  (emite NFS-e a R$ 0,49 e é o mais integrado no Brasil);
- Pix sai como mensagem nativa de pedido do WhatsApp (`order_details`, Payments
  BR da Meta), com link como alternativa;
- pago, o webhook do gateway faz o fluxo seguir sozinho;
- tela **Cobranças** (pendente, paga, vencida, cancelada);
- nota fiscal nunca é nossa.
Depois: **pedido leve** para loja sem site (itens, entrega, estoque simples,
tela Pedidos), 6 a 8 dias. Loja com Magento ou Nuvemshop: o pedido nasce na
loja (conector, sob demanda). Estúdio com Verandi: a mensalidade é da Verandi.
**Antes de codar:** passar o plano pelo Gabriel (brainstorm, depois plano
escrito, depois aprovação). Não confirmado: se `order_details` exige catálogo
ligado ao número.

### 3. WhatsApp Flows de agendamento (6 a 10 dias)
Formulário nativo do WhatsApp para escolher dia e horário, ligado à Verandi
(cliente MGM). Começar por modelos prontos, sem editor visual de Flow. Exige
endpoint com criptografia (RSA-OAEP + AES-GCM) e chave pública do número
publicada na Meta.

### 4. Catálogo oficial do WhatsApp (6 a 10 dias)
Sincronizar o catálogo próprio e o da Nuvemshop com o Commerce Manager,
mensagem de produto e multiproduto, receber o carrinho. Valor maior para loja.

## Pontas soltas dos 9 de 21/out
- **Clique contado** só vale para modelo criado pela **biblioteca**: o modelo
  escrito do zero na nossa tela ainda não tem botão nenhum. Dar botão de link
  ao modelo do zero, já passando por `comCliqueContado`.
- **Telegram**: foto, áudio e arquivo chegam como texto ("mandou uma foto").
  Falta baixar pelo `getFile` e guardar como mídia.
- **Conversions API**: depende de `whatsapp_business_manage_events` no app da
  Meta (pendência do Gabriel). `partner_agent` foi omitido; validar no
  primeiro envio real e ver no Events Manager.
- **Transmissão**: público ainda só por etiqueta; segmento salvo não vira
  público.
- **Ausente devolve a fila**: sem interruptor por conta; liga sozinho na
  distribuição automática.

## Regras do Gabriel (não negociáveis)
- pt-BR, curto, decisão tomada com recomendação. Ele é designer, não dev.
- **Travessão proibido** em todo texto e arquivo.
- UI: print local em 1440 e 390 (`scripts/ux-local/dev.sh`, porta 3100) antes
  de entregar. Docker Desktop precisa estar aberto; se o login local pedir
  confirmação de e-mail, marcar `emailVerified` do `revisao@local.test` no
  banco **local**.
- Commit e push na hora, com `GITHUB_TOKEN` do cofre; conferir `READY` na
  Vercel em segundo plano.
- **Migration em produção só com autorização explícita**: ensaio em
  transação desfeita, aplicar pela Management API (ref
  `xxxynoshwirupkdzwxbj`, `SUPABASE_ACCESS_TOKEN` do cofre), conferir. Código
  que lê coluna nova só vai ao ar depois dela.
- Não rodar a suíte inteira: `tsc` limpo sem filtro e só os testes das partes
  mexidas.
- Tudo que depende do Gabriel vai para `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.
