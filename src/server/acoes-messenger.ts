'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { alertar } from './alertar'
import { iniciarConexao } from './instagram/estado'
import { paginasComToken, urlDeAutorizacaoDoMessenger } from './messenger/conexao'
import { descartarEscolhaPendente, lerEscolhaPendente, ligarPagina } from './messenger/ligar'
import { exigirCapacidade, recusou } from './permissoes'
import { desligarPaginaDoMessenger } from './repos/canais-messenger'

function voltar(clienteId: string, resultado: string): never {
  redirect(`/clientes/${clienteId}/conversas/canais/messenger?resultado=${resultado}`)
}

/** Manda para o Facebook Login. A origem vem do cabeçalho, como em Anúncios. */
export async function acaoConectarMessenger(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)

  const cabecalhos = await headers()
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  redirect(urlDeAutorizacaoDoMessenger({ origem: `${protocolo}://${host}`, state: await iniciarConexao(clienteId) }))
}

/** A página escolhida, quando a pessoa liberou mais de uma. */
export async function acaoEscolherPagina(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  const pageId = String(dados.get('pageId') ?? '')
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)

  const token = await lerEscolhaPendente(clienteId)
  if (!token) voltar(clienteId, 'expirou')

  let resultado = 'conectado'
  try {
    const pagina = (await paginasComToken(token)).find((p) => p.id === pageId)
    if (!pagina) {
      resultado = 'sem_pagina'
    } else {
      await ligarPagina(clienteId, pagina)
      await descartarEscolhaPendente()
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('não foi possível ligar a página escolhida do Messenger', detalhe, { clienteId })
    resultado = detalhe.includes('outra conta') ? 'de_outra_conta' : 'falhou'
  }
  voltar(clienteId, resultado)
}

/** Desliga a página. O token sai do cofre junto (gatilho da 0040). */
export async function acaoDesligarMessenger(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)
  await desligarPaginaDoMessenger(clienteId)
  voltar(clienteId, 'desligado')
}
