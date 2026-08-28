/**
 * Troca `{{variavel}}` pelo valor coletado na conversa.
 *
 * Variável que não existe vira string vazia, de propósito: é melhor mandar
 * "Obrigado, !" do que "Obrigado, {{nome}}!". O primeiro é esquisito, o segundo
 * denuncia que tem um robô mal configurado do outro lado.
 *
 * O validador avisa sobre variável desconhecida na hora de publicar — o lugar
 * certo de pegar isso é no editor, não na frente do cliente.
 */
export function interpolar(
  texto: string,
  vars: Record<string, string>,
  escapar: Escape = comoTexto,
): string {
  return texto.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, chave: string) => {
    return escapar(vars[chave] ?? '')
  })
}

/**
 * Como o valor entra no texto.
 *
 * Numa mensagem de WhatsApp, o valor é só texto e não escapa nada. Mas o nó de
 * API interpola dentro de **estruturas** — uma URL, um corpo JSON, um cabeçalho
 * — e ali o conteúdo tem sintaxe. O que a pessoa digitou é entrada de fora: sem
 * escapar, ela deixa de preencher um campo e passa a escrever a requisição.
 *
 * Isso não é hipótese. Alguém respondendo `x", "aprovado": true, "y": "z` num
 * corpo JSON acrescenta campos à chamada que vai para o sistema do cliente.
 */
export type Escape = (valor: string) => string

/** O padrão: o valor é texto e vai como está. */
export const comoTexto: Escape = (valor) => valor

/**
 * Para um pedaço de URL. Codifica `&`, `?`, `#`, `/` e afins, então a resposta
 * de alguém não consegue acrescentar parâmetro nem subir de diretório.
 */
export const comoUrl: Escape = (valor) => encodeURIComponent(valor)

/**
 * Para dentro de uma string JSON. Usa o próprio `JSON.stringify` e tira as
 * aspas das pontas — as aspas quem põe é quem escreveu o corpo, e é justamente
 * por isso que o validador exige que a variável esteja entre elas.
 */
export const comoJson: Escape = (valor) => JSON.stringify(valor).slice(1, -1)

/**
 * Para valor de cabeçalho HTTP. Tira quebra de linha e caractere de controle:
 * com eles, um valor vira cabeçalho novo — a injeção clássica de HTTP.
 */
// eslint-disable-next-line no-control-regex
export const comoCabecalho: Escape = (valor) => valor.replace(/[\u0000-\u001F\u007F]/g, ' ')

/** Lista as variáveis citadas num texto. Usado pelo validador. */
export function variaveisCitadas(texto: string): string[] {
  const achadas = texto.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)
  return [...new Set([...achadas].map((m) => m[1] as string))]
}

/**
 * Normaliza para comparar o que a pessoa digitou com o rótulo de uma opção.
 * "Orçamento" e "orcamento" têm que casar — ninguém digita acento no WhatsApp.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

/**
 * Um pedaço de texto: literal, citação de variável, ou o engano de uma chave só.
 *
 * `chave-simples` existe para o editor pintar de vermelho **o pedaço errado**.
 * Antes o erro só aparecia numa frase embaixo do campo, e quem lia não sabia
 * qual das quatro linhas do texto tinha o problema.
 */
export type PedacoDeTexto =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'variavel'; texto: string; nome: string }
  | { tipo: 'chave-simples'; texto: string; nome: string }

/**
 * Fatia o texto em literais, citações de variável e chaves simples.
 *
 * Existe para o editor **mostrar** que `{{nome}}` não é texto comum, e que
 * `{nome}` de uma chave só não é variável nenhuma. Escrito como fatia e não como
 * "troca por HTML" de propósito: quem monta o realce é o React, com elementos de
 * verdade — devolver marcação daqui viraria `dangerouslySetInnerHTML` sobre
 * texto que a pessoa digitou, que é XSS servido pela porta da frente.
 *
 * Usa **o mesmo padrão** de `interpolar` e `variaveisCitadas`. Não é
 * coincidência: se o realce reconhecesse mais coisa que o motor, o editor
 * pintaria de azul um `{{ nome }}` que a conversa mandaria literal — e a pessoa
 * confiaria na cor. Pelo mesmo motivo `chavesSimplesCitadas` sai **daqui**:
 * realce que reconhece coisa diferente do validador é o defeito que os dois
 * vieram consertar.
 */
export function fatiarVariaveis(texto: string): PedacoDeTexto[] {
  /*
   * A máscara troca cada citação de chave dupla por espaços **do mesmo
   * tamanho**. Isso faz duas coisas de uma vez: o miolo de `{{nome}}` deixa de
   * ser lido como `{nome}` (senão todo fluxo correto ficaria vermelho), e os
   * índices continuam valendo no texto original, que é o que permite fatiar.
   *
   * Máscara larga de propósito — qualquer `{{…}}`, inclusive o que `interpolar`
   * recusa (`{{1abc}}`): ali o problema é outro, e marcar duas vezes confunde.
   */
  const mascara = texto.replace(/\{\{[^{}]*\}\}/g, (achado) => ' '.repeat(achado.length))

  const marcas: PedacoDeTexto[] = []
  const onde: number[] = []

  for (const achado of texto.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)) {
    marcas.push({ tipo: 'variavel', texto: achado[0], nome: achado[1] as string })
    onde.push(achado.index)
  }
  for (const achado of mascara.matchAll(/\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}/g)) {
    marcas.push({
      tipo: 'chave-simples',
      texto: texto.slice(achado.index, achado.index + achado[0].length),
      nome: achado[1] as string,
    })
    onde.push(achado.index)
  }

  const ordem = marcas.map((_, i) => i).sort((a, b) => (onde[a] as number) - (onde[b] as number))

  const pedacos: PedacoDeTexto[] = []
  let cursor = 0
  for (const i of ordem) {
    const inicio = onde[i] as number
    const marca = marcas[i] as PedacoDeTexto
    if (inicio > cursor) pedacos.push({ tipo: 'texto', texto: texto.slice(cursor, inicio) })
    pedacos.push(marca)
    cursor = inicio + marca.texto.length
  }

  if (cursor < texto.length) pedacos.push({ tipo: 'texto', texto: texto.slice(cursor) })
  return pedacos
}

/**
 * Lista os `{nome}` de **uma chave só** — o engano de digitação que sai literal.
 *
 * O motor só troca `{{nome}}`. Com uma chave, `interpolar()` não reconhece, o
 * texto viaja como está, e o aluno lê *"reagendar sua aula para dia
 * {dias_reposicao}"*. Nada estoura: não é variável desconhecida (não é variável
 * nenhuma), então o aviso de `VARIAVEL_DESCONHECIDA` também não pega.
 *
 * Veio de quem monta fluxo com cliente na frente escrevendo exatamente assim, e
 * é o pior tipo de defeito que existe aqui — silencioso, e visível justo no
 * bloco de confirmação, que é o mais lido da conversa.
 *
 * Sai de `fatiarVariaveis` para o validador e o realce nunca discordarem: é a
 * mesma passada, com a mesma máscara.
 */
export function chavesSimplesCitadas(texto: string): string[] {
  const achadas = fatiarVariaveis(texto).filter((p) => p.tipo === 'chave-simples')
  return [...new Set(achadas.map((p) => p.nome))]
}
