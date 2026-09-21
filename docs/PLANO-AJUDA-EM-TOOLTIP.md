# Tarefa: a explicação sai de baixo do campo e vai para o "?"

Pedido do dono, 21/set/2026. **Ainda não implementado**, este documento é a
tarefa escrita para quem for executar.

## O que está errado hoje

Abrir um bloco no editor mostra, embaixo de quase todo campo, um parágrafo
cinza explicando o campo. São ~51 desses só no `components/editor/painel.tsx`.
O efeito é o painel ficar duas vezes mais alto do que o necessário, com o campo
seguinte empurrado para fora da vista, e a explicação sendo relida por alguém
que já sabe, toda vez.

Exemplo do próprio painel (campo "valor" de uma opção):

> deixe vazio se o texto do botão já serve para o resto do fluxo
> Com isto preenchido, cada opção ganha um campo de **valor**: a pessoa lê
> "Vídeo institucional" e a API recebe `institucional`. Sem isto, o fluxo
> guarda o próprio texto do botão.

O segundo problema é o `?` que já existe: em `painel.tsx` ele é um `<a>` que
**abre `/ajuda#secao` em outra aba**. Sair do desenho no meio de montar um
bloco é o oposto de ajudar.

## O que fazer

1. **Nenhum texto de ajuda solto embaixo de campo.** Todo campo e toda opção
   passa a ter um `?` ao lado do **título**, e a explicação mora atrás dele.
2. O `?` abre **no hover e no clique**, sem navegar. Conteúdo curto cabe no
   balão; conteúdo com exemplo (como o de cima) abre um modal.
3. **No rodapé do modal**, e só lá, um link: *"Ficou com dúvidas? Veja a nossa
   Ajuda"*, apontando para a seção correspondente de `/ajuda`. Clicar é opção
   de quem quis; ninguém é levado para fora sem pedir.

## Onde mexer

| Arquivo | O que muda |
|---|---|
| `components/design/ajuda-do-campo.tsx` | já é o `?` com balão (`Dica`). Ganha `detalhes` (o corpo do modal) e `secao` (o link do rodapé). É a peça central. |
| `components/design/dica.tsx` | segue servindo o texto curto do hover; não muda. |
| `components/editor/painel.tsx` | apagar o `Ajuda` local (o `<a>` para `/ajuda#`) e usar `AjudaDoCampo`. Migrar os ~51 parágrafos de ajuda para `detalhes`. É o grosso do trabalho. |
| `components/cliente/*`, `components/lead-crm/*` | mesmo tratamento, em menor quantidade. |

## O que não fazer

- Não apagar o texto das explicações: elas estão certas e foram escritas com
  cuidado. O que muda é **onde** elas aparecem.
- Não transformar o `?` em link. Link é só o rodapé do modal.
- Não deixar campo sem `?`: o padrão passa a ser "todo campo tem o seu", e a
  falta de um vira defeito visível.
