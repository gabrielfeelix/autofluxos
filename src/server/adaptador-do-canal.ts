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
 * na linha de cima, o webhook, a resposta manual do Inbox e o aviso de
 * ausência, cada um com a sua cópia. Com dois canais, cada cópia dessas é um
 * lugar onde o Instagram funciona ou não funciona por acidente: quem atende
 * responde pelo painel e a mensagem vai pela Cloud API, para um id que não é
 * telefone, e a Meta recusa.
 *
 * **Cada canal fala com o token dele, e o ambiente é só a sobra.** O do
 * Instagram sempre foi da conta que autorizou, no Vault apontado por
 * `channels.token_ref`. O do WhatsApp era um só, da 4YU, no ambiente, e isso
 * valia enquanto todo cliente era atendido pelo nosso número. A coexistência
 * acabou com a premissa: o número passou a ser do cliente, e o token também.
 *
 * Hoje a regra é uma: **tem `token_ref`, usa o dele**. O ambiente atende quem
 * não tem, o número da 4YU e os canais cadastrados à mão. Ver o cabeçalho da
 * migration 0040 e a 0047.
 */
export async function adaptadorDoCanal(canal: CanalSalvo): Promise<Canal> {
  if (canal.provider === 'instagram') {
    if (!canal.igUserId) {
      throw new Error('este canal é de Instagram mas não tem conta ligada; reconecte pelo painel')
    }
    const token = await lerTokenDoCanal(canal)
    return canalInstagram({ igUserId: canal.igUserId, token })
  }

  if (!canal.phoneNumberId) {
    throw new Error('este canal é de WhatsApp mas não tem número; refaça a conexão')
  }

  /*
   * **Desembarcado: nem tenta.** A migration 0047 diz que esta coluna "é o que
   * o envio consulta antes de tentar", e até aqui ninguém consultava, a tela
   * mostrava o estado e o envio seguia batendo na Meta.
   *
   * Enquanto o cliente troca de aparelho, a Cloud API recusa tudo. Falhar aqui,
   * com o motivo escrito, é melhor que uma fila de erros `131030` sem motivo
   * aparente, e a doc da Meta é clara que a reconexão acontece sozinha, sem
   * nenhuma chamada nossa. É esperar, não consertar.
   */
  if (canal.desembarcadoEm) {
    throw new Error(
      'este número está desembarcado da Cloud API (o cliente trocou de aparelho ou reinstalou o WhatsApp Business); a Meta reconecta sozinha em minutos',
    )
  }

  /*
   * **O token do cliente ganha do nosso, e a coexistência é o motivo.**
   *
   * Enquanto todo cliente era atendido pelo número da 4YU, um token no ambiente
   * bastava, é o que o cabeçalho deste arquivo dizia. O Embedded Signup acabou
   * com essa premissa: o número agora é **do cliente**, embarcado na WABA dele,
   * e o `WHATSAPP_TOKEN` da 4YU não tem permissão sobre ele. Usá-lo faz a Meta
   * recusar todo envio com `131030` / `190`, e o sintoma é o pior: o canal
   * aparece ativo, o histórico importa, os ecos chegam, e nada sai.
   *
   * O `token_ref` só existe para canal que passou pelo onboarding, então o
   * ambiente continua atendendo o número da 4YU e os canais cadastrados à mão.
   */
  if (canal.tokenRef) {
    const token = await lerTokenDoCanal(canal)
    return canalCloudApi({ phoneNumberId: canal.phoneNumberId, token })
  }

  const token = process.env.WHATSAPP_TOKEN
  if (!token) {
    throw new Error(
      'este canal não tem token próprio e falta WHATSAPP_TOKEN no ambiente deste servidor',
    )
  }

  return canalCloudApi({ phoneNumberId: canal.phoneNumberId, token })
}
