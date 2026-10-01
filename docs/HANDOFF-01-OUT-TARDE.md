# Handoff 01/out/2026 (tarde): PCYES, custo da Meta, Lead Ads, modelo de loja

Para o próximo agente. Substitui `HANDOFF-01-OUT-PCYES.md` (no git até
`a3c504d`). Leia inteiro antes de mexer.

## Regras e jeito de trabalhar

- Regras do repo valem (`AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`). Escrita
  em produção (banco, fluxos da PCYES, Meta) foi autorizada **caso a caso** hoje;
  o classificador de permissão barra sem autorização explícita na mensagem.
  Peça com uma frase do que vai escrever e onde.
- **Publicar na hora** (decisão do Gabriel em 01/out): push na `main` quando
  pronto, sem esperar fim do dia. Cada deploy dá recarga no primeiro clique de
  quem está com a tela aberta (Vercel Hobby, sem Skew Protection); medido: fora
  disso a troca de tela é ~80 ms. Junte commits da mesma frente.
- Resposta curta. Ele é designer e não dev: decisão tomada, link clicável,
  passo a passo numerado só do que **ele** clica. Texto de UI em tom de SaaS
  B2B (memória `tom-profissional-nos-textos`).
- `tsconfig.json` modificado sozinho é do `next dev`: não commite.
- Sem Docker na máquina hoje: Supabase local não sobe. Print de UI foi feito
  em produção com `revisor.meta@4yu.com.br` (`.ux-local/*.mjs`, fora do git),
  que não tem loja nem Meta ligada.

### Acesso

- Banco: Management API, `SUPABASE_ACCESS_TOKEN` do cofre, ref
  `xxxynoshwirupkdzwxbj`. Segredo do Vault por `public.ler_segredo(id)`; nunca
  imprima o valor.
- PCYES: conta `64dbc3a9-1f77-4892-9770-e3e4be9e14cd`. 4YU: `f175bf85-7ce6-4cc4-a19a-e910df70a53e`.
- Fluxo publicado é imutável (`versao_e_imutavel`). Para mudar: `update flows
  set rascunho = ...` e **depois, noutra chamada**, `select publicar_fluxo(id,
  rascunho)`. Os dois no mesmo statement dão `27000 tuple already modified`.
  Valide o grafo com `fluxoSchema` antes.
- Meta: app `1063817842847269`, MCP `meta-devtools` lê review, permissões e
  webhooks.

## O que entrou hoje (tudo no ar, último deploy `a3c504d`)

Bot e custo (a Meta cobra cada mensagem de serviço desde 01/out):
- **Rajada** (`core/rajada.ts`, `ef5fd80`, `ffcbb16`): texto espera 3 s; se
  chegou texto **ou toque em botão** mais novo, cede a vez. A IA lê a rajada
  inteira como pergunta.
- **Bolha única** (`juntarTextosSeguidos`, `0162b37`): textos seguidos e texto
  antes de botões viram uma mensagem, teto 1.000 caracteres.
- **Card não se repete no texto** (`semRepetirOsCards`, `ffcbb16`).
- **Fora do horário** fala da equipe, não do atendimento (`f022806`).
- Nome com letra estilizada sai normal na saudação (NFKC em `primeiroNome`).

Produto:
- **Relatórios**: blocos "Mensagens enviadas" (só API, robô e equipe) e
  "Cupons mandados" (pedidos e receita no Magento). Medido: PCYES em set/2026,
  285 mensagens, 243 do robô; real de 30/set ~74 para ~13 clientes.
- **Modelo "Atendimento de loja virtual"** (`src/exemplos/atendimento-loja.ts`,
  primeiro do nicho e-commerce): menu que entende texto, vendedor IA, pedido,
  triagem de troca e garantia no mesmo número, site e pagamento para a equipe.
  Não foi aberto no editor (sem Docker).
- **Ficha de e-commerce**: Pix e preço do cartão, cupom do WhatsApp, outros
  times, nome no pagamento. Prompt da IA: mostra direto quando o tipo tem até
  3 produtos; não lista o que o card mostra.
- **Anúncios** (`ajustes/anuncios`): Páginas do token com foto e botão Ligar,
  que já assina `subscribed_apps`; logo da Meta; chave `meta-ads` saiu de
  Chaves de API.
- **Coexistência**: recusa do histórico (2593109) gravada em
  `channels.historico_recusado_em` (migration **0117**, aplicada).
- Seletor de conta conta não lidas, a mesma regra da barra lateral.
- Plano e consumo explica que a leitura da Meta é diária, de madrugada.

PCYES no banco (não passa pelo git):
- Fluxos com **8h às 18h** (Suporte v5, Compra para empresa v5, Parcerias v5).
- **Site e pagamento vão para o especialista**: assunto `site` com handoff
  "Vou passar para um especialista..." em triagem (Boas-vindas v6), Vendas v11,
  Meu pedido v7, Drivers v5. A triagem não promete mais "vou te passar para o
  time". Origem: conversa do Evandro em 01/out.
- Histórico do WhatsApp da PCYES **não veio**: a Meta recusa novo pedido
  ("máximo de vezes"); só reconectando o número, depois das 18h.

Meta:
- **Lead Ads provado** com a Página 4YU sem App Review: usuário do sistema
  `autofluxos-ads` (Funcionário; o portfólio só aceita 1 admin), caso de uso
  "Capturar e gerenciar leads" no app, token `meta-ads` na conta 4YU. Lead de
  teste foi recusado só pelo telefone falso da ferramenta.
- WhatsApp aprovado. **Instagram e `business_management` reprovados** por falta
  de vídeo (screencast).

## Pendências, em ordem

1. **Ver acontecer de verdade**: rajada, bolha única, rota de site/pagamento
   ("o cartão não aparece no site" do número do Gabriel, DDD 44), cards sem
   repetição. Conferir em `messages` depois.
2. **Tom profissional no sistema inteiro**: varrer rótulos, selos, botões,
   avisos e textos do bot. Exemplos dele: "Gente esperando" → "Cliente
   aguardando"; "Sem conversa no mês" → "Sem atividade no mês"; "repassar
   para humano" → "transferir para atendente". Começa em
   `src/app/admin/organizacoes/(lista)/page.tsx:193`, `src/app/admin/consumo/page.tsx:31`,
   `AVISO_DE_ESPERA` e `AVISO_DE_HANDOFF` em `receber-mensagem.ts`, e a
   mensagem de retomada em `core/retomada.ts`.
3. **Reclamação volta ao menu na PCYES** ("Suporte não responde." do Bruno):
   a triagem deveria mandar para a equipe. No modelo de loja já vai.
4. **Galeria de integrações com logo** (pedido dele): card por integração,
   OAuth onde existe, "cole sua chave" onde não, "Outra integração → Nova
   chave" no fim. Primeiro card: Conectar com Meta.
5. **Modal "Nova chave" com clique ruim**: clicar perto do seletor abre o
   dropdown; clicar entre campos dispara o aviso de sair. Suspeita: rótulo
   envolvendo o seletor e fundo do modal contando como "fora".
6. **App Review**: gravar numa leva só os vídeos do Instagram (conectar conta,
   direct chegando e respondido) e, se a Página de cliente exigir, Lead Ads.
   Roteiro em `docs/ROTEIRO-VIDEOS-APP-REVIEW.md`. O e-mail de contato do app
   está verificado, mesmo a API dizendo `false`.
7. **Saudação automática do app no celular da PCYES** ainda ligada, duplica a
   do bot (é do Gabriel desligar).
8. **Forma de pagamento na WABA** da PCYES e da MGM (Gabriel vê depois).
9. **MGM**: fixar "Fluxo - Atendimento" no canal do Daniel quando ele avisar;
   histórico antigo sem as mensagens enviadas pela MGM.
10. "Minhas conversas" lenta: não reproduzido com a revisora (troca local, 0
    requisição). Se voltar, medir com a conta da PCYES.

## Pegadinhas novas

- Pulso da conta muda sem mensagem nova (arquivo, tique): empate no pulso é
  "o que chegou por último" (`pulsoDaTela`).
- `ultimaEntradaDeTexto` conta `text`, `interactive` e `button`; arquivo não.
- A leitura do consumo da Meta (`copiarConsumoDaMeta`) roda às 05:13 e só traz
  até ontem.
- Vercel Hobby: logs de runtime dão 403 pelo MCP.
- O guia `LIGAR-LEAD-ADS-PASSO-A-PASSO.md` é de 14/set e manda fazer à mão o
  que a tela de Anúncios já faz. Confira a tela antes de mandar o Gabriel para
  o painel da Meta.
