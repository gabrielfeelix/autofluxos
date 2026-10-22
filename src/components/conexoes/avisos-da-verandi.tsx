'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { EVENTOS_DA_VERANDI, MODELOS_DA_VERANDI, modeloDoEvento } from '@/core/eventos-da-verandi'
import type { StatusDoTemplate } from '@/core/templates'
import { acaoCriarModelosDaVerandi, acaoDesligarAvisosDaVerandi, acaoLigarAvisosDaVerandi } from '@/server/acoes-ponte-verandi'

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
 *
 * Ligados, mostra também os modelos de fora das 24 horas: sem eles, o aviso
 * só chega a quem conversou no último dia, e numa aula cancelada isso é quase
 * ninguém.
 */
export function AvisosDaVerandi({
  clienteId,
  ligados,
  ultimoEm,
  modelos,
}: {
  clienteId: string
  ligados: boolean
  ultimoEm: string | null
  /** O status de cada modelo pelo nome (`verandi_falta`...), `null` se não existe. */
  modelos: Record<string, StatusDoTemplate | null>
}) {
  const [estado, setEstado] = useState(ligados)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, comecar] = useTransition()
  const [statusDosModelos, setStatusDosModelos] = useState(modelos)
  const [erroDoModelo, setErroDoModelo] = useState<string | null>(null)
  const [criando, criar] = useTransition()
  const faltamModelos = EVENTOS_DA_VERANDI.some((e) => {
    const status = statusDosModelos[modeloDoEvento(e.evento)?.nome ?? '']
    return !status || status === 'recusado' || status === 'rascunho'
  })

  const criarModelos = () => {
    setErroDoModelo(null)
    const antes = statusDosModelos
    // Otimista: o que faltava já aparece em análise, e volta se a Meta recusar.
    setStatusDosModelos(
      Object.fromEntries(
        MODELOS_DA_VERANDI.map(({ nome }) => {
          const s = antes[nome]
          return [nome, !s || s === 'recusado' || s === 'rascunho' ? 'pendente' : s]
        }),
      ),
    )
    criar(async () => {
      const r = await acaoCriarModelosDaVerandi(clienteId)
      if (!r.ok) {
        setStatusDosModelos(antes)
        setErroDoModelo(r.erro)
      }
    })
  }

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
        {EVENTOS_DA_VERANDI.map((e) => {
          const pilula = estado ? PILULA_DO_MODELO[statusDosModelos[modeloDoEvento(e.evento)?.nome ?? ''] ?? 'nenhum'] : null
          return (
            <li key={e.evento} className="rounded-[9px] border border-line-soft bg-panel px-2.5 py-2">
              <p className="text-[12px] font-semibold text-ink">{e.rotulo}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-dim">{e.descricao}</p>
              {pilula && (
                <div className="mt-1.5">
                  <Pilula tom={pilula.tom}>{pilula.rotulo}</Pilula>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {estado && (
        <div className="mt-2.5 rounded-[9px] border border-line-soft bg-panel px-2.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] font-semibold text-ink">Fora das 24 horas</p>
            <span className="flex-1" />
            {faltamModelos && (
              <button type="button" disabled={criando} onClick={criarModelos} className="botao-primario botao-sm">
                {criando ? 'Enviando…' : 'Criar modelos'}
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-dim">
            Quem não conversou nas últimas 24 horas só recebe o aviso por modelo aprovado da Meta. Cada envio é cobrado
            pela Meta como utilidade, cerca de R$ 0,035 por mensagem.
          </p>
          {erroDoModelo && (
            <p role="status" className="mt-2 text-[11.5px] leading-4 text-perigo">
              {erroDoModelo}
            </p>
          )}
        </div>
      )}
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

/** O modelo de fora das 24h de cada aviso, na linha dele. Sem modelo: nada. */
const PILULA_DO_MODELO: Record<StatusDoTemplate | 'nenhum', { tom: TomDaPilula; rotulo: string } | null> = {
  nenhum: null,
  rascunho: null,
  pendente: { tom: 'aviso', rotulo: 'modelo em análise' },
  aprovado: { tom: 'ok', rotulo: 'modelo aprovado' },
  recusado: { tom: 'perigo', rotulo: 'modelo recusado' },
  pausado: { tom: 'aviso', rotulo: 'modelo pausado' },
  desativado: { tom: 'neutro', rotulo: 'modelo desativado' },
}
