import 'server-only'
import { canalCloudApi } from '@/channels/cloud-api'
import { canalInstagram } from '@/channels/instagram'
import type { Canal } from '@/channels/types'
import { type CanalSalvo, lerTokenDoCanal } from './repos/conversas'

/**
 * Qual adaptador fala por este canal.
 *
 * **Um lugar só, e isso é o ponto.** Antes do Instagram existir, todo caminho
 * de saída montava o `canalCloudApi` na mão, com `process.env.WHATSAPP_TOKEN`
 * na linha de cima — o webhook, a resposta manual do Inbox e o aviso de
 * ausência, cada um com a sua cópia. Com dois canais, cada cópia dessas é um
 * lugar onde o Instagram funciona ou não funciona por acidente: quem atende
 * responde pelo painel e a mensagem vai pela Cloud API, para um id que não é
 * telefone, e a Meta recusa.
 *
 * **Os dois tokens não vêm do mesmo lugar, e nunca virão.** O do WhatsApp é um
 * só, da 4YU, e mora no ambiente — hoje todo cliente é atendido pelo nosso
 * número. O do Instagram é da conta que autorizou o acesso, vive no Vault
 * apontado por `channels.token_ref` e vence em 60 dias. Ver o cabeçalho da
 * migration 0040.
 */
export async function adaptadorDoCanal(canal: CanalSalvo): Promise<Canal> {
  if (canal.provider === 'instagram') {
    if (!canal.igUserId) {
      throw new Error('este canal é de Instagram mas não tem conta ligada; reconecte pelo painel')
    }
    const token = await lerTokenDoCanal(canal)
    return canalInstagram({ igUserId: canal.igUserId, token })
  }

  const token = process.env.WHATSAPP_TOKEN
  if (!token) throw new Error('falta WHATSAPP_TOKEN no ambiente deste servidor')
  if (!canal.phoneNumberId) {
    throw new Error('este canal é de WhatsApp mas não tem número; refaça a conexão')
  }

  return canalCloudApi({ phoneNumberId: canal.phoneNumberId, token })
}
