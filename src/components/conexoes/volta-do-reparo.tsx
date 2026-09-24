'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { voltaDaFicha, voltaInterna } from '@/core/volta-da-ficha'

/**
 * "‹ Voltar para Transmissões" em quem veio consertar a conexão (Fase 12).
 *
 * Quem abre esta página por "Conectar o WhatsApp" de uma transmissão parada
 * quer, depois do conserto, voltar para ela. O `?volta=` sozinho não chega lá:
 * a conexão passa pelo site da Meta e volta para esta página sem ele. Por isso
 * ele fica guardado na aba do navegador até a pessoa usar o link, e é conferido
 * de novo (só endereço desta conta) ao ser lido de lá.
 */
export function VoltaDoReparo({ clienteId, volta }: { clienteId: string; volta: string | null }) {
  const chave = `volta-do-reparo:${clienteId}`
  const [guardada, setGuardada] = useState<string | null>(volta)

  useEffect(() => {
    try {
      if (volta) sessionStorage.setItem(chave, volta)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage só existe depois de montar
      else setGuardada(voltaInterna(sessionStorage.getItem(chave), clienteId))
    } catch {
      // Sem sessionStorage (aba privada bloqueada): fica só o `?volta=` da URL.
    }
  }, [chave, clienteId, volta])

  if (!guardada) return null
  const { href, rotulo: secao } = voltaDaFicha(guardada, clienteId)
  // Uma transmissão específica, e não a lista delas.
  const rotulo = /\/transmissoes\/[^/?#]+/.test(href) ? 'a transmissão' : secao
  return (
    <Link
      href={href}
      onClick={() => {
        try {
          sessionStorage.removeItem(chave)
        } catch {
          // Sem sessionStorage não havia o que limpar.
        }
      }}
      className="mb-3 inline-block text-[12.5px] font-semibold text-primary hover:underline"
    >
      ‹ Voltar para {rotulo}
    </Link>
  )
}
