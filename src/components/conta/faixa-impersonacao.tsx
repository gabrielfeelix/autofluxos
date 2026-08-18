import { acaoPararDeEntrarComo } from '@/server/acoes-conta'
import { acharUsuario, sessaoAtual } from '@/server/sessao'

/**
 * A faixa que avisa de quem é a conta que você está vendo.
 *
 * **Ela é o freio do "entrar como".** Sem ela, é questão de tempo até alguém
 * publicar um fluxo achando que está na própria conta — e no AutoFluxos
 * publicar um fluxo muda o que o WhatsApp de um cliente responde para gente de
 * verdade. Por isso ela é âmbar, fica no topo, não some ao rolar e carrega o
 * botão de voltar: as três coisas juntas é que fazem alguém notar.
 *
 * Aparece em toda tela que uma sessão impersonada alcança — a moldura do
 * cliente, o editor de fluxo, o seletor de companhia e a área do administrador.
 * O editor precisa dela **explicitamente** porque é tela cheia e não usa
 * moldura nenhuma; é também a tela onde o erro custa mais caro.
 */
export async function FaixaDeImpersonacao() {
  const sessao = await sessaoAtual()
  if (!sessao?.impersonadoPor) return null

  const administrador = await acharUsuario(sessao.impersonadoPor)

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-amber-400/30 bg-amber-400/[0.13] px-4 py-2 backdrop-blur md:px-6"
    >
      <p className="text-[12.5px] leading-5 text-amber-100">
        {/* Ícone **e** texto: quem não distingue âmbar de cinza precisa ler o
            aviso do mesmo jeito (WCAG 1.4.1). */}
        <span aria-hidden className="mr-1.5">
          ⚠
        </span>
        Você está no painel <strong className="font-semibold">como {sessao.usuario.nome}</strong>{' '}
        <span className="text-amber-200/70">({sessao.usuario.email})</span>. Tudo que você fizer
        aqui fica registrado no nome dele.
      </p>

      <form action={acaoPararDeEntrarComo}>
        <button
          type="submit"
          className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-[11.5px] font-bold text-amber-100 transition hover:bg-amber-300/20"
        >
          Voltar a ser {administrador?.nome ?? 'você'}
        </button>
      </form>
    </div>
  )
}
