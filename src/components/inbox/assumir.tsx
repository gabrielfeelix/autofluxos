'use client'

import { useState, type ReactNode } from 'react'
import { useConversaAberta } from '@/components/inbox/conversa-local'
import { Dropdown } from '@/components/design/dropdown'

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
        className="rounded-[8px] border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
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

  const passar = (formData: FormData) => {
    const para = String(formData.get('usuarioId') ?? '')
    setErro(null)
    if (para === '') {
      setErro('escolha para quem passar')
      return
    }
    void conversa.agir({ atribuidoA: para }, () => atribuir(formData)).then(setErro)
  }

  return (
    <form action={passar} className="flex shrink-0 items-center gap-1.5">
      <Dropdown
        nome="usuarioId"
        rotuloAcessivel="Passar a conversa para"
        className="w-[150px]"
        opcoes={equipe.map((membro) => ({
          valor: membro.id,
          rotulo: membro.nome,
          detalhe: membro.presenca === 'disponivel' ? undefined : 'ausente',
        }))}
      />
      <button
        type="submit"
        className="rounded-[8px] border border-line px-2.5 py-1.5 text-[11.5px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
      >
        Passar
      </button>
      {erro && (
        <span role="alert" className="max-w-[160px] text-[11.5px] leading-4 text-perigo">
          {erro}
        </span>
      )}
    </form>
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
