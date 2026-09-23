'use client'

import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { acaoRenomearPasta } from '@/server/acoes'

/** Renomear a gaveta (A15): só o nome muda, os fluxos continuam nela. */
export function RenomearPasta({ clienteId, pastaId, nome }: { clienteId: string; pastaId: string; nome: string }) {
  return (
    <ModalFormulario
      botao="Renomear"
      titulo="Renomear pasta"
      descricao="Só o nome muda. As automações continuam nela."
      rotuloEnviar="Salvar nome"
      variante="secundario"
      action={(dados) => acaoRenomearPasta(clienteId, pastaId, String(dados.get('nome') ?? ''))}
    >
      <label>
        <RotuloCampo>Nome da pasta</RotuloCampo>
        <input
          name="nome"
          required
          autoFocus
          maxLength={40}
          defaultValue={nome}
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>
    </ModalFormulario>
  )
}
