import type { Metadata } from 'next'
import { lerValor, limparNome, reaisDito } from '@/core/pagamento-demo'
import { Checkout } from './checkout'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

/**
 * A página de pagamento com cartão da demonstração.
 *
 * O bot da demo manda este link quando a pessoa escolhe cartão: parece o
 * checkout de uma loja, com o valor e o nome dela, e aprova na hora. **Não
 * recebe número de cartão**: os campos vêm preenchidos com o cartão de teste
 * e não se editam, para ninguém digitar um cartão de verdade aqui.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = await searchParams
  const valor = lerValor(um(p.v))
  const nome = limparNome(um(p.n))
  return {
    title: valor ? `Pagar ${reaisDito(valor)} · ${nome}` : 'Pagamento',
    description: 'Pagamento com cartão (demonstração 4YU Tech, nada é cobrado).',
    robots: { index: false, follow: false },
  }
}

export default async function Pagina({ searchParams }: Props) {
  const p = await searchParams
  const valor = lerValor(um(p.v))
  const nome = limparNome(um(p.n))
  if (valor === null) {
    return <main style={{ padding: 24, fontFamily: 'system-ui' }}>Link de pagamento inválido.</main>
  }
  return <Checkout valor={valor} nome={nome} />
}
