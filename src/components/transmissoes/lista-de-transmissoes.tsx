'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NovaTransmissao } from '@/components/transmissoes/nova-transmissao'
import { acaoCancelarTransmissao } from '@/server/acoes-transmissoes'
import type { Template } from '@/server/repos/templates'
import type {
  EstadoDaTransmissao,
  Progresso,
  Transmissao,
} from '@/server/repos/transmissoes'
import { useConfirmar } from '@/components/design/confirmar'

/**
 * A lista de transmissões, com o progresso real de cada uma.
 *
 * ---------------------------------------------------------------------------
 * "Retida" aparece na tela, e é o ponto desta tela inteira
 * ---------------------------------------------------------------------------
 *
 * A Meta responde 200 ao envio e pode ter **segurado** a mensagem para avaliar
 * a qualidade. Se o veredito for ruim, o modelo é pausado e cada mensagem
 * retida é descartada. Um painel que soma retida com entregue mostra "campanha
 * enviada" para o cliente quando nada saiu, e ele só descobre quando ninguém
 * responde.
 *
 * Por isso o número de retidas tem linha própria, com a palavra certa: não é
 * "enviado", é "a Meta está decidindo".
 */

const ROTULO_DO_ESTADO: Record<EstadoDaTransmissao, { texto: string; cor: string }> = {
  rascunho: { texto: 'Rascunho', cor: 'bg-line text-dim' },
  agendada: { texto: 'Agendada', cor: 'bg-sky-500/15 text-sky-600' },
  enviando: { texto: 'Enviando', cor: 'bg-amber-500/15 text-amber-600' },
  concluida: { texto: 'Concluída', cor: 'bg-emerald-500/15 text-emerald-600' },
  cancelada: { texto: 'Cancelada', cor: 'bg-line text-dim' },
  falhou: { texto: 'Parou', cor: 'bg-red-500/15 text-red-600' },
}

export function ListaDeTransmissoes({
  clienteId,
  transmissoes,
  progressos,
  templates,
  enviadasHoje,
}: {
  clienteId: string
  transmissoes: Transmissao[]
  progressos: Record<string, Progresso>
  templates: Template[]
  enviadasHoje: number
}) {
  const aprovados = templates.filter((t) => t.status === 'aprovado')

  return (
    <section className="app-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-bold">Transmissões</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-dim">
            Um modelo aprovado, um público e um horário.
          </p>
        </div>
        <NovaTransmissao clienteId={clienteId} templates={templates} enviadasHoje={enviadasHoje} />
      </header>

      {aprovados.length === 0 && (
        /*
          Sem modelo aprovado não existe transmissão possível. Dizer isso aqui
          evita que a pessoa procure um botão que não faria nada.
        */
        <p className="border-b border-line bg-amber-500/[0.06] px-5 py-3 text-[12.5px] leading-5 text-dim">
          Crie um modelo na aba <strong>Modelos aprovados</strong> para poder transmitir.
        </p>
      )}

      {transmissoes.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-dim">Nenhuma transmissão ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {transmissoes.map((transmissao) => (
            <Linha
              key={transmissao.id}
              clienteId={clienteId}
              transmissao={transmissao}
              progresso={progressos[transmissao.id]}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function Linha({
  clienteId,
  transmissao,
  progresso,
}: {
  clienteId: string
  transmissao: Transmissao
  progresso: Progresso | undefined
}) {
  const router = useRouter()
  const [recado, setRecado] = useState<string | null>(null)
  /*
    O pendente vem do modal: é ele que roda a ação e desabilita os próprios
    botões enquanto ela não volta.
  */
  const { confirmar, dialogo, rodando: cancelando } = useConfirmar()
  const estado = ROTULO_DO_ESTADO[transmissao.estado]

  const podeCancelar =
    transmissao.estado === 'agendada' ||
    transmissao.estado === 'enviando' ||
    transmissao.estado === 'rascunho'

  function cancelar() {
    // O que já saiu não volta. Dizer antes do clique, e não depois.
    confirmar({
      titulo: 'Cancelar esta transmissão?',
      descricao:
        'As mensagens que já saíram não voltam: o cancelamento só impede as que ainda estão na fila.',
      rotulo: 'Cancelar transmissão',
      aoConfirmar: async () => {
        const r = await acaoCancelarTransmissao(clienteId, transmissao.id)
        if (!r.ok) return r
        setRecado(
          r.jaSairam && r.jaSairam > 0
            ? `Cancelada. ${r.jaSairam} mensagens já tinham saído e não voltam.`
            : 'Cancelada antes de qualquer mensagem sair.',
        )
        router.refresh()
        return r
      },
    })
  }

  return (
    <li className="px-5 py-4">
      {dialogo}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold">{transmissao.nome}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estado.cor}`}>
              {estado.texto}
            </span>
          </div>

          {progresso && <Numeros progresso={progresso} />}

          {/*
            O motivo de a transmissão ter parado, inteiro. Tipicamente "o modelo
            foi pausado pela Meta", a informação que explica por que 4.800
            pessoas não receberam nada.
          */}
          {transmissao.erro && (
            <p className="mt-2 rounded-[10px] bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-700 dark:text-red-300">
              <strong>Por que parou:</strong> {transmissao.erro}
            </p>
          )}

          {recado && <p className="mt-2 text-[12px] leading-5 text-dim">{recado}</p>}
        </div>

        {podeCancelar && (
          <button
            type="button"
            onClick={cancelar}
            disabled={cancelando}
            className="shrink-0 text-[12px] font-semibold text-dim hover:text-red-600 disabled:opacity-50"
          >
            {cancelando ? 'Cancelando…' : 'Cancelar'}
          </button>
        )}
      </div>
    </li>
  )
}

/**
 * Os números do progresso.
 *
 * `entregue` e `lida` somam como "chegou": para quem olha o painel, uma
 * mensagem lida obviamente chegou, e mostrar as duas separadas faria a conta
 * não fechar com o total aos olhos de quem soma.
 *
 * **`retida` NÃO soma com nada.** Ela é o estado que a Meta ainda está
 * decidindo, e juntá-la a "chegou" é exatamente o erro que esta tela existe
 * para não cometer.
 */
function Numeros({ progresso }: { progresso: Progresso }) {
  const chegou = progresso.entregue + progresso.lida

  return (
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-dim">
      <span>
        <strong className="text-ink">{progresso.total}</strong> no total
      </span>
      {chegou > 0 && (
        <span>
          <strong className="text-ink">{chegou}</strong> chegaram
          {progresso.lida > 0 && ` (${progresso.lida} lidas)`}
        </span>
      )}
      {progresso.aceita > 0 && <span>{progresso.aceita} saíram</span>}
      {progresso.na_fila > 0 && <span>{progresso.na_fila} na fila</span>}
      {progresso.retida > 0 && (
        /*
          A linha mais importante desta tela. "A Meta está avaliando" e não
          "enviado": se o veredito for ruim, estas mensagens são DESCARTADAS.
        */
        <span className="text-amber-600">
          <strong>{progresso.retida}</strong> a Meta está avaliando, ainda podem não sair
        </span>
      )}
      {progresso.falhou > 0 && (
        <span className="text-red-600">
          <strong>{progresso.falhou}</strong> falharam
        </span>
      )}
    </div>
  )
}
