'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { acaoImportarFluxoCompartilhado } from '@/server/acoes'

export type DestinoDaImportacao = { id: string; nome: string }

/**
 * O botão que traz o fluxo compartilhado para uma conta.
 *
 * É componente de cliente por dois motivos, e os dois são de recado: a ação
 * devolve motivo de recusa (link revogado enquanto a página estava aberta, por
 * exemplo) e um `<form>` cru jogaria isso fora; e o destino é uma escolha entre
 * contas, que precisa estar preenchida antes de o botão fazer sentido.
 *
 * **O `try/catch` não é opcional.** Promessa rejeitada dentro de
 * `useTransition` sobe para a fronteira de erro do React e derruba a tela
 * inteira — numa página pública, isso é a pessoa recebendo "Alguma coisa
 * quebrou aqui" no lugar do fluxo que alguém lhe mandou.
 */
export function ImportarFluxo({
  token,
  destinos,
}: {
  token: string
  destinos: DestinoDaImportacao[]
}) {
  const router = useRouter()
  const [destino, setDestino] = useState(destinos[0]?.id ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  if (destinos.length === 0) return null

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {destinos.length > 1 && (
          <select
            value={destino}
            aria-label="Conta que recebe o fluxo"
            onChange={(e) => setDestino(e.target.value)}
            className="app-field min-w-0 flex-1 px-3 py-2.5 text-[12.5px]"
          >
            {destinos.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          disabled={rodando || destino === ''}
          onClick={() => {
            setErro(null)
            comecar(async () => {
              try {
                const r = await acaoImportarFluxoCompartilhado(destino, token)
                if (!r.ok || !r.fluxoId) {
                  setErro(r.erro ?? 'não deu para importar')
                  return
                }
                router.push(`/clientes/${destino}/fluxos/${r.fluxoId}`)
              } catch {
                setErro('não deu para importar agora — tente de novo em instantes')
              }
            })
          }}
          className="app-primary-button whitespace-nowrap px-[18px] py-2.5 text-[13px]"
        >
          {rodando ? 'importando…' : 'Importar para minha conta'}
        </button>
      </div>

      <p className="text-[11px] leading-[1.6] text-dim">
        Chega como <strong className="font-semibold text-muted">rascunho</strong>, sem IA e sem as
        credenciais de API da origem. Nada vai ao ar sem você publicar.
      </p>

      {erro && (
        <p role="alert" className="text-[11.5px] text-rose-300">
          {erro}
        </p>
      )}
    </div>
  )
}
