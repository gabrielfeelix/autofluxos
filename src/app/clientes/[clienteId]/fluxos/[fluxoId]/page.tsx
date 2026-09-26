import { notFound } from 'next/navigation'
import { voltaInterna } from '@/core/volta-da-ficha'
import { FaixaDeImpersonacao } from '@/components/conta/faixa-impersonacao'
import { FaixaDeSuporte } from '@/components/conta/faixa-de-suporte'
import { Editor } from '@/components/editor/editor'
import { ClienteShell } from '@/components/design/cliente-shell'
import { atrasoDeRevisao } from '@/server/atraso-de-revisao'
import { SemAcesso } from '@/components/design/sem-acesso'
import { capacidadeNaPagina } from '@/server/permissoes'
import { variaveisDoFluxo } from '@/core/flow/variaveis'
import { origemValida } from '@/core/flow/antes-de-publicar'
import { listarCampanhas } from '@/server/repos/campanhas'
import { listarGatilhos } from '@/server/repos/gatilhos'
import { listarGatilhosDeEvento } from '@/server/repos/webhooks-de-entrada'
import { lerPoliticas } from '@/server/ia/politica'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoesParaFluxos } from '@/server/repos/conexoes'
import { lojaDaConta, lojaNuvemshopDaConta } from '@/server/repos/lojas'
import { temProdutoAtivo } from '@/server/repos/produtos'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { membrosDaConta } from '@/server/repos/usuarios'
import { listarQuadros } from '@/server/repos/quadros'
import { acharFluxo, acharVersao, listarFluxos, listarVersoes } from '@/server/repos/fluxos'
import { contarRespostasPorVariavel } from '@/server/repos/respostas'
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
  searchParams,
}: {
  params: Promise<{ clienteId: string; fluxoId: string }>
  searchParams: Promise<{ origem?: string; volta?: string }>
}) {
  await atrasoDeRevisao()
  const { clienteId, fluxoId } = await params
  const pedido = await searchParams
  const origem = origemValida(pedido.origem)
  // Aberto pelo destino de um gatilho, o ‹ volta para aquela aba (Fase 12).
  const volta = voltaInterna(pedido.volta, clienteId)

  // O editor não usa a moldura, então confere a seção por conta própria (E7).
  if (!(await capacidadeNaPagina(clienteId, 'configurar_operacao', 'todos'))) {
    const cliente = await acharCliente(clienteId)
    if (!cliente) notFound()
    return (
      <ClienteShell cliente={cliente} ativa="fluxos">
        <SemAcesso clienteId={clienteId} oQue="Automações" />
      </ClienteShell>
    )
  }

  const [cliente, fluxo, conexoes, quadros, etiquetas, fluxosDaConta, loja, nuvemshop, temCatalogo] = await Promise.all([
    acharCliente(clienteId),
    acharFluxo(fluxoId),
    listarConexoesParaFluxos(clienteId),
    listarQuadros(clienteId),
    listarEtiquetas(clienteId),
    listarFluxos(clienteId),
    lojaDaConta(clienteId),
    lojaNuvemshopDaConta(clienteId),
    temProdutoAtivo(clienteId),
  ])
  if (!cliente || !fluxo || fluxo.clienteId !== cliente.id) notFound()

  /*
   * O selo de "quantas conversas responderam" em cada bloco.
   *
   * Depois do `notFound` e fora do `Promise.all` de propósito: ela depende do
   * fluxo já conferido como sendo desta conta, e é a única consulta daqui que o
   * desenho não precisa para existir. Falhar nela não pode impedir o editor de
   * abrir, e é por isso que o repositório devolve `{}` em vez de estourar.
   */
  const respostasPorVariavel = await contarRespostasPorVariavel(cliente.id, fluxo.id)

  /*
   * A equipe, para o bloco de handoff poder endereçar o aviso a uma pessoa.
   *
   * Em `try` porque `membrosDaConta` fala Postgres direto (as tabelas do login
   * ficam fora da Data API) e estoura num ambiente sem `DATABASE_URL`, o mesmo
   * cuidado que o Inbox já toma. Sem equipe, o campo simplesmente não aparece e
   * o aviso continua sendo da conta inteira: o editor não pode parar de abrir
   * porque o login não está configurado.
   */
  let equipe: { id: string; nome: string }[] = []
  try {
    equipe = (await membrosDaConta(cliente.id)).map((m) => ({ id: m.id, nome: m.nome }))
  } catch (erro) {
    console.error(
      '[editor] não deu para ler a equipe',
      erro instanceof Error ? erro.message : erro,
    )
  }

  /**
   * O editor não usa a moldura do cliente, é tela cheia por natureza, então
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
  const [publicada, versoes, politicasDaIa] = await Promise.all([
    fluxo.versaoPublicadaId ? acharVersao(fluxo.versaoPublicadaId) : null,
    listarVersoes(fluxo.id),
    lerPoliticas(cliente.id),
  ])

  // Só quem acabou de importar ou duplicar vê "Antes de publicar" (A13), então
  // só aí vale ir ao banco perguntar o que começa esta automação.
  const gatilhosDoFluxo = origem
    ? (
        await Promise.all([
          listarGatilhos(cliente.id),
          listarCampanhas(cliente.id),
          listarGatilhosDeEvento(cliente.id),
        ])
      )
        .flat()
        .filter((g) => g.fluxoId === fluxo.id).length
    : 0

  return (
    <>
      <FaixaDeImpersonacao />
      <FaixaDeSuporte clienteId={cliente.id} />
      <Editor
        fluxoId={fluxo.id}
        clienteId={cliente.id}
        nome={fluxo.nome}
        clienteNome={cliente.nome}
        /* Volta para a lista de automações, e não para o painel: quem sai de
           um fluxo quase sempre vai abrir outro, ou a palavra-chave dele. Voltar
           para o painel jogava a pessoa dois cliques longe do que ela estava
           fazendo. */
        voltarHref={volta ?? `/clientes/${cliente.id}/fluxos`}
        inicial={fluxo.rascunho}
        canal={fluxo.canal}
        iaHabilitada={fluxo.iaHabilitada}
        entradaLigada={fluxo.ativo}
        /* Contratar a Etapa 2 é decisão comercial da 4YU. Para a conta, o
           contrato é estado, ver o cabeçalho do editor. */
        podeContratarIa={ehAdminDaPlataforma(acesso.sessao)}
        contextoNegocio={cliente.contextoNegocio}
        temContextoDeNegocio={cliente.contextoNegocio.trim() !== ''}
        /* Quantas conversas responderam cada variável, para o selo no bloco:
           o desenho passa a dizer o que foi usado, sem sair para Respostas. */
        respostasPorVariavel={respostasPorVariavel}
        origem={origem}
        gatilhosDoFluxo={gatilhosDoFluxo}
        conexoes={conexoes}
        /* Magento ligada ou catálogo próprio com item ativo: os dois servem de
           loja para o bot (`adaptador-da-loja.ts`). */
        lojaAtiva={(loja?.ativa ?? false) || nuvemshop?.ativa === true || temCatalogo}
        /* Só com loja on-line ligada o bloco de IA oferece escolher entre ela
           e o catálogo próprio: sem loja, o catálogo já é a única fonte. */
        lojaOnline={(loja?.ativa ?? false) || nuvemshop?.ativa === true}
        /* O que a IA faz antes de gravar, por consulta, para o bloco de IA dizer
           a regra desta conta em vez de prometer sempre "pergunta antes". */
        politicasDaIa={Object.fromEntries(politicasDaIa)}
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
           usar `{{plano}}`, gravado no fluxo de matrícula, digitava de cabeça.
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
        etiquetas={etiquetas.map((e) => ({ id: e.id, nome: e.nome, cor: e.cor }))}
        equipe={equipe}
        horarioConfigurado={cliente.horarioAtendimento !== null}
        retomadaDaConta={cliente.retomada}
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
