'use client'

import { useRouter } from 'next/navigation'

/**
 * O número de Atividades no menu lateral.
 *
 * Ele mora dentro do link "Atividades", e link dentro de link não existe em
 * HTML. Por isso o número não é `<a>`: o clique nele leva direto ao recorte que
 * ele conta (vencidas, se houver; senão hoje), e o teclado continua usando o
 * link do item, que abre a agenda inteira.
 */
export function ContadorDaAgenda({
  quantidade,
  destino,
}: {
  quantidade: number
  destino: string
}) {
  const router = useRouter()
  const rotulo = `${quantidade} ${quantidade === 1 ? 'atividade vencida ou de hoje' : 'atividades vencidas ou de hoje'}`
  return (
    <span
      title={rotulo}
      aria-label={rotulo}
      onClick={(evento) => {
        evento.preventDefault()
        evento.stopPropagation()
        router.push(destino)
      }}
      className="cursor-pointer rounded-md bg-primary-weak px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-white"
    >
      {quantidade > 999 ? '999+' : quantidade}
    </span>
  )
}
