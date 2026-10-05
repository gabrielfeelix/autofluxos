'use client'

import { useRef, useState } from 'react'
import { VazioDoCartao } from '@/components/lead-crm/vazio-do-cartao'
import { IlustracaoAcervo } from '@/components/design/ilustracoes'
import { useConfirmar } from '@/components/design/confirmar'
import { dataEHora } from '@/lib/quando'
import {
  acaoApagarArquivoDoNegocio,
  acaoPrepararArquivoDoNegocio,
  acaoRegistrarArquivoDoNegocio,
} from '@/server/acoes-negocio'
import type { ArquivoDoNegocio } from '@/server/repos/arquivos-do-negocio'

/** O id do seletor de arquivo: o "Anexar" do cabeçalho clica nele. */
export const ID_DO_SELETOR_DE_ARQUIVO = 'arquivo-do-negocio'

const ACEITOS = 'application/pdf,image/jpeg,image/png,image/webp'
const TETO = 10 * 1024 * 1024

type Item = ArquivoDoNegocio & { enviando?: boolean }

function tamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Os arquivos guardados no negócio: proposta, contrato, foto do produto.
 *
 * Otimista como o resto da página: o arquivo entra na lista no clique,
 * marcado "enviando", e só sai se o envio falhar, com a frase do erro.
 * O envio vai do navegador direto ao Storage (ver `arquivos-do-negocio.ts`
 * no servidor), por isso aqui são três passos: preparar, mandar, registrar.
 */
export function ArquivosDoNegocio({
  clienteId,
  cartaoId,
  iniciais,
  agora,
}: {
  clienteId: string
  cartaoId: string
  iniciais: ArquivoDoNegocio[]
  agora: number
}) {
  const [itens, setItens] = useState<Item[]>(iniciais)
  const [erro, setErro] = useState<string | null>(null)
  const seletor = useRef<HTMLInputElement>(null)
  const { confirmar, dialogo } = useConfirmar()

  async function enviar(arquivo: File) {
    if (!ACEITOS.split(',').includes(arquivo.type)) {
      setErro(`"${arquivo.name}" não entrou: só PDF ou imagem (jpg, png, webp).`)
      return
    }
    if (arquivo.size > TETO) {
      setErro(`"${arquivo.name}" não entrou: passa de 10 MB.`)
      return
    }
    const local = `local-${crypto.randomUUID()}`
    setItens((atuais) => [
      {
        id: local,
        nome: arquivo.name,
        mime: arquivo.type,
        bytes: arquivo.size,
        autor: null,
        criadoEm: new Date().toISOString(),
        url: null,
        enviando: true,
      },
      ...atuais,
    ])
    const desistir = (frase: string) => {
      setItens((atuais) => atuais.filter((item) => item.id !== local))
      setErro(`"${arquivo.name}" não entrou: ${frase}.`)
    }
    try {
      const dados = { nome: arquivo.name, mime: arquivo.type, bytes: arquivo.size }
      const preparo = await acaoPrepararArquivoDoNegocio(clienteId, cartaoId, dados)
      if (!preparo.ok) return desistir(preparo.erro)
      const envio = await fetch(preparo.url, {
        method: 'PUT',
        headers: { 'content-type': arquivo.type, 'x-upsert': 'false' },
        body: arquivo,
      })
      if (!envio.ok) return desistir('o envio falhou, tente de novo')
      const r = await acaoRegistrarArquivoDoNegocio(clienteId, cartaoId, { caminho: preparo.caminho, ...dados })
      if (!r.ok) return desistir(r.erro)
      setItens((atuais) => atuais.map((item) => (item.id === local ? r.arquivo : item)))
    } catch {
      desistir('sem conexão com o servidor')
    }
  }

  function apagar(item: Item) {
    confirmar({
      titulo: 'Apagar este arquivo?',
      descricao: `"${item.nome}" sai do negócio e não volta.`,
      rotulo: 'Apagar',
      tom: 'perigo',
      aoConfirmar: async () => {
        const r = await acaoApagarArquivoDoNegocio(clienteId, cartaoId, item.id)
        if (r.ok) setItens((atuais) => atuais.filter((x) => x.id !== item.id))
        return r
      },
    })
  }

  return (
    <section className="app-card px-5 py-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold tracking-[0.06em] text-dim uppercase">Arquivos</h2>
        {itens.length > 0 && (
          <button
            type="button"
            className="text-[12px] font-semibold text-primary hover:underline"
            onClick={() => seletor.current?.click()}
          >
            + Arquivo
          </button>
        )}
      </header>
      <input
        ref={seletor}
        id={ID_DO_SELETOR_DE_ARQUIVO}
        type="file"
        accept={ACEITOS}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher arquivos para o negócio"
        onChange={(e) => {
          setErro(null)
          const escolhidos = Array.from(e.currentTarget.files ?? [])
          e.currentTarget.value = ''
          for (const arquivo of escolhidos) void enviar(arquivo)
        }}
      />
      {itens.length === 0 ? (
        <VazioDoCartao className="" ilustracao={<IlustracaoAcervo />}>
          Nenhum arquivo neste negócio. Guarde aqui proposta, contrato ou foto do produto, em PDF
          ou imagem até 10 MB.
          <button type="button" onClick={() => seletor.current?.click()} className="botao-secundario botao-sm mt-1">
            Anexar arquivo
          </button>
        </VazioDoCartao>
      ) : (
        <ul className="flex flex-col gap-2">
          {itens.map((item) => {
            const imagem = item.mime.startsWith('image/')
            return (
              <li
                key={item.id}
                className={`group flex items-center gap-3 rounded-[10px] border border-line bg-surface p-2 ${item.enviando ? 'opacity-60' : ''}`}
              >
                <a
                  href={item.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-panel"
                  aria-label={`Abrir ${item.nome}`}
                >
                  {imagem && item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-perigo">{imagem ? 'IMG' : 'PDF'}</span>
                  )}
                </a>
                <span className="min-w-0 flex-1">
                  <a
                    href={item.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[12.5px] font-semibold text-ink hover:text-primary"
                    title={item.nome}
                  >
                    {item.nome}
                  </a>
                  <span className="block truncate text-[11px] text-dim">
                    {item.enviando
                      ? `enviando… · ${tamanho(item.bytes)}`
                      : `${tamanho(item.bytes)} · ${item.autor ?? 'Alguém da equipe'} · ${dataEHora(item.criadoEm, agora)}`}
                  </span>
                </span>
                {!item.enviando && (
                  <button
                    type="button"
                    onClick={() => apagar(item)}
                    title="Apagar arquivo"
                    aria-label={`Apagar ${item.nome}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-dim transition hover:bg-panel hover:text-perigo"
                  >
                    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 7h14M10 7V5.2h4V7" />
                      <path d="m7 7 .8 12h8.4L17 7" />
                    </svg>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
      {dialogo}
    </section>
  )
}
