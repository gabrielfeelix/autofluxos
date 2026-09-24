'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { Modal } from '@/components/design/modal'
import { acaoAdminSuspender } from '@/server/acoes-admin'
import { acaoApagarConta, acaoEstragoDaConta } from '@/server/acoes-conta'
import type { EstragoDaExclusao } from '@/server/repos/clientes'

/**
 * Suspender e apagar, separados do resto por uma aba própria.
 *
 * Suspender é otimista (o botão troca na hora e volta se o servidor recusar)
 * e reversível. Apagar não é nenhum dos dois: pede o nome digitado, mostra o
 * que some junto antes de deixar confirmar, e só então vai.
 */
export function ZonaDePerigo({
  organizacao,
  pessoas,
}: {
  organizacao: { id: string; nome: string; suspensaEm: string | null }
  pessoas: number
}) {
  const [suspensa, setSuspensa] = useState(organizacao.suspensaEm !== null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [apagando, setApagando] = useState(false)
  const [, comecar] = useTransition()

  const alternar = () => {
    const anterior = suspensa
    setSuspensa(!anterior)
    comecar(async () => {
      try {
        const r = await acaoAdminSuspender(organizacao.id, !anterior)
        if (!r.ok) {
          setSuspensa(anterior)
          setAviso(r.erro ?? 'não deu para gravar')
        }
      } catch {
        setSuspensa(anterior)
        setAviso('sem conexão com o servidor')
      }
    })
  }

  return (
    <div className="flex max-w-[1100px] flex-col gap-4">
      <section className="app-card flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[14px] font-bold">
            {suspensa ? 'Reativar a organização' : 'Suspender a organização'}
            {suspensa && <span className="rounded-full border border-rose-400/30 bg-rose-400/[0.1] px-2 py-0.5 text-[10.5px] font-semibold text-perigo">Suspensa</span>}
          </h2>
          <p className="mt-1 text-[12.5px] leading-5 text-muted">
            {suspensa
              ? 'Ninguém da organização entra enquanto ela estiver suspensa. Reativar devolve o acesso de todos, com as mesmas funções.'
              : 'Suspensa, ninguém da organização entra no painel. O Suporte 4YU continua entrando, e nada é apagado. O bot e os canais seguem como estão.'}
          </p>
        </div>
        <button
          type="button"
          onClick={alternar}
          className={`rounded-[10px] border px-4 py-2 text-[12.5px] font-semibold transition ${
            suspensa ? 'border-strong bg-surface text-ink hover:text-primary' : 'border-amber-400/40 bg-amber-400/[0.1] text-aviso hover:bg-amber-400/[0.18]'
          }`}
        >
          {suspensa ? 'Reativar' : 'Suspender'}
        </button>
      </section>

      <section className="flex flex-wrap items-center gap-4 rounded-[14px] border border-rose-400/30 bg-rose-400/[0.04] px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-bold text-perigo">Apagar a organização</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-muted">Apaga a organização e tudo que é dela: contatos, conversas, automações, credenciais e o acesso de {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}. Não tem volta.</p>
        </div>
        <button
          type="button"
          onClick={() => setApagando(true)}
          className="rounded-[10px] border border-rose-400/40 bg-rose-400/[0.12] px-4 py-2 text-[12.5px] font-bold text-perigo transition hover:bg-rose-400/[0.2]"
        >
          Apagar…
        </button>
      </section>

      {apagando && <Apagar organizacao={organizacao} pessoas={pessoas} aoFechar={() => setApagando(false)} />}
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </div>
  )
}

function Apagar({ organizacao, pessoas, aoFechar }: { organizacao: { id: string; nome: string }; pessoas: number; aoFechar: () => void }) {
  const router = useRouter()
  const [estrago, setEstrago] = useState<EstragoDaExclusao | null>(null)
  const [digitado, setDigitado] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [indo, comecar] = useTransition()

  useEffect(() => {
    let vivo = true
    acaoEstragoDaConta(organizacao.id)
      .then((resposta) => {
        if (vivo) setEstrago(resposta)
      })
      .catch(() => {
        if (vivo) setErro('não deu para conferir o que some com esta organização')
      })
    return () => {
      vivo = false
    }
  }, [organizacao.id])

  const confere = digitado.trim() === organizacao.nome.trim()
  const linha = (quantos: number, um: string, varios: string) => (
    <li>
      <strong>{quantos}</strong> {quantos === 1 ? um : varios}
    </li>
  )

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Apagar ${organizacao.nome}?`} descricao="Isto apaga a organização e tudo que é dela, de uma vez e sem desfazer." largura={460}>
      <div className="rounded-[12px] border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3 text-[12.5px] text-perigo">
        {estrago === null ? (
          <p className="text-perigo/70">conferindo o que some junto…</p>
        ) : (
          <ul className="space-y-1.5">
            {linha(estrago.leads, 'contato com a conversa inteira', 'contatos com as conversas inteiras')}
            {linha(estrago.fluxos, 'automação e o histórico de versões', 'automações e o histórico de versões')}
            {linha(estrago.conexoes, 'credencial guardada no cofre', 'credenciais guardadas no cofre')}
            {linha(estrago.numeros, 'número desconectado do WhatsApp', 'números desconectados do WhatsApp')}
            {linha(pessoas, 'pessoa perde o acesso', 'pessoas perdem o acesso')}
          </ul>
        )}
      </div>
      <p className="mt-4 text-[12.5px] leading-6 text-muted">
        Para confirmar, digite <strong className="text-ink">{organizacao.nome}</strong> abaixo.
      </p>
      <input
        type="text"
        value={digitado}
        onChange={(evento) => setDigitado(evento.target.value)}
        aria-label={`Digite ${organizacao.nome} para confirmar`}
        autoComplete="off"
        className="app-field mt-2 px-3 py-2.5 text-[13px]"
      />
      {erro && (
        <p role="alert" className="mt-3 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}
      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={aoFechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!confere || indo || estrago === null}
          onClick={() => {
            setErro(null)
            comecar(async () => {
              const r = await acaoApagarConta(organizacao.id)
              if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
              else router.replace('/admin/organizacoes')
            })
          }}
          className="flex-[1.35] rounded-[10px] border border-rose-400/40 bg-rose-400/[0.16] px-4 py-2.5 text-[13px] font-bold text-perigo transition hover:bg-rose-400/[0.24] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {indo ? 'apagando…' : 'Apagar para sempre'}
        </button>
      </div>
    </Modal>
  )
}
