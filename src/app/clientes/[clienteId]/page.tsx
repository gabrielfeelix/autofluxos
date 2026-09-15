import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ComoFunciona } from '@/components/cliente/como-funciona'
import { IconeAutomacao, IconeConversa, IconeFunil } from '@/components/cliente/icones'
import { PrimeirosPassos, type PassoDaConta } from '@/components/cliente/primeiros-passos'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Avatar } from '@/components/inbox/avatar'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { comoDinheiro } from '@/core/crm'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarLeads } from '@/server/repos/leads'
import { medirFunil, medirPessoas, medirTempos } from '@/server/repos/metricas'
import { fechamentos, filaDoPainel, type ItemDaFila } from '@/server/repos/painel'
import { listarQuadros } from '@/server/repos/quadros'
import { sessaoAtual } from '@/server/sessao'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'

export const dynamic = 'force-dynamic'

/**
 * A tela de boas-vindas — a primeira coisa que alguém vê ao abrir a conta.
 *
 * Ela responde três perguntas, nesta ordem: **o atendimento está de pé?**,
 * **quem está esperando por mim agora?** e, para quem acabou de chegar, **o que
 * eu faço primeiro?**. A defesa de cada escolha está em `docs/PLANO-HOMEPAGE.md`.
 *
 * Duas colunas de propósito. O checklist de primeiros passos é importante e não
 * é o produto: em largura cheia ele transforma a conta num formulário a
 * preencher, e some da tela no dia em que termina, deixando um buraco. Encostado
 * na lateral, ele acompanha enquanto o meio mostra o produto — e quando acaba,
 * a mesma coluna passa a carregar o resumo do mês.
 *
 * O que sobreviveu inteiro da versão anterior é o princípio da faixa de estado:
 * as três condições para o bot responder moravam em três telas, e descobrir qual
 * faltava exigia visitar as três. Aqui a resposta vem antes de qualquer
 * navegação e, quando é "não", diz **qual peça** falta.
 *
 * As consultas do topo são baratas de propósito (contagens e listas curtas) e
 * por isso são esperadas aqui, antes da primeira pintura: elas decidem o
 * **formato** da tela, e um `Suspense` em volta faria a página trocar de layout
 * na frente de quem está lendo. As caras — fila, mês, fechamentos — ficam cada
 * uma no seu `Suspense`.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [sessao, fluxos, canais, contatos, quadros] = await Promise.all([
    sessaoAtual(),
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    contarLeads(cliente.id),
    listarQuadros(cliente.id),
  ])

  const noAr = fluxos.filter((fluxo) => fluxo.versaoPublicadaId)
  const publicados = new Set(noAr.map((fluxo) => fluxo.id))
  const atendendo = canais.filter((canal) => canal.flowId && publicados.has(canal.flowId))
  const primeiroNome = (sessao?.usuario.nome ?? '').trim().split(/\s+/)[0] ?? ''

  const passos = passosDaConta({
    clienteId: cliente.id,
    temFluxo: fluxos.length > 0,
    temPublicado: noAr.length > 0,
    temCanal: canais.length > 0,
    temContato: contatos > 0,
    temQuadro: quadros.length > 0,
  })
  const faltaPasso = passos.some((passo) => !passo.feito)

  return (
    <ClienteShell cliente={cliente} ativa="inicio">
      <main className="mx-auto w-full max-w-[1280px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <header className="mb-5">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] md:text-[27px]">
            {faltaPasso
              ? `Que bom ter você aqui${primeiroNome ? `, ${primeiroNome}` : ''}!`
              : `Olá${primeiroNome ? `, ${primeiroNome}` : ''}`}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {faltaPasso
              ? `Vamos deixar o atendimento de ${cliente.nome} rodando sozinho.`
              : `O atendimento de ${cliente.nome}, hoje.`}
          </p>
        </header>

        <Estado
          clienteId={cliente.id}
          fluxos={fluxos.length}
          publicados={noAr.length}
          canais={canais.length}
          atendendo={atendendo.length}
          contatos={contatos}
        />

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Atalhos clienteId={cliente.id} />

            <Suspense fallback={<div className="app-card h-[220px] animate-pulse" />}>
              <Fila clienteId={cliente.id} contatos={contatos} />
            </Suspense>

            <ComoFunciona />
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            {faltaPasso && <PrimeirosPassos passos={passos} />}

            <Suspense fallback={<div className="app-card h-[128px] animate-pulse" />}>
              <Numeros clienteId={cliente.id} />
            </Suspense>

            <Suspense fallback={null}>
              <Fechamentos clienteId={cliente.id} />
            </Suspense>

            <Suspense fallback={null}>
              <Pessoas clienteId={cliente.id} />
            </Suspense>
          </aside>
        </div>
      </main>
    </ClienteShell>
  )
}

// ---------------------------------------------------------------------------
// Primeiros passos
// ---------------------------------------------------------------------------

/**
 * Os cinco passos, e por que são estes.
 *
 * **Canal, e não "WhatsApp".** A versão anterior dizia "faltam três coisas para
 * o WhatsApp responder sozinho" e presumia o canal errado metade das vezes:
 * tem quem chegue para atender o direct do Instagram, e tem quem chegue por
 * causa de anúncio. O passo é um só, com três caminhos, e a escolha é de quem
 * abriu a conta.
 *
 * O primeiro já vem feito: a conta existe porque quem lê a criou. Barra em zero
 * parece castigo, e o primeiro progresso é o que faz alguém querer o segundo.
 *
 * "O número aponta para uma automação publicada" **não** é passo daqui — é
 * consequência dos outros dois e vive na faixa de estado, que é o lugar de
 * dizer o que está quebrado agora.
 */
function passosDaConta({
  clienteId,
  temFluxo,
  temPublicado,
  temCanal,
  temContato,
  temQuadro,
}: {
  clienteId: string
  temFluxo: boolean
  temPublicado: boolean
  temCanal: boolean
  temContato: boolean
  temQuadro: boolean
}): PassoDaConta[] {
  const em = (caminho: string) => `/clientes/${clienteId}${caminho}`

  return [
    {
      chave: 'conta',
      titulo: 'Criar a conta',
      explica: 'Feito — esta conta é sua.',
      feito: true,
      acoes: [],
    },
    {
      chave: 'canal',
      titulo: 'Ligar um canal',
      explica:
        'Por onde as pessoas falam com o negócio: o WhatsApp da empresa, o direct do Instagram ou os anúncios que geram contato. Dá para ligar mais de um depois.',
      feito: temCanal,
      acoes: [
        { rotulo: 'WhatsApp', href: em('/ajustes/whatsapp') },
        { rotulo: 'Instagram', href: em('/ajustes/instagram') },
        { rotulo: 'Anúncios', href: em('/ajustes/anuncios') },
      ],
    },
    {
      chave: 'automacao',
      titulo: 'Publicar uma automação',
      explica: temFluxo
        ? 'O desenho existe, mas só atende depois de publicado — é a publicação que põe o roteiro no ar.'
        : 'O roteiro do que o bot responde sozinho: dúvida repetida, horário, preço, e quando chamar uma pessoa.',
      feito: temPublicado,
      acoes: [{ rotulo: temFluxo ? 'Abrir as automações' : 'Criar a primeira', href: em('/fluxos') }],
    },
    {
      chave: 'conversa',
      titulo: 'Receber a primeira conversa',
      explica:
        'Mande uma mensagem para o canal que você ligou, do seu próprio celular. Ela aparece no Inbox em segundos — é o teste que mostra tudo funcionando de ponta a ponta.',
      feito: temContato,
      acoes: [{ rotulo: 'Abrir o Inbox', href: em('/inbox') }],
    },
    {
      chave: 'funil',
      titulo: 'Organizar no funil',
      explica:
        'O quadro com as etapas da sua venda. Cada contato vira um cartão que anda até fechar, com valor e motivo de perda — é daqui que sai quanto o mês rendeu.',
      feito: temQuadro,
      acoes: [{ rotulo: 'Criar um funil', href: em('/quadros') }],
    },
  ]
}

// ---------------------------------------------------------------------------
// Estado do atendimento
// ---------------------------------------------------------------------------

function Estado({
  clienteId,
  fluxos,
  publicados,
  canais,
  atendendo,
  contatos,
}: {
  clienteId: string
  fluxos: number
  publicados: number
  canais: number
  atendendo: number
  contatos: number
}) {
  // A ordem importa: a primeira peça que falta é a que adianta resolver. Listar
  // tudo que está errado de uma vez faz parecer que há quatro problemas quando
  // há um, e os seguintes às vezes somem sozinhos quando o primeiro sai.
  const pendencia =
    canais === 0
      ? { texto: 'Nenhum canal ligado — nada chega até aqui ainda.', href: '/ajustes' }
      : fluxos === 0
        ? { texto: 'Nenhuma automação desenhada ainda.', href: '/fluxos' }
        : publicados === 0
          ? { texto: 'A automação existe, mas não está publicada.', href: '/fluxos' }
          : atendendo === 0
            ? { texto: 'O canal ligado não aponta para uma automação publicada.', href: '/ajustes' }
            : null

  return (
    <section
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[14px] border px-5 py-3.5 ${
        pendencia ? 'border-amber-300/35 bg-amber-300/[0.07]' : 'border-line bg-surface'
      }`}
    >
      <p className="flex items-center gap-2.5 text-[14px] font-bold">
        <span
          aria-hidden
          className={`size-2.5 rounded-full ${pendencia ? 'bg-amber-300' : 'bg-emerald-400'}`}
        />
        {pendencia ? 'Ainda não está atendendo' : 'Atendendo agora'}
      </p>

      <p className="text-[12.5px] text-muted">
        {pendencia ? (
          pendencia.texto
        ) : (
          <>
            {publicados} {publicados === 1 ? 'automação no ar' : 'automações no ar'} · {canais}{' '}
            {canais === 1 ? 'canal ligado' : 'canais ligados'} · {contatos}{' '}
            {contatos === 1 ? 'contato' : 'contatos'}
          </>
        )}
      </p>

      <span className="flex-1" />

      {pendencia && (
        <Link
          href={`/clientes/${clienteId}${pendencia.href}`}
          className="rounded-lg border border-amber-300/40 bg-amber-300/[0.12] px-3 py-1.5 text-[12px] font-bold transition hover:bg-amber-300/20 active:translate-y-px active:bg-amber-300/30"
        >
          Resolver
        </Link>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Atalhos
// ---------------------------------------------------------------------------

/**
 * Os três caminhos que alguém abre a conta para percorrer.
 *
 * Três, e não seis: a barra lateral já lista tudo. Isto aqui é a aposta de para
 * onde a pessoa ia clicar de qualquer jeito, e uma aposta com seis opções não é
 * aposta nenhuma.
 */
function Atalhos({ clienteId }: { clienteId: string }) {
  const atalhos = [
    {
      href: `/clientes/${clienteId}/inbox`,
      titulo: 'Inbox',
      texto: 'Responder quem está falando com o negócio agora.',
      icone: <IconeConversa className="size-[18px]" />,
    },
    {
      href: `/clientes/${clienteId}/quadros`,
      titulo: 'Funil',
      texto: 'Ver em que ponto cada negociação está.',
      icone: <IconeFunil className="size-[18px]" />,
    },
    {
      href: `/clientes/${clienteId}/fluxos`,
      titulo: 'Automações',
      texto: 'Desenhar e publicar o que o bot responde.',
      icone: <IconeAutomacao className="size-[18px]" />,
    },
  ]

  return (
    <nav aria-label="Atalhos" className="grid gap-3 sm:grid-cols-3">
      {atalhos.map((atalho) => (
        <Link
          key={atalho.href}
          href={atalho.href}
          className="app-card app-card-interactive group flex items-start gap-3 px-4 py-3.5"
        >
          <span
            aria-hidden
            className="mt-px grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary-weak text-primary-strong transition group-hover:bg-primary group-hover:text-white"
          >
            {atalho.icone}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between text-[13.5px] font-bold">
              {atalho.titulo}
              <span
                aria-hidden
                className="text-[13px] text-dim transition group-hover:translate-x-0.5 group-hover:text-primary"
              >
                ›
              </span>
            </span>
            <span className="mt-1 block text-[11.5px] leading-[1.45] text-dim">{atalho.texto}</span>
          </span>
        </Link>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// A fila
// ---------------------------------------------------------------------------

/**
 * Quem precisa de uma pessoa agora.
 *
 * A linha inteira é o botão e leva direto à conversa no Inbox: a fila da tela
 * inicial só vale se o caminho entre ver e responder for um clique.
 *
 * Os dois vazios são duas frases diferentes de propósito. "Ninguém escreveu
 * ainda" numa conta recém-ligada é notícia boa esperando a primeira mensagem;
 * "ninguém esperando" numa conta cheia é o dia em que o trabalho acabou. Dizer
 * a mesma coisa nos dois casos faria o segundo parecer defeito.
 */
async function Fila({ clienteId, contatos }: { clienteId: string; contatos: number }) {
  const fila = await filaDoPainel(clienteId)
  const restantes = fila.total - fila.itens.length

  return (
    <section className="app-card overflow-hidden" aria-labelledby="titulo-fila">
      <header className="flex items-center gap-3 px-5 py-3.5">
        <h2 id="titulo-fila" className="text-[15px] font-bold tracking-[-0.01em]">
          Precisa de você
        </h2>
        {fila.total > 0 && (
          <span className="rounded-full bg-primary-weak px-2 py-0.5 text-[11.5px] font-bold text-primary-strong">
            {fila.total}
          </span>
        )}
        <span className="flex-1" />
        <Link
          href={`/clientes/${clienteId}/inbox`}
          className="text-[12px] font-semibold text-primary transition hover:opacity-80 active:opacity-60"
        >
          Abrir o Inbox
        </Link>
      </header>

      {fila.itens.length === 0 ? (
        <p className="border-t border-line-soft px-5 py-8 text-center text-[13px] text-muted">
          {contatos === 0
            ? 'Ninguém escreveu ainda. A primeira conversa aparece aqui assim que chegar.'
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
    </section>
  )
}

function LinhaDaFila({ item, clienteId }: { item: ItemDaFila; clienteId: string }) {
  const pediu = item.motivo === 'pediu-pessoa'

  return (
    <li className="border-t border-line-soft">
      <Link
        href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(item.contatoId)}`}
        className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-5 py-2.5 transition hover:bg-surface active:bg-surface-strong"
      >
        {/*
          As iniciais, e não uma foto: a Cloud API não entrega foto de perfil de
          contato — o único `profile_picture_url` que existe é o do próprio
          negócio. O avatar é o mesmo do Inbox de propósito, com a mesma cor por
          nome, para a pessoa que você viu aqui ser reconhecida lá.
        */}
        <Avatar nome={item.nome} alerta={pediu} tamanho={32} />

        <span className="min-w-[120px] flex-1 truncate text-[13.5px] font-semibold">
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
// O placar, na coluna da direita
// ---------------------------------------------------------------------------

/**
 * O mês em frases, e não em cartões de número.
 *
 * Quatro números do mesmo tamanho dizem que nenhum importa mais que os outros, o
 * que é sempre mentira — e é o formato que o dono reconheceu como "cara de IA".
 * Aqui cada número mora dentro da frase que o explica, e nenhum percentual
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
    <section className="app-card px-5 py-4" aria-labelledby="titulo-mes">
      <h2 id="titulo-mes" className="text-[12.5px] font-bold text-muted">
        Este mês
      </h2>

      <p className="mt-2 text-[13px] leading-[1.7] text-soft">
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
        <p className="mt-2 text-[13px] leading-[1.7] text-soft">
          Quem precisou de uma pessoa esperou{' '}
          <strong className="font-bold text-ink">
            {comoDuracao(tempos.atual.medianaAteResponder)}
          </strong>{' '}
          pela primeira resposta na mediana, {comoDuracao(tempos.atual.mediaAteResponder)} na média —{' '}
          {tempos.atual.responderam} de {tempos.atual.entraramNaFila} respondidas.
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
 * zerado numa conta que ainda não usa funil cobra por algo que ninguém prometeu.
 */
async function Fechamentos({ clienteId }: { clienteId: string }) {
  const fechou = await fechamentos(clienteId)
  if (fechou.ganhos === 0 && fechou.perdidos === 0) return null

  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-fechamentos">
      <h2 id="titulo-fechamentos" className="text-[12.5px] font-bold text-muted">
        Fechamentos · últimos {fechou.dias} dias
      </h2>

      <p className="mt-2 text-[13px] leading-[1.7] text-soft">
        <strong className="text-[17px] font-bold tracking-[-0.02em] text-ok">{fechou.ganhos}</strong>{' '}
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
    <section className="app-card overflow-hidden" aria-labelledby="titulo-pessoas">
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
              className="flex items-center gap-3 border-t border-line-soft px-5 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                {nome ?? 'alguém que saiu da conta'}
              </span>
              <span className="whitespace-nowrap text-[11.5px] text-dim">
                <strong className="font-semibold text-soft">{pessoa.atendimentos}</strong> atend. ·{' '}
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
