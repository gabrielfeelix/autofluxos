'use client'

import { useEffect, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { IconeSacola } from '@/components/lead/icones-da-barra'
import { linhasDoCard, type ProdutoDaLoja } from '@/core/loja'
import { acaoBuscarProdutosDoInbox, acaoEnviarProdutoDoInbox } from '@/server/acoes-produtos-do-inbox'

/**
 * O botão de produtos da caixa de resposta: busca por nome ou SKU e manda o
 * card do item tocado, o mesmo card que o bot manda.
 *
 * A busca é a do bot (Magento ao vivo, ou o catálogo da conta), e tocar envia
 * direto, sem segundo clique: o card é o que se vê na lista, e confirmar de
 * novo seria atrito num gesto que se repete o dia inteiro.
 *
 * Abre para cima e fecha com clique fora e `Esc`, como o seletor de emoji.
 */
export function SeletorDeProduto({
  clienteId,
  contatoId,
  desabilitado = false,
}: {
  clienteId: string
  contatoId: string
  desabilitado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [produtos, setProdutos] = useState<ProdutoDaLoja[]>([])
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const ultimaBusca = useRef(0)

  useEffect(() => {
    if (!aberto) return
    function foraDaqui(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    function noEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', noEsc)
    }
  }, [aberto])

  async function buscar(texto: string) {
    const numero = ++ultimaBusca.current
    if (texto.trim() === '') {
      setProdutos([])
      setErro(null)
      return
    }
    setBuscando(true)
    try {
      const r = await acaoBuscarProdutosDoInbox(clienteId, texto)
      // Resposta velha chegando depois da nova não pode trocar a lista.
      if (numero !== ultimaBusca.current) return
      if (r.ok) {
        setProdutos(r.produtos)
        setErro(null)
      } else {
        setProdutos([])
        setErro(r.erro)
      }
    } catch {
      if (numero === ultimaBusca.current) setErro('não deu para buscar agora, tente de novo')
    } finally {
      if (numero === ultimaBusca.current) setBuscando(false)
    }
  }

  // Espera a pessoa parar de digitar: a Magento é consulta de rede.
  useEffect(() => {
    if (!aberto) return
    const t = setTimeout(() => void buscar(termo), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, aberto])

  async function enviar(produto: ProdutoDaLoja) {
    setEnviando(produto.produtoId)
    setErro(null)
    try {
      const r = await acaoEnviarProdutoDoInbox(clienteId, contatoId, produto.produtoId)
      if (r.ok) {
        setAberto(false)
        setTermo('')
        setProdutos([])
      } else setErro(r.erro ?? 'não deu para enviar')
    } catch {
      setErro('não deu para enviar agora, tente de novo')
    } finally {
      setEnviando(null)
    }
  }

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Mandar produto" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => setAberto((a) => !a)}
          aria-label="Mandar produto do catálogo"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeSacola />
        </button>
      </Dica>

      {aberto && (
        <div
          role="dialog"
          aria-label="Produtos"
          className="absolute bottom-full left-0 z-30 mb-2 w-[340px] max-w-[88vw] rounded-[12px] border border-line bg-panel p-2 shadow-[0_10px_30px_rgba(19,25,34,0.11)]"
        >
          <input
            type="search"
            value={termo}
            autoFocus
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(evento) => {
              // Enter aqui busca já; não pode enviar a resposta do formulário.
              if (evento.key !== 'Enter') return
              evento.preventDefault()
              void buscar(termo)
            }}
            placeholder="Buscar por nome ou SKU"
            className="mb-2 w-full rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-dim focus:border-primary/40"
          />

          {erro && <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-perigo">{erro}</p>}

          {termo.trim() === '' && !erro && (
            <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">
              Digite o nome ou o SKU. Tocar num item manda o card na conversa.
            </p>
          )}

          {termo.trim() !== '' && !buscando && !erro && produtos.length === 0 && (
            <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">Nada com esse nome ou SKU.</p>
          )}

          {produtos.length > 0 && (
            <ul className="max-h-[300px] overflow-y-auto">
              {produtos.map((p) => {
                const { detalhe } = linhasDoCard(p)
                return (
                  <li key={p.produtoId}>
                    <button
                      type="button"
                      disabled={enviando !== null}
                      onClick={() => void enviar(p)}
                      className="flex w-full items-center gap-2.5 rounded-[9px] px-1.5 py-1.5 text-left transition hover:bg-surface-strong disabled:opacity-60"
                    >
                      {p.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto} alt="" className="size-10 shrink-0 rounded-[8px] border border-line object-cover" />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-line text-dim">
                          <IconeSacola />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold">{p.nome}</span>
                        <span className="block truncate text-[11.5px] text-dim">
                          {enviando === p.produtoId ? 'Enviando…' : detalhe || 'sem preço'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
