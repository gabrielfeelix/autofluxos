'use client'

import { useState, useTransition } from 'react'
import { CLASSE_DA_COR, type CorDeEtiqueta } from '@/core/etiquetas'
import { acaoMarcarEtiqueta } from '@/server/acoes'

export type EtiquetaEscolhivel = { id: string; nome: string; cor: CorDeEtiqueta }

/**
 * Aplicar e tirar etiquetas de um contato, clicando.
 *
 * **Todas as etiquetas da conta aparecem, as aplicadas acesas.** A alternativa
 * — um botão "adicionar" que abre uma lista — esconde justamente a informação
 * que a tela existe para dar: quais **não** estão aplicadas. Com poucas
 * etiquetas, que é o caso real, mostrar tudo custa menos que um clique a mais.
 *
 * O estado é otimista porque a ação é uma escrita minúscula e o custo de errar
 * é uma ficha acesa por um segundo. Esperar o servidor faria cada clique
 * parecer que não funcionou.
 */
export function SeletorDeEtiquetas({
  clienteId,
  contatoId,
  disponiveis,
  aplicadas,
}: {
  clienteId: string
  contatoId: string
  disponiveis: EtiquetaEscolhivel[]
  aplicadas: string[]
}) {
  const [marcadas, setMarcadas] = useState<string[]>(aplicadas)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  if (disponiveis.length === 0) {
    return (
      <p className="text-[11px] leading-4 text-dim">
        Nenhuma etiqueta criada ainda. Elas ficam em Configurações → Etiquetas.
      </p>
    )
  }

  const alternar = (etiquetaId: string) => {
    const aplicar = !marcadas.includes(etiquetaId)
    setErro(null)
    setMarcadas((atuais) =>
      aplicar ? [...atuais, etiquetaId] : atuais.filter((id) => id !== etiquetaId),
    )

    comecar(async () => {
      const r = await acaoMarcarEtiqueta(clienteId, etiquetaId, [contatoId], aplicar)
      if (!r.ok) {
        // Desfaz o otimismo: uma ficha acesa que o servidor recusou é pior do
        // que a recusa aparecer, porque ela mente até alguém recarregar.
        setMarcadas((atuais) =>
          aplicar ? atuais.filter((id) => id !== etiquetaId) : [...atuais, etiquetaId],
        )
        setErro(r.erro ?? 'não deu para mudar a etiqueta')
      }
    })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {disponiveis.map((etiqueta) => {
          const acesa = marcadas.includes(etiqueta.id)
          return (
            <button
              key={etiqueta.id}
              type="button"
              aria-pressed={acesa}
              onClick={() => alternar(etiqueta.id)}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                acesa
                  ? CLASSE_DA_COR[etiqueta.cor]
                  : 'border-white/[0.08] bg-transparent text-dim hover:border-white/20 hover:text-muted'
              }`}
            >
              {etiqueta.nome}
            </button>
          )
        })}
      </div>

      {erro && (
        <p role="alert" className="mt-1.5 text-[10.5px] leading-4 text-rose-300">
          {erro}
        </p>
      )}
    </div>
  )
}
