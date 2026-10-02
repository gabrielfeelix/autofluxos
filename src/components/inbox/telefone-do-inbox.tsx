'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * O telefone do Inbox: toca quando um visitante liga pelo chat do site, atende
 * e mantém a ligação (0118, `server/chamadas.ts`).
 *
 * Quem avisa que está tocando é o stream do Inbox, num evento próprio que o
 * `PulsoDoInbox` repassa pela janela. Atendida, a ligação vira um cartão fixo
 * no canto, e continua de pé enquanto o atendente navega entre conversas: o
 * componente mora na página do Inbox, fora da conversa aberta.
 *
 * O áudio vai direto entre os dois navegadores. Aqui só se monta a resposta
 * WebRTC para a oferta do visitante e se pergunta, a cada dois segundos, se o
 * outro lado desligou.
 */

type Tocando = { id: string; contatoId: string; nome: string; desde: string }

type Fase =
  | { tipo: 'livre' }
  | { tipo: 'tocando'; chamada: Tocando }
  | { tipo: 'conectando'; chamada: Tocando }
  | { tipo: 'falando'; chamada: Tocando; desde: number }
  | { tipo: 'fim'; chamada: Tocando; texto: string }

const ESPERA_DO_ICE_MS = 3_000

export function TelefoneDoInbox({ clienteId }: { clienteId: string }) {
  const [fase, setFase] = useState<Fase>({ tipo: 'livre' })
  const [mudo, setMudo] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const conexao = useRef<RTCPeerConnection | null>(null)
  const microfone = useRef<MediaStream | null>(null)
  const alto = useRef<HTMLAudioElement | null>(null)
  const recusadas = useRef(new Set<string>())
  const faseAtual = useRef(fase)
  // Antes dos outros efeitos: eles leem a fase pelo ref, e efeito roda na ordem.
  useEffect(() => {
    faseAtual.current = fase
  }, [fase])

  const base = `/api/clientes/${clienteId}/chamadas`

  const largar = useCallback(() => {
    conexao.current?.close()
    conexao.current = null
    microfone.current?.getTracks().forEach((t) => t.stop())
    microfone.current = null
    setMudo(false)
  }, [])

  const terminar = useCallback(
    (chamada: Tocando, texto: string) => {
      largar()
      setFase({ tipo: 'fim', chamada, texto })
      setTimeout(() => setFase((f) => (f.tipo === 'fim' && f.chamada.id === chamada.id ? { tipo: 'livre' } : f)), 3_500)
    },
    [largar],
  )

  // O que o stream diz que está tocando.
  useEffect(() => {
    function aoChegar(evento: Event) {
      let lista: Tocando[] = []
      try {
        lista = JSON.parse(String((evento as CustomEvent).detail))
      } catch {
        return
      }
      const f = faseAtual.current
      if (f.tipo === 'tocando' && !lista.some((c) => c.id === f.chamada.id)) {
        // Parou de tocar sem ninguém aqui atender: outro atendente pegou, ou o
        // visitante desistiu.
        setFase({ tipo: 'livre' })
        return
      }
      if (f.tipo !== 'livre') return
      const nova = lista.find((c) => !recusadas.current.has(c.id))
      if (nova) setFase({ tipo: 'tocando', chamada: nova })
    }
    window.addEventListener('autofluxos:chamadas', aoChegar)
    return () => window.removeEventListener('autofluxos:chamadas', aoChegar)
  }, [])

  // O toque: dois bipes a cada dois segundos, gerados na hora, sem arquivo.
  useEffect(() => {
    if (fase.tipo !== 'tocando') return
    let contexto: AudioContext | null = null
    try {
      contexto = new AudioContext()
    } catch {
      return
    }
    const ctx = contexto
    const bipe = (em: number) => {
      const osc = ctx.createOscillator()
      const volume = ctx.createGain()
      osc.frequency.value = 880
      volume.gain.setValueAtTime(0.0001, ctx.currentTime + em)
      volume.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + em + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + em + 0.35)
      osc.connect(volume).connect(ctx.destination)
      osc.start(ctx.currentTime + em)
      osc.stop(ctx.currentTime + em + 0.4)
    }
    const tocar = () => {
      bipe(0)
      bipe(0.45)
    }
    tocar()
    const relogio = setInterval(tocar, 2_000)
    return () => {
      clearInterval(relogio)
      void ctx.close()
    }
  }, [fase.tipo])

  // Durante a ligação: o relógio da tela e a pergunta "o outro lado desligou?".
  useEffect(() => {
    if (fase.tipo !== 'falando') return
    const chamada = fase.chamada
    const relogio = setInterval(() => setAgora(Date.now()), 1_000)
    const vigia = setInterval(async () => {
      const r = await fetch(`${base}/${chamada.id}`, { cache: 'no-store' }).catch(() => null)
      if (!r?.ok) return
      const { status } = (await r.json()) as { status: string }
      if (status !== 'em_andamento') terminar(chamada, 'O visitante desligou')
    }, 2_000)
    return () => {
      clearInterval(relogio)
      clearInterval(vigia)
    }
  }, [fase, base, terminar])

  // Fechar a aba no meio da ligação desliga do lado do servidor também.
  useEffect(() => {
    if (fase.tipo !== 'falando') return
    const id = fase.chamada.id
    const sair = () => navigator.sendBeacon?.(`${base}/${id}`, new Blob([JSON.stringify({ acao: 'encerrar' })], { type: 'application/json' }))
    window.addEventListener('pagehide', sair)
    return () => window.removeEventListener('pagehide', sair)
  }, [fase, base])

  useEffect(() => largar, [largar])

  async function atender(chamada: Tocando) {
    setFase({ tipo: 'conectando', chamada })
    try {
      const r = await fetch(`${base}/${chamada.id}`, { cache: 'no-store' })
      const estado = r.ok ? ((await r.json()) as { status: string; oferta: string | null; iceServers: RTCIceServer[] }) : null
      if (!estado || estado.status !== 'chamando' || !estado.oferta) return terminar(chamada, 'A ligação caiu antes de atender')

      let micro: MediaStream
      try {
        micro = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      } catch {
        await fetch(`${base}/${chamada.id}`, { method: 'POST', body: JSON.stringify({ acao: 'recusar' }) })
        return terminar(chamada, 'Libere o microfone do navegador para atender')
      }
      microfone.current = micro

      const pc = new RTCPeerConnection({ iceServers: estado.iceServers })
      conexao.current = pc
      micro.getTracks().forEach((t) => pc.addTrack(t, micro))
      pc.ontrack = (e) => {
        if (alto.current) {
          alto.current.srcObject = e.streams[0] ?? new MediaStream([e.track])
          void alto.current.play().catch(() => {})
        }
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          void fetch(`${base}/${chamada.id}`, { method: 'POST', body: JSON.stringify({ acao: 'encerrar' }) })
          terminar(chamada, 'A conexão caiu')
        }
      }

      await pc.setRemoteDescription({ type: 'offer', sdp: estado.oferta })
      await pc.setLocalDescription(await pc.createAnswer())
      await juntarCandidatos(pc)

      const envio = await fetch(`${base}/${chamada.id}`, {
        method: 'POST',
        body: JSON.stringify({ acao: 'atender', resposta: pc.localDescription?.sdp ?? '' }),
      })
      if (!envio.ok) {
        const { erro } = (await envio.json().catch(() => ({}))) as { erro?: string }
        return terminar(chamada, erro ?? 'Não deu para atender')
      }
      setAgora(Date.now())
      setFase({ tipo: 'falando', chamada, desde: Date.now() })
    } catch {
      terminar(chamada, 'Não deu para atender')
    }
  }

  async function recusar(chamada: Tocando) {
    recusadas.current.add(chamada.id)
    setFase({ tipo: 'livre' })
    await fetch(`${base}/${chamada.id}`, { method: 'POST', body: JSON.stringify({ acao: 'recusar' }) }).catch(() => {})
  }

  async function desligar(chamada: Tocando, desde: number) {
    terminar(chamada, `Ligação encerrada · ${duracao(Date.now() - desde)}`)
    await fetch(`${base}/${chamada.id}`, { method: 'POST', body: JSON.stringify({ acao: 'encerrar' }) }).catch(() => {})
  }

  function alternarMudo() {
    const novo = !mudo
    microfone.current?.getAudioTracks().forEach((t) => (t.enabled = !novo))
    setMudo(novo)
  }

  return (
    <>
      <audio ref={alto} autoPlay className="hidden" />
      {fase.tipo !== 'livre' && (
        <div
          role={fase.tipo === 'tocando' ? 'alertdialog' : 'status'}
          aria-label={fase.tipo === 'tocando' ? `Ligação de ${fase.chamada.nome}` : 'Ligação'}
          className="fixed right-5 bottom-5 z-[60] w-[320px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[18px] border border-line bg-panel shadow-[0_24px_60px_-18px_rgba(22,24,29,.45)]"
        >
          <div className="flex items-center gap-3.5 px-4 pt-4 pb-3.5">
            <span className="relative flex size-12 shrink-0 items-center justify-center">
              {fase.tipo === 'tocando' && (
                <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-emerald-500/30 motion-reduce:animate-none" />
              )}
              <span
                className={`relative flex size-12 items-center justify-center rounded-full text-[17px] font-bold text-white ${
                  fase.tipo === 'fim' ? 'bg-strong' : 'bg-emerald-500'
                }`}
              >
                {iniciais(fase.chamada.nome)}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold tracking-[.04em] text-dim uppercase">
                {fase.tipo === 'tocando'
                  ? 'Ligação pelo site'
                  : fase.tipo === 'conectando'
                    ? 'Conectando'
                    : fase.tipo === 'falando'
                      ? 'Em ligação'
                      : 'Fim da ligação'}
              </p>
              <Link
                href={`/clientes/${clienteId}/inbox?conversa=${fase.chamada.contatoId}`}
                className="block truncate text-[15px] font-bold text-ink hover:underline"
              >
                {fase.chamada.nome}
              </Link>
              <p className="text-[12.5px] text-dim tabular-nums">
                {fase.tipo === 'falando' ? duracao(agora - fase.desde) : fase.tipo === 'fim' ? fase.texto : 'Voz pelo navegador'}
              </p>
            </div>
          </div>

          {fase.tipo === 'tocando' && (
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => recusar(fase.chamada)}
                className="flex items-center justify-center gap-2 rounded-[11px] border border-line py-2.5 text-[13px] font-bold text-perigo transition hover:bg-rose-400/[0.08]"
              >
                <IconeTelefone desligar /> Recusar
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => atender(fase.chamada)}
                className="flex items-center justify-center gap-2 rounded-[11px] bg-emerald-600 py-2.5 text-[13px] font-bold text-white transition hover:bg-emerald-700"
              >
                <IconeTelefone /> Atender
              </button>
            </div>
          )}

          {fase.tipo === 'falando' && (
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <button
                type="button"
                aria-pressed={mudo}
                onClick={alternarMudo}
                className={`flex items-center justify-center gap-2 rounded-[11px] border py-2.5 text-[13px] font-bold transition ${
                  mudo ? 'border-ink bg-ink text-panel' : 'border-line text-ink hover:bg-surface'
                }`}
              >
                <IconeMicrofone mudo={mudo} /> {mudo ? 'No mudo' : 'Mudo'}
              </button>
              <button
                type="button"
                onClick={() => desligar(fase.chamada, fase.desde)}
                className="flex items-center justify-center gap-2 rounded-[11px] bg-rose-600 py-2.5 text-[13px] font-bold text-white transition hover:bg-rose-700"
              >
                <IconeTelefone desligar /> Encerrar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** Espera os candidatos ICE, com teto: sem eles, a resposta não acha caminho. */
function juntarCandidatos(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((pronto) => {
    const fim = () => {
      pc.removeEventListener('icegatheringstatechange', ver)
      pronto()
    }
    const ver = () => pc.iceGatheringState === 'complete' && fim()
    pc.addEventListener('icegatheringstatechange', ver)
    setTimeout(fim, ESPERA_DO_ICE_MS)
  })
}

function duracao(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')).toUpperCase() || '?'
}

function IconeTelefone({ desligar }: { desligar?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden
      style={desligar ? { transform: 'rotate(135deg)' } : undefined}
    >
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </svg>
  )
}

function IconeMicrofone({ mudo }: { mudo: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {mudo && <path d="M4 4l16 16" />}
    </svg>
  )
}
