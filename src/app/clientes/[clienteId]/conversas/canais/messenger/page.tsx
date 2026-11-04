import { notFound } from 'next/navigation'
import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { ClienteShell } from '@/components/design/cliente-shell'
import { LogoFacebook } from '@/components/design/logos-de-marca'
import { Trilha } from '@/components/design/trilha'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import { acaoConectarMessenger, acaoDesligarMessenger, acaoEscolherPagina } from '@/server/acoes-messenger'
import { paginasComToken } from '@/server/messenger/conexao'
import { lerEscolhaPendente } from '@/server/messenger/ligar'
import { acharCliente } from '@/server/repos/clientes'
import { canalDoMessenger } from '@/server/repos/canais-messenger'

export const dynamic = 'force-dynamic'

const RESULTADOS: Record<string, { tom: 'bom' | 'ruim'; texto: string }> = {
  conectado: { tom: 'bom', texto: 'Página ligada. As mensagens do Messenger e os comentários chegam no Inbox.' },
  desligado: { tom: 'bom', texto: 'Página desligada. As mensagens dela pararam de chegar aqui.' },
  escolher: { tom: 'bom', texto: 'Você liberou mais de uma página. Escolha qual atende por esta conta.' },
  sem_pagina: { tom: 'ruim', texto: 'Nenhuma página foi liberada. Conecte de novo e marque a página na tela do Facebook.' },
  de_outra_conta: { tom: 'ruim', texto: 'Esta página já está ligada a outra conta do Dialogon.' },
  cancelado: { tom: 'ruim', texto: 'A conexão foi cancelada no Facebook. Nada mudou.' },
  expirou: { tom: 'ruim', texto: 'A escolha expirou. Conecte de novo para ver as páginas.' },
  acesso: { tom: 'ruim', texto: 'Você não tem acesso para ligar canais nesta conta.' },
  falhou: { tom: 'ruim', texto: 'Não foi possível ligar a página. O detalhe está em Alertas, na administração.' },
}

const PASSOS = [
  'Clique em Conectar com o Facebook e entre com quem administra a página.',
  'Marque a página da empresa e aceite as permissões.',
  'Pronto: as mensagens do Messenger chegam no Inbox e seguem as automações do WhatsApp.',
]

/**
 * O canal do Messenger (0163). Conectar é o Facebook Login: a pessoa escolhe
 * a página, e o token da página vai para o cofre.
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

  const canal = await canalDoMessenger(clienteId)
  const tokenDaEscolha = resultado === 'escolher' ? await lerEscolhaPendente(clienteId) : null
  const paginas = tokenDaEscolha ? await paginasComToken(tokenDaEscolha) : []
  const aviso = resultado ? RESULTADOS[resultado] : undefined

  return (
    <ClienteShell cliente={cliente} ativa="canais">
      <main className="w-full max-w-[820px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
        <Trilha caminho={[{ rotulo: 'Canais', href: `/clientes/${cliente.id}/conversas/canais` }, { rotulo: 'Messenger' }]} />
        <CabecalhoDaTela titulo="Messenger" descricao={DEFINICAO_DO_CANAL.messenger.resumo} />

        {aviso && (
          <p
            className={`mb-5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] ${
              aviso.tom === 'bom' ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-ok' : 'border-amber-400/25 bg-amber-400/[0.07] text-aviso'
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {paginas.length > 0 && (
          <section className="app-card mb-5 px-5 py-5">
            <p className="text-[14px] font-semibold text-soft">Qual página atende por esta conta?</p>
            <ul className="mt-3 divide-y divide-line">
              {paginas.map((pagina) => (
                <li key={pagina.id} className="flex items-center gap-3 py-3">
                  <LogoFacebook />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{pagina.nome || 'Página sem nome'}</p>
                    <p className="text-[11.5px] text-dim">página {pagina.id}</p>
                  </div>
                  <form action={acaoEscolherPagina}>
                    <input type="hidden" name="clienteId" value={clienteId} />
                    <input type="hidden" name="pageId" value={pagina.id} />
                    <button type="submit" className="botao-primario botao-md">
                      Usar esta
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {canal ? (
          <section className="app-card px-5 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <LogoFacebook />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-soft">
                  <span className="size-[9px] shrink-0 rounded-full bg-emerald-400" />
                  {canal.fbPageNome ?? 'Página ligada'}
                </p>
                <p className="mt-0.5 text-[12px] text-dim">
                  <a
                    href={`https://m.me/${canal.fbPageId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    m.me/{canal.fbPageId}
                  </a>{' '}
                  · o link que abre a conversa com a página
                </p>
              </div>
              <form action={acaoConectarMessenger}>
                <input type="hidden" name="clienteId" value={clienteId} />
                <button type="submit" className="botao-secundario botao-md">
                  Trocar de página
                </button>
              </form>
              <form action={acaoDesligarMessenger}>
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
              A página roda as mesmas automações do WhatsApp desta conta. A resposta automática vale por 24 horas depois da
              última mensagem da pessoa, regra da Meta para o Messenger.
            </p>
          </section>
        ) : (
          <section className="app-card px-5 py-6">
            <p className="text-[14px] font-semibold text-soft">Nenhuma página ligada</p>
            <ol className="mt-3 space-y-1.5">
              {PASSOS.map((passo, i) => (
                <li key={passo} className="flex gap-2.5 text-[12.5px] leading-5 text-dim">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-line/60 text-[11px] font-semibold text-soft">
                    {i + 1}
                  </span>
                  {passo}
                </li>
              ))}
            </ol>
            <form action={acaoConectarMessenger} className="mt-5">
              <input type="hidden" name="clienteId" value={clienteId} />
              <button type="submit" className="botao-primario botao-md">
                Conectar com o Facebook
              </button>
            </form>
            <p className="mt-2 text-[11.5px] leading-4 text-dim">
              O token da página fica guardado no cofre, e ninguém da equipe consegue vê-lo depois.
            </p>
          </section>
        )}
      </main>
    </ClienteShell>
  )
}
