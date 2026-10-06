'use client'

import { useCallback, useState } from 'react'
import { Dropdown, type OpcaoDropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { acaoEditarPassoDaSequencia } from '@/server/acoes'
import { trechoDaLacuna } from '@/components/lead/lacunas-do-modelo'
import { LIMITE_DO_VALOR, variaveisDe } from '@/core/templates'

export type ModeloNaLista = { id: string; nome: string; idioma: string; corpo: string }

type Inicial = {
  atrasoMinutos: number
  fluxoId: string
  templateId?: string | null
  templateParametros?: Record<string, string>
}

const NOME = '{nome}'

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
  const [templateId, setTemplateId] = useState(inicial?.templateId ?? '')
  const [parametros, setParametros] = useState<Record<string, string>>(inicial?.templateParametros ?? {})
  const modelo = modelos.find((m) => m.id === templateId) ?? null
  const lacunas = modelo ? variaveisDe(modelo.corpo) : []
  /*
   * Sem nada guardado, o `{{1}}` é o nome do contato e o resto pede texto:
   * o uso de quase todo modelo é "Olá {{1}}".
   */
  const valorDe = (n: number) => parametros[String(n)] ?? (n === 1 ? NOME : '')
  const enviados = Object.fromEntries(lacunas.map((n) => [String(n), valorDe(n)]))

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
      <div>
        <RotuloCampo>Fluxo que este passo abre</RotuloCampo>
        <Dropdown
          nome="fluxoId"
          rotuloAcessivel="Fluxo que este passo abre"
          opcoes={fluxos}
          valorInicial={inicial?.fluxoId}
        />
      </div>
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
      <div>
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
            valor={templateId}
            aoMudar={(id) => {
              setTemplateId(id)
              setParametros({})
            }}
            opcoes={[
              { valor: '', rotulo: 'Nenhum, o passo fica até 24h' },
              ...modelos.map((item) => ({ valor: item.id, rotulo: item.nome, detalhe: item.idioma })),
            ]}
          />
        )}
      </div>
      {/*
        Um campo por lacuna do modelo. Antes todas viravam o nome do contato,
        e "seu pedido {{2}} saiu" chegava como "seu pedido Ana saiu". Cada
        lacuna escolhe: o nome de cada contato, ou um texto igual para todos.
      */}
      <input type="hidden" name="templateParametros" value={JSON.stringify(enviados)} />
      {modelo && lacunas.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <RotuloCampo>{lacunas.length === 1 ? 'Campo do modelo' : 'Campos do modelo'}</RotuloCampo>
          {lacunas.map((n) => {
            const valor = valorDe(n)
            const ehNome = valor === NOME
            const mudar = (v: string) => setParametros((atual) => ({ ...atual, [String(n)]: v }))
            return (
              <div key={n} className="flex flex-col gap-1">
                <span className="truncate text-[12px] text-dim" title={trechoDaLacuna(modelo.corpo, n)}>
                  {trechoDaLacuna(modelo.corpo, n)}
                </span>
                <div className="flex gap-1.5">
                  <div role="radiogroup" aria-label={`Lacuna ${n}`} className="flex shrink-0 rounded-[10px] border border-line bg-surface p-0.5">
                    {[
                      { rotulo: 'Nome do contato', ativo: ehNome, aoClicar: () => mudar(NOME) },
                      { rotulo: 'Texto', ativo: !ehNome, aoClicar: () => ehNome && mudar('') },
                    ].map((opcao) => (
                      <button
                        key={opcao.rotulo}
                        type="button"
                        role="radio"
                        aria-checked={opcao.ativo}
                        onClick={opcao.aoClicar}
                        className={`rounded-[8px] px-2.5 py-1 text-[12px] font-semibold transition ${
                          opcao.ativo ? 'bg-primary-weak text-primary' : 'text-muted hover:text-soft'
                        }`}
                      >
                        {opcao.rotulo}
                      </button>
                    ))}
                  </div>
                  {ehNome ? (
                    <span className="flex min-w-0 flex-1 items-center truncate px-1 text-[12.5px] text-dim">
                      O nome de cada contato
                    </span>
                  ) : (
                    <input
                      value={valor}
                      required
                      maxLength={LIMITE_DO_VALOR.corpo}
                      onChange={(e) => mudar(e.target.value)}
                      aria-label={`Texto da lacuna ${n}`}
                      className="app-field min-w-0 flex-1 px-2.5 py-1.5 text-[13px]"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
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
