'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { IconeMicrofone } from '@/components/lead/icones-da-barra'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import {
  AVISO_DE_FIM_S,
  CODEC_TROCADO,
  duracaoLegivel,
  escolherFormato,
  gravouOpus,
  LIMITE_DE_GRAVACAO_S,
  motivoDoMicrofone,
  nomeDoAudio,
  RESTRICOES_DO_MICROFONE,
  SEM_FORMATO,
  type FormatoDeGravacao,
} from '@/core/audio-de-voz'
import { webmOpusParaOgg } from '@/core/ogg-opus'
import { acaoPrepararEnvioDeArquivo } from '@/server/acoes'
import { acaoEnviarMidiaDoInbox } from '@/server/acoes-midia-do-inbox'

/**
 * Gravar um áudio e mandar, na caixa de resposta do Inbox.
 *
 * ---------------------------------------------------------------------------
 * Enquanto grava, a barra é só da gravação
 * ---------------------------------------------------------------------------
 *
 * A primeira versão punha o "⏹ Enviar" da gravação ao lado do "Enviar" do
 * formulário de texto. Dois botões com o mesmo nome na mesma linha, e o da
 * direita respondia "escreva a mensagem antes de enviar" — porque ele é o do
 * texto e o campo estava vazio. Quem atende não tem como adivinhar qual é qual.
 *
 * O WhatsApp resolve isso não deixando os dois coexistirem: gravar **toma a
 * barra inteira**, e o que sobra é descartar, o tempo correndo, e enviar.
 * `aoGravar` avisa o rodapé, que esconde o resto enquanto isso.
 *
 * ---------------------------------------------------------------------------
 * O codec é conferido **depois** de gravar, e essa checagem não é paranoia
 * ---------------------------------------------------------------------------
 *
 * Em 15/set/2026 um áudio subiu, a Cloud API respondeu 200, a mensagem ficou
 * marcada como entregue — e nada chegou. O arquivo foi aberto byte a byte:
 * Opus dentro de contêiner MP4, porque o pedido tinha sido `audio/mp4` sem
 * codec e o Chrome escolheu por conta própria. A Meta só entrega AAC em MP4.
 *
 * Pedir com `;codecs=` resolve o caso conhecido. Conferir `gravador.mimeType`
 * depois do `start()` — que é o tipo **efetivo** — é o que fecha a classe
 * inteira: qualquer troca do navegador vira uma frase na tela em vez de uma
 * mensagem que some no caminho.
 */
export function BotaoDeMicrofone({
  clienteId,
  contatoId,
  desabilitado = false,
  aoGravar,
}: {
  clienteId: string
  contatoId: string
  desabilitado?: boolean
  /** Avisa o rodapé para sair do caminho enquanto a gravação acontece. */
  aoGravar?: (gravando: boolean) => void
}) {
  const [fase, setFase] = useState<'parado' | 'pedindo' | 'gravando' | 'subindo' | 'enviando'>(
    'parado',
  )
  const [segundos, setSegundos] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  const gravadorRef = useRef<MediaRecorder | null>(null)
  const trilhaRef = useRef<MediaStream | null>(null)
  const pedacosRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const barrasRef = useRef<HTMLDivElement | null>(null)
  const animacaoRef = useRef<number | null>(null)
  /*
   * Quem decide o destino do áudio é quem clicou, e a decisão precisa chegar ao
   * `onstop` — que dispara depois, e sem argumento. Um `ref` e não um estado:
   * `stop()` é síncrono, e um `setState` aqui só chegaria no render seguinte.
   */
  const descartarRef = useRef(false)

  /** Solta o microfone. Sem isto, a aba fica com o ponto vermelho para sempre. */
  const soltarMicrofone = useCallback(() => {
    if (animacaoRef.current !== null) cancelAnimationFrame(animacaoRef.current)
    animacaoRef.current = null
    void audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
    trilhaRef.current?.getTracks().forEach((t) => t.stop())
    trilhaRef.current = null
    gravadorRef.current = null
  }, [])

  /* Sair da página no meio de uma gravação é o caso comum: quem atende troca
   * de conversa o tempo todo, e o microfone não pode ficar aberto atrás. */
  useEffect(() => soltarMicrofone, [soltarMicrofone])

  useEffect(() => {
    aoGravar?.(fase === 'gravando')
  }, [fase, aoGravar])

  /* O relógio só existe enquanto grava; fora disso não há o que contar. */
  useEffect(() => {
    if (fase !== 'gravando') return
    const id = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [fase])

  /**
   * O medidor de nível, desenhado a partir do som real do microfone.
   *
   * Não é enfeite: é a única coisa na tela que prova que o microfone está
   * captando. Microfone mudo (mutado no sistema, entrada errada) grava um
   * arquivo válido e silencioso, e hoje só se descobre depois de mandar.
   *
   * As alturas são escritas direto no DOM em vez de virarem estado: são
   * sessenta atualizações por segundo, e cada uma re-renderizando o componente
   * derrubaria a caixa de texto ao lado.
   */
  function ligarMedidor(trilha: MediaStream) {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const analise = ctx.createAnalyser()
    analise.fftSize = 256
    ctx.createMediaStreamSource(trilha).connect(analise)
    const amostras = new Uint8Array(analise.frequencyBinCount)

    const desenhar = () => {
      analise.getByteFrequencyData(amostras)
      const barras = barrasRef.current?.children
      if (barras) {
        const porBarra = Math.floor(amostras.length / barras.length) || 1
        for (let i = 0; i < barras.length; i++) {
          let soma = 0
          for (let j = 0; j < porBarra; j++) soma += amostras[i * porBarra + j] ?? 0
          const media = soma / porBarra / 255
          // Mínimo de 15% para a barra não sumir no silêncio — sumir pareceria
          // "travou", e o que queremos comunicar é "está ouvindo, e está baixo".
          ;(barras[i] as HTMLElement).style.height = `${15 + media * 85}%`
        }
      }
      animacaoRef.current = requestAnimationFrame(desenhar)
    }
    desenhar()
  }

  const enviar = useCallback(
    async (audio: Blob, mime: string, extensao: string) => {
      const nome = nomeDoAudio(new Date(), extensao)

      setFase('subindo')
      const preparo = await acaoPrepararEnvioDeArquivo(clienteId, {
        nome,
        // O MIME **sem** `;codecs=`: o `allowed_mime_types` do bucket compara
        // string exata, e `audio/ogg;codecs=opus` não bate com `audio/ogg`.
        tipo: mime,
        bytes: audio.size,
      })

      if (!preparo.ok || !preparo.envio) {
        setErro(preparo.erro ?? 'não deu para preparar o envio')
        return
      }

      const subida = await fetch(preparo.envio.url, {
        method: 'PUT',
        body: audio,
        headers: { 'content-type': mime },
      })

      if (!subida.ok) {
        setErro('o áudio não subiu; tente de novo')
        return
      }

      setFase('enviando')
      const r = await acaoEnviarMidiaDoInbox(clienteId, contatoId, {
        url: preparo.envio.urlPublica,
        midia: 'audio',
        nomeArquivo: preparo.envio.nome,
      })

      if (!r.ok) setErro(r.erro ?? 'não deu para enviar')
    },
    [clienteId, contatoId],
  )

  /**
   * Deixa o arquivo no formato que a Meta entrega e manda.
   *
   * O Firefox já grava OGG/Opus e nada precisa acontecer. Chrome, Edge e Opera
   * gravam Opus dentro de WebM, que não tem linha na tabela da Meta — e aí o
   * contêiner é trocado aqui, no navegador, sem decodificar nada: os pacotes
   * Opus de um WebM são byte a byte os mesmos de um OGG.
   *
   * O remux devolve `null` quando a entrada não é o que ele sabe ler (lacing,
   * faixa que não é Opus). Isso vira frase na tela, e não um arquivo que a
   * Cloud API aceita com 200 e nunca entrega — que foi o modo de falha das duas
   * tentativas anteriores.
   */
  const prepararEEnviar = useCallback(
    async (gravado: Blob, formato: FormatoDeGravacao) => {
      let audio = gravado
      if (formato.remux) {
        setFase('subindo')
        const bytes = new Uint8Array(await gravado.arrayBuffer())
        const ogg = webmOpusParaOgg(bytes)
        if (!ogg) {
          setErro('Não deu para preparar o áudio neste navegador. Tente pelo Firefox.')
          return
        }
        audio = new Blob([ogg as unknown as BlobPart])
      }
      await enviar(audio, formato.mime, formato.extensao)
    },
    // `enviar` é estável — depende só de clienteId e contatoId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clienteId, contatoId],
  )

  async function comecar() {
    setErro(null)

    const formato = escolherFormato((m) => MediaRecorder.isTypeSupported(m))
    if (!formato) {
      setErro(SEM_FORMATO)
      return
    }

    /*
     * `navigator.mediaDevices` **não existe** fora de contexto seguro — http
     * puro, ou o painel aberto por IP na rede local. Sem esta conferência o
     * `getUserMedia` estoura `TypeError` e cai na frase genérica, que manda
     * procurar um cadeado que não vai resolver nada.
     */
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro('Gravar áudio só funciona em endereço https. Abra o painel pelo endereço oficial.')
      return
    }

    setFase('pedindo')

    let trilha: MediaStream
    try {
      trilha = await navigator.mediaDevices.getUserMedia({ audio: RESTRICOES_DO_MICROFONE })
    } catch (e) {
      setErro(motivoDoMicrofone(e))
      setFase('parado')
      return
    }

    trilhaRef.current = trilha
    pedacosRef.current = []
    descartarRef.current = false

    const gravador = new MediaRecorder(trilha, { mimeType: formato.mimeType })
    gravadorRef.current = gravador

    /*
     * O tipo **efetivo**, e não o pedido. É aqui que a troca aparece: pedimos
     * AAC em MP4 e o navegador pode devolver Opus em MP4, que a Meta aceita
     * subir e não entrega.
     */
    const efetivo = gravador.mimeType || formato.mimeType
    if (!gravouOpus(efetivo)) {
      setErro(`${CODEC_TROCADO} (o navegador gravou ${efetivo})`)
      soltarMicrofone()
      setFase('parado')
      return
    }

    gravador.ondataavailable = (e) => {
      if (e.data.size > 0) pedacosRef.current.push(e.data)
    }

    gravador.onerror = () => {
      setErro('a gravação falhou no meio')
      soltarMicrofone()
      setFase('parado')
    }

    gravador.onstop = () => {
      const pedacos = pedacosRef.current
      pedacosRef.current = []
      soltarMicrofone()

      if (descartarRef.current) {
        setFase('parado')
        return
      }

      const gravado = new Blob(pedacos)

      // Toque de microfone: `stop()` imediato produz um arquivo de cabeçalho e
      // nada mais. Mandar isso seria mandar silêncio para o cliente.
      if (gravado.size < 1024) {
        setErro('a gravação ficou vazia; segure por pelo menos um segundo')
        setFase('parado')
        return
      }

      void prepararEEnviar(gravado, formato).finally(() => setFase('parado'))
    }

    setSegundos(0)
    gravador.start()
    ligarMedidor(trilha)
    setFase('gravando')
  }

  function parar(descartando: boolean) {
    descartarRef.current = descartando
    // `inactive` acontece quando o `onerror` já derrubou o gravador. Chamar
    // `stop()` aí estoura `InvalidStateError` por cima de um erro já tratado.
    if (gravadorRef.current?.state !== 'inactive') gravadorRef.current?.stop()
  }

  /*
   * O teto **envia**, não descarta. Perder cinco minutos de fala por causa de
   * um limite nosso seria pior do que o limite existir.
   */
  useEffect(() => {
    if (fase === 'gravando' && segundos >= LIMITE_DE_GRAVACAO_S) parar(false)
  }, [fase, segundos])

  const ocupado = desabilitado || fase === 'subindo' || fase === 'enviando' || fase === 'pedindo'
  const faltando = LIMITE_DE_GRAVACAO_S - segundos

  if (fase === 'gravando') {
    return (
      <div className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => parar(true)}
          title="Descartar a gravação"
          aria-label="Descartar a gravação"
          className="shrink-0 rounded-lg px-1.5 py-1 text-[15px] text-dim transition hover:text-perigo"
        >
          🗑
        </button>

        <span
          aria-live="polite"
          className="flex shrink-0 items-center gap-1.5 text-[12px] tabular-nums text-perigo"
        >
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
          {duracaoLegivel(segundos)}
        </span>

        {/*
          O medidor vem do som real do microfone — é o que prova que ele está
          captando. Microfone mudo grava um arquivo válido e silencioso, e sem
          isto só se descobre depois de mandar.
        */}
        <div
          ref={barrasRef}
          aria-hidden
          className="flex h-6 flex-1 items-center justify-center gap-[3px] overflow-hidden"
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-primary/70 transition-[height] duration-75"
              style={{ height: '15%' }}
            />
          ))}
        </div>

        {faltando <= AVISO_DE_FIM_S && (
          <span className="shrink-0 text-[10.5px] text-dim">para em {faltando}s</span>
        )}

        <button
          type="button"
          onClick={() => parar(false)}
          title="Enviar o áudio"
          aria-label="Enviar o áudio"
          className="app-primary-button shrink-0 rounded-full px-3.5 py-2 text-[13px]"
        >
          ➤
        </button>
      </div>
    )
  }

  /*
   * O que a dica diz quando o botão está ocupado.
   *
   * Sendo só um ícone, o rótulo de texto que existia aqui ("Abrindo…",
   * "Subindo…") não tem mais onde caber. Ele não some: vira a dica e o
   * `aria-label`, porque "por que o microfone não responde" é justamente a
   * pergunta que essas três palavras existiam para responder.
   */
  const rotulo =
    fase === 'pedindo'
      ? 'Abrindo o microfone…'
      : fase === 'subindo'
        ? 'Subindo o áudio…'
        : fase === 'enviando'
          ? 'Enviando o áudio…'
          : 'Gravar um áudio'

  return (
    /*
     * `relative`, e o erro flutuando por cima.
     *
     * A linha de escrever é um flex sem quebra: um parágrafo de erro como irmão
     * do botão espremeria o campo de texto até sumir. Flutuando acima, ele
     * aparece onde se estava olhando e não move nada de lugar.
     */
    <span className="relative shrink-0">
      <Dica texto={rotulo} lado="cima">
        <button
          type="button"
          disabled={ocupado}
          onClick={comecar}
          aria-label={rotulo}
          className={`${BOTAO_DA_BARRA}${fase === 'parado' ? '' : ' animate-pulse'}`}
        >
          <IconeMicrofone />
        </button>
      </Dica>

      {erro && (
        <p className="absolute right-0 bottom-[calc(100%+8px)] z-30 w-[260px] rounded-[10px] border border-rose-400/25 bg-panel px-3 py-2 text-[11.5px] leading-5 text-perigo shadow-pop">
          {erro}
        </p>
      )}
    </span>
  )
}
