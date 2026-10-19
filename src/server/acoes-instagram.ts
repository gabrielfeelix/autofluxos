'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { instagramConfigurado, urlDeAutorizacao } from './instagram/conexao'
import { iniciarConexao } from './instagram/estado'
import { desligarContaDoInstagram } from './repos/canais-instagram'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * O que a tela de Instagram chama.
 *
 * Confere autorização por conta própria, como todo arquivo de ação daqui: a
 * moldura protege a renderização, e Server Action é um POST que um refactor de
 * rota tira do alcance do matcher sem avisar ninguém.
 */

export async function acaoConectarInstagram(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  // ligar e desligar canal é configurar a operação, como conectar número
  // (auditoria de 19/out/2026: antes bastava ser da organização)
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)

  if (!instagramConfigurado()) {
    redirect(`/clientes/${clienteId}/conversas/canais/instagram?resultado=sem_app`)
  }

  /*
   * A origem vem do cabeçalho, e não de uma variável.
   *
   * O `redirect_uri` precisa bater byte a byte com o que foi cadastrado no
   * painel da Meta **e** com o que vai no retorno. Ler da requisição faz
   * preview e produção funcionarem sem cada um ter a sua variável, o preço é
   * lembrar de cadastrar cada origem no painel da Meta, que é obrigatório de
   * qualquer forma.
   */
  const cabecalhos = await headers()
  const anfitriao = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  const origem = `${protocolo}://${anfitriao}`

  redirect(urlDeAutorizacao({ origem, state: await iniciarConexao(clienteId) }))
}

export async function acaoDesligarInstagram(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  // ligar e desligar canal é configurar a operação, como conectar número
  // (auditoria de 19/out/2026: antes bastava ser da organização)
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)

  await desligarContaDoInstagram(clienteId)
  revalidatePath(`/clientes/${clienteId}/conversas/canais/instagram`)
}
