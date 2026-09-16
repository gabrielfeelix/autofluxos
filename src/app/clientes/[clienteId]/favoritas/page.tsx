import Link from 'next/link'
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
      <main className="w-full max-w-[900px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <h1 className="mb-1 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Mensagens guardadas
        </h1>
        {/* Uma linha, como o dono pediu para todo cabeçalho desta casa. */}
        <p className="mb-5 text-[12.5px] leading-5 text-dim">
          O que você marcou com a estrela. Só você vê esta lista.
        </p>

        {favoritas.length === 0 ? (
          /*
            O vazio explica **o gesto**, e não a ausência.
            
            "Nenhuma mensagem guardada" é verdade e não ajuda: quem chegou aqui
            provavelmente não sabe onde fica a estrela. A frase diz onde ela
            está, que é a única coisa que destrava a tela.
          */
          <div className="rounded-[14px] border border-dashed border-strong px-5 py-10 text-center">
            <p className="text-[13px] font-semibold text-soft">Nada guardado ainda</p>
            <p className="mx-auto mt-1.5 max-w-[420px] text-[12px] leading-5 text-dim">
              A estrela fica embaixo de cada mensagem, no Inbox. Serve para o endereço
              que o cliente mandou, o número do pedido, o combinado que você vai
              precisar achar semana que vem.
            </p>
            <Link
              href={`/clientes/${clienteId}/inbox`}
              className="mt-4 inline-block rounded-lg bg-primary px-3.5 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              Ir para o Inbox
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {favoritas.map((favorita) => (
              <li key={favorita.mensagemId}>
                {/*
                  A linha inteira é o caminho de volta.
                  
                  O `?conversa=` é o mesmo endereço que a fila usa, então clicar
                  aqui abre a conversa no Inbox, e não uma tela separada que
                  mostraria a mensagem fora do que veio antes dela. Uma frase
                  guardada sem a conversa em volta costuma não dizer nada.
                */}
                <Link
                  href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(favorita.contatoId)}`}
                  className="block rounded-[12px] border border-line bg-panel px-4 py-3 transition hover:border-primary/40"
                >
                  <span className="flex items-baseline gap-2">
                    <strong className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {favorita.nomeDoContato ?? favorita.waId}
                    </strong>
                    {/*
                      Quem falou, porque a mesma frase muda de sentido conforme
                      a direção: "pode ser amanhã" dito pelo cliente é um pedido,
                      e dito por nós é uma promessa.
                    */}
                    <small className="shrink-0 text-[9.5px] text-muted">
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
      </main>
    </ClienteShell>
  )
}
