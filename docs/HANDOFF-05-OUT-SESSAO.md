# Handoff 05/out/2026: rodada de ajustes de UI, IA, login e MGM/Verandi

Tudo abaixo está no `main` e publicado (push na `main` publica na Vercel, nos
dois projetos). **Nenhuma tela desta rodada foi vista em print**: o Docker
Desktop estava desligado, sem Supabase local não sobe `scripts/ux-local/dev.sh`.
O primeiro passo da próxima sessão, com o Docker ligado, é tirar os prints em
1440 e 390 das telas da tabela "Conferir na tela".

## O que entrou (AutoFluxos)

| Commit | O quê |
|---|---|
| `0228bad`, `18a415b` | IA: "já fiz o pagamento" não é mais `FORA_DO_ASSUNTO`; aviso com pergunta junto atende a pergunta (regra 3 de `src/server/ia/prompt.ts`) |
| `4314210` | Relatórios e Vendas em `Miolo largura="toda"` |
| `4d86876`, `341c64a` | Configurações › Pessoas: abas Usuários / Equipes (`?aba=equipes`), "+ Criar equipe" em modal (`components/conta/gerenciar-equipes.tsx`) |
| `d06358b` | "Dar acesso" virou "Adicionar usuário" |
| `3d5285b` | **Segurança:** criar usuário para outra pessoa trocava a sessão de quem criava. Ver abaixo |
| `3ed6f21` | Configurações: menu e tela com rolagens separadas (`ajustes/layout.tsx`) |
| `f97d77a` | Ilustração animada no Inbox vazio (`IlustracaoInbox`, keyframes `ilu-digita/escreve/lida`) |
| `1294c50`, `9d707d8` | Menu da mensagem sai da seta, reações rápidas por cima, "+" abre a grade inteira |
| `e0348c0` | Fonte Noto Color Emoji no fim de todas as pilhas (`app/layout.tsx`) |
| `70c4430` | Painel de emoji completo (1.906, `emojibase-data` pt, gerado por `scripts/gerar-emojis.mjs` em `src/core/emojis-completos.json`); `core/emojis.ts` antigo apagado |
| `2c8ff83` | `type: 'revoke'` (cliente apagou mensagem): motor ignora, bolha diz "Esta mensagem foi apagada" |
| `cdd8668`, `4e53ff2` | "⋮" e "?" da etapa claros na casca. O segundo conserta a regressão do primeiro: `:not()` somava especificidade e pintava de preto o título do seletor de funil. Usar `:where()` |
| `70d3733` | Barra de rolagem: borda transparente + `background-clip`, sem contorno branco |
| `1214c49` | `core/contatos/nome-para-mostrar.ts`: contato sem nome vira "Visitante do site" ou telefone legível |
| `df78bbd` | Início em `largura="toda"` |

## O bug de segurança (`3d5285b`)

`signUpEmail` do Better Auth abre a sessão da pessoa criada e o `nextCookies()`
grava o cookie na resposta da Server Action. "Adicionar usuário" trocava o
administrador pela pessoa nova. Conserto em
`src/server/cadastro-por-outra-pessoa.ts` (restaura os cookies e revoga a sessão
nova), usado em `acoes-pessoas.ts`, `acoes-admin.ts` e `acoes-conta.ts`.
**Não desligue `autoSignIn` global**: com ele `false`, a biblioteca responde
sucesso falso para e-mail repetido e o cadastro público (que entra logo depois)
quebra. Os testes desses arquivos são de integração e não rodaram (sem Docker).

Efeito colateral real: o dono navegou como o Rodrigo (`rodrigo.leite@oderco.com.br`)
em 05/out; o que ele fez nesse intervalo ficou registrado como do Rodrigo.

## MGM / Verandi

- O bot da MGM ("Fluxo - Atendimento", v15) reconhece aluno por
  `GET /pessoas?telefone=`. Quase ninguém era reconhecido: 79 de 88 telefones
  da Verandi estavam gravados com máscara pela planilha importada.
- Verandi `83427a1`: `formasGuardadas` (busca também a forma mascarada).
- Verandi `64fa64f`: busca da lista de Alunos por trecho seguido de dígitos
  (`digitosDaBusca`, "759" acha `44998775978`, "779" não).
- **Dado corrigido em produção** (autorizado pelo dono): os 79 telefones de
  `app_verandi.pessoa` regravados só com dígitos. Backup dos valores originais:
  `4yu-apps/.secrets/backups/2026-10-05-verandi-telefones-com-mascara.json`.
- Sobra: SARAH CARVALHO com `119629249263` (um dígito a mais). Só a ficha resolve.

## Conferir na tela (nada disto foi visto)

Pessoas (abas, modal de equipe, tabela), Configurações (duas rolagens),
Relatórios e Início largos, Inbox vazio (animação), menu e reações da mensagem,
painel de emoji, bolha de mensagem apagada, cabeçalho do funil (título branco,
"⋮" e "?" claros), barra de rolagem na casca, cartão de visitante do site.

## Em aberto, decisão do dono

- **IA da PCYES:** proposta de inverter o peso de `FORA_DO_ASSUNTO` (recusar só
  o claramente alheio) e montar bateria com conversas reais para comparar
  `gemini-3.1-flash-lite` com `gemini-3.6-flash`. O dono disse "sem mudanças
  ainda". Modelos em `src/server/ia/gemini.ts`; estão no free tier.
- Espaço vazio à direita do Início na largura nova: sugerido um resumo do dia.
- "Reações recentes" no painel de emoji: os recentes existem (localStorage), mas
  não aparecem na linha das seis reações rápidas.
