import type { ReactNode } from 'react'
import { Marca } from './marca'

/**
 * A moldura das telas de porta: entrar e criar conta.
 *
 * Existe porque são **duas**, e antes era uma. Duplicar o painel da esquerda em
 * cada uma é o caminho conhecido para as duas divergirem — a contagem de blocos
 * que a tela anuncia já esteve errada uma vez, e ter duas cópias dela é ter duas
 * chances de errar de novo.
 *
 * O lado esquerdo some abaixo de `md`: em 390px ele empurraria o formulário
 * para fora da tela, e quem chega no celular vem para entrar, não para ler.
 */
export function Portico({
  titulo,
  descricao,
  rodape,
  children,
}: {
  titulo: string
  descricao: string
  rodape?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen bg-canvas md:h-screen md:min-h-[700px] md:overflow-hidden">
      <section className="relative hidden min-w-0 flex-[1.15] flex-col justify-between overflow-hidden px-[52px] py-11 md:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(19,25,34,.06)_1px,transparent_1.3px)] bg-[length:26px_26px]" />

        <div className="relative flex items-center gap-2.5">
          <Marca compacta />
          <span className="ml-0.5 rounded-md border border-line px-2 py-0.5 font-mono text-[10px] text-dim">
            by 4YU
          </span>
        </div>

        <div className="relative max-w-[540px]">
          <h1 className="text-[44px] leading-[1.08] font-bold tracking-[-0.03em] text-balance">
            O atendimento dos seus clientes, desenhado bloco a bloco.
          </h1>
          <p className="mt-4 max-w-[430px] text-[14.5px] leading-[1.6] text-muted">
            Fluxos de conversa no WhatsApp — o bot conduz, coleta o que importa e passa para uma
            pessoa na hora certa.
          </p>
          <div className="mt-7 flex gap-[22px] font-mono text-[11px] text-dim">
            {/* Oito desde que o bloco de mídia entrou. Contagem errada na porta
                de entrada é a primeira coisa que alguém confere — já anunciou
                seis quando eram sete. */}
            <span>
              <strong className="font-normal text-primary">8</strong> tipos de bloco
            </span>
            <span>
              <strong className="font-normal text-primary">1</strong> arrasto = 1 ramificação
            </span>
            <span>handoff sempre garantido</span>
          </div>
        </div>

        <p className="relative font-mono text-[10.5px] text-dim">© 2026 4YU · uso interno</p>
      </section>

      <section className="flex w-full shrink-0 items-center justify-center border-line bg-panel p-6 md:w-[440px] md:border-l md:p-10">
        <div className="app-page-enter w-full max-w-[312px]">
          <div className="mb-6 md:hidden">
            <Marca />
          </div>

          <h2 className="text-[21px] font-bold tracking-[-0.02em]">{titulo}</h2>
          <p className="mt-1 mb-[26px] text-[12.5px] text-muted">{descricao}</p>

          {children}

          {rodape && (
            <div className="mt-[22px] border-t border-line pt-4 text-[11.5px] leading-[1.6] text-dim">
              {rodape}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
