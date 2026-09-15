import 'server-only'
import { canalCloudApi } from '@/channels/cloud-api'
import type { Canal } from '@/channels/types'
import type { CanalSalvo } from './repos/conversas'

/**
 * O adaptador da Cloud API para um canal salvo.
 *
 * **Morava dentro de `receber-mensagem.ts`, privado.** Saiu porque a
 * coexistência passou a precisar dele pelo mesmo motivo: baixar a cópia da
 * mídia antes de o `id` da Meta expirar. Duplicar as quatro linhas ali daria
 * dois lugares para lembrar do `WHATSAPP_TOKEN` e um deles ficaria para trás.
 *
 * As duas recusas são explícitas de propósito. Sem token, "falta
 * `WHATSAPP_TOKEN` no ambiente" é o que quem montou o deploy precisa ler; sem
 * `phoneNumberId`, o canal é de outro produto e não fala Cloud API. Devolver um
 * adaptador quebrado faria as duas virarem erro de rede minutos depois, longe
 * da causa.
 */
export function canalDoWhatsApp(canal: CanalSalvo): Canal {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) throw new Error('falta WHATSAPP_TOKEN no ambiente')
  if (!canal.phoneNumberId) throw new Error('este canal não tem número do WhatsApp')
  return canalCloudApi({ phoneNumberId: canal.phoneNumberId, token })
}
