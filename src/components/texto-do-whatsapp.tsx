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

/**
 * O que vira link dentro do texto.
 *
 * `https://…`, `http://…` e o `www.` sem esquema — que é como a maioria das
 * pessoas cola endereço no WhatsApp.
 *
 * **A pontuação final fica de fora.** Sem o `[^\s]*[^\s.,;:!?)\]}"']` do fim,
 * "veja em exemplo.com." levaria o ponto para dentro do endereço e o link
 * abriria uma página que não existe. É o erro mais comum de quem escreve esse
 * padrão à mão, e ele só aparece quando alguém termina a frase com ponto —
 * ou seja, sempre.
 */
const ENDERECO = /\b(?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)\]}"']/gi

/**
 * O texto cru com os endereços virando âncora.
 *
 * `text-primary` e não uma cor escrita à mão: dentro da bolha que sai,
 * `.bolha-nossa` redefine `--primary` para branco — é a armadilha que já
 * derrubou a tela uma vez, e aqui ela joga a favor. O link fica azul no que
 * chega e branco no que sai, que é exatamente o que o WhatsApp faz.
 */
function comLinks(texto: string, chave: number): ReactNode {
  const pedacos: ReactNode[] = []
  let ultimo = 0

  // `matchAll` em vez de `exec` num laço: a expressão é global, e `lastIndex`
  // guardado entre chamadas é a fonte clássica de "só funciona uma vez".
  for (const achado of texto.matchAll(ENDERECO)) {
    const inicio = achado.index
    const bruto = achado[0]
    if (inicio > ultimo) pedacos.push(texto.slice(ultimo, inicio))

    pedacos.push(
      <a
        key={`${chave}-${inicio}`}
        href={bruto.startsWith('www.') ? `https://${bruto}` : bruto}
        target="_blank"
        /*
          `noreferrer` junto do `noopener`: a conversa é de trabalho e o
          endereço foi colado por um desconhecido. `noopener` impede a página
          aberta de mexer nesta aba; `noreferrer` impede que ela saiba de onde
          veio o clique, que é o endereço do painel de um cliente nosso.
        */
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {bruto}
      </a>,
    )
    ultimo = inicio + bruto.length
  }

  if (ultimo === 0) return texto
  if (ultimo < texto.length) pedacos.push(texto.slice(ultimo))
  return pedacos
}

function desenhar(trechos: Trecho[]): ReactNode {
  return trechos.map((trecho, i) => {
    if (trecho.tipo === 'texto') return <Fragment key={i}>{comLinks(trecho.texto, i)}</Fragment>

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
          <code key={i} className="rounded bg-ink/[0.09] px-1 font-mono text-[0.92em]">
            {filhos}
          </code>
        )
    }
  })
}
