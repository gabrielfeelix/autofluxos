'use client'

import { useState, useTransition } from 'react'
import { acaoDefinirCrm } from '@/server/acoes-recursos'

/**
 * Ligar e desligar o CRM (UI-19).
 *
 * **Ligar não cria cartão retroativo, e a frase está no botão, não num tooltip.**
 * O §4.2 é explícito: "Ativar CRM abre a escolha do primeiro processo; não cria
 * cartões retroativos". Quem espera encontrar os trezentos contatos já
 * distribuídos por etapas e acha um quadro vazio conclui que o produto não
 * funcionou, e vai embora sem perguntar.
 *
 * **Desligar não apaga nada**, e essa também vai escrita: sem ela, o botão
 * "Desativar CRM" parece o botão que perde as negociações do ano, e ninguém o
 * toca nem quando devia.
 */
export function InterruptorDoCrm({
  clienteId,
  ativo,
  temQuadro,
}: {
  clienteId: string
  ativo: boolean
  temQuadro: boolean
}) {
  const [ligado, setLigado] = useState(ativo)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function alternar() {
    const alvo = !ligado
    const anterior = ligado
    setLigado(alvo)
    setErro(null)

    comecar(async () => {
      const r = await acaoDefinirCrm(clienteId, alvo)
      if (!r.ok) {
        setLigado(anterior)
        setErro(r.erro ?? 'não deu para salvar')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          disabled={rodando}
          className={`rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition disabled:opacity-50 ${
            ligado
              ? 'border border-line text-muted hover:bg-white/[0.04]'
              : 'bg-accent text-[var(--accent-ink)] hover:opacity-90'
          }`}
        >
          {ligado ? 'Desativar CRM' : 'Ativar CRM'}
        </button>
        <span className="text-[12px] text-muted">
          {ligado ? 'Ligado: o CRM aparece no menu.' : 'Desligado: o CRM não aparece no menu.'}
        </span>
      </div>

      <p className="max-w-[620px] text-[12px] leading-5 text-dim">
        {ligado
          ? 'Desativar só esconde o item do menu. Nada é apagado: os funis, as negociações, as atividades e as vendas continuam onde estão, e voltam a aparecer quando você ativar de novo.'
          : 'Ativar mostra o CRM no menu e oferece criar o primeiro processo. Os contatos que já existem não viram cartões sozinhos: o funil começa vazio, e quem quiser trazer o histórico faz isso à parte, vendo antes quantos vêm.'}
      </p>

      {!ligado && temQuadro && (
        <p className="max-w-[620px] text-[12px] leading-5 text-muted">
          Esta conta já tem funil montado, então o CRM continua visível no menu
          mesmo desligado aqui: esconder uma tela que alguém usa todo dia exigiria
          apagar o funil primeiro.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-[11.5px] leading-4 text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
