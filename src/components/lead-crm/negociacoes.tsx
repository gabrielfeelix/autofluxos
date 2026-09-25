'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { comoDinheiro, type Situacao } from '@/core/crm'
import { comoParado, estaParado } from '@/core/quadros'
import { FecharCartao } from '@/components/quadros/fechar-cartao'
import { acaoReabrirCartao } from '@/server/acoes-crm'
import { IconeDaSecao, iconeFunil } from './icones'

/** Um cartão desta pessoa, como `quadrosDoContato` devolve. */
export type NegociacaoDoContato = {
  cartaoId: string
  quadro: string
  etapa: string
  entrouEm: string
  titulo: string | null
  valor: number | null
  situacao: Situacao
}

/**
 * As negociações da pessoa, na ficha dela.
 *
 * **Vêm antes de etiqueta e anotação** porque respondem a pergunta cara ,
 * quanto essa pessoa vale e em que pé está cada conversa de venda , enquanto
 * as outras duas são apoio. A ficha abria em "Etiquetas", que é o mesmo defeito
 * que o Inbox já tinha corrigido na coluna dele.
 *
 * Ganhar e perder usam o **mesmo modal do quadro** (`FecharCartao`): mesma
 * assimetria (ganhar segue sem valor, perder não segue sem motivo) e mesma
 * lista fechada de motivos. Duas telas com dois modais de fechar venda viram,
 * em um mês, duas regras de fechar venda.
 *
 * Depois de fechar, `router.refresh()`: o que muda aqui é mais do que o
 * cartão (o estágio anda, a linha do tempo ganha uma linha, o "já rendeu"
 * muda). Fechar não é otimista (dispara o cliente e o funil seguinte), mas a
 * linha vira GANHA ou PERDIDA no "ok", sem esperar o redesenho.
 *
 * Reabrir é otimista desde 25/set: a linha volta a ter Ganhar e Perder no
 * clique, e volta ao que era se o servidor recusar. Não recarrega a ficha.
 */
export function Negociacoes({
  clienteId,
  nome,
  negociacoes,
  motivos,
}: {
  clienteId: string
  /** O nome da pessoa, para o título do modal dizer de quem é a venda. */
  nome: string
  negociacoes: NegociacaoDoContato[]
  motivos: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [fechando, setFechando] = useState<{
    cartao: NegociacaoDoContato
    situacao: Exclude<Situacao, 'aberta'>
  } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  /** A situação que esta aba acabou de dar a cada cartão, por cima da do servidor. */
  const [situacoes, setSituacoes] = useState<ReadonlyMap<string, Situacao>>(new Map())
  const situacaoDe = (n: NegociacaoDoContato) => situacoes.get(n.cartaoId) ?? n.situacao
  const marcar = (cartaoId: string, situacao: Situacao | undefined) =>
    setSituacoes((antes) => {
      const novo = new Map(antes)
      if (situacao) novo.set(cartaoId, situacao)
      else novo.delete(cartaoId)
      return novo
    })

  if (negociacoes.length === 0) {
    return (
      <section className="app-card overflow-hidden">
        <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao>{iconeFunil}</IconeDaSecao>
        Negociações
      </h2>
        {/* Fora de todo funil a frase diz onde se resolve isso, e não só que
            está vazio: pôr alguém num funil é decisão de quem vende. */}
        <p className="px-[18px] py-[22px] text-xs leading-5 text-dim">
          Esta pessoa não está em nenhum funil. Ela entra pela tela de Funil de vendas, arrastando o
          cartão, ou pelo botão de trazer os contatos que ainda estão de fora.
        </p>
      </section>
    )
  }

  return (
    <section className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao>{iconeFunil}</IconeDaSecao>
        Negociações
      </h2>

      <ul>
        {negociacoes.map((negociacao) => {
          const situacao = situacaoDe(negociacao)
          const aberta = situacao === 'aberta'
          const parada = aberta && estaParado(negociacao.entrouEm)
          return (
            <li key={negociacao.cartaoId} className="border-b border-line px-[18px] py-3.5 last:border-0">
              <span className="block text-[10.5px] tracking-[0.04em] text-dim uppercase">
                {negociacao.quadro}
              </span>
              <strong className="mt-0.5 block text-[12.5px] font-semibold text-soft">
                {negociacao.etapa}{' '}
                <span className={parada ? 'font-normal text-aviso' : 'font-normal text-dim'}>
                  · {comoParado(negociacao.entrouEm)}
                </span>
              </strong>

              {(negociacao.titulo || negociacao.valor !== null) && (
                <span className="mt-1.5 block text-[12.5px] leading-5">
                  {negociacao.titulo || 'sem título'}
                  {negociacao.valor !== null && (
                    <span className="font-semibold"> · {comoDinheiro(negociacao.valor)}</span>
                  )}
                </span>
              )}

              {aberta ? (
                <span className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFechando({ cartao: negociacao, situacao: 'ganha' })}
                    className="rounded-[9px] border border-emerald-400/30 bg-emerald-400/[0.1] px-3 py-1.5 text-[11.5px] font-bold text-ok transition hover:bg-emerald-400/[0.18]"
                  >
                    Ganhar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFechando({ cartao: negociacao, situacao: 'perdida' })}
                    className="rounded-[9px] border border-line bg-surface px-3 py-1.5 text-[11.5px] font-bold text-muted transition hover:border-strong"
                  >
                    Perder
                  </button>
                </span>
              ) : (
                <span className="mt-2.5 flex items-center gap-2.5">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${
                      situacao === 'ganha'
                        ? 'border-emerald-400/25 bg-emerald-400/[0.09] text-ok'
                        : 'border-line bg-surface text-muted'
                    }`}
                  >
                    {situacao === 'ganha' ? 'GANHA' : 'PERDIDA'}
                  </span>
                  {/* Fechar é um clique, e errar o clique é rotina, mesma
                      frase e mesma ação do menu do cartão. */}
                  <button
                    type="button"
                    onClick={() => reabrir(negociacao.cartaoId)}
                    className="text-[11.5px] text-muted underline decoration-dotted underline-offset-2 transition hover:text-primary disabled:opacity-50"
                  >
                    Reabrir
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {aviso && (
        <p role="status" className="border-t border-line px-[18px] py-2.5 text-[11.5px] leading-5 text-muted">
          {aviso}
        </p>
      )}

      {/* A `key` reseta os campos do modal entre uma venda e outra, ver o
          comentário em `fechar-cartao.tsx`. */}
      {fechando && (
        <FecharCartao
          key={`${fechando.cartao.cartaoId}-${fechando.situacao}`}
          clienteId={clienteId}
          cartao={{
            id: fechando.cartao.cartaoId,
            nome,
            titulo: fechando.cartao.titulo,
            valor: fechando.cartao.valor,
          }}
          situacao={fechando.situacao}
          motivos={motivos}
          aoFechar={() => setFechando(null)}
          aoConcluir={(resultado) => {
            marcar(fechando.cartao.cartaoId, fechando.situacao)
            setFechando(null)
            setAviso(
              resultado.abriuEm
                ? `Ganha. O cartão seguinte abriu em ${resultado.abriuEm}.`
                : null,
            )
            router.refresh()
          }}
        />
      )}
    </section>
  )

  function reabrir(cartaoId: string) {
    setAviso(null)
    const antes = situacoes.get(cartaoId)
    marcar(cartaoId, 'aberta')
    depoisDaTela(() => acaoReabrirCartao(clienteId, cartaoId)).then(
      (r) => {
        if (!r.ok) {
          marcar(cartaoId, antes)
          setAviso(r.erro ?? 'não deu para reabrir')
        }
      },
      () => {
        marcar(cartaoId, antes)
        setAviso('sem conexão com o servidor: a venda continua fechada')
      },
    )
  }
}
