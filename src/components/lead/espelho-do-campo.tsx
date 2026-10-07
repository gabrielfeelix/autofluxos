'use client'

import { Fragment, useEffect, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { partirPorEndereco } from '@/core/enderecos'
import { interpretarMarcacao, type MarcaDeTexto, type Trecho } from '@/core/flow/marcacao'

/**
 * A formatação do campo de resposta, desenhada enquanto se digita.
 *
 * O campo continua `<textarea>` (ver `responder.tsx`): este espelho é uma
 * camada por cima dele, com o mesmo texto, a mesma fonte, o mesmo `padding` e
 * a mesma quebra. O textarea fica com o texto transparente e só o cursor à
 * vista; o que se lê é o espelho. `contentEditable` faria o mesmo trazendo de
 * volta colar, IME e celular como problema.
 *
 * **Regra de ouro: nada aqui muda a largura de um caractere.** Uma letra mais
 * larga no espelho do que no campo desalinha o cursor do texto dali em diante.
 * Por isso:
 *
 * - negrito é sintético, por `text-shadow`, nunca `font-weight`;
 * - itálico é só cor, porque inclinar muda a largura;
 * - riscado é `line-through`, que não ocupa espaço;
 * - monoespaçado fica sem estilo: trocar a fonte é justamente mudar largura.
 *
 * As marcas (`*`, `_`, `~`) continuam no espelho, esmaecidas: elas estão no
 * campo, e quem escreve precisa ver onde o negrito começa para apagá-lo.
 *
 * A gramática é a da bolha (`interpretarMarcacao`), e o endereço é separado
 * antes, pelo mesmo motivo de `texto-do-whatsapp.tsx`: o campo e a bolha nunca
 * podem discordar sobre o que é negrito.
 *
 * O texto não passa pelo `CaixaDeResposta`:
 * quem escreve chama `controleRef`, e só este componente renderiza a cada tecla.
 */
export function EspelhoDoCampo({
  ref,
  controleRef,
  className,
}: {
  ref: Ref<HTMLDivElement>
  controleRef: RefObject<((texto: string) => void) | null>
  className: string
}) {
  const [texto, setTexto] = useState('')
  useEffect(() => {
    controleRef.current = setTexto
    return () => {
      controleRef.current = null
    }
  }, [controleRef])

  return (
    <div ref={ref} aria-hidden className={className}>
      {partirPorEndereco(texto).map((pedaco, i) =>
        pedaco.tipo === 'endereco' ? (
          <span key={i} className="text-primary">
            {pedaco.valor}
          </span>
        ) : (
          <Fragment key={i}>{desenhar(interpretarMarcacao(pedaco.valor))}</Fragment>
        ),
      )}
      {/*
        Texto que termina em quebra de linha: o textarea já mostra a linha nova
        e a `div` não, até ter alguma coisa nela. O espaço de largura zero é
        essa coisa.
      */}
      {'​'}
    </div>
  )
}

const SIMBOLO: Record<MarcaDeTexto, string> = {
  negrito: '*',
  italico: '_',
  riscado: '~',
  mono: '```',
}

const NEGRITO = { textShadow: '0.35px 0 currentColor' }

function desenhar(trechos: Trecho[]): ReactNode {
  return trechos.map((trecho, i) => {
    if (trecho.tipo === 'texto') return <Fragment key={i}>{trecho.texto}</Fragment>

    const simbolo = <span className="opacity-40">{SIMBOLO[trecho.marca]}</span>
    const filhos = desenhar(trecho.filhos)
    return (
      <Fragment key={i}>
        {simbolo}
        {trecho.marca === 'negrito' ? (
          <span style={NEGRITO}>{filhos}</span>
        ) : trecho.marca === 'italico' ? (
          <span className="text-primary">{filhos}</span>
        ) : trecho.marca === 'riscado' ? (
          <span className="line-through">{filhos}</span>
        ) : (
          filhos
        )}
        {simbolo}
      </Fragment>
    )
  })
}
