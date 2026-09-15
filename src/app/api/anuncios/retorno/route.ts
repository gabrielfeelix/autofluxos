import { redirect } from 'next/navigation'
import { trocarCodigoPorToken } from '@/server/anuncios/conexao'
import { alertar } from '@/server/alertar'
import { lerEstado } from '@/server/instagram/estado'
import { guardarTokenDeAnuncios } from '@/server/repos/conexoes-de-anuncios'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Onde a Meta devolve quem autorizou o acesso aos anúncios.
 *
 * Mesmas duas conferências das outras rotas de retorno, e nenhuma substitui a
 * outra: o `state` assinado prova **qual cliente** começou — sem ele, um link
 * forjado ligaria a conta de anúncios de alguém ao cliente errado. A sessão
 * prova **quem está pedindo**, e é conferida quando existe.
 *
 * **A sessão pode não vir, e isso é normal.** Quem chega é o navegador voltando
 * do `facebook.com`, e o cookie `SameSite=Lax` não acompanha redirect de outro
 * site. Exigir sessão recusaria toda conexão real — foi exatamente assim que a
 * primeira conexão do WhatsApp falhou, em 13/set.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const parametros = url.searchParams

  const clienteId = lerEstado(parametros.get('state'))
  if (!clienteId) redirect('/painel?erro=anuncios_estado')

  const destino = `/clientes/${clienteId}/anuncios`

  const acesso = await conferirAcessoAoCliente(clienteId)
  if ((await sessaoAtual()) !== null && !acesso) {
    redirect(`${destino}?erro=acesso`)
  }

  /*
   * Clicou em "Cancelar" na tela da Meta. Não é falha, é resposta — e mandar
   * investigar uma decisão de alguém seria transformar escolha em defeito.
   */
  if (parametros.get('error')) {
    redirect(`${destino}?erro=cancelado`)
  }

  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?erro=sem_codigo`)

  try {
    const { token, expiraEm } = await trocarCodigoPorToken({
      codigo,
      origem: url.origin,
    })

    await guardarTokenDeAnuncios({ clienteId, token, expiraEm })
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não deu para ligar a conta de anúncios', detalhe, {})
    redirect(`${destino}?erro=troca`)
  }

  redirect(`${destino}?ok=1`)
}
