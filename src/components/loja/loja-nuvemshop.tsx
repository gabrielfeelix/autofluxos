'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { ProdutoDaLoja } from '@/core/loja'
import { Marca } from './conectar-loja'

type Resposta = { ok: true } | { ok: false; motivo: string }
type Teste = { ok: true; amostra: ProdutoDaLoja[] } | { ok: false; motivo: string }

/** O que volta do OAuth, dito para o lojista. */
const RESULTADOS: Record<string, { tom: 'ok' | 'aviso' | 'perigo'; texto: string }> = {
  conectado: { tom: 'ok', texto: 'Loja conectada. Teste uma busca abaixo e ligue o bot quando os produtos aparecerem certos.' },
  sem_webhook: {
    tom: 'aviso',
    texto:
      'Loja conectada, mas a Nuvemshop não aceitou o aviso de remoção do app. Funciona igual; se remover o app lá, desconecte aqui também.',
  },
  cancelado: { tom: 'aviso', texto: 'A autorização foi cancelada na Nuvemshop. Nada mudou por aqui.' },
  falhou: { tom: 'perigo', texto: 'A Nuvemshop não completou a conexão. Tente de novo; se repetir, fale com o suporte.' },
  outra_conta: { tom: 'perigo', texto: 'Esta loja Nuvemshop já está conectada a outra conta do AutoFluxos.' },
}

const COR = {
  ok: 'bg-emerald-400/[0.09] text-ok',
  aviso: 'bg-amber-300/[0.12] text-aviso',
  perigo: 'bg-rose-400/[0.1] text-perigo',
}

/**
 * A tela da Nuvemshop: conectar (OAuth), testar uma busca, ligar o bot,
 * desconectar. Ligar e desligar são otimistas; o teste mostra produtos de
 * verdade, com foto, preço e estoque, antes de o dono ligar.
 */
export function LojaNuvemshop({
  liberada,
  resultado,
  inicial,
  catalogoHref,
  conectar,
  testar,
  ligar,
  desconectar,
}: {
  liberada: boolean
  resultado: string | null
  inicial: { endereco: string; ativa: boolean } | null
  catalogoHref: string
  conectar: () => Promise<{ ok: false; motivo: string }>
  testar: (termo: string) => Promise<Teste>
  ligar: (ativa: boolean) => Promise<Resposta>
  desconectar: () => Promise<Resposta>
}) {
  const [loja, setLoja] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, comecar] = useTransition()
  const aviso = resultado ? RESULTADOS[resultado] : undefined

  function irParaNuvemshop() {
    setErro(null)
    comecar(async () => {
      // Com sucesso a ação redireciona para a Nuvemshop e não volta aqui.
      const r = await conectar()
      if (r && !r.ok) setErro(r.motivo)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {aviso && <p role="status" className={`rounded-[12px] px-4 py-3 text-[12.5px] leading-5 font-semibold ${COR[aviso.tom]}`}>{aviso.texto}</p>}

      {!loja ? (
        <section className="app-card overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Conectar a sua Nuvemshop</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-dim">Leva um minuto, e é você quem autoriza, dentro da própria Nuvemshop.</p>
          </header>
          <ol className="flex flex-col gap-3 px-5 py-4 text-[13px] leading-5">
            <Passo n={1}>Clique em Conectar. Você vai para a Nuvemshop, já logado na sua loja.</Passo>
            <Passo n={2}>Autorize o AutoFluxos a <strong>ler</strong> produtos e pedidos. Ele não altera nada.</Passo>
            <Passo n={3}>Volte para cá, teste uma busca e ligue o bot.</Passo>
          </ol>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
            {liberada ? (
              <button
                type="button"
                onClick={irParaNuvemshop}
                disabled={indo}
                className="app-primary-button inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] disabled:opacity-60"
              >
                {indo ? 'Abrindo a Nuvemshop…' : 'Conectar com a Nuvemshop'} <span aria-hidden>›</span>
              </button>
            ) : (
              <>
                <p className="text-[12.5px] leading-5 text-muted">
                  A conexão com a Nuvemshop está sendo liberada. Enquanto isso, os produtos cadastrados à mão já
                  deixam o bot responder sobre eles.
                </p>
                <Link href={catalogoHref} className="app-primary-button inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px]">
                  Cadastrar produtos <span aria-hidden>›</span>
                </Link>
              </>
            )}
          </div>
        </section>
      ) : (
        <Conectada
          loja={loja}
          testar={testar}
          ligar={async (ativa) => {
            const antes = loja
            setLoja({ ...loja, ativa })
            const r = await ligar(ativa)
            if (!r.ok) setLoja(antes)
            return r
          }}
          desconectar={async () => {
            const r = await desconectar()
            if (r.ok) setLoja(null)
            return r
          }}
        />
      )}

      {erro && (
        <p role="alert" className="text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-weak text-[11.5px] font-bold text-primary">{n}</span>
      <span className="pt-0.5 text-muted">{children}</span>
    </li>
  )
}

function Conectada({
  loja,
  testar,
  ligar,
  desconectar,
}: {
  loja: { endereco: string; ativa: boolean }
  testar: (termo: string) => Promise<Teste>
  ligar: (ativa: boolean) => Promise<Resposta>
  desconectar: () => Promise<Resposta>
}) {
  const [termo, setTermo] = useState('')
  const [teste, setTeste] = useState<Teste | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [testando, comecarTeste] = useTransition()
  const [, comecar] = useTransition()

  function buscar(e: React.FormEvent) {
    e.preventDefault()
    comecarTeste(async () => setTeste(await testar(termo)))
  }

  function alternar() {
    setErro(null)
    comecar(async () => {
      const r = await ligar(!loja.ativa)
      if (!r.ok) setErro(r.motivo)
    })
  }

  function sair() {
    setErro(null)
    comecar(async () => {
      const r = await desconectar()
      if (!r.ok) setErro(r.motivo)
    })
  }

  return (
    <>
      <section className="app-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Marca id="nuvemshop" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">Nuvemshop conectada</h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
                loja.ativa ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-ok' : 'border-amber-300/30 bg-amber-300/[0.1] text-aviso'
              }`}
            >
              {loja.ativa ? 'Bot consultando' : 'Bot desligado'}
            </span>
          </div>
          <a href={loja.endereco} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[12.5px] text-muted underline-offset-2 hover:underline">
            {loja.endereco.replace(/^https:\/\//, '')}
          </a>
        </div>
        <button
          type="button"
          onClick={alternar}
          className={`inline-flex shrink-0 items-center justify-center rounded-[10px] px-4 py-2 text-[12.5px] font-bold transition ${
            loja.ativa ? 'border border-line text-ink hover:bg-surface' : 'bg-primary text-white hover:bg-primary-strong'
          }`}
        >
          {loja.ativa ? 'Desligar o bot' : 'Ligar o bot'}
        </button>
      </section>

      <section className="app-card overflow-hidden">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[14.5px] font-bold">Testar uma busca</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-dim">O mesmo que o bot faz quando alguém pergunta por um produto.</p>
        </header>
        <form onSubmit={buscar} className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Exemplo: camiseta preta"
            className="app-field min-w-0 flex-1 px-3.5 py-2.5 text-[13px]"
          />
          <button
            type="submit"
            disabled={testando}
            className="inline-flex items-center justify-center rounded-[10px] border border-line px-4 py-2 text-[12.5px] font-bold hover:bg-surface disabled:opacity-60"
          >
            {testando ? 'Buscando…' : 'Buscar na loja'}
          </button>
        </form>
        {teste && !teste.ok && <p className="px-5 pb-4 text-[12.5px] text-perigo">{teste.motivo}</p>}
        {teste?.ok && teste.amostra.length === 0 && (
          <p className="px-5 pb-4 text-[12.5px] text-muted">Nenhum produto visível na loja com esse nome.</p>
        )}
        {teste?.ok && teste.amostra.length > 0 && (
          <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
            {teste.amostra.map((p) => (
              <CartaoDoProduto key={p.produtoId} produto={p} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-[12px] border border-line px-5 py-4 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-dim">
          Desconectar apaga o acesso guardado aqui. Para tirar o app da loja, remova também em Aplicativos, na Nuvemshop.
        </p>
        {confirmando ? (
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={sair} className="rounded-[10px] bg-perigo px-3.5 py-2 text-[12.5px] font-bold text-white">
              Desconectar agora
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="px-2 text-[12.5px] font-semibold text-muted">
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="shrink-0 rounded-[10px] border border-line px-3.5 py-2 text-[12.5px] font-bold text-perigo hover:bg-surface"
          >
            Desconectar a loja
          </button>
        )}
      </section>

      {erro && (
        <p role="alert" className="text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}
    </>
  )
}

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function CartaoDoProduto({ produto: p }: { produto: ProdutoDaLoja }) {
  const preco = p.preco ?? p.precoAPartirDe
  return (
    <li className="flex gap-3 rounded-[12px] border border-line p-3">
      {p.foto ? (
        // A foto é da CDN da loja; `next/image` pediria cada domínio na config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.foto} alt="" className="size-14 shrink-0 rounded-[8px] bg-surface object-cover" />
      ) : (
        <span className="size-14 shrink-0 rounded-[8px] bg-surface" />
      )}
      <div className="min-w-0 flex-1">
        <a href={p.link} target="_blank" rel="noreferrer" className="line-clamp-2 text-[12.5px] leading-4 font-bold underline-offset-2 hover:underline">
          {p.nome}
        </a>
        <p className="mt-1 text-[12px]">
          {p.precoAPartirDe !== undefined && <span className="text-dim">a partir de </span>}
          {preco !== undefined ? <strong>{REAIS.format(preco)}</strong> : <span className="text-dim">sem preço</span>}
          {p.precoDe !== undefined && <s className="ml-1.5 text-dim">{REAIS.format(p.precoDe)}</s>}
        </p>
        <p className={`text-[11.5px] ${p.emEstoque ? 'text-ok' : 'text-dim'}`}>
          {!p.emEstoque ? 'esgotado' : p.quantidade !== undefined ? `${p.quantidade} em estoque` : 'em estoque'}
        </p>
      </div>
    </li>
  )
}
