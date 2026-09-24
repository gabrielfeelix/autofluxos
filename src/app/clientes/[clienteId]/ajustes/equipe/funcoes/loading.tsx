import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeLista } from '@/components/design/esqueleto'

/** As funções enquanto vêm. O título é o de verdade. */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <h1 className="mt-6 mb-6 text-[25px] font-bold tracking-[-0.02em]">Funções</h1>
        <EsqueletoDeLista linhas={8} rotulo="Carregando as funções…" />
      </main>
    </MioloCarregando>
  )
}
