'use client'

import { useState, useTransition } from 'react'
import {
  acharPlano as acharPlanoDoCodigo,
  type Plano,
  comoTamanho,
  fracaoUsada,
  O_QUE_E_CONVERSA,
  PLANOS,
  TARIFA_DA_META,
  type IdDoPlano,
} from '@/core/planos'
import type { ConsumoDoMes } from '@/server/repos/plano'

/**
 * O plano da conta, o consumo do mês, e o pedido de troca.
 *
 * **O botão existe antes do gateway**, e isso é o desenho, não uma pendência:
 * ele registra a intenção e diz que alguém entra em contato. Uma tela de plano
 * sem botão não é metade da solução, é uma tela que não faz nada. Quando o
 * gateway chegar, o mesmo botão passa a levar ao pagamento.
 *
 * Por que não troca sozinho: mudar de plano é mudar o que o cliente paga, e não
 * existe ninguém cobrando ainda. Ver `server/acoes-plano.ts`.
 */
export function EscolhaDePlano({
  atual,
  consumo,
  podeMexer,
  pedidoAberto,
  pedirTroca,
  planos = PLANOS,
}: {
  /** Os planos em vigor (tabela `planos`, A6). Sem eles, os do código. */
  planos?: readonly Plano[]
  atual: IdDoPlano
  consumo: ConsumoDoMes
  podeMexer: boolean
  /** O último pedido de troca ainda não atendido, lido da auditoria. */
  pedidoAberto: { para: IdDoPlano; quando: string; por: string } | null
  pedirTroca: (desejado: IdDoPlano) => Promise<{ ok: boolean; erro?: string }>
}) {
  const acharPlano = (id: IdDoPlano) => planos.find((p) => p.id === id) ?? acharPlanoDoCodigo(id)
  const plano = acharPlano(atual)
  const fracao = fracaoUsada(consumo.conversas, plano)
  const estourou = fracao > 1
  const perto = !estourou && fracao >= 0.8

  const [pedido, setPedido] = useState<IdDoPlano | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function pedir(desejado: IdDoPlano) {
    setErro(null)
    comecar(async () => {
      try {
        const r = await pedirTroca(desejado)
        if (r.ok) setPedido(desejado)
        else setErro(r.erro ?? 'não deu para enviar o pedido')
      } catch {
        setErro('não deu para enviar o pedido agora')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Duas seções com dono diferente (S08): ler o plano e o consumo é de
          todos; pedir troca é do proprietário ou do administrador da conta. */}
      <section className="app-card p-5" aria-labelledby="titulo-seu-plano">
        <h2 id="titulo-seu-plano" className="mb-3 text-[15px] font-bold tracking-[-0.01em]">
          Seu plano e consumo
        </h2>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="text-[11.5px] text-dim">Plano desta organização</p>
            <p className="mt-0.5 text-[19px] font-bold tracking-[-0.02em]">{plano.nome}</p>
          </div>
          <p className="text-[13px] text-muted">
            R$ {plano.preco.toLocaleString('pt-BR')} por mês
          </p>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[13px] font-semibold text-soft">
              {consumo.conversas.toLocaleString('pt-BR')} de{' '}
              {plano.conversas.toLocaleString('pt-BR')} conversas
            </span>
            <span className="text-[11.5px] text-dim">neste mês</span>
          </div>

          {/*
            A barra para em 100% e a cor denuncia o estouro: uma conta com o
            dobro da faixa empurraria a linha inteira para fora do cartão.
          */}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${
                estourou ? 'bg-perigo' : perto ? 'bg-aviso' : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, Math.round(fracao * 100))}%` }}
            />
          </div>

          {/*
            Passar da faixa avisa e não bloqueia, e a frase diz isso com todas as
            letras. Enquanto a medição é nova, um número errado não pode virar
            conta sem atender.
          */}
          <p className={`mt-2 text-[12px] leading-6 ${estourou ? 'text-perigo' : 'text-dim'}`}>
            {estourou
              ? 'Este mês passou do que o plano comporta. Nada foi bloqueado: procure a gente para ajustar a faixa.'
              : O_QUE_E_CONVERSA}
          </p>
        </div>

        <p className="mt-3 border-t border-line pt-3 text-[12px] leading-6 text-dim">
          Também neste mês: {consumo.arquivos.toLocaleString('pt-BR')} arquivo
          {consumo.arquivos === 1 ? '' : 's'} recebido
          {consumo.arquivos === 1 ? '' : 's'}, somando {comoTamanho(consumo.bytes)}.
        </p>
      </section>

      <section aria-labelledby="titulo-solicitar">
        <h2 id="titulo-solicitar" className="text-[15px] font-bold tracking-[-0.01em]">
          Solicitar alteração
        </h2>
        <p className="mt-1 mb-3 max-w-[650px] text-[12.5px] leading-6 text-dim">
          {podeMexer
            ? 'O pedido vai para a 4YU, que confirma com você antes de mudar a cobrança.'
            : 'Só o proprietário ou um administrador da organização pede mudança de plano. Os planos ficam aqui para consulta.'}
        </p>

        {(pedido ?? pedidoAberto) && (
          <p
            role="status"
            className="mb-3 flex max-w-[650px] items-start gap-2 rounded-[11px] border border-primary/20 bg-primary-weak px-4 py-3 text-[12.5px] leading-5 text-soft"
          >
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>
              {pedido
                ? `Pedido para o plano ${acharPlano(pedido).nome} enviado agora. A 4YU entra em contato.`
                : `Pedido para o plano ${acharPlano(pedidoAberto!.para).nome} enviado em ${new Date(
                    pedidoAberto!.quando,
                  ).toLocaleDateString('pt-BR')}${pedidoAberto!.por ? ` por ${pedidoAberto!.por}` : ''}. Aguardando a 4YU.`}
            </span>
          </p>
        )}
        <div className="grid gap-3 lg:grid-cols-3">
          {planos.map((p) => (
            <Cartao
              key={p.id}
              plano={p}
              ehOAtual={p.id === atual}
              pedido={(pedido ?? pedidoAberto?.para) === p.id}
              podeMexer={podeMexer}
              rodando={rodando}
              aoPedir={() => pedir(p.id)}
            />
          ))}
        </div>

        {erro && (
          <p role="alert" className="mt-3 text-[12.5px] text-perigo">
            {erro}
          </p>
        )}

        <p className="mt-4 max-w-[650px] text-[12px] leading-6 text-dim">{TARIFA_DA_META}</p>
      </section>
    </div>
  )
}

function Cartao({
  plano,
  ehOAtual,
  pedido,
  podeMexer,
  rodando,
  aoPedir,
}: {
  plano: Plano
  ehOAtual: boolean
  pedido: boolean
  podeMexer: boolean
  rodando: boolean
  aoPedir: () => void
}) {
  return (
    <article
      className={`app-card flex flex-col p-4 ${ehOAtual ? 'border-primary/50 bg-primary/[0.04]' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[14.5px] font-bold">{plano.nome}</h3>
        {ehOAtual && (
          <span className="rounded-md bg-primary/[0.14] px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
            atual
          </span>
        )}
      </div>

      <p className="mt-1 text-[17px] font-bold tracking-[-0.02em]">
        R$ {plano.preco.toLocaleString('pt-BR')}
        <span className="text-[12px] font-normal text-dim"> por mês</span>
      </p>

      <ul className="mt-3 mb-4 flex flex-1 flex-col gap-1.5">
        {plano.itens.map((item) => {
          /*
            A linha de herança em negrito, e não como mais um item.

            "Tudo do Essencial" não é um recurso ao lado dos outros: é o que diz
            que este plano contém o de baixo inteiro. Escrita com o mesmo peso
            de "Transcrição de áudio", ela se perde na lista, e era justamente
            por isso que ninguém a lia na terceira posição.
          */
          const herda = item.startsWith('Tudo d')
          return (
            <li
              key={item}
              className={
                herda
                  ? 'text-[12px] leading-5 font-semibold text-soft'
                  : 'text-[12px] leading-5 text-muted'
              }
            >
              {item}
            </li>
          )
        })}
      </ul>

      {ehOAtual ? (
        <p className="text-center text-[12px] text-dim">É o plano desta organização</p>
      ) : pedido ? (
        /*
          "Pedido enviado" e não "plano alterado": nada mudou no banco, e dizer o
          contrário faria a pessoa esperar uma fatura que não vem.
        */
        <p className="text-center text-[12px] text-ok">
          Pedido enviado. A gente entra em contato.
        </p>
      ) : (
        <button
          type="button"
          disabled={!podeMexer || rodando}
          onClick={aoPedir}
          title={
            podeMexer
              ? `Pedir mudança para o plano ${plano.nome}`
              : 'Só o proprietário ou um administrador da organização pede mudança de plano'
          }
          className="app-primary-button w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rodando ? 'Enviando...' : 'Quero este plano'}
        </button>
      )}
    </article>
  )
}
