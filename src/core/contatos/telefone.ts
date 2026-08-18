/**
 * Casar o telefone da planilha do cliente com o `wa_id` que a Meta manda.
 *
 * Isto parece função de formatação e é o núcleo da conciliação. O WhatsApp
 * identifica a pessoa por um número; a planilha do cliente tem o mesmo número
 * escrito de seis jeitos diferentes, às vezes sem DDI, às vezes com máscara,
 * e — no Brasil — **às vezes com o nono dígito e às vezes sem**.
 *
 * O nono dígito é o caso que quebra tudo se for ignorado. Celulares brasileiros
 * ganharam um `9` na frente do número, mas o `wa_id` de contas antigas continua
 * vindo sem ele. O mesmo aparelho aparece como `5511987654321` numa conversa e
 * `551187654321` na planilha, e uma comparação literal diria que são duas
 * pessoas.
 *
 * Este módulo mora em `core/` porque é regra, não infraestrutura: não faz rede,
 * não conhece banco e é testável sozinho.
 */

/** Só os dígitos. Tira `+`, parênteses, hífen, espaço e o que mais vier. */
export function digitos(bruto: string): string {
  return bruto.replace(/\D+/g, '')
}

const DDI_BRASIL = '55'

/**
 * As formas em que este telefone pode estar gravado, para casar contra `wa_id`.
 *
 * Devolve **lista**, não um valor único, e é essa a decisão que resolve o nono
 * dígito: em vez de eleger uma forma canônica e torcer para o outro lado ter
 * escolhido a mesma, geramos todas as que significam o mesmo aparelho e
 * procuramos por qualquer uma.
 *
 * Lista vazia = não dá para casar com segurança. É o caso do número sem DDD:
 * `98765-4321` pode ser de onze estados, e chutar o DDD do cliente casaria a
 * conversa de uma pessoa com o cadastro de outra. Vazio vira "pendente", que é
 * uma resposta honesta; um palpite errado é indistinguível de acerto.
 */
export function chavesDoTelefone(bruto: string): string[] {
  const so = digitos(bruto)
  if (so === '') return []

  // `+55 (11) 98765-4321` chega como 5511987654321. Sem DDI, 11987654321.
  const semDdi = so.startsWith(DDI_BRASIL) && (so.length === 12 || so.length === 13)
    ? so.slice(2)
    : so

  // 10 = DDD + 8 dígitos (fixo, ou celular antigo). 11 = DDD + 9 (celular).
  // Fora disso não é telefone brasileiro completo.
  if (semDdi.length !== 10 && semDdi.length !== 11) {
    // Pode ser número estrangeiro já com DDI — 12+ dígitos que não começam com
    // 55. Aí não há nono dígito para resolver e a única chave é ele mesmo.
    if (!so.startsWith(DDI_BRASIL) && so.length >= 11) return [so]
    return []
  }

  const ddd = semDdi.slice(0, 2)
  const numero = semDdi.slice(2)
  const variantes = new Set<string>([`${DDI_BRASIL}${ddd}${numero}`])

  if (numero.length === 9 && numero.startsWith('9')) {
    // Com o nono: gera também a forma antiga, sem ele.
    variantes.add(`${DDI_BRASIL}${ddd}${numero.slice(1)}`)
  } else if (numero.length === 8 && /^[6-9]/.test(numero)) {
    // Sem o nono, e o primeiro dígito diz que é celular (6 a 9). Fixo começa
    // com 2 a 5 e nunca ganhou nono dígito — inventar um para ele criaria uma
    // chave que não existe em lugar nenhum.
    variantes.add(`${DDI_BRASIL}${ddd}9${numero}`)
  }

  return [...variantes]
}

/**
 * A forma preferida para mostrar e guardar: DDI + DDD + número, sem máscara.
 *
 * `null` quando não dá para normalizar — mesmo critério de `chavesDoTelefone`.
 * Quando há duas variantes, a com nono dígito ganha: é a forma válida hoje, e
 * é a que um número novo terá.
 */
export function telefoneCanonico(bruto: string): string | null {
  const chaves = chavesDoTelefone(bruto)
  if (chaves.length === 0) return null
  return chaves.reduce((maior, atual) => (atual.length > maior.length ? atual : maior))
}

/** `+55 (11) 98765-4321`, para ler na tela. Devolve o cru se não reconhecer. */
export function telefoneLegivel(bruto: string): string {
  const so = digitos(bruto)
  const semDdi = so.startsWith(DDI_BRASIL) && (so.length === 12 || so.length === 13)
    ? so.slice(2)
    : so

  if (semDdi.length !== 10 && semDdi.length !== 11) return bruto

  const ddd = semDdi.slice(0, 2)
  const numero = semDdi.slice(2)
  const corte = numero.length === 9 ? 5 : 4
  return `+55 (${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`
}
