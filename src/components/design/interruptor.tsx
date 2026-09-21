'use client'

import type { ReactNode } from 'react'

/**
 * O liga-desliga do produto.
 *
 * **Não substitui a `Caixa`, divide o trabalho com ela.** Caixa de seleção é
 * para escolher vários de uma lista: "quais consultas a IA pode fazer". O
 * interruptor é para uma coisa que está ligada ou desligada e que **muda a tela
 * na hora**: puxar o horário da agenda, aceitar arquivo como resposta, contar
 * em vez de listar. A diferença importa para quem nunca usou o produto: uma
 * caixa pede confirmação depois, um interruptor já é o depois.
 *
 * Continua sendo um `<input type="checkbox">` de verdade, pelas mesmas quatro
 * razões da `Caixa`: leitor de tela anuncia, `Espaço` alterna, o `<label>` que
 * o envolve continua clicando nele e um `<form>` continua enviando o valor.
 * `role="switch"` é o que troca o anúncio de "caixa de seleção, marcada" para
 * "interruptor, ligado", que é o que a tela realmente mostra.
 */
export function Interruptor({
  marcada,
  aoMudar,
  desabilitada = false,
  rotuloAcessivel,
  nome,
}: {
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  desabilitada?: boolean
  /** Só quando o interruptor não vem dentro de um `<label>` que já o nomeia. */
  rotuloAcessivel?: string
  /** Nome no formulário, quando ele for enviado por um. */
  nome?: string
}) {
  return (
    <span className="relative inline-flex h-[20px] w-[34px] shrink-0">
      <input
        type="checkbox"
        role="switch"
        name={nome}
        aria-label={rotuloAcessivel}
        checked={marcada}
        disabled={desabilitada}
        onChange={(evento) => aoMudar(evento.currentTarget.checked)}
        className="peer size-full cursor-pointer appearance-none rounded-full border border-strong bg-surface transition outline-none checked:border-primary checked:bg-primary hover:border-primary/60 focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
      />
      {/* A bolinha é desenhada por cima e não recebe clique: quem recebe é o
          input inteiro, que ocupa a mesma área. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-[3px] size-[14px] -translate-y-1/2 rounded-full bg-panel shadow-[0_1px_2px_rgba(19,25,34,0.25)] transition-transform peer-checked:translate-x-[14px] peer-checked:bg-white"
      />
    </span>
  )
}

/**
 * Uma linha inteira de liga-desliga: o nome, a explicação e o interruptor.
 *
 * **Existe porque o layout à mão quebrava.** O padrão anterior era um `<label>`
 * `flex` com a caixa e o texto solto ao lado, e texto solto dentro de um
 * contêiner `flex` vira item anônimo: um `<code>` no meio da frase virava um
 * terceiro item, com espaçamento de irmão, e a linha saía como
 * `contar quantos, guarda o número de itens (` · `3` · `), e não a lista` ,
 * três pedaços desalinhados de uma frase só. Aqui o texto é um bloco, e o
 * interruptor é o único vizinho dele.
 *
 * O nome vem primeiro e sozinho, no peso do resto dos rótulos do painel; a
 * explicação vem embaixo, menor. Quem já sabe lê só a primeira linha.
 */
export function LinhaLigaDesliga({
  titulo,
  descricao,
  marcada,
  aoMudar,
  desabilitada = false,
  ajuda,
}: {
  titulo: string
  /** Uma frase curta sobre o que muda ao ligar. O longo vai no `?`. */
  descricao?: ReactNode
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  desabilitada?: boolean
  /** O `?` com a explicação inteira, quando ela não cabe em `descricao`. */
  ajuda?: ReactNode
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-[10px] border border-line px-3 py-2.5 transition ${
        desabilitada ? 'opacity-55' : 'cursor-pointer hover:border-strong'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center text-[12.5px] leading-5 font-semibold text-ink">
          {titulo}
          {ajuda}
        </span>
        {descricao && (
          <span className="mt-0.5 block text-[11px] leading-4 text-dim">{descricao}</span>
        )}
      </span>
      <Interruptor marcada={marcada} aoMudar={aoMudar} desabilitada={desabilitada} />
    </label>
  )
}
