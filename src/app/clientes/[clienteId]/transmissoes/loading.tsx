import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeLista } from '@/components/design/esqueleto'

/** As transmissões enquanto vêm. */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="flex min-h-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Transmissões
        </h1>
        <EsqueletoDeLista rotulo="Carregando as transmissões…" />
      </main>
    </MioloCarregando>
  )
}
