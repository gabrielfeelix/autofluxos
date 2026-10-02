'use client'

import { useContagem, type Contagem } from './contagens-local'
import { Badge, teto } from './pilula'

const DIZ: Record<Contagem, [string, string]> = {
  minhas: ['conversa sua com mensagem não lida', 'conversas suas com mensagem não lida'],
  'sem-dono': ['conversa sem responsável com mensagem não lida', 'conversas sem responsável com mensagem não lida'],
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
  // Coral sólido em todos: é o número que pede ação, e precisa ler de longe,
  // inclusive sobre o item aceso, que é azul cheio.
  return (
    <Badge tom="alerta" rotulo={rotulo}>
      {teto(quantidade)}
    </Badge>
  )
}
