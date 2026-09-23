import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeCartoes } from '@/components/design/esqueleto'

/**
 * O Painel enquanto vem, só o miolo: a barra já está na tela, no layout. O
 * esqueleto de quem chega de fora, com a barra, é `clientes/loading.tsx`.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="flex min-h-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <EsqueletoDeCartoes />
      </main>
    </MioloCarregando>
  )
}
