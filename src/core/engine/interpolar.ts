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
