import type { Metadata } from 'next'
import { pedidoDoEntregador } from '@/server/entregador/link'
import { BotoesDoEntregador } from './botoes'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Entrega',
  // Endereço de cliente não é conteúdo para busca.
  robots: { index: false, follow: false },
}

const MOTIVO = {
  invalido: 'Este link não é válido. Peça um novo à loja.',
  vencido: 'Este link venceu. Peça um novo à loja.',
  sumiu: 'Pedido não encontrado. Fale com a loja.',
} as const

/**
 * A página do motoboy (Fase 1 do plano de cardápios): o pedido, o endereço
 * com "Abrir no mapa" e dois botões grandes. Sem login: a chave é o token
 * assinado no endereço (`server/entregador/token.ts`), que vence em 24 horas.
 * Feita para o celular, com uma mão, na rua.
 */
export default async function PaginaDoEntregador({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const lido = await pedidoDoEntregador(decodeURIComponent(token))

  return (
    <main className="flex min-h-dvh justify-center bg-surface px-4 py-6 sm:items-center sm:py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        {!lido.ok ? (
          <section className="rounded-[16px] border border-line bg-panel p-5 text-center shadow-[0_10px_30px_rgba(19,25,34,0.08)]">
            <p className="text-[15px] font-bold text-ink">Link indisponível</p>
            <p className="mt-1.5 text-[13.5px] leading-5 text-soft">{MOTIVO[lido.motivo]}</p>
          </section>
        ) : (
          <>
            <section className="rounded-[16px] border border-line bg-panel p-5 shadow-[0_10px_30px_rgba(19,25,34,0.08)]">
              {lido.loja && <p className="text-[12.5px] font-semibold text-soft">{lido.loja}</p>}
              <h1 className="mt-0.5 text-[22px] leading-tight font-bold tracking-[-0.01em] text-ink tabular-nums">
                Pedido #{lido.pedido.numeroExibido ?? lido.pedido.numero}
              </h1>
              {lido.cliente && <p className="mt-1 text-[14.5px] font-semibold text-ink">{lido.cliente}</p>}

              {lido.pedido.endereco ? (
                <div className="mt-4 rounded-[12px] bg-surface-strong/70 p-3.5">
                  <p className="text-[11px] font-bold tracking-[0.06em] text-dim uppercase">Endereço</p>
                  <p className="mt-1 text-[15px] leading-6 text-ink">{lido.pedido.endereco}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lido.pedido.endereco)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex h-11 items-center justify-center rounded-[10px] border border-line bg-panel text-[14px] font-semibold text-ink"
                  >
                    Abrir no mapa
                  </a>
                </div>
              ) : (
                <p className="mt-4 rounded-[12px] bg-surface-strong/70 p-3.5 text-[13.5px] text-soft">
                  Pedido sem endereço cadastrado. Confirme com a loja.
                </p>
              )}

              {lido.pedido.itens.length > 0 && (
                <ul className="mt-4 space-y-1 border-t border-line-soft pt-3 text-[13.5px] leading-5 text-soft">
                  {lido.pedido.itens.map((i, n) => (
                    <li key={n} className="flex gap-2">
                      <span className="w-7 shrink-0 font-semibold text-ink tabular-nums">{i.quantidade}x</span>
                      <span className="min-w-0">{i.nome}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <BotoesDoEntregador token={decodeURIComponent(token)} inicial={lido.pedido.status} />
          </>
        )}
      </div>
    </main>
  )
}
