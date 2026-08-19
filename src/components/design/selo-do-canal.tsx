import { DEFINICAO_DO_CANAL, type CanalId } from '@/core/canais'

/**
 * Por onde esta automação fala — dito na tela, com a cara do canal.
 *
 * A pergunta apareceu na primeira vez que alguém de fora olhou o painel: "como
 * eu sei que este fluxo é do WhatsApp? e se eu quiser Instagram?". Ela não é
 * cosmética. Os limites que o editor cobra são do canal (3 botões, 10 itens de
 * lista, janela de 24h), então um desenho feito aqui **é** dessas medidas — e
 * saber de quem elas são é parte de entender por que o validador recusa.
 *
 * A cor é a da marca do canal, e fica **só no selo**. Pintar a tela inteira de
 * verde no fluxo de WhatsApp e de rosa no de Instagram é tentador e erra duas
 * vezes: troca a identidade do produto pela do canal, e obriga a redesenhar
 * tudo a cada canal novo. O selo carrega a informação; o resto continua sendo
 * o AutoFluxos.
 */
export function SeloDoCanal({
  canal,
  compacto = false,
}: {
  canal: CanalId
  compacto?: boolean
}) {
  const definicao = DEFINICAO_DO_CANAL[canal]

  return (
    <span
      title={`${definicao.nome} — ${definicao.resumo}`}
      style={{
        // `color-mix` em vez de três classes por canal: a cor vem do catálogo,
        // então canal novo não pede CSS novo.
        color: definicao.cor,
        borderColor: `color-mix(in oklab, ${definicao.cor} 30%, transparent)`,
        background: `color-mix(in oklab, ${definicao.cor} 10%, transparent)`,
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold ${
        compacto ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      <LogoDoCanal canal={canal} />
      {definicao.nome}
    </span>
  )
}

/**
 * Os logos em SVG inline, e não `<img>`.
 *
 * Acompanham a cor do texto (`currentColor`), não pedem requisição a mais e não
 * somem quando alguém mexer na pasta de assets — para um glifo de 12px é tudo
 * que importa.
 */
export function LogoDoCanal({ canal, tamanho = 12 }: { canal: CanalId; tamanho?: number }) {
  const comum = { 'aria-hidden': true, viewBox: '0 0 24 24', width: tamanho, height: tamanho }

  if (canal === 'telegram') {
    return (
      <svg {...comum} className="fill-current">
        <path d="M21.94 4.3 18.9 19.1c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.95.46l.34-4.8 8.73-7.9c.38-.34-.08-.53-.59-.19L6.98 12.9l-4.65-1.46c-1.01-.32-1.03-1.01.21-1.5L20.63 2.9c.84-.31 1.58.19 1.31 1.4Z" />
      </svg>
    )
  }

  if (canal === 'instagram') {
    return (
      <svg {...comum} className="fill-current">
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9c-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.8c-3.14 0-3.51.01-4.75.07-1.15.05-1.77.24-2.18.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.41-.35 1.03-.4 2.18-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05 1.15.24 1.77.4 2.18.22.55.47.94.88 1.35.41.41.8.66 1.35.88.41.16 1.03.35 2.18.4 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c1.15-.05 1.77-.24 2.18-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.41.35-1.03.4-2.18.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-1.15-.24-1.77-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.18-.4-1.24-.06-1.61-.07-4.75-.07Zm0 3.06a4.98 4.98 0 1 1 0 9.96 4.98 4.98 0 0 1 0-9.96Zm0 8.21a3.23 3.23 0 1 0 0-6.46 3.23 3.23 0 0 0 0 6.46Zm6.34-8.41a1.16 1.16 0 1 1-2.33 0 1.16 1.16 0 0 1 2.33 0Z" />
      </svg>
    )
  }

  return (
    <svg {...comum} className="fill-current">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.79.97-.14.16-.29.19-.54.06-.25-.12-1.05-.38-1.99-1.23-.74-.65-1.24-1.46-1.38-1.71-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  )
}
