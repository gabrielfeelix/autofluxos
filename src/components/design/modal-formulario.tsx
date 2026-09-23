'use client'

import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import {
  camposDoFormulario,
  houveRascunho,
  PERGUNTA_DESCARTAR,
  type ValorDeCampo,
} from './rascunho-do-modal'

/**
 * O modal com formulário e Server Action, o irmão do `Modal` controlado.
 *
 * ---------------------------------------------------------------------------
 * O que a T7.4 consertou aqui, e por quê
 * ---------------------------------------------------------------------------
 *
 * Três defeitos medidos, e os três eram silenciosos:
 *
 * 1. **duplo clique enviava duas vezes.** `enviar()` é `async` e não havia
 *    estado de pendência: o botão seguia clicável durante a ida ao servidor, e
 *    dois cliques rápidos criavam duas etiquetas, dois produtos, dois anúncios.
 *    `FormularioSalvar` já resolvia isso com `useActionState`, e aqui não dava
 *    para usar o mesmo porque a ação deste modal recebe só o `FormData`;
 * 2. **fechar descartava o digitado sem perguntar.** `Esc`, o clique no fundo e
 *    o "Cancelar" chamavam `close()` direto. Ver `rascunho-do-modal.ts`;
 * 3. **`w-[420px]` fixo vazava em tela estreita.** O `Modal` já usava
 *    `min(…, 92vw)`, e este aqui não: num celular de 360px o modal saía pela
 *    borda e o botão de confirmar ficava fora de alcance.
 *
 * O que **não** mudou é tão importante quanto: nenhuma prop nova, nenhum
 * `<dialog>` trocado por `div`, nenhuma cor nem espaçamento. O plano pede
 * "preservar identidade visual; não fazer redesign gratuito", e os 22 usos
 * espalhados pelo produto não foram tocados.
 */
export function ModalFormulario({
  botao,
  titulo,
  descricao,
  action,
  children,
  rotuloEnviar = 'Criar e abrir',
  variante = 'primario',
}: {
  botao: ReactNode
  titulo: string
  descricao: string
  /**
   * Pode devolver `{ ok: false, erro }` para o modal mostrar a mensagem em vez
   * de fechar. Sem isso, erro de preenchimento vira o digest opaco do Next e a
   * pessoa perde o que digitou.
   *
   * `ok` é opcional porque este é o `EstadoSalvar` da casa, o mesmo que
   * `FormularioSalvar` usa: é o que permite a **mesma ação** servir aos dois
   * sem adaptador. Ação que devolve `undefined` (as que redirecionam) fecha o
   * modal, que é o desfecho certo.
   */
  action: (formData: FormData) => void | Promise<void | { ok?: boolean; erro?: string }>
  children: ReactNode
  /** O texto do botão que confirma. Nem todo modal cria e abre alguma coisa. */
  rotuloEnviar?: string
  /**
   * `secundario` para quando o modal não é a ação principal da tela; `linha`
   * para a ação de uma linha de lista, no tamanho do `BotaoPerigo` ao lado.
   */
  variante?: 'primario' | 'secundario' | 'linha'
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const formulario = useRef<HTMLFormElement>(null)
  /**
   * Como o formulário estava quando o modal abriu.
   *
   * Em `ref` e não em estado: ler isto não redesenha nada, e guardar em estado
   * faria o modal re-renderizar a cada abertura sem necessidade nenhuma.
   */
  const inicial = useRef<Map<string, ValorDeCampo>>(new Map())
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  /**
   * A mesma verdade que `pendente`, lida de forma síncrona.
   *
   * `setPendente(true)` só chega ao próximo render, e dois cliques no mesmo
   * quadro leriam `pendente === false` os dois. O `ref` muda na hora, e é ele
   * que de fato barra o segundo envio.
   */
  const pendenteAgora = useRef(false)

  /**
   * O envio, com a trava contra o segundo clique.
   *
   * A trava é a guarda `if (pendenteAgora.current)` e **não** só o `disabled` do
   * botão: `Enter` num campo de texto envia o formulário sem passar pelo botão,
   * e um `disabled` sozinho não pega esse caminho.
   */
  async function enviar(dados: FormData) {
    if (pendenteAgora.current) return
    pendenteAgora.current = true
    setPendente(true)
    setErro(null)
    try {
      const r = await action(dados)
      if (r && !r.ok) {
        setErro(r.erro ?? 'não deu certo')
        return
      }
      // Deu certo: o que está na tela virou registro, então fechar não perde
      // mais nada e a pergunta de descarte não deve aparecer.
      inicial.current = camposAgora()
      dialogo.current?.close()
    } finally {
      pendenteAgora.current = false
      setPendente(false)
    }
  }

  /** Os campos como estão agora. Mapa vazio antes de o `<dialog>` desenhar. */
  function camposAgora(): Map<string, ValorDeCampo> {
    return formulario.current ? camposDoFormulario(formulario.current) : new Map()
  }

  function abrir() {
    setErro(null)
    dialogo.current?.showModal()
    // Depois do `showModal()`: antes dele o `<dialog>` fechado não desenha os
    // campos, e o `FormData` viria vazio, o que faria todo campo pré preenchido
    // parecer digitação.
    inicial.current = camposAgora()
  }

  /**
   * Fechar, perguntando primeiro se houver o que perder.
   *
   * Enquanto o envio está em curso o modal **não** fecha: fechar ali deixaria a
   * pessoa sem saber se gravou, que é o estado que o `FormularioSalvar` existe
   * para evitar.
   */
  function tentarFechar() {
    if (pendenteAgora.current) return
    if (houveRascunho(camposAgora(), inicial.current) && !confirm(PERGUNTA_DESCARTAR)) {
      return
    }
    setErro(null)
    dialogo.current?.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={
          variante === 'primario'
            ? 'app-primary-button px-[18px] py-2.5 text-[13px]'
            : variante === 'linha'
              ? 'rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-surface-strong hover:text-ink'
              : 'app-secondary-button px-3 py-1.5 text-[11.5px]'
        }
      >
        {botao}
      </button>
      <dialog
        ref={dialogo}
        aria-label={titulo}
        // `Esc` fecha o `<dialog>` por conta do navegador, sem passar por clique
        // nenhum: `onCancel` é o único lugar onde dá para perguntar antes.
        onCancel={(evento) => {
          evento.preventDefault()
          tentarFechar()
        }}
        onClick={(evento) => {
          if (evento.target === dialogo.current) tentarFechar()
        }}
        className="app-dialog m-auto w-[min(420px,92vw)] rounded-[18px] border border-line bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
      >
        <h2 className="text-[17px] font-bold">{titulo}</h2>
        <p className="mt-1 mb-5 text-[12.5px] leading-6 text-muted">{descricao}</p>
        <form ref={formulario} action={enviar} className="space-y-3.5">
          {children}
          {erro && (
            <p
              role="alert"
              className="rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-perigo"
            >
              {erro}
            </p>
          )}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={tentarFechar}
              disabled={pendente}
              className="app-secondary-button flex-1 px-4 py-2.5 text-[13px] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendente}
              className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:opacity-60"
            >
              {pendente ? 'Enviando…' : rotuloEnviar}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}

export function RotuloCampo({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
      {children}
    </span>
  )
}
