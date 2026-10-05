/**
 * O nome de um modelo da biblioteca da Meta em português, para a galeria.
 *
 * A Meta nomeia em inglês e em `snake_case` (`appointment_cancellation_2`), e
 * a galeria mostrava "Appointment cancellation" ao lado dos nossos, para quem
 * não lê inglês. O texto da mensagem já vem em português; só o nome não.
 *
 * Primeiro a tabela, com os nomes da biblioteca de utilidade escritos à mão.
 * O que não estiver nela passa pela tradução palavra a palavra, na ordem do
 * português ("address update" vira "Atualização de endereço"). Se sobrar
 * palavra que o dicionário não conhece, fica o nome original: um título meio
 * traduzido é pior do que o inglês inteiro.
 */

const NOMES: Record<string, string> = {
  account_creation_confirmation: 'Confirmação de conta criada',
  address_update: 'Endereço atualizado',
  appointment_cancellation: 'Cancelamento de consulta',
  appointment_cancelled: 'Consulta cancelada',
  appointment_confirmation: 'Confirmação de consulta',
  appointment_confirmed: 'Consulta confirmada',
  appointment_reminder: 'Lembrete de consulta',
  appointment_reschedule: 'Consulta remarcada',
  appointment_rescheduled: 'Consulta remarcada',
  appointment_scheduling: 'Agendamento de consulta',
  auto_pay_reminder: 'Lembrete de débito automático',
  delivery_confirmation: 'Confirmação de entrega',
  delivery_failed: 'Falha na entrega',
  delivery_update: 'Atualização da entrega',
  event_reminder: 'Lembrete de evento',
  feedback_survey: 'Pesquisa de satisfação',
  low_balance_warning: 'Aviso de saldo baixo',
  order_cancelled: 'Pedido cancelado',
  order_confirmation: 'Confirmação de pedido',
  order_delayed: 'Pedido atrasado',
  order_delay: 'Atraso no pedido',
  order_pick_up: 'Pedido pronto para retirada',
  order_ready_for_pickup: 'Pedido pronto para retirada',
  order_shipped: 'Pedido enviado',
  payment_confirmation: 'Confirmação de pagamento',
  payment_due_reminder: 'Lembrete de vencimento',
  payment_failed: 'Falha no pagamento',
  payment_overdue: 'Pagamento em atraso',
  payment_reminder: 'Lembrete de pagamento',
  payment_scheduled: 'Pagamento agendado',
  purchase_receipt: 'Comprovante de compra',
  refund_confirmation: 'Confirmação de reembolso',
  reservation_confirmation: 'Confirmação de reserva',
  return_confirmation: 'Confirmação de devolução',
  shipment_confirmation: 'Confirmação de envio',
  statement_available: 'Extrato disponível',
  transaction_alert: 'Alerta de transação',
}

/** Substantivos: vão na ordem inversa, ligados por "de". */
const SUBSTANTIVOS: Record<string, string> = {
  account: 'conta',
  address: 'endereço',
  appointment: 'consulta',
  booking: 'reserva',
  cancellation: 'cancelamento',
  confirmation: 'confirmação',
  creation: 'criação',
  delivery: 'entrega',
  event: 'evento',
  feedback: 'opinião',
  invoice: 'fatura',
  order: 'pedido',
  payment: 'pagamento',
  purchase: 'compra',
  receipt: 'comprovante',
  refund: 'reembolso',
  reminder: 'lembrete',
  reservation: 'reserva',
  return: 'devolução',
  shipment: 'envio',
  shipping: 'envio',
  subscription: 'assinatura',
  survey: 'pesquisa',
  ticket: 'ingresso',
  transaction: 'transação',
  update: 'atualização',
  verification: 'verificação',
  welcome: 'boas-vindas',
}

/** Particípios no fim ("appointment confirmed"): viram adjetivo depois do substantivo. */
const PARTICIPIOS: Record<string, [masculino: string, feminino: string]> = {
  cancelled: ['cancelado', 'cancelada'],
  canceled: ['cancelado', 'cancelada'],
  confirmed: ['confirmado', 'confirmada'],
  completed: ['concluído', 'concluída'],
  delayed: ['atrasado', 'atrasada'],
  delivered: ['entregue', 'entregue'],
  failed: ['com falha', 'com falha'],
  received: ['recebido', 'recebida'],
  rescheduled: ['remarcado', 'remarcada'],
  scheduled: ['agendado', 'agendada'],
  shipped: ['enviado', 'enviada'],
  updated: ['atualizado', 'atualizada'],
}

/** Gênero pela terminação, que acerta os substantivos do dicionário acima. */
function feminino(palavra: string): boolean {
  return /(ção|são|a|agem|ade)$/.test(palavra) && palavra !== 'dia'
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function tituloDaBiblioteca(nome: string): string {
  const chave = nome.toLowerCase().replace(/_\d+$/, '').trim()
  if (NOMES[chave]) return NOMES[chave]

  const palavras = chave.split('_').filter(Boolean)
  const original = maiuscula(palavras.join(' '))

  const ultima = palavras.at(-1) ?? ''
  const participio = PARTICIPIOS[ultima]
  const nucleo = participio ? palavras.slice(0, -1) : palavras
  const traduzidas = nucleo.map((p) => SUBSTANTIVOS[p])
  if (traduzidas.length === 0 || traduzidas.some((t) => t === undefined)) return original

  const frase = (traduzidas as string[]).reverse().join(' de ')
  if (!participio) return maiuscula(frase)
  const principal = (traduzidas as string[])[0] ?? ''
  return maiuscula(`${frase} ${feminino(principal) ? participio[1] : participio[0]}`)
}

/**
 * O título de um modelo já criado, a partir do nome que ele tem na Meta.
 *
 * O nome leva um carimbo de data no fim (`_202610051827`, ver
 * `nomeAutomatico`) para nunca colidir; ele sai antes de traduzir. O que não
 * é da biblioteca (os nossos, em português) só perde os sublinhados.
 */
export function tituloDoModelo(nome: string): string {
  return tituloDaBiblioteca(nome.replace(/_\d{8,}$/, ''))
}

const CATEGORIAS: Record<string, string> = {
  UTILITY: 'Utilidade',
  MARKETING: 'Marketing',
  AUTHENTICATION: 'Autenticação',
}

export function categoriaLegivel(categoria: string): string {
  return CATEGORIAS[categoria.toUpperCase()] ?? categoria
}

const IDIOMAS: Record<string, string> = {
  pt_BR: 'Português',
  pt_PT: 'Português (Portugal)',
  en_US: 'Inglês',
  en: 'Inglês',
  es: 'Espanhol',
  es_ES: 'Espanhol',
}

export function idiomaLegivel(idioma: string): string {
  return IDIOMAS[idioma] ?? idioma
}
