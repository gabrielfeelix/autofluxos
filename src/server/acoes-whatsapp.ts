'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { iniciarConexao } from './instagram/estado'
import { urlDoOnboarding, whatsappConfigurado } from './whatsapp/conexao'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * O que a tela do número chama para começar o Embedded Signup hospedado.
 *
 * Confere autorização por conta própria, como todo arquivo de ação daqui: a
 * moldura protege a renderização, e Server Action é um POST que um refactor de
 * rota tira do alcance do matcher sem avisar ninguém.
 */
export async function acaoConectarWhatsapp(dados: FormData): Promise<void> {
  const clienteId = String(dados.get('clienteId') ?? '')
  // ligar e desligar canal é configurar a operação, como conectar número
  // (auditoria de 19/out/2026: antes bastava ser da organização)
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) throw new Error(acesso.erro)

  if (!whatsappConfigurado()) {
    redirect(`/clientes/${clienteId}/conversas/canais/whatsapp?resultado=sem_app`)
  }

  /*
   * A origem vem do cabeçalho, e não de uma variável, mesma razão do
   * Instagram: o `redirect_uri` precisa bater byte a byte com o cadastrado no
   * painel da Meta e com o que a rota de retorno atende.
   */
  const cabecalhos = await headers()
  const anfitriao = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  const origem = `${protocolo}://${anfitriao}`

  redirect(urlDoOnboarding({ origem, state: await iniciarConexao(clienteId) }))
}
