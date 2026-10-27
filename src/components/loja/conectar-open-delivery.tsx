'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { useConfirmar } from '@/components/design/confirmar'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { acaoAvisarClienteDoOpenDelivery, acaoConectarOpenDelivery, acaoDesligarOpenDelivery } from '@/server/acoes-cardapios'

type Conectado = {
  /** O host da API, só para mostrar de onde vem. */
  origem: string
  avisarCliente: boolean
  ultimaLeitura: string | null
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

const ROTULO = 'mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase'

/**
 * Open Delivery de qualquer cardápio que fale o padrão: a URL da API, o
 * Client Id e o Client Secret que o sistema de origem entrega. Os pedidos
 * entram pela passada de 10 minutos, pela fila de eventos.
 */
export function ConectarOpenDelivery({ clienteId, conectado }: { clienteId: string; conectado: Conectado | null }) {
  const router = useRouter()
  const [base, setBase] = useState('')
  const [clientId, setClientId] = useState('')
  const [segredo, setSegredo] = useState('')
  const [avisar, setAvisar] = useState(conectado?.avisarCliente ?? true)
  const [trocando, setTrocando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()
  const { confirmar, dialogo } = useConfirmar()

  function conectar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    comecar(async () => {
      const r = await acaoConectarOpenDelivery(clienteId, { base, clientId, clientSecret: segredo }, avisar)
      if (!r.ok) return setErro(r.erro)
      setBase('')
      setClientId('')
      setSegredo('')
      setTrocando(false)
      router.refresh()
    })
  }

  function mudarAviso(ligado: boolean) {
    setAvisar(ligado)
    comecar(async () => {
      const r = await acaoAvisarClienteDoOpenDelivery(clienteId, ligado)
      if (!r.ok) {
        setAvisar(!ligado)
        setErro(r.erro)
      }
    })
  }

  const desligar = () =>
    confirmar({
      titulo: 'Desligar o Open Delivery?',
      descricao:
        'O Client Secret é apagado e novos pedidos deixam de entrar. Os pedidos que já estão no quadro continuam lá. No sistema de origem, apague também a integração.',
      rotulo: 'Desligar',
      tom: 'perigo',
      aoConfirmar: async () => {
        const r = await acaoDesligarOpenDelivery(clienteId)
        if (!r.ok) return { ok: false as const, erro: r.erro }
        router.refresh()
        return { ok: true as const }
      },
    })

  const formulario = (
    <form onSubmit={conectar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
        <div className="sm:col-span-2">
          <label htmlFor="od-base" className={ROTULO}>
            URL da API
          </label>
          <input
            id="od-base"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Exemplo: https://api.seucardapio.com.br/opendelivery"
            className="app-field px-[13px] py-[11px] font-mono text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="od-client-id" className={ROTULO}>
            Client Id
          </label>
          <input
            id="od-client-id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Exemplo: 8f2c1a"
            className="app-field px-[13px] py-[11px] font-mono text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="od-client-secret" className={ROTULO}>
            Client Secret
          </label>
          <input
            id="od-client-secret"
            value={segredo}
            onChange={(e) => setSegredo(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Exemplo: 9f8e7d6c5b4a39281706f5e4d3c2b1a0"
            className="app-field px-[13px] py-[11px] font-mono text-[13px]"
          />
        </div>
        <p className="text-[12px] leading-5 text-dim sm:col-span-2">
          No painel do seu cardápio, procure a integração Open Delivery: ela mostra a URL da API, o Client Id e o
          Client Secret. Usa Goomer? Ela tem conexão própria nesta tela.
        </p>
      </div>
      {!conectado && (
        <LinhaLigaDesliga
          titulo="Avisar o cliente de cada etapa"
          descricao="Em preparo, saiu para entrega, pronto para retirada e cancelado chegam no WhatsApp de quem pediu."
          marcada={avisar}
          aoMudar={setAvisar}
        />
      )}
      {erro && (
        <p role="alert" className="text-[12.5px] leading-5 text-perigo">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enviando || !base.trim() || !clientId.trim() || !segredo.trim()}
          className="botao-md botao-primario disabled:opacity-60"
        >
          {enviando ? 'Conferindo as chaves…' : conectado ? 'Salvar as chaves novas' : 'Conectar'}
        </button>
        {conectado && (
          <button type="button" onClick={() => setTrocando(false)} className="botao-md botao-secundario">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )

  return (
    <Miolo largura="cheia">
      <CabecalhoDaTela
        trilha={[
          { rotulo: 'Integrações', href: `/clientes/${clienteId}/loja` },
          { rotulo: 'Cardápio e delivery', href: `/clientes/${clienteId}/loja/cardapios` },
          { rotulo: 'Open Delivery' },
        ]}
        titulo="Open Delivery"
        descricao="Para cardápios que seguem o padrão Open Delivery da Abrasel: cada pedido entra no quadro de Pedidos, e o cliente recebe no WhatsApp cada etapa."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="app-card flex min-w-0 flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marcas-de-cardapio/opendelivery.webp" alt="" className="size-full object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-bold tracking-[-0.01em]">{conectado ? 'Conectado' : 'Conectar a loja'}</h2>
                {conectado && <Pilula tom="ok">Ativo</Pilula>}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
                {conectado
                  ? `Pedidos de ${conectado.origem}, a cada 10 minutos.${conectado.ultimaLeitura ? ` Última conferência às ${HORA.format(new Date(conectado.ultimaLeitura))}.` : ''}`
                  : 'Cole os três dados do seu cardápio. Eles são conferidos na hora e guardados criptografados.'}
              </p>
            </div>
          </div>

          {(!conectado || trocando) && formulario}

          {conectado && !trocando && (
            <>
              <LinhaLigaDesliga
                titulo="Avisar o cliente de cada etapa"
                descricao="Em preparo, saiu para entrega, pronto para retirada e cancelado chegam no WhatsApp de quem pediu."
                marcada={avisar}
                aoMudar={mudarAviso}
              />
              {erro && (
                <p role="alert" className="text-[12.5px] leading-5 text-perigo">
                  {erro}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setTrocando(true)} className="botao-md botao-secundario">
                  Trocar as chaves
                </button>
                <button type="button" onClick={desligar} className="botao-md botao-secundario text-perigo">
                  Desligar
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="app-card p-5 lg:sticky lg:top-6">
          <h2 className="text-[14.5px] font-bold">Como funciona</h2>
          <ol className="mt-4 flex flex-col gap-3.5 text-[12.5px] leading-5 text-muted">
            <li>
              <span className="font-bold text-ink">1. Pedido feito no cardápio</span>
              <br />
              Entra no quadro de Pedidos com o número de lá, em até 10 minutos.
            </li>
            <li>
              <span className="font-bold text-ink">2. A loja muda a etapa no cardápio</span>
              <br />
              O quadro acompanha sozinho: em preparo, saiu, entregue.
            </li>
            <li>
              <span className="font-bold text-ink">3. O cliente é avisado no WhatsApp</span>
              <br />
              Pelo número da sua loja, mesmo sem conversa aberta, com os modelos de aviso aprovados.
            </li>
          </ol>
          <p className="mt-4 border-t border-line-soft pt-3 text-[12px] leading-5 text-dim">
            Pedidos de mesa ficam de fora. O AutoFluxos só lê os pedidos: não aceita, não recusa e não muda a etapa
            no seu sistema.
          </p>
        </aside>
      </div>
      {dialogo}
    </Miolo>
  )
}
