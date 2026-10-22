# Handoff: 22/out/2026 (noite), frentes 4 e 5

Para o agente que continua. Faça a **frente 4** (curta) e depois a **frente 5**.
Em paralelo, **outro agente** faz as etapas D e E da cobrança e a frente 2
(`docs/HANDOFF-22-OUT-COBRANCA-D-E-E-FRENTE-2.md`). Vocês dividem a mesma
pasta: **commite só os seus arquivos** (`git add <arquivos>`, nunca `git add -A`)
e não mexa no editor de fluxos (`src/components/editor/`) sem combinar, que é
onde ele está.

## Leia antes

1. `docs/PLANO-COBRANCA-CAMADA-1.md` (andamento no topo).
2. `docs/HANDOFF-21-OUT-PROXIMAS-FEATURES.md`, itens 3 e 4: Flows e catálogo.
3. `docs/BANCO-COMPARTILHADO.md` e `AGENTS.md` antes de qualquer migration.
4. `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`: feature nova entra no dia.

## O que está no ar (conferido `READY`)

| Commit | O quê |
|---|---|
| `8a6591bf` `9d9073b1` | Cobrança: gateway independente, Asaas, Mercado Pago etapa B, botão Cobrar, CRM > Cobranças. Núcleo em `src/server/cobrancas.ts` |
| `a2a3f9e6` | Conector de BI: `GET /api/v1/relatorios/{conjunto}`, escopo `relatorios:ler` |

A `0141_cobrancas` **não está em produção** (falta autorização do Gabriel).
Código que lê `cobrancas` tolera a tabela ausente; mantenha isso.

## Frente 4: saída genérica da cobrança (1 a 2 dias)

Para quem tem sistema próprio saber que alguém pagou.

- **Webhook de saída `cobranca.paga`**: entra na lista fechada de
  `src/core/api/webhooks.ts` (`EVENTOS_DE_WEBHOOK`; não há trava no banco).
  Emitir com `emitirEvento` (`src/server/webhooks-de-saida.ts`) dentro de
  `aplicarPagamento` em `src/server/cobrancas.ts`, **só quando `mudarStatus`
  devolve `true`** (é o que impede o aviso repetido do gateway de virar dois
  eventos). `dados`: id, valor em reais, descrição, gateway, `paga_em`.
  Avalie `cobranca.vencida` junto, no mesmo ponto de `rodarVencimentoDeCobranca`.
- **API v1**: `GET /api/v1/cobrancas` (listar, por telefone e status) e
  `POST /api/v1/cobrancas` (criar e devolver Pix e link, **sem** mandar na
  conversa, para o sistema do cliente usar onde quiser). Escopos novos em
  `src/core/api/chaves.ts` (`cobrancas:ler`, `cobrancas:criar`). Criar exige
  `Idempotency-Key`, como `POST /mensagens/template` (ver
  `src/server/repos/idempotencia-da-api.ts`). Siga o padrão de
  `src/app/api/v1/funil.test.ts` nos testes.
- **Documentação de devs no mesmo commit** (ver abaixo).

## Frente 5: grandes (6 a 10 dias cada)

Comece pelo **WhatsApp Flows de agendamento**: é o que serve a MGM Pilates
(cliente pagante, Verandi + AutoFluxos).

- Formulário nativo do WhatsApp para escolher dia e horário, ligado à agenda
  da Verandi pelas chamadas que já existem (doc de devs, página "Chamadas da
  Verandi"). Modelos prontos, sem editor visual de Flow.
- Exige endpoint de dados com criptografia **RSA-OAEP + AES-GCM** e a chave
  pública do número publicada na Meta. A chave privada vai no cofre
  (`src/server/cofre.ts`), nunca no repositório. Publicar a chave pública na
  Meta é chamada de API com o token do número; se depender de painel, vai para
  `PENDENCIAS-DO-GABRIEL.md` com o link.
- Escreva com teste de criptografia de ida e volta (vetores próprios) antes de
  qualquer rede.

Depois, **catálogo oficial do WhatsApp**: sincronizar o catálogo próprio e o
da Nuvemshop com o Commerce Manager, mensagem de produto e multiproduto,
receber o carrinho. Se exigir Commerce Manager ligado pelo Gabriel, anote em
`PENDENCIAS-DO-GABRIEL.md` e adiante o que der.

## Documentação de devs: atualizar junto, sempre

`https://autofluxos.4yu.com.br/ajuda/desenvolvedores` é a página pública para
quem integra. Toda mudança de API, webhook, escopo ou integração atualiza a
página **no mesmo commit**: `src/components/docs/paginas-api.tsx` (API v1,
escopos, erros, webhooks de saída) e `src/components/docs/paginas-dev.tsx`
(webhook de entrada, chat do site, Verandi). Só o que existe no código.
O arquivo `paginas-api.tsx` já tinha 6 erros de lint `no-useless-escape`
antes de nós; não são regressão.

## Armadilhas já pagas
- **`pkill -f "next dev --port 3100"` mata o próprio comando** (o padrão casa
  com ele). Pare por PID: `ps -eo pid,args | grep "[n]ext dev --port 3100"`.
- Docker desligado: abra `/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe`
  e espere o `docker ps`.
- `Response.text()` engole o BOM do CSV; teste os bytes.
- Arquivo `'use server'` só exporta função `async`.
- Local semeado: conta `71aa7f92-3814-49f4-a7b5-ee22ae53f826`, plano
  Operação, Asaas falso em teste, cobranças de exemplo.

## Regras do Gabriel (não negociáveis)
- pt-BR, curto, decisão tomada com recomendação. Ele é designer, não dev.
- **Travessão proibido** em todo texto e arquivo.
- UI: print local em 1440 e 390 (`scripts/ux-local/dev.sh`, porta 3100).
- Commit e push na hora com `GITHUB_TOKEN` do cofre; conferir `READY` na
  Vercel em segundo plano. Juntar pushes: a cota é compartilhada com a Verandi.
- Migration em produção só com autorização explícita.
- Não rodar a suíte inteira: `tsc` limpo, lint e só os testes mexidos.
- Token de pagamento **nunca** vira Conexão comum (`connections`).
- Tudo que depende do Gabriel vai para `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.
