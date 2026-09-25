'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useConversaAberta } from '@/components/inbox/conversa-local'
import { useAgendadas } from '@/components/inbox/agendadas-local'
import { Dica } from '@/components/design/dica'
import { SeletorDeEtiquetas, type EtiquetaEscolhivel } from '@/components/etiquetas/seletor'
import { EntradaDeAnotacao, useTemAnotacao } from '@/components/inbox/anotacoes'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { useFicha } from '@/components/inbox/moldura'
import { PRAZOS_DE_ADIAMENTO, type PrazoDeAdiamento } from '@/core/adiamento'
import { AgendarMensagem, IconeAgendar } from '@/components/inbox/agendar'
import { MarcarAtividade, IconeAtividade } from '@/components/inbox/marcar-atividade'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'
import {
  acaoAdiarConversa,
  acaoAlternarAutomacaoDoLead,
  acaoDefinirEstadoDaConversa,
} from '@/server/acoes'

/**
 * A fileira de ações do cabeçalho da conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que ícone, e por que aqui
 * ---------------------------------------------------------------------------
 *
 * O cabeçalho tinha cinco botões de texto, "Passar para", "Adiar", "Resolver",
 * "Assumir", "Abrir ficha", mais um seletor de atendente, tudo disputando a
 * mesma linha com o nome da pessoa. Numa janela de 1280px o nome truncava em
 * doze caracteres para caber botão.
 *
 * Em ícone, os seis gestos ocupam ~200px e sobra a linha inteira para dizer com
 * quem se está falando, que é a única informação do cabeçalho que não é uma
 * ação.
 *
 * **Todo ícone tem dica e `aria-label`.** Ícone sozinho é adivinhação: a
 * etiqueta e o relógio são reconhecíveis, o quadrado que abre a ficha não é de
 * jeito nenhum, e quem usa leitor de tela não vê nenhum deles. A dica é a do
 * produto (ver `Dica`), e não o `title` do navegador, numa fileira em que ela
 * é a única legenda, o segundo de atraso do sistema operacional é a diferença
 * entre ler a barra e adivinhar.
 *
 * ---------------------------------------------------------------------------
 * O que ficou fora
 * ---------------------------------------------------------------------------
 *
 * Assumir e passar para continuam sendo botão de texto, ao lado. Eles mudam
 * **de quem é** a conversa, é a decisão mais cara desta tela, a única que
 * afeta o trabalho de outra pessoa, e a que mais precisa dizer em palavras o
 * que vai fazer.
 */
export function AcoesRapidas({
  clienteId,
  contatoId,
  etiquetas,
  temAutomacao,
  fimDaJanela,
  agendadas,
  nomeDoContato,
}: {
  clienteId: string
  contatoId: string
  etiquetas: EtiquetaEscolhivel[]
  /** Sem fluxo ligado não há bot: o botão de pausar não aparece. */
  temAutomacao: boolean
  /** Quando a janela de 24h fecha, em ISO, o agendamento avisa a partir dela. */
  fimDaJanela: string | null
  /** O que já está marcado nesta conversa, para listar e cancelar sem sair daqui. */
  agendadas: MensagemAgendada[]
  /** Como chamar o contato dentro do painel de agendar. */
  nomeDoContato: string
}) {
  const temAnotacao = useTemAnotacao()
  const ficha = useFicha()

  /*
   * As duas apostas otimistas do cabeçalho. Resolver e pausar o bot são gestos
   * que se fazem **antes** de continuar trabalhando, esperar o servidor para
   * saber se pegou é esperar para começar a escrever a resposta.
   */
  /*
   * O estado mora em `conversa-local.ts` desde 25/set, e não mais em dois
   * `useAcaoOtimista` daqui: o selo embaixo do nome, o cartão da coluna do
   * contato e a linha da fila mostram o mesmo resolvido e o mesmo bot, e os
   * quatro mudam juntos no clique. O servidor não redesenha a página depois.
   */
  const conversa = useConversaAberta()
  const [erro, setErro] = useState<string | null>(null)
  const [erroDaAtividade, setErroDaAtividade] = useState<string | null>(null)
  const pendentes = useAgendadas(agendadas, contatoId)

  const resolvida = conversa.valor.estado !== 'aberta'
  const botLigado = conversa.valor.automacaoAtiva

  const agir = (mudanca: Parameters<typeof conversa.agir>[0], acao: Parameters<typeof conversa.agir>[1]) => {
    setErro(null)
    void conversa.agir(mudanca, acao).then(setErro)
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {erro && (
        <span role="alert" className="mr-1 max-w-[160px] truncate text-[11.5px] text-rose-500">
          {erro}
        </span>
      )}
      {erroDaAtividade && (
        <AvisoFlutuante tom="erro" aoSumir={() => setErroDaAtividade(null)}>
          {erroDaAtividade}
        </AvisoFlutuante>
      )}

      <AcaoComPainel
        rotulo="Etiquetas do contato"
        icone={<IconeEtiqueta />}
        marcada={conversa.valor.etiquetas.length > 0}
        largura={272}
      >
        <p className="mb-2 text-[12px] font-bold text-soft">Etiquetas do contato</p>
        <SeletorDeEtiquetas
          clienteId={clienteId}
          contatoId={contatoId}
          disponiveis={etiquetas}
          aplicadas={conversa.doServidor.etiquetas}
        />
      </AcaoComPainel>

      {/*
        **Próximos passos em dois grupos, pelo destino (8.3).** Adiar, marcar
        atividade e agendar mensagem eram vizinhos iguais, e o resultado é
        oposto: dois ficam dentro da equipe, um sai para o cliente. O grupo
        diz para quem é antes de a pessoa abrir o painel, na dica e na moldura.
      */}
      <GrupoDeAcoes rotulo="Para a equipe">
        {/*
          Adiar some numa conversa que já está adiada ou resolvida: ela já saiu
          da fila aberta, e o único gesto que falta ali é voltar.
        */}
        {!resolvida && (
          <AcaoComPainel
            rotulo="Para a equipe: adiar a conversa"
            icone={<IconeRelogio />}
            largura={196}
            recolhido
          >
            {(fechar) => (
              <>
                <p className="px-3 pt-2 pb-1 text-[11.5px] font-bold tracking-[0.06em] text-dim uppercase">
                  Voltar para a fila em
                </p>
                {(Object.keys(PRAZOS_DE_ADIAMENTO) as PrazoDeAdiamento[]).map((prazo) => (
                  <button
                    key={prazo}
                    type="button"
                    onClick={() => {
                      fechar()
                      agir({ estado: 'adiada' }, () => acaoAdiarConversa(clienteId, contatoId, prazo))
                    }}
                    className="block w-full px-3 py-2 text-left text-[12.5px] font-semibold text-ink transition hover:bg-surface disabled:opacity-50"
                  >
                    {PRAZOS_DE_ADIAMENTO[prazo].rotulo}
                  </button>
                ))}
              </>
            )}
          </AcaoComPainel>
        )}

        {/* Atividade não envia nada (RB-33, ver `core/atividades.ts`). */}
        <AcaoComPainel
          rotulo="Para a equipe: marcar atividade"
          icone={<IconeAtividade />}
          largura={300}
        >
          {(fechar) => (
            <>
              <DestinoDoPainel>Para a equipe</DestinoDoPainel>
              <MarcarAtividade clienteId={clienteId} contatoId={contatoId} aoFechar={fechar} aoFalhar={setErroDaAtividade} />
            </>
          )}
        </AcaoComPainel>

        <AcaoComPainel
          rotulo="Para a equipe: anotar"
          icone={<IconeNota />}
          marcada={temAnotacao}
          largura={288}
        >
          <DestinoDoPainel>Para a equipe</DestinoDoPainel>
          <p className="mb-1 text-[12px] font-bold text-soft">Anotação da equipe</p>
          <p className="mb-2 text-[11.5px] leading-4 text-dim">
            Só a equipe vê. Não vai para o WhatsApp nem para a automação. Cada anotação fica no
            histórico do contato, com o seu nome e a hora.
          </p>
          <EntradaDeAnotacao limite={LIMITE_DA_NOTA} />
        </AcaoComPainel>
      </GrupoDeAcoes>

      {/*
        Marcada quando já há mensagem esperando, do mesmo jeito que etiqueta e
        anotação: a barra diz o que esta conversa já tem sem ninguém abrir nada.
      */}
      <GrupoDeAcoes rotulo="Para o contato">
        <AcaoComPainel
          rotulo="Para o contato: agendar mensagem"
          icone={<IconeAgendar />}
          marcada={pendentes.some((a) => a.estado === 'agendada' || a.estado === 'enviando')}
          largura={320}
        >
          {(fechar) => (
            <>
              <DestinoDoPainel>Para o contato</DestinoDoPainel>
              <AgendarMensagem
                clienteId={clienteId}
                contatoId={contatoId}
                nome={nomeDoContato}
                fimDaJanela={fimDaJanela}
                agendadas={agendadas}
                aoFechar={fechar}
                aoFalhar={setErroDaAtividade}
              />
            </>
          )}
        </AcaoComPainel>
      </GrupoDeAcoes>

      {/*
        Resolver e reabrir são o mesmo botão, e o ícone conta qual dos dois:
        o tique quando há o que encerrar, a seta de volta quando já encerrou.
        Dois botões seriam um deles sempre desligado.
      */}
      <BotaoDeIcone
        rotulo={resolvida ? 'Reabrir conversa' : 'Marcar como resolvida'}
        marcada={resolvida}
        aoClicar={() =>
          agir({ estado: resolvida ? 'aberta' : 'resolvida' }, () =>
            acaoDefinirEstadoDaConversa(clienteId, contatoId, resolvida ? 'aberta' : 'resolvida'),
          )
        }
      >
        {resolvida ? <IconeReabrir /> : <IconeTique />}
      </BotaoDeIcone>

      {temAutomacao && (
        <BotaoDeIcone
          rotulo={botLigado ? 'Pausar o bot nesta conversa' : 'Religar o bot nesta conversa'}
          marcada={!botLigado}
          aoClicar={() =>
            agir({ automacaoAtiva: !botLigado }, () =>
              acaoAlternarAutomacaoDoLead(clienteId, contatoId, !botLigado),
            )
          }
        >
          {botLigado ? <IconePausa /> : <IconeTocar />}
        </BotaoDeIcone>
      )}

      <span className="mx-1 h-4 w-px bg-line" aria-hidden />

      <BotaoDeIcone
        rotulo={ficha.aberta ? 'Esconder dados do contato' : 'Mostrar dados do contato'}
        marcada={ficha.aberta}
        aoClicar={ficha.alternar}
      >
        <IconeFicha />
      </BotaoDeIcone>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                      */
/* -------------------------------------------------------------------------- */

/** Uma moldura leve em volta dos ícones que vão para o mesmo destino. */
function GrupoDeAcoes({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="flex items-center gap-0.5 rounded-[10px] border border-line/70 px-0.5"
    >
      {children}
    </div>
  )
}

/** A linha "para quem" no alto do painel, a mesma palavra da dica do ícone. */
function DestinoDoPainel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.06em] text-primary uppercase">
      {children}
    </p>
  )
}

function BotaoDeIcone({
  rotulo,
  marcada = false,
  desabilitado = false,
  aoClicar,
  children,
}: {
  rotulo: string
  /** Estado ligado: o gesto já foi feito, ou o painel está aberto. */
  marcada?: boolean
  desabilitado?: boolean
  aoClicar?: () => void
  children: ReactNode
}) {
  return (
    <Dica texto={rotulo}>
      <button
        type="button"
        aria-label={rotulo}
        aria-pressed={marcada}
        disabled={desabilitado}
        onClick={aoClicar}
        className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] transition disabled:opacity-40 ${
          marcada ? 'bg-primary-weak text-primary' : 'text-muted hover:bg-surface hover:text-ink'
        }`}
      >
        {children}
      </button>
    </Dica>
  )
}

/**
 * Um botão de ícone que abre um painel embaixo.
 *
 * `recolhido` tira o respiro interno: os menus de lista (adiar) desenham o
 * próprio espaçamento por item, e a caixa com `padding` faria uma moldura em
 * volta de itens que já estão emoldurados.
 */
function AcaoComPainel({
  rotulo,
  icone,
  largura,
  marcada = false,
  recolhido = false,
  children,
}: {
  rotulo: string
  icone: ReactNode
  largura: number
  marcada?: boolean
  recolhido?: boolean
  children: ReactNode | ((fechar: () => void) => ReactNode)
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (caixa.current?.contains(alvo)) return
      /*
       * **A lista de um `Dropdown` conta como dentro.**
       *
       * Ela é renderizada num portal, na top layer, para não ser cortada nem
       * mal posicionada por ancestrais com `transform` (ver `dropdown.tsx`).
       * O efeito colateral é que ela não está dentro de `caixa`, então escolher
       * "ligação" no tipo da atividade era lido como clique fora e fechava o
       * painel inteiro: não havia como escolher um tipo e continuar preenchendo.
       *
       * O `closest` pela classe do menu é o que liga as duas metades do mesmo
       * controle, já que a relação entre elas não existe na árvore do DOM.
       */
      if (alvo instanceof Element && alvo.closest('.app-dropdown-menu')) return
      setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicar)
    }
  }, [aberto])

  return (
    <div ref={caixa} className="relative shrink-0">
      <BotaoDeIcone rotulo={rotulo} marcada={marcada || aberto} aoClicar={() => setAberto((x) => !x)}>
        {icone}
      </BotaoDeIcone>

      {aberto && (
        <div
          style={{ width: largura }}
          className={`absolute top-full right-0 z-50 mt-1.5 overflow-hidden rounded-[12px] border border-line bg-panel shadow-menu ${
            recolhido ? 'py-1' : 'p-3'
          }`}
        >
          {typeof children === 'function' ? children(() => setAberto(false)) : children}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Ícones, traço de 1,7px, o mesmo do resto do painel                        */
/* -------------------------------------------------------------------------- */

const traco = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  width: 15,
  height: 15,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function IconeEtiqueta() {
  return (
    <svg {...traco}>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
      <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconeRelogio() {
  return (
    <svg {...traco}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

function IconeTique() {
  return (
    <svg {...traco}>
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  )
}

function IconeReabrir() {
  return (
    <svg {...traco}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

function IconeNota() {
  return (
    <svg {...traco}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 21l1.9-5.3A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
    </svg>
  )
}

function IconePausa() {
  return (
    <svg {...traco}>
      <path d="M9.5 4.5v15M14.5 4.5v15" />
    </svg>
  )
}

function IconeTocar() {
  return (
    <svg {...traco}>
      <path d="M6.5 4.5v15l13-7.5-13-7.5Z" />
    </svg>
  )
}

function IconeFicha() {
  return (
    <svg {...traco}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M8.5 10h-2M8.5 14h-2M17.5 10h-5M17.5 14h-5" />
    </svg>
  )
}