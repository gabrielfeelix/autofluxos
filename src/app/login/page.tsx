import { Marca } from '@/components/design/marca'
import { LoginFormulario } from '@/components/design/login-formulario'

export default function Login() {
  return (
    <main className="flex h-screen min-h-[700px] overflow-hidden bg-canvas">
      <section className="relative flex min-w-0 flex-[1.15] flex-col justify-between overflow-hidden px-[52px] py-11">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,.045)_1px,transparent_1.3px)] bg-[length:26px_26px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-[120px] size-[520px] rounded-full bg-[radial-gradient(circle,rgba(86,208,245,.09),transparent_65%)]" />

        <div className="relative flex items-center gap-2.5">
          <Marca compacta />
          <span className="ml-0.5 rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-dim">by 4YU</span>
        </div>

        <div className="relative max-w-[540px]">
          <h1 className="text-[44px] leading-[1.08] font-bold tracking-[-0.03em] text-balance">
            O atendimento dos seus clientes, desenhado bloco a bloco.
          </h1>
          <p className="mt-4 max-w-[430px] text-[14.5px] leading-[1.6] text-muted">
            Fluxos de conversa no WhatsApp — o bot conduz, coleta o que importa e passa para uma pessoa na hora certa.
          </p>
          <div className="mt-7 flex gap-[22px] font-mono text-[11px] text-dim">
            {/* Oito desde que o bloco de mídia entrou. Contagem errada na porta
                de entrada é a primeira coisa que alguém confere — já anunciou
                seis quando eram sete. */}
            <span><strong className="font-normal text-accent">8</strong> tipos de bloco</span>
            <span><strong className="font-normal text-accent">1</strong> arrasto = 1 ramificação</span>
            <span>handoff sempre garantido</span>
          </div>
        </div>

        <p className="relative font-mono text-[10.5px] text-[#454f60]">© 2026 4YU · uso interno</p>
      </section>

      <section className="flex w-[440px] shrink-0 items-center justify-center border-l border-white/[0.07] bg-white/[0.018] p-10">
        <div className="app-page-enter w-full max-w-[312px]">
          <h2 className="text-[21px] font-bold tracking-[-0.02em]">Entrar</h2>
          <p className="mt-1 mb-[26px] text-[12.5px] text-muted">Acesso do operador 4YU.</p>

          <LoginFormulario />

          <p className="mt-[22px] border-t border-white/[0.06] pt-4 text-[11.5px] leading-[1.6] text-dim">
            Sessões expiram após 12 h. O e-mail não cria uma conta neste MVP; a senha única é o que libera o painel.
          </p>
        </div>
      </section>
    </main>
  )
}
