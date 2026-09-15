'use client'

import { useState } from 'react'
import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { acaoMoverCartao } from '@/server/acoes'

/** Uma etapa para onde o cartão pode ir. */
export type EtapaEscolhivel = { id: string; nome: string }

/** Onde o contato está num quadro, e as etapas daquele quadro. */
export type FunilDoContato = {
  cartaoId: string
  quadroId: string
  quadro: string
  etapaId: string
  etapa: string
  etapas: EtapaEscolhivel[]
}

/**
 * Em que ponto do funil a pessoa está — e o gesto de movê-la, sem sair da
 * conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui, e não só no quadro
 * ---------------------------------------------------------------------------
 *
 * Quem descobre que a pessoa fechou negócio descobre **conversando** com ela.
 * Com o funil só na tela de quadros, registrar isso é sair do atendimento,
 * achar o cartão no meio de dezenas e arrastar — três gestos e uma troca de
 * contexto para uma informação que se teve há cinco segundos. O que não é
 * registrado no momento em que se sabe costuma não ser registrado.
 *
 * Mostrar sem deixar mover seria a metade inútil: a pergunta "em que pé está?"
 * quase sempre vem junto de "então move para a próxima".
 *
 * ---------------------------------------------------------------------------
 * Otimista, e por quê
 * ---------------------------------------------------------------------------
 *
 * Mover cartão cabe no que o `useAcaoOtimista` documenta: é interno (não sai
 * para o WhatsApp), reversível (mover de volta é um clique) e não é lote.
 *
 * **`acaoMoverCartao` revalida `/quadros` e não o Inbox**, e isso é de
 * propósito aqui: a tela onde o cartão mudou de lugar é o quadro, e ele estará
 * certo na próxima visita. O Inbox não se refaz — então a aposta otimista fica
 * de pé sem uma ida ao servidor que só existiria para repintar o que a tela já
 * mostra. Revalidar esta página devolveria os dois segundos que este arquivo
 * existe para evitar.
 */
export function FunilDaConversa({
  clienteId,
  funis,
}: {
  clienteId: string
  /** Um por quadro em que o contato está. Vazio = fora de todo funil. */
  funis: FunilDoContato[]
}) {
  /*
   * Fora de todo quadro a seção não aparece. Pôr o contato num funil é decisão
   * que já tem tela própria, e um estado vazio aqui seria ruído em toda
   * conversa de quem não usa quadro nenhum.
   */
  if (funis.length === 0) return null

  return (
    <div className="mt-5">
      <h3 className="mb-2 text-[11px] font-bold text-soft">No funil</h3>
      <div className="space-y-2">
        {funis.map((funil) => (
          <UmFunil key={funil.cartaoId} clienteId={clienteId} funil={funil} />
        ))}
      </div>
    </div>
  )
}

function UmFunil({ clienteId, funil }: { clienteId: string; funil: FunilDoContato }) {
  const [menuAberto, setMenuAberto] = useState(false)

  const { valor: etapaId, erro, pendente, agir } = useAcaoOtimista(funil.etapaId)

  /*
   * O nome sai da lista pelo id escolhido, e não de um segundo estado otimista.
   * Guardar nome e id separados é criar duas fontes para a mesma verdade — e a
   * que erra é sempre a que ninguém lembra que existe.
   */
  const etapaAtual = funil.etapas.find((e) => e.id === etapaId)?.nome ?? funil.etapa

  const mover = (destino: EtapaEscolhivel) => {
    setMenuAberto(false)
    if (destino.id === etapaId) return
    agir(destino.id, () => acaoMoverCartao(clienteId, funil.cartaoId, destino.id))
  }

  return (
    <div className="rounded-[10px] border border-line bg-panel px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] text-dim">{funil.quadro}</span>
        {erro && <span className="shrink-0 text-[10px] text-rose-300">{erro}</span>}
      </div>

      <div className="relative mt-1">
        <button
          type="button"
          disabled={pendente}
          onClick={() => setMenuAberto((aberto) => !aberto)}
          aria-expanded={menuAberto}
          title="Mover para outra etapa"
          className="flex w-full items-center justify-between gap-2 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <span className="min-w-0 truncate">{etapaAtual}</span>
          <span aria-hidden className="shrink-0 text-[9px] text-muted">
            ▾
          </span>
        </button>

        {menuAberto && (
          <>
            {/*
              A camada que fecha ao clicar fora. Sem ela o menu só fecha
              escolhendo alguma coisa — e quem abriu para ver as etapas fica
              obrigado a mover o cartão para sair.
            */}
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setMenuAberto(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <ul className="absolute right-0 left-0 z-20 mt-1 overflow-hidden rounded-[10px] border border-line bg-[#131a24] py-1 shadow-[0_16px_40px_rgba(19,25,34,0.099)]">
              {funil.etapas.map((etapa) => {
                const aqui = etapa.id === etapaId
                return (
                  <li key={etapa.id}>
                    <button
                      type="button"
                      onClick={() => mover(etapa)}
                      aria-current={aqui ? 'step' : undefined}
                      className={`block w-full truncate px-2.5 py-1.5 text-left text-[11.5px] transition ${
                        aqui
                          ? 'bg-primary/[0.12] font-semibold text-ink'
                          : 'text-muted hover:bg-surface-strong hover:text-ink'
                      }`}
                    >
                      {etapa.nome}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
