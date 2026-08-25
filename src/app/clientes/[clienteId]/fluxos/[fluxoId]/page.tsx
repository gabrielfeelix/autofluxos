import { notFound } from 'next/navigation'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { Editor } from '@/components/editor/editor'
import { variaveisDoFluxo } from '@/core/flow/variaveis'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoes } from '@/server/repos/conexoes'
import { listarQuadros } from '@/server/repos/quadros'
import { acharFluxo, acharVersao, listarFluxos, listarVersoes } from '@/server/repos/fluxos'
import { ehAdminDaPlataforma, exigirAcessoAoCliente } from '@/server/sessao'

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

  const [cliente, fluxo, conexoes, quadros, fluxosDaConta] = await Promise.all([
    acharCliente(clienteId),
    acharFluxo(fluxoId),
    listarConexoes(clienteId),
    listarQuadros(clienteId),
    listarFluxos(clienteId),
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
  const acesso = await exigirAcessoAoCliente(cliente.id)

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
        /* Volta para a lista de automações, e não para o painel: quem sai de
           um fluxo quase sempre vai abrir outro, ou a palavra-chave dele. Voltar
           para o painel jogava a pessoa dois cliques longe do que ela estava
           fazendo. */
        voltarHref={`/clientes/${cliente.id}/fluxos`}
        inicial={fluxo.rascunho}
        canal={fluxo.canal}
        iaHabilitada={fluxo.iaHabilitada}
        /* Contratar a Etapa 2 é decisão comercial da 4YU. Para a conta, o
           contrato é estado — ver o cabeçalho do editor. */
        podeContratarIa={ehAdminDaPlataforma(acesso.sessao)}
        contextoNegocio={cliente.contextoNegocio}
        temContextoDeNegocio={cliente.contextoNegocio.trim() !== ''}
        conexoes={conexoes}
        /* As outras automações desta conta, para o bloco "Ir para outra
           automação". O próprio fluxo entra na lista: recomeçar do zero é
           desenho legítimo, e quem barra o laço infinito é a trava de saltos do
           servidor. */
        fluxos={fluxosDaConta.map((f) => ({
          id: f.id,
          nome: f.nome,
          publicado: f.versaoPublicadaId !== null,
          ativo: f.ativo,
        }))}
        /* O que as **outras** automações guardam no contato.

           O que um fluxo grava fica no contato e continua lá na conversa
           seguinte, então um pode ler o que o outro escreveu. Sem esta lista, o
           editor fingia que só existe o que este desenho cria, e quem quisesse
           usar `{{plano}}` — gravado no fluxo de matrícula — digitava de cabeça.
           Errar uma letra ali não estoura: a variável vira vazia e a mensagem
           sai com um buraco.

           Sai do desenho das outras, e não de um cadastro à parte: cadastro
           seria uma segunda verdade para manter em dia, e esta lista não tem
           como divergir porque ela é o que os fluxos fazem. */
        variaveisDaConta={[
          ...new Set(
            fluxosDaConta
              .filter((f) => f.id !== fluxo.id)
              .flatMap((f) => variaveisDoFluxo(f.rascunho).nomes),
          ),
        ].sort()}
        /* Achatado aqui, e não no componente: o painel escolhe **uma etapa**, e
           um seletor de dois níveis custaria dois cliques para uma escolha só.
           O nome do quadro entra como prefixo porque duas etapas "Fechado" em
           funis diferentes são indistinguíveis sem ele. */
        etapas={quadros.flatMap((quadro) =>
          quadro.etapas.map((etapa) => ({
            quadroId: quadro.id,
            colunaId: etapa.id,
            rotulo: `${quadro.nome} · ${etapa.nome}`,
          })),
        )}
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
