'use client'

import Link from 'next/link'
import { useCallback, useMemo, useRef, useState } from 'react'
import { comoFalta, restaDaJanela } from '@/channels/janela'
import { Dica } from '@/components/design/dica'
import { LARGURA_DA_FILA } from '@/components/design/tema'
import { chavesDoTelefone } from '@/core/contatos/telefone'
import { Avatar } from '@/components/inbox/avatar'
import { RailsLocais } from '@/components/inbox/fila-local'
import {
  ESTADOS_DA_FILA,
  PilulaInterruptor,
  PilulaMenu,
  type OpcaoDaPilula,
} from '@/components/inbox/pilulas'
import { TETO_DA_INSIGNIA } from '@/core/insignia'
import { nomeDoTipo } from '@/core/tipo-da-mensagem'
import { quando } from '@/lib/quando'
import type { FiltroDeEstado, Lead } from '@/server/repos/leads'
import type { MembroDaConta } from '@/server/repos/usuarios'
import { ContadorDeAgendadas } from '@/components/inbox/contador-de-agendadas'
import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'

export type Contagem = { total: number; semDono: number; porUsuario: Map<string, number> }

/**
 * A coluna da esquerda do Inbox: busca, os dois rails e a lista de conversas.
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora fora do `page.tsx`, e por que é `'use client'`
 * ---------------------------------------------------------------------------
 *
 * Os rails filtram campos que **já vêm em cada `Lead`** — `estadoEfetivo` e
 * `atribuidoA`. Enquanto cada ficha era um `<Link>` para a mesma rota com outro
 * `?estado=`, clicar refazia a página no servidor — sete consultas — e a tela
 * ficava parada até a resposta: dois segundos para mostrar um subconjunto do
 * que já estava na tela.
 *
 * Filtrar no navegador exige estado, e estado exige componente de cliente. A
 * `Fila` inteira veio junto porque os rails vivem dentro do `<header>` e a
 * lista fora dele: sem um pai cliente envolvendo os dois, o recorte escolhido
 * lá em cima não tem como chegar aqui embaixo. Duas tentativas de atalho —
 * manter a `Fila` no servidor e enfiar só os rails num cliente — falharam
 * exatamente aí.
 *
 * Ela é elegível: não usa `await`, nem `async`, nem Server Action. O último
 * bloqueio era `TETO_DA_INSIGNIA`, que morava em `repos/leituras.ts`
 * (`server-only`) e foi para `core/insignia.ts`.
 *
 * ---------------------------------------------------------------------------
 * Os dois modos, e por que o servidor continua existindo
 * ---------------------------------------------------------------------------
 *
 * `filaInteira` (`local`) só vem abaixo de `TETO_DA_FILA_LOCAL`. Acima dele a
 * lista é paginada, e filtrar o que está carregado **mente**: "Adiadas 40"
 * mostrando três porque as outras 37 estão na página 2. Aí os rails voltam a
 * ser `<Link>` e quem filtra é o servidor, como sempre fez.
 */
export function Fila({
  clienteId,
  leads,
  local,
  selecionado,
  esperando,
  equipe,
  contagem,
  porEstado,
  atribuicao,
  estado,
  termo,
  usuarioId,
  naoLidas,
  pagina,
  paginas,
  agendadas,
}: {
  clienteId: string
  /** A página que o servidor filtrou. É o que a lista mostra no modo paginado. */
  leads: Lead[]
  /**
   * A fila inteira, sem filtro de estado nem de dono — ou `null` quando a conta
   * passou de `TETO_DA_FILA_LOCAL` e a tela precisa continuar paginando.
   */
  local: Lead[] | null
  selecionado: Lead | null
  esperando: number
  equipe: MembroDaConta[]
  contagem: Contagem
  porEstado: { aberta: number; adiada: number; resolvida: number }
  atribuicao: string
  estado: FiltroDeEstado
  termo: string
  usuarioId: string | null
  naoLidas: Map<string, number>
  pagina: number
  paginas: number
  /**
   * Tudo o que ainda vai sair nesta conta, com o nome do contato junto.
   *
   * Vem inteiro e não só contado porque o número é um botão: clicar abre a
   * lista com o cancelar. Buscar de novo ao abrir daria uma espera no clique
   * para carregar o que já cabia na mesma consulta.
   */
  agendadas: (MensagemAgendada & { nomeDoContato: string | null })[]
}) {
  /*
   * O recorte que os rails locais publicam. Começa na página do servidor para
   * o primeiro quadro já mostrar a lista certa: `RailsLocais` só publica depois
   * da pintura, e nascer vazio piscaria "nenhuma conversa" antes do efeito
   * rodar.
   */
  const [recorte, setRecorte] = useState<Lead[]>(leads)

  /*
   * `useCallback` porque `RailsLocais` tem o callback entre as dependências do
   * efeito que publica o recorte. Uma função nova a cada render faria o efeito
   * rodar a cada render, e cada rodada chama `setRecorte` — laço infinito.
   */
  const aoRecortar = useCallback((novo: Lead[]) => setRecorte(novo), [])

  /*
   * Os dois filtros que moram aqui em cima, e **só existem no modo local**.
   *
   * Eles trabalham sobre a lista que está na memória. No modo paginado essa
   * lista é uma página de cinquenta, e filtrar ou ordenar cinquenta de cinco
   * mil é pior do que não oferecer: "Não lidas 3" mostrando três porque as
   * outras trinta estão na página 4 é um número que mente sem avisar.
   *
   * A mesma regra que decide se os rails filtram no navegador decide se estas
   * pílulas aparecem — ver `TETO_DA_FILA_LOCAL`.
   */
  const [soNaoLidas, setSoNaoLidas] = useState(false)
  const [ordem, setOrdem] = useState<Ordem>('recentes')

  /*
   * O que está escrito na busca **agora**, que não é o mesmo que `termo`.
   *
   * `termo` é o que o servidor já filtrou e está no endereço; este é o que a
   * pessoa está digitando. No modo local os dois divergem entre a primeira
   * letra e o Enter, e é justamente nesse intervalo que a lista precisa
   * responder.
   */
  const [digitado, setDigitado] = useState(termo)

  const naTela = useMemo(() => {
    const base = local ? recorte : leads
    if (!local) return base
    const recortada = soNaoLidas
      ? base.filter((lead) => (naoLidas.get(lead.contatoId) ?? 0) > 0)
      : base
    return ordenar(procurar(recortada, digitado), ordem)
  }, [local, recorte, leads, soNaoLidas, naoLidas, ordem, digitado])

  const nomeDe = (id: string | null) =>
    id ? (equipe.find((membro) => membro.id === id)?.nome.split(' ')[0] ?? 'alguém') : null

  /**
   * A coluna é flex, e não tem altura calculada.
   *
   * A lista usava `max-h-[calc(100vh-264px)]`: um número mágico amarrado à
   * altura exata do cabeçalho da página. O rail e a paginação mudaram essa
   * altura, e um `calc` desses erra em silêncio — a lista some por baixo ou
   * sobra espaço em branco, sem nada quebrar para avisar. Com `flex-1` e
   * `min-h-0`, quem decide é o próprio layout.
   */

  /** O endereço de uma aba do rail, preservando a conversa aberta. */
  const comBusca = termo === '' ? '' : `&busca=${encodeURIComponent(termo)}`
  const conversaAberta = selecionado ? `&conversa=${encodeURIComponent(selecionado.contatoId)}` : ''
  /*
   * Os dois eixos convivem no endereço: trocar de dono não pode jogar a pessoa
   * de volta para a fila aberta, nem trocar de estado perder o filtro de quem
   * atende. Cada link mexe num e carrega o outro.
   */
  const linkDe = (valor: string) =>
    `/clientes/${clienteId}/inbox?de=${encodeURIComponent(valor)}&estado=${estado}${comBusca}${conversaAberta}`
  const linkDoEstado = (valor: FiltroDeEstado) =>
    `/clientes/${clienteId}/inbox?de=${encodeURIComponent(atribuicao)}&estado=${valor}${comBusca}${conversaAberta}`
  /** As opções do eixo "de quem é", montadas da equipe da conta. */
  const opcoesDeDono: OpcaoDaPilula[] = [
    { chave: 'todos', rotulo: 'Todos os atendentes', contagem: contagem.total, href: linkDe('todos') },
    {
      chave: 'sem-dono',
      rotulo: 'Sem dono',
      descricao: 'Ninguém assumiu ainda',
      contagem: contagem.semDono,
      href: linkDe('sem-dono'),
    },
    ...(usuarioId
      ? [
          {
            chave: usuarioId,
            rotulo: 'Meus atendimentos',
            contagem: contagem.porUsuario.get(usuarioId) ?? 0,
            href: linkDe(usuarioId),
          },
        ]
      : []),
    ...equipe
      .filter((membro) => membro.id !== usuarioId)
      .map((membro) => ({
        chave: membro.id,
        rotulo: membro.nome,
        contagem: contagem.porUsuario.get(membro.id) ?? 0,
        ausente: membro.presenca !== 'disponivel',
        href: linkDe(membro.id),
      })),
  ]

  return (
    <>
      {/*
        A barra atravessa a moldura inteira — ver `MolduraDoInbox`. Ela e a
        lista são **irmãs** num fragmento, e não pai e filho: envolvê-las num
        `<div>` tiraria as duas da grade e a barra deixaria de atravessar.
      */}
      <header className="col-span-full border-b border-line">
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          <h2 className="shrink-0 text-[17px] font-bold tracking-[-0.02em]">Caixa de Entrada</h2>
          <span
            title={`${contagem.total} conversa(s) nesta conta`}
            className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[10px] text-muted"
          >
            {contagem.total}
          </span>

          {/*
            A busca é o "[+] iniciar conversa" do desenho de referência, na
            forma que faz sentido aqui.

            Escrever primeiro para alguém só é possível **dentro da janela de 24
            horas** — fora dela a Meta exige modelo aprovado, que este produto
            ainda não tem. E quem está dentro da janela já está nesta lista: o
            que falta não é um botão de começar, é achar a pessoa quando a
            conversa dela já rolou para baixo.

            Formulário `GET`: a busca vira endereço, e endereço de busca dá para
            guardar e recarregar. **Continua indo ao servidor mesmo no modo
            local**, e de propósito: a busca casa telefone por formas
            normalizadas (`chavesDoTelefone`), e repetir essa regra aqui seria
            duplicar justamente a parte que erra sozinha — quem procura
            "(11) 98765-4321" não acha `551187654321` com comparação de texto.
          */}
          {/*
            **Filtra enquanto se digita, e ainda assim é um formulário `GET`.**

            No modo local a fila inteira está no navegador: filtrar é um
            `filter()` e não há razão para esperar o Enter — quem procura alguém
            numa lista de trezentas quer ver a lista encolher na terceira letra.

            O formulário continua existindo, e o Enter continua indo ao
            servidor, por dois motivos. No modo paginado ele é a única busca que
            existe, porque filtrar uma página de cinquenta de cinco mil acharia
            só quem por acaso estava carregado. E mesmo no local, a busca do
            servidor casa telefone por formas normalizadas do banco — o Enter é
            como se pede a resposta autoritativa, e o endereço resultante dá
            para guardar e mandar para alguém.
          */}
          {/*
            **`max-w` largo e `mx-auto`**, e não uma medida apertada.

            460px deixavam o campo com pouco mais de trinta caracteres à vista:
            um nome completo já não cabia, e quem cola um telefone formatado
            perdia o começo dele de vista enquanto digitava. A busca é o
            controle mais usado desta barra — ela merece a sobra, e o `mx-auto`
            continua mantendo-a centrada entre o título e a engrenagem em
            qualquer largura de janela.
          */}
          <form method="get" className="relative mx-auto w-full max-w-[680px]">
            <input type="hidden" name="de" value={atribuicao} />
            <input type="hidden" name="estado" value={estado} />
            {selecionado && <input type="hidden" name="conversa" value={selecionado.contatoId} />}
            <Lupa />
            <input
              type="search"
              name="busca"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              placeholder="Pesquisar em conversas"
              aria-label="Pesquisar em conversas"
              className="app-field rounded-full py-2.5 pr-9 pl-9 text-[12.5px]"
            />
            {digitado !== '' && (
              <button
                type="button"
                onClick={() => setDigitado('')}
                aria-label="Limpar a busca"
                className="absolute top-1/2 right-2.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-dim transition hover:bg-surface hover:text-ink"
              >
                <span aria-hidden className="text-[13px] leading-none">
                  ×
                </span>
              </button>
            )}
            {/* O Enter já envia. O botão existe para o comando estar dito em
                algum lugar para quem usa leitor de tela. */}
            <button type="submit" className="sr-only">
              Buscar
            </button>
          </form>

          {/*
            A engrenagem leva para os ajustes de atendimento — etiquetas,
            respostas rápidas, horário, equipe. Ela fica aqui e não num menu
            porque é o caminho que se percorre no meio do trabalho: alguém
            precisa de uma etiqueta nova enquanto atende, não numa sessão
            separada de configuração.
          */}
          <Dica texto="Ajustes do atendimento" lado="baixo">
            <Link
              href={`/clientes/${clienteId}/ajustes`}
              aria-label="Ajustes do atendimento"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-dim transition hover:bg-surface hover:text-ink"
            >
              <Engrenagem />
            </Link>
          </Dica>
        </div>

        {/*
          Os filtros numa linha só, atravessando.

          O eixo do estado vem primeiro porque "o que precisa de mim agora" é a
          primeira pergunta de quem abre a tela; "de quem é" só faz sentido
          depois de respondida.
        */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
          {local ? (
            <RailsLocais
              clienteId={clienteId}
              leads={local}
              estadoInicial={estado}
              atribuicaoInicial={atribuicao}
              busca={termo}
              conversaAberta={selecionado?.contatoId ?? null}
              equipe={equipe}
              usuarioId={usuarioId}
              aoRecortar={aoRecortar}
            />
          ) : (
            <>
              <PilulaMenu
                aria="Estado da conversa"
                escolhida={estado}
                rotulo={ESTADOS_DA_FILA.find((e) => e.chave === estado)?.rotulo ?? 'Conversas'}
                opcoes={ESTADOS_DA_FILA.map((opcao) => ({
                  ...opcao,
                  contagem: porEstado[opcao.chave],
                  href: linkDoEstado(opcao.chave),
                }))}
              />
              {(equipe.length > 0 || contagem.semDono < contagem.total) && (
                <PilulaMenu
                  aria="Filtrar por quem atende"
                  escolhida={atribuicao}
                  rotulo={
                    opcoesDeDono.find((o) => o.chave === atribuicao)?.rotulo ?? 'Todos os atendentes'
                  }
                  opcoes={opcoesDeDono}
                />
              )}
            </>
          )}

          {local && (
            <>
              <PilulaInterruptor
                rotulo="Não lidas"
                ligada={soNaoLidas}
                aoAlternar={() => setSoNaoLidas((x) => !x)}
                contagem={naoLidas.size}
              />
              <PilulaMenu
                aria="Ordem da lista"
                escolhida={ordem}
                rotulo={`Classificar: ${ORDENS.find((o) => o.chave === ordem)?.curto ?? ''}`}
                opcoes={ORDENS.map(({ chave, rotulo, descricao }) => ({ chave, rotulo, descricao }))}
                aoEscolher={(chave) => setOrdem(chave as Ordem)}
              />
            </>
          )}

          {/*
            O estado da fila no canto: é a única linha desta barra que não é um
            controle, e por isso fica do outro lado, sem competir com as
            pílulas por atenção.
          */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <p className="text-[11px] text-dim">
              {esperando > 0
                ? `${esperando} esperando uma pessoa`
                : 'Todas as conversas estão com o bot'}
            </p>
            {/*
              O contador de agendadas vem depois do estado da fila porque a
              ordem é a da urgência: quem está esperando agora vem antes do que
              vai sair amanhã. Ele some sozinho quando não há nenhuma.
            */}
            <ContadorDeAgendadas
              clienteId={clienteId}
              quantas={agendadas.length}
              lista={agendadas}
            />
          </div>
        </div>
      </header>

      <aside className="relative flex min-h-0 min-w-0 flex-col border-r border-line bg-panel">

      <nav aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto py-1.5">
        {naTela.map((lead) => {
          const ativa = lead.contatoId === selecionado?.contatoId
          const nome = lead.nome ?? 'sem nome'
          const semLer = naoLidas.get(lead.contatoId) ?? 0
          return (
            <Link
              key={lead.contatoId}
              href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(lead.contatoId)}`}
              aria-current={ativa ? 'page' : undefined}
              scroll={false}
              className={`group mx-1.5 mb-0.5 flex gap-2.5 rounded-[10px] px-2.5 py-3 transition ${
                ativa ? 'bg-primary/[0.12]' : 'hover:bg-surface'
              }`}
            >
              <Avatar nome={lead.nome} alerta={Boolean(lead.aguardando)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <strong
                    className={`min-w-0 flex-1 truncate text-[12.5px] ${ativa ? 'text-ink' : semLer > 0 ? 'font-bold text-ink' : 'text-soft'}`}
                  >
                    {nome}
                  </strong>
                  <small className="shrink-0 text-[9.5px] text-muted">{lead.ultimaEm ? quando(lead.ultimaEm) : ''}</small>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  {/*
                    O `title` existe porque o motivo do handoff **é a
                    informação que resolve o problema** — "a chamada respondeu
                    500", "o modelo demorou demais" — e ele chega a 75
                    caracteres numa coluna de 292px. Truncado e sem `title`, a
                    linha vermelha só dizia que havia algo errado e escondia o
                    quê: nem o mouse, nem outra tela contavam.
                  */}
                  <span
                    title={
                      lead.aguardando
                        ? `Aguardando pessoa: ${lead.aguardando.motivo}`
                        : undefined
                    }
                    className={`min-w-0 flex-1 truncate text-[10.5px] ${lead.aguardando ? 'text-perigo' : semLer > 0 ? 'text-soft' : 'text-muted'}`}
                  >
                    {lead.aguardando ? `Pessoa: ${lead.aguardando.motivo}` : resumoDaConversa(lead)}
                  </span>
                  {/*
                    A insígnia é **minha**, não da conversa: ela conta o que
                    entrou depois da última vez que *eu* abri. "Alguém leu" é
                    exatamente a informação que não ajuda ninguém a decidir o
                    que abrir agora.
                  */}
                  {semLer > 0 && (
                    <span
                      title={`${semLer} mensagem(ns) desde a última vez que você abriu`}
                      className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9.5px] font-bold text-white"
                    >
                      {semLer > TETO_DA_INSIGNIA ? `${TETO_DA_INSIGNIA}+` : semLer}
                    </span>
                  )}
                </span>
                {lead.aguardando && <RelogioDaJanela ultimaEntradaEm={lead.ultimaEntradaEm} />}
                {/*
                  Quem assumiu aparece na fila, e não só na conversa aberta: a
                  fila é onde se decide o que pegar, e pegar o que já tem dono é
                  o trabalho duplicado que a atribuição existe para evitar.
                */}
                {nomeDe(lead.atribuidoA) && (
                  <span className="mt-0.5 block truncate text-[10px] text-dim">
                    com {nomeDe(lead.atribuidoA)}
                  </span>
                )}
              </span>
            </Link>
          )
        })}

        {naTela.length === 0 && (
          <p className="px-4 py-8 text-center text-[11.5px] leading-5 text-dim">
            {(local ? digitado : termo) === ''
              ? 'Nenhuma conversa neste filtro.'
              : `Ninguém com “${local ? digitado : termo}” aqui. Enter procura no servidor.`}
          </p>
        )}
      </nav>

      {/*
        No modo local não há paginação: a fila inteira está aqui, e trocar de
        aba não muda isso. Os `paginas > 1` só acontecem do outro lado do teto.
      */}
      {!local && paginas > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
          <PassoDaPagina
            href={`/clientes/${clienteId}/inbox?de=${encodeURIComponent(atribuicao)}${comBusca}&pagina=${pagina - 1}`}
            desabilitado={pagina <= 1}
            rotulo="Página anterior"
          >
            ‹
          </PassoDaPagina>
          <span className="font-mono text-[10px] text-dim">
            {pagina} / {paginas}
          </span>
          <PassoDaPagina
            href={`/clientes/${clienteId}/inbox?de=${encodeURIComponent(atribuicao)}${comBusca}&pagina=${pagina + 1}`}
            desabilitado={pagina >= paginas}
            rotulo="Próxima página"
          >
            ›
          </PassoDaPagina>
        </div>
      )}

        <PuxadorDaFila />
      </aside>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* A borda que se arrasta                                                     */
/* -------------------------------------------------------------------------- */

/**
 * O puxador que muda a largura da coluna de conversas.
 *
 * ---------------------------------------------------------------------------
 * Por que ele existe
 * ---------------------------------------------------------------------------
 *
 * 320px é um bom padrão e não serve a todo mundo. Quem trabalha com nomes
 * longos e prévia de mensagem quer mais; quem passa o dia lendo a conversa
 * quer menos. É a mesma escolha que todo cliente de e-mail e de chat oferece, e
 * pela mesma razão: a proporção certa depende do trabalho, não do produto.
 *
 * ---------------------------------------------------------------------------
 * Por que o arrasto não passa pelo React
 * ---------------------------------------------------------------------------
 *
 * O `pointermove` escreve direto na variável de CSS do `<html>`. Um `setState`
 * por quadro renderizaria a lista inteira — que pode ter quinhentas conversas —
 * sessenta vezes por segundo, para mudar uma medida que o CSS resolve sozinho.
 * O React só volta a participar no `pointerup`, para gravar.
 *
 * `setPointerCapture` é o que faz o arrasto sobreviver ao ponteiro sair de cima
 * da faixa de 5px — sem ele, mover rápido solta o puxador no meio do gesto.
 */
function PuxadorDaFila() {
  const arrasto = useRef<{ x: number; largura: number } | null>(null)

  const larguraAtual = () => {
    const escrita = getComputedStyle(document.documentElement).getPropertyValue(
      LARGURA_DA_FILA.variavel,
    )
    return parseInt(escrita, 10) || LARGURA_DA_FILA.padrao
  }

  const aplicar = (px: number) => {
    const preso = Math.min(Math.max(px, LARGURA_DA_FILA.minimo), LARGURA_DA_FILA.maximo)
    document.documentElement.style.setProperty(LARGURA_DA_FILA.variavel, `${preso}px`)
    return preso
  }

  return (
    /*
      Faixa de 5px sobre a borda, meio para cada lado — é a área de acerto, e a
      borda continua sendo o que se vê. `touch-none` impede o navegador de
      entender o arrasto como rolagem no celular.

      `aria-hidden` porque o teclado tem o próprio caminho logo abaixo: o botão
      invisível que só aparece no foco. Uma faixa arrastável não é operável por
      teclado, e anunciar uma não ajuda ninguém.
    */
    <div
      aria-hidden
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        arrasto.current = { x: e.clientX, largura: larguraAtual() }
      }}
      onPointerMove={(e) => {
        if (!arrasto.current) return
        aplicar(arrasto.current.largura + (e.clientX - arrasto.current.x))
      }}
      onPointerUp={(e) => {
        if (!arrasto.current) return
        const final = aplicar(arrasto.current.largura + (e.clientX - arrasto.current.x))
        arrasto.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
        try {
          localStorage.setItem(LARGURA_DA_FILA.chave, String(final))
        } catch {
          // Sem onde gravar, a largura vale só para esta aba.
        }
      }}
      className="absolute top-0 -right-[2px] bottom-0 z-20 hidden w-[5px] cursor-col-resize touch-none md:block hover:bg-primary/25 active:bg-primary/40"
    />
  )
}

function PassoDaPagina({
  href,
  desabilitado,
  rotulo,
  children,
}: {
  href: string
  desabilitado: boolean
  rotulo: string
  children: string
}) {
  if (desabilitado) {
    return (
      <span aria-disabled className="rounded-md px-2 py-0.5 text-[13px] text-ink/15">
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={rotulo}
      scroll={false}
      className="rounded-md px-2 py-0.5 text-[13px] text-muted transition hover:bg-surface-strong hover:text-ink"
    >
      {children}
    </Link>
  )
}

/**
 * Quanto tempo ainda dá para responder em texto livre.
 *
 * **Só aparece em quem espera uma pessoa**, e isso é decisão de desenho: a
 * fila já carrega nome, horário e prévia, e um quarto dado em toda linha vira
 * ruído. Onde o relógio decide alguma coisa é exatamente aqui — quem escolhe o
 * que atender primeiro precisa saber de quem a janela está fechando, não de
 * quem está conversando com o bot.
 *
 * §3.10.1: *"a fila precisa mostrar quanto tempo resta, não só que alguém
 * espera"*. Passada a janela, a Meta só aceita modelo aprovado — que este
 * produto ainda não tem —, então "fechada" quer dizer que não dá para
 * responder por texto, e é a informação mais importante da linha.
 */
function RelogioDaJanela({ ultimaEntradaEm }: { ultimaEntradaEm: string | null }) {
  const restante = restaDaJanela(ultimaEntradaEm)
  if (restante === null) return null

  if (restante === 0) {
    return (
      <span className="mt-0.5 block text-[10px] font-semibold text-perigo">
        janela fechada — só modelo aprovado
      </span>
    )
  }

  // Duas horas é o limite em que avisar ainda muda a decisão de alguém. Acima
  // disso, cor de alerta em toda linha treina a pessoa a ignorar a cor.
  const apertado = restante < 2 * 60 * 60 * 1000

  return (
    <span className={`mt-0.5 block text-[10px] ${apertado ? 'font-semibold text-aviso' : 'text-dim'}`}>
      responder em {comoFalta(restante)}
    </span>
  )
}

function resumoDaConversa(lead: Lead): string {
  const prefixo = lead.ultimaDirecao === 'saida' ? 'atendimento: ' : ''
  if (lead.ultimoTexto) return `${prefixo}${lead.ultimoTexto}`
  if (!lead.ultimaEm) return 'sem mensagem'

  // O tipo quando ele existe, a frase genérica quando não. Ver
  // `core/tipo-da-mensagem.ts` sobre por que "mídia ou mensagem sem texto"
  // sozinho era pior do que nada.
  return `${prefixo}${nomeDoTipo(lead.ultimoTipo) ?? 'mensagem sem texto'}`
}

/* -------------------------------------------------------------------------- */
/* A busca enquanto se digita                                                 */
/* -------------------------------------------------------------------------- */

/** Sem acento e em minúsculas: quem digita "fabricio" tem que achar "Fabrício". */
const achatar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * O recorte por texto, feito no navegador.
 *
 * **O telefone usa `chavesDoTelefone`, a mesma função do servidor.** Ela mora
 * em `core/`, sem banco e sem rede, justamente para os dois lados poderem
 * chamá-la: quem digita "(11) 98765-4321" precisa achar `5511987654321`, e
 * resolver isso com comparação de texto erraria em todo número com nono dígito.
 *
 * O que sobra é comparação de nome e da última mensagem, que é o que se procura
 * quando não se está procurando um número.
 */
function procurar(leads: Lead[], termo: string): Lead[] {
  const alvo = achatar(termo.trim())
  if (alvo === '') return leads

  const so = termo.replace(/\D/g, '')
  const chaves = so === '' ? [] : chavesDoTelefone(termo)

  return leads.filter((lead) => {
    if (achatar(lead.nome ?? '').includes(alvo)) return true
    if (achatar(lead.ultimoTexto ?? '').includes(alvo)) return true
    // `includes` e não igualdade: digitar só o DDD e o começo do número já
    // recorta, que é como se busca telefone de cabeça.
    if (so !== '' && lead.waId.includes(so)) return true
    return chaves.some((chave) => lead.waId === chave)
  })
}

/* -------------------------------------------------------------------------- */
/* Ordem da lista                                                             */
/* -------------------------------------------------------------------------- */

type Ordem = 'recentes' | 'antigas' | 'espera'

/**
 * As três ordens, e o que cada uma responde.
 *
 * `espera` é a que justifica o menu existir: as outras duas são a mesma
 * pergunta invertida, e "quem está esperando há mais tempo" é uma pergunta
 * diferente — é a fila pela ordem em que ela deveria ser atendida, e não pela
 * ordem em que as mensagens chegaram.
 */
const ORDENS = [
  { chave: 'recentes', curto: 'Mais recentes', rotulo: 'Mais recentes', descricao: 'A última mensagem no topo' },
  { chave: 'antigas', curto: 'Mais antigas', rotulo: 'Mais antigas', descricao: 'A conversa parada há mais tempo no topo' },
  {
    chave: 'espera',
    curto: 'Esperando há mais tempo',
    rotulo: 'Esperando há mais tempo',
    descricao: 'Quem pediu gente primeiro vem primeiro; o resto segue por data',
  },
] as const

/**
 * Copia antes de ordenar. A lista vem do recorte dos rails, e `sort` no lugar
 * mutaria um array que o React considera imutável — o sintoma é a lista
 * trocando de ordem sozinha ao voltar de outra aba. (`toSorted` faria isso
 * numa linha, mas o `lib` deste projeto ainda é anterior ao ES2023.)
 */
function ordenar(leads: Lead[], ordem: Ordem): Lead[] {
  const data = (lead: Lead) => (lead.ultimaEm ? Date.parse(lead.ultimaEm) : 0)

  if (ordem === 'antigas') return [...leads].sort((a, b) => data(a) - data(b))

  if (ordem === 'espera') {
    return [...leads].sort((a, b) => {
      // Quem tem handoff aberto sobe, e entre eles ganha quem espera há mais
      // tempo. `desde` é a hora em que o bot desistiu, que é quando a espera
      // dessa pessoa realmente começou.
      const esperaA = a.aguardando ? Date.parse(a.aguardando.desde) : null
      const esperaB = b.aguardando ? Date.parse(b.aguardando.desde) : null
      if (esperaA !== null && esperaB !== null) return esperaA - esperaB
      if (esperaA !== null) return -1
      if (esperaB !== null) return 1
      return data(b) - data(a)
    })
  }

  return [...leads].sort((a, b) => data(b) - data(a))
}

/* -------------------------------------------------------------------------- */
/* Ícones                                                                     */
/* -------------------------------------------------------------------------- */

/** Dentro do campo de busca, e por isso `pointer-events-none`: clicar na lupa
    tem que focar o campo, não parar no ícone. */
function Lupa() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

function Engrenagem() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.4.65.73.85.3.18.64.27 1 .26H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}