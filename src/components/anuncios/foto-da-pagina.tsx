/**
 * A foto da Página com o selo do Facebook no canto, como a Meta mostra no
 * Business Manager. Sem foto, a inicial do nome ocupa o lugar.
 */
export function FotoDaPagina({ foto, nome }: { foto?: string | null; nome: string }) {
  return (
    <span className="relative size-9 shrink-0" aria-hidden>
      {foto ? (
        // A foto vem do CDN da Meta, com endereço assinado e que muda: o
        // otimizador de imagem do Next só acrescentaria uma configuração.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="size-9 rounded-full border border-line object-cover" />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-strong text-[13px] font-bold text-soft">
          {(nome.trim()[0] ?? '?').toUpperCase()}
        </span>
      )}
      <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border-2 border-panel bg-[#0866ff]">
        <svg width="7" height="11" viewBox="0 0 7 13" fill="white">
          <path d="M4.5 13V7.1h2l.3-2.3H4.5V3.3c0-.7.2-1.1 1.2-1.1H7V.1C6.8.1 6 0 5.1 0 3.2 0 2 1.1 2 3.2v1.6H0v2.3h2V13h2.5Z" />
        </svg>
      </span>
    </span>
  )
}
