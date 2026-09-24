import Link from 'next/link'
import { hrefDaFicha } from '@/core/volta-da-ficha'
import { acessoCompleto, filtroDoAcesso, type AcessoCompleto } from '@/server/permissoes'
import { pode, type FiltroDeEscopo } from '@/core/permissoes'
import { onboardingDaConta } from '@/server/repos/onboarding'
import { passosDoOnboarding } from '@/core/onboarding'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ComoFunciona } from '@/components/cliente/como-funciona'
import { IconeAutomacao, IconeConversa, IconeFunil } from '@/components/cliente/icones'
import { PrimeirosPassos, type PassoDaConta } from '@/components/cliente/primeiros-passos'
import { ClienteShell } from '@/components/design/cliente-shell'
import { EsqueletoDeLista } from '@/components/design/esqueleto'
import { Avatar } from '@/components/inbox/avatar'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { comoDinheiro } from '@/core/crm'
import { cobra, type Objetivo } from '@/core/objetivo-da-conta'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais, type CanalSalvo } from '@/server/repos/conversas'
import { contagensDaAgenda } from '@/server/repos/atividades'
import { lerFiltroDaAgenda } from '@/core/atividades'
import { comoDuracao } from '@/core/relatorios'
import { pendenciasDoInicio } from '@/core/pendencias-do-inicio'
import { idadeDoEvento } from '@/core/conexoes'
import { ultimaMensagemRecebida } from '@/server/repos/ultimos-eventos'
import { automacaoNoAr } from '@/core/trilha-de-configuracao'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarLeads } from '@/server/repos/leads'
import { filaDoPainel, type ItemDaFila } from '@/server/repos/painel'
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
import { crmVisivel, recursosDaConta } from '@/server/repos/recursos'
import { type AbaDoCliente, secoesVisiveis } from '@/components/design/secoes-do-cliente'
import { sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * A tela de boas-vindas, a primeira coisa que alguém vê ao abrir a conta.
 *
 * Ela responde três perguntas, nesta ordem: **o atendimento está de pé?**,
 * **quem está esperando por mim agora?** e, para quem acabou de chegar, **o que
 * eu faço primeiro?**. A defesa de cada escolha está em `docs/PLANO-HOMEPAGE.md`.
 *
 * Duas colunas de propósito. O checklist de primeiros passos é importante e não
 * é o produto: em largura cheia ele transforma a conta num formulário a
 * preencher, e some da tela no dia em que termina, deixando um buraco. Encostado
 * na lateral, ele acompanha enquanto o meio mostra o produto, e quando acaba,
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
 * na frente de quem está lendo. As caras, fila, mês, fechamentos, ficam cada
 * uma no seu `Suspense`.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const acesso = await acessoCompleto(clienteId)
  const configura = pode(acesso.regras, 'configurar_operacao', 'todos')
  const onboarding = configura ? await onboardingDaConta(clienteId) : null
  const [sessao, fluxos, canais, contatos, quadros, recursos, crm, ultimaMensagem] = await Promise.all([
    sessaoAtual(),
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    contarLeads(cliente.id),
    listarQuadros(cliente.id),
    recursosDaConta(cliente.id),
    crmVisivel(cliente.id),
    ultimaMensagemRecebida(cliente.id),
  ])

  // A mesma regra da trilha de Configurações: canal apontando para publicada.
  const { publicados, atendendo } = automacaoNoAr(fluxos, canais)
  const primeiroNome = (sessao?.usuario.nome ?? '').trim().split(/\s+/)[0] ?? ''

  const passos = passosDaConta({
    clienteId: cliente.id,
    objetivo: recursos.objetivo,
    opcionais: passosDoOnboarding(recursos.objetivo, onboarding),
    temFluxo: fluxos.length > 0,
    temPublicado: publicados > 0,
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
          <div><h2 className="text-sm font-bold">{onboarding ? 'Continue preparando sua organização' : 'Defina o objetivo da organização'}</h2><p className="mt-1 text-xs leading-5 text-muted">Escolha como atender e quais modelos ajudam sua rotina. O que você já configurou será preservado.</p></div>
          <Link href={`/clientes/${cliente.id}/configurar`} className="app-primary-button px-4 py-2.5 text-xs">{onboarding ? 'Continuar preparação' : 'Objetivo e recursos'} →</Link>
        </section>}
        {!configura && <section className="app-card mb-5 p-5"><h2 className="text-sm font-bold">Sua rotina começa aqui</h2><p className="mt-2 text-sm leading-6 text-muted">Responda conversas no Inbox, acompanhe seus lembretes em Atividades e consulte os dados em Contatos.</p><div className="mt-3 flex flex-wrap gap-4 text-sm text-primary"><Link href={`/clientes/${cliente.id}/inbox`}>Abrir Inbox →</Link><Link href={`/clientes/${cliente.id}/atividades`}>Ver atividades →</Link><Link href={`/clientes/${cliente.id}/leads`}>Ver contatos →</Link></div></section>}

        <Estado
          clienteId={cliente.id}
          fluxos={fluxos.length}
          publicados={publicados}
          canais={canais.length}
          atendendo={atendendo}
          contatos={contatos}
          ultimaMensagem={ultimaMensagem}
        />

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Atalhos clienteId={cliente.id} visiveis={secoesVisiveis({ crmVisivel: crm, regras: acesso.regras }).map((secao) => secao.chave)} />

            <Suspense fallback={<EsqueletoDeLista linhas={3} comRosto rotulo="Carregando a fila…" />}>
              <Fila clienteId={cliente.id} contatos={contatos} acesso={acesso} canais={canais} configura={configura} />
            </Suspense>

            <ComoFunciona />
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            {configura && faltaPasso && <PrimeirosPassos passos={passos} />}

            {/* Logo abaixo dos passos: quem já comprou e está sumindo é pendência
                com nome e link, e não número de período. Os números do mês
                moram em Relatórios (plano de UX, 11.1). */}
            <Suspense fallback={null}>
              <ClientesSumindo clienteId={cliente.id} />
            </Suspense>

            <Link
              href={`/clientes/${cliente.id}/relatorios`}
              className="app-card app-card-interactive flex items-center justify-between gap-3 px-5 py-4"
            >
              <span>
                <span className="block text-[13px] font-bold">Ver relatórios</span>
                <span className="mt-0.5 block text-[12px] text-dim">
                  Conversas, espera, satisfação e fechamentos por período.
                </span>
              </span>
              <span aria-hidden className="text-primary">→</span>
            </Link>
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
      titulo: 'Criar a organização',
      explica: 'Feito, esta organização é sua.',
      feito: true,
      acoes: [],
    },
    {
      chave: 'canal',
      titulo: 'Ligar um canal',
      explica:
        'Por onde as pessoas falam com o negócio: o WhatsApp da organização, o direct do Instagram ou os anúncios que geram contato. Dá para ligar mais de um depois.',
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
        ? 'O desenho existe, mas só atende depois de publicado, é a publicação que põe o roteiro no ar.'
        : 'O roteiro do que o bot responde sozinho: dúvida repetida, horário, preço, e quando chamar uma pessoa.',
      feito: temPublicado,
      acoes: [{ rotulo: temFluxo ? 'Abrir as automações' : 'Criar a primeira', href: em('/fluxos') }],
    },
    {
      chave: 'conversa',
      titulo: 'Receber a primeira conversa',
      explica:
        'Mande uma mensagem para o canal que você ligou, do seu próprio celular. Ela aparece no Inbox em segundos, é o teste que mostra tudo funcionando de ponta a ponta.',
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
  ultimaMensagem,
}: {
  clienteId: string
  fluxos: number
  publicados: number
  canais: number
  atendendo: number
  contatos: number
  ultimaMensagem: string | null
}) {
  // A ordem importa: a primeira peça que falta é a que adianta resolver. Listar
  // tudo que está errado de uma vez faz parecer que há quatro problemas quando
  // há um, e os seguintes às vezes somem sozinhos quando o primeiro sai.
  const pendencia =
    canais === 0
      ? { texto: 'Nenhum canal ligado, nada chega até aqui ainda.', href: '/ajustes' }
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
        {/*
          "Atendendo agora" era lido como "está recebendo agora", e só dizia que
          existe cadastro (C01). O selo diz o que se sabe: está configurado, e
          a última mensagem chegou há tanto tempo. Canal quieto não é falha.
        */}
        {pendencia ? 'Ainda não está atendendo' : 'Configurado'}
      </p>

      <p className="text-[12.5px] text-muted">
        {pendencia ? (
          pendencia.texto
        ) : (
          <>
            {ultimaMensagem
              ? `Última mensagem recebida ${idadeDoEvento(ultimaMensagem)}`
              : 'Nenhuma mensagem recebida ainda'}{' '}
            ·{' '}
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
function Atalhos({ clienteId, visiveis }: { clienteId: string; visiveis: AbaDoCliente[] }) {
  // Só o que a barra também mostra (7.2): atalho para uma tela de "sem acesso"
  // é convite para um beco.
  const atalhos = [
    {
      href: `/clientes/${clienteId}/inbox`,
      titulo: 'Inbox',
      texto: 'Responder quem está falando com o negócio agora.',
      icone: <IconeConversa className="size-[18px]" />,
      secao: 'inbox' as const,
    },
    {
      href: `/clientes/${clienteId}/quadros`,
      titulo: 'Funil',
      texto: 'Ver em que ponto cada negociação está.',
      icone: <IconeFunil className="size-[18px]" />,
      secao: 'quadros' as const,
    },
    {
      href: `/clientes/${clienteId}/fluxos`,
      titulo: 'Automações',
      texto: 'Desenhar e publicar o que o bot responde.',
      icone: <IconeAutomacao className="size-[18px]" />,
      secao: 'fluxos' as const,
    },
  ].filter((atalho) => visiveis.includes(atalho.secao))
  if (atalhos.length === 0) return null

  return (
    <nav aria-label="Atalhos" className={`grid gap-3 ${atalhos.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
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
 * Tudo que precisa de uma pessoa hoje: conexão quebrada, conversa e agenda.
 *
 * O bloco mostrava só a fila de conversas e dizia "Ninguém esperando" com 67
 * atividades vencidas (N04). Agora o topo é a lista de pendências de
 * `pendenciasDoInicio`, cada uma levando à lista já filtrada, e embaixo as
 * conversas mais antigas da fila, uma linha por pessoa, como antes.
 *
 * **O escopo de quem olha decide o que entra.** Agenda usa a mesma contagem do
 * número do menu (`contagensDaAgenda` com o escopo de `atender`), então os
 * dois nunca discordam. Conversa entra para quem atende, com a mesma fila que
 * o Inbox mostra (o Inbox não recorta conversa por escopo, e o número daqui
 * precisa bater com o que abre do outro lado). Conexão só para quem configura:
 * é a única pessoa que consegue resolver.
 *
 * Os dois vazios são duas frases diferentes de propósito. "Ninguém escreveu
 * ainda" numa conta recém-ligada é notícia boa esperando a primeira mensagem;
 * "ninguém esperando" numa conta cheia é o dia em que o trabalho acabou. E ele
 * só aparece quando **tudo** for zero.
 */
async function Fila({
  clienteId,
  contatos,
  acesso,
  canais,
  configura,
}: {
  clienteId: string
  contatos: number
  acesso: AcessoCompleto
  canais: CanalSalvo[]
  configura: boolean
}) {
  const atende = filtroDoAcesso(acesso, 'atender')
  const podeAtender = atende.tipo !== 'impossivel'
  const [fila, agenda] = await Promise.all([
    podeAtender ? filaDoPainel(clienteId) : null,
    podeAtender ? agendaDeHoje(clienteId, atende, acesso.sessao.usuario.id) : null,
  ])
  const pendencias = pendenciasDoInicio({
    conversas: fila ? { pedindoPessoa: fila.pedindoPessoa, esperando: fila.total - fila.pedindoPessoa } : null,
    agenda,
    agendaDaEquipe: atende.tipo === 'tudo' || atende.tipo === 'equipes',
    canais: configura ? canais : null,
    agora: agora(),
  })
  const itens = fila?.itens ?? []
  const restantes = fila ? fila.total - itens.length : 0

  return (
    <section className="app-card overflow-hidden" aria-labelledby="titulo-fila">
      <header className="flex items-center gap-3 px-5 py-3.5">
        <h2 id="titulo-fila" className="text-[15px] font-bold tracking-[-0.01em]">
          Precisa de você
        </h2>
        <span className="flex-1" />
        {podeAtender && (
          <Link
            href={`/clientes/${clienteId}/inbox`}
            className="text-[12px] font-semibold text-primary transition hover:opacity-80 active:opacity-60"
          >
            Abrir o Inbox
          </Link>
        )}
      </header>

      {pendencias.length === 0 ? (
        <p className="border-t border-line-soft px-5 py-8 text-center text-[13px] text-muted">
          {contatos === 0
            ? 'Ninguém escreveu ainda. A primeira conversa aparece aqui assim que chegar.'
            : 'Ninguém esperando. Nenhuma conversa sem resposta e nada vencido na agenda.'}
        </p>
      ) : (
        <ul className="border-t border-line-soft py-1">
          {pendencias.map((pendencia) => (
            <li key={pendencia.chave}>
              <Link
                href={`/clientes/${clienteId}${pendencia.href}`}
                className="flex items-center gap-3 px-5 py-2 text-[13.5px] transition hover:bg-surface active:bg-surface-strong"
              >
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${
                    pendencia.tom === 'falha'
                      ? 'bg-rose-400'
                      : pendencia.tom === 'alerta'
                        ? 'bg-amber-300'
                        : 'bg-primary'
                  }`}
                />
                <span className={`min-w-0 flex-1 ${pendencia.tom === 'normal' ? '' : 'font-semibold'}`}>
                  {pendencia.texto}
                </span>
                <span aria-hidden className="text-[13px] text-dim">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {itens.length > 0 && (
        <>
          <h3 className="border-t border-line-soft px-5 pt-3 pb-1 text-[11px] font-bold tracking-[0.08em] text-dim uppercase">
            Na fila há mais tempo
          </h3>
          <ul>
            {itens.map((item) => (
              <LinhaDaFila key={item.contatoId} item={item} clienteId={clienteId} />
            ))}
          </ul>
        </>
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

/** A mesma contagem do número de Atividades no menu, só vencidas e hoje. */
async function agendaDeHoje(clienteId: string, escopo: FiltroDeEscopo, usuarioId: string) {
  const contagens = await contagensDaAgenda(
    clienteId,
    escopo,
    usuarioId,
    { ...lerFiltroDaAgenda({}), alcance: 'equipe' },
    agora(),
  )
  return { vencidas: contagens.vencidas, hoje: contagens.hoje }
}

const agora = () => Date.now()

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
          contato, o único `profile_picture_url` que existe é o do próprio
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
 * Quem já comprou e parou de falar.
 *
 * O painel respondia "quanto entrou" e "quem está esperando", e não respondia a
 * pergunta que custa mais caro: **quem já era cliente e está saindo em
 * silêncio**. Ninguém abre uma tela para descobrir isso, não há evento, não há
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
                href={hrefDaFicha(clienteId, sumido.contatoId, { volta: `/clientes/${clienteId}` })}
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

// ---------------------------------------------------------------------------
// Tempo
// ---------------------------------------------------------------------------

/**
 * "há 12 min", "há 1h20", "há 3 dias", calculado no servidor.
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
