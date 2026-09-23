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
 * exemplo) e um `<form>` cru jogaria isso fora; e escolher a conta de destino,
 * quando há mais de uma, precisa acontecer sem recarregar a página.
 *
 * **A lista de contas não fica à mostra.** Ela ficava, num `<select>` ao lado
 * do botão, e o efeito foi o pior possível numa página que se manda para fora:
 * o link de **um** fluxo abria um menu com os nomes de todas as contas de quem
 * estava logado. Quem compartilha a tela numa reunião está mostrando a carteira
 * inteira para o cliente errado. Agora o botão é um só; a escolha, quando
 * existe, aparece depois do clique e some quando termina.
 *
 * **O `try/catch` não é opcional.** Promessa rejeitada dentro de
 * `useTransition` sobe para a fronteira de erro do React e derruba a tela
 * inteira, numa página pública, isso é a pessoa recebendo "Alguma coisa
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
  const [escolhendo, setEscolhendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  if (destinos.length === 0) return null

  function importar(destino: string) {
    setErro(null)
    comecar(async () => {
      try {
        const r = await acaoImportarFluxoCompartilhado(destino, token)
        if (!r.ok || !r.fluxoId) {
          setErro(r.erro ?? 'não deu para importar')
          return
        }
        router.push(`/clientes/${destino}/fluxos/${r.fluxoId}?origem=importado`)
      } catch {
        setErro('não deu para importar agora, tente de novo em instantes')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      {escolhendo ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
          <p className="text-[11.5px] text-dim">Para qual conta?</p>
          <ul className="flex flex-col gap-1.5">
            {destinos.map((conta) => (
              <li key={conta.id}>
                <button
                  type="button"
                  disabled={rodando}
                  onClick={() => importar(conta.id)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-left text-[12.5px] transition hover:border-primary/50 hover:bg-primary/[0.08] hover:text-primary"
                >
                  {conta.nome}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setEscolhendo(false)}
            className="self-start text-[11px] text-dim underline underline-offset-2 hover:text-muted"
          >
            cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={rodando}
          onClick={() => {
            setErro(null)
            if (destinos.length === 1) {
              importar(destinos[0]!.id)
              return
            }
            setEscolhendo(true)
          }}
          className="app-primary-button self-start px-[18px] py-2.5 text-[13px] whitespace-nowrap"
        >
          {rodando ? 'importando…' : 'Importar para minha conta'}
        </button>
      )}

      <p className="text-[11px] leading-[1.6] text-dim">
        Chega como <strong className="font-semibold text-muted">rascunho</strong>, sem IA e sem as
        credenciais de API da origem. Nada vai ao ar sem você publicar.
      </p>

      {erro && (
        <p role="alert" className="text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
