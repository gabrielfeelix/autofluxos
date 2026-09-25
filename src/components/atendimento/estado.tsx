'use client'

import { useState } from 'react'
import { useConfirmar } from '@/components/design/confirmar'
import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { estadoDoAtendimento, type Atendimento } from '@/core/estado-do-atendimento'
import { useConversaAbertaOuNada } from '@/components/inbox/conversa-local'
import { horaExata } from '@/lib/quando'

type Resultado = { ok: boolean; erro?: string }

const TOM = {
  aguardando_humano: 'border-rose-400/35 bg-rose-400/[0.07] text-perigo',
  com_humano: 'border-amber-400/35 bg-amber-400/[0.07] text-aviso',
  bot: 'border-emerald-500/30 bg-emerald-400/[0.07] text-ok',
  encerrado: 'border-line bg-surface text-muted',
} as const

/**
 * O atendimento como a tela deve mostrar agora.
 *
 * Dentro do Inbox (`ProvedorDaConversa`), recalcula com o que esta aba acabou
 * de mudar: pausar o bot no cabeçalho, assumir, finalizar. É a mesma função
 * pura que o servidor usa, então o selo e o cartão dizem no clique o que o
 * servidor diria no próximo carregamento. Fora do provedor, vale o do servidor.
 */
function useAtendimentoVivo(atendimento: Atendimento, donoNome: string | null) {
  const aberta = useConversaAbertaOuNada()
  if (!aberta) return { atendimento, donoNome, aberta: null }
  const v = aberta.valor
  const vivo = estadoDoAtendimento({
    automacaoAtiva: v.automacaoAtiva,
    aguardando: v.aguardando,
    atribuidoA: v.atribuidoA,
    sessaoComPessoa: v.sessaoComPessoa,
    estado: v.estado,
    temAutomacao: aberta.temAutomacao,
    usuarioId: aberta.usuarioId,
  })
  const nome = v.atribuidoA
    ? (aberta.equipe.find((membro) => membro.id === v.atribuidoA)?.nome ?? 'alguém fora da equipe')
    : null
  return { atendimento: vivo, donoNome: nome, aberta }
}

/** O selo do estado com o dono: "Em atendimento · com Ana" (tarefa 8.1). */
export function SeloDoAtendimento({
  atendimento: doServidor,
  donoNome: donoDoServidor,
}: {
  atendimento: Atendimento
  donoNome: string | null
}) {
  const { atendimento, donoNome } = useAtendimentoVivo(doServidor, donoDoServidor)
  const tom = atendimento.rotulo === 'Atendimento manual' ? TOM.encerrado : TOM[atendimento.estado]
  return (
    <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] font-bold ${tom}`}>
      {atendimento.rotulo}
      <span className="truncate font-semibold opacity-80">
        {donoNome ? `· com ${donoNome}` : '· sem responsável'}
      </span>
    </span>
  )
}

/**
 * O estado do atendimento com dono, efeito e a próxima ação, igual no Inbox e
 * na ficha (tarefa 8.1). Finalizar confirma antes, dizendo que o bot volta.
 */
export function CartaoDoAtendimento({
  atendimento: doServidor,
  donoNome: donoDoServidor,
  aguardando,
  automacaoAtiva,
  finalizar,
  alternarBot,
  largo = false,
}: {
  atendimento: Atendimento
  donoNome: string | null
  automacaoAtiva: boolean
  aguardando: { motivo: string; desde: string } | null
  /** `acaoEncerrarAtendimento` já ligada ao contato. */
  finalizar: () => Promise<void | Resultado>
  /** `acaoAlternarAutomacaoDoLead` já ligada ao contato. */
  alternarBot: (ativa: boolean) => Promise<Resultado>
  /** Na ficha: texto à esquerda e botões à direita, numa faixa. */
  largo?: boolean
}) {
  const { confirmar, dialogo, rodando } = useConfirmar()
  const { atendimento, donoNome, aberta } = useAtendimentoVivo(doServidor, donoDoServidor)
  const semProvedor = useAcaoOtimista(automacaoAtiva)
  const [erroDoBot, setErroDoBot] = useState<string | null>(null)
  /*
   * No Inbox o bot mora no store da conversa, o mesmo do botão do cabeçalho:
   * pausar num lugar muda os dois. Fora dele (a Ficha) continua o hook local.
   */
  const bot = aberta
    ? {
        valor: aberta.valor.automacaoAtiva,
        pendente: false,
        erro: erroDoBot,
        agir: (nova: boolean, acao: () => Promise<Resultado>) => {
          setErroDoBot(null)
          const desfazer = aberta.mudar({ automacaoAtiva: nova })
          acao().then(
            (r) => {
              if (r.ok === false || r.erro) {
                desfazer()
                setErroDoBot(r.erro ?? 'não deu para salvar')
              }
            },
            () => {
              desfazer()
              setErroDoBot('sem conexão com o servidor')
            },
          )
        },
      }
    : semProvedor
  const manual = atendimento.rotulo === 'Atendimento manual'
  const tom = manual ? TOM.encerrado : TOM[atendimento.estado]
  const podeFinalizar =
    atendimento.estado === 'aguardando_humano' ||
    (atendimento.estado === 'com_humano' && atendimento.rotulo === 'Em atendimento')

  return (
    <div
      className={`rounded-[11px] border px-3 py-2.5 ${tom} ${largo ? 'flex flex-wrap items-center gap-x-4 gap-y-2 px-[17px] py-[13px]' : ''}`}
    >
      <div className="min-w-0 flex-1 basis-[260px]">
      <p className="text-[11px] font-bold tracking-[0.04em] uppercase">{atendimento.rotulo}</p>
      <p className="mt-0.5 text-[11.5px] text-soft">
        {donoNome ? `Responsável: ${donoNome}` : 'Sem responsável'}
      </p>
      {aguardando && (
        <>
          {/* O motivo inteiro, quebrando linha: é aqui que se entende o pedido. */}
          <p className="mt-1 text-[12px] leading-4 break-words text-soft">{aguardando.motivo}</p>
          <p className="mt-1 text-[11px] text-dim">esperando desde {horaExata(aguardando.desde)}</p>
        </>
      )}
      <p className="mt-1.5 text-[11.5px] leading-4 text-muted">{atendimento.efeito}</p>
      </div>
      <div className={largo ? 'flex shrink-0 flex-wrap gap-2 [&>button]:mt-0 [&>button]:w-auto [&>button]:px-3.5' : ''}>

      {podeFinalizar && (
        <button
          type="button"
          disabled={rodando}
          onClick={() =>
            confirmar({
              titulo: 'Finalizar o atendimento?',
              descricao: manual
                ? 'A conversa sai da fila de quem espera pessoa.'
                : 'Na próxima mensagem o bot volta a responder. O histórico continua como está.',
              rotulo: 'Finalizar atendimento',
              tom: 'normal',
              /*
                Finalizar não é otimista: dispara o pós-atendimento, que pode
                mandar mensagem ao cliente. O modal mostra "Aguarde…" até o
                "ok", e só então o cartão muda, sem recarregar a página.
              */
              aoConfirmar: async () => {
                const r = await finalizar()
                if (!(r && (r.ok === false || r.erro))) {
                  aberta?.mudar({ aguardando: null, sessaoComPessoa: false })
                }
                return r
              },
            })
          }
          className="mt-2.5 w-full rounded-[8px] border border-current/30 bg-white/60 px-2.5 py-2 text-[12px] font-bold transition hover:bg-white disabled:opacity-50 dark:bg-transparent"
        >
          Finalizar atendimento
        </button>
      )}

      {!manual && (atendimento.estado === 'bot' || atendimento.proximaAcao === 'religar_bot') && (
        <button
          type="button"
          disabled={bot.pendente}
          title={
            bot.valor
              ? 'As próximas mensagens entram no histórico, sem resposta automática.'
              : 'O bot volta a responder a partir da próxima mensagem.'
          }
          onClick={() => bot.agir(!bot.valor, () => alternarBot(!bot.valor))}
          className="mt-2.5 w-full rounded-[8px] border border-current/30 px-2.5 py-2 text-[12px] font-bold transition hover:bg-white/60 disabled:opacity-50"
        >
          {bot.valor ? 'Pausar bot' : 'Religar bot'}
        </button>
      )}
      </div>
      {bot.erro && (
        <p role="alert" className="mt-1.5 text-[11.5px] text-perigo">
          {bot.erro}
        </p>
      )}
      {dialogo}
    </div>
  )
}
