'use client'

import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import type { ReactNode } from 'react'
import { partesDaMensagem } from '@/core/flow/mensagem'
import { NOME_DO_FORMATO, type FormatoDeResposta } from '@/core/flow/resposta'
import {
  LIMITE_BOTOES,
  SAIDA_ESCOLHEU,
  SAIDA_TIMEOUT,
  SAIDA_FALSO,
  SAIDA_VAZIO,
  SAIDA_VERDADEIRO,
  type NoMensagem as NoMensagemSchema,
  type Opcao,
} from '@/core/flow/schema'

/**
 * O visual de cada tipo de bloco.
 *
 * O detalhe que faz o editor funcionar está nas alças (`Handle`): o `id` de cada
 * alça de saída é exatamente o `sourceHandle` que o motor lê. Numa pergunta, a
 * alça de uma opção tem o id da opção. Ou seja, **a setinha que você arrasta já
 * é a ramificação** — não existe tela de configurar branch em lugar nenhum.
 */

const CORES = {
  mensagem: 'border-sky-400/30',
  pergunta: 'border-emerald-400/30',
  condicao: 'border-violet-400/30',
  'salvar-campo': 'border-amber-300/30',
  ia: 'border-fuchsia-400/30',
  handoff: 'border-rose-400/30',
  http: 'border-cyan-400/30',
  midia: 'border-sky-400/30',
  etapa: 'border-teal-400/30',
  'ir-fluxo': 'border-indigo-400/30',
} as const

export const ICONES = {
  mensagem: '↗',
  pergunta: '?',
  condicao: '⑂',
  'salvar-campo': '↓',
  ia: '✦',
  handoff: '♙',
  http: '⇄',
  midia: '▣',
  etapa: '▤',
  'ir-fluxo': '⇥',
} as const

/**
 * O nome que aparece no bloco e no catálogo.
 *
 * `http` se chamava **"API"**, que é o nome da tecnologia, não o do trabalho.
 * Quem desenha o fluxo do estúdio de pilates não está procurando uma API: está
 * procurando "puxar a agenda", "mandar pro CRM", "consultar o sistema". Foi
 * exatamente o que o operador do concorrente apontou, e lá o bloco ainda se
 * chamava "Integração" — nós estávamos um degrau abaixo.
 */
export const NOMES = {
  mensagem: 'Mensagem',
  pergunta: 'Pergunta',
  condicao: 'Condição',
  'salvar-campo': 'Guardar',
  ia: 'IA',
  handoff: 'Falar com humano',
  http: 'Serviços externos',
  midia: 'Mídia',
  /**
   * "Etapa do quadro", e não "Kanban" nem "mover cartão".
   *
   * Quem desenha o fluxo pensa em "marcar que essa pessoa agendou a aula", não
   * em mover um cartão — o cartão é o desenho da coisa, não a coisa. É a mesma
   * correção que fez `http` deixar de se chamar "API".
   */
  etapa: 'Etapa do quadro',
  /**
   * "Ir para outra automação", e não "sub-fluxo" nem "chamar fluxo".
   *
   * "Chamar" promete volta, e não existe volta: quem salta termina no outro
   * desenho. O nome diz exatamente o que acontece com a conversa.
   */
  'ir-fluxo': 'Ir para outra automação',
} as const

function Caixa({
  tipo,
  selecionado,
  children,
  saidaUnica = true,
}: {
  tipo: keyof typeof CORES
  selecionado: boolean
  children: ReactNode
  /** `false` quando o bloco desenha as próprias saídas (pergunta, condição). */
  saidaUnica?: boolean
}) {
  return (
    <div
      className={`w-[248px] overflow-hidden rounded-xl border bg-[#0b1018] text-xs shadow-[0_14px_34px_rgba(0,0,0,0.35)] transition ${CORES[tipo]} ${
        selecionado ? '!border-accent ring-1 ring-accent/30' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!left-[-7px] !size-[15px] !border-2 !border-white/30 !bg-[#0b1018] transition hover:!border-accent" />
      <p className="flex h-[38px] items-center gap-2 border-b border-white/[0.06] px-3 text-[10px] font-bold tracking-[0.06em] text-[#97a2b4] uppercase">
        <span aria-hidden className="flex size-6 items-center justify-center rounded-[7px] bg-white/[0.05] text-[13px] text-soft">
          {ICONES[tipo]}
        </span>
        {NOMES[tipo]}
      </p>
      <div className="px-3 py-2.5">{children}</div>
      {saidaUnica && (
        <Handle type="source" position={Position.Right} className="!right-[-7px] !size-[13px] !border-2 !border-[#0b1018] !bg-accent transition hover:!ring-2 hover:!ring-accent/40" />
      )}
    </div>
  )
}

/** Uma linha com a própria alça de saída à direita. */
function Saida({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="relative mt-1.5 rounded-[7px] border border-white/[0.07] bg-white/[0.035] px-2 py-1.5 pr-5 text-[#b9c2d0]">
      {children}
      <Handle
        type="source"
        id={id}
        position={Position.Right}
        className="!right-[-7px] !size-[13px] !border-2 !border-[#0b1018] !bg-accent transition hover:!ring-2 hover:!ring-accent/40"
        style={{ top: '50%' }}
      />
    </div>
  )
}

const vazio = (t: string, alt: string) => (t.trim() === '' ? alt : t)

/** O que o React Flow entrega em `data` para um bloco de mensagem. */
type DadosDaMensagem = NoMensagemSchema['data']

/** O que cada tipo de mídia se chama na tela, no singular de quem desenha. */
const ROTULO_DA_MIDIA = {
  imagem: 'Imagem',
  video: 'Vídeo',
  documento: 'Documento',
  audio: 'Áudio',
} as const

/**
 * O bloco no desenho mostra o texto **e o resumo da pilha**.
 *
 * Sem a segunda linha, um bloco que manda três fotos e grava dois campos fica
 * idêntico a um que manda só "Oi" — e o desenho é justamente onde alguém
 * procura o bloco que precisa mexer. `partesDaMensagem` lê os dois formatos,
 * então o grafo antigo continua desenhando igual.
 */
function NoMensagem({ id, data, selected }: NodeProps) {
  const partes = partesDaMensagem({
    id,
    type: 'mensagem',
    position: { x: 0, y: 0 },
    data: data as DadosDaMensagem,
  })

  const texto = partes
    .filter((parte) => parte.tipo === 'texto')
    .map((parte) => parte.texto)
    .join('\n')
    .trim()

  const outros = partes.filter((parte) => parte.tipo !== 'texto')

  return (
    <Caixa tipo="mensagem" selecionado={!!selected}>
      <p className="line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-5 text-soft">
        {vazio(texto, '(sem texto)')}
      </p>
      {outros.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-dim">
          {outros.map((parte, i) => (
            <span key={i}>
              {parte.tipo === 'midia'
                ? ROTULO_DA_MIDIA[parte.midia]
                : parte.tipo === 'atraso'
                  ? `digita por ${parte.segundos}s`
                  : parte.tipo === 'salvar'
                    ? `guarda ${parte.campo || '?'}`
                    : 'desliga o bot'}
            </span>
          ))}
        </p>
      )}
    </Caixa>
  )
}


function NoMidia({ data, selected }: NodeProps) {
  const d = data as {
    midia: keyof typeof ROTULO_DA_MIDIA
    url: string
    legenda?: string
    nomeArquivo?: string
    atraso?: number
  }
  // O nome do arquivo é o que identifica no desenho; a URL inteira estoura a
  // caixa e as três primeiras dezenas dela são sempre iguais entre blocos.
  const arquivo = d.nomeArquivo?.trim() || nomeDaUrl(d.url)

  return (
    <Caixa tipo="midia" selecionado={!!selected}>
      <p className="text-[11px] font-bold tracking-[0.04em] text-sky-200 uppercase">
        {ROTULO_DA_MIDIA[d.midia] ?? 'Mídia'}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10.5px] text-dim">
        {arquivo === '' ? '(sem arquivo)' : arquivo}
      </p>
      {(d.legenda ?? '').trim() !== '' && (
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-soft">{d.legenda}</p>
      )}
      {!!d.atraso && <p className="mt-1 text-[10px] text-dim">digita por {d.atraso}s</p>}
    </Caixa>
  )
}

/** O último pedaço da URL, sem query. Só para o desenho ficar legível. */
function nomeDaUrl(url: string): string {
  const limpo = url.trim()
  if (limpo === '') return ''
  const semQuery = limpo.split(/[?#]/)[0] ?? limpo
  return decodeURIComponent(semQuery.slice(semQuery.lastIndexOf('/') + 1)) || limpo
}

function NoPergunta({ data, selected }: NodeProps) {
  const d = data as {
    texto: string
    salvarEm?: string
    opcoes: Opcao[]
    opcoesDe?: string
    valoresDe?: string
    salvarValorEm?: string
    formato?: FormatoDeResposta
    timeoutMinutos?: number
  }
  const dinamica = (d.opcoesDe ?? '').trim() !== ''
  const prazo = d.timeoutMinutos ?? null

  return (
    <Caixa
      tipo="pergunta"
      selecionado={!!selected}
      // Com prazo, a saída deixa de ser única mesmo em resposta livre: existem
      // duas, a de quem respondeu e a de quem não respondeu.
      saidaUnica={!dinamica && d.opcoes.length === 0 && prazo === null}
    >
      <p className="line-clamp-2 text-[12.5px] leading-5 text-soft">{vazio(d.texto, '(sem texto)')}</p>
      {d.salvarEm && <p className="mt-1 font-mono text-[10px] text-dim">guarda em {d.salvarEm}</p>}

      {dinamica ? (
        <>
          <p className="mt-1 text-[10px] text-dim">
            opções de <code className="font-mono text-[#8de2fa]">{d.opcoesDe}</code>
          </p>
          {d.valoresDe && (
            <p className="text-[10px] text-dim">
              valores de <code className="font-mono text-[#8de2fa]">{d.valoresDe}</code>
              {d.salvarValorEm && <> → guarda em {d.salvarValorEm}</>}
            </p>
          )}
          <Saida id={SAIDA_ESCOLHEU}>
            <span className="text-[11px] text-emerald-300">escolheu</span>
          </Saida>
          <Saida id={SAIDA_VAZIO}>
            <span className="text-[11px] text-muted">veio vazia</span>
          </Saida>
        </>
      ) : (
        <>
          {d.opcoes.map((opcao) => (
            <Saida key={opcao.id} id={opcao.id}>
              <span className="text-[11px]">{vazio(opcao.rotulo, '(sem rótulo)')}</span>
            </Saida>
          ))}

          {d.opcoes.length > 0 && (
            <p className="mt-1.5 text-[10px] text-dim">
              {d.opcoes.length <= LIMITE_BOTOES ? 'vira botões' : 'vira lista'}
            </p>
          )}
          {d.opcoes.length === 0 && (
            <p className="mt-1 text-[10px] text-dim">
              {d.formato ? (
                <>
                  resposta livre, precisa ser{' '}
                  <strong className="text-soft">{NOME_DO_FORMATO[d.formato].toLowerCase()}</strong>
                </>
              ) : (
                'resposta livre em texto'
              )}
            </p>
          )}
          {d.opcoes.length === 0 && prazo !== null && (
            <Saida id="">
              <span className="text-[11px] text-muted">respondeu</span>
            </Saida>
          )}
        </>
      )}

      {prazo !== null && (
        <>
          <p className="mt-1.5 text-[10px] text-dim">espera {comoPrazo(prazo)}</p>
          <Saida id={SAIDA_TIMEOUT}>
            <span className="text-[11px] text-amber-200">não respondeu</span>
          </Saida>
        </>
      )}
    </Caixa>
  )
}

/** "45 min", "2h", "1 dia". Minuto puro acima de uma hora ninguém lê. */
export function comoPrazo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  if (minutos % 1_440 === 0) {
    const dias = minutos / 1_440
    return dias === 1 ? '1 dia' : `${dias} dias`
  }
  if (minutos % 60 === 0) return `${minutos / 60}h`
  return `${Math.floor(minutos / 60)}h${minutos % 60}`
}

function NoCondicao({ data, selected }: NodeProps) {
  const d = data as { variavel: string; operador: string; valor: string }
  return (
    <Caixa tipo="condicao" selecionado={!!selected} saidaUnica={false}>
      <p className="text-soft">
        <code className="font-mono text-[11px] text-[#8de2fa]">{d.variavel}</code>{' '}
        <span className="text-muted">{d.operador}</span>{' '}
        {d.valor && <code className="font-mono text-[11px]">{d.valor}</code>}
      </p>
      <Saida id={SAIDA_VERDADEIRO}>
        <span className="text-[11px] text-emerald-300">verdadeiro</span>
      </Saida>
      <Saida id={SAIDA_FALSO}>
        <span className="text-[11px] text-muted">falso</span>
      </Saida>
    </Caixa>
  )
}

function NoSalvarCampo({ data, selected }: NodeProps) {
  const d = data as { campo: string; valor: string }
  return (
    <Caixa tipo="salvar-campo" selecionado={!!selected}>
      <p className="text-soft">
        <code className="font-mono text-[11px] text-[#8de2fa]">{d.campo}</code> = {vazio(d.valor, '(vazio)')}
      </p>
    </Caixa>
  )
}

function NoEtapa({ data, selected }: NodeProps) {
  const d = data as { quadroId: string; colunaId: string; rotulo?: string }
  return (
    <Caixa tipo="etapa" selecionado={!!selected}>
      {/* `rotulo` é preenchido pelo painel quando alguém escolhe, e serve só ao
          desenho: o id não diz nada a quem olha o fluxo. O motor ignora — o que
          vale para ele são `quadroId` e `colunaId`. */}
      <p className="truncate text-[12.5px] leading-5 text-soft">
        {d.colunaId ? (d.rotulo ?? 'etapa escolhida') : '(nenhuma etapa escolhida)'}
      </p>
    </Caixa>
  )
}

function NoIa({ data, selected }: NodeProps) {
  const d = data as { instrucao: string; salvarEm?: string }
  return (
    <Caixa tipo="ia" selecionado={!!selected}>
      <p className="line-clamp-3 text-[12.5px] leading-5 text-soft">
        {vazio(d.instrucao, '(sem instrução)')}
      </p>
    </Caixa>
  )
}

function NoHandoff({ data, selected }: NodeProps) {
  const d = data as { motivo: string; mensagem: string; mensagens?: string[] }
  // Os dois formatos, como em todo lugar que lê handoff. O card mostra a
  // primeira fala inteira e conta as outras: cabe na caixa e já responde "esse
  // bloco fala mais de uma vez antes de transferir?".
  const mensagens = d.mensagens ?? [d.mensagem]
  return (
    <Caixa tipo="handoff" selecionado={!!selected} saidaUnica={false}>
      <p className="line-clamp-2 text-[12.5px] leading-5 text-soft">{mensagens[0]}</p>
      {mensagens.length > 1 && (
        <p className="mt-1 text-[10px] text-dim">
          + {mensagens.length - 1} mensagem{mensagens.length - 1 > 1 ? 's' : ''} antes de transferir
        </p>
      )}
      <p className="mt-1 text-[10px] text-dim">motivo: {d.motivo}</p>
    </Caixa>
  )
}

function NoHttp({ data, selected }: NodeProps) {
  const d = data as { metodo: string; url: string; mapear: { variavel: string }[] }
  return (
    <Caixa tipo="http" selecionado={!!selected}>
      <p className="truncate text-[12.5px] leading-5 text-soft">
        <span className="font-mono text-[10px] text-[#8de2fa]">{d.metodo}</span>{' '}
        {vazio(d.url, '(sem endereço)')}
      </p>
      {d.mapear.length > 0 && (
        <p className="mt-1 truncate font-mono text-[10px] text-dim">
          guarda {d.mapear.map((m) => m.variavel || '?').join(', ')}
        </p>
      )}
    </Caixa>
  )
}

/**
 * O bloco que manda a conversa para outra automação.
 *
 * Sem alça de saída (`saidaUnica={false}` e nenhuma `Saida` desenhada): daqui
 * não sai linha nenhuma, porque a conversa continua no outro desenho e não
 * volta. Uma alça aqui seria uma promessa que o motor não cumpre.
 */
function NoIrFluxo({ data, selected }: NodeProps) {
  const d = data as { fluxoId: string; rotulo?: string }
  return (
    <Caixa tipo="ir-fluxo" selecionado={!!selected} saidaUnica={false}>
      <p className="truncate text-[12.5px] leading-5 text-soft">
        {d.fluxoId ? (d.rotulo?.trim() || 'automação escolhida') : '(nenhuma automação escolhida)'}
      </p>
      <p className="mt-1 text-[10px] text-dim">a conversa continua lá e não volta</p>
    </Caixa>
  )
}

export const tiposDeNo: NodeTypes = {
  mensagem: NoMensagem,
  midia: NoMidia,
  pergunta: NoPergunta,
  condicao: NoCondicao,
  'salvar-campo': NoSalvarCampo,
  ia: NoIa,
  handoff: NoHandoff,
  http: NoHttp,
  etapa: NoEtapa,
  'ir-fluxo': NoIrFluxo,
}
