# Base de conhecimento da IA

Criada em 5/nov/2026 para a demonstração da Solar Buy-Side (`docs/DEMO.md`).

## Por que existe

O "Sobre a empresa" cabe 6.000 caracteres. O Manual Solar Buy-Side tem 161
páginas (cerca de 200 mil caracteres) e o Código do Vendedor Consultivo, 36.
Testada como cliente exigente, a IA só com o "Sobre a empresa" inventou 6 de
10 respostas: disse que o manual servia para grupo A (é grupo B), que havia
nota fiscal, que não havia número de propostas para comparar (são até seis) e
desconversou sobre bateria e Fio B, que têm capítulo próprio.

Mandar o manual inteiro em cada mensagem não serve, ainda mais com modelo
gratuito (limite de tokens por minuto). A base guarda o material em trechos e
a IA pesquisa só o que a pergunta pede.

## Como funciona

- Tabela `conhecimento_trechos` (migration 0168): conta, fonte, seção,
  página, texto e `busca` (o texto sem acento e em minúsculas). Só o servidor
  lê e escreve.
- Busca de texto do Postgres em português (radical das palavras), pela RPC
  `buscar_conhecimento`. Sem `unaccent`, que é extensão global do projeto
  dividido com a Verandi: o acento sai em `src/core/conhecimento.ts`, dos dois
  lados. A consulta é palavra `[a-z0-9]` unida por OU, montada no servidor.
- Consulta da IA `consultar_material` (`src/core/ferramentas.ts`, executada em
  `src/server/conhecimento.ts`): devolve até 5 trechos. No editor de fluxo,
  bloco de IA, grupo "No material da empresa".
- A busca é por conta, não por bloco: toda IA da conta com a consulta marcada
  pesquisa o mesmo material.

## Como subir um material

```bash
python3 scripts/conhecimento/extrair_pdf.py <arquivo.pdf> "<nome da fonte>" trechos.json
npx tsx --conditions=react-server scripts/conhecimento/importar.mts <conta> trechos.json --gravar
```

Reimportar a mesma fonte troca os trechos dela inteiros.

## Trechos-mapa: o que o teste do Francis ensinou (5/nov/2026)

A busca por palavra não acha assunto escrito com outro nome ("BESS" contra
"bateria") e, sem trecho, a IA citou seção e página de memória: "10.2, p. 42"
para telhado (é 2.8, p. 29) e "28.4" para contrato (é 18.3 e 19.x). Duas
correções:

- `scripts/demo/conhecimento-solar-mapa.json`: um trecho por tema (fases,
  anexos, bateria, telhado, contrato, índice do Código), com seção, página e
  os sinônimos. Mapa de material novo: monte a partir de
  `select secao, min(pagina) ... group by secao`.
- Trecho que não vem de PDF (site, mapa) grava `pagina` nula, senão a IA cita
  "página 1". A regra do prompt: página só se veio num trecho desta resposta.

Reteste com as perguntas do Francis: 17 de 17 certas, depois de 4 rodadas.

## O que fica para depois

- Tela para o cliente subir o PDF sozinho (hoje é por script).
- Busca por significado (embedding), se a busca por palavra falhar em casos
  reais. A busca por palavra não custa nada e já acerta os termos do ramo.
- Material pago: a IA é instruída a resumir e citar a seção, nunca a
  transcrever capítulo, lista ou tabela. Isso é regra de prompt, não trava.
