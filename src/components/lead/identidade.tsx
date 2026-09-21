'use client'

import { useRef, useState } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import { Avatar } from '@/components/inbox/avatar'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import { IconeDaSecao, iconeLapis } from '@/components/lead-crm/icones'

type Acao = (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>

/**
 * O nome do contato, e a correção dele.
 *
 * O WhatsApp entrega o nome que a pessoa escolheu para si, e numa lista de
 * atendimento isso vira "Rodrigão comedor delas" onde deveria estar "Rodrigo".
 * A correção mora aqui, a um clique, e **não substitui** o nome do perfil: ele
 * continua visível abaixo, porque é o que identifica a conta do WhatsApp e o
 * que quem atende reconhece na notificação do celular.
 */
export function NomeDoContato({
  nome,
  nomeDoPerfil,
  nomeReal,
  waId,
  salvar,
}: {
  nome: string | null
  nomeDoPerfil: string | null
  nomeReal: string
  waId: string
  salvar: Acao
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(dados: FormData) {
    setErro(null)
    const r = await salvar({}, dados)
    if (r && r.erro) {
      setErro(r.erro)
      return
    }
    dialogo.current?.close()
  }

  return (
    <div className="min-w-0">
      <h1 className="flex flex-wrap items-center gap-2 text-[21px] font-bold tracking-[-0.02em]">
        <span className="min-w-0 break-words">{nome ?? telefoneLegivel(waId)}</span>
        {/*
          Um lápis, e não a caixa escrita "corrigir nome".

          A caixa dizia o que fazer e ocupava o lugar de um título: ao lado de um
          nome de duas palavras ela competia com o próprio nome, e em nome longo
          ela caía para a linha de baixo sozinha. O lápis ao lado de um texto é
          convenção que ninguém precisa ler, e o `title` diz o resto para quem
          passar o mouse.
        */}
        <button
          type="button"
          onClick={() => dialogo.current?.showModal()}
          title={nomeReal === '' ? 'Corrigir o nome' : 'Editar o nome'}
          aria-label={nomeReal === '' ? 'Corrigir o nome' : 'Editar o nome'}
          className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-primary/40 hover:text-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
            <path
              d="M11.2 2.3a1.4 1.4 0 0 1 2 2l-6.6 6.6-2.7.7.7-2.7 6.6-6.6ZM10 3.6l2.4 2.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </h1>
      <p className="mt-0.5 font-mono text-[11px] text-dim">
        {telefoneLegivel(waId)}
        {/*
          Só aparece quando os dois divergem. Repetir o mesmo nome duas vezes
          seria ruído; mostrar o do perfil quando ele foi corrigido é o que
          explica por que a notificação do celular diz outra coisa.
        */}
        {nomeReal !== '' && nomeDoPerfil && nomeDoPerfil.trim() !== nomeReal && (
          <span className="ml-2 font-sans text-[11px] text-muted">
            no WhatsApp: “{nomeDoPerfil}”
          </span>
        )}
      </p>

      {/*
        O editor é modal, e não a troca do cabeçalho por um formulário no lugar.

        Trocando no lugar, **o nome sumia justamente enquanto era editado**: a
        tela perdia a única referência do que se está corrigindo, e o campo
        aparecia colado no telefone, sem título nem fronteira. O modal mostra a
        pessoa inteira enquanto se digita, avatar, nome atual, e o do perfil do
        WhatsApp embaixo, que é a informação que explica por que corrigir.
      */}
      <dialog
        ref={dialogo}
        onClick={(evento) => {
          if (evento.target === dialogo.current) {
            setErro(null)
            dialogo.current.close()
          }
        }}
        className="app-dialog m-auto w-[380px] rounded-[18px] border border-line bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
      >
        <div className="flex items-center gap-3">
          <Avatar nome={nome} tamanho={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">
              {nome ?? telefoneLegivel(waId)}
            </span>
            <span className="block font-mono text-[11px] text-dim">{telefoneLegivel(waId)}</span>
          </span>
        </div>

        <form action={enviar} className="mt-5 space-y-3.5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
              Nome de verdade
            </span>
            <input
              name="nome"
              autoFocus
              defaultValue={nomeReal}
              maxLength={120}
              placeholder={nomeDoPerfil ?? 'Nome de verdade'}
              className="app-field w-full px-3 py-2 text-[14px] font-semibold"
            />
          </label>

          <p className="text-[11.5px] leading-5 text-muted">
            {nomeDoPerfil
              ? `No WhatsApp ela se chama “${nomeDoPerfil}”. Vazio volta a mostrar esse nome.`
              : 'Vazio volta a mostrar o nome do perfil do WhatsApp.'}
          </p>

          {erro && (
            <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-perigo">
              {erro}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setErro(null)
                dialogo.current?.close()
              }}
              className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
            >
              Cancelar
            </button>
            <button type="submit" className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px]">
              Salvar
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

/**
 * A anotação de quem atende.
 *
 * Fechada por padrão pelo mesmo motivo da ficha do cliente: a tela é visitada
 * muitas vezes para olhar e uma vez para escrever. Quando já existe anotação,
 * ela aparece, nota escondida é nota que ninguém lê.
 */
export function NotasDoContato({
  notas,
  limite,
  salvar,
}: {
  notas: string
  limite: number
  salvar: Acao
}) {
  const [editando, setEditando] = useState(false)

  return (
    <section className="app-card p-4">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[12.5px] font-bold">
          <IconeDaSecao>{iconeLapis}</IconeDaSecao>
          Anotação
          <AjudaDoCampo
            titulo="Lembrete"
            secao="duvidas"
            texto="Um lembrete curto da equipe sobre esta pessoa, sempre visível na ficha."
            detalhes={
              <>
                <p>
                  Uma linha que fica sempre à vista, para quem abrir a ficha não precisar ler o
                  histórico inteiro: “prefere ligação”, “alérgica a amendoim”, “é irmã da Ana”.
                </p>
                <p>
                  <strong>Fica só aqui.</strong> Não vai para o WhatsApp nem para nenhuma
                  automação.
                </p>
              </>
            }
          />
        </h2>
        {!editando && (
          <button
            type="button"
            data-foco
            onClick={() => setEditando(true)}
            className="rounded-lg border border-line px-2 py-0.5 text-[10.5px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
          >
            {notas === '' ? 'anotar' : 'editar'}
          </button>
        )}
      </header>

      {editando ? (
        <>
          <FormularioSalvar
            action={async (estado, formData) => {
              const r = await salvar(estado, formData)
              if (r.ok) setEditando(false)
              return r
            }}
            rotulo="Salvar anotação"
            dica="Fica só aqui, não vai para o WhatsApp nem para nenhuma automação."
          >
            <textarea
              name="notas"
              autoFocus
              rows={4}
              maxLength={limite}
              defaultValue={notas}
              placeholder="Prefere aula de manhã. Já perguntou preço duas vezes."
              className="app-field resize-y px-3 py-2.5 text-[12.5px] leading-5"
            />
          </FormularioSalvar>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="mt-1.5 text-[11.5px] text-muted transition hover:text-primary"
          >
            Cancelar
          </button>
        </>
      ) : notas === '' ? (
        <p className="text-[12px] text-dim">
          O que não cabe num campo: preferência de horário, o que já foi combinado.
        </p>
      ) : (
        <p className="text-[12.5px] leading-5 whitespace-pre-wrap text-soft">{notas}</p>
      )}
    </section>
  )
}
