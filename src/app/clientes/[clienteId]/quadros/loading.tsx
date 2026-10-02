import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDoFunil } from '@/components/design/esqueleto'

/** O funil enquanto vem, na largura toda, como a tela real. */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="flex h-full min-h-0 flex-col px-4 pt-[26px] pb-5 md:px-[42px]">
        <EsqueletoDoFunil />
      </main>
    </MioloCarregando>
  )
}
