'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Dropdown } from '@/components/design/dropdown'

/**
 * O funil de Análise > Vendas. Escolher muda o endereço (`?funil=`), como o
 * período: a vista pode ser salva e mandada para alguém. "Todos" é o padrão
 * e some da URL.
 */
export function SeletorDeFunil({
  funis,
  escolhido,
  base,
  manter,
}: {
  funis: { id: string; nome: string }[]
  escolhido: string | null
  base: string
  manter: Record<string, string>
}) {
  const router = useRouter()
  const [carregando, iniciar] = useTransition()
  return (
    <div className={`w-full sm:w-60 ${carregando ? 'opacity-60' : ''}`}>
      <Dropdown
        rotuloAcessivel="Funil"
        valor={escolhido ?? ''}
        opcoes={[{ valor: '', rotulo: 'Todos os funis' }, ...funis.map((f) => ({ valor: f.id, rotulo: f.nome }))]}
        aoMudar={(valor) => {
          const busca = new URLSearchParams(manter)
          if (valor) busca.set('funil', valor)
          else busca.delete('funil')
          const texto = busca.toString()
          iniciar(() => router.push(texto ? `${base}?${texto}` : base))
        }}
      />
    </div>
  )
}
