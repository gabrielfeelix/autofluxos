import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FichaDoCliente } from '@/components/cliente/ficha'
import { ClienteShell } from '@/components/design/cliente-shell'
import { acaoRemoverLogo, acaoSalvarCadastro, acaoSalvarLogo } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarEsperandoPessoa, contarLeads } from '@/server/repos/leads'
import {
  medirFunil,
  medirPessoas,
  medirTempos,
  serieDiaria,
  type MedidasDoMes,
} from '@/server/repos/metricas'
import { GraficoDaSerie } from '@/components/cliente/grafico'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * A primeira tela do cliente responde uma pergunta só: **ele está sendo
 * atendido agora?**
 *
 * Três coisas precisam ser verdade ao mesmo tempo para o bot responder no
 * WhatsApp — existir fluxo publicado, existir número conectado, e o número
 * apontar para um fluxo que está no ar. Cada uma tinha a sua tela, então
 * descobrir que faltava a segunda exigia visitar as três. Aqui a resposta vem
 * antes de qualquer navegação, e quando é "não", diz qual peça falta.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="inicio">
      <main className="max-w-[1000px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <header className="mb-5">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Painel</h1>
          <p className="mt-1 text-[13px] text-muted">{cliente.nome}</p>
        </header>

        <Suspense fallback={<div className="app-card mb-[18px] h-[104px] animate-pulse" />}>
          <Atendimento clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={<div className="app-card mb-[18px] h-[96px] animate-pulse" />}>
          <Funil clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={<div className="app-card mb-[18px] h-[110px] animate-pulse" />}>
          <Tempos clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={<div className="app-card mb-[18px] h-[240px] animate-pulse" />}>
          <Serie clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={<div className="app-card mb-[18px] h-[120px] animate-pulse" />}>
          <Pessoas clienteId={cliente.id} />
        </Suspense>

        <FichaDoCliente
          cliente={cliente}
          salvarCadastro={acaoSalvarCadastro.bind(null, cliente.id)}
          salvarLogo={acaoSalvarLogo.bind(null, cliente.id)}
          removerLogo={acaoRemoverLogo.bind(null, cliente.id)}
        />
      </main>
    </ClienteShell>
  )
}

async function Funil({ clienteId }: { clienteId: string }) {
  const funil = await medirFunil(clienteId)
  const percentual = funil.atual.conversas
    ? Math.round((funil.atual.resolvidasPeloBot / funil.atual.conversas) * 100)
    : 0
  const percentualAnterior = funil.anterior.conversas
    ? Math.round((funil.anterior.resolvidasPeloBot / funil.anterior.conversas) * 100)
    : 0

  return (
    <section className="app-card mb-[18px] px-6 py-5" aria-labelledby="titulo-funil">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-[130px]">
          <h2 id="titulo-funil" className="text-[12px] font-bold uppercase tracking-[0.08em] text-dim">
            Este mês
          </h2>
          <p className="mt-1 text-[11.5px] text-dim">Mês passado: {resumoDoMes(funil.anterior)}</p>
        </div>

        <span aria-hidden className="h-[38px] w-px bg-white/[0.07]" />

        <Medida valor={funil.atual.conversas} rotulo="conversas" />
        <Medida
          valor={funil.atual.resolvidasPeloBot}
          rotulo={`resolvidas pelo bot (${percentual}%)`}
        />
        <Medida
          valor={funil.atual.esperandoPessoa}
          rotulo="esperando pessoa"
          alerta={funil.atual.esperandoPessoa > 0}
        />
      </div>

      {/*
        A barra proporcional em vez dos números soltos (§3.1 do plano).
        
        "26%" sozinho não é informação — 26% pode ser ótimo ou péssimo. O que dá
        referência é a proporção desenhada **e** o mesmo número do mês passado
        ao lado. Sem conversa nenhuma ela não aparece: uma barra vazia com 0%
        parece um bot que falhou, quando o que houve foi ninguém escrever.
      */}
      {funil.atual.conversas > 0 && (
        <div className="mt-4">
          <div
            className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]"
            role="img"
            aria-label={`${percentual}% das conversas resolvidas pelo bot`}
          >
            <span className="bg-emerald-400/80" style={{ width: `${percentual}%` }} />
            <span
              className="bg-rose-400/70"
              style={{
                width: `${funil.atual.conversas ? Math.round((funil.atual.esperandoPessoa / funil.atual.conversas) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-dim">
            O bot resolveu <strong className="text-soft">{percentual}%</strong> —{' '}
            {funil.anterior.conversas === 0
              ? 'não há mês anterior para comparar'
              : `no mês passado foram ${percentualAnterior}%`}
          </p>
        </div>
      )}
    </section>
  )
}

/**
 * Quanto alguém esperou.
 *
 * Mediana **e** média lado a lado, sempre — ver `medirTempos`. Mostrar só a
 * média esconde a conversa esquecida no fim de semana dentro de um número
 * razoável; mostrar só a mediana esconde que ela existiu.
 */
async function Tempos({ clienteId }: { clienteId: string }) {
  const tempos = await medirTempos(clienteId)
  if (tempos.atual.entraramNaFila === 0) return null

  return (
    <section className="app-card mb-[18px] px-6 py-5" aria-labelledby="titulo-tempos">
      <h2
        id="titulo-tempos"
        className="text-[12px] font-bold tracking-[0.08em] text-dim uppercase"
      >
        Tempo de atendimento · este mês
      </h2>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Tempo
          rotulo="Até a primeira resposta"
          mediana={tempos.atual.medianaAteResponder}
          media={tempos.atual.mediaAteResponder}
          detalhe={`${tempos.atual.responderam} de ${tempos.atual.entraramNaFila} respondidas`}
        />
        <Tempo
          rotulo="Até o fechamento"
          mediana={tempos.atual.medianaAteFechar}
          media={tempos.atual.mediaAteFechar}
          detalhe={`${tempos.atual.fecharam} de ${tempos.atual.entraramNaFila} fechadas`}
        />
      </div>

      {tempos.atual.responderam < tempos.atual.entraramNaFila && (
        <p className="mt-3 text-[11.5px] text-amber-200">
          {tempos.atual.entraramNaFila - tempos.atual.responderam} conversa(s) entraram na fila e
          ninguém respondeu ainda — elas não entram na conta acima.
        </p>
      )}
    </section>
  )
}

function Tempo({
  rotulo,
  mediana,
  media,
  detalhe,
}: {
  rotulo: string
  mediana: number | null
  media: number | null
  detalhe: string
}) {
  return (
    <div className="rounded-[11px] border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <p className="text-[11.5px] font-semibold text-muted">{rotulo}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <strong className="text-[20px] font-bold tracking-[-0.02em]">
          {comoDuracao(mediana)}
        </strong>
        <span className="text-[11px] text-dim">mediana</span>
      </p>
      <p className="mt-0.5 text-[11px] text-dim">
        média {comoDuracao(media)} · {detalhe}
      </p>
    </div>
  )
}

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

async function Serie({ clienteId }: { clienteId: string }) {
  const serie = await serieDiaria(clienteId)
  return <GraficoDaSerie serie={serie} />
}

/**
 * Quanto cada pessoa atendeu.
 *
 * Não aparece quando não há ninguém atribuído: uma tabela vazia de "desempenho
 * pessoal" numa conta sem equipe é uma cobrança sem destinatário.
 */
async function Pessoas({ clienteId }: { clienteId: string }) {
  const desempenho = await medirPessoas(clienteId)
  if (desempenho.length === 0) return null

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
      <header className="border-b border-white/[0.06] px-6 py-4">
        <h2
          id="titulo-pessoas"
          className="text-[12px] font-bold tracking-[0.08em] text-dim uppercase"
        >
          Quem atendeu · este mês
        </h2>
        <p className="mt-1 text-[11.5px] text-dim">
          Volume, e não tempo: a responsabilidade por um contato pode trocar de
          mãos no meio, e dividir a espera entre quem assumiu depois seria cobrar
          de alguém o atraso de outro.
        </p>
      </header>

      <ul>
        {desempenho.map((pessoa) => {
          const nome = equipe.find((m) => m.id === pessoa.usuarioId)?.nome
          return (
            <li
              key={pessoa.usuarioId}
              className="flex items-center gap-4 border-b border-white/[0.045] px-6 py-3 last:border-0"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {nome ?? 'alguém que saiu da conta'}
              </span>
              <span className="whitespace-nowrap text-[11.5px] text-dim">
                <strong className="font-semibold text-soft">{pessoa.atendimentos}</strong>{' '}
                {pessoa.atendimentos === 1 ? 'atendimento' : 'atendimentos'}
              </span>
              <span className="whitespace-nowrap text-[11.5px] text-dim">
                <strong className="font-semibold text-soft">{pessoa.fechados}</strong> fechados
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function resumoDoMes(medidas: MedidasDoMes): string {
  return `${medidas.conversas} conversas · ${medidas.resolvidasPeloBot} pelo bot · ${medidas.esperandoPessoa} para pessoa`
}

async function Atendimento({ clienteId }: { clienteId: string }) {
  // Só a contagem, e não a lista inteira: esta tela abre a cada visita ao
  // cliente e o único uso dos leads aqui é o número de quem espera pessoa.
  const [fluxos, canais, totalDeLeads, esperando] = await Promise.all([
    listarFluxos(clienteId),
    listarCanais(clienteId),
    contarLeads(clienteId),
    contarEsperandoPessoa(clienteId),
  ])

  const noAr = fluxos.filter((fluxo) => fluxo.versaoPublicadaId)
  const publicados = new Set(noAr.map((fluxo) => fluxo.id))
  const atendendo = canais.filter((canal) => canal.flowId && publicados.has(canal.flowId))

  // A ordem importa: a primeira peça que falta é a que adianta resolver. Listar
  // tudo que está errado de uma vez faz parecer que há quatro problemas quando
  // há um, e os seguintes às vezes somem sozinhos quando o primeiro sai.
  const pendencia =
    fluxos.length === 0
      ? { texto: 'Nenhum fluxo desenhado ainda.', acao: 'Criar o primeiro fluxo', href: '/fluxos' }
      : noAr.length === 0
        ? {
            texto: 'Nenhum fluxo publicado — o desenho existe, mas não atende ninguém.',
            acao: 'Abrir os fluxos',
            href: '/fluxos',
          }
        : canais.length === 0
          ? {
              texto: 'Nenhum número conectado — sem isso o WhatsApp não chega até aqui.',
              acao: 'Conectar um número',
              href: '/numero',
            }
          : atendendo.length === 0
            ? {
                texto: 'O número conectado não aponta para um fluxo publicado.',
                acao: 'Ajustar o número',
                href: '/numero',
              }
            : null

  return (
    <section
      className={`app-card mb-[18px] px-6 py-5 ${pendencia ? 'border-amber-300/25' : 'border-emerald-400/20'}`}
    >
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <p className="flex items-center gap-2.5 text-[15px] font-bold">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${pendencia ? 'bg-amber-300' : 'bg-emerald-400'}`}
          />
          {pendencia ? 'Ainda não está atendendo' : 'Atendendo no WhatsApp'}
        </p>

        <span aria-hidden className="h-[26px] w-px bg-white/[0.07]" />

        <Medida valor={noAr.length} rotulo={noAr.length === 1 ? 'fluxo no ar' : 'fluxos no ar'} />
        <Medida valor={canais.length} rotulo={canais.length === 1 ? 'número' : 'números'} />
        <Medida valor={totalDeLeads} rotulo="contatos" />
        <Medida valor={esperando} rotulo="esperando" alerta={esperando > 0} />

        <span className="flex-1" />

        <Link
          href={`/clientes/${clienteId}/leads`}
          className="text-[13px] font-bold text-accent transition hover:opacity-80"
        >
          Ver leads →
        </Link>
      </div>

      {pendencia && (
        <p className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3.5 text-[12.5px] text-amber-200">
          {pendencia.texto}
          <Link
            href={`/clientes/${clienteId}${pendencia.href}`}
            className="rounded-lg border border-amber-300/30 bg-amber-300/[0.08] px-2.5 py-1 text-[11.5px] font-bold transition hover:bg-amber-300/[0.14]"
          >
            {pendencia.acao} →
          </Link>
        </p>
      )}
    </section>
  )
}

function Medida({ valor, rotulo, alerta }: { valor: number; rotulo: string; alerta?: boolean }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <strong className={`text-[19px] tracking-[-0.02em] ${alerta ? 'text-rose-300' : ''}`}>
        {valor}
      </strong>
      <span className="text-[11.5px] text-muted">{rotulo}</span>
    </p>
  )
}
