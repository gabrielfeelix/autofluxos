'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from 'react'
import { LIMITE_LEGENDA } from '@/core/flow/schema'
import { acaoPrepararEnvioDeArquivo } from '@/server/acoes'
import { acaoEnviarMidiaDoInbox } from '@/server/acoes-midia-do-inbox'
import { pedirNovas } from '@/components/inbox/sinal-de-conversa'

/**
 * Anexar arrastando para dentro da conversa, e revisar antes de mandar.
 *
 * ---------------------------------------------------------------------------
 * O escuro é da conversa, não da tela
 * ---------------------------------------------------------------------------
 *
 * A revisão de anexo nasceu como um `fixed inset-0`: um diálogo por cima do
 * painel inteiro, com a página escurecida atrás. Funciona num formulário
 * qualquer, e é errado num Inbox, quem atende trabalha olhando a fila da
 * esquerda e o cabeçalho de quem está do outro lado. Escurecer os dois para
 * mandar uma foto tira de vista justamente o que diz **para quem** a foto vai.
 *
 * Aqui o painel é `absolute` dentro da coluna da conversa: a fila continua
 * legível, o nome e a janela de 24h continuam no alto, e só o miolo da conversa
 * dá lugar à revisão. É o que o WhatsApp Web faz, e o motivo é esse.
 *
 * Como o pai é este provedor, e não a página, a coluna não precisa virar
 * cliente: o histórico e a caixa chegam prontos do servidor como `children`,
 * igual ao `ProvedorDeCitacao`.
 *
 * ---------------------------------------------------------------------------
 * Vários arquivos, um de cada vez na hora de enviar
 * ---------------------------------------------------------------------------
 *
 * Dá para soltar cinco fotos de uma vez, ir somando com o `+`, tirar uma do
 * meio e escrever legenda em cada uma. **Cada anexo carrega a legenda dele**
 * porque a Cloud API manda a legenda *dentro* da mensagem de mídia: uma legenda
 * só para o lote viraria a mesma frase repetida em cinco mensagens.
 *
 * O envio é em fila, um depois do outro, e **para no primeiro erro**. Disparar
 * os cinco em paralelo entregaria fora de ordem no celular do cliente, e um
 * erro no meio deixaria ninguém sabendo o que foi e o que não foi.
 *
 * ---------------------------------------------------------------------------
 * A revisão é a única defesa que existe
 * ---------------------------------------------------------------------------
 *
 * Não há apagar para todos na Cloud API, e nunca vai haver por API oficial.
 * Mandar a foto errada aqui é mandar o documento de um cliente para outro. O
 * passo de revisão é o que transforma um erro irreversível num clique em
 * "Cancelar", por isso soltar o arquivo **nunca** envia sozinho.
 */

/** O que o WhatsApp aceita. O servidor confere de novo; isto é só o filtro do seletor. */
export const TIPOS_ACEITOS =
  'image/jpeg,image/png,video/mp4,audio/mpeg,audio/ogg,audio/mp4,audio/aac,application/pdf'

/**
 * Quantos anexos cabem numa leva.
 *
 * Não é limite da Meta: é limite de revisão. Com trinta miniaturas ninguém
 * confere o que está mandando, e conferir é o ponto desta tela.
 */
const TETO_DE_ANEXOS = 10

type Anexo = {
  id: string
  arquivo: File
  /** `blob:` local, **nada sobe para ver**. Só o que for confirmado vai ao Storage. */
  previa: string | null
  legenda: string
}

type Valor = {
  /** Soma arquivos à leva e abre a revisão. Ignora o que passar do teto. */
  adicionar: (arquivos: FileList | File[]) => void
  /** Há revisão aberta? O clipe e o microfone se calam enquanto há. */
  ocupada: boolean
}

const Contexto = createContext<Valor | null>(null)

/**
 * `null` fora do provedor, como na citação: a caixa de resposta também serve a
 * tela da Ficha, que não monta esta área.
 */
export function useEntrega(): Valor | null {
  return useContext(Contexto)
}

function ehArrastoDeArquivo(evento: DragEvent) {
  return Array.from(evento.dataTransfer?.types ?? []).includes('Files')
}

function previaDe(arquivo: File) {
  return /^(image|video|audio)\//.test(arquivo.type) ? URL.createObjectURL(arquivo) : null
}

export function ProvedorDeEntrega({
  clienteId,
  contatoId,
  children,
}: {
  clienteId: string
  contatoId: string
  children: ReactNode
}) {
  const [anexos, setAnexos] = useState<Anexo[]>([])
  const [atual, setAtual] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(0)
  const [fase, setFase] = useState<'parado' | 'subindo' | 'enviando'>('parado')
  const [arrastando, setArrastando] = useState(false)
  const [, comecar] = useTransition()

  /*
   * `dragenter`/`dragleave` disparam também ao atravessar cada filho: o
   * histórico, cada bolha, cada botão. Contando entradas e saídas, a moldura só
   * some quando o ponteiro sai de verdade da coluna, sem isso ela pisca a cada
   * mensagem por que o arrasto passa.
   */
  const profundidade = useRef(0)

  /*
   * Espelho para soltar os `blob:` no desmonte. Cada `createObjectURL` prende o
   * arquivo na memória da aba até alguém revogar, e quem atende anexa dezenas
   * por dia.
   */
  const vivos = useRef<Anexo[]>([])
  useEffect(() => {
    vivos.current = anexos
  }, [anexos])
  useEffect(
    () => () => {
      for (const a of vivos.current) if (a.previa) URL.revokeObjectURL(a.previa)
    },
    [],
  )

  const ocupado = fase !== 'parado'

  /*
   * Estado atual em vez de atualizador funcional, de propósito: somar arquivos
   * só acontece dentro de um evento, soltar, ou escolher no seletor, e aqui
   * dentro há mais do que uma lista para atualizar (o recado do teto, e qual
   * anexo abre). Atualizador funcional com `setState` de outro estado dentro é
   * efeito colateral dentro de render, e o React roda esse trecho duas vezes em
   * desenvolvimento.
   */
  const adicionar = useCallback(
    (arquivos: FileList | File[]) => {
      const novos = Array.from(arquivos)
      if (novos.length === 0) return

      const cabem = Math.max(0, TETO_DE_ANEXOS - anexos.length)
      if (cabem === 0) {
        setErro(`dá para revisar ${TETO_DE_ANEXOS} arquivos por vez`)
        return
      }
      setErro(
        novos.length > cabem
          ? `entraram ${cabem}: dá para revisar ${TETO_DE_ANEXOS} arquivos por vez`
          : null,
      )

      const somados = novos.slice(0, cabem).map((arquivo) => ({
        id: `${arquivo.name}-${arquivo.size}-${arquivo.lastModified}-${Math.random()}`,
        arquivo,
        previa: previaDe(arquivo),
        legenda: '',
      }))

      // Abre já no primeiro dos que acabaram de entrar: é o que a pessoa quer
      // ver, e não a foto que ela já revisou há dois cliques.
      setAtual(anexos.length)
      setAnexos([...anexos, ...somados])
    },
    [anexos],
  )

  function fechar() {
    for (const a of anexos) if (a.previa) URL.revokeObjectURL(a.previa)
    setAnexos([])
    setAtual(0)
    setErro(null)
    setEnviado(0)
  }

  function remover(id: string) {
    const fora = anexos.find((a) => a.id === id)
    if (fora?.previa) URL.revokeObjectURL(fora.previa)
    const restam = anexos.filter((a) => a.id !== id)
    setAnexos(restam)
    setAtual((i) => Math.max(0, Math.min(i, restam.length - 1)))
    setErro(null)
  }

  function escreverLegenda(id: string, texto: string) {
    setAnexos((atuais) => atuais.map((a) => (a.id === id ? { ...a, legenda: texto } : a)))
  }

  /* `Esc` desiste, como em qualquer diálogo, menos no meio de um envio. */
  useEffect(() => {
    if (anexos.length === 0) return
    const noTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !ocupado) fechar()
    }
    window.addEventListener('keydown', noTeclado)
    return () => window.removeEventListener('keydown', noTeclado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anexos, ocupado])

  const valor = useMemo<Valor>(
    () => ({ adicionar, ocupada: anexos.length > 0 }),
    [adicionar, anexos.length],
  )

  const legendaGrande = anexos.some((a) => a.legenda.trim().length > LIMITE_LEGENDA)

  function enviarTudo() {
    if (anexos.length === 0 || legendaGrande) return
    setErro(null)

    comecar(async () => {
      try {
        for (let i = 0; i < anexos.length; i++) {
          const anexo = anexos[i]
          if (!anexo) continue
          const { arquivo, legenda } = anexo
          setEnviado(i)
          setFase('subindo')

          /*
           * O servidor decide se o tipo e o tamanho passam, e devolve a URL
           * assinada. Conferir no navegador antes seria adivinhar a regra em
           * dois lugares, e a regra é do Acervo, não desta tela.
           */
          const preparo = await acaoPrepararEnvioDeArquivo(clienteId, {
            nome: arquivo.name,
            tipo: arquivo.type,
            bytes: arquivo.size,
          })
          if (!preparo.ok || !preparo.envio) {
            setErro(`${arquivo.name}: ${preparo.erro ?? 'não deu para preparar o envio'}`)
            return
          }

          /*
           * O arquivo sobe direto para o Storage, sem passar pela Server Action:
           * um `File` atravessando ação bate no teto de 1 MB do Next, e um vídeo
           * de 12 MB morreria no caminho com um erro que não diz nada.
           */
          const subida = await fetch(preparo.envio.url, {
            method: 'PUT',
            body: arquivo,
            headers: { 'content-type': arquivo.type },
          })
          if (!subida.ok) {
            setErro(`${arquivo.name}: o arquivo não subiu; tente de novo`)
            return
          }

          setFase('enviando')
          const texto = legenda.trim()
          const r = await acaoEnviarMidiaDoInbox(clienteId, contatoId, {
            url: preparo.envio.urlPublica,
            midia: preparo.envio.midia,
            nomeArquivo: preparo.envio.nome,
            // Áudio não leva legenda na Cloud API, e a ação recusa se vier uma.
            ...(texto !== '' && preparo.envio.midia !== 'audio' ? { legenda: texto } : {}),
          })
          if (!r.ok) {
            setErro(`${arquivo.name}: ${r.erro ?? 'não deu para enviar'}`)
            /*
             * O que já saiu não volta. Tirar da lista os que foram deixa a
             * segunda tentativa mandar só o que falta, repetir a leva inteira
             * mandaria a mesma foto duas vezes.
             */
            setAnexos((atuais) => atuais.slice(i))
            setAtual(0)
            // O que já saiu antes do erro também é conversa: a transcrição
            // busca o que houver, e o que falhou simplesmente não está lá.
            pedirNovas()
            return
          }
        }
        // A leva inteira saiu: as bolhas entram na conversa agora, sem esperar
        // o pulso do servidor e sem redesenhar a página.
        pedirNovas()
        fechar()
      } finally {
        setFase('parado')
        setEnviado(0)
      }
    })
  }

  const emFoco = anexos[Math.min(atual, anexos.length - 1)]

  return (
    <Contexto.Provider value={valor}>
      {/*
        `relative` para o painel e a moldura de arrasto medirem **esta** coluna,
        e não a janela. `min-h-0` porque item de flex nasce com `min-height:auto`
        e sem ele o histórico perde a rolagem que já tinha.
      */}
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        onDragEnter={(e) => {
          if (!ehArrastoDeArquivo(e)) return
          e.preventDefault()
          profundidade.current += 1
          setArrastando(true)
        }}
        onDragOver={(e) => {
          // Sem cancelar o `dragover` o navegador recusa o soltar, e o gesto
          // termina com o arquivo abrindo numa aba por cima do painel.
          if (!ehArrastoDeArquivo(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(e) => {
          if (!ehArrastoDeArquivo(e)) return
          profundidade.current = Math.max(0, profundidade.current - 1)
          if (profundidade.current === 0) setArrastando(false)
        }}
        onDrop={(e) => {
          if (!ehArrastoDeArquivo(e)) return
          e.preventDefault()
          profundidade.current = 0
          setArrastando(false)
          if (!ocupado) adicionar(e.dataTransfer.files)
        }}
      >
        {children}

        {arrastando && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-panel/85 p-6 backdrop-blur-[2px]"
          >
            <div className="flex w-full max-w-[420px] flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/[0.06] px-8 py-12 text-center">
              <span className="text-3xl leading-none">📎</span>
              <p className="text-[13.5px] font-semibold text-ink">Solte para anexar</p>
              <p className="text-[12px] text-dim">
                Foto, vídeo, áudio ou PDF, você revisa antes de enviar
              </p>
            </div>
          </div>
        )}

        {emFoco && (
          <PainelDeRevisao
            anexos={anexos}
            atual={Math.min(atual, anexos.length - 1)}
            emFoco={emFoco}
            erro={erro}
            fase={fase}
            enviado={enviado}
            legendaGrande={legendaGrande}
            aoEscolher={setAtual}
            aoRemover={remover}
            aoEscrever={escreverLegenda}
            aoAdicionar={adicionar}
            aoFechar={fechar}
            aoEnviar={enviarTudo}
          />
        )}
      </div>
    </Contexto.Provider>
  )
}

/** Ícone de quem não tem prévia, e do que tem, na miniatura. */
function Simbolo({ arquivo }: { arquivo: File }) {
  if (arquivo.type.startsWith('video/')) return <span aria-hidden>🎬</span>
  if (arquivo.type.startsWith('audio/')) return <span aria-hidden>🎤</span>
  return <span aria-hidden>📄</span>
}

function PainelDeRevisao({
  anexos,
  atual,
  emFoco,
  erro,
  fase,
  enviado,
  legendaGrande,
  aoEscolher,
  aoRemover,
  aoEscrever,
  aoAdicionar,
  aoFechar,
  aoEnviar,
}: {
  anexos: Anexo[]
  atual: number
  emFoco: Anexo
  erro: string | null
  fase: 'parado' | 'subindo' | 'enviando'
  enviado: number
  legendaGrande: boolean
  aoEscolher: (i: number) => void
  aoRemover: (id: string) => void
  aoEscrever: (id: string, texto: string) => void
  aoAdicionar: (arquivos: FileList | File[]) => void
  aoFechar: () => void
  aoEnviar: () => void
}) {
  const mais = useRef<HTMLInputElement>(null)
  const ocupado = fase !== 'parado'
  const ehImagem = emFoco.arquivo.type.startsWith('image/')
  const ehVideo = emFoco.arquivo.type.startsWith('video/')
  const ehAudio = emFoco.arquivo.type.startsWith('audio/')
  const legendaAtual = emFoco.legenda
  const excede = legendaAtual.trim().length > LIMITE_LEGENDA

  return (
    /*
      `absolute inset-0` e fundo sólido: ele cobre a conversa, e só ela. A fila
      da esquerda e o cabeçalho de quem está do outro lado continuam à vista ,
      que é o ponto todo desta tela.
    */
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Revisar os arquivos antes de enviar"
      className="absolute inset-0 z-30 flex flex-col bg-panel"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <button
          type="button"
          onClick={aoFechar}
          disabled={ocupado}
          aria-label="Cancelar o envio"
          className="rounded-lg px-2 py-1 text-[13.5px] leading-none text-dim transition hover:bg-surface-strong hover:text-ink disabled:opacity-40"
        >
          ✕
        </button>
        <p className="text-[13px] font-semibold">
          {anexos.length === 1 ? 'Enviar este arquivo' : `Enviar ${anexos.length} arquivos`}
        </p>
        <p className="ml-auto min-w-0 truncate text-[11.5px] text-dim" title={emFoco.arquivo.name}>
          {emFoco.arquivo.name} · {(emFoco.arquivo.size / 1024 / 1024).toFixed(1)} MB
        </p>
      </header>

      {/* A prévia grande, no lugar onde a conversa estava. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5">
        {emFoco.previa && ehImagem && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={emFoco.previa}
            alt={emFoco.arquivo.name}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        )}
        {emFoco.previa && ehVideo && (
          <video src={emFoco.previa} controls className="max-h-full max-w-full rounded-xl" />
        )}
        {emFoco.previa && ehAudio && (
          <audio src={emFoco.previa} controls className="w-full max-w-[420px]" />
        )}
        {/*
          PDF e o que não tem prévia: o nome grande é a revisão possível. Um
          ícone genérico sem o nome seria uma revisão que não revisa nada.
        */}
        {!ehImagem && !ehVideo && !ehAudio && (
          <p className="max-w-[320px] rounded-xl border border-line bg-surface px-6 py-10 text-center text-[13px] break-all text-soft">
            <span aria-hidden className="mb-2 block text-3xl">
              📄
            </span>
            {emFoco.arquivo.name}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-line px-3 py-3">
        {erro && (
          <p className="mb-2 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[12.5px] leading-5 text-perigo">
            {erro}
          </p>
        )}

        <div className="flex items-end gap-2">
          {/*
            Áudio não leva legenda na Cloud API. Esconder o campo é melhor do que
            deixá-lo aceitar texto e o envio recusar depois.
          */}
          {ehAudio ? (
            <p className="flex-1 px-1 text-[12px] text-dim">Áudio não leva legenda no WhatsApp.</p>
          ) : (
            <div className="min-w-0 flex-1">
              <input
                autoFocus
                value={legendaAtual}
                onChange={(e) => aoEscrever(emFoco.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !ocupado && !legendaGrande) aoEnviar()
                }}
                disabled={ocupado}
                placeholder={
                  anexos.length > 1
                    ? 'Legenda deste arquivo (opcional)'
                    : 'Escreva uma legenda (opcional)'
                }
                className="w-full rounded-[19px] border border-line bg-surface px-3.5 py-2 font-texto text-[14px] leading-[1.45] outline-none transition placeholder:text-dim focus:border-primary/40 disabled:opacity-50"
              />
              {excede && (
                <p className="mt-1 px-1 text-[11.5px] text-perigo">
                  a legenda aceita {LIMITE_LEGENDA} caracteres, e esta tem{' '}
                  {legendaAtual.trim().length}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={aoEnviar}
            disabled={ocupado || legendaGrande}
            aria-label={
              anexos.length === 1 ? 'Enviar o arquivo' : `Enviar ${anexos.length} arquivos`
            }
            className="app-primary-button relative flex size-9 shrink-0 items-center justify-center rounded-full text-[13.5px] leading-none disabled:opacity-50"
          >
            {ocupado ? '…' : '➤'}
            {anexos.length > 1 && !ocupado && (
              <span className="absolute -top-1 -right-1 flex size-[17px] items-center justify-center rounded-full bg-panel text-[11px] font-bold text-primary ring-1 ring-primary/40">
                {anexos.length}
              </span>
            )}
          </button>
        </div>

        {/*
          A fila de miniaturas, como no WhatsApp: é por onde se troca de arquivo,
          se tira um do meio e se soma mais um, sem fechar e recomeçar.
        */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1">
          {anexos.map((anexo, i) => (
            <div key={anexo.id} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => aoEscolher(i)}
                disabled={ocupado}
                aria-label={`Revisar ${anexo.arquivo.name}`}
                aria-current={i === atual}
                className={`flex size-11 items-center justify-center overflow-hidden rounded-lg border bg-surface text-[15px] transition disabled:opacity-60 ${
                  i === atual
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-line hover:border-strong'
                }`}
              >
                {anexo.previa && anexo.arquivo.type.startsWith('image/') ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={anexo.previa} alt="" className="size-full object-cover" />
                ) : (
                  <Simbolo arquivo={anexo.arquivo} />
                )}
              </button>
              {!ocupado && (
                <button
                  type="button"
                  onClick={() => aoRemover(anexo.id)}
                  aria-label={`Tirar ${anexo.arquivo.name} da leva`}
                  className="absolute -top-1.5 -right-1.5 hidden size-[18px] items-center justify-center rounded-full border border-line bg-panel text-[11px] leading-none text-dim shadow-sm transition group-hover:flex hover:text-perigo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <input
            ref={mais}
            type="file"
            hidden
            multiple
            accept={TIPOS_ACEITOS}
            onChange={(e) => {
              if (e.target.files) aoAdicionar(e.target.files)
              // Zera: sem isto, escolher o **mesmo** arquivo de novo não dispara
              // `change`, e a segunda tentativa parece não ter funcionado.
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => mais.current?.click()}
            disabled={ocupado}
            aria-label="Somar outro arquivo"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-strong text-[17px] text-dim transition hover:border-primary/60 hover:text-primary disabled:opacity-40"
          >
            +
          </button>

          {ocupado && (
            <p className="ml-auto shrink-0 pl-2 text-[11.5px] text-dim">
              {fase === 'subindo' ? 'Subindo' : 'Enviando'} {enviado + 1} de {anexos.length}…
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
