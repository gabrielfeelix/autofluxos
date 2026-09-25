'use client'

import { useContagem, type Contagem } from './contagens-local'

const DIZ: Record<Contagem, [string, string]> = {
  minhas: ['conversa aberta com você', 'conversas abertas com você'],
  'sem-dono': ['conversa sem responsável', 'conversas sem responsável'],
  atrasadas: ['atividade atrasada', 'atividades atrasadas'],
}

/**
 * O número de um item do menu, com o que esta aba acabou de mexer
 * (`contagens-local.ts`). Assumir uma conversa ou concluir uma atividade
 * muda o número no clique, sem esperar o layout voltar do servidor.
 */
export function NumeroDaBarra({ qual, doServidor }: { qual: Contagem; doServidor: number }) {
  const quantidade = useContagem(qual, doServidor)
  if (!quantidade) return null
  const rotulo = `${quantidade} ${DIZ[qual][quantidade === 1 ? 0 : 1]}`
  // Atrasada é a única que já passou da hora: a cor diz isso antes do número.
  const tom = qual === 'atrasadas' ? 'bg-perigo/12 text-perigo' : 'bg-primary-weak text-primary'
  return (
    <span title={rotulo} aria-label={rotulo} className={`min-w-[20px] rounded-full px-1.5 py-px text-center text-[10.5px] font-bold tabular-nums ${tom}`}>
      {quantidade > 99 ? '99+' : quantidade}
    </span>
  )
}
