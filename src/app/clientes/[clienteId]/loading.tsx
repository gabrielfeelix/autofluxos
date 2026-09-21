import { EsqueletoDoCliente } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeCartoes } from '@/components/design/esqueleto'

/**
 * O painel do cliente enquanto vem.
 *
 * **Este é também o esqueleto de quem chega de fora**, da lista de clientes,
 * de um link salvo, de outra conta. É a primeira coisa que a pessoa vê da conta,
 * e por isso a barra lateral já vem escrita: ela diz onde a pessoa está antes
 * de qualquer consulta terminar.
 */
export default function Carregando() {
  return (
    <EsqueletoDoCliente ativa="inicio">
      <main className="flex min-h-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <EsqueletoDeCartoes />
      </main>
    </EsqueletoDoCliente>
  )
}
