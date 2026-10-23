import { DEFINICAO_DO_CANAL, type CanalId } from '@/core/canais'
import { GLIFO_INSTAGRAM, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from './glifos-oficiais'

/**
 * Por onde esta automação fala, dito na tela, com a cara do canal.
 *
 * A pergunta apareceu na primeira vez que alguém de fora olhou o painel: "como
 * eu sei que este fluxo é do WhatsApp? e se eu quiser Instagram?". Ela não é
 * cosmética. Os limites que o editor cobra são do canal (3 botões, 10 itens de
 * lista, janela de 24h), então um desenho feito aqui **é** dessas medidas, e
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
      title={`${definicao.nome}, ${definicao.resumo}`}
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
 * Os logos em SVG inline, e não `<img>`, no desenho oficial de cada marca
 * (`glifos-oficiais.ts`).
 *
 * Acompanham a cor do texto (`currentColor`), não pedem requisição a mais e não
 * somem quando alguém mexer na pasta de assets, para um glifo de 12px é tudo
 * que importa.
 */
export function LogoDoCanal({ canal, tamanho = 12 }: { canal: CanalId; tamanho?: number }) {
  const comum = { 'aria-hidden': true, viewBox: '0 0 24 24', width: tamanho, height: tamanho }

  if (canal === 'telegram') {
    return (
      <svg {...comum} className="fill-current">
        <path d={GLIFO_TELEGRAM} />
      </svg>
    )
  }

  if (canal === 'site') {
    // Globo, e não balão de conversa: balão é o que todo canal é, e na fila
    // ao lado do WhatsApp ele não dizia "veio do site".
    return (
      <svg {...comum} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9" />
      </svg>
    )
  }

  if (canal === 'instagram') {
    return (
      <svg {...comum} className="fill-current">
        <path d={GLIFO_INSTAGRAM} />
      </svg>
    )
  }

  return (
    <svg {...comum} className="fill-current">
      <path d={GLIFO_WHATSAPP} />
    </svg>
  )
}
