import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import { acaoConectarInstagram, acaoDesligarInstagram } from '@/server/acoes-instagram'
import { ESCOPOS, instagramConfigurado } from '@/server/instagram/conexao'
import { acharCliente } from '@/server/repos/clientes'
import { canalDoInstagram, diasAteVencer } from '@/server/repos/canais-instagram'

export const dynamic = 'force-dynamic'

/**
 * Ligar o direct do Instagram a esta conta.
 *
 * **A tela existe antes de o produto poder ser vendido**, e isso é escolha, não
 * descuido. As duas permissões de mensagem estão em Standard Access até o app
 * review passar, e em Standard o Business Login só embarca contas da nossa
 * própria conta da Meta. Tudo daqui funciona hoje com a nossa conta de teste;
 * o que muda depois da aprovação é *de quem* pode ser a conta, e nada no
 * código.
 *
 * Esconder a tela até lá pareceria mais honesto e seria pior: é assim que se
 * descobre, no dia da aprovação, que a integração inteira ainda precisa ser
 * escrita.
 */

const RESULTADOS: Record<string, { tom: 'bom' | 'ruim'; texto: string }> = {
  conectado: { tom: 'bom', texto: 'Conta ligada. Os direct já chegam no Inbox.' },
  cancelado: {
    tom: 'ruim',
    texto: 'A autorização foi cancelada na tela do Instagram. Nada mudou por aqui.',
  },
  falhou: {
    tom: 'ruim',
    texto: 'A Meta recusou a conexão. O detalhe está em Alertas, na administração.',
  },
  sem_codigo: {
    tom: 'ruim',
    texto: 'O Instagram devolveu sem o código de autorização. Tente conectar de novo.',
  },
  sem_app: {
    tom: 'ruim',
    texto: 'Este ambiente não tem o app do Instagram configurado (INSTAGRAM_APP_ID).',
  },
}

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ resultado?: string }>
}) {
  const { clienteId } = await params
  const { resultado } = await searchParams

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const canal = await canalDoInstagram(clienteId)
  const configurado = instagramConfigurado()
  const dias = diasAteVencer(canal?.tokenExpiraEm ?? null)
  const aviso = resultado ? RESULTADOS[resultado] : undefined

  return (
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="w-full max-w-[820px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
        <header className="mb-7">
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">Instagram</h1>
          <p className="mt-1 text-[13px] text-muted">
            {DEFINICAO_DO_CANAL.instagram.resumo}
          </p>
        </header>

        {aviso && (
          <p
            className={`mb-5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] ${
              aviso.tom === 'bom'
                ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200'
                : 'border-amber-400/25 bg-amber-400/[0.07] text-amber-200'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {canal ? (
          <section className="app-card px-5 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="size-[9px] shrink-0 rounded-full bg-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-soft">
                  {canal.igUsername ? `@${canal.igUsername}` : 'Conta ligada'}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-dim">conta {canal.igUserId}</p>
              </div>

              <form action={acaoDesligarInstagram}>
                <input type="hidden" name="clienteId" value={clienteId} />
                <button
                  type="submit"
                  className="rounded-[9px] border border-white/10 px-3 py-2 text-[12.5px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-rose-300"
                >
                  Desligar
                </button>
              </form>
            </div>

            {/*
             * O prazo do token não é detalhe técnico escondido num log: ele
             * vence em 60 dias e, vencido, só o dono do perfil resolve — na
             * frente da tela, autorizando de novo. Quem opera precisa ver isso
             * chegando, e não descobrir pelo cliente reclamando que o
             * Instagram parou.
             */}
            {dias !== null && (
              <p
                className={`mt-4 border-t border-white/[0.06] pt-3.5 text-[12px] ${
                  dias <= 7 ? 'text-amber-300' : 'text-dim'
                }`}
              >
                {dias <= 0
                  ? 'O acesso venceu. Conecte de novo para voltar a receber os direct.'
                  : `O acesso vale por mais ${dias} ${dias === 1 ? 'dia' : 'dias'}. A renovação é automática enquanto ele estiver vivo.`}
              </p>
            )}
          </section>
        ) : (
          <section className="app-card px-5 py-6">
            <p className="text-[14px] font-semibold text-soft">Nenhuma conta ligada</p>
            <p className="mt-1.5 max-w-lg text-[12.5px] leading-6 text-dim">
              Conectar abre a tela do Instagram, onde o dono do perfil autoriza. A conta precisa
              ser <strong className="text-muted">profissional</strong> (comercial ou de criador) —
              perfil pessoal não recebe mensagem por API.
            </p>

            <ul className="mt-4 space-y-1.5">
              {ESCOPOS.map((escopo) => (
                <li key={escopo} className="flex gap-2 text-[12px] text-dim">
                  <span aria-hidden className="text-accent">
                    ·
                  </span>
                  <code className="font-mono">{escopo}</code>
                </li>
              ))}
            </ul>

            <form action={acaoConectarInstagram} className="mt-5">
              <input type="hidden" name="clienteId" value={clienteId} />
              <button
                type="submit"
                disabled={!configurado}
                className="rounded-[9px] bg-accent px-4 py-2.5 text-[13px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Conectar conta do Instagram
              </button>
            </form>

            {!configurado && (
              <p className="mt-3 text-[12px] text-amber-300">
                Falta <code className="font-mono">INSTAGRAM_APP_ID</code> e{' '}
                <code className="font-mono">INSTAGRAM_APP_SECRET</code> no ambiente deste servidor.
              </p>
            )}
          </section>
        )}

        {/*
         * A fila da Meta, escrita na tela e não só no doc.
         *
         * A pergunta "já dá para vender?" tem resposta diferente para o nosso
         * perfil e para o do cliente, e é a segunda que importa comercialmente.
         * Deixar isso implícito é o caminho para alguém prometer numa reunião
         * o que a permissão ainda não permite.
         */}
        <section className="mt-5 rounded-[12px] border border-white/[0.06] bg-white/[0.014] px-5 py-4">
          <p className="text-[12.5px] font-semibold text-muted">Enquanto o app review não sai</p>
          <p className="mt-1.5 text-[12px] leading-6 text-dim">
            As permissões de mensagem estão em <strong>Standard Access</strong>. Nesse estágio o
            Instagram só embarca contas ligadas à própria conta da Meta da 4YU — dá para atender no
            nosso perfil, não no do cliente. Quando o <strong>Advanced Access</strong> for aprovado,
            esta mesma tela passa a aceitar a conta de qualquer cliente, sem mudar nada aqui.
          </p>
        </section>
      </main>
    </ClienteShell>
  )
}
