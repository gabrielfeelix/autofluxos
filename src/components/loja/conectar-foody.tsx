'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { useConfirmar } from '@/components/design/confirmar'
import { CampoParaCopiar } from '@/components/design/copiar'
import { LinhaLigaDesliga } from '@/components/design/interruptor'
import { Miolo } from '@/components/design/miolo'
import { Pilula } from '@/components/design/pilula'
import { acaoAvisarClienteDaFoody, acaoConectarFoody, acaoDesligarFoody } from '@/server/acoes-cardapios'
import { acaoCriarModelosDoPedido } from '@/server/acoes-pedidos'

type Conectado = {
  avisarCliente: boolean
  ultimaLeitura: string | null
  gatilho: { url: string; token: string }
  /** O modelo com botão "Acompanhar entrega", que leva o link do mapa fora das 24 horas. */
  modeloDeRastreio: 'faltam' | 'em_analise' | 'aprovados'
}

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

const ROTULO = 'mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase'

/**
 * A conexão da Foody Delivery: o token do lojista e, depois de ligada, o
 * gatilho para cadastrar na Foody e o modelo com o botão de rastreio. A Foody
 * é o sistema de entregas: quando a loja já despacha tudo por ela, conecta-se
 * só ela, e não o cardápio, para o pedido não entrar duas vezes.
 */
export function ConectarFoody({ clienteId, conectado }: { clienteId: string; conectado: Conectado | null }) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [avisar, setAvisar] = useState(conectado?.avisarCliente ?? true)
  const [trocando, setTrocando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modelo, setModelo] = useState(conectado?.modeloDeRastreio ?? 'faltam')
  const [enviando, comecar] = useTransition()
  const { confirmar, dialogo } = useConfirmar()

  function conectar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro(null)
    comecar(async () => {
      const r = await acaoConectarFoody(clienteId, token, avisar)
      if (!r.ok) return setErro(r.erro)
      setToken('')
      setTrocando(false)
      router.refresh()
    })
  }

  function mudarAviso(ligado: boolean) {
    setAvisar(ligado)
    comecar(async () => {
      const r = await acaoAvisarClienteDaFoody(clienteId, ligado)
      if (!r.ok) {
        setAvisar(!ligado)
        setErro(r.erro)
      }
    })
  }

  function criarModelo() {
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarModelosDoPedido(clienteId).catch(() => ({ ok: false as const, erro: 'A Meta não respondeu agora.' }))
      if (!r.ok) return setErro(r.erro)
      setModelo('em_analise')
    })
  }

  const desligar = () =>
    confirmar({
      titulo: 'Desligar a Foody?',
      descricao:
        'O token é apagado e novos pedidos deixam de entrar. Os pedidos que já estão no quadro continuam lá. Na Foody, apague também o gatilho.',
      rotulo: 'Desligar',
      tom: 'perigo',
      aoConfirmar: async () => {
        const r = await acaoDesligarFoody(clienteId)
        if (!r.ok) return { ok: false as const, erro: r.erro }
        router.refresh()
        return { ok: true as const }
      },
    })

  const formulario = (
    <form onSubmit={conectar} className="flex flex-col gap-4">
      <div>
        <label htmlFor="token-foody" className={ROTULO}>
          Token
        </label>
        <input
          id="token-foody"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Exemplo: 2b100082b90d4ad9b4fe7ed960cf652a"
          className="app-field px-[13px] py-[11px] font-mono text-[13px]"
        />
        <p className="mt-1.5 text-[12px] leading-5 text-dim">
          Na Foody: Menu &gt; Minha Conta &gt; APIs e Hooks. A API é dos planos pagos.
        </p>
      </div>
      {!conectado && (
        <LinhaLigaDesliga
          titulo="Avisar o cliente de cada etapa"
          descricao="Em preparo, saiu para entrega com o link do entregador, e cancelado chegam no WhatsApp de quem pediu."
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
        <button type="submit" disabled={enviando || !token.trim()} className="botao-md botao-primario disabled:opacity-60">
          {enviando ? 'Conferindo o token…' : conectado ? 'Salvar o token novo' : 'Conectar'}
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
          { rotulo: 'Foody Delivery' },
        ]}
        titulo="Foody Delivery"
        descricao="Cada pedido da Foody entra no quadro de Pedidos, e quando o entregador sai, o cliente recebe no WhatsApp o link para acompanhar no mapa."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="app-card flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marcas-de-cardapio/foody.png" alt="" className="size-full object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-bold tracking-[-0.01em]">{conectado ? 'Conectado' : 'Conectar a loja'}</h2>
                  {conectado && <Pilula tom="ok">Ativo</Pilula>}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
                  {conectado
                    ? `Pedidos entram na hora com o gatilho, ou a cada 10 minutos sem ele.${conectado.ultimaLeitura ? ` Última conferência às ${HORA.format(new Date(conectado.ultimaLeitura))}.` : ''}`
                    : 'Cole o token da Foody. Ele é conferido na hora e guardado criptografado.'}
                </p>
              </div>
            </div>

            {(!conectado || trocando) && formulario}

            {conectado && !trocando && (
              <>
                <LinhaLigaDesliga
                  titulo="Avisar o cliente de cada etapa"
                  descricao="Em preparo, saiu para entrega com o link do entregador, e cancelado chegam no WhatsApp de quem pediu."
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
                    Trocar o token
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
                  Na Foody, em Minha Conta &gt; Configurações Avançadas &gt; Criar Gatilho, cadastre estes dois valores e
                  deixe o gatilho ativado.
                </p>
              </div>
              <div>
                <p className={ROTULO}>URL do gatilho</p>
                <CampoParaCopiar valor={conectado.gatilho.url} rotuloAcessivel="URL do gatilho" />
              </div>
              <div>
                <p className={ROTULO}>Token de autorização</p>
                <CampoParaCopiar valor={conectado.gatilho.token} rotuloAcessivel="Token do gatilho" />
              </div>
            </section>
          )}

          {conectado && (
            <section className="app-card flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[14.5px] font-bold">Link do entregador no WhatsApp</h2>
                {modelo === 'aprovados' && <Pilula tom="ok">Aprovado</Pilula>}
                {modelo === 'em_analise' && <Pilula tom="destaque">Em análise na Meta</Pilula>}
              </div>
              <p className="text-[12.5px] leading-5 text-muted">
                Para quem nunca abriu conversa com a loja, o aviso de saída vai por modelo aprovado, com o botão
                Acompanhar entrega. Enquanto ele não é aprovado, o aviso sai sem o botão.
              </p>
              {modelo === 'faltam' && (
                <button type="button" onClick={criarModelo} disabled={enviando} className="botao-md botao-secundario self-start disabled:opacity-60">
                  {enviando ? 'Enviando à Meta…' : 'Criar o modelo de rastreio'}
                </button>
              )}
            </section>
          )}
        </div>

        <aside className="app-card p-5 lg:sticky lg:top-6">
          <h2 className="text-[14.5px] font-bold">Como funciona</h2>
          <ol className="mt-4 flex flex-col gap-3.5 text-[12.5px] leading-5 text-muted">
            <li>
              <span className="font-bold text-ink">1. Pedido chega na Foody</span>
              <br />
              Entra no quadro de Pedidos com o número da Foody.
            </li>
            <li>
              <span className="font-bold text-ink">2. O entregador sai</span>
              <br />
              O cliente recebe no WhatsApp o aviso com o link para acompanhar no mapa.
            </li>
            <li>
              <span className="font-bold text-ink">3. Entregue</span>
              <br />
              O quadro fecha o pedido sozinho.
            </li>
          </ol>
          <p className="mt-4 border-t border-line-soft pt-3 text-[12px] leading-5 text-dim">
            Se o seu cardápio (Goomer, Cardápio Web e outros) já manda os pedidos para a Foody, conecte só a Foody. Com
            os dois ligados, o mesmo pedido entra duas vezes.
          </p>
        </aside>
      </div>
      {dialogo}
    </Miolo>
  )
}
