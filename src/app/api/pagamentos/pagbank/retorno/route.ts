import { redirect } from 'next/navigation'
import { apelidoDaConta, estadoDoPagBank, trocarCodigo } from '@/channels/pagbank'
import { alertar } from '@/server/alertar'
import { concluirConexao } from '@/server/instagram/estado'
import { salvarConexaoDePagamento } from '@/server/repos/pagamentos'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Onde o PagBank devolve o dono depois do login (PagBank Connect).
 *
 * O mesmo desenho de `api/pagamentos/mercado-pago/retorno`: o `state`, depois
 * de voltar ao formato do bilhete (`estadoDoPagBank`), é conferido contra o
 * cookie deste navegador e diz **qual conta** começou; a sessão, quando vem,
 * diz **quem**. Sempre termina num redirect para a tela, com o resultado na URL.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const parametros = url.searchParams

  const clienteId = await concluirConexao(estadoDoPagBank(parametros.get('state')))
  if (!clienteId) redirect('/painel?erro=pagbank_estado')

  const destino = `/clientes/${clienteId}/ajustes/pagamentos`

  const acesso = await conferirAcessoAoCliente(clienteId)
  if ((await sessaoAtual()) !== null && !acesso) redirect('/painel?erro=pagbank_acesso')

  // Quem nega a autorização volta sem `code`.
  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?resultado=pagbank_cancelado`)

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
  const protocolo = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')

  let resultado = 'pagbank_conectado'
  try {
    const token = await trocarCodigo({ codigo, origem: `${protocolo}://${host}` })
    await salvarConexaoDePagamento({
      clienteId,
      gateway: 'pagbank',
      contaNoGateway: token.contaId,
      apelido: await apelidoDaConta(token),
      token: token.token,
      renovacao: token.renovacao,
      expiraEm: token.expiraEm,
      ambiente: token.ambiente,
    })
  } catch (erro) {
    const outraConta = erro instanceof Error && erro.message.includes('outra conta')
    const fechado = erro instanceof Error && /check constraint|gateway_check/.test(erro.message)
    await alertar('a conexão do PagBank falhou', erro, { cliente: clienteId })
    // `redirect` lança: fica fora do `try`, senão vira "falhou".
    resultado = outraConta ? 'pagbank_outra_conta' : fechado ? 'pagbank_em_liberacao' : 'pagbank_falhou'
  }

  redirect(`${destino}?resultado=${resultado}`)
}
