'use client'

import { useState, useTransition } from 'react'
import { acaoDefinirQuadroPadrao } from '@/server/acoes'

/**
 * A caixa "novo contato entra aqui" do cabeçalho do quadro (0043).
 *
 * **É a única parte visível da automação, e por isso ela diz o que faz e não
 * como se chama.** "Quadro padrão" não significa nada para quem abre a tela;
 * "novo contato entra aqui" responde a pergunta que a pessoa tem.
 *
 * O estado é otimista porque a marcação é um clique cujo efeito só aparece na
 * próxima mensagem que chegar — sem resposta imediata, a caixa parece não ter
 * funcionado e a pessoa clica de novo. Erro volta ao valor anterior e diz o
 * motivo, em vez de deixar a tela mentindo.
 */
export function QuadroPadrao({
  clienteId,
  quadroId,
  padraoInicial,
}: {
  clienteId: string
  quadroId: string
  padraoInicial: boolean
}) {
  const [padrao, setPadrao] = useState(padraoInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()

  // Trocar de quadro reusa o componente com outra prop: sem isto a caixa
  // continuaria mostrando a marcação do quadro anterior.
  const [ultimoDoServidor, setUltimoDoServidor] = useState(padraoInicial)
  if (ultimoDoServidor !== padraoInicial) {
    setUltimoDoServidor(padraoInicial)
    setPadrao(padraoInicial)
  }

  function alternar(marcado: boolean) {
    setPadrao(marcado)
    setErro(null)
    comecar(async () => {
      const r = await acaoDefinirQuadroPadrao(clienteId, quadroId, marcado)
      if (!r.ok) {
        setPadrao(!marcado)
        setErro(r.erro ?? 'não deu para salvar')
      }
    })
  }

  return (
    <label
      title="Quando alguém escreve pela primeira vez, o contato vira cartão na primeira etapa deste quadro. Só um quadro por conta pode receber."
      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-1 text-[12px] text-muted transition hover:border-white/20"
    >
      <input
        type="checkbox"
        checked={padrao}
        disabled={pendente}
        onChange={(e) => alternar(e.target.checked)}
        className="h-3.5 w-3.5 accent-accent"
      />
      {erro ?? 'Novo contato entra aqui'}
    </label>
  )
}
