'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { ProdutoDaLoja } from '@/core/loja'
import type { ResultadoDoTeste } from '@/server/acoes-loja'

/**
 * A loja Magento da conta: testar, ligar, desligar.
 *
 * **Ligar só depois de ver a amostra.** O dono precisa ver três produtos da
 * própria loja, com o preço que o site mostra, antes de o bot sair falando
 * deles no WhatsApp. É o jeito de ele descobrir aqui, e não pelo cliente, que
 * o endereço era de outra loja ou que o preço vem errado.
 */

type Inicial = {
  endereco: string
  ativa: boolean
  verificadaEm: string | null
  tokenConectado: boolean
  /** Conferido ao abrir a tela, na loja. Ver `estadoDoToken`. */
  tokenRecusado?: boolean
} | null

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function Preco({ produto }: { produto: ProdutoDaLoja }) {
  // Variações com preços diferentes chegam como "a partir de", sem `preco`.
  if (produto.precoAPartirDe !== undefined) {
    return (
      <span>
        <span className="mr-1 text-dim">a partir de</span>
        <strong className="text-soft">{real.format(produto.precoAPartirDe)}</strong>
      </span>
    )
  }
  if (produto.preco === undefined) return <span className="text-aviso">sem preço na loja</span>
  return (
    <span>
      {produto.precoDe !== undefined && (
        <span className="mr-1.5 text-dim line-through">{real.format(produto.precoDe)}</span>
      )}
      <strong className="text-soft">{real.format(produto.preco)}</strong>
    </span>
  )
}

function Amostra({ produtos }: { produtos: ProdutoDaLoja[] }) {
  return (
    <ul className="mt-3 divide-y divide-line">
      {produtos.map((p) => (
        <li key={p.produtoId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-[13px]">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            {p.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto do CDN da loja, domínio de cada cliente
              <img src={p.foto} alt="" className="size-11 shrink-0 rounded-[8px] border border-line bg-white object-contain" />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-line text-center text-[9.5px] leading-tight text-aviso">
                sem foto
              </span>
            )}
            <a href={p.link} target="_blank" rel="noreferrer" className="min-w-0 truncate underline-offset-2 hover:underline">
              {p.nome}
            </a>
          </span>
          <span className="flex items-baseline gap-3 text-[12.5px]">
            <Preco produto={p} />
            <span className={p.emEstoque ? 'text-ok' : 'text-dim'}>{p.emEstoque ? 'em estoque' : 'esgotado'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function LojaMagento({
  inicial,
  fluxosHref,
  guiaHref,
  testar,
  ligar,
  desligar,
  conectarToken,
  desconectarToken,
}: {
  inicial: Inicial
  fluxosHref: string
  guiaHref: string
  testar: (endereco: string, termo: string) => Promise<ResultadoDoTeste>
  ligar: (endereco: string, termo: string) => Promise<{ ok: true } | { ok: false; motivo: string }>
  desligar: () => Promise<{ ok: true } | { ok: false; motivo: string }>
  conectarToken: (token: string, sku: string) => Promise<{ ok: true; via: string } | { ok: false; motivo: string }>
  desconectarToken: () => Promise<{ ok: true } | { ok: false; motivo: string }>
}) {
  const [endereco, setEndereco] = useState(inicial?.endereco ?? '')
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<ResultadoDoTeste | null>(null)
  const [ativa, setAtiva] = useState(inicial?.ativa ?? false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const [token, setToken] = useState('')
  const [tokenConectado, setTokenConectado] = useState(inicial?.tokenConectado ?? false)
  const [erroDoToken, setErroDoToken] = useState<string | null>(null)
  // O produto de prova do token é o primeiro da amostra: só existe depois de
  // testar a loja nesta visita, e é de propósito, para provar o token num SKU
  // que acabou de responder.
  const skuDeProva = resultado?.ok ? (resultado.amostra[0]?.produtoId ?? '') : ''

  function aoConectarToken() {
    setErroDoToken(null)
    iniciar(async () => {
      const r = await conectarToken(token, skuDeProva)
      if (r.ok) {
        setTokenConectado(true)
        setToken('')
      } else setErroDoToken(r.motivo)
    })
  }

  function aoDesconectarToken() {
    setErroDoToken(null)
    iniciar(async () => {
      const r = await desconectarToken()
      if (r.ok) setTokenConectado(false)
      else setErroDoToken(r.motivo)
    })
  }

  // Mudou o endereço ou o produto depois de testar: o teste deixou de valer
  // para o que está escrito, e o botão de ligar some até testar de novo.
  function mudar(campo: 'endereco' | 'termo', valor: string) {
    if (campo === 'endereco') setEndereco(valor)
    else setTermo(valor)
    setResultado(null)
    setErro(null)
  }

  function aoTestar() {
    setErro(null)
    iniciar(async () => setResultado(await testar(endereco, termo)))
  }

  function aoLigar() {
    setErro(null)
    iniciar(async () => {
      const r = await ligar(endereco, termo)
      if (r.ok) setAtiva(true)
      else setErro(r.motivo)
    })
  }

  function aoDesligar() {
    setErro(null)
    iniciar(async () => {
      const r = await desligar()
      if (r.ok) setAtiva(false)
      else setErro(r.motivo)
    })
  }

  return (
    <div className="max-w-[680px]">
      {ativa && (
        <div className="app-card mb-5 px-5 py-4">
          <p className="text-[13px] font-bold text-ok">Ligada</p>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            O bot pode consultar <strong className="text-soft">{endereco}</strong>. Para ele usar, marque{' '}
            <strong className="text-soft">Buscar produto na loja</strong> no bloco de IA do{' '}
            <Link href={fluxosHref} className="underline underline-offset-2 hover:text-primary">
              fluxo
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={aoDesligar}
            disabled={pendente}
            className="app-secondary-button mt-3 px-[14px] py-2 text-[12.5px] disabled:opacity-60"
          >
            Desligar
          </button>
        </div>
      )}

      <div className="app-card px-5 py-4">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-bold text-soft">Endereço da loja</span>
          <input
            type="url"
            inputMode="url"
            value={endereco}
            onChange={(e) => mudar('endereco', e.target.value)}
            placeholder="https://www.sualoja.com.br"
            className="app-field px-3.5 py-2.5 text-[13px]"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12.5px] font-bold text-soft">Um produto que a loja vende</span>
          <span className="mb-2 block text-[11.5px] leading-4 text-dim">
            Só para o teste: a gente busca na loja e mostra o que ela respondeu.
          </span>
          <input
            value={termo}
            onChange={(e) => mudar('termo', e.target.value)}
            placeholder="headset"
            className="app-field px-3.5 py-2.5 text-[13px]"
          />
        </label>

        <button
          type="button"
          onClick={aoTestar}
          disabled={pendente || endereco.trim() === '' || termo.trim() === ''}
          className="app-primary-button mt-4 px-[18px] py-2.5 text-[13px] disabled:opacity-60"
        >
          {pendente ? 'Aguarde…' : 'Testar conexão'}
        </button>

        {resultado && !resultado.ok && (
          <p className="mt-4 text-[12.5px] leading-5 text-perigo">{resultado.motivo}</p>
        )}

        {resultado?.ok && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[13px] font-bold text-soft">A loja respondeu. É isto que o bot vai ver:</p>
            <Amostra produtos={resultado.amostra} />

            {resultado.moeda !== 'BRL' && (
              <p className="mt-3 text-[12px] leading-5 text-aviso">
                A moeda da loja é {resultado.moeda}. O bot vai mostrar os valores como a loja manda.
              </p>
            )}
            {resultado.semComplementos && (
              <p className="mt-3 text-[12px] leading-5 text-aviso">
                Este produto não tem complementos cadastrados. O bot busca e mostra produtos, mas só
                sugere “combina com” quando a loja marca em Catálogo › Produtos › Produtos relacionados.
              </p>
            )}

            <button
              type="button"
              onClick={aoLigar}
              disabled={pendente}
              className="app-primary-button mt-4 px-[18px] py-2.5 text-[13px] disabled:opacity-60"
            >
              {pendente ? 'Salvando…' : ativa ? 'Salvar este endereço' : 'Ligar no bot'}
            </button>
          </div>
        )}

        {erro && <p className="mt-3 text-[12.5px] leading-5 text-perigo">{erro}</p>}
      </div>

      {ativa && (
        <section className="mt-8 border-t border-line pt-6">
          <h2 className="text-[15px] font-bold tracking-[-0.01em]">Estoque exato (opcional)</h2>
          <p className="mt-1 mb-4 max-w-[600px] text-[13px] leading-6 text-muted">
            Com o token de administrador da loja, o bot diz <strong className="text-soft">quantas unidades restam</strong>{' '}
            e garante a foto do produto nas lojas que não a deixam aberta. Este acesso é usado só para ler: o AutoFluxos não cria, altera nem
            apaga nada na loja, e a loja pode revogar quando quiser em Sistema › Integrações.
          </p>

          <div className="app-card px-5 py-4">
            {tokenConectado ? (
              <>
                {inicial?.tokenRecusado ? (
                  <>
                    <p className="text-[13px] font-bold text-perigo">A loja recusou o token</p>
                    <p className="mt-1 text-[12.5px] leading-5 text-muted">
                      Ele foi revogado ou expirou. Enquanto isso, o bot diz só se tem ou não tem. Desconecte e
                      cole um token novo.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-bold text-ok">Token conectado</p>
                    <p className="mt-1 text-[12.5px] leading-5 text-muted">
                      Se a loja revogar o token, o bot volta sozinho a dizer só se tem ou não tem.
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={aoDesconectarToken}
                  disabled={pendente}
                  className="app-secondary-button mt-3 px-[14px] py-2 text-[12.5px] disabled:opacity-60"
                >
                  Desconectar
                </button>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-soft">Token de acesso</span>
                  <span className="mb-2 block text-[11.5px] leading-4 text-dim">
                    Quem gera é a loja.{' '}
                    <a href={guiaHref} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-primary">
                      Passo a passo para mandar ao responsável
                    </a>
                    .
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="app-field px-3.5 py-2.5 text-[13px]"
                  />
                </label>
                {skuDeProva === '' && (
                  <p className="mt-2 text-[11.5px] leading-4 text-dim">
                    Teste a conexão da loja acima primeiro: o token é provado num produto que ela acabou de mostrar.
                  </p>
                )}
                <button
                  type="button"
                  onClick={aoConectarToken}
                  disabled={pendente || token.trim() === '' || skuDeProva === ''}
                  className="app-primary-button mt-3 px-[18px] py-2.5 text-[13px] disabled:opacity-60"
                >
                  {pendente ? 'Conferindo…' : 'Testar e salvar'}
                </button>
              </>
            )}
            {erroDoToken && <p className="mt-3 text-[12.5px] leading-5 text-perigo">{erroDoToken}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
