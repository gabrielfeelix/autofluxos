'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { comoFalta, restaDaJanela } from '@/channels/janela'
import { Avatar } from '@/components/inbox/avatar'
import { FichaDoRail } from '@/components/inbox/ficha-do-rail'
import { RailsLocais } from '@/components/inbox/fila-local'
import { TETO_DA_INSIGNIA } from '@/core/insignia'
import { nomeDoTipo } from '@/core/tipo-da-mensagem'
import { quando } from '@/lib/quando'
import type { FiltroDeEstado, Lead } from '@/server/repos/leads'
import type { MembroDaConta } from '@/server/repos/usuarios'

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

  const naTela = local ? recorte : leads

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
  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-line bg-panel">
      <header className="border-b border-line px-4 py-[17px]">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[14px] font-bold tracking-[-0.01em]">Inbox</h2>
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[10px] text-muted">
            {contagem.total}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-dim">
          {esperando > 0 ? `${esperando} esperando uma pessoa` : 'Todas as conversas estão com o bot'}
        </p>

        {/*
          O rail `Atribuído`, e ele é **horizontal**, não uma quarta coluna.

          O desenho de referência põe um painel só para isto, e num Inbox de
          três colunas a quarta come a largura da conversa — que é onde se
          trabalha. Com três a cinco entradas, uma linha de fichas diz a mesma
          coisa e não tira espaço de ninguém.

          **A contagem é o que faz o rail valer a pena.** Sem ela, escolher uma
          aba é apostar: a pessoa clica em "sem dono" para descobrir se tem
          alguma coisa lá.
        */}
        {/*
          A busca é o "[+] iniciar conversa" do desenho de referência, na forma
          que faz sentido aqui.

          Escrever primeiro para alguém só é possível **dentro da janela de 24
          horas** — fora dela a Meta exige modelo aprovado, que este produto
          ainda não tem. E quem está dentro da janela já está nesta lista: o que
          falta não é um botão de começar, é achar a pessoa quando a conversa
          dela já rolou para baixo.

          Formulário `GET`: a busca vira endereço, e endereço de busca dá para
          guardar e recarregar. **Continua indo ao servidor mesmo no modo
          local**, e de propósito: a busca casa telefone por formas
          normalizadas (`chavesDoTelefone`), e repetir essa regra aqui seria
          duplicar justamente a parte que erra sozinha — quem procura
          "(11) 98765-4321" não acha `551187654321` com comparação de texto.
        */}
        <form method="get" className="mt-2.5 flex gap-1.5">
          <input type="hidden" name="de" value={atribuicao} />
          {selecionado && <input type="hidden" name="conversa" value={selecionado.contatoId} />}
          <input
            type="search"
            name="busca"
            defaultValue={termo}
            placeholder="Nome ou telefone"
            aria-label="Buscar conversa"
            className="app-field min-w-0 flex-1 px-2.5 py-1.5 text-[11.5px]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
          >
            Buscar
          </button>
        </form>

        {local ? (
          /*
            A fila inteira está aqui: os dois rails viram `filter()`, sem ida ao
            servidor. As contagens saem da própria lista carregada — e batem com
            o que se vê logo abaixo, que é a condição de um número valer alguma
            coisa.
          */
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
            {/*
              **O eixo do estado vem antes do de dono, e é sempre visível.**

              A ordem não é estética: "o que precisa de mim agora" é a primeira
              pergunta de quem abre a tela, e "de quem é" só faz sentido depois
              de respondida. O rail de dono continua condicionado à equipe
              existir — este não, porque adiar e resolver valem para quem atende
              sozinho.
            */}
            <nav aria-label="Estado da conversa" className="-mx-1 mt-2.5 flex gap-1 overflow-x-auto pb-0.5">
              <FichaDoRail
                href={linkDoEstado('aberta')}
                acesa={estado === 'aberta'}
                rotulo="Abertas"
                contagem={porEstado.aberta}
              />
              <FichaDoRail
                href={linkDoEstado('adiada')}
                acesa={estado === 'adiada'}
                rotulo="Adiadas"
                contagem={porEstado.adiada}
              />
              <FichaDoRail
                href={linkDoEstado('resolvida')}
                acesa={estado === 'resolvida'}
                rotulo="Resolvidas"
                contagem={porEstado.resolvida}
              />
            </nav>

            {(equipe.length > 0 || contagem.semDono < contagem.total) && (
              <nav
                aria-label="Filtrar por quem atende"
                className="-mx-1 mt-2.5 flex gap-1 overflow-x-auto pb-0.5"
              >
                <FichaDoRail href={linkDe('todos')} acesa={atribuicao === 'todos'} rotulo="Todos" contagem={contagem.total} />
                <FichaDoRail
                  href={linkDe('sem-dono')}
                  acesa={atribuicao === 'sem-dono'}
                  rotulo="Sem dono"
                  contagem={contagem.semDono}
                  alerta
                />
                {usuarioId && (
                  <FichaDoRail
                    href={linkDe(usuarioId)}
                    acesa={atribuicao === usuarioId}
                    rotulo="Meus"
                    contagem={contagem.porUsuario.get(usuarioId) ?? 0}
                  />
                )}
                {equipe
                  .filter((membro) => membro.id !== usuarioId)
                  .map((membro) => (
                    <FichaDoRail
                      key={membro.id}
                      href={linkDe(membro.id)}
                      acesa={atribuicao === membro.id}
                      rotulo={membro.nome.split(' ')[0] ?? membro.nome}
                      contagem={contagem.porUsuario.get(membro.id) ?? 0}
                      ausente={membro.presenca !== 'disponivel'}
                    />
                  ))}
              </nav>
            )}
          </>
        )}
      </header>

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
                    className={`min-w-0 flex-1 truncate text-[10.5px] ${lead.aguardando ? 'text-rose-300' : semLer > 0 ? 'text-soft' : 'text-muted'}`}
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
                      className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[9.5px] font-bold text-black"
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
            {termo === ''
              ? 'Nenhuma conversa nesta aba.'
              : `Ninguém com “${termo}” nesta aba.`}
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
    </aside>
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
      <span className="mt-0.5 block text-[10px] font-semibold text-rose-300">
        janela fechada — só modelo aprovado
      </span>
    )
  }

  // Duas horas é o limite em que avisar ainda muda a decisão de alguém. Acima
  // disso, cor de alerta em toda linha treina a pessoa a ignorar a cor.
  const apertado = restante < 2 * 60 * 60 * 1000

  return (
    <span className={`mt-0.5 block text-[10px] ${apertado ? 'font-semibold text-amber-300' : 'text-dim'}`}>
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
