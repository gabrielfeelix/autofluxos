import { redirect } from 'next/navigation'
import { ambienteDoStripe, apelidoDaConta, trocarCodigo } from '@/channels/stripe'
import { alertar } from '@/server/alertar'
import { concluirConexao } from '@/server/instagram/estado'
import { salvarConexaoDePagamento } from '@/server/repos/pagamentos'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Onde o Stripe devolve o dono depois de autorizar (Connect Standard). O
 * desenho de `api/pagamentos/mercado-pago/retorno`: o `state` assinado contra
 * o cookie deste navegador diz qual conta começou, a sessão, quando vem, diz
 * quem, e a resposta é sempre um redirect com o resultado na URL.
 *
 * O que se guarda como "token" é a conta do dono (`acct_`): quem fala com o
 * Stripe é a chave da 4YU com o cabeçalho `Stripe-Account`.
 */
export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams

  const clienteId = await concluirConexao(parametros.get('state'))
  if (!clienteId) redirect('/painel?erro=stripe_estado')

  const destino = `/clientes/${clienteId}/ajustes/pagamentos`
  const acesso = await conferirAcessoAoCliente(clienteId)
  if ((await sessaoAtual()) !== null && !acesso) redirect('/painel?erro=stripe_acesso')

  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?resultado=stripe_cancelado`)

  let resultado = 'stripe_conectado'
  try {
    const { conta } = await trocarCodigo(codigo)
    await salvarConexaoDePagamento({
      clienteId,
      gateway: 'stripe',
      contaNoGateway: conta,
      apelido: await apelidoDaConta(conta),
      token: conta,
      renovacao: null,
      expiraEm: null,
      ambiente: ambienteDoStripe(),
    })
  } catch (erro) {
    const outraConta = erro instanceof Error && erro.message.includes('outra conta')
    await alertar('a conexão do Stripe falhou', erro, { cliente: clienteId })
    // `redirect` lança: fica fora do `try`, senão vira "falhou".
    resultado = outraConta ? 'stripe_outra_conta' : 'stripe_falhou'
  }

  redirect(`${destino}?resultado=${resultado}`)
}
