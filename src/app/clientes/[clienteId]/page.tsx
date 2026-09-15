import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ClienteShell } from '@/components/design/cliente-shell'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { comoDinheiro } from '@/core/crm'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarLeads } from '@/server/repos/leads'
import { medirFunil, medirPessoas, medirTempos } from '@/server/repos/metricas'
import { fechamentos, filaDoPainel, type ItemDaFila } from '@/server/repos/painel'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * A primeira tela responde, nesta ordem: **quem está esperando por mim agora**
 * e, se ninguém está, **o negócio andou?**
 *
 * A ordem é a decisão inteira, e está defendida em `docs/PLANO-HOMEPAGE.md`. A
 * versão anterior fazia o contrário — cinco blocos de medida e nenhuma lista —,
 * o que é contar o mês para quem abriu o navegador querendo saber a próxima
 * meia hora. Home de produto de atendimento é fila com placar em cima, não
 * placar com gráfico embaixo.
 *
 * O que sobreviveu inteiro da tela antiga é o princípio da faixa de estado: as
 * três condições para o bot responder no WhatsApp moravam em três telas, e
 * descobrir qual faltava exigia visitar as três. Aqui a resposta vem antes de
 * qualquer navegação e, quando é "não", diz **qual peça** falta.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="inicio">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div>
            <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Painel</h1>
            <p className="mt-1 text-[13px] text-muted">{cliente.nome}</p>
          </div>
          <Link
            href={`/clientes/${cliente.id}/leads`}
            className="text-[12.5px] font-semibold text-muted transition hover:text-primary"
          >
            Todos os contatos
          </Link>
        </header>

        {/*
          Estado e fila num bloco só, com uma leitura só.

          Separados, cada um precisaria de `listarFluxos` e `listarCanais` para
          decidir o que mostrar quando a conta é nova — o dobro das consultas
          para desenhar a mesma decisão. As duas são baratas e a fila tem teto
          de seis linhas, então nada aqui segura a tela por muito tempo.
        */}
        <Suspense
          fallback={<div className="mb-5 h-[248px] animate-pulse rounded-[14px] bg-surface" />}
        >
          <Abertura clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={<div className="app-card mb-[18px] h-[92px] animate-pulse" />}>
          <Numeros clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={null}>
          <Fechamentos clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={null}>
          <Pessoas clienteId={cliente.id} />
        </Suspense>
      </main>
    </ClienteShell>
  )
}

// ---------------------------------------------------------------------------
// Estado do atendimento e fila
// ---------------------------------------------------------------------------

async function Abertura({ clienteId }: { clienteId: string }) {
  const [fluxos, canais, contatos, fila] = await Promise.all([
    listarFluxos(clienteId),
    listarCanais(clienteId),
    contarLeads(clienteId),
    filaDoPainel(clienteId),
  ])

  const noAr = fluxos.filter((fluxo) => fluxo.versaoPublicadaId)
  const publicados = new Set(noAr.map((fluxo) => fluxo.id))
  const atendendo = canais.filter((canal) => canal.flowId && publicados.has(canal.flowId))

  // A ordem importa: a primeira peça que falta é a que adianta resolver. Listar
  // tudo que está errado de uma vez faz parecer que há quatro problemas quando
  // há um, e os seguintes às vezes somem sozinhos quando o primeiro sai.
  const passos = [
    {
      feito: fluxos.length > 0,
      titulo: 'Desenhar a automação',
      explica: 'o roteiro do que o bot responde',
      acao: 'Criar a primeira',
      href: '/fluxos',
    },
    {
      feito: noAr.length > 0,
      titulo: 'Publicar a automação',
      explica: 'o desenho existe, mas não atende ninguém até ser publicado',
      acao: 'Abrir as automações',
      href: '/fluxos',
    },
    {
      feito: canais.length > 0 && atendendo.length > 0,
      titulo: 'Conectar o número',
      explica:
        canais.length === 0
          ? 'sem isso o WhatsApp não chega até aqui'
          : 'o número conectado ainda não aponta para uma automação publicada',
      acao: canais.length === 0 ? 'Conectar' : 'Ajustar o número',
      href: '/ajustes/whatsapp',
    },
  ]

  const proximo = passos.find((passo) => !passo.feito)

  return (
    <section className="mb-5">
      <div
        className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-t-[14px] border border-b-0 px-5 py-3 ${
          proximo ? 'border-amber-300/30 bg-amber-300/[0.06]' : 'border-line bg-surface'
        }`}
      >
        <p className="flex items-center gap-2.5 text-[14px] font-bold">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${proximo ? 'bg-amber-300' : 'bg-emerald-400'}`}
          />
          {proximo ? 'Ainda não está atendendo' : 'Atendendo no WhatsApp'}
        </p>

        {!proximo && (
          <p className="text-[12px] text-muted">
            {noAr.length} {noAr.length === 1 ? 'automação no ar' : 'automações no ar'} ·{' '}
            {canais.length} {canais.length === 1 ? 'número' : 'números'} · {contatos}{' '}
            {contatos === 1 ? 'contato' : 'contatos'}
          </p>
        )}

        <span className="flex-1" />

        <Link
          href={`/clientes/${clienteId}/ajustes/negocio`}
          className="text-[12px] text-dim transition hover:text-primary"
        >
          Dados do negócio
        </Link>
      </div>

      <div className="rounded-b-[14px] border border-line bg-panel">
        {proximo ? (
          <Estreia passos={passos} clienteId={clienteId} />
        ) : (
          <Fila fila={fila} clienteId={clienteId} contatos={contatos} />
        )}
      </div>
    </section>
  )
}

/**
 * O checklist de estreia.
 *
 * Três passos, cada um levando a uma tela concreta, e **ele morre sozinho**:
 * quando o terceiro fica verde, o mesmo espaço passa a mostrar a fila. Não há
 * botão de fechar porque não precisa haver — checklist que depende de alguém
 * dispensá-lo é o que vira ruído permanente.
 *
 * Só o próximo passo tem botão. Três botões lado a lado transformam uma
 * sequência em um menu, e a sequência é justamente a informação: o segundo
 * passo não existe antes do primeiro.
 */
function Estreia({
  passos,
  clienteId,
}: {
  passos: { feito: boolean; titulo: string; explica: string; acao: string; href: string }[]
  clienteId: string
}) {
  const prontos = passos.filter((passo) => passo.feito).length
  const proximo = passos.findIndex((passo) => !passo.feito)
  const faltam = passos.length - prontos

  return (
    <div className="px-5 py-5">
      <h2 className="text-[15px] font-bold tracking-[-0.01em]">
        {faltam === 1 ? 'Falta uma coisa' : `Faltam ${faltam} coisas`} para o WhatsApp responder
        sozinho
      </h2>

      <ol className="mt-4">
        {passos.map((passo, indice) => (
          <li
            key={passo.titulo}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft py-3 first:border-0 first:pt-0"
          >
            <span
              aria-hidden
              className={`grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                passo.feito
                  ? 'bg-emerald-400/15 text-ok'
                  : indice === proximo
                    ? 'bg-primary text-white'
                    : 'border border-line text-dim'
              }`}
            >
              {passo.feito ? '✓' : indice + 1}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`block text-[13.5px] font-semibold ${
                  passo.feito ? 'text-muted line-through decoration-line' : ''
                }`}
              >
                {passo.titulo}
              </span>
              {!passo.feito && (
                <span className="mt-0.5 block text-[12px] text-dim">{passo.explica}</span>
              )}
            </span>

            {indice === proximo && (
              <Link
                href={`/clientes/${clienteId}${passo.href}`}
                className="app-primary-button shrink-0 px-3.5 py-1.5 text-[12px]"
              >
                {passo.acao}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-line-soft pt-3 text-[11.5px] text-dim">
        {prontos} de {passos.length} prontos
      </p>
    </div>
  )
}

/**
 * Quem precisa de uma pessoa agora.
 *
 * A linha inteira é o botão e leva direto à conversa no Inbox: a fila da home
 * só vale se o caminho entre ver e responder for um clique.
 *
 * Os dois vazios são duas frases diferentes de propósito. "Ninguém escreveu
 * ainda" numa conta recém-configurada é notícia boa esperando a primeira
 * mensagem; "ninguém esperando" numa conta cheia é o dia em que o trabalho
 * acabou. Dizer a mesma coisa nos dois casos faria o segundo parecer defeito.
 */
function Fila({
  fila,
  clienteId,
  contatos,
}: {
  fila: Awaited<ReturnType<typeof filaDoPainel>>
  clienteId: string
  contatos: number
}) {
  const restantes = fila.total - fila.itens.length

  return (
    <div>
      <header className="flex items-center gap-3 px-5 py-3.5">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">Precisa de você</h2>
        {fila.total > 0 && (
          <span className="rounded-full bg-primary-weak px-2 py-0.5 text-[11.5px] font-bold text-primary-strong">
            {fila.total}
          </span>
        )}
        <span className="flex-1" />
        <Link
          href={`/clientes/${clienteId}/inbox`}
          className="text-[12px] font-semibold text-primary transition hover:opacity-80"
        >
          Abrir o Inbox
        </Link>
      </header>

      {fila.itens.length === 0 ? (
        <p className="border-t border-line-soft px-5 py-6 text-[13px] text-muted">
          {contatos === 0
            ? 'Está no ar e ninguém escreveu ainda. A primeira conversa aparece aqui assim que chegar.'
            : 'Ninguém esperando. O bot deu conta e nada ficou sem resposta.'}
        </p>
      ) : (
        <ul>
          {fila.itens.map((item) => (
            <LinhaDaFila key={item.contatoId} item={item} clienteId={clienteId} />
          ))}
        </ul>
      )}

      {restantes > 0 && (
        <p className="border-t border-line-soft px-5 py-2.5 text-[12px]">
          <Link
            href={`/clientes/${clienteId}/inbox`}
            className="font-semibold text-primary transition hover:opacity-80"
          >
            {restantes === 1 ? 'ver mais 1 na fila' : `ver os outros ${restantes} na fila`}
          </Link>
        </p>
      )}
    </div>
  )
}

function LinhaDaFila({ item, clienteId }: { item: ItemDaFila; clienteId: string }) {
  const pediu = item.motivo === 'pediu-pessoa'

  return (
    <li className="border-t border-line-soft">
      <Link
        href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(item.contatoId)}`}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition hover:bg-surface"
      >
        <span className="min-w-[140px] flex-1 truncate text-[13.5px] font-semibold">
          {item.nome ?? telefoneLegivel(item.telefone)}
        </span>

        <span
          className={`shrink-0 truncate text-[12px] ${pediu ? 'font-semibold text-aviso' : 'text-muted'}`}
        >
          {pediu ? (item.detalhe ?? 'pediu uma pessoa') : 'esperando resposta'}
        </span>

        <span className="w-[84px] shrink-0 text-right text-[12px] text-dim">
          {haQuantoTempo(item.desde)}
        </span>
      </Link>
    </li>
  )
}

// ---------------------------------------------------------------------------
// O placar
// ---------------------------------------------------------------------------

/**
 * O mês em duas frases, e não em quatro cartões.
 *
 * Quatro números do mesmo tamanho dizem que nenhum importa mais que os outros,
 * o que é sempre mentira — e é o formato que o dono reconheceu como "cara de
 * IA". Aqui cada número mora dentro da frase que o explica, e nenhum percentual
 * aparece sem a base e sem o mês passado ao lado: "26%" sozinho pode ser ótimo
 * ou péssimo.
 */
async function Numeros({ clienteId }: { clienteId: string }) {
  const [funil, tempos] = await Promise.all([medirFunil(clienteId), medirTempos(clienteId)])
  if (funil.atual.conversas === 0 && funil.anterior.conversas === 0) return null

  const contencao = funil.atual.conversas
    ? Math.round((funil.atual.resolvidasPeloBot / funil.atual.conversas) * 100)
    : 0
  const contencaoAnterior = funil.anterior.conversas
    ? Math.round((funil.anterior.resolvidasPeloBot / funil.anterior.conversas) * 100)
    : null

  return (
    <section className="app-card mb-[18px] px-5 py-4" aria-labelledby="titulo-mes">
      <h2 id="titulo-mes" className="text-[12.5px] font-bold text-muted">
        Este mês
      </h2>

      <p className="mt-2 text-[13.5px] leading-[1.7] text-soft">
        <strong className="text-[17px] font-bold tracking-[-0.02em] text-ink">
          {funil.atual.conversas}
        </strong>{' '}
        {funil.atual.conversas === 1 ? 'conversa' : 'conversas'}, e o bot resolveu{' '}
        <strong className="font-bold text-ink">{contencao}%</strong> delas
        {contencaoAnterior === null
          ? ' (não há mês anterior para comparar)'
          : ` — no mês passado foram ${contencaoAnterior}% de ${funil.anterior.conversas}`}
        .
      </p>

      {tempos.atual.entraramNaFila > 0 && (
        <p className="mt-1.5 text-[13.5px] leading-[1.7] text-soft">
          Quem precisou de uma pessoa esperou{' '}
          <strong className="font-bold text-ink">
            {comoDuracao(tempos.atual.medianaAteResponder)}
          </strong>{' '}
          pela primeira resposta na mediana, {comoDuracao(tempos.atual.mediaAteResponder)} na média
          — {tempos.atual.responderam} de {tempos.atual.entraramNaFila} respondidas.
        </p>
      )}

      {tempos.atual.responderam < tempos.atual.entraramNaFila && (
        <p className="mt-2 text-[12px] text-aviso">
          {tempos.atual.entraramNaFila - tempos.atual.responderam} conversa(s) entraram na fila e
          ninguém respondeu ainda — elas não entram na conta acima.
        </p>
      )}
    </section>
  )
}

/**
 * O que fechou nos últimos trinta dias.
 *
 * Some inteiro quando não há quadro ou quando nada fechou: um bloco de vendas
 * zerado numa conta que ainda não usa funil cobra por algo que ninguém
 * prometeu.
 */
async function Fechamentos({ clienteId }: { clienteId: string }) {
  const fechou = await fechamentos(clienteId)
  if (fechou.ganhos === 0 && fechou.perdidos === 0) return null

  return (
    <section className="app-card mb-[18px] px-5 py-4" aria-labelledby="titulo-fechamentos">
      <h2 id="titulo-fechamentos" className="text-[12.5px] font-bold text-muted">
        Fechamentos · últimos {fechou.dias} dias
      </h2>

      <p className="mt-2 text-[13.5px] leading-[1.7] text-soft">
        <strong className="text-[17px] font-bold tracking-[-0.02em] text-ok">
          {fechou.ganhos}
        </strong>{' '}
        {fechou.ganhos === 1 ? 'ganho' : 'ganhos'}
        {fechou.valor !== null && (
          <>
            , somando <strong className="font-bold text-ink">{comoDinheiro(fechou.valor)}</strong>
          </>
        )}
        {' · '}
        <strong className="font-bold text-ink">{fechou.perdidos}</strong>{' '}
        {fechou.perdidos === 1 ? 'perdido' : 'perdidos'}.
      </p>

      {fechou.valor === null && fechou.ganhos > 0 && (
        <p className="mt-1 text-[12px] text-dim">
          Nenhum dos ganhos tinha valor anotado — por isso não há soma aqui.
        </p>
      )}
    </section>
  )
}

/**
 * Quanto cada pessoa atendeu.
 *
 * **Só com duas pessoas ou mais.** Com uma, é a própria pessoa lendo o próprio
 * volume numa tabela chamada "desempenho" — cobrança sem destinatário, a mesma
 * razão pela qual a versão anterior já escondia a tabela vazia.
 *
 * Volume, e não tempo: a responsabilidade por um contato pode trocar de mãos no
 * meio, e dividir a espera entre quem assumiu depois seria cobrar de alguém o
 * atraso de outro.
 */
async function Pessoas({ clienteId }: { clienteId: string }) {
  const desempenho = await medirPessoas(clienteId)
  if (desempenho.length < 2) return null

  let equipe: MembroDaConta[] = []
  try {
    equipe = await membrosDaConta(clienteId)
  } catch (erro) {
    // A lista fala Postgres direto e pode estourar sem `DATABASE_URL`. Sem os
    // nomes o bloco ainda vale: os números continuam certos.
    console.error('[painel] não deu para ler a equipe', erro instanceof Error ? erro.message : erro)
  }

  return (
    <section className="app-card mb-[18px] overflow-hidden" aria-labelledby="titulo-pessoas">
      <header className="px-5 py-3.5">
        <h2 id="titulo-pessoas" className="text-[12.5px] font-bold text-muted">
          Quem atendeu · este mês
        </h2>
      </header>

      <ul>
        {desempenho.map((pessoa) => {
          const nome = equipe.find((membro) => membro.id === pessoa.usuarioId)?.nome
          return (
            <li
              key={pessoa.usuarioId}
              className="flex items-center gap-4 border-t border-line-soft px-5 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {nome ?? 'alguém que saiu da conta'}
              </span>
              <span className="whitespace-nowrap text-[12px] text-dim">
                <strong className="font-semibold text-soft">{pessoa.atendimentos}</strong>{' '}
                {pessoa.atendimentos === 1 ? 'atendimento' : 'atendimentos'}
              </span>
              <span className="whitespace-nowrap text-[12px] text-dim">
                <strong className="font-semibold text-soft">{pessoa.fechados}</strong> fechados
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/** "3 min", "1h20", "2 dias". `null` vira travessão: não há o que dizer. */
function comoDuracao(segundos: number | null): string {
  if (segundos === null) return '—'
  if (segundos < 60) return `${Math.round(segundos)}s`

  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) {
    const resto = minutos % 60
    return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`
  }

  const dias = Math.round(horas / 24)
  return dias === 1 ? '1 dia' : `${dias} dias`
}

/**
 * "há 12 min", "há 1h20", "há 3 dias" — calculado no servidor.
 *
 * A mesma régua de `comoDuracao`, de propósito: a espera na fila e o tempo de
 * resposta do mês são a mesma grandeza, e duas escalas diferentes na mesma tela
 * dariam "1h20" aqui e "80 min" ali.
 */
function haQuantoTempo(desde: string): string {
  const segundos = (Date.now() - new Date(desde).getTime()) / 1000
  if (!Number.isFinite(segundos) || segundos < 0) return ''
  if (segundos < 60) return 'agora'
  return `há ${comoDuracao(segundos)}`
}
