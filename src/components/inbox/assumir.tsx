'use client'

import { useState, type ReactNode } from 'react'
import { useConversaAberta } from '@/components/inbox/conversa-local'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { Dica } from '@/components/design/dica'
import { Modal } from '@/components/design/modal'
import { Avatar } from '@/components/inbox/avatar'

/**
 * O botão que faz alguém **virar** atendente.
 *
 * Até aqui a conversa ia para `humano` e ficava esperando "uma pessoa", que,
 * com mais de uma no time, é o mesmo que esperar ninguém. Assumir põe um nome
 * ali, e o nome é o que faz alguém voltar depois.
 *
 * **Não avisa a pessoa do outro lado**, e isso é decisão: assumir é organização
 * interna, e anunciar no WhatsApp que "a Ana assumiu" expõe a nossa mesa para
 * quem só quer ser respondido.
 *
 * **O bot cala junto.** Até aqui assumir marcava o responsável e mais nada: o
 * robô continuava conduzindo, e se a pessoa respondesse rápido ele falava por
 * cima de quem tinha acabado de pegar a conversa. Só responder calava, ou seja,
 * era preciso digitar alguma coisa para o bot parar.
 *
 * **E o silêncio dele aparece na tela**, no selo do atendimento, não só na dica
 * do botão.
 */
export function Assumir({
  assumir,
  liberar,
  responsavel,
  souEu,
}: {
  assumir: () => Promise<{ ok: boolean; erro?: string }>
  liberar: () => Promise<{ ok: boolean; erro?: string }>
  /** Nome de quem já assumiu. `null` = ninguém. */
  responsavel: string | null
  souEu: boolean
}) {
  /*
   * **Quem assume vê o próprio nome na hora.**
   *
   * Era um `useActionState` num `<form>`: o rótulo virava "…" e só mudava
   * depois do servidor. Assumir é o gesto de abrir uma conversa, esperar por
   * ele é esperar para começar a trabalhar.
   *
   * A aposta é o próprio `souEu`: clicar em "Assumir" já mostra "você está
   * atendendo", e o servidor só é notado quando discorda.
   */
  /*
   * No store da conversa (25/set): assumir muda o botão, o selo embaixo do
   * nome, o cartão do atendimento e a trava da caixa de resposta no mesmo
   * clique. `souEu` e `responsavel` são o que o servidor desenhou; o que vale
   * na tela é o que o store diz agora.
   */
  const conversa = useConversaAberta()
  const [erro, setErro] = useState<string | null>(null)
  const dono = conversa.valor.atribuidoA
  const meu = conversa.usuarioId !== null ? dono === conversa.usuarioId : souEu
  const temOutroDono = dono !== null ? !meu : Boolean(responsavel) && !souEu

  const alternar = () => {
    setErro(null)
    void conversa
      .agir(
        meu
          ? { atribuidoA: null }
          : // Assumir cala o bot na conversa (`calarBotNaConversa`).
            { atribuidoA: conversa.usuarioId, sessaoComPessoa: true },
        () => (meu ? liberar() : assumir()),
      )
      .then(setErro)
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {/*
        O "robô pausado · você atende" que morava aqui saiu (8.1): ele aparecia
        só por haver responsável, e responsável não cala o bot. O estado real
        agora é o selo embaixo do nome, calculado por `estadoDoAtendimento`.
      */}
      {/*
        Quem já assumiu vê "Devolver à fila"; quem não assumiu vê "Assumir",
        inclusive quando outra pessoa já está com a conversa. Bloquear a tomada
        seria pior: gente sai de férias no meio de um atendimento, e o caminho
        de destravar não pode ser pedir para alguém voltar do almoço.

        **O rótulo era "Liberar", e era ambíguo do jeito caro.** Liberar o quê:
        a conversa, a pessoa, o robô? Quem está tentando fazer o bot voltar a
        responder lê "Liberar" como "libera o robô", clica, e o robô continua
        calado, porque o que solta o robô é "Finalizar atendimento". "Devolver à fila" diz
        para onde a conversa vai, que é a única coisa que o botão faz.
      */}
      <button
        type="button"
        onClick={alternar}
        title={
          meu
            ? 'Devolve a conversa para a fila. O bot continua calado até alguém finalizar o atendimento.'
            : 'A conversa passa a ser sua e o bot para de responder. Ele só volta quando alguém finalizar o atendimento.'
        }
        className="botao-secundario botao-sm"
      >
        {meu ? 'Devolver à fila' : temOutroDono ? 'Assumir mesmo assim' : 'Assumir'}
      </button>

      {erro && (
        <span role="alert" className="max-w-[180px] text-[11.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
    </div>
  )
}

/**
 * Passar a conversa para outra pessoa.
 *
 * Separado do "assumir" porque os dois casos não têm o mesmo peso: assumir é o
 * de todo dia e tem que ser um clique; passar é raro e exige escolher quem.
 * Fundir os dois numa lista só faria o caso comum custar dois cliques.
 *
 * Quem está ausente aparece marcado, e não escondido: às vezes é exatamente
 * para essa pessoa que a conversa precisa ir, e sumir com o nome obrigaria a
 * perguntar no grupo do time por que ela não aparece.
 *
 * **Ícone que abre uma janela, e não um seletor no cabeçalho** (05/out/2026).
 * O dropdown "Transferir para…" ocupava 170px do cabeçalho para um gesto raro
 * e lia como campo de formulário. O avião de papel diz "mandar para alguém",
 * e a janela mostra a equipe com espaço para nome, presença e quem já está
 * com a conversa. Escolher um nome já transfere: confirmar seria um clique a
 * mais para um gesto que a escolha já deixa claro.
 */
export function PassarPara({
  atribuir,
  equipe,
}: {
  atribuir: (formData: FormData) => Promise<{ ok: boolean; erro?: string }>
  equipe: { id: string; nome: string; presenca: string }[]
}) {
  /*
   * Passar era um `<form action>` com "…" no botão até o servidor redesenhar a
   * página. Agora o responsável muda no clique, no selo e no cartão, e volta
   * se o servidor recusar.
   */
  const conversa = useConversaAberta()
  const [erro, setErro] = useState<string | null>(null)
  /*
   * A confirmação do gesto. O seletor sempre volta a ler "Transferir para…" e
   * o selo do cabeçalho corta o nome quando falta largura: sem este aviso, a
   * transferência acontecia e a tela parecia não ter mudado nada (02/out/2026).
   */
  const [passadoPara, setPassadoPara] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)

  const transferir = (para: string) => {
    setAberto(false)
    setErro(null)
    const nome = equipe.find((membro) => membro.id === para)?.nome ?? null
    setPassadoPara(para === conversa.usuarioId ? 'você' : nome)
    const formData = new FormData()
    formData.set('usuarioId', para)
    void conversa.agir({ atribuidoA: para }, () => atribuir(formData)).then((falha) => {
      setErro(falha)
      if (falha) setPassadoPara(null)
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Dica texto="Transferir conversa">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Transferir conversa"
          className="botao-secundario botao-sm botao-icone"
        >
          {/* Avião de papel: mandar para alguém. */}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-[16px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 3 10.5 13.5" />
            <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3Z" />
          </svg>
        </button>
      </Dica>
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Transferir conversa"
        descricao="A conversa passa para a pessoa escolhida, que vira a responsável. O cliente não é avisado."
      >
        <ul className="-mx-1 flex max-h-[360px] flex-col overflow-y-auto">
          {equipe.map((membro) => {
            const atual = membro.id === conversa.valor.atribuidoA
            const ausente = membro.presenca !== 'disponivel'
            return (
              <li key={membro.id}>
                <button
                  type="button"
                  disabled={atual}
                  onClick={() => transferir(membro.id)}
                  className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <Avatar nome={membro.nome} tamanho={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {membro.nome}
                      {membro.id === conversa.usuarioId && (
                        <span className="font-normal text-dim"> (você)</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-dim">
                      <span
                        aria-hidden
                        className={`size-1.5 rounded-full ${ausente ? 'bg-dim' : 'bg-emerald-400'}`}
                      />
                      {ausente ? 'Ausente' : 'Disponível'}
                    </span>
                  </span>
                  {atual && (
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-muted">
                      Responsável
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>
      {erro && (
        <span role="alert" className="max-w-[160px] text-[11.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
      <span role="status" className="sr-only">{passadoPara ? `Conversa passada para ${passadoPara}` : ''}</span>
      {passadoPara && (
        <AvisoFlutuante duracao={3500} aoSumir={() => setPassadoPara(null)}>
          Conversa passada para <strong className="font-semibold">{passadoPara}</strong>.
        </AvisoFlutuante>
      )}
    </div>
  )
}

/**
 * A trava de "só quem assumiu responde", do lado do cliente.
 *
 * Era decidida no servidor, e por isso só abria depois do `revalidatePath` de
 * assumir. Agora lê o dono do store da conversa: assumir destrava a caixa no
 * mesmo clique. A recusa de verdade continua no servidor (`podeResponderAgora`).
 */
export function TravaDaResposta({
  exigeAssumir,
  children,
}: {
  exigeAssumir: boolean
  children: ReactNode
}) {
  const conversa = useConversaAberta()
  const dono = conversa.valor.atribuidoA
  const travada =
    exigeAssumir && conversa.usuarioId !== null && dono !== null && dono !== conversa.usuarioId
  if (!travada) return children

  const nomeDoDono =
    conversa.equipe.find((membro) => membro.id === dono)?.nome.split(' ')[0] ?? null

  /*
    O lugar da caixa de resposta, e não um aviso acima dela.

    A caixa desabilitada com um recado em cima seria um campo cinza que a
    pessoa tenta clicar assim mesmo. Aqui o espaço diz o que é preciso fazer,
    e o botão que faz isso está no cabeçalho desta mesma coluna.
  */
  return (
    <div className="shrink-0 border-t border-line bg-panel px-4 py-5 text-center">
      <p className="text-[13px] font-semibold text-soft">
        {nomeDoDono ? `${nomeDoDono} está atendendo` : 'esta conversa já tem dono'}
      </p>
      <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] leading-5 text-dim">
        Esta conta pediu que só quem assumiu responda, para duas pessoas não escreverem ao
        mesmo tempo. Use o botão de assumir, no topo da conversa, se precisar entrar nela.
      </p>
    </div>
  )
}
