import { EsqueletoDoCliente } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeLista } from '@/components/design/esqueleto'

/** Os contatos enquanto vêm. O título é o de verdade: não depende de consulta. */
export default function Carregando() {
  return (
    <EsqueletoDoCliente ativa="leads">
      <main className="flex min-h-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Contatos</h1>
        <EsqueletoDeLista rotulo="Carregando os contatos…" />
      </main>
    </EsqueletoDoCliente>
  )
}
