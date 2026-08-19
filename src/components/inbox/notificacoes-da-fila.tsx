'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { idsDosAlertas, novosAlertas, type AlertaDaFila } from './alertas'

const respostaSchema = z.object({
  alertas: z.array(
    z.object({
      id: z.string().min(1),
      contatoId: z.string().uuid(),
      nome: z.string().nullable(),
      motivo: z.string().min(1),
      // Postgres pode serializar `timestamptz` com `+00:00`, não só com `Z`.
      desde: z.string().datetime({ offset: true }),
    }),
  ),
})

type Permissao = NotificationPermission | 'indisponivel'

const INTERVALO_DE_CONSULTA = 30_000

function permissaoAtual(): Permissao {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'indisponivel'
  return window.Notification.permission
}

/**
 * Alerta opt-in do navegador quando alguém entra na fila.
 *
 * **Ele mora na moldura do cliente, e não só no Inbox** — e essa mudança é a
 * metade barata do buraco que o §3.10.1 descreve: o handoff acontecia e
 * ninguém percebia, *a não ser que a pessoa estivesse com o Inbox aberto*.
 * Quem está desenhando um fluxo ou conferindo contatos está no painel do mesmo
 * jeito, e é justamente quem dá para avisar de graça.
 *
 * O que continua faltando é avisar quem **não** está no painel: push de
 * verdade (com service worker e assinatura guardada) e e-mail. Os dois pedem
 * banco ou SMTP — ver docs/PENDENCIAS-DO-DONO.md.
 *
 * Não registra telefone nem conteúdo em storage. A permissão pertence ao
 * navegador e só é pedida em clique explícito, como eles exigem.
 */
export function NotificacoesDaFila({
  clienteId,
  alertasIniciais,
  compacto = false,
}: {
  clienteId: string
  /**
   * O que já estava pendente quando a tela abriu, quando quem chama já tem
   * essa lista na mão.
   *
   * Ausente, a **primeira consulta** vira a linha de base e não avisa nada.
   * Sem isso, abrir uma tela qualquer do painel dispararia, trinta segundos
   * depois, uma notificação para cada conversa que já estava esperando —
   * uma rajada que ensina a pessoa a desligar o aviso.
   */
  alertasIniciais?: AlertaDaFila[]
  /** Na barra lateral o espaço é de 226px: só o ponto e uma palavra. */
  compacto?: boolean
}) {
  const router = useRouter()
  const vistos = useRef<Set<string> | null>(
    alertasIniciais ? idsDosAlertas(alertasIniciais) : null,
  )
  const [permissao, setPermissao] = useState<Permissao>(permissaoAtual)

  useEffect(() => {
    let ativa = true

    async function atualizar() {
      try {
        const resposta = await fetch(`/api/clientes/${clienteId}/inbox/alertas`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (!resposta.ok) return

        const corpo: unknown = await resposta.json()
        const dados = respostaSchema.safeParse(corpo)
        if (!dados.success || !ativa) return

        const primeiraLeitura = vistos.current === null
        const novos = primeiraLeitura ? [] : novosAlertas(dados.data.alertas, vistos.current!)
        vistos.current = idsDosAlertas(dados.data.alertas)

        if (permissaoAtual() !== 'granted') return
        for (const alerta of novos) {
          avisar(clienteId, alerta, (destino) => router.push(destino))
        }
      } catch {
        // Polling é melhoria de conveniência. Falhar em silêncio deixa o Inbox
        // usável e evita transformar uma oscilação temporária em alerta falso.
      }
    }

    // Uma consulta na entrada, para a linha de base não depender de esperar
    // trinta segundos — e para quem abriu o painel já ficar em dia.
    void atualizar()

    const intervalo = window.setInterval(() => void atualizar(), INTERVALO_DE_CONSULTA)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void atualizar()
    }
    document.addEventListener('visibilitychange', aoVoltar)

    return () => {
      ativa = false
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [clienteId, router])

  async function pedirPermissao() {
    if (permissaoAtual() !== 'default') return setPermissao(permissaoAtual())
    const novaPermissao = await window.Notification.requestPermission()
    setPermissao(novaPermissao)
  }

  if (permissao === 'indisponivel') return null

  const ativo = permissao === 'granted'
  const bloqueado = permissao === 'denied'

  if (compacto) {
    return (
      <button
        type="button"
        onClick={() => void pedirPermissao()}
        disabled={bloqueado}
        title={
          ativo
            ? 'Avisa quando alguém entra na fila, em qualquer tela do painel.'
            : bloqueado
              ? 'Os alertas foram bloqueados no navegador. Libere nas permissões do site.'
              : 'Ative o aviso de novo atendimento.'
        }
        className="flex w-full items-center gap-2 rounded-[10px] px-1.5 py-1.5 text-left transition hover:bg-white/[0.04] disabled:cursor-not-allowed"
      >
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${ativo ? 'bg-emerald-400' : bloqueado ? 'bg-rose-400' : 'bg-amber-300'}`}
        />
        <span className="flex-1 text-[11.5px] text-muted">
          {ativo ? 'Avisos ligados' : bloqueado ? 'Avisos bloqueados' : 'Avisos desligados'}
        </span>
        {!ativo && !bloqueado && <span className="text-[10.5px] text-dim">ligar</span>}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${ativo ? 'bg-emerald-400' : bloqueado ? 'bg-rose-400' : 'bg-amber-300'}`} />
      <button
        type="button"
        onClick={() => void pedirPermissao()}
        disabled={bloqueado}
        title={
          ativo
            ? 'Alertas nativos ativos para novos atendimentos enquanto este Inbox estiver aberto.'
            : bloqueado
              ? 'Os alertas foram bloqueados no navegador. Libere-os nas permissões do site para ativar.'
              : 'Ative alertas nativos para novos atendimentos.'
        }
        className={`rounded-full border px-3 py-1.5 text-[10.5px] font-bold transition ${
          ativo
            ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300'
            : bloqueado
              ? 'cursor-not-allowed border-rose-400/20 bg-rose-400/[0.06] text-rose-300/70'
              : 'border-amber-300/25 bg-amber-300/[0.07] text-amber-100 hover:bg-amber-300/[0.13]'
        }`}
      >
        {ativo ? 'Alertas ativos' : bloqueado ? 'Alertas bloqueados' : 'Ativar alertas'}
      </button>
    </div>
  )
}

function avisar(clienteId: string, alerta: AlertaDaFila, irPara: (destino: string) => void) {
  const nome = (alerta.nome?.trim() || 'Novo contato').slice(0, 80)
  const motivo = alerta.motivo.trim().slice(0, 160)
  const notificacao = new window.Notification(`Atendimento: ${nome}`, {
    body: motivo,
    tag: `autofluxos:${alerta.id}`,
  })

  notificacao.onclick = () => {
    window.focus()
    irPara(`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(alerta.contatoId)}`)
    notificacao.close()
  }
}
