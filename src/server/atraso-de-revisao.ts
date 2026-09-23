import { cookies } from 'next/headers'

/**
 * Segura o miolo da tela **só no `next dev`**, quando o cookie
 * `revisao-atraso-ms` existe. Serve ao `scripts/ux-local/esqueletos.mjs`: o
 * esqueleto (`loading.tsx`) chega no fluxo na hora e fica na tela o tempo de
 * tirar o print; depois vem a página. Em produção a função não faz nada, nem
 * lê o cookie.
 */
export async function atrasoDeRevisao(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return
  const ms = Number((await cookies()).get('revisao-atraso-ms')?.value)
  if (ms > 0) await new Promise((resolver) => setTimeout(resolver, Math.min(ms, 30000)))
}
