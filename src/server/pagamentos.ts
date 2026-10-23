import 'server-only'
import { renovarToken as renovarMercadoPago } from '@/channels/mercado-pago'
import { NOME_DO_GATEWAY, type Ambiente, type Gateway } from '@/channels/pagamento'
import { renovarToken as renovarPagBank } from '@/channels/pagbank'
import { alertar } from './alertar'
import { conexaoDePagamento, conexoesParaRenovar, salvarConexaoDePagamento } from './repos/pagamentos'

type TokenRenovado = { token: string; renovacao: string | null; expiraEm: Date | null; contaId: string }

/** Quem renova por OAuth. Asaas e InfinitePay não vencem e nunca chegam aqui (sem `renovacao_ref`). */
const RENOVAR: Partial<Record<Gateway, (renovacao: string, ambiente: Ambiente) => Promise<TokenRenovado>>> = {
  mercado_pago: (renovacao) => renovarMercadoPago(renovacao),
  pagbank: renovarPagBank,
}

/**
 * O token do Mercado Pago vence em 180 dias; o do PagBank, o que a resposta
 * disser (se for menos que a folga, renova todo dia, e está certo). Renovar
 * com 30 de folga dá à manutenção diária um mês de tentativas antes de a
 * conta ficar sem cobrar, e o sintoma de esquecer é o pior possível: Pix que
 * não sai no meio da venda.
 */
export const DIAS_DE_FOLGA_DO_PAGAMENTO = 30

/** Nunca lança: a falha de uma conta vira alerta e as outras seguem. */
export async function renovarTokensDePagamento({ agora = new Date() } = {}): Promise<{ renovadas: number; falhas: number }> {
  const limite = new Date(agora.getTime() + DIAS_DE_FOLGA_DO_PAGAMENTO * 86_400_000)
  let renovadas = 0
  let falhas = 0

  let candidatas: Awaited<ReturnType<typeof conexoesParaRenovar>> = []
  try {
    candidatas = await conexoesParaRenovar(limite)
  } catch (erro) {
    await alertar('não foi possível listar as contas de pagamento a renovar', erro)
    return { renovadas, falhas: 1 }
  }

  for (const conta of candidatas) {
    try {
      const atual = await conexaoDePagamento(conta.clienteId, conta.gateway)
      const renovar = RENOVAR[conta.gateway]
      if (!renovar) continue
      const novo = await renovar(conta.renovacao, conta.ambiente)
      await salvarConexaoDePagamento({
        clienteId: conta.clienteId,
        gateway: conta.gateway,
        contaNoGateway: novo.contaId,
        apelido: atual?.apelido ?? null,
        token: novo.token,
        // Mercado Pago e PagBank trocam o refresh token a cada uso; sem o
        // novo, a próxima renovação falharia.
        renovacao: novo.renovacao ?? conta.renovacao,
        expiraEm: novo.expiraEm,
        ambiente: conta.ambiente,
      })
      renovadas += 1
    } catch (erro) {
      falhas += 1
      await alertar(`não foi possível renovar o acesso ao ${NOME_DO_GATEWAY[conta.gateway]}; o dono precisa reconectar`, erro, {
        cliente: conta.clienteId,
      })
    }
  }
  return { renovadas, falhas }
}
