'use client'

import { telefoneLegivel } from '@/core/contatos/telefone'

/**
 * O nome do contato, e a correção dele.
 *
 * O WhatsApp entrega o nome que a pessoa escolheu para si, e numa lista de
 * atendimento isso vira "Rodrigão comedor delas" onde deveria estar "Rodrigo".
 * A correção mora no Editar da ficha (`NomeEditavel`), e **não substitui** o nome do perfil: ele
 * continua visível abaixo, porque é o que identifica a conta do WhatsApp e o
 * que quem atende reconhece na notificação do celular.
 */
export function NomeDoContato({
  nome,
  nomeDoPerfil,
  nomeReal,
  waId,
}: {
  nome: string | null
  nomeDoPerfil: string | null
  nomeReal: string
  waId: string
}) {
  return (
    <div className="min-w-0">
      <h1 className="flex flex-wrap items-center gap-2 text-[21px] font-bold tracking-[-0.02em]">
        <span className="min-w-0 break-words">{nome ?? telefoneLegivel(waId)}</span>
      </h1>
      <p className="mt-0.5 font-mono text-[12px] text-dim">
        {telefoneLegivel(waId)}
        {/*
          Só aparece quando os dois divergem. Repetir o mesmo nome duas vezes
          seria ruído; mostrar o do perfil quando ele foi corrigido é o que
          explica por que a notificação do celular diz outra coisa.
        */}
        {nomeReal !== '' && nomeDoPerfil && nomeDoPerfil.trim() !== nomeReal && (
          <span className="ml-2 font-sans text-[12px] text-muted">
            no WhatsApp: “{nomeDoPerfil}”
          </span>
        )}
      </p>
    </div>
  )
}
