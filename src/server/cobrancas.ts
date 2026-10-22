import 'server-only'
import { asaas } from '@/channels/asaas'
import { mercadoPago } from '@/channels/mercado-pago'
import { NOME_DO_GATEWAY, type Gateway, type GatewayDePagamento } from '@/channels/pagamento'
import type { Canal, PedidoNativo } from '@/channels/types'
import { paraCobrancaDaApi } from '@/core/api/cobrancas'
import { cnpjValido, cpfValido } from '@/core/documentos'
import { lerPix } from '@/core/pix'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { alertar } from './alertar'
import { gravarCampos } from './repos/campos'
import {
  acharCobranca,
  apagarCobrancaQueNaoSaiu,
  completarCobranca,
  inserirCobranca,
  mudarStatus,
  saiuComoPedidoNativo,
  type CobrancaRegistrada,
  type ItemCobrado,
  type OrigemDaCobranca,
  type StatusDeCobranca,
} from './repos/cobrancas'
import { contextoDeResposta } from './repos/conversas'
import { anotar } from './repos/eventos'
import { acharLead } from './repos/leads'
import { acessoDaConexao, conexaoAtiva } from './repos/pagamentos'
import { agendar, cancelarPorChave } from './repos/tarefas'
import { recursoLiberado } from './recursos-do-plano'
import { emitirEvento } from './webhooks-de-saida'

/**
 * Cobrar pela conversa, independente do gateway (docs/PLANO-COBRANCA-CAMADA-1.md,
 * etapa B).
 *
 * Três caminhos, e só três mudam o status de uma cobrança:
 *
 * 1. **criar**: a linha nasce, o gateway gera o Pix e o link, a linha guarda;
 * 2. **o aviso do gateway**: relê o pagamento na API com o acesso do dono e só
 *    então marca paga. O corpo do aviso nunca é a prova;
 * 3. **o relógio**: no vencimento, relê também (o aviso pode ter se perdido),
 *    e só se ainda não foi paga cancela no gateway e marca vencida.
 *
 * O valor é sempre o do servidor: quem chama passa centavos já conferidos
 * (atendente digitou, ou `core/cobranca.ts` somou pelo catálogo).
 */

const GATEWAYS: Record<Gateway, GatewayDePagamento> = { mercado_pago: mercadoPago, asaas }

export function gatewayDe(gateway: Gateway): GatewayDePagamento {
  return GATEWAYS[gateway]
}

/**
 * A conta pode usar o bloco Cobrar: o plano tem integrações (decisão 1, do
 * Operação para cima) e há uma conta de recebimento conectada.
 */
export async function cobrancaLiberada(clienteId: string): Promise<boolean> {
  const [noPlano, conexao] = await Promise.all([recursoLiberado(clienteId, 'integracoes'), conexaoAtiva(clienteId)])
  return noPlano && conexao !== null
}

/** Inbox: 24 horas (decisão 3 do plano). O bloco do fluxo escolhe o dele. */
export const HORAS_PARA_VENCER_NO_INBOX = 24

export const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** O texto da mensagem: o que é, quanto, até quando. O Pix vai na mensagem seguinte, sozinho. */
export function textoDaCobranca(cobranca: Pick<CobrancaRegistrada, 'descricao' | 'valorCentavos' | 'venceEm' | 'pixCopiaCola' | 'link'>): string {
  const vence = new Date(cobranca.venceEm).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const linhas = [`*${cobranca.descricao}*`, `Valor: ${reais(cobranca.valorCentavos)}`, `Vence em ${vence}`]
  if (cobranca.pixCopiaCola) linhas.push('', 'Para pagar com Pix, copie o código da próxima mensagem e cole no app do seu banco.')
  if (cobranca.link) linhas.push(cobranca.pixCopiaCola ? 'Se preferir cartão ou boleto, use o link.' : 'Para pagar, use o link.')
  return linhas.join('\n')
}

/**
 * O webhook de saída `cobranca.paga` ou `cobranca.vencida`, para o sistema do
 * dono saber sem perguntar. Só quem mudou o status emite: o aviso repetido do
 * gateway recebe `false` de `mudarStatus` e não chega aqui. `emitirEvento` não
 * lança.
 */
async function avisarPorWebhook(
  cobranca: CobrancaRegistrada,
  evento: 'cobranca.paga' | 'cobranca.vencida',
  pagaEm?: Date,
): Promise<void> {
  const agora =
    evento === 'cobranca.paga'
      ? { ...cobranca, status: 'paga' as const, pagaEm: (pagaEm ?? new Date()).toISOString() }
      : { ...cobranca, status: 'vencida' as const }
  await emitirEvento(cobranca.clienteId, evento, cobranca.contatoId, { cobranca: paraCobrancaDaApi(agora) })
}

/**
 * Acorda o bloco Cobrar que criou esta cobrança, se ainda houver um esperando.
 * Import tardio: `receber-mensagem` importa este arquivo para criar a
 * cobrança, e o ciclo fechado no carregamento quebraria os dois.
 *
 * Nunca lança: o aviso do gateway e o relógio já fizeram o que importa (a
 * cobrança está paga ou vencida), e uma conversa que não seguiu é alerta.
 */
async function acordarOFluxo(cobranca: CobrancaRegistrada, desfecho: 'pagou' | 'venceu'): Promise<void> {
  if (cobranca.origem !== 'fluxo' || !cobranca.sessaoId) return
  try {
    const { acordarFluxoDaCobranca } = await import('./receber-mensagem')
    await acordarFluxoDaCobranca(cobranca, desfecho)
  } catch (erro) {
    await alertar(`a cobrança ${desfecho === 'pagou' ? 'foi paga' : 'venceu'}, mas o fluxo não seguiu`, erro, {
      cliente: cobranca.clienteId,
      contato: cobranca.contatoId ?? undefined,
      sessao: cobranca.sessaoId,
    })
  }
}

function quandoVence(venceEm: string): string {
  return new Date(venceEm).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * A cobrança como pedido nativo do WhatsApp (etapa E), ou `null` quando o Pix
 * não traz chave legível (o dinâmico do Asaas traz uma URL): a Meta exige
 * nome e chave ao lado do código, e sem eles vai o texto de sempre.
 */
export function pedidoNativoDaCobranca(
  cobranca: Pick<CobrancaRegistrada, 'id' | 'descricao' | 'valorCentavos' | 'venceEm' | 'pixCopiaCola' | 'link'>,
): PedidoNativo | null {
  const pix = lerPix(cobranca.pixCopiaCola)
  if (!pix || !cobranca.pixCopiaCola) return null
  return {
    referencia: cobranca.id,
    texto: [
      `*${cobranca.descricao}*`,
      `Vence em ${quandoVence(cobranca.venceEm)}`,
      '',
      cobranca.link ? 'Toque em revisar e pagar: Pix copia e cola, ou cartão e boleto pelo link.' : 'Toque em revisar e pagar para copiar o código Pix.',
    ].join('\n'),
    valorCentavos: cobranca.valorCentavos,
    pix: { codigo: cobranca.pixCopiaCola, ...pix },
    link: cobranca.link,
  }
}

/**
 * Tenta mandar a cobrança como pedido nativo. Devolve o texto e o id da Meta
 * quando saiu, ou `null` (canal sem pedido nativo, Pix sem chave, número sem
 * pagamentos liberados na Meta): quem chama manda o texto com o Pix.
 */
export async function tentarPedidoNativo(
  canal: Canal,
  para: string,
  cobranca: CobrancaRegistrada,
): Promise<{ texto: string; id: string | null } | null> {
  const pedido = pedidoNativoDaCobranca(cobranca)
  if (!pedido || !canal.enviarPedidoPix) return null
  try {
    return { texto: pedido.texto, id: await canal.enviarPedidoPix(para, pedido) }
  } catch (erro) {
    console.warn('[cobranca] o pedido nativo não saiu, vai em texto', erro instanceof Error ? erro.message : erro)
    return null
  }
}

/** Pago: a bolha do pedido nativo ganha o selo verde. Melhor esforço, nunca lança. */
async function confirmarPedidoNativo(cobranca: CobrancaRegistrada): Promise<void> {
  if (!cobranca.contatoId) return
  try {
    if (!(await saiuComoPedidoNativo(cobranca.contatoId, cobranca.id))) return
    const contexto = await contextoDeResposta(cobranca.clienteId, cobranca.contatoId)
    if (!contexto) return
    const canal = await adaptadorDoCanal(contexto.canal)
    await canal.confirmarPedidoPix?.(contexto.waId, cobranca.id, `Pagamento de ${reais(cobranca.valorCentavos)} confirmado.`)
  } catch (erro) {
    console.warn('[cobranca] não foi possível marcar o pedido nativo como pago', erro instanceof Error ? erro.message : erro)
  }
}

function chaveDoVencimento(cobrancaId: string): string {
  return `cobranca:${cobrancaId}`
}

/** CPF ou CNPJ com verificador certo, só os dígitos; o resto é `null`. */
export function documentoValido(valor: string | null | undefined): string | null {
  if (!valor) return null
  return cpfValido(valor) ?? cnpjValido(valor)
}

const CAMPO_DE_DOCUMENTO = /^(cpf|cnpj|cpf_cnpj|documento)$/i
const CAMPO_DE_EMAIL = /^e-?mail$/i

function campoDaFicha(campos: Record<string, string>, padrao: RegExp): string | null {
  const chave = Object.keys(campos).find((nome) => padrao.test(nome))
  return chave ? campos[chave]?.trim() || null : null
}

/** O CPF ou CNPJ válido que a ficha já tem, se tem. */
export function documentoDaFicha(campos: Record<string, string>): string | null {
  return documentoValido(campoDaFicha(campos, CAMPO_DE_DOCUMENTO))
}

export type PedidoDeCobrancaDaConta = {
  clienteId: string
  contatoId: string
  valorCentavos: number
  descricao: string
  itens?: ItemCobrado[] | null
  venceEm: Date
  origem: OrigemDaCobranca
  /** Nome de quem cobrou, como o `autor` da linha do tempo. Nulo para fluxo e IA. */
  criadaPor: string | null
  /** Id do usuário que digitou, para a ficha saber quem gravou o CPF. */
  autorId?: string | null
  sessaoId?: string | null
  /** CPF ou CNPJ digitado agora. Vale mais que o da ficha, e passa a morar nela. */
  documento?: string | null
  /** A mensalidade e o mês (0145): o índice único barra a segunda do mesmo mês. */
  assinaturaId?: string | null
  competencia?: string | null
}

export type ResultadoDaCriacao =
  | { ok: true; cobranca: CobrancaRegistrada }
  | { ok: false; motivo: 'sem_conexao' | 'falta_documento' | 'documento_invalido' | 'contato' | 'gateway'; erro: string }

export async function criarCobranca(pedido: PedidoDeCobrancaDaConta): Promise<ResultadoDaCriacao> {
  const conexao = await conexaoAtiva(pedido.clienteId)
  if (!conexao) return { ok: false, motivo: 'sem_conexao', erro: 'Conecte uma conta de recebimento em Ajustes > Pagamentos.' }
  const acesso = await acessoDaConexao(pedido.clienteId, conexao.gateway)
  if (!acesso) return { ok: false, motivo: 'sem_conexao', erro: 'A conexão de pagamento perdeu o acesso. Reconecte em Ajustes > Pagamentos.' }

  const lead = await acharLead(pedido.clienteId, pedido.contatoId)
  if (!lead) return { ok: false, motivo: 'contato', erro: 'Contato não encontrado.' }

  const digitado = pedido.documento?.trim() ? documentoValido(pedido.documento) : null
  if (pedido.documento?.trim() && !digitado) return { ok: false, motivo: 'documento_invalido', erro: 'CPF ou CNPJ inválido.' }
  const documento = digitado ?? documentoDaFicha(lead.campos)
  if (!documento && conexao.gateway === 'asaas') {
    return { ok: false, motivo: 'falta_documento', erro: 'O Asaas exige o CPF ou CNPJ de quem paga.' }
  }

  const id = await inserirCobranca({
    clienteId: pedido.clienteId,
    contatoId: pedido.contatoId,
    gateway: conexao.gateway,
    valorCentavos: pedido.valorCentavos,
    descricao: pedido.descricao.trim(),
    itens: pedido.itens ?? null,
    venceEm: pedido.venceEm,
    origem: pedido.origem,
    criadaPor: pedido.criadaPor,
    sessaoId: pedido.sessaoId ?? null,
    assinaturaId: pedido.assinaturaId ?? null,
    competencia: pedido.competencia ?? null,
  })

  try {
    const criada = await gatewayDe(conexao.gateway).criarCobranca(acesso, {
      referencia: id,
      valorCentavos: pedido.valorCentavos,
      descricao: pedido.descricao.trim(),
      venceEm: pedido.venceEm,
      pagador: {
        nome: lead.nome?.trim() || 'Cliente',
        documento,
        // Instagram e Telegram não têm telefone no `waId`.
        telefone: /^\d{10,15}$/.test(lead.waId) ? lead.waId : null,
        email: campoDaFicha(lead.campos, CAMPO_DE_EMAIL),
      },
    })
    if (!criada.pixCopiaCola && !criada.link) throw new Error(`o ${NOME_DO_GATEWAY[conexao.gateway]} não devolveu nem Pix nem link`)
    await completarCobranca(id, criada)
  } catch (erro) {
    await apagarCobrancaQueNaoSaiu(id)
    await alertar(`a cobrança não saiu no ${NOME_DO_GATEWAY[conexao.gateway]}`, erro, { cliente: pedido.clienteId })
    return { ok: false, motivo: 'gateway', erro: `O ${NOME_DO_GATEWAY[conexao.gateway]} recusou a cobrança. Tente de novo em instantes.` }
  }

  // O CPF digitado passa a morar na ficha: a próxima cobrança não pergunta.
  if (digitado) {
    await gravarCampos(pedido.clienteId, pedido.contatoId, {
      cpf: { valor: digitado, origem: 'humano', autorId: pedido.autorId ?? null, em: new Date().toISOString() },
    }).catch(() => undefined)
  }

  await agendar({
    clienteId: pedido.clienteId,
    tipo: 'vencimento_de_cobranca',
    quando: pedido.venceEm,
    dados: { cobrancaId: id },
    chave: chaveDoVencimento(id),
  })
  await anotar(
    pedido.clienteId,
    pedido.contatoId,
    'cobranca',
    { status: 'criada', valor: reais(pedido.valorCentavos), descricao: pedido.descricao.trim() },
    pedido.criadaPor,
  )

  const cobranca = await acharCobranca(pedido.clienteId, id)
  if (!cobranca) throw new Error('a cobrança sumiu logo depois de criada')
  return { ok: true, cobranca }
}

/**
 * Aplica o que o gateway diz de um pagamento. É a única porta para `paga` e
 * `estornada`, usada pelo aviso e pelo relógio.
 *
 * Devolve o status em que a cobrança ficou, ou `null` quando o pagamento não é
 * de cobrança nenhuma desta conta (aviso de uma venda feita fora do AutoFluxos,
 * na mesma conta do gateway: acontece, e não é erro).
 */
export async function aplicarPagamento(
  clienteId: string,
  gateway: Gateway,
  pagamentoId: string,
): Promise<StatusDeCobranca | null> {
  const acesso = await acessoDaConexao(clienteId, gateway)
  if (!acesso) return null
  const lido = await gatewayDe(gateway).lerPagamento(acesso, pagamentoId)
  if (!lido.referencia) return null
  const cobranca = await acharCobranca(clienteId, lido.referencia)
  if (!cobranca || cobranca.gateway !== gateway) return null

  if (lido.situacao === 'paga') {
    // Pago a menos não é pago: o gateway deixa a pessoa editar o valor em
    // alguns meios, e a conversa seguiria como se a conta estivesse quitada.
    if (lido.valorCentavos < cobranca.valorCentavos) {
      await alertar('pagamento abaixo do valor cobrado', new Error(`${lido.valorCentavos} de ${cobranca.valorCentavos}`), {
        cliente: clienteId,
      })
      return cobranca.status
    }
    // De `vencida` também: o dinheiro chegou, e é isso que vale.
    const pagaEm = lido.pagaEm ?? new Date()
    const primeira = await mudarStatus(clienteId, cobranca.id, ['pendente', 'vencida'], 'paga', pagaEm)
    if (primeira) {
      await cancelarPorChave(chaveDoVencimento(cobranca.id))
      // Pago pelo link do Mercado Pago, o Pix da conversa continua aberto e
      // poderia ser pago de novo. Fecha.
      if (cobranca.pagamentoNoGateway && cobranca.pagamentoNoGateway !== lido.pagamentoId) {
        await gatewayDe(gateway).cancelarPagamento(acesso, cobranca.pagamentoNoGateway).catch(() => undefined)
      }
      if (cobranca.contatoId) {
        await anotar(clienteId, cobranca.contatoId, 'cobranca', {
          status: 'paga',
          valor: reais(cobranca.valorCentavos),
          descricao: cobranca.descricao,
        })
      }
      await avisarPorWebhook(cobranca, 'cobranca.paga', pagaEm)
      await confirmarPedidoNativo(cobranca)
      await acordarOFluxo(cobranca, 'pagou')
    }
    return 'paga'
  }

  if (lido.situacao === 'estornada') {
    const mudou = await mudarStatus(clienteId, cobranca.id, ['paga'], 'estornada')
    if (mudou && cobranca.contatoId) {
      await anotar(clienteId, cobranca.contatoId, 'cobranca', { status: 'estornada', valor: reais(cobranca.valorCentavos) })
    }
    return mudou ? 'estornada' : cobranca.status
  }

  return cobranca.status
}

/**
 * O relógio do vencimento (tarefa `vencimento_de_cobranca`).
 *
 * Relê antes de vencer: se o aviso se perdeu, é aqui que o pagamento aparece.
 * Depois cancela no gateway, para o Pix velho não ser pago numa cobrança que a
 * tela já mostra como vencida.
 */
export async function rodarVencimentoDeCobranca(
  clienteId: string,
  dados: Record<string, unknown>,
): Promise<'feita' | 'ignorada'> {
  const cobrancaId = typeof dados.cobrancaId === 'string' ? dados.cobrancaId : null
  if (!cobrancaId) return 'ignorada'
  const cobranca = await acharCobranca(clienteId, cobrancaId)
  if (!cobranca || cobranca.status !== 'pendente' || !cobranca.pagamentoNoGateway) return 'ignorada'

  const status = await aplicarPagamento(clienteId, cobranca.gateway, cobranca.pagamentoNoGateway)
  if (status !== 'pendente') return 'ignorada'

  const acesso = await acessoDaConexao(clienteId, cobranca.gateway)
  if (acesso) await gatewayDe(cobranca.gateway).cancelarPagamento(acesso, cobranca.pagamentoNoGateway).catch(() => undefined)
  const mudou = await mudarStatus(clienteId, cobranca.id, ['pendente'], 'vencida')
  if (mudou && cobranca.contatoId) {
    await anotar(clienteId, cobranca.contatoId, 'cobranca', {
      status: 'vencida',
      valor: reais(cobranca.valorCentavos),
      descricao: cobranca.descricao,
    })
  }
  if (mudou) {
    await avisarPorWebhook(cobranca, 'cobranca.vencida')
    await acordarOFluxo(cobranca, 'venceu')
  }
  return mudou ? 'feita' : 'ignorada'
}

/**
 * Cancelar pela tela. Cancela no gateway **antes**: se lá já foi pago, a
 * cobrança vira paga em vez de cancelada, e a tela diz isso.
 */
export async function cancelarCobranca(
  clienteId: string,
  cobrancaId: string,
  autor: string | null,
): Promise<{ ok: true; status: StatusDeCobranca } | { ok: false; erro: string }> {
  const cobranca = await acharCobranca(clienteId, cobrancaId)
  if (!cobranca) return { ok: false, erro: 'Cobrança não encontrada.' }
  if (cobranca.status !== 'pendente') return { ok: true, status: cobranca.status }

  if (cobranca.pagamentoNoGateway) {
    const status = await aplicarPagamento(clienteId, cobranca.gateway, cobranca.pagamentoNoGateway).catch(() => null)
    if (status === 'paga') return { ok: true, status }
    const acesso = await acessoDaConexao(clienteId, cobranca.gateway)
    if (acesso) await gatewayDe(cobranca.gateway).cancelarPagamento(acesso, cobranca.pagamentoNoGateway).catch(() => undefined)
  }
  const mudou = await mudarStatus(clienteId, cobranca.id, ['pendente'], 'cancelada')
  if (mudou) {
    await cancelarPorChave(chaveDoVencimento(cobranca.id))
    if (cobranca.contatoId) {
      await anotar(
        clienteId,
        cobranca.contatoId,
        'cobranca',
        { status: 'cancelada', valor: reais(cobranca.valorCentavos), descricao: cobranca.descricao },
        autor,
      )
    }
  }
  return { ok: true, status: mudou ? 'cancelada' : (await acharCobranca(clienteId, cobranca.id))?.status ?? 'pendente' }
}
