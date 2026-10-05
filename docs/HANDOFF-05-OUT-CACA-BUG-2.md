# Handoff 05/out/2026 (2): caça a bug, ficha, negócio, login

Continua `docs/HANDOFF-05-OUT-CACA-BUG.md` e `docs/PLANO-TESTE-05-OUT.md`
(plano + tabela de achados). Leia antes: `AGENTS.md`, `docs/BANCO-COMPARTILHADO.md`.
Gabriel é designer, não dev: decisão tomada e implementada, resposta curta,
commit e push na hora (push na `main` publica na Vercel), print local 1440 e
390 antes de entregar UI. Sem travessão em arquivo nenhum. Validar com `tsc` +
`eslint`; suíte inteira não.

## O que entrou nesta sessão (tudo no ar, testado no navegador local)

| Commit | O quê |
|---|---|
| `adbc30c` | Contatos: paginação mantém segmento; Anúncios: erro ao desligar Página aparece; Distribuição: volta ao último valor gravado se falhar |
| `4c837c7` | Cadastro: login falho após criar conta vai para `/entrar?conta=criada`; Horário revalida a própria página |
| `06cc136` | Menu da mensagem (seta da bolha) ancora na seta: `seta`, `fim` ou `inicio` (`lead/rodape-da-mensagem.tsx`) |
| `8bad678` | Ficha: Anotar e Etiquetar abrem modal; provedor de anotações único na ficha |
| `c5fbf45` | Mensagens salvas abrem a conversa na mensagem (`&mensagem=`, `RolarAteAGuardada` em `inbox/historico.tsx`) |
| `ba1910f` | "Negócios" virou "Negociações" (rótulo padrão; Pilates e restaurante mantêm o do ramo) |
| `f568deb` | Retrato DiceBear `personas` para quem não tem foto, gênero pelo primeiro nome (`lib/retrato.ts`, `core/genero-do-nome.ts`); gerado local, sem API |
| `7e41390` | Cabeçalho do negócio no azul, ações `AcaoDaFicha` (Ganho, Perdido à vista); "Abrir negócio" virou "Detalhes do negócio" |
| `0ffaec2` | Título do negócio: lápis + modal pequeno |
| `170995d` | Máximo 3 aparelhos por pessoa (`server/limite-de-sessoes.ts`, `databaseHooks` em `server/auth.ts`); admin da plataforma e `impersonatedBy` fora |
| `63e8de5` | Derrubado vê `/entrar?motivo=outro-aparelho` com ilustração; marca = hash do token em `af_verificacoes` (`telaDeEntrar()` em `server/sessao.ts`) |
| `f201b26` | 2FA no menu do perfil do topo (`design/cabecalho.tsx`); some para o suporte |
| `5dc90a3` | Ficha: modo de edição no lugar + barra flutuante Salvar/Descartar (`lead-crm/modo-de-edicao.tsx`, `lead-crm/campos-editaveis.tsx`, negociações em `lead-crm/negociacoes.tsx`) |
| `cfd3091` | `CampoDeDinheiro` (R$ fixo, formata ao digitar) em todo valor em reais; lógica pura em `core/dinheiro-digitado.ts` com teste |
| `a276e9b` | "Temperatura" virou "Qualificação" nos rótulos (valores e coluna iguais) |

**Brevo, fora do código:** o domínio `autofluxos.mail.4yu.com.br` nunca tinha
sido autenticado; reset de senha e confirmação de e-mail davam `error` em
produção. Com autorização do Gabriel, 4 registros DNS foram criados na
Hostinger (TXT `brevo-code`, 2 CNAME DKIM, DMARC), o domínio autenticou e um
e-mail de teste foi `delivered`. Nada no código mudou.

## Decisões que valem daqui para a frente

- **Editar contato**: canal nunca editável; origem só quando não veio de
  anúncio (medição); "apagar dado" é esvaziar, porque `gravar_campos` mescla
  com `||` e não remove chave (remover exigiria migration em produção).
- **Sessões**: limite por pessoa, não por IP/máquina. Último login ganha.
- **Avatar ilustrado só para a equipe.** Contato de cliente segue com iniciais
  (o CRM da Oderco abandonou ilustração em cliente por falta de gênero).

## Pendências abertas

- Ficha, modo de edição: o lápis do nome (`lead/identidade.tsx`) ainda existe
  ao lado do Editar; Gabriel prefere um só botão, avaliar tirar.
- Admin: preço de plano (`admin/tabela-de-planos.tsx`) não usa
  `CampoDeDinheiro` porque o servidor faz `Number()` inteiro.
- "Negócios" ainda aparece em Relatórios ("Negócios ganhos") e no bloco
  "Negócios parados" do Início; Gabriel não decidiu.
- Fase 2 do plano: faltam Etiquetas, Chaves/API, Acervo, Configurar e os 9
  specs e2e existentes (um por vez, **sem** o dev server rodando: o
  Playwright sobe o próprio `next dev` na 3100).
- Antigas do handoff anterior: permissão `vendas`/`venda_itens` para
  `autofluxos_dados` (migration em produção, pedir autorização);
  `painel.test.ts` com ordem antiga; cartão de negócio sem dono na PCYES.

## Ambiente local: o que já custou tempo

- O banco local estava em `0118` com a `0102` aplicada sem registro. Foi
  recriado com `npx supabase db reset --local` (só local). Se faltar
  migration de novo, é o mesmo caminho.
- `scripts/ux-local/cadastro.mjs` foi corrigido ("Nome da organização").
  Conta de teste: `revisao@local.test` / `senha-local-123456`, cliente
  `ab7ec604-8d54-4846-8222-15cbb887762f`. O limite de 3 aparelhos derruba a
  `.ux-local/sessao.json` se você logar em vários contextos: rode
  `node scripts/ux-local/entrar.mjs` de novo.
- `seed-vendas.mts` quebra (`quadro_id = ''`); `seed-relatorios.mts` cria uma
  segunda conta. O seed não tem mensagens: para testar conversa, insira em
  `messages` (`direcao` é `entrada`/`saida`).
- Dev server em background morre no limite de tempo da ferramenta: suba com
  `timeout` longo. `tsc` acusa erros em `.next/dev/types` com o dev rodando;
  filtre `grep -v "^.next"`.
- Playwright: a barra flutuante da ficha cobre o fim da página; nos testes,
  `dispatchEvent('click')`.
- **Token da Hostinger**: está em `~/dev/gabriel/radar-ofertas/.env`, não em
  `4yu-apps/radar-ofertas/` como diz o `4yu-apps/CLAUDE.md`. Alterar DNS
  exige autorização explícita do Gabriel (o classificador bloqueia sem ela).
