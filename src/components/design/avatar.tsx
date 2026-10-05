import { iniciais as iniciaisDoNome } from '@/core/iniciais'
import { fonteDoRetrato } from '@/lib/retrato'

/**
 * A foto da pessoa, ou o retrato ilustrado quando ela não subiu foto
 * (`lib/retrato.ts`). As iniciais ficam para quem nem nome tem.
 *
 * Sem hook de propósito: serve ao servidor e ao cliente, e o tamanho vem de
 * fora porque o mesmo rosto aparece no rodapé (32 px) e no "Você" (56 px).
 */
export function Avatar({
  nome,
  imagem,
  tamanho = 32,
}: {
  nome: string
  imagem?: string | null
  tamanho?: number
}) {
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.36) }
  if (imagem || nome.trim() !== '') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fonteDoRetrato(imagem, nome)}
        alt=""
        style={estilo}
        className="shrink-0 rounded-full border border-line object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden
      style={estilo}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-weak font-bold text-primary"
    >
      {iniciais(nome)}
    </span>
  )
}

/** Duas letras: nome e sobrenome quando há. */
export function iniciais(nome: string): string {
  return iniciaisDoNome(nome, { palavraUnica: 2 })
}
