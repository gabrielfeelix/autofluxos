'use client'

import { useState, useTransition } from 'react'
import { acaoConferirAgenda, type RespostaDaAgenda } from '@/server/acoes'
import { NOME_DA_AGENDA } from '@/core/agenda'

/**
 * O cartão que responde "está ligado?".
 *
 * Essa pergunta não tinha resposta em tela nenhuma. A lista de credenciais
 * mostrava nomes, e nome não diz se a chave vale nem se algum bloco a usa — dá
 * para ter uma credencial cadastrada, correta, e **zero** automação chamando a
 * agenda. Era exatamente o estado real quando alguém perguntou.
 *
 * Por isso o cartão separa três coisas que pareciam uma:
 *
 * 1. **a chave existe** — a credencial está cadastrada;
 * 2. **a chave vale** — a agenda respondeu agora, e o botão prova na hora;
 * 3. **alguma automação usa** — quantos blocos apontam para ela.
 *
 * As três podem estar diferentes, e a mais enganosa é a terceira: é a que faz
 * alguém achar que ligou porque colou a chave.
 */
export function CartaoDaAgenda({
  clienteId,
  conexaoId,
  blocosQueUsam,
  fluxosQueUsam,
}: {
  clienteId: string
  conexaoId: string
  blocosQueUsam: number
  fluxosQueUsam: number
}) {
  const [resultado, setResultado] = useState<RespostaDaAgenda | null>(null)
  const [conferindo, comecar] = useTransition()

  const usada = blocosQueUsam > 0

  return (
    <div className="app-card mb-4 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/[0.12] text-[15px]">
          📅
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold">Agenda — {NOME_DA_AGENDA}</p>
          <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
            {usada ? (
              <>
                Usada em <strong className="text-soft">{blocosQueUsam}</strong>{' '}
                {blocosQueUsam === 1 ? 'bloco' : 'blocos'} de{' '}
                <strong className="text-soft">{fluxosQueUsam}</strong>{' '}
                {fluxosQueUsam === 1 ? 'automação' : 'automações'}.
              </>
            ) : (
              /*
                O caso que enganava. Chave cadastrada e nenhum bloco usando é
                "não ligado" na prática, e a tela dizia a mesma coisa que diria
                se estivesse tudo pronto.
              */
              <>
                A chave está guardada, mas{' '}
                <strong className="text-amber-200">nenhuma automação usa ela ainda</strong> — o bot
                não consulta a agenda até um bloco apontar para cá.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          disabled={conferindo}
          onClick={() => {
            setResultado(null)
            comecar(async () => {
              setResultado(await acaoConferirAgenda(clienteId, conexaoId))
            })
          }}
          title="Chama a agenda agora com a chave guardada e diz o que ela respondeu"
          className="app-secondary-button shrink-0 px-3 py-1.5 text-[11.5px] disabled:opacity-50"
        >
          {conferindo ? 'conferindo…' : 'Conferir agora'}
        </button>
      </div>

      {resultado && !resultado.ok && (
        <p
          role="status"
          className="mt-2.5 rounded-[9px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-4 text-rose-200"
        >
          ✕ {resultado.erro ?? 'não deu para conferir'}
        </p>
      )}

      {/*
        Mostra os nomes, e não a contagem.

        "3 profissionais" prova que a chave vale e não responde a pergunta que
        veio junto: *"qual informação o bot vai puxar?"*. Ver "Marina, Carol,
        Júlia" responde as duas de uma vez — e pega o erro mais silencioso de
        todos, que é a chave certa da conta errada.
      */}
      {resultado?.ok && (
        <div
          role="status"
          className="mt-2.5 rounded-[9px] border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-2.5"
        >
          <p className="text-[11.5px] font-semibold text-emerald-200">
            ✓ A agenda respondeu. É isto que o bot enxerga:
          </p>
          <dl className="mt-2 space-y-1.5">
            <Lista rotulo="Profissionais" itens={resultado.profissionais} />
            <Lista
              rotulo={resultado.comoChamaServico ? `${resultado.comoChamaServico}s` : 'Serviços'}
              itens={resultado.servicos}
            />
            <Lista rotulo="Locais" itens={resultado.locais} />
          </dl>
          <p className="mt-2 text-[10.5px] leading-4 text-dim">
            Horários livres, quem já é cliente e as marcações vêm por automação, e não aqui — esta
            conferência só pergunta o catálogo, que é a resposta mais barata que prova que a chave
            vale e de qual conta ela é.
          </p>
        </div>
      )}

      {!usada && (
        <p className="mt-2.5 text-[11px] leading-5 text-dim">
          Para ligar de verdade: abra uma automação → bloco{' '}
          <strong className="text-soft">Serviços externos</strong> → “Começar de uma integração
          pronta” → gaveta <strong className="text-soft">Agenda ({NOME_DA_AGENDA})</strong> → e
          escolha esta credencial no campo do bloco.
        </p>
      )}
    </div>
  )
}

/** Uma linha do que veio da agenda. Vazia diz "nenhum", em vez de sumir. */
function Lista({ rotulo, itens }: { rotulo: string; itens?: string[] }) {
  const lista = itens ?? []
  return (
    <div className="flex gap-2 text-[11.5px] leading-4">
      <dt className="w-[92px] shrink-0 text-dim">{rotulo}</dt>
      <dd className="min-w-0 flex-1 text-soft">
        {lista.length === 0 ? (
          // Zero é informação: catálogo vazio explica um menu vazio depois, e
          // some se a lista simplesmente não aparecer.
          <span className="text-dim">nenhum cadastrado</span>
        ) : (
          lista.join(', ')
        )}
      </dd>
    </div>
  )
}
