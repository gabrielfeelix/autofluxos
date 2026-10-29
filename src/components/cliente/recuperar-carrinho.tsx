'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Botao } from '@/components/design/botao'
import type { ResultadoDosModelosDoCarrinho } from '@/server/acoes-carrinho'

export type ModeloNaTela = { nome: string; status: 'ausente' | 'rascunho' | 'pendente' | 'aprovado' | 'recusado' | 'pausado' | string }

const ROTULO: Record<string, string> = {
  ausente: 'Não criado',
  rascunho: 'Não enviado',
  pendente: 'Em revisão',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  pausado: 'Pausado',
}

const COR: Record<string, string> = {
  ausente: 'bg-line',
  rascunho: 'bg-dim',
  pendente: 'bg-amber-500',
  aprovado: 'bg-emerald-500',
  recusado: 'bg-rose-500',
  pausado: 'bg-rose-500',
}

/**
 * Recuperação de carrinho: a prévia do que o cliente recebe, os dez modelos
 * (um por quantidade de itens, `core/carrinho.ts`) e o caminho para o técnico
 * da loja ligar o envio pela API.
 *
 * O botão cria **o texto que a prévia mostra**: a prévia é a aprovação. Depois
 * de criado, o texto só muda apagando e recriando, que é regra da Meta.
 */
export function RecuperarCarrinho({
  loja,
  modelos: doServidor,
  criar,
  guiaHref,
  apiHref,
}: {
  loja: string
  modelos: ModeloNaTela[]
  criar: () => Promise<ResultadoDosModelosDoCarrinho>
  guiaHref: string
  apiHref: string
}) {
  const [modelos, setModelos] = useState(doServidor)
  const [recado, setRecado] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)
  const [pendente, comecar] = useTransition()
  const faltam = modelos.filter((m) => m.status === 'ausente').length
  const aprovados = modelos.filter((m) => m.status === 'aprovado').length

  function aoCriar() {
    setRecado(null)
    comecar(async () => {
      const r = await criar()
      if (!r.ok) {
        setRecado({ tom: 'erro', texto: r.erro })
        return
      }
      setModelos((atual) => atual.map((m) => (r.criados.includes(m.nome) ? { ...m, status: 'pendente' } : m)))
      setRecado(
        r.falhas.length > 0
          ? { tom: 'erro', texto: `${r.criados.length} enviados para a Meta. Falharam: ${r.falhas.map((f) => `${f.nome} (${f.erro})`).join('; ')}` }
          : { tom: 'ok', texto: `${r.criados.length} modelos enviados para a revisão da Meta. Costuma levar de minutos a um dia.` },
      )
    })
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-[15px] font-bold tracking-[-0.01em]">Carrinho abandonado</h2>
      <p className="mt-1 mb-4 max-w-[600px] text-[13px] leading-6 text-muted">
        Quem deixou produtos no carrinho recebe um WhatsApp com a foto, o nome e o preço de cada item, e o botão para
        finalizar a compra. Só vai para quem aceitou promoções no checkout e não pediu para sair.
      </p>

      <div className="app-card overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <Previa loja={loja} />

          <div className="flex flex-col">
            <p className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Um modelo por tamanho de carrinho</p>
            <p className="mt-1 text-[12px] leading-5 text-dim">
              A Meta só envia carrossel com o número de cartões aprovado. De 2 a 10 itens é carrossel; 1 item vai com a
              foto no topo.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {modelos.map((m) => (
                <li key={m.nome} className="flex items-center gap-2 text-[12px]" title={ROTULO[m.status] ?? m.status}>
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${COR[m.status] ?? 'bg-dim'}`} />
                  <code className="font-mono text-[11.5px] text-soft">{m.nome}</code>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] font-semibold text-soft">
              {aprovados === modelos.length ? 'Todos aprovados.' : `${aprovados} de ${modelos.length} aprovados`}
            </p>
            {faltam > 0 && (
              <Botao variante="primario" className="mt-4 w-full" onClick={aoCriar} disabled={pendente}>
                {pendente ? 'Enviando para a Meta…' : faltam === modelos.length ? 'Criar os 10 modelos' : `Criar os ${faltam} que faltam`}
              </Botao>
            )}
            {faltam > 0 && <p className="mt-2 text-[11.5px] leading-5 text-dim">Cria com o texto da prévia, como marketing.</p>}
            {recado && <p className={`mt-2 text-[12px] leading-5 ${recado.tom === 'erro' ? 'text-perigo' : 'text-ok'}`}>{recado.texto}</p>}
          </div>
        </div>

        <div className="border-t border-line bg-surface px-5 py-4">
          <p className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Para ligar o envio</p>
          <ol className="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-5 text-soft">
            <li>
              1. Crie uma chave em{' '}
              <Link href={apiHref} className="font-semibold text-primary hover:underline">
                Configurações › API
              </Link>{' '}
              marcando só <code className="font-mono text-[11.5px]">mensagens:enviar</code>.
            </li>
            <li>
              2. Mande a chave e o{' '}
              <Link href={guiaHref} className="font-semibold text-primary hover:underline">
                guia da API
              </Link>{' '}
              ao técnico da loja. A loja escolhe o modelo pelo número de itens do carrinho.
            </li>
          </ol>
          <p className="mt-3 text-[12px] leading-5 text-dim">Cada mensagem é cobrada pela Meta como marketing, cerca de R$ 0,32.</p>
        </div>
      </div>
    </section>
  )
}

const ITENS = [
  { nome: 'Headset Gamer', preco: 'R$ 349,90' },
  { nome: 'Mouse sem fio', preco: 'R$ 189,90' },
  { nome: 'Teclado mecânico', preco: 'R$ 429,90' },
]

/** O carrossel como chega no WhatsApp, com o texto exato dos modelos. */
function Previa({ loja }: { loja: string }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-[#efeae2] p-3 dark:bg-[#0b141a]">
      <div className="max-w-[340px] rounded-lg rounded-tl-none bg-white px-3 py-2 text-[13px] leading-[1.45] text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
        Oi, Maria! Os itens que você escolheu na {loja} continuam no seu carrinho. Se ficou alguma dúvida sobre produto,
        frete ou pagamento, é só responder esta mensagem.
        <br />
        <br />
        Para não receber promoções, responda SAIR.
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {ITENS.map((item) => (
          <div key={item.nome} className="w-[180px] shrink-0 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-[#202c33]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/exemplos/carrinho-produto.jpg" alt="" className="aspect-[1.91] w-full object-cover" />
            <p className="px-2.5 py-2 text-[12.5px] leading-[1.4] text-[#111b21] dark:text-[#e9edef]">
              Este item ficou esperando por você no carrinho: {item.nome}, por {item.preco} no site da loja.
            </p>
            <p className="border-t border-black/10 py-2 text-center text-[12.5px] font-medium text-[#027eb5] dark:border-white/10 dark:text-[#53bdeb]">
              Finalizar compra
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
