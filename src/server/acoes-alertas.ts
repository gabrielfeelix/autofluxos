'use server'

import { revalidatePath } from 'next/cache'
import { marcarAlertaVisto } from './repos/alertas'
import { exigirAdminDaPlataforma } from './sessao'

/**
 * O que a tela `/admin/alertas` chama.
 *
 * **Confere a autorização por conta própria**, como todo arquivo de ação deste
 * projeto: o `layout.tsx` do admin protege a *renderização*, e Server Action é
 * um POST que um refactor de rota tira do alcance do matcher sem avisar
 * ninguém. Quem autoriza é o servidor que executa.
 *
 * Marcar como visto não é operação sensível — não apaga nada e não conta nada
 * de ninguém. Mas o alerta carrega id de contato no contexto, e listar isso já
 * é contar de cliente para quem talvez não seja dele.
 */

export async function acaoMarcarAlertaVisto(dados: FormData): Promise<void> {
  await exigirAdminDaPlataforma()

  const id = String(dados.get('id') ?? '')
  if (!id) return

  await marcarAlertaVisto(id)
  revalidatePath('/admin/alertas')
}

export async function acaoMarcarTodosOsAlertasVistos(): Promise<void> {
  await exigirAdminDaPlataforma()

  await marcarAlertaVisto()
  revalidatePath('/admin/alertas')
}
