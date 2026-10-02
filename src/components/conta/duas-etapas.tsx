'use client'

import { useState, useTransition } from 'react'
import { CampoDeSenha } from '@/components/design/campo-de-senha'
import { Modal } from '@/components/design/modal'
import { acaoComecarDuasEtapas, acaoConfirmarDuasEtapas, acaoDesligarDuasEtapas } from '@/server/acoes-perfil'

/**
 * Verificação em duas etapas: ligar, com QR e códigos de recuperação, e
 * desligar.
 *
 * Mora num componente só porque aparece em dois lugares: no menu "Você" (em
 * modal) e na página que o administrador da plataforma é obrigado a passar
 * (`/ativar-duas-etapas`, embutido).
 */

type Passo =
  | { qual: 'senha' }
  | { qual: 'qr'; qr: string; chave: string; codigos: string[] }
  | { qual: 'pronto' }

const BOTAO = 'botao-primario botao-md'
const SECUNDARIO =
  'rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-dim transition hover:text-muted'

export function DuasEtapas({ ligada, aoConcluir }: { ligada: boolean; aoConcluir?: () => void }) {
  const [passo, setPasso] = useState<Passo>({ qual: 'senha' })
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  if (ligada && passo.qual === 'senha') {
    return <Desligar aoConcluir={aoConcluir} />
  }

  if (passo.qual === 'pronto') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-5 text-muted">
          Ligada. A partir do próximo login, depois da senha o painel pede o código do aplicativo.
        </p>
        {aoConcluir && (
          <div className="flex justify-end">
            <button type="button" onClick={aoConcluir} className={BOTAO}>
              Continuar
            </button>
          </div>
        )}
      </div>
    )
  }

  if (passo.qual === 'qr') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const codigo = String(new FormData(e.currentTarget).get('codigo') ?? '')
          setErro(null)
          comecar(async () => {
            const r = await acaoConfirmarDuasEtapas(codigo)
            if (!r.ok) return setErro(r.erro)
            setPasso({ qual: 'pronto' })
          })
        }}
        className="flex flex-col gap-4"
      >
        <ol className="flex flex-col gap-3 text-[13px] leading-5 text-muted">
          <li>
            <strong className="text-ink">1.</strong> No celular, abra um aplicativo de autenticação (Google
            Authenticator, Microsoft Authenticator, 1Password) e leia este código:
          </li>
        </ol>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor */}
          <img src={passo.qr} alt="QR code para o aplicativo de autenticação" width={200} height={200} />
          <span className="text-center text-[11px] text-slate-500">
            Não dá para ler? Digite a chave: <code className="break-all font-mono">{passo.chave}</code>
          </span>
        </div>

        <div className="text-[13px] leading-5 text-muted">
          <strong className="text-ink">2.</strong> Guarde estes códigos de recuperação. Cada um entra uma vez, se
          você perder o celular:
          <ul className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-line bg-canvas p-3 font-mono text-[12.5px] text-ink">
            {passo.codigos.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>

        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          <span>
            <strong className="text-ink">3.</strong> Digite o código de 6 números que o aplicativo mostra:
          </span>
          <input
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            placeholder="Exemplo: 123456"
            className="app-field px-[13px] py-[11px] text-center font-mono text-[16px] tracking-[0.3em] placeholder:font-sans placeholder:text-[13.5px] placeholder:tracking-normal"
          />
        </label>

        {erro && (
          <p role="alert" className="text-[12px] leading-5 text-perigo">
            {erro}
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={rodando} className={BOTAO}>
            {rodando ? 'Conferindo…' : 'Ligar'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const senha = String(new FormData(e.currentTarget).get('senha') ?? '')
        setErro(null)
        comecar(async () => {
          const r = await acaoComecarDuasEtapas(senha)
          if (!r.ok) return setErro(r.erro)
          setPasso({ qual: 'qr', qr: r.qr, chave: r.chave, codigos: r.codigos })
        })
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-[13px] leading-5 text-muted">
        Além da senha, o login passa a pedir um código que muda a cada 30 segundos no seu celular. Quem descobrir
        sua senha não entra sem ele.
      </p>
      <CampoDeSenha rotulo="Sua senha, para confirmar" nome="senha" autoComplete="current-password" autoFocus />
      {erro && (
        <p role="alert" className="text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={rodando} className={BOTAO}>
          {rodando ? 'Um instante…' : 'Continuar'}
        </button>
      </div>
    </form>
  )
}

function Desligar({ aoConcluir }: { aoConcluir?: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState(false)
  const [rodando, comecar] = useTransition()

  if (feito) {
    return <p className="text-[13px] leading-5 text-muted">Desligada. O login volta a pedir só a senha.</p>
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const senha = String(new FormData(e.currentTarget).get('senha') ?? '')
        setErro(null)
        comecar(async () => {
          const r = await acaoDesligarDuasEtapas(senha)
          if (!r.ok) return setErro(r.erro)
          setFeito(true)
        })
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-[13px] leading-5 text-muted">
        <span className="font-semibold text-ok">Ligada.</span> Para desligar, confirme a senha. Quem administra a
        plataforma perde o acesso à administração enquanto ela estiver desligada.
      </p>
      <CampoDeSenha rotulo="Sua senha" nome="senha" autoComplete="current-password" />
      {erro && (
        <p role="alert" className="text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {aoConcluir && (
          <button type="button" onClick={aoConcluir} className={SECUNDARIO}>
            Manter ligada
          </button>
        )}
        <button
          type="submit"
          disabled={rodando}
          className="rounded-lg border border-perigo/40 px-3.5 py-2 text-[12.5px] font-semibold text-perigo transition hover:bg-perigo/10 disabled:opacity-50"
        >
          {rodando ? 'Desligando…' : 'Desligar'}
        </button>
      </div>
    </form>
  )
}

export function ModalDeDuasEtapas({ ligada, aoFechar }: { ligada: boolean; aoFechar: () => void }) {
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Verificação em duas etapas"
      descricao="Um código do celular, além da senha, para entrar no painel."
    >
      <DuasEtapas ligada={ligada} aoConcluir={aoFechar} />
    </Modal>
  )
}
