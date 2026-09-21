import { Fragment, type ReactNode } from 'react'
import { partirPorEndereco } from '@/core/enderecos'
import { interpretarMarcacao, type Trecho } from '@/core/flow/marcacao'

/**
 * O texto de uma mensagem, desenhado como o WhatsApp desenha.
 *
 * Existe porque a aba Testar mostrava `*Pilates!*` com os asteriscos à mostra,
 * e quem estava usando concluiu que o negrito não funcionava. Funcionava, no
 * celular de quem recebe. O teste é onde se decide se a mensagem está boa, e um
 * teste que mostra outra coisa não responde a única pergunta que ele existe
 * para responder.
 *
 * A gramática mora em `core/flow/marcacao.ts` e os endereços em
 * `core/enderecos.ts`; aqui só se escolhe a tag.
 * `whitespace-pre-wrap` fica com quem chama, porque a quebra de linha é do
 * balão e não do trecho.
 *
 * ---------------------------------------------------------------------------
 * A ordem das duas coisas é o conserto de um defeito
 * ---------------------------------------------------------------------------
 *
 * **O endereço é separado ANTES da marcação.** Quando era o contrário, um link
 * de campanha aparecia metade azul e metade em itálico preto: `_` é itálico na
 * marcação do WhatsApp, e `?gadsource=1&gadcampaignid=…&gclid=…_BwE` tem
 * sublinhado de sobra. A marcação via um par onde havia uma URL, partia-a em
 * três, e o que virava link era só o primeiro pedaço.
 *
 * O preço está escrito em `core/enderecos.ts`: negrito que abre antes de um
 * link e fecha depois dele deixa de valer. Isso é raro; link com `_` é o dia a
 * dia de quem manda campanha.
 */
export function TextoDoWhatsApp({ texto }: { texto: string }) {
  return (
    <>
      {partirPorEndereco(texto).map((pedaco, i) =>
        pedaco.tipo === 'endereco' ? (
          <a
            key={i}
            href={pedaco.href}
            target="_blank"
            /*
              `noreferrer` junto do `noopener`: a conversa é de trabalho e o
              endereço foi colado por um desconhecido. `noopener` impede a
              página aberta de mexer nesta aba; `noreferrer` impede que ela
              saiba de onde veio o clique, que é o endereço do painel de um
              cliente nosso.
            */
            rel="noopener noreferrer"
            /*
              `text-primary` e não uma cor escrita à mão: dentro da bolha que
              sai, `.bolha-nossa` redefine `--primary` para branco, a mesma
              armadilha que já apagou a conversa inteira uma vez, e que aqui
              joga a favor. Azul no que chega, branco no que sai, como o
              WhatsApp.
            */
            className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            {pedaco.valor}
          </a>
        ) : (
          <Fragment key={i}>{desenhar(interpretarMarcacao(pedaco.valor))}</Fragment>
        ),
      )}
    </>
  )
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
          <code key={i} className="rounded bg-ink/[0.09] px-1 font-mono text-[0.92em]">
            {filhos}
          </code>
        )
    }
  })
}
