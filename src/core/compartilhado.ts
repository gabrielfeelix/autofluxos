/**
 * Reel, post, story e link que a pessoa compartilhou no Instagram ou no
 * Messenger.
 *
 * Não são arquivo: o anexo traz o **endereço público** do conteúdo
 * (`instagram.com/reel/...`), e não os bytes. Baixar isso devolveria a página
 * HTML do Instagram, que o bucket recusa e a bolha não sabe desenhar. O que a
 * conversa precisa mostrar é o que o Instagram mostra: um cartão dizendo o que
 * foi compartilhado, que abre no app.
 *
 * O post compartilhado é o caso misto: a Meta manda a **prévia** dele numa URL
 * de CDN (imagem 1080px), sem o link do post. Essa prévia é baixada como foto, e
 * o cartão só diz o que ela é.
 */

export type TipoDeCompartilhado = 'reel' | 'post' | 'story' | 'link'

export type Compartilhado = {
  tipo: TipoDeCompartilhado
  /** O endereço público, quando existe. A prévia do post não traz. */
  url?: string
  /** A legenda do reel, quando a Meta manda. */
  titulo?: string
}

/** O rótulo da bolha e da prévia. */
export const ROTULO_DO_COMPARTILHADO: Record<TipoDeCompartilhado, string> = {
  reel: 'Reel compartilhado',
  post: 'Post compartilhado',
  story: 'Mencionou você no story',
  link: 'Link compartilhado',
}

const TIPOS: readonly TipoDeCompartilhado[] = ['reel', 'post', 'story', 'link']

/** O tipo que um endereço do Instagram aponta, ou `null` se não é do Instagram. */
export function tipoDoLinkDoInstagram(url: string | undefined): TipoDeCompartilhado | null {
  if (!url) return null
  let endereco: URL
  try {
    endereco = new URL(url)
  } catch {
    return null
  }
  if (!/(^|\.)instagram\.com$/.test(endereco.hostname)) return null
  const primeiro = endereco.pathname.split('/').filter(Boolean)[0]
  if (primeiro === 'reel' || primeiro === 'reels') return 'reel'
  if (primeiro === 'p' || primeiro === 'tv') return 'post'
  if (primeiro === 'stories') return 'story'
  return null
}

/**
 * O player oficial do Instagram para um reel ou post público, ou `null`.
 *
 * É o mesmo `/embed/` que o botão "Incorporar" do Instagram gera: mostra a
 * capa e toca o vídeo ali dentro, sem baixar nada nem pedir permissão de API.
 * Conta privada ou post apagado mostram o aviso do próprio Instagram.
 */
export function embedDoInstagram(url: string | undefined): string | null {
  if (!url || !tipoDoLinkDoInstagram(url)) return null
  const [tipo, codigo] = new URL(url).pathname.split('/').filter(Boolean)
  if (!codigo || !/^[A-Za-z0-9_-]+$/.test(codigo)) return null
  if (tipo === 'reel' || tipo === 'reels') return `https://www.instagram.com/reel/${codigo}/embed/`
  if (tipo === 'p' || tipo === 'tv') return `https://www.instagram.com/p/${codigo}/embed/`
  return null
}

/**
 * Os hosts de onde a Meta serve anexo de direct. Só destes o servidor baixa.
 *
 * A URL chega no webhook, e baixar qualquer endereço que venha de fora é pedir
 * para o servidor buscar o que alguém quiser (SSRF). O webhook é assinado, mas
 * a lista fechada custa uma linha e não depende disso.
 *
 * `giphy.com` entra porque o GIF que a pessoa escolhe no teclado do Instagram
 * chega como imagem hospedada lá (medido em 20/set/2026).
 */
const HOSTS_DE_ARQUIVO = [/(^|\.)fbsbx\.com$/, /(^|\.)fbcdn\.net$/, /(^|\.)cdninstagram\.com$/, /(^|\.)giphy\.com$/]

export function ehArquivoDaMeta(url: string | undefined): boolean {
  if (!url) return false
  try {
    const endereco = new URL(url)
    return endereco.protocol === 'https:' && HOSTS_DE_ARQUIVO.some((h) => h.test(endereco.hostname))
  } catch {
    return false
  }
}

/** O compartilhado gravado no `payload`, validado. */
export function compartilhadoDoPayload(payload: unknown): Compartilhado | null {
  const bruto = (payload as { compartilhado?: unknown } | null)?.compartilhado
  if (!bruto || typeof bruto !== 'object') return null
  const c = bruto as Record<string, unknown>
  if (typeof c.tipo !== 'string' || !(TIPOS as readonly string[]).includes(c.tipo)) return null
  // Só http(s) vira link clicável na tela.
  const url = typeof c.url === 'string' && /^https?:\/\//.test(c.url) ? c.url : undefined
  const titulo = typeof c.titulo === 'string' && c.titulo.trim() !== '' ? c.titulo.trim() : undefined
  return { tipo: c.tipo as TipoDeCompartilhado, ...(url ? { url } : {}), ...(titulo ? { titulo } : {}) }
}
