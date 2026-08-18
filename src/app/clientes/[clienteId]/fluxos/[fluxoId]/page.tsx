import { notFound } from 'next/navigation'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { Editor } from '@/components/editor/editor'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoes } from '@/server/repos/conexoes'
import { acharFluxo, acharVersao, listarVersoes } from '@/server/repos/fluxos'
import { exigirAcessoAoCliente } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * Formatado aqui, no servidor, e não no editor: data relativa calculada no
 * cliente diverge do que o servidor renderizou (fuso e relógio diferentes) e o
 * React reclama de hidratação. O editor só exibe a string pronta.
 */
function quando(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas}h`

  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string; fluxoId: string }>
}) {
  const { clienteId, fluxoId } = await params

  const [cliente, fluxo, conexoes] = await Promise.all([
    acharCliente(clienteId),
    acharFluxo(fluxoId),
    listarConexoes(clienteId),
  ])
  if (!cliente || !fluxo || fluxo.clienteId !== cliente.id) notFound()

  /**
   * O editor não usa a moldura do cliente — é tela cheia por natureza —, então
   * ele faz por conta própria as duas coisas que ela faria: conferir quem pode
   * ver esta conta e mostrar a faixa de impersonação.
   *
   * **É a tela onde esquecer isso custa mais caro.** Publicar aqui muda o que o
   * WhatsApp de um cliente responde para gente de verdade; fazê-lo achando que
   * está na própria conta é o erro que a faixa existe para impedir.
   */
  await exigirAcessoAoCliente(cliente.id)

  // O histórico vem junto do desenho: abrir o editor é o único lugar de onde
  // alguém decide voltar atrás, e uma segunda ida ao banco só ao clicar deixaria
  // o botão "Histórico" mentindo sobre existir versão para escolher.
  const [publicada, versoes] = await Promise.all([
    fluxo.versaoPublicadaId ? acharVersao(fluxo.versaoPublicadaId) : null,
    listarVersoes(fluxo.id),
  ])

  return (
    <>
      <FaixaDeImpersonacao />
      <Editor
        fluxoId={fluxo.id}
        clienteId={cliente.id}
        nome={fluxo.nome}
        clienteNome={cliente.nome}
        voltarHref={`/clientes/${cliente.id}`}
        inicial={fluxo.rascunho}
        iaHabilitada={fluxo.iaHabilitada}
        contextoNegocio={cliente.contextoNegocio}
        temContextoDeNegocio={cliente.contextoNegocio.trim() !== ''}
        conexoes={conexoes}
        publicadaInicial={
          publicada
            ? {
                id: publicada.id,
                versao: publicada.versao,
                quando: quando(publicada.publicadoEm),
                grafo: publicada.grafo,
              }
            : null
        }
        versoesIniciais={versoes.map((v) => ({
          id: v.id,
          versao: v.versao,
          quando: quando(v.publicadoEm),
        }))}
      />
    </>
  )
}
