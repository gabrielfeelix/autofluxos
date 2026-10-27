'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { useConfirmar } from '@/components/design/confirmar'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { acaoAvisarClienteDaOlaClick, acaoConectarOlaClick, acaoDesligarOlaClick } from '@/server/acoes-cardapios'

type Conectado = {
  /** O webhook registrado lá: pedido na hora. Sem ele, a cada 10 minutos. */
  naHora: boolean
  avisarCliente: boolean
  ultimaLeitura: string | null
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

const PERMISSOES = ['orders:read', 'webhooks:read', 'webhooks:write', 'companies:read']

/**
 * A conexão da OlaClick: só a chave de API do lojista. O webhook é registrado
 * pela API ao conectar; se a chave não tiver permissão de webhook, os pedidos
 * entram pela passada de 10 minutos, e a tela diz como passar para o na hora.
 */
export function ConectarOlaClick({ clienteId, conectado }: { clienteId: string; conectado: Conectado | null }) {
  const router = useRouter()
  const [chave, setChave] = useState('')
  const [avisar, setAvisar] = useState(conectado?.avisarCliente ?? true)
  const [trocando, setTrocando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()
  const { confirmar, dialogo } = useConfirmar()

  function conectar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    comecar(async () => {
      const r = await acaoConectarOlaClick(clienteId, chave, avisar)
      if (!r.ok) return setErro(r.erro)
      setChave('')
      setTrocando(false)
      router.refresh()
    })
  }

  function mudarAviso(ligado: boolean) {
    setAvisar(ligado)
    comecar(async () => {
      const r = await acaoAvisarClienteDaOlaClick(clienteId, ligado)
      if (!r.ok) {
        setAvisar(!ligado)
        setErro(r.erro)
      }
    })
  }

  const desligar = () =>
    confirmar({
      titulo: 'Desligar a OlaClick?',
      descricao: 'A chave de API é apagada, o webhook é removido da OlaClick e novos pedidos deixam de entrar. Os pedidos que já estão no quadro continuam lá.',
      rotulo: 'Desligar',
      tom: 'perigo',
      aoConfirmar: async () => {
        const r = await acaoDesligarOlaClick(clienteId)
        if (!r.ok) return { ok: false as const, erro: r.erro }
        router.refresh()
        return { ok: true as const }
      },
    })

  const formulario = (
    <form onSubmit={conectar} className="flex flex-col gap-4">
      <div>
        <label htmlFor="chave-olaclick" className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
          Chave de API
        </label>
        <input
          id="chave-olaclick"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Exemplo: olk_live_4f9a2c7e1b3d5f8a0c2e4b6d"
          className="app-field px-[13px] py-[11px] font-mono text-[13px]"
        />
        <p className="mt-1.5 text-[12px] leading-5 text-dim">
          No painel da OlaClick: Integrações &gt; API Keys. Marque as permissões {PERMISSOES.join(', ')}.
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
        <button type="submit" disabled={enviando || !chave.trim()} className="botao-md botao-primario disabled:opacity-60">
          {enviando ? 'Conferindo a chave…' : conectado ? 'Salvar a chave nova' : 'Conectar'}
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
          { rotulo: 'OlaClick' },
        ]}
        titulo="OlaClick"
        descricao="Cada pedido da sua OlaClick entra no quadro de Pedidos, e o cliente recebe no WhatsApp cada etapa."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="app-card flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marcas-de-cardapio/olaclick.svg" alt="" className="size-full object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-bold tracking-[-0.01em]">{conectado ? 'Conectado' : 'Conectar a loja'}</h2>
                  {conectado && <Pilula tom="ok">Ativo</Pilula>}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
                  {conectado
                    ? `${conectado.naHora ? 'Pedidos entram no mesmo instante.' : 'Pedidos entram a cada 10 minutos.'}${conectado.ultimaLeitura ? ` Última conferência às ${HORA.format(new Date(conectado.ultimaLeitura))}.` : ''}`
                    : 'Cole a chave de API do painel da OlaClick. Ela é conferida na hora e guardada criptografada.'}
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
                    Trocar a chave
                  </button>
                  <button type="button" onClick={desligar} className="botao-md botao-secundario text-perigo">
                    Desligar
                  </button>
                </div>
              </>
            )}
          </section>

          {conectado && !conectado.naHora && (
            <section className="app-card flex flex-col gap-2 p-5">
              <h2 className="text-[14.5px] font-bold">Receber os pedidos na hora</h2>
              <p className="text-[12.5px] leading-5 text-muted">
                A chave atual não tem permissão de webhook. No painel da OlaClick, crie uma chave nova com as permissões
                webhooks:read e webhooks:write marcadas e use Trocar a chave. O AutoFluxos cadastra o webhook sozinho.
              </p>
            </section>
          )}
        </div>

        <aside className="app-card p-5 lg:sticky lg:top-6">
          <h2 className="text-[14.5px] font-bold">Como funciona</h2>
          <ol className="mt-4 flex flex-col gap-3.5 text-[12.5px] leading-5 text-muted">
            <li>
              <span className="font-bold text-ink">1. Pedido feito na OlaClick</span>
              <br />
              Entra no quadro de Pedidos com o número do dia da OlaClick.
            </li>
            <li>
              <span className="font-bold text-ink">2. A loja muda a etapa na OlaClick</span>
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
            Pedidos de mesa ficam de fora. A chave de API da OlaClick está disponível nos planos pagos.
          </p>
        </aside>
      </div>
      {dialogo}
    </Miolo>
  )
}
