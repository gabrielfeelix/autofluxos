# Handoff 06/out/2026: modelos por ramo, custo da Meta, editor, avatares

Continua `docs/HANDOFF-05-OUT-CACA-BUG-3.md`. Leia antes: `AGENTS.md`,
`docs/BANCO-COMPARTILHADO.md`. Gabriel é designer, não dev: decisão tomada e
implementada, resposta curta, commit e push na hora (push na `main` publica na
Vercel), print local 1440 e 390 antes de entregar UI. Sem travessão em arquivo
nenhum. Validar com `tsc` + `eslint` e o teste do arquivo tocado; suíte
inteira não. **Outra sessão mexe em planos/preços** (commits `feat(plano...)`):
antes de tocar `escolha-de-plano.tsx` ou `core/planos*`, `git log` do arquivo.

## O que entrou (tudo no ar, nenhuma migration)

| Commit | O quê |
|---|---|
| `e1a0834` | Modelo com botão de link terminando em `{{1}}` é barrado antes da Meta (131008) em retomar, agendar, transmissão, sequência e API: `linkComLacuna`/`recadoDoLinkComLacuna` em `core/templates.ts` |
| `71dd552`, `256d8c3` | Galeria de modelos prontos **por ramo** (`ramo` em `core/modelos-prontos.ts`, `modelosDoRamo`): 9 a 10 por ramo + "Retomar a conversa" (MARKETING) para todos. Biblioteca da Meta filtrada pelo tema do nome (`bibliotecaServeAoRamo` em `core/titulo-da-biblioteca.ts`). Conta sem ramo vê tudo, agrupado |
| `a2d60b2` | Custo: tarifas BRL em `core/franquia-da-meta.ts` (`TARIFA_DO_MODELO_BR`: marketing 0,3217, utilidade/autenticação 0,035), `gastoDoPeriodo` (franquia de 1.000 serviço por número/mês). Cartão "Gasto com WhatsApp" em Relatórios (só conta inteira + `ler_valores`). Preço por envio na galeria, Retomar, Agendar e estimativa total na Transmissão |
| `25bca5a` | Plano em uso: contorno e selo verdes "Em uso" (`outline`, porque `.app-card` sobrescreve `border`) |
| `707c69a` | Esqueleto próprio do editor: `components/editor/esqueleto-do-editor.tsx` + `fluxos/[fluxoId]/loading.tsx`. Largura do catálogo lida de `useLarguraDosBlocos` (`editor/largura-guardada.ts`) |
| `705ef04` | Bloco **Encaminhar contato** desenhado no canvas (`NoEncaminhar` em `editor/nos.tsx`). `tiposDeNo` agora `satisfies Record<TipoNo, ...>`: bloco novo sem desenho não compila |
| `574453e`, `cecf480` | Renomear automação: na lista abre modal (por portal, a linha tem `pointer-events-none`); no topo do editor, campo + botão Salvar na mesma linha, sem legenda |
| `a21a3b6` | Ícone de etiquetas da conversa: contador azul no canto (`contador` em `BotaoDeIcone`, `inbox/acoes-rapidas.tsx`) em vez de fundo de pressionado |
| `6676d53` | Foto de perfil em Pessoas e Equipes (`membrosDaConta` e `pessoasDaOrganizacao` leem `u.image`) |
| `8e1efac` | Avatares **Bottts** (`lib/retrato.ts`, pacote `@dicebear/bottts`; Personas e `core/genero-do-nome.ts` removidos). Galeria de 18 em Editar perfil (`conta/voce.tsx`); escolha grava `avatar:<semente>` no `image` do usuário, servidor só aceita `SEMENTES_DA_GALERIA` (`acoes-perfil.ts`). `fonteDoRetrato` resolve no `Avatar` |

## Fatos confirmados nesta sessão

- Meta: 1.000 mensagens de serviço grátis **por número por mês**, sem acumular;
  utilidade e marketing pagam desde a primeira. Sem forma de pagamento, só as
  1.000 saem. Tabela de preço **não tem API** (só CSV/PDF); o custo real chega
  pelo `pricing_analytics`, já copiado todo dia para `consumo_da_meta` (0104).
- Upload de arquivo do negócio funciona em produção (Gabriel testou).

## Pendências

- **PCYES**: Gabriel vai apagar e recriar `account_creation_confirmation_3_202610051827`
  (link com `{{1}}`). Até lá o sistema barra o envio com recado.
- **Relatório usar o custo da Meta** em vez da estimativa: quando aparecer a
  primeira linha `REGULAR` com `custo` em `consumo_da_meta`, conferir a moeda
  da WABA (BRL ou USD) e trocar `gastoDoPeriodo` para o valor real.
- Envio de modelo troca **todas** as lacunas pelo nome do contato; preencher
  cada variável antes de enviar/agendar segue em aberto.
- Aviso `key` do React em `PainelDeBlocos` (Relatórios), só em dev; origem não
  investigada.
- Do handoff anterior: lápis do nome ao lado do Editar; "Negócios" em
  Relatórios/Início; preço de plano sem `CampoDeDinheiro`; Fase 2 do plano de
  teste; permissão `vendas` para `autofluxos_dados`.

## Ambiente local: o que custou tempo

- Print: `bash scripts/ux-local/dev.sh` (porta 3100, banco local), sessão em
  `node scripts/ux-local/entrar.mjs`. Comparar esqueleto:
  `CONTA='MARCA1791215138793' node scripts/ux-local/esqueletos.mjs <saida> editor`
  (o padrão "Studio Pilates Revisão" não existe mais no banco local).
- Parar o servidor **por PID** (`ps -eo pid,args | awk '/next dev --port 3100|next-server/'`);
  `pkill -f` mata o próprio shell.
- `tsc` com erro em `.next/types` depois de matar o servidor: `npx next typegen`.
- `npx prettier` sem config reescreve o arquivo com aspas duplas e `;`. Se
  usar: `--no-semi --single-quote --print-width 100 --trailing-comma all`.
- Seeds locais desta sessão: `consumo_da_meta` de exemplo e foto em
  `revisao@local.test` (conta `ab7ec604-...`).
