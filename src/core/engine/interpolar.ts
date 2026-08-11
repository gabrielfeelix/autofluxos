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
export function interpolar(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, chave: string) => {
    return vars[chave] ?? ''
  })
}

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
