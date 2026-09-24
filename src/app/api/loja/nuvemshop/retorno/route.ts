import { redirect } from 'next/navigation'
import { lerLojaNuvemshop } from '@/loja/nuvemshop'
import { alertar } from '@/server/alertar'
import { lerEstado } from '@/server/instagram/estado'
import { assinarDesinstalacao, trocarCodigo } from '@/server/nuvemshop/conexao'
import { apagarConexao, criarConexao } from '@/server/repos/conexoes'
import { lojaNuvemshopDaConta, salvarLojaNuvemshop } from '@/server/repos/lojas'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Onde a Nuvemshop devolve o lojista depois de ele autorizar o app (F4).
 *
 * O desenho é o de `api/instagram/retorno`, e pelos mesmos motivos: o `state`
 * assinado diz **qual conta** começou; a sessão, quando vem, diz **quem** e é
 * conferida de novo; a resposta é sempre um redirect para a tela, com o
 * resultado na URL. Pública no `proxy.ts` porque o navegador volta de outro
 * site e o cookie `SameSite=Lax` pode não vir junto.
 *
 * A ordem é a que não deixa sobra: token no cofre, depois a linha da loja
 * apontando para ele, depois o aviso de desinstalação. Se a linha falhar, a
 * Conexão recém-criada é apagada.
 */
export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams

  const clienteId = lerEstado(parametros.get('state'))
  if (!clienteId) redirect('/painel?erro=nuvemshop_estado')

  const destino = `/clientes/${clienteId}/loja/nuvemshop`

  const acesso = await conferirAcessoAoCliente(clienteId)
  if ((await sessaoAtual()) !== null && !acesso) redirect('/painel?erro=nuvemshop_acesso')

  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?resultado=cancelado`)

  let resultado = 'conectado'
  try {
    const { token, storeId } = await trocarCodigo(codigo)
    const loja = await lerLojaNuvemshop({ storeId, token })
    if (!loja.ok) throw new Error(loja.motivo)

    // Reconectar troca o token: o antigo sai do cofre depois de o novo entrar.
    const anterior = await lojaNuvemshopDaConta(clienteId)
    const conexao = await criarConexao({ clienteId, nome: 'Nuvemshop (somente leitura)', tipo: 'bearer', valor: token })
    try {
      await salvarLojaNuvemshop(clienteId, { endereco: loja.valor.endereco, storeId, conexaoId: conexao.id })
    } catch (erro) {
      await apagarConexao(conexao.id, clienteId).catch(() => undefined)
      throw erro
    }
    if (anterior?.conexaoId && anterior.conexaoId !== conexao.id) {
      await apagarConexao(anterior.conexaoId, clienteId).catch(() => undefined)
    }

    try {
      await assinarDesinstalacao({ storeId, token }, new URL(req.url).origin)
    } catch (erro) {
      // A loja ficou conectada; só o aviso de remoção do app não veio.
      resultado = 'sem_webhook'
      await alertar('a Nuvemshop conectou mas não assinou o aviso de desinstalação', erro, { cliente: clienteId })
    }
  } catch (erro) {
    const outraConta = erro instanceof Error && erro.message.includes('outra conta')
    await alertar('a conexão da Nuvemshop falhou', erro, { cliente: clienteId })
    // `redirect` lança: fica fora do `try`, senão vira "falhou".
    resultado = outraConta ? 'outra_conta' : 'falhou'
  }

  redirect(`${destino}?resultado=${resultado}`)
}
