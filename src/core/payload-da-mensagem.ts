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

/** Uma escolha que o bot ofereceu num menu de botões ou de lista. */
export type OpcaoDoBot = { id: string; rotulo: string }

/**
 * O menu que acompanhou uma mensagem do bot, como a pessoa viu no celular.
 *
 * `escolhida` é o `id` da opção que ela tocou. Ausente = ninguém tocou em
 * nenhuma, e isso é informação: o menu expirou, ou ela escreveu em vez de
 * tocar.
 */
export type MenuDoBot = {
  formato: 'botoes' | 'lista'
  opcoes: OpcaoDoBot[]
  escolhida?: string
}

/**
 * O menu gravado no `payload` da saída (`opcoes` + `formato`, ver o `case
 * 'enviar_opcoes'` em `receber-mensagem.ts`).
 *
 * Sempre esteve no banco. O Inbox mostrava só a pergunta, e quem lia a
 * conversa não sabia o que a pessoa tinha na tela para escolher.
 */
export function menuDoPayload(payload: unknown): MenuDoBot | null {
  if (!payload || typeof payload !== 'object') return null
  const cru = payload as Record<string, unknown>
  if (!Array.isArray(cru.opcoes)) return null

  const opcoes: OpcaoDoBot[] = []
  for (const item of cru.opcoes) {
    if (!item || typeof item !== 'object') continue
    const { id, rotulo } = item as Record<string, unknown>
    if (typeof id === 'string' && typeof rotulo === 'string' && rotulo.trim()) {
      opcoes.push({ id, rotulo: rotulo.trim() })
    }
  }
  if (opcoes.length === 0) return null
  return { formato: cru.formato === 'lista' ? 'lista' : 'botoes', opcoes }
}

/** O `id` da opção que a pessoa tocou, quando a entrada é um toque em menu. */
export function toqueDoPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const interativo = (payload as Record<string, unknown>).interactive
  if (!interativo || typeof interativo !== 'object') return null
  const { button_reply, list_reply } = interativo as Record<string, unknown>
  for (const resposta of [button_reply, list_reply]) {
    const id = (resposta as Record<string, unknown> | undefined)?.id
    if (typeof id === 'string') return id
  }
  return null
}

/**
 * Casa cada toque com o menu que ele respondeu.
 *
 * Pelo `id` da opção, e não pelo `context.id` da Meta: a saída do bot nem
 * sempre guarda o `wa_message_id`, e sem ele o `context` não aponta para nada
 * do histórico. O toque vai para o menu **mais recente, ainda sem resposta,
 * que tem aquela opção**. Um menu respondido não recebe segundo toque: o
 * fluxo já andou, e um toque atrasado no botão velho não muda o que ela
 * escolheu ali.
 *
 * `mensagens` em ordem cronológica. Devolve `id da mensagem → id da opção`.
 */
export function casarToques(
  mensagens: { id: string; direcao: string; payload: unknown }[],
): Map<string, string> {
  const abertos: { id: string; ids: Set<string> }[] = []
  const escolhas = new Map<string, string>()
  for (const m of mensagens) {
    if (m.direcao === 'saida') {
      const menu = menuDoPayload(m.payload)
      if (menu) abertos.push({ id: m.id, ids: new Set(menu.opcoes.map((o) => o.id)) })
      continue
    }
    const toque = toqueDoPayload(m.payload)
    if (toque === null) continue
    for (let i = abertos.length - 1; i >= 0; i--) {
      const aberto = abertos[i]
      if (aberto?.ids.has(toque)) {
        escolhas.set(aberto.id, toque)
        abertos.splice(i, 1)
        break
      }
    }
  }
  return escolhas
}

/**
 * O que era a mensagem que a Meta marcou como `unsupported`, quando ela diz.
 *
 * Versões novas da Cloud API mandam `unsupported.type`. Só os tipos cujo nome
 * em português não deixa dúvida viram frase; tipo desconhecido volta `null` e
 * a bolha fica com o aviso genérico, que é verdade sempre. Chutar o nome
 * errado seria pior que não dizer.
 */
export function motivoDoNaoSuportado(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const tipo = ((payload as Record<string, unknown>).unsupported as Record<string, unknown> | undefined)?.type
  if (typeof tipo !== 'string') return null
  const nomes: Record<string, string> = {
    edit: 'mensagem editada',
    poll: 'enquete',
    poll_creation: 'enquete',
    view_once: 'visualização única',
    event: 'evento',
    event_creation: 'evento',
  }
  return nomes[tipo] ?? null
}
