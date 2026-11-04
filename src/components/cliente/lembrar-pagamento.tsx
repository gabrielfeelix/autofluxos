'use client'

import { useEffect, useState, useTransition } from 'react'
import { Alternador } from '@/components/design/alternador'
import { Botao } from '@/components/design/botao'
import { Dropdown } from '@/components/design/dropdown'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { ESPERAS_EM_HORAS, type LembreteDePagamento } from '@/core/lembrete-de-pagamento'
import type { CupomDaLoja } from '@/loja/magento-cupons'

type Resultado = { ok: true } | { ok: false; motivo: string }

const ROTULO: Record<string, string> = {
  ausente: 'Não criado',
  rascunho: 'Não enviado',
  pendente: 'Em revisão na Meta',
  aprovado: 'Aprovado',
  recusado: 'Recusado pela Meta',
  pausado: 'Pausado pela Meta',
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
 * Lembrete de pagamento pendente (0162): quem fez o pedido e não pagou recebe
 * a foto do produto, o botão para a página dele e, se a loja quiser, um cupom.
 * Cada mudança salva na hora e volta se o servidor recusar.
 */
export function LembrarPagamento({
  inicial,
  modelos: doServidor,
  salvar,
  criarModelo,
  listarCupons,
}: {
  inicial: LembreteDePagamento
  /** Status de cada modelo: `comCupom` e `semCupom`. */
  modelos: { comCupom: string; semCupom: string }
  salvar: (config: LembreteDePagamento) => Promise<Resultado>
  criarModelo: (comCupom: boolean) => Promise<Resultado>
  listarCupons: () => Promise<{ ok: true; cupons: CupomDaLoja[] } | { ok: false; motivo: string }>
}) {
  const [config, setConfig] = useState(inicial)
  const [modelos, setModelos] = useState(doServidor)
  const [cupons, setCupons] = useState<CupomDaLoja[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [recado, setRecado] = useState<string | null>(null)
  const [salvando, comecar] = useTransition()
  const [criando, comecarCriacao] = useTransition()

  useEffect(() => {
    let vivo = true
    void listarCupons().then((r) => {
      if (vivo) setCupons(r.ok ? r.cupons : [])
    })
    return () => {
      vivo = false
    }
  }, [listarCupons])

  const comCupom = Boolean(config.cupom)
  const statusDoModelo = comCupom ? modelos.comCupom : modelos.semCupom

  function mudar(parcial: Partial<LembreteDePagamento>) {
    const anterior = config
    const proximo = { ...config, ...parcial }
    // Trocar de modelo para um que não está aprovado desliga: ligado sem modelo não manda nada.
    const status = proximo.cupom ? modelos.comCupom : modelos.semCupom
    if (proximo.ativo && status !== 'aprovado' && parcial.ativo === undefined) proximo.ativo = false
    setConfig(proximo)
    setErro(null)
    comecar(async () => {
      const r = await salvar(proximo)
      if (!r.ok) {
        setConfig(anterior)
        setErro(r.motivo)
      }
    })
  }

  function aoCriar() {
    setErro(null)
    comecarCriacao(async () => {
      const r = await criarModelo(comCupom)
      if (!r.ok) {
        setErro(r.motivo)
        return
      }
      setModelos((m) => (comCupom ? { ...m, comCupom: 'pendente' } : { ...m, semCupom: 'pendente' }))
      setRecado('Modelo enviado para a revisão da Meta. Costuma levar de minutos a algumas horas.')
    })
  }

  const opcoesDeCupom = [
    { valor: '', rotulo: 'Sem cupom', detalhe: 'Só lembra do pedido' },
    ...(cupons ?? (config.cupom ? [{ codigo: config.cupom, desconto: config.desconto ?? '' } as CupomDaLoja] : [])).map((c) => ({
      valor: c.codigo,
      rotulo: c.codigo,
      detalhe: c.desconto,
    })),
  ]

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-[15px] font-bold tracking-[-0.01em]">Pagamento pendente</h2>
      <p className="mt-1 mb-4 max-w-[600px] text-[13px] leading-6 text-muted">
        Quem fez o pedido e não pagou recebe um WhatsApp com a foto do produto e o botão para voltar à página dele. Com
        cupom, a mensagem oferece o desconto e o botão de copiar o código.
      </p>

      <div className="app-card overflow-hidden">
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_280px]">
          <Previa cupom={config.cupom} desconto={config.desconto} />

          <div className="flex min-w-0 flex-col gap-5">
            <LinhaLigaDesliga
              titulo="Lembrar quem não pagou"
              descricao="Uma mensagem por pedido, só se ele continuar pendente."
              marcada={config.ativo}
              aoMudar={(ativo) => mudar({ ativo })}
              desabilitada={salvando}
            />

            <div>
              <p className="mb-2 text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Esperar antes de lembrar</p>
              <Alternador
                rotulo="Esperar antes de lembrar"
                opcoes={ESPERAS_EM_HORAS.map((h) => ({ chave: String(h), rotulo: `${h}h` }))}
                ativa={String(config.esperaHoras)}
                aoEscolher={(h) => mudar({ esperaHoras: Number(h) })}
              />
              <p className="mt-1.5 text-[11.5px] leading-5 text-dim">Pedidos com mais de 48 horas ficam de fora.</p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Cupom</p>
              <Dropdown
                opcoes={opcoesDeCupom}
                valor={config.cupom ?? ''}
                aoMudar={(codigo) => {
                  const escolhido = cupons?.find((c) => c.codigo === codigo)
                  mudar(codigo ? { cupom: codigo, desconto: escolhido?.desconto ?? config.desconto } : { cupom: null, desconto: null })
                }}
                rotuloAcessivel="Cupom do lembrete"
                desabilitado={salvando || cupons === null}
                className="w-full"
              />
              {cupons === null && <p className="mt-1.5 text-[11.5px] text-dim">Buscando os cupons da loja…</p>}
            </div>

            <LinhaLigaDesliga
              titulo="Só para quem aceitou promoções"
              descricao="Confere o aceite de WhatsApp no cadastro do cliente na loja."
              marcada={config.exigirAceite}
              aoMudar={(exigirAceite) => mudar({ exigirAceite })}
              desabilitada={salvando}
            />

            <div className="border-t border-line pt-4">
              <p className="flex items-center gap-2 text-[12px]">
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${COR[statusDoModelo] ?? 'bg-dim'}`} />
                <span className="font-semibold text-soft">{ROTULO[statusDoModelo] ?? statusDoModelo}</span>
                <code className="truncate font-mono text-[11px] text-dim">{comCupom ? 'pagamento_pendente_cupom' : 'pagamento_pendente'}</code>
              </p>
              {statusDoModelo === 'ausente' && (
                <Botao variante="primario" className="mt-3 w-full" onClick={aoCriar} disabled={criando}>
                  {criando ? 'Enviando para a Meta…' : 'Criar o modelo'}
                </Botao>
              )}
              {recado && <p className="mt-2 text-[12px] leading-5 text-ok">{recado}</p>}
            </div>

            {erro && <p className="-mt-2 text-[12.5px] leading-5 text-perigo">{erro}</p>}
          </div>
        </div>

        <div className="border-t border-line bg-surface px-5 py-3">
          <p className="text-[12px] leading-5 text-dim">
            {comCupom
              ? 'Com cupom a Meta cobra como marketing, cerca de R$ 0,32 por mensagem. Quem respondeu SAIR não recebe.'
              : 'Sem cupom a Meta cobra como utilidade, cerca de R$ 0,04 por mensagem.'}
          </p>
        </div>
      </div>
    </section>
  )
}

/** A mensagem como chega no WhatsApp, com o texto exato dos modelos. */
function Previa({ cupom, desconto }: { cupom: string | null; desconto: string | null }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-[#efeae2] p-3 dark:bg-[#0b141a]">
      <div className="max-w-[340px] overflow-hidden rounded-lg rounded-tl-none bg-white text-[13px] leading-[1.45] text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/exemplos/carrinho-produto.jpg" alt="" className="aspect-[1.91] w-full object-cover" />
        <div className="px-3 py-2">
          {cupom ? (
            <>
              Fala, Maria! 🎮
              <br />
              <br />
              O pedido de <strong>Monitor Gamer 27&quot;</strong> ficou esperando o pagamento. Ainda dá tempo de completar o
              setup! 🕹️
              <br />
              <br />
              Liberamos <strong>{desconto || 'o desconto'}</strong> pra você: refaça o pedido no site e aplique o cupom{' '}
              <strong>{cupom}</strong> no carrinho.
              <br />
              <br />
              Ficou alguma dúvida? Chama aqui que a gente responde. 💬
              <span className="mt-1.5 block text-[11.5px] text-[#667781] dark:text-[#8696a0]">
                Para não receber promoções, responda SAIR.
              </span>
            </>
          ) : (
            <>
              Oi, Maria! O pagamento do seu pedido de <strong>Monitor Gamer 27&quot;</strong> ainda não foi confirmado.
              <br />
              <br />
              Se quiser concluir, é só finalizar pelo site. Ficou alguma dúvida? Responda esta mensagem.
            </>
          )}
        </div>
        {cupom && (
          <p className="border-t border-black/10 py-2 text-center text-[12.5px] font-medium text-[#027eb5] dark:border-white/10 dark:text-[#53bdeb]">
            Copiar código
          </p>
        )}
        <p className="border-t border-black/10 py-2 text-center text-[12.5px] font-medium text-[#027eb5] dark:border-white/10 dark:text-[#53bdeb]">
          Ver produto
        </p>
      </div>
    </div>
  )
}
