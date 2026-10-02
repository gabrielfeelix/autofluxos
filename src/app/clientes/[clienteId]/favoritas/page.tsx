import Link from 'next/link'
import { IlustracaoGuardadas } from '@/components/design/ilustracoes'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { acharCliente } from '@/server/repos/clientes'
import { listarFavoritas } from '@/server/repos/marcadores'
import { exigirAcessoAoCliente } from '@/server/sessao'
import { quando } from '@/lib/quando'

export const dynamic = 'force-dynamic'

/**
 * As mensagens que **eu** guardei, nesta conta.
 *
 * ---------------------------------------------------------------------------
 * Por que é uma tela, e não um filtro do Inbox
 * ---------------------------------------------------------------------------
 *
 * Guardar mensagem não recorta a fila: o que se guarda são bolhas soltas de
 * conversas diferentes, o endereço que o cliente mandou, o número do pedido, o
 * combinado que vai ser cobrado depois. Um filtro do Inbox teria que responder
 * "quais conversas têm mensagem guardada", que é uma pergunta pior: ela devolve
 * a conversa e esconde justamente a linha que a pessoa marcou.
 *
 * Por isso a lista é de **mensagens**, cada uma com o caminho de volta para a
 * conversa onde ela aconteceu.
 *
 * ---------------------------------------------------------------------------
 * Por que ela não tem item próprio na barra lateral
 * ---------------------------------------------------------------------------
 *
 * É um bolso do Inbox, não uma seção do produto: quem entra aqui veio de lá e
 * volta para lá. `ativa="inbox"` mantém o Inbox aceso na barra, que é onde a
 * pessoa está mesmo trabalhando. A porta de entrada é a estrela no cabeçalho da
 * fila.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params

  /*
   * O acesso é conferido aqui, e não só pelo layout, porque esta tela devolve
   * **conteúdo de conversa**, o texto que a pessoa guardou. É o mesmo cuidado
   * das outras leituras do Inbox.
   */
  const { sessao } = await exigirAcessoAoCliente(clienteId)

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const favoritas = await listarFavoritas(sessao.usuario.id, clienteId)

  return (
    <ClienteShell cliente={cliente} ativa="inbox">
      {/*
        Largura cheia e cartão com cabeçalho, como Transmissões e Respostas
        rápidas: era uma coluna de 900px com uma caixa tracejada, e a tela
        parecia de outro produto ao lado das vizinhas (02/out/2026).
      */}
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <h1 className="mb-1 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Mensagens guardadas
        </h1>
        {/* Uma linha, como o dono pediu para todo cabeçalho desta casa. */}
        <p className="mb-6 text-[13px] leading-6 text-dim">
          O que você marcou com a estrela. Só você vê esta lista.
        </p>

        <section className="app-card overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-[14.5px] font-bold">Guardadas por você</h2>
              <p className="mt-0.5 text-[12px] leading-5 text-dim">
                {favoritas.length === 0
                  ? 'A estrela fica embaixo de cada mensagem, no Inbox.'
                  : `${favoritas.length} ${favoritas.length === 1 ? 'mensagem' : 'mensagens'}. Clique para abrir a conversa.`}
              </p>
            </div>
            <Link href={`/clientes/${clienteId}/inbox`} className="app-primary-button inline-flex h-9 shrink-0 items-center px-4 text-[13px]">
              Ir para o Inbox
            </Link>
          </header>

          {favoritas.length === 0 ? (
            /*
              O vazio explica **o gesto**, e não a ausência: quem chegou aqui
              provavelmente não sabe onde fica a estrela.
            */
            <div className="px-5 py-14 text-center">
              <IlustracaoGuardadas />
              <p className="mt-6 text-[13.5px] font-semibold text-soft">Nada guardado ainda</p>
              <p className="mx-auto mt-1.5 max-w-[440px] text-[12.5px] leading-5 text-dim">
                Serve para o endereço que o cliente mandou, o número do pedido, o combinado
                que você vai precisar achar semana que vem.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {favoritas.map((favorita) => (
                <li key={favorita.mensagemId}>
                  {/*
                    A linha inteira é o caminho de volta: o `?conversa=` é o
                    endereço que a fila usa, então clicar abre a conversa no
                    Inbox, com o que veio antes da frase guardada.
                  */}
                  <Link
                    href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(favorita.contatoId)}`}
                    className="block px-5 py-3.5 transition hover:bg-surface"
                  >
                    <span className="flex items-baseline gap-2">
                      <strong className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {favorita.nomeDoContato ?? favorita.waId}
                      </strong>
                      {/*
                        Quem falou, porque a mesma frase muda de sentido conforme
                        a direção: "pode ser amanhã" dito pelo cliente é um
                        pedido, e dito por nós é uma promessa.
                      */}
                      <small className="shrink-0 text-[11px] text-muted">
                        {favorita.direcao === 'entrada' ? 'recebida' : 'enviada'} ·{' '}
                        {quando(favorita.ts)}
                      </small>
                    </span>
                    <p className="mt-1 line-clamp-3 font-texto text-[13.5px] leading-[1.45] whitespace-pre-wrap text-soft">
                      {favorita.texto ?? 'mensagem sem texto'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </ClienteShell>
  )
}
