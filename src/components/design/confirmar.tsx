'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Modal } from './modal'

/**
 * A confirmação de uma ação, no modal do produto.
 *
 * ---------------------------------------------------------------------------
 * Por que trocar o `confirm()`
 * ---------------------------------------------------------------------------
 *
 * O `confirm()` é uma janela do **sistema operacional**: fonte do sistema,
 * botões do sistema, ancorada no alto do navegador, com o nome do domínio em
 * cima. No meio de uma tela com a nossa tipografia e o nosso azul, ela parece o
 * aviso de um site invadido, não uma pergunta do produto, a mesma razão pela
 * qual o `<select>` nativo saiu da ficha e o `title` virou `Dica`.
 *
 * Pior: ela **trava a aba inteira** enquanto está aberta, e não dá para
 * escrever nada nela. Um `confirm()` só sabe perguntar sim ou não; qualquer
 * pergunta que precise de um motivo, de um nome digitado ou de um aviso mais
 * longo já não cabia nele e virava outro componente, o que é justamente por que
 * este produto tinha três desenhos diferentes para "tem certeza?".
 *
 * ---------------------------------------------------------------------------
 * O que ele garante
 * ---------------------------------------------------------------------------
 *
 * **A ação é o foco inicial? Não.** O foco nasce em "Cancelar", de propósito:
 * quem chega aqui por engano aperta Enter e não apaga nada. Quem quer mesmo
 * apagar dá um Tab, que é barato, ou clica.
 *
 * **Escape e clique fora cancelam**, nunca confirmam. `Modal` já cuida disso, e
 * o `dialog` nativo prende o foco enquanto está aberto.
 *
 * **O erro fica no modal.** Se a ação falhar, a mensagem aparece aqui e o modal
 * continua aberto: fechar e deixar a pessoa sem saber se apagou ou não é o pior
 * desfecho possível numa ação sem desfazer.
 */
export function useConfirmar() {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null)
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const confirmar = useCallback((novo: PedidoDeConfirmacao) => {
    setErro(null)
    setPedido(novo)
  }, [])

  const fechar = useCallback(() => {
    if (rodando) return
    setPedido(null)
    setErro(null)
  }, [rodando])

  const dialogo = pedido ? (
    <Modal aberto aoFechar={fechar} titulo={pedido.titulo} descricao={pedido.descricao}>
      <ConteudoDaConfirmacao
        pedido={pedido}
        rodando={rodando}
        erro={erro}
        aoCancelar={fechar}
        aoConfirmar={async () => {
          setErro(null)
          setRodando(true)
          try {
            const r = await pedido.aoConfirmar()
            if (r && r.ok === false) {
              setErro(r.erro ?? 'não deu para concluir')
              return
            }
            setPedido(null)
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'não deu para concluir')
          } finally {
            setRodando(false)
          }
        }}
      />
    </Modal>
  ) : null

  return { confirmar, dialogo, rodando }
}

export type PedidoDeConfirmacao = {
  titulo: string
  /** A linha embaixo do título. O que some junto, o que não dá para desfazer. */
  descricao?: string
  /** O texto do botão que age. Diga o verbo: "Apagar contato", não "OK". */
  rotulo: string
  /** `perigo` pinta o botão de vermelho. É o padrão de quem apaga. */
  tom?: 'perigo' | 'normal'
  /**
   * Quando presente, a pessoa precisa digitar exatamente este texto para
   * liberar o botão. Para o que apaga muita coisa de uma vez: um clique
   * distraído não devolve nada, e copiar um nome exige ler o que está escrito.
   */
  digitar?: string
  aoConfirmar: () => Promise<{ ok: boolean; erro?: string } | void>
}

function ConteudoDaConfirmacao({
  pedido,
  rodando,
  erro,
  aoCancelar,
  aoConfirmar,
}: {
  pedido: PedidoDeConfirmacao
  rodando: boolean
  erro: string | null
  aoCancelar: () => void
  aoConfirmar: () => void
}) {
  const [digitado, setDigitado] = useState('')
  const cancelar = useRef<HTMLButtonElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  /*
   * **O foco é posto à mão, e num quadro depois.**
   *
   * `showModal()` decide o foco inicial ao abrir e escolhe o primeiro elemento
   * focável do diálogo, que é o × de fechar no canto. Focar durante a montagem
   * não adianta: o `showModal()` vem depois e leva o foco de volta. O
   * `requestAnimationFrame` põe esta escolha atrás da dele.
   *
   * Mirar o Cancelar é deliberado: quem chegou aqui por engano aperta Enter e
   * fecha, em vez de apagar. Quando há texto a digitar, o campo vem antes,
   * porque sem ele não há como confirmar de todo modo.
   */
  useEffect(() => {
    const quadro = requestAnimationFrame(() => {
      const alvo = pedido.digitar ? campo.current : cancelar.current
      alvo?.focus()
    })
    return () => cancelAnimationFrame(quadro)
  }, [pedido.digitar])

  const liberado = pedido.digitar ? digitado.trim() === pedido.digitar : true
  const perigo = (pedido.tom ?? 'perigo') === 'perigo'

  return (
    <div className="flex flex-col gap-4">
      {pedido.digitar && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted">
            Digite <strong className="text-ink">{pedido.digitar}</strong> para confirmar
          </span>
          <input
            ref={campo}
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            className="app-field px-3 py-2.5 text-[13px]"
          />
        </label>
      )}

      {erro && (
        <p role="alert" className="text-[12px] font-semibold text-perigo">
          {erro}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {/*
          Cancelar primeiro na ordem do foco, e é ele que recebe o `autoFocus`
          quando não há campo para digitar: Enter por reflexo fecha, não apaga.
          O foco em si é posto pelo efeito acima.
        */}
        <button
          ref={cancelar}
          type="button"
          onClick={aoCancelar}
          disabled={rodando}
          className="rounded-[9px] border border-line px-3.5 py-2 text-[12.5px] font-semibold text-muted transition hover:bg-surface hover:text-ink disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={rodando || !liberado}
          className={
            perigo
              ? 'rounded-[9px] border border-rose-400/30 bg-rose-400/[0.12] px-3.5 py-2 text-[12.5px] font-bold text-perigo transition hover:bg-rose-400/[0.2] disabled:opacity-50'
              : 'app-primary-button px-3.5 py-2 text-[12.5px] disabled:opacity-50'
          }
        >
          {rodando ? 'Aguarde…' : pedido.rotulo}
        </button>
      </div>
    </div>
  )
}

/**
 * A versão declarativa, para quem já tem o estado de aberto/fechado.
 *
 * `useConfirmar` serve ao caso comum (um botão que pergunta antes de agir);
 * este serve a quem precisa abrir a confirmação de outro lugar.
 */
export function Confirmacao({
  aberto,
  aoFechar,
  children,
  ...pedido
}: PedidoDeConfirmacao & {
  aberto: boolean
  aoFechar: () => void
  children?: ReactNode
}) {
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!aberto) return null

  return (
    <Modal aberto aoFechar={rodando ? () => {} : aoFechar} titulo={pedido.titulo} descricao={pedido.descricao}>
      {children}
      <ConteudoDaConfirmacao
        pedido={pedido}
        rodando={rodando}
        erro={erro}
        aoCancelar={aoFechar}
        aoConfirmar={async () => {
          setErro(null)
          setRodando(true)
          try {
            const r = await pedido.aoConfirmar()
            if (r && r.ok === false) {
              setErro(r.erro ?? 'não deu para concluir')
              return
            }
            aoFechar()
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'não deu para concluir')
          } finally {
            setRodando(false)
          }
        }}
      />
    </Modal>
  )
}
