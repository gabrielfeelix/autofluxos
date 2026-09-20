import Link from 'next/link'
import { acessoCompleto } from '@/server/permissoes'
import { pode } from '@/core/permissoes'
import { onboardingDaConta } from '@/server/repos/onboarding'
import { passosDoOnboarding } from '@/core/onboarding'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ComoFunciona } from '@/components/cliente/como-funciona'
import { IconeAutomacao, IconeConversa, IconeFunil } from '@/components/cliente/icones'
import { PrimeirosPassos, type PassoDaConta } from '@/components/cliente/primeiros-passos'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Esqueleto, EsqueletoDeLista } from '@/components/design/esqueleto'
import { Avatar } from '@/components/inbox/avatar'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { comoDinheiro } from '@/core/crm'
import { cobra, type Objetivo } from '@/core/objetivo-da-conta'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarLeads } from '@/server/repos/leads'
import {
  taxaDeAutomacao,
  taxaDeFalha,
  terminadas,
  total,
} from '@/core/desfecho-da-conversa'
import { medirDesfechos, medirPessoas, medirTempos } from '@/server/repos/metricas'
import { comentariosDaConta, notasDaConta } from '@/server/repos/avaliacoes'
import { comoVai, resumirNps } from '@/core/nps'
import { fechamentos, filaDoPainel, type ItemDaFila } from '@/server/repos/painel'
import { clientesSumidos, faixasDaConta } from '@/server/repos/relacionamento'
import {
  CLASSE_DO_NIVEL,
  CORTES_DE_RECENCIA,
  diasDesde,
  FAIXAS_PADRAO,
  nivelPor,
  ROTULO_DO_NIVEL,
} from '@/core/relacionamento'
import { listarQuadros } from '@/server/repos/quadros'
import { recursosDaConta } from '@/server/repos/recursos'
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

  const acesso = await acessoCompleto(clienteId)
  const configura = pode(acesso.regras, 'configurar_operacao', 'todos')
  const onboarding = configura ? await onboardingDaConta(clienteId) : null
  const [sessao, fluxos, canais, contatos, quadros, recursos] = await Promise.all([
    sessaoAtual(),
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    contarLeads(cliente.id),
    listarQuadros(cliente.id),
    recursosDaConta(cliente.id),
  ])

  const noAr = fluxos.filter((fluxo) => fluxo.versaoPublicadaId)
  const publicados = new Set(noAr.map((fluxo) => fluxo.id))
  const atendendo = canais.filter((canal) => canal.flowId && publicados.has(canal.flowId))
  const primeiroNome = (sessao?.usuario.nome ?? '').trim().split(/\s+/)[0] ?? ''

  const passos = passosDaConta({
    clienteId: cliente.id,
    objetivo: recursos.objetivo,
    opcionais: passosDoOnboarding(recursos.objetivo, onboarding),
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
              ? `Vamos organizar o atendimento de ${cliente.nome}.`
              : `O atendimento de ${cliente.nome}, hoje.`}
          </p>
        </header>

        {configura && onboarding?.status !== 'concluido' && <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary-weak p-5">
          <div><h2 className="text-sm font-bold">{onboarding ? 'Continue preparando sua empresa' : 'Deixe o sistema com a sua cara'}</h2><p className="mt-1 text-xs leading-5 text-muted">Escolha como atender e quais modelos ajudam sua rotina. O que você já configurou será preservado.</p></div>
          <Link href={`/clientes/${cliente.id}/configurar`} className="app-primary-button px-4 py-2.5 text-xs">{onboarding ? 'Continuar preparação' : 'Personalizar sistema'} →</Link>
        </section>}
        {!configura && <section className="app-card mb-5 p-5"><h2 className="text-sm font-bold">Sua rotina começa aqui</h2><p className="mt-2 text-sm leading-6 text-muted">Responda conversas no Inbox, acompanhe seus lembretes em Atividades e consulte os dados em Contatos.</p><div className="mt-3 flex flex-wrap gap-4 text-sm text-primary"><Link href={`/clientes/${cliente.id}/inbox`}>Abrir Inbox →</Link><Link href={`/clientes/${cliente.id}/atividades`}>Ver atividades →</Link><Link href={`/clientes/${cliente.id}/leads`}>Ver contatos →</Link></div></section>}

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

            <Suspense fallback={<EsqueletoDeLista linhas={3} comRosto rotulo="Carregando a fila…" />}>
              <Fila clienteId={cliente.id} contatos={contatos} />
            </Suspense>

            <ComoFunciona />
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            {configura && faltaPasso && <PrimeirosPassos passos={passos} />}

            <Suspense
              fallback={
                <div className="app-card flex flex-col gap-3 p-4">
                  <Esqueleto className="h-3 w-24" />
                  <Esqueleto className="h-7 w-32" />
                  <Esqueleto className="h-2.5 w-full" />
                </div>
              }
            >
              <Numeros clienteId={cliente.id} />
            </Suspense>

            <Suspense fallback={null}>
              <Fechamentos clienteId={cliente.id} />
            </Suspense>

            {/* Logo abaixo dos fechamentos, e não no fim: "entrou tanto" e
                "está saindo tanto" são a mesma conta lida dos dois lados. */}
            <Suspense fallback={null}>
              <ClientesSumindo clienteId={cliente.id} />
            </Suspense>

            <Suspense fallback={null}>
              <Satisfacao clienteId={cliente.id} />
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
 * Os passos, e por que não são sempre os mesmos.
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
 * "O número aponta para uma automação publicada" **não** é passo daqui: é
 * consequência dos outros dois e vive na faixa de estado, que é o lugar de
 * dizer o que está quebrado agora.
 *
 * ---------------------------------------------------------------------------
 * O defeito que a T7.1 corrigiu aqui
 * ---------------------------------------------------------------------------
 *
 * Eram **cinco passos fixos**, e os dois últimos eram "Publicar uma automação" e
 * "Organizar no funil". Quem abriu a conta para atender no WhatsApp com a
 * própria equipe fazia as três primeiras, terminava o que queria, e a tela
 * seguia dizendo que faltavam duas coisas, para sempre.
 *
 * Isso não é ruído: barra que nunca fecha ensina a ignorar a barra, e a partir
 * daí também se ignora o aviso de canal desligado, que é o que realmente
 * derruba o atendimento.
 *
 * Agora quem decide é o objetivo da conta (`core/objetivo-da-conta.ts`), e
 * `cobra()` é a única fonte: repetir a regra aqui em `if` faria as duas
 * divergirem no primeiro ajuste. Conta que escolheu **atender** vê três passos,
 * e os três fecham.
 */
function passosDaConta({
  clienteId,
  objetivo,
  opcionais,
  temFluxo,
  temPublicado,
  temCanal,
  temContato,
  temQuadro,
}: {
  clienteId: string
  objetivo: Objetivo
  opcionais?: { automacao: boolean; funil: boolean }
  temFluxo: boolean
  temPublicado: boolean
  temCanal: boolean
  temContato: boolean
  temQuadro: boolean
}): PassoDaConta[] {
  const em = (caminho: string) => `/clientes/${clienteId}${caminho}`

  const passos: PassoDaConta[] = [
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
        'O quadro com as etapas da sua venda. Cada contato vira um cartão que anda até fechar, com valor e motivo de perda: é daqui que sai quanto o mês rendeu.',
      feito: temQuadro,
      acoes: [{ rotulo: 'Criar um funil', href: em('/quadros') }],
    },
  ]

  /*
   * O filtro, e por que ele é por passo e não por índice.
   *
   * `conta`, `canal` e `conversa` ficam sempre: a conta existe, sem canal nada
   * chega, e a primeira conversa é o teste de ponta a ponta de qualquer
   * objetivo. Os dois que saem são exatamente os que `PASSOS_OPCIONAIS` nomeia,
   * e quem responde é `cobra()`.
   *
   * Passo já **feito** nunca é escondido, e essa linha é o que impede o pior
   * efeito colateral: quem montou um funil e depois trocou o objetivo para
   * "atender" veria o passo concluído desaparecer, e concluiria que o funil foi
   * apagado junto.
   */
  return passos.filter((passo) => {
    if (passo.chave === 'automacao') return passo.feito || (opcionais?.automacao ?? cobra(objetivo, 'automacao'))
    if (passo.chave === 'funil') return passo.feito || (opcionais?.funil ?? cobra(objetivo, 'funil'))
    return true
  })
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
 * que é sempre mentira, e é o formato que o dono reconheceu como "cara de IA".
 * Aqui cada número mora dentro da frase que o explica, e nenhum percentual
 * aparece sem a base e sem o mês passado ao lado: "26%" sozinho pode ser ótimo
 * ou péssimo.
 *
 * ---------------------------------------------------------------------------
 * O que a T8.2 consertou, e são três coisas na mesma frase
 * ---------------------------------------------------------------------------
 *
 * A frase era "N conversas, e o bot resolveu X% delas", com X saindo de
 * `encerrada / conversas`. Os três defeitos, e o que cada um fazia:
 *
 * 1. **toda transferência contava igual.** O fluxo que termina em "falar com a
 *    recepção" porque foi desenhado assim entrava no mesmo balde da conversa que
 *    caiu em alguém porque a integração estava fora. A clínica com 50% de
 *    transferências previstas lia "o bot só resolve 40%" e concluía que a
 *    automação era ruim, quando ela estava fazendo exatamente o combinado, e as
 *    5 falhas de verdade ficavam escondidas no meio;
 * 2. **`atendida_por_pessoa` não entrava em fatia nenhuma**, só no total. As
 *    partes não fechavam com o todo;
 * 3. **o denominador incluía conversa em andamento.** A taxa caía todo começo de
 *    mês sozinha, sem ninguém mexer em nada.
 *
 * Agora são duas frases, porque são duas perguntas diferentes: uma sobre a
 * automação, que o dono lê, e uma sobre o que quebrou, que gera conserto.
 */
async function Numeros({ clienteId }: { clienteId: string }) {
  const [desfechos, tempos] = await Promise.all([medirDesfechos(clienteId), medirTempos(clienteId)])
  const atual = desfechos.atual
  const anterior = desfechos.anterior
  if (total(atual) === 0 && total(anterior) === 0) return null

  const automacao = taxaDeAutomacao(atual)
  const automacaoAnterior = taxaDeAutomacao(anterior)
  const falha = taxaDeFalha(atual)
  const fechadas = terminadas(atual)

  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-mes">
      <h2 id="titulo-mes" className="text-[12.5px] font-bold text-muted">
        Este mês
      </h2>

      {/*
        A origem e o período ficam escritos, e não subentendidos (item 2 do
        plano). "Este mês" sozinho não diz se o mês é o corrente ou os últimos
        trinta dias, e a diferença muda o número.
      */}
      <p className="mt-1 text-[11px] text-dim">
        Conversas iniciadas no mês corrente, pelo fuso de São Paulo.
      </p>

      <p className="mt-2 text-[13px] leading-[1.7] text-soft">
        <strong className="text-[17px] font-bold tracking-[-0.02em] text-ink">{total(atual)}</strong>{' '}
        {total(atual) === 1 ? 'conversa' : 'conversas'}
        {automacao === null ? (
          // Nenhuma terminou ainda. Escrever "0%" aqui seria dizer que o bot
          // falhou em todas, quando o que houve foi o mês ter acabado de
          // começar (RB-06).
          <>, e nenhuma terminou ainda para medir a automação.</>
        ) : (
          <>
            , e a automação resolveu sozinha{' '}
            <strong className="font-bold text-ink">{automacao}%</strong> das{' '}
            {fechadas} que terminaram
            {automacaoAnterior === null
              ? ' (não há mês anterior para comparar)'
              : `: no mês passado foram ${automacaoAnterior}% de ${terminadas(anterior)}`}
            .
          </>
        )}
      </p>

      {/*
        As quatro fatias, escritas. Elas somam o número grande de propósito:
        painel cujas partes não fecham com o todo é painel que ninguém consegue
        conferir, e a primeira vez que alguém tenta somar e não bate, a tela
        inteira perde a credibilidade.
      */}
      {total(atual) > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1 text-[12px] text-soft">
          <FatiaDoMes rotulo="Resolvidas pela automação" quantas={atual.bot} de={total(atual)} />
          <FatiaDoMes
            rotulo="Transferidas como o fluxo previa"
            quantas={atual.prevista}
            de={total(atual)}
            dica="O bloco de transferir estava no fluxo: é o desenho funcionando, e não uma falha."
          />
          <FatiaDoMes
            rotulo="Transferidas por falha"
            quantas={atual.falha}
            de={total(atual)}
            atencao={atual.falha > 0}
            dica="O bot não conseguiu seguir: entrega que não saiu, IA sem modelo, integração fora do ar. Cada uma é um conserto possível."
          />
          {atual.aberta > 0 && (
            <FatiaDoMes
              rotulo="Ainda acontecendo"
              quantas={atual.aberta}
              de={total(atual)}
              dica="Fora da conta da automação: elas ainda podem terminar de qualquer jeito."
            />
          )}
        </ul>
      )}

      {falha !== null && falha > 0 && (
        <p className="mt-2 text-[12px] leading-[1.7] text-aviso">
          {atual.falha} {atual.falha === 1 ? 'conversa caiu' : 'conversas caíram'} no colo de alguém
          por falha ({falha}% das que terminaram). Isso é defeito, e não desenho.
        </p>
      )}

      {tempos.atual.entraramNaFila > 0 && (
        <p className="mt-2 text-[13px] leading-[1.7] text-soft">
          {/*
            **A espera é medida do pedido humano em diante**, e não do começo da
            conversa. `metricas_de_tempo` marca o relógio no handoff, que é quando
            alguém passou a dever resposta: contar a conversa inteira com o bot
            como espera do funcionário produz um número que nenhuma equipe
            reconhece, e que piora quanto melhor o bot for.
          */}
          Quem pediu uma pessoa esperou{' '}
          <strong className="font-bold text-ink">
            {comoDuracao(tempos.atual.medianaAteResponder)}
          </strong>{' '}
          pela primeira resposta na mediana, {comoDuracao(tempos.atual.mediaAteResponder)} na média,
          contando a partir do pedido: {tempos.atual.responderam} de {tempos.atual.entraramNaFila}{' '}
          respondidas.
        </p>
      )}

      {tempos.atual.responderam < tempos.atual.entraramNaFila && (
        <p className="mt-2 text-[12px] text-aviso">
          {tempos.atual.entraramNaFila - tempos.atual.responderam} conversa(s) entraram na fila e
          ninguém respondeu ainda: elas não entram na conta acima.
        </p>
      )}
    </section>
  )
}

/**
 * Uma linha do quebra-cabeça do mês.
 *
 * O percentual e a contagem juntos, sempre: "5%" sozinho não diz se são 5 de 100
 * ou 1 de 20, e as duas situações pedem reações diferentes.
 */
function FatiaDoMes({
  rotulo,
  quantas,
  de,
  dica,
  atencao = false,
}: {
  rotulo: string
  quantas: number
  de: number
  dica?: string
  atencao?: boolean
}) {
  return (
    <li className="flex items-baseline gap-2">
      <strong className={`font-bold tabular-nums ${atencao && quantas > 0 ? 'text-aviso' : 'text-ink'}`}>
        {quantas}
      </strong>
      <span className={atencao && quantas > 0 ? 'text-aviso' : 'text-soft'} title={dica}>
        {rotulo}
      </span>
      <span className="ml-auto shrink-0 text-[11px] text-dim tabular-nums">
        {de === 0 ? '—' : `${Math.round((quantas / de) * 100)}%`}
      </span>
    </li>
  )
}

/**
 * O que a pesquisa de satisfação colheu (0060).
 *
 * A pesquisa gravava desde a 0060 e **nenhuma tela lia**: a nota entrava no
 * banco e morria lá. Esta seção é o outro lado do bloco — sem ela, quem desenha
 * uma pesquisa no fluxo nunca descobre o resultado.
 *
 * **Some quando não há nota**, como Fechamentos: painel cheio de caixa zerada
 * ensina a pessoa a ignorar o painel. Quem nunca publicou uma pesquisa não
 * precisa saber que ela existe por um card vazio.
 *
 * Noventa dias porque NPS de uma semana é ruído: três respostas mudam o número
 * em dezenas de pontos, e o cliente conclui que o relatório é inútil.
 */
function inicioDoPeriodoDeSatisfacao() {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
}

async function Satisfacao({ clienteId }: { clienteId: string }) {
  const desde = inicioDoPeriodoDeSatisfacao()
  const [notas, comentarios] = await Promise.all([
    notasDaConta(clienteId, desde),
    comentariosDaConta(clienteId, desde, 5),
  ])
  if (notas.length === 0) return null

  const nps = resumirNps(notas)

  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-satisfacao">
      <h2 id="titulo-satisfacao" className="text-[12.5px] font-bold text-muted">
        Satisfação · últimos 90 dias
      </h2>

      <p className="mt-2 text-[13px] leading-[1.7] text-soft">
        <strong className="text-[17px] font-bold tracking-[-0.02em] text-ink">{nps.pontos}</strong>{' '}
        de NPS, {comoVai(nps.pontos)} · média{' '}
        <strong className="font-bold text-ink">{nps.media.toLocaleString('pt-BR')}</strong> em{' '}
        {nps.total} {nps.total === 1 ? 'resposta' : 'respostas'}.
      </p>

      <p className="mt-1 text-[12px] text-dim">
        {nps.promotores} {nps.promotores === 1 ? 'promotor' : 'promotores'} · {nps.neutros}{' '}
        {nps.neutros === 1 ? 'neutro' : 'neutros'} · {nps.detratores}{' '}
        {nps.detratores === 1 ? 'detrator' : 'detratores'}
      </p>

      {comentarios.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
          {comentarios.map((c) => (
            <li key={c.id} className="min-w-0">
              <p className="text-[12.5px] leading-5 text-soft">
                <strong className="tabular-nums text-ink">{c.nota}</strong> · {c.comentario}
              </p>
              <p className="text-[11px] text-dim">
                {c.nome ?? 'sem nome'} ·{' '}
                {new Date(c.criadaEm).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Quem já comprou e parou de falar.
 *
 * O painel respondia "quanto entrou" e "quem está esperando", e não respondia a
 * pergunta que custa mais caro: **quem já era cliente e está saindo em
 * silêncio**. Ninguém abre uma tela para descobrir isso — não há evento, não há
 * notificação, e o sintoma só aparece na renovação que não veio.
 *
 * Some quando não há ninguém, como todo bloco desta tela: painel que mostra
 * "0 clientes sumindo" todo dia ensina a pular o bloco, e aí ele deixa de ser
 * lido no dia em que tem três nomes.
 */
async function ClientesSumindo({ clienteId }: { clienteId: string }) {
  const [faixas, sumidos] = await Promise.all([
    faixasDaConta(clienteId),
    clientesSumidos(clienteId, CORTES_DE_RECENCIA.sumido, 5),
  ])
  if (sumidos.length === 0) return null

  return (
    <section className="app-card px-5 py-4" aria-labelledby="titulo-sumindo">
      <h2 id="titulo-sumindo" className="text-[12.5px] font-bold text-muted">
        Clientes sumindo
      </h2>

      <p className="mt-2 text-[13px] leading-[1.7] text-soft">
        <strong className="text-[17px] font-bold tracking-[-0.02em] text-aviso">
          {sumidos.length}
        </strong>{' '}
        {sumidos.length === 1 ? 'pessoa que já comprou' : 'pessoas que já compraram'} e não
        {sumidos.length === 1 ? ' fala' : ' falam'} há mais de {CORTES_DE_RECENCIA.sumido} dias.
      </p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {sumidos.map((sumido) => {
          const nivel = nivelPor(sumido.total, faixas ?? FAIXAS_PADRAO, 1)
          return (
            <li key={sumido.contatoId}>
              <Link
                href={`/clientes/${clienteId}/leads/${sumido.contatoId}`}
                className="flex items-center gap-2 text-[12px] text-soft transition hover:text-primary"
              >
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${CLASSE_DO_NIVEL[nivel]}`} />
                <span className="font-semibold">{ROTULO_DO_NIVEL[nivel]}</span>
                <span className="text-dim">·</span>
                {/* "R$ 0,00" aqui seria a tela dizendo que o cliente não gastou
                    nada, quando o que falta é o valor da compra (RB-06). */}
                <span className="text-dim">
                  {sumido.total > 0 ? comoDinheiro(sumido.total) : 'valor não informado'}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-dim">
                  {diasDesde(sumido.ultimaConversaEm) ?? 0}d calado
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* O caminho de sair da tela fazendo alguma coisa. Sem ele o bloco é uma
          má notícia sem saída, que é o tipo de aviso que as pessoas aprendem a
          ignorar. */}
      <Link
        href={`/clientes/${clienteId}/fluxos?aba=sequencias`}
        className="mt-3 inline-block text-[11.5px] font-semibold text-primary hover:underline"
      >
        Montar uma régua de retomada →
      </Link>
    </section>
  )
}

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
