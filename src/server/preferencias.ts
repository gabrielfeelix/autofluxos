import 'server-only'
import { cookies } from 'next/headers'
import { BARRA_RECOLHIDA, COOKIE_DA_BARRA } from '@/components/design/cookie-da-barra'

/**
 * A barra lateral está recolhida para quem pediu esta página?
 *
 * Lida no servidor para ele já desenhar a barra do tamanho certo. Ver
 * `COOKIE_DA_BARRA`: no `localStorage` a barra nascia larga e encolhia na
 * hidratação.
 */
export async function barraRecolhida(): Promise<boolean> {
  return (await cookies()).get(COOKIE_DA_BARRA)?.value === BARRA_RECOLHIDA
}
