'use client'

import { useState, type ReactNode } from 'react'
import { useAnotadas } from './anotacoes'

/**
 * As duas abas da coluna do contato no Inbox: "Contato" e "Anotações".
 *
 * A coluna era uma pilha só, atendimento, dados, etiquetas, funil, anotações e
 * campos coletados, e as anotações moravam depois de tudo: quem queria ler o
 * que a equipe escreveu rolava a coluna inteira a cada conversa. O dono pediu o
 * arranjo da referência (24/set), "pra eu não precisar scrollar pro resto da
 * vida". Dividir em duas abas põe as duas perguntas mais comuns, "quem é" e "o
 * que já disseram dela", a um clique cada.
 *
 * O conteúdo das duas chega pronto do servidor como `ReactNode`: a aba só
 * escolhe qual mostrar. A escondida continua montada (`hidden`), para o
 * rascunho de uma anotação não sumir ao trocar de aba.
 */
export function AbasDaFicha({ contato, anotacoes }: { contato: ReactNode; anotacoes: ReactNode }) {
  const [aba, setAba] = useState<'contato' | 'anotacoes'>('contato')

  /*
   * Anotou pela barra da conversa, a coluna abre em Anotações: a nota nova
   * aparece onde a pessoa vai procurar por ela. Comparado no render, e não num
   * efeito, para a troca sair no mesmo quadro da anotação.
   */
  const anotadas = useAnotadas()
  const [vistas, setVistas] = useState(anotadas)
  if (anotadas !== vistas) {
    setVistas(anotadas)
    if (anotadas > vistas) setAba('anotacoes')
  }

  return (
    <>
      {/* O trilho do `Alternador`, como Lista | Agenda: o dono escolheu este
          desenho para toda troca de modo (02/out/2026). Fica `role="tab"`. */}
      <div className="px-4 pt-4">
      <div role="tablist" aria-label="Sobre o contato" className="alternador flex w-full">
        <Aba ativa={aba === 'contato'} aoClicar={() => setAba('contato')}>
          Contato
        </Aba>
        <Aba ativa={aba === 'anotacoes'} aoClicar={() => setAba('anotacoes')}>
          Anotações
        </Aba>
      </div>
      </div>
      <div role="tabpanel" hidden={aba !== 'contato'} className="p-4">
        {contato}
      </div>
      <div role="tabpanel" hidden={aba !== 'anotacoes'} className="p-4">
        {anotacoes}
      </div>
    </>
  )
}

function Aba({
  ativa,
  aoClicar,
  children,
}: {
  ativa: boolean
  aoClicar: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={aoClicar}
      className="alternador-opcao flex-1"
    >
      {children}
    </button>
  )
}
