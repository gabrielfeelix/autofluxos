/**
 * O que dá para ler do `payload` cru que a Meta manda.
 *
 * `messages.payload` guarda a mensagem **inteira** como ela chegou. Quase tudo
 * que a conversa mostra já saiu dali uma vez; estes dois são os que faltavam, e
 * cuja ausência deixava a bolha vazia: quem mandava um lugar ou um cartão de
 * contato via "📍 localização" na fila e **nada** ao abrir.
 *
 * Mora em `core/` pelo mesmo motivo de `core/reacoes.ts`: é regra sobre dados,
 * sem banco e sem rede, e regra assim tem que dar para testar sem subir nada.
 *
 * Tudo aqui lê defensivamente. O `payload` é a única coluna do produto que
 * guarda formato de terceiro, e uma linha antiga, de antes de um campo
 * existir, não pode derrubar a conversa inteira.
 */

/**
 * Um lugar que a pessoa mandou pelo WhatsApp.
 *
 * `nome` e `endereco` só vêm quando ela escolhe um lugar do mapa; arrastando o
 * pino, chegam só as coordenadas. Por isso os dois são opcionais e a bolha
 * precisa saber desenhar o caso mudo.
 */
export type LocalDaMensagem = {
  latitude: number
  longitude: number
  nome?: string
  endereco?: string
}

/**
 * Um cartão de contato encaminhado. Uma mensagem pode trazer vários.
 *
 * Só nome e telefones: é o que resolve a pergunta de quem atende ("me manda o
 * contato do responsável"). O resto do vCard da Meta, aniversário, empresa,
 * endereço, entra se alguém pedir, e hoje ninguém pediu.
 */
export type CartaoDeContato = {
  nome: string
  telefones: string[]
}


/**
 * O lugar guardado no `payload`, quando a mensagem é uma localização.
 *
 * O `payload` de entrada é a mensagem **crua** da Meta, então isto lê o formato
 * dela: `location: { latitude, longitude, name?, address? }`. Ler defensivamente
 * não é zelo excessivo, o mesmo campo guarda coisas diferentes conforme a
 * mensagem, e uma linha antiga não pode derrubar a conversa inteira.
 */
export function localDoPayload(payload: unknown): LocalDaMensagem | null {
  if (!payload || typeof payload !== 'object') return null
  const local = (payload as Record<string, unknown>).location
  if (!local || typeof local !== 'object') return null

  const bruto = local as Record<string, unknown>
  const latitude = coordenada(bruto.latitude)
  const longitude = coordenada(bruto.longitude)
  if (latitude === null || longitude === null) return null

  return {
    latitude,
    longitude,
    ...(typeof bruto.name === 'string' && bruto.name.trim() ? { nome: bruto.name } : {}),
    ...(typeof bruto.address === 'string' && bruto.address.trim()
      ? { endereco: bruto.address }
      : {}),
  }
}

/**
 * Uma coordenada, ou `null` se não der para chamar aquilo de coordenada.
 *
 * **`Number('')` é zero**, e (0, 0) é um ponto de verdade, fica no Atlântico,
 * na altura do Golfo da Guiné. Um `Number.isFinite` sozinho aceitaria campo
 * vazio e plantaria um pino no meio do oceano, que é pior do que não mostrar
 * lugar nenhum: parece informação.
 *
 * Texto é aceito porque a Meta às vezes manda assim, e recusar seria perder o
 * lugar por causa do formato.
 */
function coordenada(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor !== 'string' || valor.trim() === '') return null

  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

/**
 * Os cartões de contato do `payload` (`contacts[]` da Meta).
 *
 * A Meta manda o nome em `name.formatted_name` e os telefones em `phones[]`,
 * cada um com `phone` (como está escrito) e `wa_id` (o número no WhatsApp).
 * Preferimos o `phone`: é o que a pessoa vê no celular dela, e é o que quem
 * atende vai ditar em voz alta.
 */
export function cartoesDoPayload(payload: unknown): CartaoDeContato[] {
  if (!payload || typeof payload !== 'object') return []
  const lista = (payload as Record<string, unknown>).contacts
  if (!Array.isArray(lista)) return []

  const cartoes: CartaoDeContato[] = []
  for (const cru of lista) {
    if (!cru || typeof cru !== 'object') continue
    const item = cru as Record<string, unknown>

    const nomeCru = (item.name as Record<string, unknown> | undefined)?.formatted_name
    const nome = typeof nomeCru === 'string' && nomeCru.trim() ? nomeCru.trim() : 'contato'

    const telefones: string[] = []
    if (Array.isArray(item.phones)) {
      for (const tel of item.phones) {
        if (!tel || typeof tel !== 'object') continue
        const t = tel as Record<string, unknown>
        const numero = typeof t.phone === 'string' ? t.phone : typeof t.wa_id === 'string' ? t.wa_id : null
        if (numero?.trim()) telefones.push(numero.trim())
      }
    }

    cartoes.push({ nome, telefones })
  }
  return cartoes
}
