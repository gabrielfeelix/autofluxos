import { redirect } from 'next/navigation'
import { trocarCodigoPorToken } from '@/server/anuncios/conexao'
import { alertar } from '@/server/alertar'
import { concluirConexao } from '@/server/instagram/estado'
import { paginasComToken, RETORNO_DO_MESSENGER } from '@/server/messenger/conexao'
import { guardarEscolhaPendente, ligarPagina } from '@/server/messenger/ligar'
import { conferirAcessoAoCliente, sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * A volta do Facebook Login do Messenger.
 *
 * Mesmo desenho do retorno de Anúncios: o `state` diz de que conta é, e só
 * vale se casar com o cookie gravado no início. Uma página liberada liga na
 * hora; mais de uma, a pessoa escolhe na tela do canal.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const parametros = url.searchParams
  const clienteId = await concluirConexao(parametros.get('state'))
  if (!clienteId) redirect('/painel?erro=messenger_estado')

  const destino = `/clientes/${clienteId}/conversas/canais/messenger`
  if ((await sessaoAtual()) === null || !(await conferirAcessoAoCliente(clienteId))) {
    redirect(`${destino}?resultado=acesso`)
  }
  if (parametros.get('error')) redirect(`${destino}?resultado=cancelado`)

  const codigo = parametros.get('code')
  if (!codigo) redirect(`${destino}?resultado=cancelado`)

  let resultado = 'conectado'
  try {
    const { token } = await trocarCodigoPorToken({ codigo, origem: url.origin, retorno: RETORNO_DO_MESSENGER })
    const paginas = await paginasComToken(token)
    if (paginas.length === 0) {
      resultado = 'sem_pagina'
    } else if (paginas.length === 1 && paginas[0]) {
      await ligarPagina(clienteId, paginas[0])
    } else {
      await guardarEscolhaPendente(clienteId, token)
      resultado = 'escolher'
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não foi possível ligar a página do Messenger', detalhe, { clienteId })
    resultado = detalhe.includes('outra conta') ? 'de_outra_conta' : 'falhou'
  }
  redirect(`${destino}?resultado=${resultado}`)
}
