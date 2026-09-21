'use client'

import { useState } from 'react'
import { mascaraDeTelefone, telefoneCompleto } from '@/core/contatos/telefone'

/**
 * O campo de telefone, com a máscara nascendo embaixo do dedo.
 *
 * Existe como componente porque **duas** telas pedem telefone, o cadastro e o
 * primeiro acesso, e um campo com máscara tem mais estado do que parece:
 * formatar a cada tecla, segurar o teto de dígitos, e decidir quando reclamar.
 * Duas cópias disso divergem no dia em que uma ganhar correção que a outra não.
 *
 * **A reclamação só aparece quando o campo perde o foco**, e nunca enquanto a
 * pessoa digita. Validar a cada tecla marcaria em vermelho todo telefone pela
 * metade, que é o estado normal de quem está escrevendo, o aviso apareceria
 * no primeiro dígito e ficaria lá até o último, ensinando a pessoa a ignorá-lo.
 *
 * A máscara é enfeite e o servidor não confia nela: `telefoneCanonico` e
 * `chavesDoTelefone` já tiram tudo que não é dígito antes de casar ou gravar.
 * Um telefone colado torto continua sendo aceito e entendido.
 */
export function CampoDeTelefone({
  nome = 'telefone',
  valorInicial = '',
  ajuda,
}: {
  nome?: string
  valorInicial?: string
  ajuda?: string
}) {
  const [valor, setValor] = useState(() => mascaraDeTelefone(valorInicial))
  const [tocado, setTocado] = useState(false)

  const incompleto = tocado && !telefoneCompleto(valor)

  return (
    <label>
      <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
        Telefone
      </span>
      <input
        type="tel"
        name={nome}
        inputMode="numeric"
        autoComplete="tel"
        placeholder="(44) 90000-0000"
        value={valor}
        onChange={(evento) => setValor(mascaraDeTelefone(evento.target.value))}
        onBlur={() => setTocado(true)}
        aria-invalid={incompleto}
        className="app-field px-[13px] py-[11px] text-[13.5px]"
      />
      {incompleto ? (
        <span role="alert" className="mt-1.5 block text-[11px] text-perigo">
          Faltam dígitos, são 10 com fixo e 11 com celular, contando o DDD. Ou deixe em branco.
        </span>
      ) : (
        ajuda && <span className="mt-1.5 block text-[11px] leading-[1.6] text-dim">{ajuda}</span>
      )}
    </label>
  )
}
