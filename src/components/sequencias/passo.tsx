'use client'

import { useCallback, useState } from 'react'
import { Dropdown, type OpcaoDropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { acaoEditarPassoDaSequencia } from '@/server/acoes'

export type ModeloNaLista = { id: string; nome: string; idioma: string }

type Inicial = { atrasoMinutos: number; fluxoId: string; templateId?: string | null }

/**
 * Os campos de um passo, os mesmos na criação e na edição.
 *
 * Na edição chegam preenchidos com o passo como está; na criação, com 2 h e o
 * primeiro fluxo da lista.
 */
export function CamposDoPasso({
  fluxos,
  modelos,
  inicial,
}: {
  fluxos: OpcaoDropdown[]
  modelos: ModeloNaLista[]
  inicial?: Inicial
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <RotuloCampo>Horas</RotuloCampo>
          <input
            name="horas"
            type="number"
            min={0}
            /* 30 dias em horas. O teto de 24 caiu com a 0061. */
            max={720}
            defaultValue={inicial ? Math.floor(inicial.atrasoMinutos / 60) : 2}
            autoFocus
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
        </label>
        <label>
          <RotuloCampo>Minutos</RotuloCampo>
          <input
            name="minutos"
            type="number"
            min={0}
            max={59}
            defaultValue={inicial ? inicial.atrasoMinutos % 60 : 0}
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
        </label>
      </div>
      <label>
        <RotuloCampo>Fluxo que este passo abre</RotuloCampo>
        <Dropdown
          nome="fluxoId"
          rotuloAcessivel="Fluxo que este passo abre"
          opcoes={fluxos}
          valorInicial={inicial?.fluxoId}
        />
      </label>
      {/*
        O modelo aprovado, para o passo que passa de 24h.

        Opcional, e o rótulo diz quando ele deixa de ser: dentro da janela o
        fluxo entrega sozinho, e exigir modelo ali seria cobrar aprovação da
        Meta para mandar a segunda mensagem de uma conversa que está
        acontecendo agora.

        Só modelos APROVADOS entram na lista. Oferecer um pendente faria a
        pessoa desenhar uma sequência que só entregaria se a Meta aprovasse a
        tempo.
      */}
      <label>
        <RotuloCampo>Modelo aprovado (só para passos acima de 24h)</RotuloCampo>
        {modelos.length === 0 ? (
          <p className="text-[11.5px] leading-5 text-muted">
            Nenhum modelo aprovado ainda, então o teto deste passo é 24h. Crie um em Transmissões e espere a
            revisão da Meta.
          </p>
        ) : (
          <Dropdown
            nome="templateId"
            rotuloAcessivel="Modelo aprovado deste passo"
            valorInicial={inicial?.templateId ?? ''}
            opcoes={[
              { valor: '', rotulo: 'Nenhum, o passo fica até 24h' },
              ...modelos.map((item) => ({ valor: item.id, rotulo: item.nome, detalhe: item.idioma })),
            ]}
          />
        )}
      </label>
    </>
  )
}

/**
 * "Editar" de um passo que já existe (A06).
 *
 * Ao salvar, diz quantas pessoas que esperavam este passo foram remarcadas:
 * mudar o horário mexe em envio já agendado, e isso não pode acontecer calado.
 */
export function EditarPasso({
  clienteId,
  passoId,
  titulo,
  descricao,
  fluxos,
  modelos,
  inicial,
}: {
  clienteId: string
  passoId: string
  titulo: string
  descricao: string
  fluxos: OpcaoDropdown[]
  modelos: ModeloNaLista[]
  inicial: Inicial
}) {
  const [recado, setRecado] = useState<string | null>(null)
  const sumir = useCallback(() => setRecado(null), [])

  return (
    <>
      <ModalFormulario
        botao="Editar"
        titulo={titulo}
        descricao={descricao}
        rotuloEnviar="Salvar passo"
        variante="linha"
        action={async (dados) => {
          const r = await acaoEditarPassoDaSequencia(clienteId, passoId, {}, dados)
          if (r.ok) {
            const n = r.remarcadas ?? 0
            setRecado(
              n === 0
                ? 'Passo salvo.'
                : n === 1
                  ? 'Passo salvo. 1 pessoa que estava esperando este passo foi remarcada.'
                  : `Passo salvo. ${n} pessoas que estavam esperando este passo foram remarcadas.`,
            )
          }
          return r
        }}
      >
        <CamposDoPasso fluxos={fluxos} modelos={modelos} inicial={inicial} />
      </ModalFormulario>
      <span role="status" className="sr-only">
        {recado ?? ''}
      </span>
      {recado && <AvisoFlutuante aoSumir={sumir}>{recado}</AvisoFlutuante>}
    </>
  )
}
