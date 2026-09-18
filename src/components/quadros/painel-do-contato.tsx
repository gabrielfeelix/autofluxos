'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Avatar } from '@/components/inbox/avatar'
import { EstagioDoContato } from '@/components/lead-crm/estagio-do-contato'
import { TemperaturaDoContato } from '@/components/lead-crm/temperatura-do-contato'
import { ResponsavelDoContato } from '@/components/lead-crm/responsavel-do-contato'
import { SeletorDeEtiquetas } from '@/components/etiquetas/seletor'
import { QuemE } from '@/components/lead/quem-e'
import { comoDinheiro, comoFrase, type Evento } from '@/core/crm'
import { comoParado } from '@/core/quadros'
import { horaExata } from '@/lib/quando'
import { acaoAbrirPainelDoContato } from '@/server/acoes-crm'

/**
 * O painel lateral do contato.
 *
 * **Abrir o perfil não pode tirar a pessoa do quadro.** Era o que acontecia: o
 * nome do cartão era um link para a página de lead, e conferir quem é alguém
 * custava perder a visão do funil e a rolagem de cada coluna. O painel resolve
 * isso do jeito que o RD resolve — dado à esquerda, histórico à direita, quadro
 * ainda visível atrás.
 *
 * O conteúdo vem sob demanda, e não com a página: carregar linha do tempo de
 * cinquenta cartões para mostrar uma seria pagar cinquenta consultas por uma
 * leitura.
 *
 * Quem troca de contato remonta o componente pela `key` — é o que garante que o
 * painel nunca abra mostrando o histórico da pessoa anterior enquanto o novo
 * não chega.
 *
 * ---------------------------------------------------------------------------
 * O bug que este arquivo carregava, e o que ele escondia
 * ---------------------------------------------------------------------------
 *
 * O painel recebia o **cartão** e tratava `cartao.id` como id do contato. Os dois
 * são uuid, nada estourava, e o estrago era silencioso em dois lugares: o botão
 * "Abrir a conversa" apontava para `/leads/<id do cartão>` e caía em 404, e a
 * linha do tempo e o "já rendeu" eram buscados por um id que não existe em
 * `contacts` — então voltavam vazios **sempre**, em todo contato. O painel não
 * estava vazio por falta de histórico; estava vazio por estar perguntando pela
 * pessoa errada.
 *
 * Daí o `contatoId` explícito na prop abaixo, em vez de um objeto `contato` com
 * um `id` ambíguo: num cartão de funil, "o id" é uma pergunta com duas respostas
 * certas, e a assinatura tem que escolher qual delas ela quer.
 *
 * ---------------------------------------------------------------------------
 * A ordem do que aparece
 * ---------------------------------------------------------------------------
 *
 * A mesma do painel do Inbox, e pelo mesmo motivo: é a ordem em que alguém que
 * abre um cartão pergunta. Quem é a pessoa, o que fazer com ela agora (estágio,
 * temperatura, responsável), o que já rendeu, como está etiquetada, e só então o
 * histórico — que é longo, e é o que menos muda a decisão do minuto.
 */
export function PainelDoContato({
  clienteId,
  contatoId,
  cartao,
  aoFechar,
  aoGanharOuPerder,
}: {
  clienteId: string
  /** O id em `contacts`. **Não** é o id do cartão — ver o cabeçalho. */
  contatoId: string | null
  /** O que o cartão já sabe, para o painel abrir escrito enquanto o resto chega. */
  cartao: {
    id: string
    nome: string
    telefone: string
    entrouNaColunaEm: string
    titulo?: string | null
    valor?: number | null
    situacao?: string
  } | null
  aoFechar: () => void
  /**
   * Ganhar ou perder sem sair do quadro.
   *
   * O painel **não** abre o modal de fechar por conta própria: quem o tem é o
   * quadro, com a lista de motivos e o aviso de passagem para o funil seguinte.
   * Dois modais de fechar venda viram, em um mês, duas regras de fechar venda —
   * é a mesma nota que já está em `lead-crm/negociacoes.tsx`.
   */
  aoGanharOuPerder: (situacao: 'ganha' | 'perdida') => void
}) {
  const [dados, setDados] = useState<Awaited<
    ReturnType<typeof acaoAbrirPainelDoContato>
  > | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (!contatoId) return
    let valeu = true

    acaoAbrirPainelDoContato(clienteId, contatoId)
      .then((r) => {
        if (valeu) setDados(r)
      })
      .catch(() => {
        if (valeu) setFalhou(true)
      })

    return () => {
      valeu = false
    }
  }, [clienteId, contatoId])

  // Fechar com Esc: o painel cobre parte da tela, e sair dele com o teclado é o
  // que se espera de qualquer coisa que cobre.
  useEffect(() => {
    if (!contatoId) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [contatoId, aoFechar])

  if (!contatoId || !cartao) return null

  const ficha = dados?.ficha ?? null
  const resumo = dados?.resumo ?? null

  return (
    <>
      <div
        aria-hidden
        onClick={aoFechar}
        className="fixed inset-0 z-30 bg-[rgba(19,25,34,0.22)] backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-label={`Perfil de ${cartao.nome}`}
        className="fixed top-0 right-0 z-40 flex h-full w-[min(420px,92vw)] flex-col border-l border-line bg-panel shadow-[0_0_60px_rgba(19,25,34,0.18)]"
      >
        {/*
          O topo com foto e nome é o mesmo gesto do painel do Inbox: a coluna
          rola, e depois de duas telas de histórico nada nela diria mais de quem
          é aquela ficha.

          A "foto" são iniciais coloridas, e isso não é um consolo: a Cloud API
          **não expõe foto de perfil de contato** — o webhook manda só o nome, e
          o único `profile_picture_url` que existe é o do próprio negócio. Quem
          mostra foto de contato no mercado está rodando provedor não oficial por
          cima do WhatsApp Web, que é o caminho que arrisca banir o número do
          cliente. Ver `components/inbox/avatar.tsx`.
        */}
        <header className="relative flex shrink-0 flex-col items-center border-b border-line px-4 py-4 text-center">
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar painel"
            className="absolute top-2.5 right-3 rounded px-1.5 py-0.5 text-[15px] leading-none text-dim transition hover:text-soft"
          >
            ×
          </button>

          <Avatar nome={cartao.nome} tamanho={52} />
          <strong className="mt-2 max-w-full truncate text-[13.5px] font-bold">
            {cartao.nome}
          </strong>
          <span className="mt-0.5 font-mono text-[10.5px] text-dim">{cartao.telefone}</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {falhou && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] text-soft"
            >
              Não deu para carregar a ficha desta pessoa. Feche e abra de novo.
            </p>
          )}

          {/*
            O que fazer com esta pessoa agora, e é o topo porque é a razão de
            alguém abrir um cartão no meio do funil.

            Os três editam de dentro do painel: mandar para a ficha completa para
            trocar uma etiqueta era perder o quadro de vista, que é justamente o
            que este painel existe para não fazer.
          */}
          {ficha && (
            <section className="flex flex-col gap-3">
              <Campo rotulo="Temperatura">
                <TemperaturaDoContato
                  clienteId={clienteId}
                  contatoId={contatoId}
                  temperatura={ficha.temperatura}
                />
              </Campo>

              <Campo rotulo="Estágio">
                <EstagioDoContato
                  clienteId={clienteId}
                  contatoId={contatoId}
                  estagio={ficha.estagio}
                />
              </Campo>

              <Campo rotulo="Responsável">
                <ResponsavelDoContato
                  clienteId={clienteId}
                  contatoId={contatoId}
                  equipe={dados?.equipe ?? []}
                  responsavelId={ficha.atribuidoA}
                />
              </Campo>
            </section>
          )}

          {/*
            A próxima ação, e ela vem **antes** de tudo que é descrição.

            É o campo mais citado da pesquisa de CRMs: a RD põe "próximo contato
            agendado" no próprio cartão, a Close põe as tarefas no topo da
            coluna do lead. A pergunta de quem abre um cartão no meio do funil é
            "o que acontece com essa pessoa agora", e o que já está marcado para
            sair responde antes de qualquer outra coisa.

            Tem um segundo uso, prático: sem isto, quem abre o painel não sabe
            que há mensagem esperando para sair e escreve de novo por cima.
          */}
          {dados && dados.agendadas.length > 0 && (
            <section className="mt-4 rounded-lg border border-primary/25 bg-primary/[0.05] px-3 py-2.5">
              <h4 className="text-[10px] font-bold tracking-[0.05em] text-primary uppercase">
                Já está marcado para sair
              </h4>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {dados.agendadas.map((agendada) => (
                  <li key={agendada.id} className="text-[11.5px] leading-4">
                    <strong
                      className={`font-bold ${agendada.estado === 'falhou' ? 'text-perigo' : 'text-soft'}`}
                    >
                      {agendada.estado === 'falhou' ? 'não saiu' : horaExata(agendada.quando)}
                    </strong>
                    <span className="mt-0.5 block truncate text-dim">{agendada.texto}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/*
            A negociação deste cartão, editável.

            Era texto morto: para mudar o valor de uma venda que acabou de ser
            acertada no WhatsApp era preciso sair do quadro. A RD deixa marcar
            venda e perda de dentro do painel do WhatsApp dela, e é o gesto que
            mais se faz com um cartão aberto.
          */}
          <section className="mt-4 rounded-lg border border-line bg-surface px-3 py-2.5">
            <h4 className="text-[10px] font-bold tracking-[0.05em] text-dim uppercase">
              Negociação
            </h4>
            <p className="mt-1 text-[12px] leading-5">
              {cartao.titulo || <span className="text-dim">sem título</span>}
              {cartao.valor != null && (
                <span className="font-semibold"> — {comoDinheiro(cartao.valor)}</span>
              )}
            </p>

            {/* Tempo parado: a Pipedrive produtizou exatamente isto (o
                "rotting", com cor no cartão). Aqui ele já era calculado para a
                barra do cartão e não era dito em lugar nenhum por extenso. */}
            <p className="mt-1 text-[11px] text-dim">
              {comoParado(cartao.entrouNaColunaEm)} nesta etapa
            </p>

            {cartao.situacao === 'aberta' ? (
              <span className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => aoGanharOuPerder('ganha')}
                  className="flex-1 rounded-[8px] border border-emerald-500/35 bg-emerald-50 px-2 py-1.5 text-[11.5px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Ganhou
                </button>
                <button
                  type="button"
                  onClick={() => aoGanharOuPerder('perdida')}
                  className="flex-1 rounded-[8px] border border-rose-400/35 bg-rose-50 px-2 py-1.5 text-[11.5px] font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  Perdeu
                </button>
              </span>
            ) : (
              <p className="mt-2 text-[11.5px] font-bold">
                {cartao.situacao === 'ganha' ? (
                  <span className="text-ok">ganho</span>
                ) : (
                  <span className="text-perigo">perdido</span>
                )}
              </p>
            )}
          </section>

          {/*
            Em que outros funis essa pessoa está.

            O painel mostrava só o cartão clicado, como se fosse o único — e no
            produto o SDR entrega ao vendedor, que entrega ao pós-venda, então a
            mesma pessoa tem cartão em três lugares. Só aparece quando há mais de
            um: repetir o funil que já está aberto seria ruído.
          */}
          {dados && dados.funis.length > 1 && (
            <section className="mt-4">
              <Titulo>Nos outros funis</Titulo>
              <ul className="flex flex-col gap-1.5">
                {dados.funis
                  .filter((funil) => funil.cartaoId !== cartao.id)
                  .map((funil) => (
                    <li
                      key={funil.cartaoId}
                      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px]"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <strong className="font-semibold">{funil.quadro}</strong>
                        <span className="text-dim"> · {funil.etapa}</span>
                      </span>
                      {funil.situacao !== 'aberta' && (
                        <span
                          className={`shrink-0 text-[10.5px] font-bold ${funil.situacao === 'ganha' ? 'text-ok' : 'text-perigo'}`}
                        >
                          {funil.situacao === 'ganha' ? 'ganho' : 'perdido'}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {/*
            Três zeros não informam nada e empurram para baixo o que informa, é
            a mesma regra do `ResumoDoContato` na ficha: quem nunca comprou não
            ganha o bloco.
          */}
          {resumo && resumo.compras > 0 && (
            <section className="mt-4 grid grid-cols-3 gap-2">
              <Numero titulo="Já rendeu" valor={comoDinheiro(resumo.total) || 'R$ 0,00'} />
              <Numero titulo="Compras" valor={String(resumo.compras)} />
              <Numero
                titulo="Última"
                valor={
                  resumo.ultimaEm ? new Date(resumo.ultimaEm).toLocaleDateString('pt-BR') : '—'
                }
              />
            </section>
          )}

          {/* Para onde eu ligo, desde quando ela é nossa, quando falou por
              último, e de que anúncio veio. Tudo já medido, e nada disso
              aparecia no funil. */}
          {ficha && (
            <QuemE
              waId={ficha.waId}
              criadoEm={ficha.criadoEm}
              ultimaEntradaEm={ficha.ultimaEntradaEm}
              campos={ficha.campos}
            />
          )}

          {ficha && (
            <>
              <Titulo>Etiquetas</Titulo>
              <SeletorDeEtiquetas
                clienteId={clienteId}
                contatoId={contatoId}
                disponiveis={dados?.etiquetas ?? []}
                aplicadas={dados?.aplicadas ?? []}
              />
            </>
          )}

          {/* A anotação é só leitura aqui, e de propósito: o editor dela vive na
              ficha. Duas caixas editáveis do mesmo texto na mesma sessão viram
              duas cópias que divergem no primeiro clique. */}
          {ficha && ficha.notas.trim() !== '' && (
            <>
              <Titulo>Anotação da equipe</Titulo>
              <p className="rounded-[10px] border border-line bg-surface px-2.5 py-2 text-[11.5px] leading-5 whitespace-pre-line text-soft">
                {ficha.notas}
              </p>
            </>
          )}

          <Titulo>O que aconteceu</Titulo>

          {dados === null ? (
            <p className="text-[12px] text-dim">carregando…</p>
          ) : dados.eventos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11.5px] leading-5 text-dim">
              Nada registrado ainda. A partir de agora, mudança de etapa, quem assumiu e o que foi
              ganho ou perdido aparecem aqui.
            </p>
          ) : (
            <ol className="flex flex-col gap-0">
              {dados.eventos.map((evento: Evento) => (
                <li key={evento.id} className="flex gap-2.5 border-l border-line pb-3 pl-3 last:pb-0">
                  <span className="-ml-[17px] mt-[5px] size-[7px] shrink-0 rounded-full bg-surface-strong ring-2 ring-[var(--panel,#fff)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] leading-5">{comoFrase(evento)}</span>
                    <span className="text-[10.5px] text-dim">
                      {new Date(evento.criadoEm).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {evento.autor ? ` · ${evento.autor}` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <footer className="shrink-0 border-t border-line px-4 py-3">
          <Link
            href={`/clientes/${clienteId}/leads/${contatoId}`}
            className="app-secondary-button block w-full px-4 py-2.5 text-center text-[12.5px]"
          >
            Ver ficha completa
          </Link>
        </footer>
      </aside>
    </>
  )
}

/** Um controle com seu rótulo por cima, na coluna estreita. */
function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold tracking-[0.05em] text-dim uppercase">{rotulo}</span>
      {children}
    </span>
  )
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-5 mb-2 text-[10.5px] font-bold tracking-[0.05em] text-dim uppercase">
      {children}
    </h4>
  )
}

function Numero({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <span className="rounded-lg border border-line bg-surface px-2 py-2 text-center">
      <span className="block truncate text-[13px] font-bold">{valor}</span>
      <span className="block text-[10px] text-dim">{titulo}</span>
    </span>
  )
}
