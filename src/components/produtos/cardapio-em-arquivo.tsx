'use client'

import { useRef, useState, useTransition } from 'react'
import { MIME_DO_MATERIAL, NOME_DO_MATERIAL, NOME_PADRAO_DO_PDF, type Material, type TipoDeMaterial } from '@/core/materiais'
import { acaoPrepararEnvioDoMaterial, acaoRemoverMaterial, acaoSalvarMaterial } from '@/server/acoes-materiais'

/** O teto do acervo, que é o da própria Cloud API. */
const LIMITE_MB = 16

/**
 * O cardápio em arquivo: o PDF e a imagem que o bot manda quando pedem "o
 * cardápio" (ferramenta `enviar_cardapio`).
 *
 * O envio é o do acervo: a ação assina um caminho na pasta da conta, o
 * navegador manda os bytes direto ao Storage, e só depois o endereço público
 * é gravado em `materiais`. Gravar antes deixaria o bot apontando para um
 * arquivo que não subiu.
 */
export function CardapioEmArquivo({
  clienteId,
  materiais,
}: {
  clienteId: string
  materiais: Material[]
}) {
  return (
    <section className="app-card mb-6 overflow-hidden">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[14.5px] font-bold">Cardápio completo</h2>
        <p className="mt-1 text-[11.5px] leading-5 text-dim">
          O bot manda este arquivo quando pedirem o cardápio: a imagem abre na conversa, o PDF fica para
          baixar. Com os dois, vão os dois.
        </p>
      </header>
      <div className="grid gap-3.5 p-5 sm:grid-cols-2">
        {(['cardapio-imagem', 'cardapio-pdf'] as const).map((tipo) => (
          <Envio key={tipo} clienteId={clienteId} tipo={tipo} atual={materiais.find((m) => m.tipo === tipo) ?? null} />
        ))}
      </div>
    </section>
  )
}

function Envio({ clienteId, tipo, atual }: { clienteId: string; tipo: TipoDeMaterial; atual: Material | null }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  const ehPdf = tipo === 'cardapio-pdf'

  function enviar(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      setErro(`Este arquivo tem ${Math.round(arquivo.size / 1024 / 1024)} MB. O teto é ${LIMITE_MB} MB.`)
      return
    }

    comecar(async () => {
      // Tudo dentro de um `try`: promessa rejeitada aqui sobe para a fronteira
      // de erro do React e derruba a tela inteira.
      try {
        const preparo = await acaoPrepararEnvioDoMaterial(clienteId, tipo, {
          nome: arquivo.name,
          tipo: arquivo.type,
          bytes: arquivo.size,
        })
        if (!preparo.ok || !preparo.envio) {
          setErro(preparo.erro ?? 'não deu para preparar o envio')
          return
        }

        const resposta = await fetch(preparo.envio.url, {
          method: 'PUT',
          headers: { 'content-type': arquivo.type },
          body: arquivo,
        })
        if (!resposta.ok) {
          setErro(
            resposta.status === 413
              ? `O arquivo passa do teto de ${LIMITE_MB} MB.`
              : `O envio falhou (${resposta.status}). Tente de novo.`,
          )
          return
        }

        // O nome que o cliente vê é o original, com acento; o do acervo foi
        // normalizado para a URL e ninguém o lê.
        const salvo = await acaoSalvarMaterial(clienteId, tipo, preparo.envio.urlPublica, arquivo.name)
        if (!salvo.ok) setErro(salvo.erro ?? 'não deu para salvar')
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'não deu para enviar')
      }
    })
  }

  function remover() {
    setErro(null)
    comecar(async () => {
      const r = await acaoRemoverMaterial(clienteId, tipo)
      if (!r.ok) setErro(r.erro ?? 'não deu para tirar')
    })
  }

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[12px] border border-line bg-panel">
      <div className="flex h-[140px] items-center justify-center bg-black/25">
        {atual && !ehPdf ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={atual.url} alt="Cardápio em imagem" className="size-full object-contain" />
        ) : (
          <span aria-hidden className="text-[30px] opacity-60">
            {ehPdf ? '📄' : '🖼'}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold">{NOME_DO_MATERIAL[tipo]}</p>
          <p className="mt-0.5 truncate text-[11px] text-dim">
            {atual
              ? ehPdf
                ? `Vai como “${atual.nomeArquivo ?? NOME_PADRAO_DO_PDF}”`
                : 'Enviada'
              : ehPdf
                ? 'Nenhum PDF ainda.'
                : 'Nenhuma imagem ainda. PNG, JPG ou WebP.'}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={rodando}
            onClick={() => entrada.current?.click()}
            className="app-secondary-button px-3 py-1.5 text-[11.5px] disabled:opacity-50"
          >
            {rodando ? 'Enviando…' : atual ? 'Trocar' : 'Enviar'}
          </button>
          {atual && (
            <>
              <a
                href={atual.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04]"
              >
                Abrir
              </a>
              <button
                type="button"
                disabled={rodando}
                onClick={remover}
                title="O bot deixa de mandar. O arquivo continua no acervo."
                className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:bg-white/[0.04] disabled:opacity-50"
              >
                Tirar
              </button>
            </>
          )}
        </div>
        {erro && (
          <p role="alert" className="text-[11px] leading-4 text-perigo">
            {erro}
          </p>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept={MIME_DO_MATERIAL[tipo].join(',')}
        className="hidden"
        onChange={(e) => {
          enviar(e.target.files?.[0])
          // Zerar deixa escolher o mesmo arquivo de novo depois de um erro.
          e.target.value = ''
        }}
      />
    </div>
  )
}
