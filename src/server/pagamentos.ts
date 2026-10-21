import 'server-only'
import { renovarToken } from '@/channels/mercado-pago'
import { alertar } from './alertar'
import { conexaoDePagamento, conexoesParaRenovar, salvarConexaoDePagamento } from './repos/pagamentos'

/**
 * O token do Mercado Pago vence em 180 dias. Renovar com 30 de folga dá à
 * manutenção diária um mês de tentativas antes de a conta ficar sem cobrar, e
 * o sintoma de esquecer é o pior possível: Pix que não sai no meio da venda.
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
      const novo = await renovarToken(conta.renovacao)
      await salvarConexaoDePagamento({
        clienteId: conta.clienteId,
        gateway: conta.gateway,
        contaNoGateway: novo.contaId,
        apelido: atual?.apelido ?? null,
        token: novo.token,
        // O Mercado Pago troca o refresh token a cada uso; sem o novo, a
        // próxima renovação falharia.
        renovacao: novo.renovacao ?? conta.renovacao,
        expiraEm: novo.expiraEm,
      })
      renovadas += 1
    } catch (erro) {
      falhas += 1
      await alertar('não foi possível renovar o acesso ao Mercado Pago; o dono precisa reconectar', erro, {
        cliente: conta.clienteId,
      })
    }
  }
  return { renovadas, falhas }
}
