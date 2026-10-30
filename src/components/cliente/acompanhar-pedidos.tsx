'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { EVENTOS_DA_LOJA } from '@/core/eventos-da-loja'

/**
 * Ligar o status dos pedidos como evento (0153): a cada 10 minutos o
 * Dialogon lê os pedidos da loja, e cada mudança de status vira
 * `pedido.<status>` em Automações > Eventos. Otimista: muda na hora e volta se
 * o servidor recusar.
 */
export function AcompanharPedidos({
  ligado: doServidor,
  eventosHref,
  alternar,
}: {
  ligado: boolean
  eventosHref: string
  alternar: (ligado: boolean) => Promise<{ ok: true } | { ok: false; motivo: string }>
}) {
  const [ligado, setLigado] = useState(doServidor)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, comecar] = useTransition()

  function aoMudar(valor: boolean) {
    setLigado(valor)
    setErro(null)
    comecar(async () => {
      const r = await alternar(valor)
      if (!r.ok) {
        setLigado(!valor)
        setErro(r.motivo)
      }
    })
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-[15px] font-bold tracking-[-0.01em]">Status dos pedidos</h2>
      <p className="mt-1 mb-4 max-w-[600px] text-[13px] leading-6 text-muted">
        Quando um pedido muda de status na loja, uma automação pode começar: a pesquisa pós-compra quando o
        pagamento é aprovado, o aviso de envio quando o pedido é faturado. Sem instalar nada na loja.
      </p>
      <div className="app-card px-5 py-4">
        <LinhaLigaDesliga
          titulo="Acompanhar o status dos pedidos"
          descricao="A loja é consultada a cada 10 minutos, a partir de agora. Pedidos anteriores não disparam nada."
          marcada={ligado}
          aoMudar={aoMudar}
          desabilitada={pendente}
        />
        {erro && <p className="mt-2 text-[12.5px] text-perigo">{erro}</p>}
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Eventos que a loja passa a mandar</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {EVENTOS_DA_LOJA.map((e) => (
              <li key={e.evento} className="text-[12px] leading-5 text-soft">
                <code className="font-mono text-[11.5px] text-primary">{e.evento}</code>
                <span className="text-dim">, {e.rotulo}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-5 text-dim">
            Status próprio da loja vira <code className="font-mono">pedido.</code> mais o código dele. Escolha o que cada
            evento faz em{' '}
            <Link href={eventosHref} className="font-semibold text-primary hover:underline">
              Automações › Eventos
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
