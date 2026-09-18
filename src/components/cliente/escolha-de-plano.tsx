'use client'

import { useState, useTransition } from 'react'
import {
  acharPlano,
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
  pedirTroca,
}: {
  atual: IdDoPlano
  consumo: ConsumoDoMes
  podeMexer: boolean
  pedirTroca: (desejado: IdDoPlano) => Promise<{ ok: boolean; erro?: string }>
}) {
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
      <section className="app-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="text-[11.5px] text-dim">Plano desta conta</p>
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

      <section>
        <h2 className="mb-3 text-[15px] font-bold tracking-[-0.01em]">Os planos</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {PLANOS.map((p) => (
            <Cartao
              key={p.id}
              plano={p}
              ehOAtual={p.id === atual}
              pedido={pedido === p.id}
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

        {!podeMexer && (
          <p className="mt-3 text-[12.5px] leading-6 text-dim">
            Só quem administra a conta pode pedir mudança de plano.
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
  plano: (typeof PLANOS)[number]
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
            de "Transcrição de áudio", ela se perde na lista — e era justamente
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
        <p className="text-center text-[12px] text-dim">É o plano desta conta</p>
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
              : 'Só quem administra a conta pode pedir mudança de plano'
          }
          className="app-primary-button w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rodando ? 'Enviando...' : 'Quero este plano'}
        </button>
      )}
    </article>
  )
}
