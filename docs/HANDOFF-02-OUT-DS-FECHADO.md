# Handoff 02/out/2026: DS da casca fechado (sequência do HANDOFF-02-OUT-DS-CASCA)

Para o próximo agente. Tudo abaixo está em produção (`7a9e872`, `6dea9e0`).
Decisões e porquês em `docs/DECISIONS.md`, entradas de 02/out.

## O que existe agora (use, não reescreva)

| Peça | Onde | Regra |
|---|---|---|
| Botão | `globals.css` "A escala de botão", `design/botao.tsx` | `botao-sm/md/lg` + `botao-primario/secundario/fantasma/perigo` ou `quadro-tool`. Não escreva `px/py/text` em botão. |
| Topo | `design/cabecalho-da-tela.tsx` | ações em `topo-acoes` saem em lg sozinhas; no celular descem para baixo do título. |
| Busca + filtros | `design/barra-de-lista.tsx`, `design/campo-de-busca.tsx` | fora do cartão, logo abaixo do topo. `acoes` vai na mesma linha, à direita. |
| Menu suspenso | `design/menu-suspenso.tsx` dentro de `PopoverDoQuadro` | `GrupoDoMenu`, `ItemDoMenu`, `ItemMarcavel`. |
| Alternador | `design/alternador.tsx`, `.alternador` | toda troca de modo. Desenho = "Quadro \| Lista" de Negócios (o dono escolheu). |
| Caixa de marcar | `.caixa-de-marcar` | nenhum `accent-[...]`. |
| Pílula / Badge | `design/pilula.tsx` | badge sempre sólido com texto branco. |
| Tabela | `design/tabela.tsx` | a de Contatos; `admin/partes.tsx` só reexporta. |

## Pendências reais

- **Pedidos do contato na Inbox** (`listarPedidosDaPessoa`, `acaoListarPedidosDoContato`):
  busca por CPF/e-mail da ficha porque `/V1/orders` não filtra por telefone.
  **Não testado contra a PCYES.** Conferir com uma conversa real que tenha CPF
  coletado; se a ficha da PCYES guardar o CPF com outro nome de campo, ajuste
  o padrão em `campoDaFicha` (`acoes-pedido-do-inbox.ts`).
- Busca automática de pedido (`05ba70d`) também segue sem prova na loja real.
- Hidratação do botão de perfil: não reproduziu (desktop e 390px, console limpo).
- Ainda escritos à mão, fora da escala: chips de recorte de Atividades
  (Vencidas/Hoje...), botões dentro do painel de pedido e de seletores da Inbox,
  esqueleto de abas de Transmissões (ainda sublinhado).

## Local

- Usuário `revisao@local.test` no banco **local** virou admin com 2FA marcado,
  para ver `/admin/*`. Produção intocada.
- `node scripts/ux-local/prints.mjs` só fotografa rotas da conta; para `/admin`
  e cliques, escreva um script descartável e apague depois.
