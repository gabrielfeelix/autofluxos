import { redirect } from 'next/navigation'
import { lerConta, trocarCodigo } from '@/channels/mercado-pago'
import { alertar } from '@/server/alertar'
import { concluirConexao } from '@/server/instagram/estado'
import { salvarConexaoDePagamento } from '@/server/repos/pagamentos'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Onde o Mercado Pago devolve o dono depois do login (cobrança no chat, etapa A).
 *
 * O desenho é o de `api/loja/nuvemshop/retorno`: o `state` assinado, conferido
 * contra o cookie deste navegador, diz **qual conta** começou; a sessão,
 * quando vem, diz **quem** e é conferida de novo; a resposta é sempre um
 * redirect para a tela, com o resultado na URL. Pública no `proxy.ts` porque
 * o navegador volta de outro site e o cookie `SameSite=Lax` pode não vir.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const parametros = url.searchParams

  const clienteId = await concluirConexao(parametros.get('state'))
  if (!clienteId) redirect('/painel?erro=mercado_pago_estado')

  const destino = `/clientes/${clienteId}/ajustes/pagamentos`

  const acesso = await conferirAcessoAoCliente(clienteId)
  if ((await sessaoAtual()) !== null && !acesso) redirect('/painel?erro=mercado_pago_acesso')

  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?resultado=cancelado`)

  // A origem que a ação usou para montar o `redirect_uri` é a mesma por onde a
  // volta chega; a troca do código exige as duas iguais.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
  const protocolo = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')

  let resultado = 'conectado'
  try {
    const token = await trocarCodigo({ codigo, origem: `${protocolo}://${host}` })
    const conta = await lerConta(token.token)
    if (conta.id !== token.contaId) throw new Error('o Mercado Pago devolveu contas diferentes no token e no perfil')
    await salvarConexaoDePagamento({
      clienteId,
      gateway: 'mercado_pago',
      contaNoGateway: token.contaId,
      apelido: conta.apelido,
      token: token.token,
      renovacao: token.renovacao,
      expiraEm: token.expiraEm,
    })
  } catch (erro) {
    const outraConta = erro instanceof Error && erro.message.includes('outra conta')
    await alertar('a conexão do Mercado Pago falhou', erro, { cliente: clienteId })
    // `redirect` lança: fica fora do `try`, senão vira "falhou".
    resultado = outraConta ? 'outra_conta' : 'falhou'
  }

  redirect(`${destino}?resultado=${resultado}`)
}
