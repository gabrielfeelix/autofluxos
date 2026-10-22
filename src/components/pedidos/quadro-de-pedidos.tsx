'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Alternador } from '@/components/design/alternador'
import { Avatar } from '@/components/design/avatar'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { CabecalhoDaTela, Contagem, type TopoDaTela } from '@/components/design/cabecalho-da-tela'
import { useConfirmar } from '@/components/design/confirmar'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import type { EtapaDoPedido, StatusDePedido } from '@/core/pedidos'
import { hrefDaFicha } from '@/core/volta-da-ficha'
import { acaoListarPedidos, acaoMoverPedido } from '@/server/acoes-pedidos'
import type { CartaoDePedido } from '@/server/pedidos'

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ENTREGA: Record<CartaoDePedido['entrega'], string> = {
  entrega: 'Entrega',
  retirada: 'Retirada',
  local: 'No local',
}

const TOM: Record<StatusDePedido, TomDaPilula> = {
  novo: 'aviso',
  pago: 'destaque',
  em_preparo: 'destaque',
  saiu: 'destaque',
  entregue: 'ok',
  cancelado: 'neutro',
}

/** "agora", "há 5 min", "há 2 h", "ontem". */
function haQuanto(iso: string, agora: number): string {
  const minutos = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000))
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return horas < 24 ? `há ${horas} h` : horas < 48 ? 'ontem' : `há ${Math.floor(horas / 24)} dias`
}

/**
 * "Marcar como pago", "Pronto para retirar" ou a etapa seguinte. No quadro a
 * coluna é estreita e o botão leva à coluna ao lado: basta o nome dela.
 */
function rotuloDoBotao(
  seguinte: EtapaDoPedido,
  entrega: CartaoDePedido['entrega'],
  rotulos: Record<StatusDePedido, string>,
  compacto: boolean,
): string {
  if (seguinte.status === 'pago') return 'Marcar como pago'
  if (seguinte.status === 'saiu' && entrega !== 'entrega' && rotulos.saiu === NOME_DE_SAIU) return 'Pronto para retirar'
  return compacto ? `${seguinte.rotulo} →` : `Mover para ${seguinte.rotulo}`
}

const NOME_DE_SAIU = 'Saiu para entrega'

type Filtro = 'abertos' | 'entregues' | 'cancelados'
const ABERTOS: readonly StatusDePedido[] = ['novo', 'pago', 'em_preparo', 'saiu']

/**
 * Os pedidos feitos pela conversa (0146): quadro por etapa ou lista, à escolha.
 *
 * O botão do cartão leva à próxima etapa do ramo, na hora, e desfaz se o
 * servidor recusar. A tela se atualiza sozinha a cada 20 segundos enquanto
 * está aberta, para o pedido novo aparecer sem ninguém recarregar; com uma
 * mudança no meio do caminho, espera a próxima volta.
 */
export function QuadroDePedidos({
  clienteId,
  inicial,
  etapas,
  rotulos,
  visaoInicial,
  topo,
}: {
  clienteId: string
  inicial: CartaoDePedido[]
  etapas: EtapaDoPedido[]
  rotulos: Record<StatusDePedido, string>
  visaoInicial: 'quadro' | 'lista'
  topo: TopoDaTela
}) {
  const [lista, setLista] = useState(inicial)
  const [visao, setVisao] = useState(visaoInicial)
  const [filtro, setFiltro] = useState<Filtro>('abertos')
  const [agora, setAgora] = useState(() => Date.now())
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null)
  const emAndamento = useRef(0)
  const { confirmar, dialogo } = useConfirmar()

  useEffect(() => {
    const id = window.setInterval(async () => {
      setAgora(Date.now())
      if (emAndamento.current > 0 || document.hidden) return
      const novos = await acaoListarPedidos(clienteId).catch(() => null)
      if (novos && emAndamento.current === 0) setLista(novos)
    }, 20_000)
    return () => window.clearInterval(id)
  }, [clienteId])

  const ordemDaEtapa = (s: StatusDePedido) => etapas.findIndex((e) => e.status === s)
  const proxima = (s: StatusDePedido): EtapaDoPedido | null => {
    if (s === 'cancelado' || s === 'entregue') return null
    return etapas[ordemDaEtapa(s) + 1] ?? null
  }

  async function mover(p: CartaoDePedido, para: StatusDePedido) {
    emAndamento.current++
    setLista((atual) => atual.map((x) => (x.id === p.id ? { ...x, status: para, aguardaPagamento: false } : x)))
    try {
      const r = await acaoMoverPedido(clienteId, p.id, para)
      if (!r.ok) {
        setLista((atual) => atual.map((x) => (x.id === p.id ? p : x)))
        setRecado({ texto: r.erro, erro: true })
        return { ok: false as const, erro: r.erro }
      }
      setRecado({
        texto: `Pedido ${p.numero}: ${rotulos[para].toLowerCase()}.${r.avisado ? ' A pessoa foi avisada na conversa.' : ''}`,
      })
      return { ok: true as const }
    } catch {
      setLista((atual) => atual.map((x) => (x.id === p.id ? p : x)))
      setRecado({ texto: 'Não foi possível mudar o pedido agora. Tente de novo.', erro: true })
      return { ok: false as const, erro: 'Não foi possível mudar o pedido agora.' }
    } finally {
      emAndamento.current--
    }
  }

  const cancelar = (p: CartaoDePedido) =>
    confirmar({
      titulo: `Cancelar o pedido ${p.numero}?`,
      descricao: p.aguardaPagamento
        ? 'O Pix deixa de valer, o estoque volta e a pessoa recebe o aviso na conversa, se ela estiver dentro das 24 horas.'
        : 'O estoque volta e a pessoa recebe o aviso na conversa, se ela estiver dentro das 24 horas. Se já pagou, o estorno é feito no gateway.',
      rotulo: 'Cancelar pedido',
      tom: 'perigo',
      aoConfirmar: () => mover(p, 'cancelado'),
    })

  const abertos = lista.filter((p) => ABERTOS.includes(p.status))
  const naLista =
    filtro === 'abertos' ? abertos : lista.filter((p) => p.status === (filtro === 'entregues' ? 'entregue' : 'cancelado'))

  const cartao = (p: CartaoDePedido, compacto: boolean) => {
    const seguinte = proxima(p.status)
    const outras = etapas.filter((e) => e.status !== p.status && e.status !== seguinte?.status)
    const fechado = p.status === 'entregue' || p.status === 'cancelado'
    const botao = seguinte ? (
      <button
        type="button"
        onClick={() => void mover(p, seguinte.status)}
        className={`h-8 shrink-0 rounded-[8px] bg-primary px-3 text-[12px] font-semibold whitespace-nowrap text-white transition hover:brightness-110 ${compacto ? 'w-full' : ''}`}
      >
        {rotuloDoBotao(seguinte, p.entrega, rotulos, compacto)}
      </button>
    ) : null
    return (
      <article
        key={p.id}
        className={`flex flex-col gap-2.5 rounded-[12px] border border-line bg-panel p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
          p.status === 'cancelado' ? 'opacity-70' : ''
        }`}
      >
        <header className="flex items-center gap-2">
          <span className="text-[14px] font-bold tracking-[-0.01em] tabular-nums">#{p.numero}</span>
          <span className="text-[11.5px] whitespace-nowrap text-dim tabular-nums">{haQuanto(p.criadoEm, agora)}</span>
          <span className="flex-1" />
          {!compacto && <Pilula tom={TOM[p.status]}>{rotulos[p.status]}</Pilula>}
          <span className="shrink-0 rounded-full bg-surface-strong px-2 py-0.5 text-[10.5px] font-semibold text-soft">
            {ENTREGA[p.entrega]}
          </span>
        </header>

        <div className="flex min-w-0 items-center gap-2">
          <Avatar nome={p.contato} tamanho={26} />
          {p.contatoId ? (
            <Link
              href={hrefDaFicha(clienteId, p.contatoId)}
              className="min-w-0 truncate text-[13px] font-semibold text-ink hover:text-primary"
            >
              {p.contato}
            </Link>
          ) : (
            <span className="min-w-0 truncate text-[13px] font-semibold text-dim">{p.contato}</span>
          )}
        </div>

        {p.itens.length > 0 ? (
          <ul className="space-y-0.5 text-[12.5px] leading-5 text-soft">
            {p.itens.map((i, n) => (
              <li key={n} className="flex gap-1.5">
                <span className="w-6 shrink-0 font-semibold text-ink tabular-nums">{i.quantidade}x</span>
                <span className="min-w-0">{i.nome}</span>
              </li>
            ))}
          </ul>
        ) : p.observacao ? (
          <p className="text-[12.5px] leading-5 text-soft">{p.observacao}</p>
        ) : null}

        {p.entrega === 'entrega' && p.endereco && (
          <p className="rounded-[8px] bg-surface-strong/70 px-2.5 py-1.5 text-[12px] leading-[1.45] text-soft">{p.endereco}</p>
        )}

        {p.aguardaPagamento && (
          <span className="self-start">
            <Pilula tom="aviso">Aguardando pagamento</Pilula>
          </span>
        )}

        <footer className={`flex border-t border-line-soft pt-2.5 ${compacto ? 'flex-col gap-2' : 'items-center gap-2'}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {p.totalCentavos !== null && (
              <span className="text-[13.5px] font-bold whitespace-nowrap tabular-nums">{reais(p.totalCentavos)}</span>
            )}
            <span className="flex-1" />
            {!compacto && botao}
            {!fechado && (
              <PopoverDoQuadro
                rotulo={`Mais ações do pedido ${p.numero}`}
                largura={210}
                gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">⋯</span>}
              >
                {outras.map((e) => (
                  <button
                    key={e.status}
                    type="button"
                    data-fechar-popover
                    className="quadro-menu-item"
                    onClick={() => void mover(p, e.status)}
                  >
                    Mover para {e.rotulo}
                  </button>
                ))}
                <button
                  type="button"
                  data-fechar-popover
                  className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
                  onClick={() => cancelar(p)}
                >
                  Cancelar pedido…
                </button>
              </PopoverDoQuadro>
            )}
          </div>
          {compacto && botao}
        </footer>
      </article>
    )
  }

  return (
    <>
      <CabecalhoDaTela
        {...topo}
        contagem={<Contagem>{abertos.length} {abertos.length === 1 ? 'aberto' : 'abertos'}</Contagem>}
        acoes={
          <Alternador
            rotulo="Ver pedidos como"
            ativa={visao}
            aoEscolher={setVisao}
            opcoes={[
              { chave: 'quadro', rotulo: 'Quadro' },
              { chave: 'lista', rotulo: 'Lista' },
            ]}
          />
        }
      />

      {lista.length === 0 ? (
        <section className="app-card px-5 py-14 text-center">
          <p className="text-[13.5px] font-semibold text-soft">Nenhum pedido ainda</p>
          <p className="mx-auto mt-1.5 max-w-[460px] text-[12.5px] leading-5 text-dim">
            Na conversa, use Cobrar &gt; Do catálogo: os itens viram um pedido aqui, com o número, a entrega e o
            pagamento. O bloco Cobrar das automações também cria pedidos.
          </p>
        </section>
      ) : visao === 'quadro' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="flex snap-x snap-mandatory gap-3 sm:snap-none">
            {etapas.map((etapa) => {
              const daEtapa = lista.filter((p) => p.status === etapa.status)
              return (
                <section
                  key={etapa.status}
                  aria-label={etapa.rotulo}
                  className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border border-line/60 bg-surface sm:w-[280px] sm:max-w-none xl:w-auto xl:min-w-[200px] xl:flex-1"
                >
                  <header className="flex items-center gap-2 px-3 py-3">
                    <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-soft">{etapa.rotulo}</h3>
                    <span className="shrink-0 rounded-full bg-surface-strong px-1.5 py-0.5 text-[10.5px] text-dim tabular-nums">
                      {daEtapa.length}
                    </span>
                  </header>
                  <div className="flex flex-col gap-2.5 px-2.5 pb-2.5">
                    {daEtapa.length === 0 ? (
                      <p className="rounded-[10px] border border-dashed border-line px-3 py-5 text-center text-[11.5px] text-dim">
                        Nenhum pedido aqui
                      </p>
                    ) : (
                      daEtapa.map((p) => cartao(p, true))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Pedidos" className="mb-3 flex flex-wrap gap-1.5">
            {(
              [
                ['abertos', 'Abertos'],
                ['entregues', rotulos.entregue === 'Entregue' ? 'Entregues' : `${rotulos.entregue}s`],
                ['cancelados', 'Cancelados'],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filtro === id}
                onClick={() => setFiltro(id)}
                className={`h-8 rounded-full border px-3 text-[12px] font-semibold transition ${
                  filtro === id ? 'border-primary/30 bg-primary-weak text-primary' : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {naLista.length === 0 ? (
            <section className="app-card px-5 py-12 text-center text-[12.5px] text-dim">Nenhum pedido neste filtro.</section>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3">
              {naLista.map((p) => cartao(p, false))}
            </div>
          )}
        </>
      )}

      {recado && (
        <AvisoFlutuante tom={recado.erro ? 'erro' : 'neutro'} aoSumir={() => setRecado(null)}>
          {recado.texto}
        </AvisoFlutuante>
      )}
      {dialogo}
    </>
  )
}
