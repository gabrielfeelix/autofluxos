import { CabecalhoDaTela, Contagem } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import Link from 'next/link'
import { IlustracaoGuardadas } from '@/components/design/ilustracoes'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { acharCliente } from '@/server/repos/clientes'
import { listarFavoritas } from '@/server/repos/marcadores'
import { exigirAcessoAoCliente } from '@/server/sessao'
import { horaExata, quando } from '@/lib/quando'
import { Avatar } from '@/components/inbox/avatar'
import { COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA, Tabela, Th } from '@/components/design/tabela'
import { telefoneLegivel } from '@/core/contatos/telefone'

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
      <Miolo largura="cheia">
        {/* Uma linha, como o dono pediu para todo cabeçalho desta casa. */}
        <CabecalhoDaTela
          titulo="Mensagens guardadas"
          contagem={
            favoritas.length > 0 && (
              <Contagem>
                {favoritas.length} {favoritas.length === 1 ? 'mensagem' : 'mensagens'}
              </Contagem>
            )
          }
          descricao="O que você marcou com a estrela. Só você vê esta lista."
          acoes={
            <Link href={`/clientes/${clienteId}/inbox`} className="quadro-tool">
              Ir para o Inbox
            </Link>
          }
        />

        {favoritas.length === 0 ? (
          <section className="app-card overflow-hidden">
            {/*
              O vazio explica **o gesto**, e não a ausência: quem chegou aqui
              provavelmente não sabe onde fica a estrela.
            */}
            <div className="px-5 py-14 text-center">
              <IlustracaoGuardadas />
              <p className="mt-6 text-[13.5px] font-semibold text-soft">Nada guardado ainda</p>
              <p className="mx-auto mt-1.5 max-w-[440px] text-[12.5px] leading-5 text-dim">
                Serve para o endereço que o cliente mandou, o número do pedido, o combinado
                que você vai precisar achar semana que vem.
              </p>
            </div>
          </section>
        ) : (
          /*
            Tabela, como Contatos: a lista abria cada linha com o nome de perfil
            do WhatsApp, e perfil que é só um emoji ("🥇") não dizia de quem era
            a mensagem. Agora quem, com telefone, o que, de que lado e quando.
          */
          <Tabela largura={860}>
            <thead>
              <tr className="border-b border-line">
                <Th fixa>Contato</Th>
                <Th>Mensagem</Th>
                <Th>Quem falou</Th>
                <Th>Quando</Th>
                <Th className="w-36">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {favoritas.map((favorita) => {
                /*
                  O `?conversa=` é o endereço que a fila usa, e o `&mensagem=`
                  leva a conversa até a frase guardada, com o que veio antes.
                */
                const conversa = `/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(favorita.contatoId)}&mensagem=${encodeURIComponent(favorita.mensagemId)}`
                const telefone = telefoneLegivel(favorita.waId)
                return (
                  <tr key={favorita.mensagemId} className={`group border-b border-line align-top last:border-0 ${FUNDO_DA_LINHA}`}>
                    <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                      <Link href={conversa} className="flex items-center gap-2.5">
                        <Avatar nome={favorita.nomeDoContato ?? telefone} tamanho={32} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink group-hover:text-primary">
                            {favorita.nomeDoContato ?? telefone}
                          </span>
                          {favorita.nomeDoContato && (
                            <span className="block truncate text-[11.5px] text-dim tabular-nums">{telefone}</span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="min-w-[320px] px-4 py-3">
                      <Link href={conversa} className="line-clamp-2 font-texto text-[13px] leading-[1.45] text-soft">
                        {favorita.texto ?? 'mensagem sem texto'}
                      </Link>
                    </td>
                    {/*
                      Quem falou, porque a mesma frase muda de sentido conforme
                      a direção: "pode ser amanhã" dito pelo cliente é um
                      pedido, e dito por nós é uma promessa.
                    */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          favorita.direcao === 'entrada' ? 'bg-surface text-muted' : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {favorita.direcao === 'entrada' ? 'Cliente' : 'Equipe'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap text-dim tabular-nums" title={horaExata(favorita.ts)}>
                      {quando(favorita.ts)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={conversa} className="botao-secundario botao-sm whitespace-nowrap">
                        Abrir conversa
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}
      </Miolo>
    </ClienteShell>
  )
}
