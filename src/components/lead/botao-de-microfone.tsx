'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AVISO_DE_FIM_S,
  duracaoLegivel,
  escolherFormato,
  LIMITE_DE_GRAVACAO_S,
  motivoDoMicrofone,
  nomeDoAudio,
  RESTRICOES_DO_MICROFONE,
  SEM_FORMATO,
  type FormatoDeGravacao,
} from '@/core/audio-de-voz'
import { acaoPrepararEnvioDeArquivo } from '@/server/acoes'
import { acaoEnviarMidiaDoInbox } from '@/server/acoes-midia-do-inbox'

/**
 * Gravar um áudio e mandar, na caixa de resposta do Inbox.
 *
 * ---------------------------------------------------------------------------
 * O envio nunca foi o problema
 * ---------------------------------------------------------------------------
 *
 * `enviarMidia` manda `audio` desde a Fase 11 do motor, e o clipe de anexo já
 * subia um MP3 escolhido do disco. O que não existia era **gravar** — e quem
 * atende no WhatsApp grava; é assim que se responde uma dúvida longa sem
 * digitar três parágrafos.
 *
 * O trabalho real estava no formato, e ele mora em `core/audio-de-voz.ts`
 * porque é regra testável: a Meta não aceita `audio/webm`, que era o padrão
 * histórico do Chrome. Hoje Chrome, Edge, Opera e Safari gravam `audio/mp4` e
 * o Firefox grava OGG/Opus — os dois na tabela da Meta —, então não há
 * conversão nenhuma aqui dentro. Ver `docs/PESQUISA-VOZ-E-CHAMADA.md`.
 *
 * ---------------------------------------------------------------------------
 * O caminho do arquivo é o mesmo do clipe, de propósito
 * ---------------------------------------------------------------------------
 *
 * URL assinada → Storage → Server Action com o endereço. Um `Blob` atravessando
 * Server Action bate no mesmo teto de 1 MB do Next que o clipe já descobriu, e
 * cinco minutos de voz passam disso. Reusar o caminho também significa reusar a
 * validação de tipo, o teto de 16 MB e a limpeza do acervo quando o cliente é
 * apagado — um segundo lugar para guardar arquivo seria um segundo lugar para
 * vazar.
 *
 * ---------------------------------------------------------------------------
 * Parar e cancelar são botões diferentes, e isso não é enfeite
 * ---------------------------------------------------------------------------
 *
 * Um áudio gravado por engano não pode ter como única saída "mandar e apagar
 * depois" — no WhatsApp não existe apagar depois que funcione. O `✕` descarta
 * antes de qualquer byte sair do navegador.
 */
export function BotaoDeMicrofone({
  clienteId,
  contatoId,
  desabilitado = false,
}: {
  clienteId: string
  contatoId: string
  desabilitado?: boolean
}) {
  const [fase, setFase] = useState<'parado' | 'pedindo' | 'gravando' | 'subindo' | 'enviando'>(
    'parado',
  )
  const [segundos, setSegundos] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  const gravadorRef = useRef<MediaRecorder | null>(null)
  const trilhaRef = useRef<MediaStream | null>(null)
  const pedacosRef = useRef<Blob[]>([])
  /*
   * Quem decide o destino do áudio é quem clicou, e a decisão precisa chegar ao
   * `onstop` — que dispara depois, e sem argumento. Um `ref` e não um estado:
   * `stop()` é síncrono, e um `setState` aqui só chegaria no render seguinte,
   * ou seja, depois de o `onstop` já ter lido o valor velho e mandado um áudio
   * que a pessoa cancelou.
   */
  const descartarRef = useRef(false)

  /** Solta o microfone. Sem isto, a aba fica com o ponto vermelho para sempre. */
  const soltarMicrofone = useCallback(() => {
    trilhaRef.current?.getTracks().forEach((t) => t.stop())
    trilhaRef.current = null
    gravadorRef.current = null
  }, [])

  /*
   * Sair da página no meio de uma gravação é o caso comum — quem atende troca
   * de conversa o tempo todo. Sem esta limpeza o microfone continua aberto numa
   * tela que não existe mais.
   */
  useEffect(() => soltarMicrofone, [soltarMicrofone])

  /* O relógio só existe enquanto grava; fora disso não há o que contar. */
  useEffect(() => {
    if (fase !== 'gravando') return
    const id = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [fase])

  const enviar = useCallback(
    async (audio: Blob, formato: FormatoDeGravacao) => {
      const nome = nomeDoAudio(new Date(), formato.extensao)

      setFase('subindo')
      const preparo = await acaoPrepararEnvioDeArquivo(clienteId, {
        nome,
        // O MIME **sem** `;codecs=`: o `allowed_mime_types` do bucket compara
        // string exata, e `audio/ogg;codecs=opus` não bate com `audio/ogg`.
        tipo: formato.mime,
        bytes: audio.size,
      })

      if (!preparo.ok || !preparo.envio) {
        setErro(preparo.erro ?? 'não deu para preparar o envio')
        return
      }

      const subida = await fetch(preparo.envio.url, {
        method: 'PUT',
        body: audio,
        headers: { 'content-type': formato.mime },
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
        // Áudio não leva legenda na Cloud API, e a ação recusa se vier uma.
      })

      if (!r.ok) setErro(r.erro ?? 'não deu para enviar')
    },
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

      /*
       * `type: formato.mime` e não o do gravador: o `Blob` que o navegador
       * entrega vem carimbado com `;codecs=`, e esse carimbo viraria o
       * `content-type` do `PUT`. Os bytes são os mesmos — só o rótulo muda,
       * para o que o bucket e a Meta sabem ler.
       */
      const audio = new Blob(pedacos, { type: formato.mime })

      // Toque de microfone: `stop()` imediato produz um arquivo de cabeçalho e
      // nada mais. Mandar isso seria mandar silêncio para o cliente.
      if (audio.size < 1024) {
        setErro('a gravação ficou vazia; segure por pelo menos um segundo')
        setFase('parado')
        return
      }

      void enviar(audio, formato).finally(() => setFase('parado'))
    }

    setSegundos(0)
    gravador.start()
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

  return (
    <>
      {fase === 'gravando' ? (
        <span className="flex items-center gap-1.5">
          <span
            aria-live="polite"
            className="flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-400/[0.08] px-2.5 py-1.5 text-[11.5px] tabular-nums text-rose-200"
          >
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
            {duracaoLegivel(segundos)}
            {faltando <= AVISO_DE_FIM_S && (
              <span className="text-dim">· para em {faltando}s</span>
            )}
          </span>

          <button
            type="button"
            onClick={() => parar(false)}
            title="Parar e enviar o áudio"
            className="rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11.5px] text-soft transition hover:border-white/20"
          >
            ⏹ Enviar
          </button>

          <button
            type="button"
            onClick={() => parar(true)}
            title="Descartar a gravação"
            aria-label="Descartar a gravação"
            className="rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11.5px] text-dim transition hover:border-white/20 hover:text-soft"
          >
            ✕
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={ocupado}
          onClick={comecar}
          title="Gravar um áudio"
          className="rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11.5px] text-soft transition hover:border-white/20 disabled:opacity-50"
        >
          {fase === 'pedindo'
            ? 'Abrindo…'
            : fase === 'subindo'
              ? 'Subindo…'
              : fase === 'enviando'
                ? 'Enviando…'
                : '🎤 Gravar'}
        </button>
      )}

      {erro && (
        <p className="mt-2 w-full rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-5 text-rose-200">
          {erro}
        </p>
      )}
    </>
  )
}
