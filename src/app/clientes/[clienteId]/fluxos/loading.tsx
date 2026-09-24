import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeCartoes } from '@/components/design/esqueleto'

/** As automações enquanto vêm. */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="flex min-h-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        {/* O subitem (Fluxos, Gatilhos, Sequências) vem na busca, que o loading não lê: o título espera. */}
        <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-dim uppercase">Automações</p>
        <span className="app-esqueleto mb-5 block h-[30px] w-40 rounded-lg" />
        <EsqueletoDeCartoes />
      </main>
    </MioloCarregando>
  )
}
