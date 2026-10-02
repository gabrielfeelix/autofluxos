import type { ReactNode } from 'react'
import Image from 'next/image'

/**
 * A moldura das telas de porta: entrar e criar conta.
 *
 * Existe porque são **duas**, e antes era uma. Duplicar o painel da esquerda em
 * cada uma é o caminho conhecido para as duas divergirem, a contagem de blocos
 * que a tela anuncia já esteve errada uma vez, e ter duas cópias dela é ter duas
 * chances de errar de novo.
 *
 * Mora na casca azul, como a conta (decisão de 02/out): a apresentação fica
 * solta no azul e o formulário num cartão branco. Abaixo de `md` sobra só a
 * marca no topo: em 390px o texto empurraria o formulário para fora da tela.
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
    <main className="app-casca flex min-h-screen flex-col md:flex-row md:items-stretch">
      {/* No azul, a apresentação; no celular fica só a marca, por cima do cartão. */}
      <section className="relative flex min-w-0 flex-col justify-between px-6 pt-6 text-white md:flex-[1.1] md:px-14 md:py-12">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white">
            <Image src="/logos/logo-autofluxos-marca.png" alt="" width={24} height={24} priority />
          </span>
          <span className="text-[17px] font-bold tracking-[-0.01em]">AutoFluxos</span>
        </div>

        <div className="hidden max-w-[520px] md:block">
          <h1 className="text-[44px] leading-[1.08] font-bold tracking-[-0.03em] text-balance">
            O atendimento dos seus clientes, desenhado bloco a bloco.
          </h1>
          <p className="mt-4 max-w-[440px] text-[16px] leading-[1.6] text-white/85">
            Fluxos de conversa no WhatsApp: o bot conduz, coleta o que importa e passa para a sua
            equipe na hora certa.
          </p>
          <ul className="mt-8 space-y-3 text-[14.5px] text-white/90">
            {['API oficial do WhatsApp Business', 'Bot e equipe na mesma conversa', 'O seu número continua sendo o seu'].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-[12.5px] text-white/70 md:block">Um produto da 4YU</p>
      </section>

      <section className="flex flex-1 items-start justify-center p-4 pt-6 md:w-[520px] md:flex-none md:items-center md:p-10">
        <div className="app-page-enter w-full max-w-[400px] rounded-[24px] bg-panel px-6 py-8 text-ink shadow-[var(--sombra-ilha)] md:px-9 md:py-10">
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">{titulo}</h2>
          <p className="mt-1 mb-[26px] text-[13.5px] leading-[1.55] text-muted">{descricao}</p>

          {children}

          {rodape && (
            <div className="mt-[22px] border-t border-line pt-4 text-[12.5px] leading-[1.6] text-dim">
              {rodape}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
