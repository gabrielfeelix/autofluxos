'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { useConfirmar } from '@/components/design/confirmar'
import { CampoParaCopiar } from '@/components/design/copiar'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { acaoAvisarClienteDoCardapioWeb, acaoConectarCardapioWeb, acaoDesligarCardapioWeb } from '@/server/acoes-cardapios'

type Conectado = {
  loja: string
  avisarCliente: boolean
  ultimaLeitura: string | null
  webhook: { url: string; token: string }
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

/**
 * A conexão do Cardápio Web: a chave de API do lojista e, depois de ligada,
 * o webhook para colar no Portal. Sem o webhook os pedidos chegam pela
 * passada de 10 minutos; com ele, na hora.
 */
export function ConectarCardapioWeb({ clienteId, conectado }: { clienteId: string; conectado: Conectado | null }) {
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
      const r = await acaoConectarCardapioWeb(clienteId, chave, avisar)
      if (!r.ok) return setErro(r.erro)
      setChave('')
      setTrocando(false)
      router.refresh()
    })
  }

  function mudarAviso(ligado: boolean) {
    setAvisar(ligado)
    comecar(async () => {
      const r = await acaoAvisarClienteDoCardapioWeb(clienteId, ligado)
      if (!r.ok) {
        setAvisar(!ligado)
        setErro(r.erro)
      }
    })
  }

  const desligar = () =>
    confirmar({
      titulo: 'Desligar o Cardápio Web?',
      descricao: 'A chave de API é apagada e novos pedidos deixam de entrar. Os pedidos que já estão no quadro continuam lá.',
      rotulo: 'Desligar',
      tom: 'perigo',
      aoConfirmar: async () => {
        const r = await acaoDesligarCardapioWeb(clienteId)
        if (!r.ok) return { ok: false as const, erro: r.erro }
        router.refresh()
        return { ok: true as const }
      },
    })

  const formulario = (
    <form onSubmit={conectar} className="flex flex-col gap-4">
      <div>
        <label htmlFor="chave-cardapio-web" className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
          Chave de API
        </label>
        <input
          id="chave-cardapio-web"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Exemplo: 7nSyGq49NVXuyZfgEQNPg3TdUqLNXTMN"
          className="app-field px-[13px] py-[11px] font-mono text-[13px]"
        />
        <p className="mt-1.5 text-[12px] leading-5 text-dim">
          No Portal do Cardápio Web: Configurações &gt; Integrações &gt; API &gt; Gerar token.
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
          { rotulo: 'Cardápio Web' },
        ]}
        titulo="Cardápio Web"
        descricao="Cada pedido do seu Cardápio Web entra no quadro de Pedidos, e o cliente recebe no WhatsApp cada etapa."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="app-card flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marcas-de-cardapio/cardapio_web.png" alt="" className="size-full object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-bold tracking-[-0.01em]">{conectado ? 'Conectado' : 'Conectar a loja'}</h2>
                  {conectado && <Pilula tom="ok">Ativo</Pilula>}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
                  {conectado
                    ? `Loja ${conectado.loja} no Cardápio Web.${conectado.ultimaLeitura ? ` Última leitura às ${HORA.format(new Date(conectado.ultimaLeitura))}.` : ''}`
                    : 'Cole a chave de API do seu Portal. Ela é conferida na hora e guardada criptografada.'}
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

          {conectado && (
            <section className="app-card flex flex-col gap-4 p-5">
              <div>
                <h2 className="text-[14.5px] font-bold">Receber os pedidos na hora</h2>
                <p className="mt-1 text-[12.5px] leading-5 text-muted">
                  Sem este passo, os pedidos entram a cada 10 minutos. Com ele, no mesmo instante. No Portal do
                  Cardápio Web, em Configurações &gt; Integrações &gt; API, cadastre o webhook com estes dois valores:
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">URL do webhook</p>
                <CampoParaCopiar valor={conectado.webhook.url} rotuloAcessivel="URL do webhook" />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">Token</p>
                <CampoParaCopiar valor={conectado.webhook.token} rotuloAcessivel="Token do webhook" />
              </div>
            </section>
          )}
        </div>

        <aside className="app-card p-5 lg:sticky lg:top-6">
          <h2 className="text-[14.5px] font-bold">Como funciona</h2>
          <ol className="mt-4 flex flex-col gap-3.5 text-[12.5px] leading-5 text-muted">
            <li>
              <span className="font-bold text-ink">1. Pedido feito no cardápio</span>
              <br />
              Entra no quadro de Pedidos com o número do Cardápio Web.
            </li>
            <li>
              <span className="font-bold text-ink">2. A loja muda a etapa no Cardápio Web</span>
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
            Pedidos de iFood e outros marketplaces repassados ao Cardápio Web entram no quadro, mas sem aviso: o
            telefone do cliente não vem.
          </p>
        </aside>
      </div>
      {dialogo}
    </Miolo>
  )
}
