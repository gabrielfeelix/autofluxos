import { Fragment, type ReactNode } from 'react'
import { interpretarMarcacao, type Trecho } from '@/core/flow/marcacao'

/**
 * O texto de uma mensagem, desenhado como o WhatsApp desenha.
 *
 * Existe porque a aba Testar mostrava `*Pilates!*` com os asteriscos à mostra,
 * e quem estava usando concluiu que o negrito não funcionava. Funcionava — no
 * celular de quem recebe. O teste é onde se decide se a mensagem está boa, e um
 * teste que mostra outra coisa não responde a única pergunta que ele existe
 * para responder.
 *
 * A gramática mora em `core/flow/marcacao.ts`; aqui só se escolhe a tag.
 * `whitespace-pre-wrap` fica com quem chama, porque a quebra de linha é do
 * balão e não do trecho.
 */
export function TextoDoWhatsApp({ texto }: { texto: string }) {
  return <>{desenhar(interpretarMarcacao(texto))}</>
}

function desenhar(trechos: Trecho[]): ReactNode {
  return trechos.map((trecho, i) => {
    if (trecho.tipo === 'texto') return <Fragment key={i}>{trecho.texto}</Fragment>

    const filhos = desenhar(trecho.filhos)
    switch (trecho.marca) {
      case 'negrito':
        return <strong key={i}>{filhos}</strong>
      case 'italico':
        return <em key={i}>{filhos}</em>
      case 'riscado':
        return <s key={i}>{filhos}</s>
      case 'mono':
        return (
          <code key={i} className="rounded bg-black/[0.07] px-1 font-mono text-[0.92em]">
            {filhos}
          </code>
        )
    }
  })
}
