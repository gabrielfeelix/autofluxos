'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import {
  FILTROS_DE_ESTADO,
  PERIODOS,
  ROTULO_DO_FILTRO,
  ROTULO_DO_PERIODO,
  filtrarTransmissoes,
  proximaAcaoDaTransmissao,
  type Periodo,
} from '@/core/transmissoes-na-tela'
import { NovaTransmissao } from '@/components/transmissoes/nova-transmissao'
import { acaoCancelarTransmissao } from '@/server/acoes-transmissoes'
import type { Template } from '@/server/repos/templates'
import type { Progresso, Transmissao } from '@/server/repos/transmissoes'
import { Numeros, ProximaAcao, ROTULO_DO_ESTADO } from '@/components/transmissoes/numeros'
import { useConfirmar } from '@/components/design/confirmar'
import { IlustracaoTransmissoes } from '@/components/design/ilustracoes'

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


export function ListaDeTransmissoes({
  clienteId,
  transmissoes,
  progressos,
  templates,
  enviadasHoje,
  filtro,
}: {
  clienteId: string
  transmissoes: Transmissao[]
  progressos: Record<string, Progresso>
  templates: Template[]
  enviadasHoje: number
  filtro: { q?: string; estado?: string; periodo?: string }
}) {
  const aprovados = templates.filter((t) => t.status === 'aprovado')
  const visiveis = filtrarTransmissoes(transmissoes, (t) => progressos[t.id], filtro)
  const filtrando = Boolean(filtro.q || filtro.estado || filtro.periodo)
  const parametros: Record<string, string> = { aba: 'transmissoes' }
  for (const [chave, valor] of Object.entries(filtro)) if (valor) parametros[chave] = valor

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

      {transmissoes.length > 0 && (
        <div className="border-b border-line px-5 py-3">
          <BarraDeLista
            base={`/clientes/${clienteId}/transmissoes`}
            parametros={parametros}
            busca={{ chave: 'q', placeholder: 'Buscar transmissão pelo nome', rotulo: 'Buscar transmissão pelo nome' }}
            grupos={[
              {
                chave: 'estado',
                titulo: 'Estado',
                opcoes: FILTROS_DE_ESTADO.map((e) => ({ valor: e, rotulo: ROTULO_DO_FILTRO[e] })),
              },
              {
                chave: 'periodo',
                titulo: 'Período',
                opcoes: (Object.keys(PERIODOS) as Periodo[]).map((p) => ({
                  valor: p,
                  rotulo: ROTULO_DO_PERIODO[p],
                })),
              },
            ]}
            resumo={filtrando ? `${visiveis.length} de ${transmissoes.length}` : undefined}
          />
        </div>
      )}

      {transmissoes.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <IlustracaoTransmissoes />
          <p className="mt-6 text-[13.5px] font-semibold text-soft">Nenhuma transmissão ainda</p>
          <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-5 text-dim">
            Uma mensagem só, para uma lista inteira de contatos de uma vez.
          </p>
        </div>
      ) : visiveis.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-dim">Nenhuma transmissão com esse filtro.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visiveis.map((transmissao) => (
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
  const proxima = proximaAcaoDaTransmissao(transmissao, progresso, clienteId)

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
            <Link
              href={`/clientes/${clienteId}/transmissoes/${transmissao.id}`}
              className="text-[13.5px] font-semibold hover:text-primary hover:underline"
            >
              {transmissao.nome}
            </Link>
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

          {proxima && <ProximaAcao acao={proxima} />}

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
