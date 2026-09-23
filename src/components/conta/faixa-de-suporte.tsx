import Link from 'next/link'
import { conferirAcessoAoCliente } from '@/server/sessao'

/**
 * A faixa do administrador da 4YU dentro da conta de um cliente (E9).
 *
 * Ele entra sem ser membro e passa por tudo (`conferirAcessoAoCliente`), então
 * a diferença entre "estou olhando como suporte" e "estou na minha conta"
 * precisa estar em toda tela, e não só num selo no rodapé. Mesma lógica da
 * faixa de "entrar como": fixa no topo, com o caminho de saída junto.
 *
 * Não aparece quando ele entrou **como** outra pessoa: aí a faixa de
 * impersonação já fala, e duas faixas dizendo coisas diferentes confundem.
 */
export async function FaixaDeSuporte({ clienteId }: { clienteId: string }) {
  const acesso = await conferirAcessoAoCliente(clienteId)
  if (!acesso || acesso.papel !== null || acesso.sessao.impersonadoPor) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-info/30 bg-info/10 px-4 py-2 backdrop-blur md:px-6"
    >
      <p className="text-[12.5px] leading-5 text-info">
        Você está nesta conta como <strong className="font-semibold">Suporte 4YU</strong>. Suas
        ações ficam registradas com o seu nome.
      </p>
      <Link
        href="/painel"
        className="rounded-lg border border-info/40 px-2.5 py-1 text-[11.5px] font-bold text-info transition hover:bg-info/10"
      >
        Sair da conta
      </Link>
    </div>
  )
}
