'use client'

import { useRef, useState, type InputHTMLAttributes } from 'react'
import { formatarDinheiroDigitado, posicaoDepois, significativosAntes } from '@/core/dinheiro-digitado'

/**
 * O campo de todo valor em reais: "R$" fixo à esquerda e o número formatado
 * enquanto se digita ("1500" vira "1.500"; a vírgula abre os centavos).
 *
 * Antes cada tela tinha um campo solto com "1500" dentro, sem dizer que era
 * dinheiro nem separar o milhar, e "15000" e "1500" pareciam o mesmo número.
 *
 * Serve aos dois jeitos de formulário do sistema: controlado (`valor` e
 * `aoMudar`) e solto, por `name` e `defaultValue`, que o `FormData` lê. O
 * texto enviado é o formatado, que o `lerValor` do servidor já entende.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type'> & {
  valor?: string
  valorInicial?: string
  aoMudar?: (texto: string) => void
}

export function CampoDeDinheiro({ valor, valorInicial, aoMudar, className = '', style, ...resto }: Props) {
  const [interno, setInterno] = useState(() => formatarDinheiroDigitado(valorInicial ?? ''))
  const campo = useRef<HTMLInputElement>(null)
  const texto = valor === undefined ? interno : formatarDinheiroDigitado(valor)

  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      <span aria-hidden className="pointer-events-none absolute left-3 text-[0.92em] font-semibold text-dim">
        R$
      </span>
      <input
        {...resto}
        ref={campo}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={texto}
        onChange={(evento) => {
          const alvo = evento.currentTarget
          const antes = significativosAntes(alvo.value, alvo.selectionStart ?? alvo.value.length)
          const novo = formatarDinheiroDigitado(alvo.value)
          if (valor === undefined) setInterno(novo)
          aoMudar?.(novo)
          // O ponto de milhar entra e sai do meio do texto: o cursor volta para
          // depois do mesmo dígito, e não pula para o fim a cada tecla.
          requestAnimationFrame(() => {
            const pos = posicaoDepois(novo, antes)
            campo.current?.setSelectionRange(pos, pos)
          })
        }}
        className={`w-full tabular-nums ${className}`}
        style={{ ...style, paddingLeft: '2.4em' }}
      />
    </span>
  )
}
