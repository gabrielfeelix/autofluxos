'use server'

import { ativarFormulario } from './formularios-do-whatsapp/ativar'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * Ativar o formulário de agendamento num número (Ajustes > Credenciais, no
 * cartão da Verandi). Quem configura a operação pode; a tela muda na hora e
 * mostra o desfecho, sem recarregar.
 */
export async function acaoAtivarFormulario(
  clienteId: string,
  canalId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'Sem permissão.' }
  const resultado = await ativarFormulario(clienteId, canalId)
  return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro }
}
