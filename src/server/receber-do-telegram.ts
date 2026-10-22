import 'server-only'
import { z } from 'zod'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { alertar } from './alertar'
import { type FabricaDeCanal, type Mensagem, tratarUma } from './receber-mensagem'
import { lerTokenDoCanal } from './repos/conversas'
import { acharCanalPorBot } from './repos/canais-telegram'
import { responderToque } from './telegram/bot-api'

/**
 * O que um bot do Telegram recebe, até a mesma porta das outras conversas
 * (0140, docs/PLANO-9-DA-COLMEIA.md, item 8).
 *
 * O Telegram manda um `update` por vez. Dois tipos interessam: `message`
 * (alguém escreveu) e `callback_query` (alguém tocou num botão que o bot
 * mandou). O resto, edição, entrada em grupo, é ignorado sem ruído.
 *
 * **Só conversa privada.** Bot adicionado a um grupo receberia a conversa do
 * grupo inteiro, e cada pessoa ali viraria contato do cliente sem ter falado
 * com ele.
 *
 * O endereço de quem escreveu é o `chat.id`, um número estável por par (bot,
 * pessoa). É ele que vai em `contacts.wa_id`, como o IGSID do Instagram: o
 * campo nasceu do WhatsApp e guarda "por onde responder".
 */

const usuarioSchema = z.object({ id: z.number(), first_name: z.string().optional(), last_name: z.string().optional(), username: z.string().optional() })
const chatSchema = z.object({ id: z.number(), type: z.string() })
/** Todo anexo do Telegram tem um `file_id`, que o adaptador troca pelo arquivo (`getFile`). */
const arquivoSchema = z.object({ file_id: z.string() })
const mensagemSchema = z.object({
  message_id: z.number(),
  from: usuarioSchema.optional(),
  chat: chatSchema,
  text: z.string().optional(),
  caption: z.string().optional(),
  photo: z.array(arquivoSchema).optional(),
  voice: arquivoSchema.optional(),
  audio: arquivoSchema.optional(),
  video: arquivoSchema.optional(),
  document: arquivoSchema.optional(),
  sticker: arquivoSchema.optional(),
})
export const updateDoTelegramSchema = z.object({
  update_id: z.number(),
  message: mensagemSchema.optional(),
  callback_query: z
    .object({ id: z.string(), from: usuarioSchema, data: z.string().optional(), message: mensagemSchema.optional() })
    .optional(),
})

type Update = z.infer<typeof updateDoTelegramSchema>

function nomeDe(u: z.infer<typeof usuarioSchema> | undefined): string | null {
  if (!u) return null
  const nome = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return nome || (u.username ? `@${u.username}` : null)
}

/**
 * O update no formato interno, ou `null` quando não é conversa.
 *
 * Mídia chega no formato do WhatsApp (`image`, `audio`, `video`,
 * `document`, `sticker`) com o `file_id` no lugar do id da Meta: o adaptador
 * do Telegram baixa pelo `getFile`, e daí em diante foto, áudio e arquivo
 * seguem o mesmo caminho das outras conversas (guardados, lidos pela IA,
 * saída "mandou arquivo" do fluxo). Voz é áudio; da foto, a maior resolução.
 */
export function paraMensagemDoTelegram(update: Update): { mensagem: Mensagem; nome: string | null } | null {
  const toque = update.callback_query
  if (toque?.message && toque.data) {
    if (toque.message.chat.type !== 'private') return null
    return {
      nome: nomeDe(toque.from),
      mensagem: {
        id: `tg-${toque.id}`,
        from: String(toque.message.chat.id),
        type: 'interactive',
        interactive: { button_reply: { id: toque.data } },
      } as Mensagem,
    }
  }

  const m = update.message
  if (!m || m.chat.type !== 'private') return null
  const base = { id: `tg-${m.chat.id}-${m.message_id}`, from: String(m.chat.id) }

  if (m.text !== undefined) {
    return { nome: nomeDe(m.from), mensagem: { ...base, type: 'text', text: { body: m.text } } as Mensagem }
  }

  // Legenda só onde o WhatsApp tem: voz e figurinha não carregam.
  const legenda = m.caption ? { caption: m.caption } : {}
  const voz = m.voice ?? m.audio
  const foto = m.photo?.at(-1)
  const anexo: { type: string; arquivo: { id: string; caption?: string } } | null = foto
    ? { type: 'image', arquivo: { id: foto.file_id, ...legenda } }
    : voz
      ? { type: 'audio', arquivo: { id: voz.file_id } }
      : m.video
        ? { type: 'video', arquivo: { id: m.video.file_id, ...legenda } }
        : m.document
          ? { type: 'document', arquivo: { id: m.document.file_id, ...legenda } }
          : m.sticker
            ? { type: 'sticker', arquivo: { id: m.sticker.file_id } }
            : null
  if (!anexo) return null
  return { nome: nomeDe(m.from), mensagem: { ...base, type: anexo.type, [anexo.type]: anexo.arquivo } as Mensagem }
}

export async function receberDoTelegram(botId: string, payload: unknown, fabricaDeCanal?: FabricaDeCanal): Promise<void> {
  const analise = updateDoTelegramSchema.safeParse(payload)
  if (!analise.success) return

  const canal = await acharCanalPorBot(botId)
  if (!canal) {
    await alertar('o Telegram mandou mensagem para um bot que não está ligado', new Error(`bot ${botId}`), { bot: botId })
    return
  }
  if (canal.status !== 'ativo') return

  const lido = paraMensagemDoTelegram(analise.data)
  if (!lido) return

  // O relógio do botão para de girar antes de o fluxo responder.
  if (analise.data.callback_query) await responderToque(await lerTokenDoCanal(canal), analise.data.callback_query.id)

  const adaptador = fabricaDeCanal ? null : await adaptadorDoCanal(canal)
  await tratarUma(canal, lido.mensagem, lido.nome, fabricaDeCanal ?? (() => adaptador!))
}
