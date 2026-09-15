import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Suspense } from 'react'
import { comoFalta, podeReagir, restaDaJanela } from '@/channels/janela'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import { Dica } from '@/components/design/dica'
import { ControleDeAutomacao } from '@/components/lead/controle-automacao'
import { clienteTemAutomacao } from '@/server/repos/fluxos'
import { CaixaDeResposta } from '@/components/lead/responder'
import { RodapeDaMensagem } from '@/components/lead/rodape-da-mensagem'
import { assinaturaDasReacoes } from '@/core/reacoes'
import { ProvedorDeCitacao } from '@/components/lead/citacao'
import {
  acaoApagarContato,
  acaoCorrigirNome,
  acaoEncerrarAtendimento,
  acaoResponderLead,
  acaoSalvarNotas,
} from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { contextoDeResposta } from '@/server/repos/conversas'
import { acharLead, lerConversa, LIMITE_DA_NOTA } from '@/server/repos/leads'
import { listarRespostasRapidas } from '@/server/repos/respostas-rapidas'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { quadrosDoContato } from '@/server/repos/quadros'
import { estagioDoContato, resumoDoContato } from '@/server/repos/crm'
import { linhaDoTempo } from '@/server/repos/eventos'
import { membrosDaConta } from '@/server/repos/usuarios'
import { listarMotivos } from '@/server/repos/motivos-de-perda'
import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'
import { origemDoContato } from '@/core/contatos/origem'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { Avatar } from '@/components/inbox/avatar'
import { Abas } from '@/components/lead-crm/abas'
import { EstagioDoContato } from '@/components/lead-crm/estagio-do-contato'
import { Historico as HistoricoDoContato } from '@/components/lead-crm/historico'
import { Negociacoes } from '@/components/lead-crm/negociacoes'
import { ResponsavelDoContato } from '@/components/lead-crm/responsavel-do-contato'
import { ResumoDoContato } from '@/components/lead-crm/resumo-do-contato'
import { SeletorDeEtiquetas } from '@/components/etiquetas/seletor'
import {
  AnexoNaConversa,
  ArquivoSemCopia,
  MensagemNaoSuportada,
  CartoesNaBolha,
  CitacaoNaBolha,
  LocalNaBolha,
  SemTexto,
} from '@/components/lead/anexo'
import { NomeDoContato, NotasDoContato } from '@/components/lead/identidade'
import { etiquetasDeDia, horaDoRelogio, horaExata, quando } from '@/lib/quando'
import { TextoDoWhatsApp } from '@/components/texto-do-whatsapp'

export const dynamic = 'force-dynamic'

export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string; contatoId: string }>
}) {
  const { clienteId, contatoId } = await params
  const [
    cliente,
    lead,
    respostasRapidas,
    etiquetas,
    noQuadro,
    /*
     * O CRM da ficha (0058), tudo na mesma leva.
     *
     * São cinco consultas curtas e independentes, e nenhuma delas vale uma
     * espera própria: a tela só existe inteira. Equipe e motivos vêm com a
     * página pelo mesmo motivo do quadro — são listas que mudam uma vez por
     * mês, e buscá-las ao abrir cada menu seria uma ida ao banco por clique.
     */
    estagio,
    resumo,
    eventos,
    equipe,
    motivos,
    temAutomacao,
  ] = await Promise.all([
    acharCliente(clienteId),
    acharLead(clienteId, contatoId),
    listarRespostasRapidas(clienteId),
    listarEtiquetas(clienteId),
    quadrosDoContato(clienteId, contatoId),
    estagioDoContato(clienteId, contatoId),
    resumoDoContato(clienteId, contatoId),
    linhaDoTempo(clienteId, contatoId),
    membrosDaConta(clienteId),
    listarMotivos(clienteId),
    /*
     * Sem fluxo ligado a papel nem gatilho ativo, **não existe bot** — e o
     * cartão abaixo dizia "Bot respondendo este contato" assim mesmo, com um
     * botão para pausar o que não existe. Ver `clienteTemAutomacao`.
     */
    clienteTemAutomacao(clienteId),
  ])
  if (!cliente || !lead) notFound()

  const campos = Object.entries(lead.campos)
  const nome = lead.nome ?? 'sem nome'
  /* De onde a pessoa veio, quando isso foi medido. Quem não tem origem não
     ganha linha — escrever "Direto" seria afirmar o que ninguém mediu. */
  const origem = origemDoContato(lead.campos)

  // O primeiro nome basta na caixa de resposta: "Responder Maria Aparecida da
  // Silva pelo WhatsApp…" não cabe e não ajuda.
  const primeiroNome = lead.nome?.split(' ')[0] ?? 'esta pessoa'

  // Quanto ainda dá para responder em texto livre. `null` fecha a caixa — e a
  // conta é feita aqui, no servidor, porque o relógio do navegador de quem abre
  // a tela não é fonte de verdade para uma regra da Meta.
  const contexto = await contextoDeResposta(clienteId, contatoId)
  const restante = restaDaJanela(contexto?.ultimaEntradaEm ?? null)
  const janela = restante && restante > 0 ? comoFalta(restante) : null
  /** Menos de duas horas — a contagem muda de cor. Mesma régua do Inbox. */
  const apertado = restante !== null && restante > 0 && restante < 2 * 60 * 60 * 1000

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <main className="w-full max-w-[1440px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Link
        href={`/clientes/${cliente.id}/leads`}
        className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-primary"
        >
        ← Leads
        </Link>

        <header className="mb-4 flex flex-wrap items-center gap-3.5">
          <Avatar nome={lead.nome} tamanho={44} />
          <div className="min-w-0">
            <NomeDoContato
              nome={lead.nome}
              nomeDoPerfil={lead.nomeDoPerfil}
              nomeReal={lead.nomeReal}
              waId={lead.waId}
              salvar={acaoCorrigirNome.bind(null, clienteId, contatoId)}
            />
            {/* Telefone e origem numa linha só, embaixo do nome: são as duas
                coisas que se procura com a ficha aberta — para onde eu ligo, e
                de onde essa pessoa veio. */}
            <p className="mt-0.5 text-[11.5px] text-dim">
              {telefoneLegivel(lead.waId)} · WhatsApp
              {origem &&
                (origem.deAnuncio && origem.titulo
                  ? ` · veio do anúncio “${origem.titulo}”`
                  : ` · veio de ${origem.rotulo}`)}
            </p>
          </div>
          <span className="flex-1" />
          {/* O estágio e o responsável, lado a lado: em que pé está, e com
              quem. Ver `components/lead-crm/estagio-do-contato.tsx`. */}
          <EstagioDoContato
            clienteId={clienteId}
            contatoId={contatoId}
            estagio={estagio ?? 'novo'}
          />
          <ResponsavelDoContato
            clienteId={clienteId}
            contatoId={contatoId}
            equipe={equipe.map(({ id, nome: comoSeChama }) => ({ id, nome: comoSeChama }))}
            responsavelId={lead.atribuidoA}
          />
          <span className={`rounded-full border px-3 py-1 text-[10.5px] font-bold ${lead.aguardando ? 'border-rose-400/25 bg-rose-400/[0.09] text-perigo' : !lead.automacaoAtiva ? 'border-amber-300/25 bg-amber-300/[0.08] text-aviso' : 'border-emerald-400/20 bg-emerald-400/[0.07] text-ok'}`}>
            {lead.aguardando ? 'AGUARDANDO HUMANO' : !lead.automacaoAtiva ? 'BOT EM PAUSA' : 'COM O BOT'}
          </span>
          {/* O pedido de exclusão da LGPD vira este botão. A pergunta diz o que
              some junto porque não existe desfazer: a conversa não está copiada
              em lugar nenhum. */}
          <BotaoPerigo
            acao={acaoApagarContato.bind(null, clienteId, contatoId)}
            rotulo="Apagar contato"
            titulo="Apaga a pessoa, a conversa inteira e o que o fluxo coletou. Não dá para desfazer."
            pergunta={`Apagar ${nome} e tudo desta pessoa?\n\nSomem a conversa inteira, o que o fluxo coletou e o histórico de atendimento. Não dá para desfazer.`}
          />
        </header>

        {lead.aguardando && (
          <div className="mb-[18px] flex items-center gap-3 rounded-[13px] border border-rose-400/25 bg-rose-400/[0.06] px-[17px] py-[13px]">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-rose-400" />
            <div className="min-w-0 flex-1">
              <strong className="block text-[13px] text-perigo">Esperando uma pessoa {quando(lead.aguardando.desde)}</strong>
              <span className="mt-0.5 block text-[11.5px] text-muted">Motivo do handoff: {lead.aguardando.motivo}</span>
            </div>
            {/*
              O que este botão faz, e por que ele é um só: tira o lead da fila e
              devolve o contato ao bot. Enquanto a sessão estiver com uma pessoa,
              o bot fica calado com esse número — então "atendi" e "pode voltar
              a atender" são o mesmo ato, e separar os dois só criaria um estado
              em que ninguém responde.
            */}
            <form action={acaoEncerrarAtendimento.bind(null, clienteId, contatoId)}>
              <button
                type="submit"
                title="Resolve o handoff. A próxima mensagem desta pessoa começa uma conversa nova com o bot."
                className="shrink-0 rounded-[9px] border border-rose-400/30 bg-rose-400/[0.12] px-3.5 py-2 text-[12px] font-bold text-perigo transition hover:bg-rose-400/[0.2]"
              >
                Já atendi
              </button>
            </form>
          </div>
        )}

        {!lead.aguardando && temAutomacao && (
          <div className={`mb-[18px] flex items-center gap-3 rounded-[13px] border px-[17px] py-[13px] ${lead.automacaoAtiva ? 'border-emerald-400/20 bg-emerald-400/[0.045]' : 'border-amber-300/25 bg-amber-300/[0.06]'}`}>
            <span className={`size-2 shrink-0 rounded-full ${lead.automacaoAtiva ? 'bg-emerald-400' : 'bg-amber-300'}`} />
            <div className="min-w-0 flex-1">
              <strong className={`block text-[13px] ${lead.automacaoAtiva ? 'text-ok' : 'text-aviso'}`}>
                {lead.automacaoAtiva ? 'Bot respondendo este contato' : 'Bot pausado para este contato'}
              </strong>
              <span className="mt-0.5 block text-[11.5px] text-muted">
                {lead.automacaoAtiva
                  ? 'Pause se você vai conduzir a conversa manualmente.'
                  : 'As mensagens entram no histórico, sem resposta automática.'}
              </span>
            </div>
            <div className="w-[132px] shrink-0">
              <ControleDeAutomacao
                clienteId={clienteId}
                contatoId={contatoId}
                automacaoAtiva={lead.automacaoAtiva}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex flex-col gap-[18px]">
          {/* **O que a pessoa já rendeu e o que está em jogo vêm antes de
              etiqueta e anotação.** A coluna abria em "Etiquetas", e a primeira
              informação sobre a pessoa era o que o bot perguntou — o mesmo
              defeito que a coluna do Inbox já tinha corrigido. */}
          <ResumoDoContato resumo={resumo} />
          <Negociacoes
            clienteId={clienteId}
            nome={nome}
            negociacoes={noQuadro.map((posicao) => ({
              cartaoId: posicao.cartaoId,
              quadro: posicao.quadro,
              etapa: posicao.etapa,
              entrouEm: posicao.entrouEm,
              titulo: posicao.titulo,
              valor: posicao.valor,
              situacao: posicao.situacao,
            }))}
            motivos={motivos.map(({ id, nome: comoSeChama }) => ({ id, nome: comoSeChama }))}
          />
          <section className="app-card overflow-hidden">
            <h2 className="border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
              Etiquetas
            </h2>
            <div className="px-[18px] py-4">
              <SeletorDeEtiquetas
                clienteId={clienteId}
                contatoId={contatoId}
                disponiveis={etiquetas}
                aplicadas={lead.etiquetasManuais.map((etiqueta) => etiqueta.id)}
              />
            </div>
          </section>
          <NotasDoContato
            notas={lead.notas}
            limite={LIMITE_DA_NOTA}
            salvar={acaoSalvarNotas.bind(null, clienteId, contatoId)}
          />
          <section className="app-card overflow-hidden">
            <h2 className="border-b border-line px-[18px] py-3.5 text-[13px] font-bold">O que o fluxo coletou</h2>
            {campos.length === 0 ? (
              <p className="px-[18px] py-[22px] text-xs leading-5 text-dim">
                Nada coletado — a conversa não chegou a preencher nenhuma variável.
              </p>
            ) : (
              <dl>
                {campos.map(([chave, valor]) => (
                  <div key={chave} className="border-b border-line px-[18px] py-[11px] last:border-0">
                    <dt className="text-[10.5px] font-semibold text-dim">{rotuloDoCampo(chave) || chave}</dt>
                    <dd className="mt-1 truncate text-[13px] font-semibold">{valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
          </div>

          {/* A conversa e o histórico no mesmo cartão, e a conversa primeiro:
              quem abre a ficha quase sempre vai responder. Ver
              `components/lead-crm/abas.tsx`. */}
          <Abas
            extra={
              /*
                A contagem da janela de 24h fica aqui, e não no rodapé da caixa
                de resposta. Mesma decisão do Inbox, pelo mesmo motivo: ela é
                estado da conversa e não consequência de responder — e as duas
                telas precisam dizer a mesma coisa no mesmo lugar, senão quem
                usa as duas aprende dois produtos.
              */
              janela ? (
                <Dica texto="Depois disso o WhatsApp só aceita modelo aprovado pela Meta">
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                      apertado ? 'bg-amber-400/15 text-aviso' : 'bg-surface text-muted'
                    }`}
                  >
                    <span aria-hidden>🕐</span>
                    {janela}
                  </span>
                </Dica>
              ) : null
            }
            conversa={
              <ProvedorDeCitacao>
                <div className="min-h-0 flex-1 overflow-auto p-[18px]">
                  <Suspense fallback={<HistoricoEsqueleto />}>
                    <Historico
                      contatoId={contatoId}
                      nomeDoLead={lead.nome}
                      clienteId={clienteId}
                    />
                  </Suspense>
                </div>
                <CaixaDeResposta
                  acao={acaoResponderLead.bind(null, clienteId, contatoId)}
                  restaDaJanela={janela}
                  nome={primeiroNome}
                  respostasRapidas={respostasRapidas}
                  temAutomacao={temAutomacao}
                />
              </ProvedorDeCitacao>
            }
            historico={<HistoricoDoContato eventos={eventos} />}
          />
        </div>
      </main>
    </ClienteShell>
  )
}

function HistoricoEsqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="h-9 w-[46%] self-end rounded-[13px_13px_4px_13px] bg-primary/[0.07]" />
      <div className="h-9 w-[34%] rounded-[13px_13px_13px_4px] bg-surface" />
      <div className="h-9 w-[52%] self-end rounded-[13px_13px_4px_13px] bg-primary/[0.07]" />
      <span className="sr-only">Carregando a conversa…</span>
    </div>
  )
}

async function Historico({
  contatoId,
  nomeDoLead,
  clienteId,
}: {
  contatoId: string
  nomeDoLead: string | null
  clienteId: string
}) {
  const conversa = await lerConversa(contatoId)

  if (conversa.mensagens.length === 0) {
    return <p className="py-10 text-center text-xs text-dim">Nenhuma mensagem registrada.</p>
  }

  /* Onde cada dia começa — mesma regra do Inbox, ver `lib/quando.ts`. */
  const diasDaConversa = etiquetasDeDia(conversa.mensagens, (m) => m.ts)

  return (
    <div className="flex flex-col gap-2.5">
      {conversa.cortada && (
        <p className="self-center rounded-xl border border-dashed border-strong px-3.5 py-2 text-center font-mono text-[10px] text-muted">
          conversa longa — mostrando só as mensagens mais recentes
        </p>
      )}
      {conversa.mensagens.map((mensagem, indice) => {
        const nossa = mensagem.direcao === 'saida'
        const etiqueta = diasDaConversa[indice]
        return (
          /* O `Fragment` deixa a etiqueta de dia ser irmã da bolha — ver o Inbox. */
          <Fragment key={mensagem.id}>
            {etiqueta && <EtiquetaDoDia rotulo={etiqueta} />}
            {/* A coluna é o que dá lugar à reação embaixo da bolha — ver o Inbox. */}
            <div className={`flex flex-col gap-0 ${nossa ? 'items-end' : 'items-start'}`}>
            {/* Mesma fonte e mesmo corpo do Inbox — ver o comentário de lá. */}
            <p className={`max-w-[78%] px-3 py-2 font-texto text-[14.5px] leading-[1.45] whitespace-pre-wrap ${nossa ? 'rounded-[13px_13px_4px_13px] border border-primary/[0.22] bg-primary/[0.13]' : 'rounded-[13px_13px_13px_4px] border border-line bg-surface'}`}>
              {mensagem.cita && <CitacaoNaBolha cita={mensagem.cita} nome={nomeDoLead} />}
              {mensagem.anexo && <AnexoNaConversa anexo={mensagem.anexo} />}
              {/*
                O arquivo que a pessoa mandou. Mesma bolha do que sai, e a
                diferença está em quem produziu a URL: aqui ela é assinada e
                morre em cinco minutos.
              */}
              {mensagem.recebido && <AnexoNaConversa anexo={mensagem.recebido} />}
              {mensagem.semCopia && <ArquivoSemCopia />}
              {mensagem.naoSuportada && <MensagemNaoSuportada />}
              {mensagem.local && <LocalNaBolha local={mensagem.local} />}
              {mensagem.cartoes && <CartoesNaBolha cartoes={mensagem.cartoes} />}
              {/*
                Lugar e cartão **substituem** o "(áudio, imagem ou documento)".
                Eles são a mensagem inteira, e quase nunca vêm com legenda —
                deixar a frase genérica embaixo diria que falta algo que não
                falta.
              */}
              {mensagem.texto !== null ? (
                <TextoDoWhatsApp texto={mensagem.texto} />
              ) : (
                !mensagem.local &&
                !mensagem.cartoes &&
                !mensagem.semCopia &&
                !mensagem.naoSuportada && <SemTexto />
              )}
              {/*
                Mesma regra do Inbox: a hora sempre, o autor só na saída e só
                quando ele é sabido. "bot" estava fixo aqui e mentia toda vez
                que quem respondeu foi gente — ver `core/autor-da-mensagem.ts`.
              */}
              <span className="ml-2 text-[9.5px] text-muted" title={horaExata(mensagem.ts)}>
                {nossa && mensagem.autor ? `${mensagem.autor} · ` : ''}
                {horaDoRelogio(mensagem.ts)}
              </span>
              {nossa && !mensagem.entregue && (
                <span className="ml-2 text-[9.5px] text-aviso">envio não confirmado</span>
              )}
            </p>
            {(mensagem.waMessageId || mensagem.reacoes) && (
              /* A `key` devolve a palavra final ao servidor — ver o Inbox. */
              <RodapeDaMensagem
                key={assinaturaDasReacoes(mensagem.reacoes)}
                clienteId={clienteId}
                contatoId={contatoId}
                waMessageId={mensagem.waMessageId ?? null}
                podeReagir={podeReagir(mensagem.ts)}
                reacoes={mensagem.reacoes ?? []}
                nome={nomeDoLead}
                texto={mensagem.texto}
                deQuem={nossa ? 'ao atendimento' : `a ${nomeDoLead ?? 'cliente'}`}
                nossa={nossa}
              />
            )}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

/** A etiqueta de dia. Gêmea da do Inbox — a bolha vive duplicada nas duas telas. */
function EtiquetaDoDia({ rotulo }: { rotulo: string }) {
  return (
    <p className="my-1 self-center rounded-full border border-line bg-surface px-3 py-1 text-center text-[10px] font-medium text-dim">
      {rotulo}
    </p>
  )
}
