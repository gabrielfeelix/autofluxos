'use client'

import { useState } from 'react'
import {
  IconeAutomacao,
  IconeCanal,
  IconeConversa,
  IconeFunil,
} from '@/components/cliente/icones'
import { Modal } from '@/components/design/modal'

/**
 * Como o AutoFluxos funciona, desenhado.
 *
 * Existe porque a primeira dúvida de quem entra não é "onde clico", é **o que
 * essa ferramenta faz com a minha conversa**. Um parágrafo explicando canal,
 * automação, conversa e funil é lido por ninguém; a corrente desenhada é
 * entendida de relance, e é a mesma coisa que RD Station e Intercom põem na
 * tela de boas-vindas.
 *
 * **Caixas em HTML e não um SVG.** O desenho é texto dentro de retângulo: em
 * SVG isso não quebra linha, não responde ao tema sem duplicar cor, e não se
 * ajusta a 390px de largura. A ilustração aqui é a composição, não o traço.
 *
 * O modal repete a mesma corrente com o texto inteiro. Quem entendeu de relance
 * não abre; quem não entendeu clica, e a resposta está na mesma tela em vez de
 * num artigo de ajuda em outra aba.
 */

type Peca = {
  chave: string
  titulo: string
  curto: string
  longo: string
  icone: React.ReactNode
}

const PECAS: Peca[] = [
  {
    chave: 'canal',
    titulo: 'Canal',
    curto: 'WhatsApp, Instagram ou anúncio',
    longo:
      'Por onde as pessoas falam com o negócio. Um número de WhatsApp, o direct do Instagram ou um anúncio que gera contato, tudo chega no mesmo lugar, e a origem fica registrada.',
    icone: <IconeCanal />,
  },
  {
    chave: 'automacao',
    titulo: 'Automação',
    curto: 'o que o bot responde sozinho',
    longo:
      'O roteiro que atende antes de você. Ela pergunta, responde dúvida repetida, agenda e só chama uma pessoa quando precisa, e é você quem desenha, sem escrever código.',
    icone: <IconeAutomacao />,
  },
  {
    chave: 'conversa',
    titulo: 'Conversa',
    curto: 'onde a sua equipe assume',
    longo:
      'O Inbox. Quando o bot passa a bola, a conversa aparece aqui com o histórico inteiro, o áudio transcrito e o que já foi respondido, ninguém começa do zero perguntando "pode repetir?".',
    icone: <IconeConversa />,
  },
  {
    chave: 'funil',
    titulo: 'Funil',
    curto: 'em que ponto cada pessoa está',
    longo:
      'O quadro de negociações. Cada contato vira um cartão que anda pelas etapas, com valor e motivo de perda, é daqui que saem "quanto fechou" e "quem está parado há uma semana".',
    icone: <IconeFunil />,
  },
]

export function ComoFunciona() {
  const [aberto, setAberto] = useState(false)

  return (
    <section className="app-card px-5 py-5" aria-labelledby="titulo-como-funciona">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-como-funciona" className="text-[15px] font-bold tracking-[-0.01em]">
          Como funciona o AutoFluxos
        </h2>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="text-[12px] font-semibold text-primary transition hover:opacity-80 active:opacity-60"
        >
          Ver explicado
        </button>
      </header>

      <p className="mt-1 text-[12.5px] text-dim">
        A mensagem entra por um canal, a automação atende, a conversa fica com a sua equipe e o
        contato anda no funil.
      </p>

      <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {PECAS.map((peca, indice) => (
          <li key={peca.chave} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1 rounded-[11px] border border-line bg-surface px-3.5 py-3 transition hover:border-strong">
              <span aria-hidden className="block text-primary">
                {peca.icone}
              </span>
              <p className="mt-2 text-[13px] font-bold">{peca.titulo}</p>
              <p className="mt-0.5 text-[11.5px] leading-[1.45] text-dim">{peca.curto}</p>
            </div>

            {indice < PECAS.length - 1 && (
              <span aria-hidden className="shrink-0 text-[13px] text-dim sm:-mx-0.5">
                <span className="hidden sm:inline">›</span>
                <span className="sm:hidden">⌄</span>
              </span>
            )}
          </li>
        ))}
      </ol>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Como funciona o AutoFluxos"
        descricao="As quatro peças, e o que cada uma resolve."
        largura={560}
      >
        <ol className="flex flex-col gap-3">
          {PECAS.map((peca, indice) => (
            <li key={peca.chave} className="flex gap-3.5">
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-weak text-primary-strong"
              >
                {peca.icone}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold">
                  {indice + 1}. {peca.titulo}
                </p>
                <p className="mt-1 text-[12.5px] leading-[1.6] text-muted">{peca.longo}</p>
              </div>
            </li>
          ))}
        </ol>
      </Modal>
    </section>
  )
}
