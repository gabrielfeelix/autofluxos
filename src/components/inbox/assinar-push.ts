import { base64urlParaBytes } from '@/core/vapid'

/**
 * A parte do push que roda no navegador: registrar o worker e assinar.
 *
 * Separada do componente porque é a metade que fala com API do navegador e não
 * tem nada de React. O componente decide **quando**; isto sabe **como**.
 *
 * O que ela faz, e que a notificação local não fazia: a `Notification` que o
 * `NotificacoesDaFila` já usava só existe enquanto a aba está aberta. Push é o
 * contrário — chega no service worker, com o painel fechado, que é o buraco
 * que o §3.10.1 chama de elo mais fraco do produto.
 */

/** A chave pública do VAPID, que o servidor assina e o navegador confere. */
const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

/** A conversão mora no `core` para ser testável sem navegador. */
const chaveEmBytes = (chave: string) => base64urlParaBytes(chave, (t) => window.atob(t))

export function pushDisponivel(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    CHAVE_PUBLICA !== ''
  )
}

/** O formato que a Server Action confere e guarda. */
export type AssinaturaParaOServidor = {
  endpoint: string
  p256dh: string
  auth: string
}

function paraOServidor(assinatura: PushSubscription): AssinaturaParaOServidor | null {
  const bruta = assinatura.toJSON()
  const chaves = bruta.keys
  if (!bruta.endpoint || !chaves?.p256dh || !chaves.auth) return null
  return { endpoint: bruta.endpoint, p256dh: chaves.p256dh, auth: chaves.auth }
}

/**
 * Registra o worker e devolve a assinatura deste navegador.
 *
 * `null` quando o navegador não faz push, quando a permissão não foi dada, ou
 * quando algo falhou — e falhar aqui **não** é erro de tela: o aviso local
 * continua funcionando, e o produto segue como sempre foi.
 */
export async function assinarPush(): Promise<AssinaturaParaOServidor | null> {
  if (!pushDisponivel()) return null
  if (window.Notification.permission !== 'granted') return null

  try {
    const registro = await navigator.serviceWorker.register('/sw-push.js')
    await navigator.serviceWorker.ready

    /*
     * Reaproveitar a assinatura existente, e não criar outra.
     *
     * `subscribe` num navegador já assinado devolve a mesma; pedir de novo com
     * chave diferente estoura. Buscar antes é o que faz reabrir o painel ser
     * barato em vez de virar uma chamada ao fabricante por visita.
     */
    const jaTem = await registro.pushManager.getSubscription()
    if (jaTem) return paraOServidor(jaTem)

    const nova = await registro.pushManager.subscribe({
      // Exigido por todos os navegadores: nada de push silencioso. Toda
      // mensagem que chega tem que virar notificação visível.
      userVisibleOnly: true,
      applicationServerKey: chaveEmBytes(CHAVE_PUBLICA),
    })
    return paraOServidor(nova)
  } catch {
    return null
  }
}

/** Desliga naquele navegador, e devolve o endpoint que saiu. */
export async function cancelarPush(): Promise<string | null> {
  if (!pushDisponivel()) return null
  try {
    const registro = await navigator.serviceWorker.getRegistration('/sw-push.js')
    const assinatura = await registro?.pushManager.getSubscription()
    if (!assinatura) return null
    const endpoint = assinatura.endpoint
    await assinatura.unsubscribe()
    return endpoint
  } catch {
    return null
  }
}
