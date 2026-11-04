import 'server-only'
import { db } from './db'

/**
 * A foto de perfil do contato, para Messenger e Instagram (0165).
 *
 * A Meta devolve a foto num link que expira em poucos dias, então ela é
 * baixada e guardada no nosso bucket. Busca de novo só depois de
 * `RENOVAR_EM_MS`: a pessoa troca de foto raramente, e consultar a Meta a cada
 * mensagem gastaria tempo dentro do webhook.
 *
 * Nunca estoura: foto é enfeite do Inbox, a mensagem não pode se perder junto.
 */

const BUCKET = 'autofluxos-avatares'
const RENOVAR_EM_MS = 7 * 24 * 60 * 60 * 1000
const TETO_DE_BYTES = 1_000_000

export async function atualizarFotoDoContato(opcoes: {
  clienteId: string
  /** O identificador do contato no canal (PSID ou IGSID), o `wa_id` dele. */
  idNoCanal: string
  /** Busca o link da foto na Meta. Só é chamada quando a foto está velha. */
  buscarLink: () => Promise<string | null>
}): Promise<void> {
  try {
    const { data: contato } = await db()
      .from('contacts')
      .select('id, foto_em')
      .eq('client_id', opcoes.clienteId)
      .eq('wa_id', opcoes.idNoCanal)
      .maybeSingle()
    if (!contato) return
    const { id, foto_em } = contato as { id: string; foto_em: string | null }
    if (foto_em && Date.now() - Date.parse(foto_em) < RENOVAR_EM_MS) return

    // Marca antes de baixar: duas mensagens seguidas não buscam a foto duas vezes,
    // e quem não tem foto não é consultado de novo a cada mensagem.
    await db().from('contacts').update({ foto_em: new Date().toISOString() }).eq('id', id)

    const link = await opcoes.buscarLink()
    if (!link?.startsWith('https://')) return

    const resposta = await fetch(link, { signal: AbortSignal.timeout(5_000), cache: 'no-store' })
    const tipo = resposta.headers.get('content-type') ?? ''
    if (!resposta.ok || !tipo.startsWith('image/')) return
    const bytes = await resposta.arrayBuffer()
    if (bytes.byteLength === 0 || bytes.byteLength > TETO_DE_BYTES) return

    const caminho = `contatos/${opcoes.clienteId}/${id}.jpg`
    const { error } = await db().storage.from(BUCKET).upload(caminho, bytes, { contentType: tipo, upsert: true })
    if (error) throw new Error(error.message)

    // O `?v=` troca o endereço quando a foto muda: sem ele, o navegador e a CDN
    // seguiriam mostrando a antiga.
    const publico = db().storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
    await db().from('contacts').update({ foto_url: `${publico}?v=${Date.now()}` }).eq('id', id)
  } catch (erro) {
    console.warn('[foto] não foi possível atualizar a foto do contato', erro)
  }
}
