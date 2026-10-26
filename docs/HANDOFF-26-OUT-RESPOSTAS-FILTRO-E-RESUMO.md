# Handoff 26/out/2026: Respostas com filtro por resposta e resumo no topo

## O pedido

Dois pontos na tela **Respostas** (`/clientes/<id>/respostas`), pedidos pelo
Gabriel para a pesquisa pós-compra da PCYES, mas valendo para qualquer
automação:

1. **Filtrar pela resposta de uma pergunta.** Exemplo: na automação da
   pesquisa, Frete = "Achei caro" mostra só quem reclamou do preço, com o
   comentário ao lado. Hoje a tela só filtra por automação, desfecho e busca
   por nome/telefone.
2. **Resumo no topo**: para cada pergunta de escolha da automação filtrada, a
   contagem e o percentual de cada opção. Exemplo: *Frete: 64% Bom preço e
   opções · 22% Achei caro · 14% Poucas opções*. Clicar numa opção do resumo
   aplica o filtro do ponto 1.

## Contexto: a pesquisa que vai usar isto (ainda não construída)

Template ao virar o pedido "Processando" no Magento, com 3 perguntas. Os
botões são as opções que o resumo vai contar:

- Experiência: Foi ótima / Foi ok / Tive um problema (+ comentário se problema)
- Pagamento: Foi fácil / Tive dificuldade (+ comentário se dificuldade)
- Frete: Bom preço e opções / Achei caro / Poucas opções (+ comentário se ruim)

Construa genérico. Para testar, use um fluxo qualquer com pergunta de opções
(um de exemplo ou do simulador), não dependa da pesquisa existir.

## Onde está o código

- Tela: `src/app/clientes/[clienteId]/respostas/page.tsx` (server component,
  filtros pela URL: `fluxo`, `busca`, `desfecho`, `pagina`; função que monta o
  endereço com outro filtro sem perder os demais, perto da linha 70).
- Dados: `src/server/repos/respostas.ts`. `paginarRespostas(filtro)` lê
  `sessions` (as respostas ficam em `sessions.vars`, jsonb, uma chave por
  `salvarEm`), `FiltroDeRespostas` é o tipo do filtro, `colunasDe()` decide as
  colunas. `contarRespostasPorVariavel()` (linha ~394) já percorre sessões de
  um fluxo com teto e é o modelo para o resumo.
- CSV: `src/app/api/clientes/[clienteId]/respostas/csv`. O filtro novo tem que
  valer no CSV também (quem filtra "Achei caro" e exporta espera só esses).

## Decisões já tomadas (não reabrir)

- **Filtro por resposta só com uma automação escolhida.** Sem `fluxo`, as
  perguntas de automações diferentes não se comparam; esconda o controle.
- **Parâmetros na URL**: `resposta=<variavel>` e `valor=<texto>`, no mesmo
  esquema dos outros filtros. Filtro no banco, não na página: PostgREST aceita
  `.eq('vars->>frete', 'Achei caro')`. A variável vem da URL: valide contra as
  variáveis do fluxo (ver `variaveisDoFluxo` / o grafo da versão) antes de
  usar, nunca interpole texto do usuário como caminho JSON sem conferir.
- **Quais perguntas entram no resumo**: só as de escolha. Descubra pelo grafo
  da versão publicada do fluxo: bloco `pergunta` com `opcoes` e `salvarEm`. As
  opções desenhadas são as categorias (aparecem mesmo com 0%); valor gravado
  que não é opção (texto livre, opção removida) soma em "Outras". Pergunta
  aberta (comentário) não entra no resumo, aparece só como coluna.
- **Resumo respeita os outros filtros** (período/desfecho/busca, se houver),
  menos o próprio filtro por resposta, senão a pergunta filtrada mostraria
  100% de uma opção.
- **Sem migration.** Conte em memória com teto, como
  `contarRespostasPorVariavel`. Se achar que precisa de RPC ou view, pare e
  leia `docs/BANCO-COMPARTILHADO.md` antes: o banco é dividido com a Verandi.

## Regras deste projeto que pegam nesta tarefa

- Next.js desta versão tem mudanças: leia `node_modules/next/dist/docs/` antes
  de mexer em rota ou searchParams (ver `AGENTS.md`).
- Antes de entregar UI: print local em 1440 e 390 de largura, com dado de
  verdade na tela. Layout na largura cheia, com a sidebar.
- Texto de tela em tom profissional de SaaS B2B, pt-BR, sem gíria. Nenhum
  travessão (o caractere "—") em arquivo nenhum que você abrir.
- Validação: `npx tsc --noEmit -p .` limpo e os testes só dos arquivos que
  mexeu (`npx vitest run <arquivo>`). Não rode a suíte inteira.
- Teste puro para a contagem e para a validação da variável vinda da URL.
- Commit e push na hora, juntando os commits da mesma frente. Push com o
  `GITHUB_TOKEN` do cofre:
  `set -a && . ../.secrets/4yu.env && set +a && git -c credential.helper= -c 'credential.helper=!f(){ echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f' push origin main`
- Depois do push, confira o deploy da Vercel (projeto `autofluxos`) como
  READY em segundo plano antes de dizer "no ar".
- Feature nova entra no mesmo dia em `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`,
  escrita como benefício.

## Pronto quando

- Com uma automação escolhida, o topo mostra o resumo das perguntas de
  escolha, com contagem e percentual, e clicar numa opção filtra a lista.
- O filtro aparece como pílula removível junto dos outros, sobrevive à
  paginação e vale no CSV.
- Sem automação escolhida, nada disso aparece e a tela segue como hoje.
- Prints 1440 e 390 conferidos, tsc limpo, push feito, deploy READY.
