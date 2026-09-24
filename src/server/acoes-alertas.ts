'use server'

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
 * Marcar como visto não é operação sensível, não apaga nada e não conta nada
 * de ninguém. Mas o alerta carrega id de contato no contexto, e listar isso já
 * é contar de cliente para quem talvez não seja dele.
 */

/**
 * Marca um alerta (ou todos, sem id) como visto, para a tabela de Alertas.
 *
 * Devolve o resultado e não revalida a tela aberta: a linha já esmaeceu na
 * hora (ação otimista) e só volta se isto falhar.
 */
export async function acaoVerAlerta(id?: string): Promise<{ ok: boolean; erro?: string }> {
  await exigirAdminDaPlataforma()
  try {
    await marcarAlertaVisto(id)
    return { ok: true }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para marcar' }
  }
}
