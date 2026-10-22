'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { NOME_DO_GATEWAY, type Ambiente, type Gateway } from '@/channels/pagamento'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { IconeCobrar, IconeSacola } from '@/components/lead/icones-da-barra'
import type { ProdutoDaLoja } from '@/core/loja'
import { acaoCobrarNaConversa } from '@/server/acoes-cobrancas'
import { acaoBuscarProdutosDoInbox } from '@/server/acoes-produtos-do-inbox'

export type CobrarNaConversa =
  | {
      conectado: true
      gateway: Gateway
      ambiente: Ambiente
      /** O Asaas exige CPF ou CNPJ, e a ficha não tem: o campo já nasce aberto. */
      pedeDocumento: boolean
      /** Catálogo com item ativo ou loja ligada: o painel abre no catálogo. */
      temCatalogo: boolean
      /** Ramo com Pedidos (0146): o catálogo pergunta retirada ou entrega, e a cobrança vira pedido. */
      comPedidos?: boolean
    }
  /** Plano e permissão ok, sem conta de recebimento: o painel leva a conectar. */
  | { conectado: false }

type Escolhido = { produto: ProdutoDaLoja; quantidade: number }

const MAX_QUANTIDADE = 50

const reais = (valor: number) =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * O botão **Cobrar** da caixa de resposta (cobrança no chat).
 *
 * Duas abas. **Do catálogo** é o padrão quando a conta tem catálogo ou loja:
 * busca o produto, ajusta a quantidade, e a cobrança guarda os itens, que é
 * o que responde "o que eu vendi pelo chat". **Valor livre** fica para o que
 * não é produto: sinal, ajuste, serviço avulso.
 *
 * O total que aparece aqui é só para quem atende conferir. O servidor relê o
 * preço de cada item e soma de novo (`core/cobrar-do-catalogo.ts`); o
 * navegador manda id e quantidade, nunca o valor.
 *
 * A cobrança sai em duas mensagens, o resumo com o botão do link e o Pix
 * copia e cola sozinho, e vence em 24 horas.
 *
 * No celular o painel se prende às laterais da tela, e não ao botão: preso ao
 * botão, ele passava da borda direita e a conversa rolava de lado.
 */
export function BotaoDeCobrar({
  clienteId,
  contatoId,
  cobrar,
  desabilitado = false,
}: {
  clienteId: string
  contatoId: string
  cobrar: CobrarNaConversa
  desabilitado?: boolean
}) {
  const temCatalogo = cobrar.conectado && cobrar.temCatalogo
  const comPedidos = cobrar.conectado && cobrar.comPedidos === true
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<'catalogo' | 'livre'>(temCatalogo ? 'catalogo' : 'livre')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [documento, setDocumento] = useState('')
  const [pedeDocumento, setPedeDocumento] = useState(cobrar.conectado && cobrar.pedeDocumento)
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([])
  const [entrega, setEntrega] = useState<'retirada' | 'entrega'>('retirada')
  const [endereco, setEndereco] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const caixa = useRef<HTMLDivElement>(null)

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

  function adicionar(produto: ProdutoDaLoja) {
    setErro(null)
    setEscolhidos((atuais) => {
      const ja = atuais.find((e) => e.produto.produtoId === produto.produtoId)
      if (!ja) return [...atuais, { produto, quantidade: 1 }]
      return atuais.map((e) =>
        e === ja ? { ...e, quantidade: Math.min(MAX_QUANTIDADE, e.quantidade + 1) } : e,
      )
    })
  }

  function mudarQuantidade(produtoId: string, delta: number) {
    setEscolhidos((atuais) =>
      atuais
        .map((e) => (e.produto.produtoId === produtoId ? { ...e, quantidade: Math.min(MAX_QUANTIDADE, e.quantidade + delta) } : e))
        .filter((e) => e.quantidade > 0),
    )
  }

  async function enviar() {
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await acaoCobrarNaConversa(clienteId, contatoId, {
        ...(aba === 'catalogo'
          ? {
              itens: escolhidos.map((e) => ({ produtoId: e.produto.produtoId, quantidade: e.quantidade })),
              ...(comPedidos ? { entrega, endereco } : {}),
            }
          : { valor }),
        descricao,
        documento: pedeDocumento ? documento : undefined,
      })
      if (r.ok) {
        setAberto(false)
        setValor('')
        setDescricao('')
        setDocumento('')
        setEscolhidos([])
        setEntrega('retirada')
        setEndereco('')
        setPedeDocumento(false)
      } else {
        setErro(r.erro)
        if (r.pedeDocumento) setPedeDocumento(true)
      }
    } catch {
      setErro('Não foi possível cobrar agora. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const total = escolhidos.reduce((t, e) => t + (e.produto.preco ?? 0) * e.quantidade, 0)
  const documentoOk = !pedeDocumento || documento.trim() !== ''
  const pronto =
    documentoOk &&
    (aba === 'catalogo'
      ? escolhidos.length > 0 && (!comPedidos || entrega === 'retirada' || endereco.trim() !== '')
      : valor.trim() !== '' && descricao.trim() !== '')

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Cobrar" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => setAberto((a) => !a)}
          aria-label="Cobrar nesta conversa"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeCobrar />
        </button>
      </Dica>

      {aberto && (
        <div
          role="dialog"
          aria-label="Cobrar"
          className="fixed inset-x-3 bottom-28 z-30 max-h-[min(600px,72vh)] overflow-y-auto rounded-[12px] border border-line bg-panel p-3 shadow-[0_10px_30px_rgba(19,25,34,0.11)] sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-2 sm:w-[360px]"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[13px] font-bold">Cobrar nesta conversa</p>
            {cobrar.conectado && cobrar.ambiente === 'teste' && (
              <span className="rounded-full bg-aviso/10 px-2 py-0.5 text-[10.5px] font-semibold text-aviso">teste</span>
            )}
          </div>
          {!cobrar.conectado ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12.5px] leading-5 text-soft">
                Mande Pix copia e cola e link de cartão ou boleto por aqui. Quando o pagamento cai, a
                cobrança vira paga sozinha.
              </p>
              <p className="text-[12px] leading-5 text-dim">
                Primeiro conecte a conta onde você recebe, no Mercado Pago ou no Asaas. O dinheiro vai
                direto para ela, sem porcentagem para o AutoFluxos.
              </p>
              <Link href={`/clientes/${clienteId}/ajustes/pagamentos`} className="botao-primario botao-md w-full">
                Conectar conta de recebimento
              </Link>
            </div>
          ) : (
            /*
              `div`, e não `form`: o painel vive dentro do formulário da resposta,
              e formulário dentro de formulário quebra a hidratação. Enter aqui
              nunca envia a mensagem que está sendo escrita.
            */
            <div
              className="flex flex-col gap-2"
              onKeyDown={(evento) => {
                if (evento.key !== 'Enter') return
                evento.preventDefault()
                evento.stopPropagation()
                if (pronto && aba === 'livre') void enviar()
              }}
            >
              {temCatalogo ? (
                <div role="tablist" aria-label="Como cobrar" className="mb-0.5 grid grid-cols-2 gap-1 rounded-[9px] bg-surface-strong p-1">
                  {(
                    [
                      ['catalogo', 'Do catálogo'],
                      ['livre', 'Valor livre'],
                    ] as const
                  ).map(([id, rotulo]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={aba === id}
                      onClick={() => {
                        setAba(id)
                        setErro(null)
                      }}
                      className={`h-7 rounded-[7px] text-[12px] font-semibold transition ${
                        aba === id ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : 'text-soft hover:text-ink'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11.5px] leading-4 text-dim">
                  <Link href={`/clientes/${clienteId}/loja/catalogo`} className="font-semibold text-primary hover:underline">
                    Cadastre produtos
                  </Link>{' '}
                  para cobrar pelo catálogo e saber o que mais vende pelo chat.
                </p>
              )}

              {aba === 'catalogo' ? (
                <>
                  <BuscaDeProduto clienteId={clienteId} aoEscolher={adicionar} />
                  {escolhidos.length > 0 ? (
                    <div className="rounded-[9px] border border-line">
                      <ul className="divide-y divide-line">
                        {escolhidos.map((e) => (
                          <li key={e.produto.produtoId} className="flex items-center gap-2 px-2.5 py-1.5">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-semibold">{e.produto.nome}</span>
                              <span className="block text-[11.5px] text-dim tabular-nums">
                                {e.produto.preco !== undefined ? reais(e.produto.preco * e.quantidade) : 'sem preço'}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => mudarQuantidade(e.produto.produtoId, -1)}
                                aria-label={e.quantidade === 1 ? `Tirar ${e.produto.nome}` : `Um a menos de ${e.produto.nome}`}
                                className="flex size-6 items-center justify-center rounded-[6px] border border-line text-[13px] text-soft hover:bg-surface-strong"
                              >
                                −
                              </button>
                              <span className="w-5 text-center text-[12.5px] font-semibold tabular-nums">{e.quantidade}</span>
                              <button
                                type="button"
                                onClick={() => mudarQuantidade(e.produto.produtoId, 1)}
                                aria-label={`Um a mais de ${e.produto.nome}`}
                                className="flex size-6 items-center justify-center rounded-[6px] border border-line text-[13px] text-soft hover:bg-surface-strong"
                              >
                                +
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-baseline justify-between border-t border-line px-2.5 py-1.5">
                        <span className="text-[12px] text-soft">Total</span>
                        <span className="text-[14px] font-bold tabular-nums">{reais(total)}</span>
                      </div>
                    </div>
                  ) : null}
                  {comPedidos ? (
                    <div className="flex flex-col gap-1.5">
                      <div role="radiogroup" aria-label="Como a pessoa recebe" className="grid grid-cols-2 gap-1 rounded-[9px] bg-surface-strong p-1">
                        {(
                          [
                            ['retirada', 'Retirada'],
                            ['entrega', 'Entrega'],
                          ] as const
                        ).map(([id, rotulo]) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={entrega === id}
                            onClick={() => setEntrega(id)}
                            className={`h-7 rounded-[7px] text-[12px] font-semibold transition-colors ${
                              entrega === id ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]' : 'text-soft hover:text-ink'
                            }`}
                          >
                            {rotulo}
                          </button>
                        ))}
                      </div>
                      {entrega === 'entrega' ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-[11.5px] font-semibold text-soft">Endereço da entrega</span>
                          <input
                            value={endereco}
                            maxLength={300}
                            onChange={(e) => setEndereco(e.target.value)}
                            placeholder="Exemplo: Rua das Flores, 120, apto 32"
                            className="app-field h-9 w-full px-2.5 text-[13px]"
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-soft">Descrição (opcional)</span>
                    <input
                      value={descricao}
                      maxLength={200}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Exemplo: Pedido de sexta"
                      className="app-field h-9 w-full px-2.5 text-[13px]"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-soft">Valor</span>
                    <span className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[12.5px] text-dim">R$</span>
                      <input
                        inputMode="decimal"
                        autoFocus
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="Exemplo: 109,80"
                        className="app-field h-9 w-full pr-2.5 pl-8 text-[13px] tabular-nums"
                      />
                    </span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-soft">Descrição</span>
                    <input
                      value={descricao}
                      maxLength={200}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Exemplo: Sinal da reserva"
                      className="app-field h-9 w-full px-2.5 text-[13px]"
                    />
                  </label>
                </>
              )}

              {pedeDocumento && (
                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] font-semibold text-soft">CPF ou CNPJ de quem paga</span>
                  <input
                    inputMode="numeric"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="Exemplo: 529.982.247-25"
                    className="app-field h-9 w-full px-2.5 text-[13px] tabular-nums"
                  />
                  <span className="text-[11px] leading-4 text-dim">
                    O {NOME_DO_GATEWAY[cobrar.gateway]} exige. Fica salvo na ficha para a próxima.
                  </span>
                </label>
              )}

              {erro && (
                <p role="alert" className="text-[12px] leading-5 text-perigo">
                  {erro}
                </p>
              )}

              <p className="text-[11.5px] leading-4 text-dim">
                Sai nesta conversa com Pix copia e cola e link para cartão ou boleto. Vence em 24 horas. Recebe na
                conta do {NOME_DO_GATEWAY[cobrar.gateway]}.
              </p>
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={!pronto || enviando}
                className="botao-primario botao-md w-full"
              >
                {enviando
                  ? 'Gerando o Pix…'
                  : aba === 'catalogo' && escolhidos.length > 0
                    ? `Cobrar ${reais(total)}`
                    : 'Enviar cobrança'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A busca do catálogo dentro do Cobrar: a mesma do botão de produtos e do
 * bot (`acaoBuscarProdutosDoInbox`), então o que a equipe acha aqui é o que o
 * cliente vê no card. Tocar adiciona; tocar de novo soma um.
 */
function BuscaDeProduto({ clienteId, aoEscolher }: { clienteId: string; aoEscolher: (p: ProdutoDaLoja) => void }) {
  const [termo, setTermo] = useState('')
  const [produtos, setProdutos] = useState<ProdutoDaLoja[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ultimaBusca = useRef(0)

  useEffect(() => {
    const numero = ++ultimaBusca.current
    if (termo.trim() === '') return
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await acaoBuscarProdutosDoInbox(clienteId, termo)
        if (numero !== ultimaBusca.current) return
        if (r.ok) {
          setProdutos(r.produtos)
          setErro(null)
        } else {
          setProdutos([])
          setErro(r.erro)
        }
      } catch {
        if (numero === ultimaBusca.current) setErro('Não foi possível buscar agora.')
      } finally {
        if (numero === ultimaBusca.current) setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [termo, clienteId])

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="search"
        value={termo}
        autoFocus
        onChange={(e) => {
          setTermo(e.target.value)
          if (e.target.value.trim() === '') {
            ultimaBusca.current++
            setProdutos([])
            setErro(null)
          }
        }}
        placeholder="Buscar produto por nome ou SKU"
        aria-label="Buscar produto"
        className="app-field h-9 w-full px-2.5 text-[13px]"
      />
      {erro && <p className="text-[12px] leading-5 text-perigo">{erro}</p>}
      {termo.trim() !== '' && !buscando && !erro && produtos.length === 0 && (
        <p className="text-[12px] leading-5 text-dim">Nada com esse nome ou SKU.</p>
      )}
      {produtos.length > 0 && (
        <ul className="max-h-[180px] overflow-y-auto rounded-[9px] border border-line">
          {produtos.map((p) => (
            <li key={p.produtoId}>
              <button
                type="button"
                onClick={() => aoEscolher(p)}
                className="flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition hover:bg-surface-strong"
              >
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto} alt="" className="size-8 shrink-0 rounded-[7px] border border-line bg-white object-contain p-0.5" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] border border-line text-dim [&_svg]:size-4">
                    <IconeSacola />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{p.nome}</span>
                  <span className="block truncate text-[11.5px] text-dim tabular-nums">
                    {p.preco !== undefined
                      ? reais(p.preco)
                      : p.precoAPartirDe !== undefined
                        ? 'preço por variação'
                        : 'sem preço'}
                    {!p.emEstoque && !p.semControleDeEstoque ? ' · esgotado' : ''}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-[16px] leading-none text-primary">
                  +
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
