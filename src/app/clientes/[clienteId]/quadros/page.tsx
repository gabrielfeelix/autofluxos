import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Esqueleto, EsqueletoDeQuadro } from '@/components/design/esqueleto'
import { IlustracaoQuadros } from '@/components/design/ilustracoes'
import { CabecalhoDoQuadro } from '@/components/quadros/cabecalho-do-quadro'
import { Quadro, AdicionarContato } from '@/components/quadros/quadro'
import { QuadroPadrao } from '@/components/quadros/quadro-padrao'
import { NovoQuadro } from '@/components/quadros/novo-quadro'
import { EntregaDoQuadro } from '@/components/quadros/entrega-do-quadro'
import { TrazerTodos } from '@/components/quadros/trazer-todos'
import { ListaDeNegocios } from '@/components/negocios/lista-de-negocios'
import { acaoApagarQuadro } from '@/server/acoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { nichoDaConta } from '@/server/repos/recursos'
import { destaqueDeFunis, pacoteDo, rotuloNaBarra } from '@/core/nichos'
import { contarForaDoQuadro, listarCartoes, listarQuadros } from '@/server/repos/quadros'
import { listarMotivos } from '@/server/repos/motivos-de-perda'
import { membrosDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * O relógio, lido **uma vez por render do servidor**.
 *
 * Fica fora do componente porque o compilador do React trata `Date.now()` em
 * render como impureza, e ele tem razão em geral. Aqui a rota é
 * `force-dynamic` e o valor é passado adiante como número, exatamente para o
 * cliente **não** ler o relógio dele: "parado há 6 dias" calculado no navegador
 * divergiria do HTML que o servidor mandou.
 */
function agoraDoServidor(): number {
  return Date.now()
}

/**
 * Quadros, a etapa em que cada contato está (C1).
 *
 * **A tela é o quadro.** A primeira versão punha os formulários de criação como
 * blocos no fim da página, e eles ocupavam mais espaço que o próprio quadro:
 * criar etapa e criar quadro são atos raros, e o que se olha o tempo todo são as
 * colunas. Agora criar é modal, e o quadro ocupa a altura toda com as colunas
 * rolando por dentro.
 *
 * O seletor de quadro só aparece com mais de um, pela mesma razão de
 * `destinoAposEntrar`: mandar quem tem um só para um seletor de um item é fazer
 * a pessoa clicar para confirmar o óbvio.
 *
 * O quadro aberto vem por `?q=<id>`, e não por rota própria: `/quadros/[id]`
 * seria uma tela nova para a mesma tela.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { clienteId } = await params
  const busca = await searchParams
  const q = busca.q

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="quadros">
      {/* A tela inteira, e não um `max-w` no meio dela: um quadro que não usa a
          largura disponível mostra menos colunas do que caberia, que é o oposto
          do que ele existe para fazer. */}
      <main className="flex h-full min-h-0 flex-col px-4 pt-[26px] pb-5 md:px-7">
        {/*
          O funil desce depois da moldura.

          Abrir um funil são quatro consultas, os funis, os cartões, a equipe e
          os motivos , e trocar de funil pelo seletor refaz todas elas. Sem esta
          fronteira a tela ficava idêntica durante a troca; com ela, as colunas
          cinzas aparecem no ato e dizem que a troca foi registrada.

          A `key` é o funil pedido porque é ele que muda sem trocar de rota.
        */}
        <Suspense key={`${q ?? 'padrao'}:${busca.ver ?? 'quadro'}`} fallback={<Espera />}>
          <Conteudo cliente={cliente} q={q} busca={busca} />
        </Suspense>
      </main>
    </ClienteShell>
  )
}

/** A moldura do funil enquanto as colunas vêm. */
function Espera() {
  return (
    <>
      <header className="mb-5 flex shrink-0 items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-dim uppercase">
            Negócios
          </h1>
          <Esqueleto className="h-7 w-36 rounded-lg" />
        </div>
        <span className="flex gap-2">
          <Esqueleto className="h-9 w-24 rounded-lg" />
          <Esqueleto className="h-9 w-9 rounded-lg" />
        </span>
      </header>
      <EsqueletoDeQuadro />
    </>
  )
}

async function Conteudo({
  cliente,
  q,
  busca,
}: {
  cliente: Cliente
  q?: string
  busca: Record<string, string | undefined>
}) {
  const agora = agoraDoServidor()
  /** Quadro | Lista (5.2b). O mesmo funil, pela URL, para o link lembrar a escolha. */
  const visao = busca.ver === 'lista' ? 'lista' : 'quadro'
  const [quadros, nicho] = await Promise.all([listarQuadros(cliente.id), nichoDaConta(cliente.id)])
  const destaque = destaqueDeFunis(pacoteDo(nicho))
  const titulo = rotuloNaBarra(pacoteDo(nicho), 'negocios', 'Negócios')
  // Id que não é deste cliente cai no primeiro em vez de dar erro: o valor vem
  // da URL, e link velho não pode virar tela quebrada.
  const aberto = quadros.find((quadro) => quadro.id === q) ?? quadros[0] ?? null
  const cartoes = aberto ? await listarCartoes(cliente.id, aberto.id) : []

  /*
   * Equipe e motivos vêm com a página, e não sob demanda no menu.
   *
   * São duas listas curtas que mudam uma vez por mês, e buscá-las ao abrir cada
   * menu de cartão seria uma ida ao banco por clique, num lugar onde a pessoa
   * clica em dezenas de cartões seguidos.
   */
  const [equipe, motivos, fora] = aberto
    ? await Promise.all([
        membrosDaConta(cliente.id),
        listarMotivos(cliente.id),
        contarForaDoQuadro(cliente.id, aberto.id),
      ])
    : [[], [], 0]

  const novoQuadro = <NovoQuadro clienteId={cliente.id} primeiro={quadros.length === 0} destaque={destaque} />

  return (
    <>
      <CabecalhoDoQuadro
        key={aberto?.id ?? 'vazio'}
        clienteId={cliente.id}
        quadros={quadros.map(({ id, nome }) => ({ id, nome }))}
        abertoId={aberto?.id}
        visao={visao}
        fora={fora}
        destaqueDeFunis={destaque}
        titulo={titulo}
        adicionar={
          aberto?.etapas[0] && (
            <AdicionarContato
              clienteId={cliente.id}
              quadroId={aberto.id}
              colunaId={aberto.etapas[0].id}
              etapaNome={aberto.etapas[0].nome}
              aparencia="principal"
            />
          )
        }
        configuracoes={
          aberto && (
            <>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Entrada automática</h3>
                <p className="mb-3 text-xs leading-5 text-muted">
                  Escolha se novos contatos devem entrar automaticamente neste funil.
                </p>
                <QuadroPadrao
                  clienteId={cliente.id}
                  quadroId={aberto.id}
                  padraoInicial={aberto.padrao}
                  recebePorSerOPrimeiro={
                    !quadros.some((quadro) => quadro.padrao) && quadros[0]?.id === aberto.id
                  }
                />
              </section>
              <EntregaDoQuadro
                clienteId={cliente.id}
                quadroId={aberto.id}
                seguinteId={aberto.seguinteId}
                outros={quadros
                  .filter((quadro) => quadro.id !== aberto.id)
                  .map(({ id, nome }) => ({ id, nome }))}
              />
            </>
          )
        }
        importar={aberto && <TrazerTodos clienteId={cliente.id} quadroId={aberto.id} fora={fora} />}
        apagar={
          aberto && (
            <BotaoPerigo
              rotulo="Apagar funil"
              titulo="Apaga o funil e as etapas. Nenhum contato é apagado."
              pergunta={`Apagar o funil “${aberto.nome}”? Some a posição das ${cartoes.length} pessoa(s) nele, os contatos, as conversas e as etiquetas ficam.`}
              acao={acaoApagarQuadro.bind(null, cliente.id, aberto.id)}
            />
          )
        }
      />

      {!aberto ? (
        <section className="app-card px-5 py-16 text-center">
          <IlustracaoQuadros />
          <p className="mt-6 text-[13.5px] font-semibold text-soft">Nenhum funil ainda</p>
          <p className="mx-auto mt-1.5 max-w-[440px] text-xs leading-5 text-dim">
            Um funil é o seu processo desenhado: as etapas por onde um contato passa, do primeiro
            contato até o desfecho. Etiqueta é um fato sobre a pessoa e ela pode ter várias; etapa é
            onde ela está, e é uma só.
          </p>
          <span className="mt-6 inline-block">{novoQuadro}</span>
        </section>
      ) : visao === 'lista' ? (
        <ListaDeNegocios
          clienteId={cliente.id}
          etapas={aberto.etapas}
          cartoes={cartoes}
          equipe={equipe.map(({ id, nome }) => ({ id, nome }))}
          filtro={{
            busca: busca.busca,
            etapa: busca.etapa,
            responsavel: busca.responsavel,
            situacao: busca.situacao,
            temperatura: busca.temperatura,
          }}
          parametros={Object.fromEntries(
            Object.entries({ q: aberto.id, ver: 'lista', ...busca }).filter(
              (par): par is [string, string] => typeof par[1] === 'string' && par[1] !== '',
            ),
          )}
          agora={agora}
        />
      ) : (
        <>
          <Quadro
            clienteId={cliente.id}
            quadroId={aberto.id}
            etapas={aberto.etapas}
            cartoesIniciais={cartoes}
            agora={agora}
            equipe={equipe.map(({ id, nome }) => ({ id, nome }))}
            motivos={motivos.map(({ id, nome }) => ({ id, nome }))}
            finalidade={aberto.finalidade}
            seguinte={quadros.find((quadro) => quadro.id === aberto.seguinteId)?.nome ?? null}
          />
        </>
      )}
    </>
  )
}
