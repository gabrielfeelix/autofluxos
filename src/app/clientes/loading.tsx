import { EsqueletoDoCliente } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeCartoes } from '@/components/design/esqueleto'
import { barraRecolhida } from '@/server/preferencias'

/**
 * A conta inteira enquanto vem, com a barra.
 *
 * **É o esqueleto de quem chega de fora**: da lista de clientes, de um link
 * salvo, de outra conta. Ele fica acima do `layout.tsx` da conta, então é o
 * único que desenha a barra lateral; dentro da conta a barra já está montada e
 * os `loading.tsx` das seções trocam só o miolo.
 */
export default async function Carregando() {
  return (
    <EsqueletoDoCliente ativa="inicio" recolhida={await barraRecolhida()}>
      <main className="flex min-h-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <EsqueletoDeCartoes />
      </main>
    </EsqueletoDoCliente>
  )
}
