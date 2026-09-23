'use client'

import {
  FORMATO_DO_TIPO,
  NOME_DO_TIPO,
  TIPOS_DE_ATIVIDADE,
  type TipoDeAtividade,
} from '@/core/atividades'

/**
 * Os campos de uma atividade nova: tipo, título, onde, dia e hora.
 *
 * Um componente só para o Inbox e para a agenda (plano de UX de 23/09, tarefa
 * 1.5). Dois formulários com a mesma pergunta acabam com duas respostas: um
 * pede hora para proposta, o outro grava link de reunião numa tarefa.
 *
 * ---------------------------------------------------------------------------
 * O tipo vem primeiro, e muda o resto
 * ---------------------------------------------------------------------------
 *
 * O tipo era um dropdown no meio do formulário e **não mudava nada**: escolher
 * "reunião" dava o mesmo campo de "tarefa", e o link da chamada acabava no meio
 * do título ou em lugar nenhum. Agora ele abre o painel, em cinco botões: a
 * escolha aparece inteira sem abrir nada, e é ela que decide os campos de
 * baixo, lidos de `FORMATO_DO_TIPO`. Reunião pede link, visita pede endereço,
 * ligação e reunião pedem hora.
 */

export type ValoresDaAtividade = {
  tipo: TipoDeAtividade
  titulo: string
  onde: string
  /** `AAAA-MM-DD` ou vazio. */
  prazo: string
  /** `HH:MM` ou vazio. */
  hora: string
}

export const VALORES_VAZIOS: ValoresDaAtividade = { tipo: 'tarefa', titulo: '', onde: '', prazo: '', hora: '' }

/**
 * O que vai para `acaoCriarAtividade`.
 *
 * O `onde` e a hora só viajam quando o tipo os usa: trocar de reunião para
 * tarefa depois de colar um link não deve gravar o link numa tarefa.
 */
export function pedidoDosCampos(v: ValoresDaAtividade) {
  const formato = FORMATO_DO_TIPO[v.tipo]
  return {
    tipo: v.tipo,
    titulo: v.titulo.trim(),
    onde: formato.onde ? v.onde : undefined,
    prazo: v.prazo,
    hora: formato.pedeHora ? v.hora : undefined,
  }
}

export function CamposDaAtividade({
  valores,
  aoMudar,
  tituloComFoco = false,
}: {
  valores: ValoresDaAtividade
  aoMudar: (novos: ValoresDaAtividade) => void
  tituloComFoco?: boolean
}) {
  const formato = FORMATO_DO_TIPO[valores.tipo]
  const mudar = (campo: Partial<ValoresDaAtividade>) => aoMudar({ ...valores, ...campo })

  return (
    <>
      {/*
        Os cinco tipos à mostra, e não atrás de um dropdown: são poucos, cabem
        numa linha e a escolha é a primeira decisão.
      */}
      <div role="radiogroup" aria-label="Tipo da atividade" className="flex flex-wrap gap-1">
        {TIPOS_DE_ATIVIDADE.map((chave) => {
          const escolhido = chave === valores.tipo
          return (
            <button
              key={chave}
              type="button"
              role="radio"
              aria-checked={escolhido}
              onClick={() => mudar({ tipo: chave })}
              className={`rounded-full border px-2.5 py-1 text-[12.5px] font-semibold capitalize transition ${
                escolhido
                  ? 'border-primary/40 bg-primary-weak text-primary'
                  : 'border-line text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              {NOME_DO_TIPO[chave]}
            </button>
          )
        })}
      </div>

      <input
        value={valores.titulo}
        onChange={(evento) => mudar({ titulo: evento.target.value })}
        placeholder={formato.placeholder}
        aria-label={formato.placeholder}
        autoFocus={tituloComFoco}
        className="app-field w-full px-3 py-2.5 text-[13px]"
      />

      {formato.onde && (
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-muted">{formato.onde.rotulo}</span>
          <input
            value={valores.onde}
            onChange={(evento) => mudar({ onde: evento.target.value })}
            placeholder={formato.onde.placeholder}
            maxLength={500}
            className="app-field w-full px-3 py-2 text-[12.5px]"
          />
        </label>
      )}

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11.5px] font-medium text-muted">Quando</span>
          <input
            type="date"
            value={valores.prazo}
            onChange={(evento) => mudar({ prazo: evento.target.value })}
            className="app-field w-full px-2 py-2 text-[12.5px]"
          />
        </label>
        {/*
          A hora só aparece onde ela existe de verdade. Uma proposta vence num
          dia; uma reunião acontece numa hora. Pedir hora para tudo faria todo
          mundo deixar 00:00 e a agenda mentir.
        */}
        {formato.pedeHora && (
          <label className="flex w-[104px] flex-col gap-1">
            <span className="text-[11.5px] font-medium text-muted">Hora</span>
            <input
              type="time"
              value={valores.hora}
              onChange={(evento) => mudar({ hora: evento.target.value })}
              disabled={valores.prazo === ''}
              className="app-field w-full px-2 py-2 text-[12.5px] disabled:opacity-50"
            />
          </label>
        )}
      </div>
    </>
  )
}
