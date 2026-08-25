import Link from 'next/link'

/**
 * O ponto de interrogação no topo da barra — a porta da Ajuda.
 *
 * **Fica ao lado da marca, e não como item da navegação.** Os itens da barra são
 * lugares onde se trabalha: Inbox, Contatos, Quadros, Automações. Ajuda não é um
 * desses — é o que se procura quando o trabalho travou, e o gesto conhecido para
 * isso é o `?` no cabeçalho, não uma linha a mais na lista que já tem seis.
 *
 * Aparece nas **duas** molduras (a lista de clientes e as telas do cliente)
 * porque a dúvida não escolhe tela. E aparece no celular pelo mesmo motivo: lá
 * a barra vira faixa no topo, e a faixa é justamente o cabeçalho.
 */
export function BotaoDeAjuda() {
  return (
    <Link
      href="/ajuda"
      title="Ajuda"
      aria-label="Ajuda"
      className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-[12px] font-bold text-dim transition hover:border-accent/50 hover:bg-accent/[0.1] hover:text-accent"
    >
      <span aria-hidden>?</span>
    </Link>
  )
}
