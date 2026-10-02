import type { Metadata } from 'next'
import Link from 'next/link'
import { ARTIGOS, CATEGORIAS, MAIS_PROCURADOS, acharArtigo, artigosDa, categoriaDe } from '@/components/ajuda/artigos'
import { BuscaDaAjuda } from '@/components/ajuda/busca'
import {
  FaleComAGente,
  IconeArtigo,
  IconeDaCategoria,
  IconeSeta,
  WHATSAPP_DA_4YU,
} from '@/components/ajuda/moldura'
import { RedirecionarAncoraAntiga } from '@/components/ajuda/sumario'
import { CabecalhoDeDocs } from '@/components/docs/casca'
import { BlocoDeCodigo } from '@/components/docs/codigo'
import { SeloDeMetodo } from '@/components/docs/referencia'

/**
 * A home da central de ajuda, no desenho das centrais de SaaS (Intercom,
 * Zendesk, RD): busca grande no topo, categorias em cartões com a contagem de
 * artigos, e os mais procurados logo abaixo. Cada assunto é um artigo com
 * endereço próprio, `/ajuda/<id>`, que dá para mandar para alguém.
 */
export const metadata: Metadata = {
  title: 'Central de ajuda, AutoFluxos',
  description:
    'Como montar automações de WhatsApp, fazer a conversa entender datas e ligar a agenda da Verandi.',
}

export default function Pagina() {
  const procurados = MAIS_PROCURADOS.map(acharArtigo).filter((artigo) => artigo !== undefined)

  return (
    <>
      <RedirecionarAncoraAntiga />
      <CabecalhoDeDocs area="ajuda" />

      <section className="mx-auto w-full max-w-[760px] px-4 pt-14 pb-16 text-center md:pt-20 md:pb-20">
        <h1 className="text-[32px] leading-[1.1] font-bold tracking-[-0.03em] text-white md:text-[44px]">
          Como podemos ajudar?
        </h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-[1.6] text-white/85 md:text-[16px]">
          Guias para montar automações, configurar perguntas e integrar a agenda, com exemplos
          prontos para copiar.
        </p>
        <div className="mx-auto mt-8 max-w-[640px]">
          <BuscaDaAjuda grande whatsapp={WHATSAPP_DA_4YU} />
        </div>
        <p className="mt-5 text-[13px] text-white/80">
          {ARTIGOS.length} artigos em {CATEGORIAS.length} categorias
        </p>
      </section>

      <main className="mx-3 rounded-[28px] bg-panel px-5 py-10 shadow-[var(--sombra-ilha)] md:mx-6 md:px-10 md:py-14">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink">Categorias</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {CATEGORIAS.map((categoria) => {
              const artigos = artigosDa(categoria.id)
              return (
                <section
                  key={categoria.id}
                  aria-labelledby={`categoria-${categoria.id}`}
                  className="flex flex-col rounded-[20px] border border-line bg-panel p-5 md:p-6"
                >
                  <div className="flex gap-4">
                    <span
                      aria-hidden
                      className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-weak text-primary"
                    >
                      <IconeDaCategoria icone={categoria.icone} />
                    </span>
                    <div className="min-w-0">
                      <h3 id={`categoria-${categoria.id}`} className="text-[16.5px] font-bold tracking-[-0.01em] text-ink">
                        {categoria.titulo}
                      </h3>
                      <p className="mt-1 text-[14px] leading-[1.55] text-muted">{categoria.descricao}</p>
                    </div>
                  </div>
                  <ul className="mt-4 border-t border-line pt-2">
                    {artigos.map((artigo) => (
                      <li key={artigo.id}>
                        <Link
                          href={`/ajuda/${artigo.id}`}
                          className="group flex items-center justify-between gap-3 rounded-lg py-2 text-[14px] font-medium text-soft transition hover:text-primary"
                        >
                          {artigo.titulo}
                          <span aria-hidden className="shrink-0 text-dim transition group-hover:translate-x-0.5 group-hover:text-primary">
                            <IconeSeta />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto pt-3 text-[12.5px] font-medium text-dim">{artigos.length} artigos</p>
                </section>
              )
            })}
          </div>

          <h2 className="mt-12 text-[20px] font-bold tracking-[-0.02em] text-ink">Mais procurados</h2>
          <ul className="mt-5 grid gap-x-8 md:grid-cols-2">
            {procurados.map((artigo) => (
              <li key={artigo.id} className="border-b border-line">
                <Link
                  href={`/ajuda/${artigo.id}`}
                  className="group flex items-center gap-3 py-4 text-[15px] text-soft transition hover:text-primary"
                >
                  <span aria-hidden className="text-dim group-hover:text-primary">
                    <IconeArtigo />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink group-hover:text-primary">{artigo.titulo}</span>
                    <span className="mt-0.5 block text-[13px] text-dim">{categoriaDe(artigo).titulo}</span>
                  </span>
                  <span aria-hidden className="text-dim transition group-hover:translate-x-0.5 group-hover:text-primary">
                    <IconeSeta />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <section className="mt-12 grid items-center gap-8 overflow-hidden rounded-[22px] border border-line p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink">Para desenvolvedores</h2>
              <p className="mt-2 max-w-[48ch] text-[14.5px] leading-[1.65] text-muted">
                Integre o seu sistema: envie eventos que abrem conversas no WhatsApp, chame a sua API
                no meio do atendimento e instale o chat no seu site.
              </p>
              <ul className="mt-5 space-y-1">
                {[
                  { href: '/ajuda/desenvolvedores/disparar-evento', rotulo: 'Disparar um evento', metodo: 'POST' as const },
                  { href: '/ajuda/desenvolvedores/assinatura', rotulo: 'Assinar a requisição' },
                  { href: '/ajuda/desenvolvedores/chamar-seu-sistema', rotulo: 'Chamar o seu sistema' },
                  { href: '/ajuda/desenvolvedores/chat-do-site', rotulo: 'Instalar o chat do site' },
                ].map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="group flex items-center gap-3 rounded-lg py-1.5 text-[14px] font-medium text-soft transition hover:text-primary">
                      <span className="w-12">{item.metodo ? <SeloDeMetodo metodo={item.metodo} pequeno /> : null}</span>
                      {item.rotulo}
                      <span aria-hidden className="text-dim transition group-hover:translate-x-0.5 group-hover:text-primary">
                        <IconeSeta />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/ajuda/desenvolvedores/visao-geral"
                className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-[13.5px] font-semibold text-primary-ink transition hover:bg-primary-strong"
              >
                Abrir a documentação
              </Link>
            </div>
            <BlocoDeCodigo
              titulo="Disparar um evento"
              trechos={[
                {
                  rotulo: 'cURL',
                  linguagem: 'shell',
                  codigo: 'curl --request POST \\\n  --url https://autofluxos.4yu.com.br/api/webhook/entrada/SEU_CLIENTE_ID \\\n  --header "x-autofluxos-assinatura: sha256=$assinatura" \\\n  --data \'{"evento":"vaga.aberta","telefone":"5511999998888"}\'',
                },
              ]}
            />
          </section>

          <FaleComAGente />
        </div>
      </main>
    </>
  )
}
