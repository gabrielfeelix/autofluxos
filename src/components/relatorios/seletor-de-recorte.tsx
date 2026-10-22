import Link from 'next/link'
import { ROTULO_DO_RECORTE, type Recorte } from '@/core/recorte-da-analise'

/**
 * Eu / Equipe / Conta, como o período: links que mudam o endereço (`?ver=`).
 * O maior recorte é o padrão e some da URL. Com um recorte só, não aparece.
 */
export function SeletorDeRecorte({
  possiveis,
  escolhido,
  base,
  manter,
}: {
  possiveis: readonly Recorte[]
  escolhido: Recorte | null
  base: string
  manter: Record<string, string>
}) {
  if (possiveis.length < 2) return null
  const maior = possiveis[possiveis.length - 1]
  const endereco = (recorte: Recorte) => {
    const busca = new URLSearchParams(manter)
    if (recorte === maior) busca.delete('ver')
    else busca.set('ver', recorte)
    const texto = busca.toString()
    return texto ? `${base}?${texto}` : base
  }
  return (
    <nav aria-label="Ver os números de" className="alternador self-start">
      {possiveis.map((r) => (
        <Link key={r} href={endereco(r)} aria-current={escolhido === r ? 'page' : undefined} className="alternador-opcao">
          {ROTULO_DO_RECORTE[r]}
        </Link>
      ))}
    </nav>
  )
}
