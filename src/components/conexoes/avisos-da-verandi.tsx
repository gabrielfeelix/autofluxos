'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Pilula } from '@/components/design/pilula'
import { EVENTOS_DA_VERANDI } from '@/core/eventos-da-verandi'
import { acaoDesligarAvisosDaVerandi, acaoLigarAvisosDaVerandi } from '@/server/acoes-ponte-verandi'

const QUANDO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Os avisos da Verandi, dentro do cartão dela (a ponte). Um clique liga: o
 * AutoFluxos cria o segredo, registra o endereço lá, e cada aula cancelada,
 * falta ou vaga aberta passa a poder começar uma automação.
 *
 * Muda na hora e volta se a Verandi recusar.
 */
export function AvisosDaVerandi({
  clienteId,
  ligados,
  ultimoEm,
}: {
  clienteId: string
  ligados: boolean
  ultimoEm: string | null
}) {
  const [estado, setEstado] = useState(ligados)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, comecar] = useTransition()

  const mudar = (ligar: boolean) => {
    setErro(null)
    const antes = estado
    setEstado(ligar)
    comecar(async () => {
      const r = ligar ? await acaoLigarAvisosDaVerandi(clienteId) : await acaoDesligarAvisosDaVerandi(clienteId)
      if (!r.ok) {
        setEstado(antes)
        setErro(r.erro)
      }
    })
  }

  return (
    <section className="mt-3.5 rounded-[11px] border border-line bg-surface/60 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[12.5px] font-bold">Avisos da Verandi</h4>
        {estado ? <Pilula tom="ok">ligados</Pilula> : <Pilula tom="neutro">desligados</Pilula>}
        <span className="flex-1" />
        <button
          type="button"
          disabled={indo}
          onClick={() => mudar(!estado)}
          className={estado ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}
        >
          {indo ? 'Um momento…' : estado ? 'Desligar' : 'Receber os avisos'}
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-5 text-dim">
        {estado
          ? ultimoEm
            ? `O último aviso chegou em ${QUANDO.format(new Date(ultimoEm))}.`
            : 'Ligados. Os avisos chegam assim que acontecerem na Verandi.'
          : 'A Verandi avisa o AutoFluxos quando algo acontece na agenda, e cada aviso pode começar uma automação no WhatsApp do aluno.'}
      </p>
      {erro && (
        <p role="status" className="mt-2 rounded-[9px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-4 text-perigo">
          {erro}
        </p>
      )}
      <ul className="mt-2.5 grid gap-1.5">
        {EVENTOS_DA_VERANDI.map((e) => (
          <li key={e.evento} className="rounded-[9px] border border-line-soft bg-panel px-2.5 py-2">
            <p className="text-[12px] font-semibold text-ink">{e.rotulo}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-dim">{e.descricao}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] leading-5 text-dim">
        Para usar um aviso, crie o gatilho em{' '}
        <Link href={`/clientes/${clienteId}/fluxos?aba=gatilhos`} className="font-semibold text-primary hover:underline">
          Automações &gt; Gatilhos
        </Link>
        . A mensagem pode usar <code className="text-soft">{'{{aula_dia}}'}</code>,{' '}
        <code className="text-soft">{'{{aula_hora}}'}</code> e <code className="text-soft">{'{{aluno_nome}}'}</code>.
      </p>
    </section>
  )
}
