import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { ClienteShell } from '@/components/design/cliente-shell'
import { LogoInstagram, LogoSite, LogoTelegram, LogoWhatsApp } from '@/components/design/logos-de-marca'
import { idadeDoEvento, seloDaConexao } from '@/core/conexoes'
import { catalogoDeIntegracoes, type ItemDoCatalogo } from '@/server/catalogo-de-integracoes'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

const LOGO: Record<string, ReactNode> = {
  whatsapp: <LogoWhatsApp />,
  instagram: <LogoInstagram />,
  telegram: <LogoTelegram />,
  site: <LogoSite />,
}

/**
 * Conversas > Canais: um cartão por canal, com a saúde à vista (plano de
 * navegação, 5.5).
 *
 * WhatsApp e Instagram moravam em Configurações, e o que alguém vai procurar
 * lá é "o número está recebendo?", que é pergunta de quem atende, não de quem
 * ajusta. O estado vem do mesmo `catalogoDeIntegracoes` de Conexões, em
 * camadas (cadastro, autorização, último evento, falha), para as duas telas
 * nunca discordarem. O detalhe técnico continua dentro de cada canal.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const canais = (await catalogoDeIntegracoes(cliente.id)).filter((item) => item.categoria === 'Canal')

  return (
    <ClienteShell cliente={cliente} ativa="canais">
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Canais</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Por onde as conversas chegam. Cada cartão diz se o canal está conectado, quando chegou a última mensagem e o
          que fazer se algo parou.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {canais.map((item) => (
            <CartaoDoCanal key={item.chave} clienteId={cliente.id} item={item} />
          ))}
        </div>
      </main>
    </ClienteShell>
  )
}

function CartaoDoCanal({ clienteId, item }: { clienteId: string; item: ItemDoCatalogo }) {
  const { estado } = item
  const selo = item.disponivel ? seloDaConexao(estado) : { texto: 'em breve', tom: 'neutro' as const }
  const acao = !item.href || !item.disponivel
    ? null
    : estado.proximaAcao && (estado.falha || !estado.configurado)
      ? estado.proximaAcao
      : { texto: estado.configurado ? 'Abrir o canal' : `Conectar o ${item.nome}`, href: item.href }

  return (
    <section className={`app-card flex flex-col p-5 ${item.disponivel ? '' : 'opacity-65'}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        {LOGO[item.chave]}
        <Selo tom={selo.tom}>{selo.texto}</Selo>
      </div>
      <h2 className="text-[15px] font-bold tracking-[-0.01em]">{item.nome}</h2>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">{item.descricao}</p>

      {estado.configurado && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 rounded-[12px] border border-line bg-surface px-4 py-3 text-[12.5px]">
          <dt className="text-dim">Cadastro</dt>
          <dd className="font-semibold">feito</dd>
          {estado.autorizacao !== 'nao_se_aplica' && (
            <>
              <dt className="text-dim">Autorização</dt>
              <dd className={`font-semibold ${estado.autorizacao === 'vencida' ? 'text-perigo' : estado.autorizacao === 'vence_em_breve' ? 'text-aviso' : ''}`}>
                {estado.autorizacao === 'vencida' ? 'vencida' : estado.autorizacao === 'vence_em_breve' ? 'vence em breve' : 'válida'}
              </dd>
            </>
          )}
          <dt className="text-dim">Última mensagem</dt>
          <dd className="font-semibold">{idadeDoEvento(estado.ultimoEvento)}</dd>
        </dl>
      )}
      {estado.configurado && estado.falha && (
        <p className="mt-3 rounded-[10px] bg-perigo/10 px-3 py-2 text-[12px] leading-5 font-semibold text-perigo">{estado.falha}</p>
      )}
      {item.emBreve && <p className="mt-3 text-[12px] leading-5 text-dim">{item.emBreve}</p>}

      <span className="min-h-4 flex-1" />
      {acao && (
        <Link
          href={`/clientes/${clienteId}${acao.href}`}
          className={`mt-2 inline-flex items-center justify-center gap-1 self-start rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold transition ${
            estado.falha || !estado.configurado
              ? 'bg-primary text-white hover:bg-primary-strong'
              : 'border border-line text-ink hover:bg-surface'
          }`}
        >
          {acao.texto} <span aria-hidden>›</span>
        </Link>
      )}
    </section>
  )
}

function Selo({ children, tom }: { children: ReactNode; tom: 'ok' | 'alerta' | 'perigo' | 'neutro' }) {
  const cor = {
    ok: 'border-emerald-400/25 bg-emerald-400/[0.08] text-ok',
    alerta: 'border-amber-300/30 bg-amber-300/[0.1] text-aviso',
    perigo: 'border-rose-400/30 bg-rose-400/[0.09] text-perigo',
    neutro: 'border-line bg-surface text-muted',
  }[tom]
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${cor}`}>{children}</span>
}
