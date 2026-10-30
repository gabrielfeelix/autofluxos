import { notFound } from 'next/navigation'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Trilha } from '@/components/design/trilha'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import { acaoConectarTelegram, acaoDesligarTelegram } from '@/server/acoes-telegram'
import { acharCliente } from '@/server/repos/clientes'
import { canalDoTelegram } from '@/server/repos/canais-telegram'

export const dynamic = 'force-dynamic'

const RESULTADOS: Record<string, { tom: 'bom' | 'ruim'; texto: string }> = {
  conectado: { tom: 'bom', texto: 'Bot ligado. As mensagens que ele receber chegam no Inbox.' },
  desligado: { tom: 'bom', texto: 'Bot desligado. Ele parou de mandar mensagens para cá.' },
  token_invalido: { tom: 'ruim', texto: 'Isso não parece um token do @BotFather. Ele tem números, dois pontos e uma sequência longa de letras.' },
  token_recusado: { tom: 'ruim', texto: 'O Telegram não reconheceu este token. Copie de novo do @BotFather, ou gere outro com /token.' },
  de_outra_conta: { tom: 'ruim', texto: 'Este bot já está ligado a outra conta do Dialogon.' },
  sem_webhook: { tom: 'ruim', texto: 'O Telegram recusou o endereço de entrega. Nada ficou ligado; tente de novo em alguns minutos.' },
  falhou: { tom: 'ruim', texto: 'Não foi possível ligar o bot. O detalhe está em Alertas, na administração.' },
}

const PASSOS = [
  'No Telegram, abra o @BotFather e mande /newbot.',
  'Escolha o nome que os clientes vão ver e um @ terminado em "bot".',
  'Copie o token que ele devolve e cole aqui.',
]

/**
 * O canal do Telegram (0140). Conectar é colar o token do @BotFather: não há
 * login de outra empresa no meio, nem aprovação, nem custo por mensagem.
 */
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

  const canal = await canalDoTelegram(clienteId)
  const aviso = resultado ? RESULTADOS[resultado] : undefined

  return (
    <ClienteShell cliente={cliente} ativa="canais">
      <main className="w-full max-w-[820px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
        <Trilha caminho={[{ rotulo: 'Canais', href: `/clientes/${cliente.id}/conversas/canais` }, { rotulo: 'Telegram' }]} />
        <CabecalhoDaTela titulo="Telegram" descricao={DEFINICAO_DO_CANAL.telegram.resumo} />

        {aviso && (
          <p
            className={`mb-5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] ${
              aviso.tom === 'bom' ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-ok' : 'border-amber-400/25 bg-amber-400/[0.07] text-aviso'
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
                <p className="text-[14px] font-semibold text-soft">{canal.tgUsername ? `@${canal.tgUsername}` : 'Bot ligado'}</p>
                <p className="mt-0.5 text-[12px] text-dim">
                  {canal.tgUsername ? (
                    <a href={`https://t.me/${canal.tgUsername}`} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                      t.me/{canal.tgUsername}
                    </a>
                  ) : (
                    `bot ${canal.tgBotId}`
                  )}{' '}
                  · divulgue este link para os clientes falarem com o bot
                </p>
              </div>
              <form action={acaoDesligarTelegram}>
                <input type="hidden" name="clienteId" value={clienteId} />
                <button
                  type="submit"
                  className="rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold text-dim transition hover:bg-rose-400/[0.08] hover:text-perigo"
                >
                  Desligar
                </button>
              </form>
            </div>
            <p className="mt-4 border-t border-line pt-3.5 text-[12px] leading-5 text-dim">
              O bot responde só em conversa particular. Em grupo ele não lê nada, para ninguém virar contato sem ter falado com a empresa.
            </p>
          </section>
        ) : (
          <section className="app-card px-5 py-6">
            <p className="text-[14px] font-semibold text-soft">Nenhum bot ligado</p>
            <ol className="mt-3 space-y-1.5">
              {PASSOS.map((passo, i) => (
                <li key={passo} className="flex gap-2.5 text-[12.5px] leading-5 text-dim">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-line/60 text-[11px] font-semibold text-soft">{i + 1}</span>
                  {passo}
                </li>
              ))}
            </ol>
            <form action={acaoConectarTelegram} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="clienteId" value={clienteId} />
              <input
                name="token"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="Exemplo: 123456789:AAH4k..."
                aria-label="Token do @BotFather"
                className="app-field min-w-0 flex-1 px-[13px] py-[10px] font-mono text-[13px]"
              />
              <button type="submit" className="botao-primario botao-md shrink-0">
                Ligar o bot
              </button>
            </form>
            <p className="mt-2 text-[11.5px] leading-4 text-dim">O token fica guardado no cofre, e ninguém da equipe consegue vê-lo depois.</p>
          </section>
        )}
      </main>
    </ClienteShell>
  )
}
