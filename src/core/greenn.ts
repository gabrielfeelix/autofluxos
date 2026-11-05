/**
 * O aviso da Greenn, traduzido para o que o Dialogon faz com ele.
 *
 * O formato vem da documentação pública da Greenn (greenn.com.br/ajuda/vendo/webhook)
 * e do webhook que a plataforma da Solar Buy-Side já recebe
 * (`solarbuy-side-platform`, `apps/platform/src/app/api/greenn/webhook/route.ts`):
 *
 * ```
 * { type: 'sale', event: 'saleUpdated', oldStatus, currentStatus,
 *   sale: { id, method, amount, ... }, client: { name, email, cellphone, ... },
 *   product: { name, ... } }
 * ```
 *
 * **Leitura tolerante, de propósito.** A Greenn não versiona o corpo e a
 * plataforma do Francis já precisou aceitar o mesmo campo em mais de um lugar.
 * Cada dado é procurado em uma lista curta de caminhos, o primeiro preenchido
 * vence. Fica aqui, sem banco, para ser testável com o corpo cru.
 */

export type SituacaoDaGreenn =
  /** Venda paga: vira cliente, etiqueta "Comprou", sai do lembrete do boleto. */
  | 'paga'
  /** Boleto ou Pix gerado e ainda não pago: etiqueta "Pagamento pendente". */
  | 'aguardando'
  /** Reembolso ou chargeback: etiqueta "Reembolso", sai das campanhas. */
  | 'reembolso'

export type VendaDaGreenn = {
  situacao: SituacaoDaGreenn
  /** `currentStatus` cru, para a anotação. */
  status: string
  vendaId: string
  /** `BOLETO`, `PIX`, `CREDIT_CARD`... Vazio quando não veio. */
  metodo: string
  valor: number | null
  produto: string
  nome: string
  email: string
  telefone: string
}

function pegar(obj: unknown, caminhos: readonly string[]): string {
  for (const caminho of caminhos) {
    let atual: unknown = obj
    for (const parte of caminho.split('.')) {
      if (atual && typeof atual === 'object' && parte in (atual as Record<string, unknown>)) {
        atual = (atual as Record<string, unknown>)[parte]
      } else {
        atual = undefined
        break
      }
    }
    if (typeof atual === 'string' && atual.trim()) return atual.trim()
    if (typeof atual === 'number' && Number.isFinite(atual)) return String(atual)
  }
  return ''
}

const SITUACAO_DO_STATUS: Record<string, SituacaoDaGreenn> = {
  paid: 'paga',
  waiting_payment: 'aguardando',
  refunded: 'reembolso',
  chargedback: 'reembolso',
}

/**
 * A venda que o aviso descreve, ou `null` quando ele não pede nada daqui.
 *
 * `null` cobre assinatura (`contract`), carrinho abandonado (`lead`), venda
 * recusada e qualquer status que a Greenn venha a criar. Não é erro: a rota
 * responde 200 e a Greenn não reenvia.
 */
export function lerAvisoDaGreenn(corpo: unknown): VendaDaGreenn | null {
  if (!corpo || typeof corpo !== 'object') return null

  const tipo = pegar(corpo, ['type']).toLowerCase()
  if (tipo && tipo !== 'sale') return null

  const status = pegar(corpo, ['currentStatus', 'sale.currentStatus', 'sale.status', 'status']).toLowerCase()
  const situacao = SITUACAO_DO_STATUS[status]
  if (!situacao) return null

  const valorCru = pegar(corpo, ['sale.amount', 'sale.total', 'amount'])
  const valor = valorCru === '' ? null : Number(valorCru)

  return {
    situacao,
    status,
    vendaId: pegar(corpo, ['sale.id', 'saleId', 'sale.code', 'order_id']).slice(0, 60),
    metodo: pegar(corpo, ['sale.method', 'method']).toUpperCase().slice(0, 30),
    valor: valor !== null && Number.isFinite(valor) ? valor : null,
    produto: pegar(corpo, ['product.name', 'sale.product.name']).slice(0, 120),
    nome: pegar(corpo, ['client.name', 'customer.name', 'buyer.name', 'sale.client.name']).slice(0, 120),
    email: pegar(corpo, ['client.email', 'customer.email', 'buyer.email', 'sale.client.email', 'email'])
      .toLowerCase()
      .slice(0, 160),
    telefone: pegar(corpo, [
      'client.cellphone',
      'client.phone',
      'customer.cellphone',
      'customer.phone',
      'buyer.phone',
      'sale.client.cellphone',
    ]).slice(0, 40),
  }
}

/** As etiquetas que a integração aplica, pelo nome: a conta pode recolorir à vontade. */
export const ETIQUETAS_DA_GREENN = {
  paga: 'Comprou',
  aguardando: 'Pagamento pendente',
  reembolso: 'Reembolso',
} as const satisfies Record<SituacaoDaGreenn, string>

/** O nome da etapa do funil que recebe quem pagou, quando a conta tiver uma. */
export const ETAPA_DE_QUEM_COMPROU = 'comprou'

/** Uma linha para a ficha do contato. */
export function frasesDaVenda(venda: VendaDaGreenn): string {
  const oQue = {
    paga: 'compra paga',
    aguardando: `${venda.metodo === 'PIX' ? 'Pix' : venda.metodo === 'BOLETO' ? 'boleto' : 'pagamento'} gerado, ainda não pago`,
    reembolso: venda.status === 'chargedback' ? 'chargeback (compra contestada)' : 'compra reembolsada',
  }[venda.situacao]
  const valor =
    venda.valor === null
      ? ''
      : `, ${venda.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
  const produto = venda.produto ? `: ${venda.produto}` : ''
  const id = venda.vendaId ? ` (venda ${venda.vendaId})` : ''
  return `Greenn, ${oQue}${produto}${valor}${id}.`
}
