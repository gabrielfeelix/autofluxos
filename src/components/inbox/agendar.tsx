'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  conferirAgendamento,
  foraDaJanela,
  LIMITE_DO_TEXTO,
  paraCampoLocal,
  PREDEFINICOES,
  quandoDaPredefinicao,
  type Predefinicao,
} from '@/core/agendamento'
import { acaoAgendarMensagem, acaoCancelarAgendada } from '@/server/acoes-agendamento'
import { acaoListarTemplates } from '@/server/acoes-transmissoes'
import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'
import type { Template } from '@/server/repos/templates'

/**
 * Marcar uma mensagem para depois, de dentro da conversa.
 *
 * ---------------------------------------------------------------------------
 * O aviso da janela de 24h é o componente inteiro
 * ---------------------------------------------------------------------------
 *
 * Tudo aqui é campo de formulário comum, menos uma coisa: a linha que diz que o
 * horário escolhido já se sabe fora da janela de 24h. Ela é o motivo de esta
 * tela existir em vez de um `prompt()`.
 *
 * Sem ela, marcar "amanhã de manhã" numa conversa que morreu hoje à tarde é uma
 * promessa que o produto não pode cumprir, a Meta recusa texto livre fora da
 * janela, e quem marcou só descobre no dia seguinte, quando o cliente não
 * respondeu porque nunca recebeu.
 *
 * **É aviso e não trava**, de propósito: a janela reabre a cada mensagem do
 * cliente, e a conversa pode muito bem continuar antes da hora marcada.
 */
export function AgendarMensagem({
  clienteId,
  contatoId,
  nome,
  fimDaJanela,
  agendadas,
  aoFechar,
}: {
  clienteId: string
  contatoId: string
  nome: string
  /** Quando a janela de 24h fecha, em ISO. `null` = já está fechada. */
  fimDaJanela: string | null
  agendadas: MensagemAgendada[]
  aoFechar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [quandoBruto, setQuandoBruto] = useState('')
  const [modelo, setModelo] = useState('')
  const [aprovados, setAprovados] = useState<Template[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, comecar] = useTransition()

  const quando = quandoBruto === '' ? null : new Date(quandoBruto)
  const recusa = conferirAgendamento({ texto, quando })
  const avisar = foraDaJanela(quando, fimDaJanela)

  /*
   * A lista de modelos só é buscada quando o horário escolhido cai fora da
   * janela. Quem marca "daqui duas horas" nunca precisa dela, e buscar sempre
   * gastaria uma chamada em toda abertura da caixa de agendar.
   */
  useEffect(() => {
    if (!avisar || aprovados !== null) return
    let vivo = true
    void acaoListarTemplates(clienteId)
      .then((lista) => {
        if (vivo) setAprovados(lista.filter((t) => t.status === 'aprovado'))
      })
      .catch(() => {
        if (vivo) setAprovados([])
      })
    return () => {
      vivo = false
    }
  }, [avisar, aprovados, clienteId])

  function escolher(chave: Predefinicao) {
    setQuandoBruto(paraCampoLocal(quandoDaPredefinicao(chave)))
    setErro(null)
  }

  function marcar() {
    setErro(null)
    const dados = new FormData()
    dados.set('texto', texto)
    /*
     * O campo `datetime-local` devolve "2026-09-16T09:00", sem fuso. O `new
     * Date` do navegador resolve isso no relógio de quem está olhando, que é
     * exatamente o relógio que a pessoa quis dizer, e o `toISOString` congela
     * o instante absoluto. O servidor nunca precisa saber de fuso nenhum.
     */
    dados.set('quando', quando ? quando.toISOString() : '')

    /*
      Só vai quando o horário cai fora da janela: um modelo escolhido, e depois
      a pessoa mudando a hora para daqui duas horas, não deve mandar por modelo
      e cobrar da conta um envio que o texto livre entregaria de graça.
    */
    dados.set('templateId', avisar ? modelo : '')

    comecar(async () => {
      const r = await acaoAgendarMensagem(clienteId, contatoId, dados)
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para agendar')
        return
      }
      setTexto('')
      setQuandoBruto('')
      setModelo('')
      aoFechar()
    })
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold text-soft">Agendar mensagem</p>
        <span className="font-mono text-[10px] text-dim tabular-nums">
          {texto.length}/{LIMITE_DO_TEXTO}
        </span>
      </div>

      <textarea
        rows={3}
        maxLength={LIMITE_DO_TEXTO}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={`O que mandar para ${nome}…`}
        className="app-field mb-2 resize-none px-2.5 py-2 font-texto text-[12.5px] leading-[1.45] placeholder:text-dim"
      />

      <p className="mb-1 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase">Quando</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {PREDEFINICOES.map((p) => (
          <button
            key={p.chave}
            type="button"
            onClick={() => escolher(p.chave)}
            className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-soft transition hover:border-primary/40 hover:text-primary"
          >
            {p.rotulo}
          </button>
        ))}
      </div>

      <input
        type="datetime-local"
        value={quandoBruto}
        onChange={(e) => {
          setQuandoBruto(e.target.value)
          setErro(null)
        }}
        className="app-field mb-2 px-2.5 py-1.5 text-[12px]"
      />

      {/*
        Fora da janela, a caixa passa a **oferecer a saída** em vez de só avisar
        do problema.

        O aviso sozinho era a queixa do dono: *"qual o sentido de agendar uma
        mensagem para daqui uma semana, se eu preciso de um modelo para
        conseguir enviar?"*. Ele estava certo, e a resposta não era tirar o
        agendar, era deixar escolher o modelo aqui.

        Escolher continua sendo opcional, e sem escolher o comportamento é o de
        antes: o aviso vale, e a mensagem falha com motivo se a janela não
        reabrir. É de propósito, porque a janela reabre a cada mensagem do
        cliente e modelo custa dinheiro por envio: mandar pelo modelo quem só
        precisava esperar o cliente responder seria gastar sem necessidade.
      */}
      {avisar && (
        <div className="mb-2 rounded-[8px] border border-amber-400/30 bg-amber-400/[0.09] px-2 py-1.5">
          <p className="text-[10.5px] leading-4 text-aviso">
            <strong>Isso cai fora da janela de 24h.</strong> Sem modelo, se {nome} não
            escrever de novo antes da hora marcada, o WhatsApp recusa.
          </p>

          {aprovados === null ? (
            <p className="mt-1.5 text-[10px] text-dim">Vendo os modelos aprovados…</p>
          ) : aprovados.length === 0 ? (
            <p className="mt-1.5 text-[10px] leading-4 text-dim">
              Esta conta ainda não tem modelo aprovado. Crie um em Transmissões para poder
              agendar fora da janela.
            </p>
          ) : (
            <label className="mt-1.5 block">
              <span className="mb-1 block text-[10px] text-muted">
                Mandar por um modelo, se a janela estiver fechada na hora:
              </span>
              <select
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="app-field w-full px-2 py-1 text-[11.5px]"
              >
                <option value="">Sem modelo, e aceito o risco de falhar</option>
                {aprovados.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {erro && (
        <p role="alert" className="mb-2 text-[10.5px] leading-4 text-perigo">
          {erro}
        </p>
      )}

      <button
        type="button"
        disabled={Boolean(recusa) || enviando}
        onClick={marcar}
        className="app-primary-button w-full py-2 text-[12px]"
      >
        {enviando ? 'Agendando…' : 'Agendar mensagem'}
      </button>

      {/*
        A promessa honesta de quando ela sai.
        -----------------------------------------------------------------------
        A Vercel no plano Hobby dispara tarefa agendada uma vez por dia. O que dá
        resolução de minuto é a carona no webhook e no pulso do Inbox, ver
        `server/enviar-agendadas.ts`. Escrever "sai às 9h em ponto" seria uma
        precisão que a plataforma não entrega, e a diferença aparece exatamente
        no caso que mais importa: ninguém na tela, nenhuma mensagem chegando.
      */}
      <p className="mt-1.5 text-[10px] leading-4 text-dim">
        Sai no horário marcado enquanto alguém estiver com o Inbox aberto ou chegar mensagem na
        conta. Com tudo parado, sai na primeira das duas coisas.
      </p>

      {agendadas.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase">
            Nesta conversa
          </p>
          <ul className="flex flex-col gap-1.5">
            {agendadas.map((a) => (
              <LinhaAgendada key={a.id} clienteId={clienteId} agendada={a} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Uma marcada, com o gesto de desfazer ao lado.
 *
 * O texto é cortado em duas linhas e não em uma: uma linha só transformaria
 * toda mensagem em "opa, tudo bem? Passando aqui…", e a pergunta de quem abre
 * esta lista é "qual delas é esta?", que uma linha não responde.
 */
function LinhaAgendada({
  clienteId,
  agendada,
}: {
  clienteId: string
  agendada: MensagemAgendada
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [indo, comecar] = useTransition()

  const falhou = agendada.estado === 'falhou'

  return (
    <li className="rounded-[8px] border border-line bg-surface px-2 py-1.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-soft tabular-nums">
            {quandoLegivel(agendada.quando)}
            {agendada.criadaPorNome && (
              <span className="font-normal text-dim"> · {agendada.criadaPorNome}</span>
            )}
          </p>
          <p className="line-clamp-2 text-[11px] leading-4 text-muted">{agendada.texto}</p>
        </div>

        {/*
          Cancelar some quando a linha já falhou: não há o que cancelar numa
          mensagem que não vai sair. O que sobra ali é o motivo, que é a única
          coisa útil naquele momento.
        */}
        {!falhou && (
          <button
            type="button"
            disabled={indo}
            onClick={() =>
              comecar(async () => {
                const r = await acaoCancelarAgendada(clienteId, agendada.id)
                if (!r.ok) setErro(r.erro ?? 'não deu para cancelar')
              })
            }
            aria-label="Cancelar esta mensagem agendada"
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] leading-none text-dim transition hover:bg-surface-strong hover:text-perigo disabled:opacity-40"
          >
            ×
          </button>
        )}
      </div>

      {falhou && agendada.erro && (
        <p className="mt-1 text-[10px] leading-4 text-perigo">não saiu: {agendada.erro}</p>
      )}
      {erro && (
        <p role="alert" className="mt-1 text-[10px] leading-4 text-perigo">
          {erro}
        </p>
      )}
    </li>
  )
}

/** "16/set às 09:00", dia e hora, sem ano, que é o que cabe e o que se pergunta. */
function quandoLegivel(iso: string): string {
  const data = new Date(iso)
  const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia.replace('.', '')} às ${hora}`
}

/** Relógio com um `+`: marcar algo para uma hora que ainda não chegou. */
export function IconeAgendar() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* O círculo é aberto embaixo à direita para o `+` não encostar nele ,
          dois traços colados em 15px viram uma mancha. */}
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M12 7.5V12l2.5 1.5" />
      <path d="M17.5 4v5M15 6.5h5" />
    </svg>
  )
}
