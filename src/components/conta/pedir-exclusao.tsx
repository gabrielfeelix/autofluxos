'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/design/modal'
import { acaoPedirExclusao } from '@/server/acoes-exclusao'

type Alvo = 'usuario' | 'organizacao'

/**
 * O modal de "pedir exclusão", da conta de acesso ou da organização.
 *
 * **Pede, não apaga**, e a tela diz isso com todas as letras: a 4YU confere e
 * executa (`acoes-exclusao.ts`). A caixa de "entendo" existe porque, depois de
 * executado, não volta; o botão só acende com ela marcada.
 */
export function ModalDePedirExclusao({
  alvo,
  clienteId,
  organizacao,
  aoFechar,
}: {
  alvo: Alvo
  clienteId?: string
  organizacao?: string
  aoFechar: () => void
}) {
  const [ciente, setCiente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  const daOrganizacao = alvo === 'organizacao'

  const enviar = (dados: FormData) => {
    setErro(null)
    comecar(async () => {
      const r = await acaoPedirExclusao({ alvo, clienteId, motivo: String(dados.get('motivo') ?? '') })
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setEnviadoPara(r.email)
    })
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      largura={460}
      titulo={daOrganizacao ? 'Pedir exclusão da organização' : 'Pedir exclusão da minha conta'}
      descricao={
        daOrganizacao
          ? `${organizacao ?? 'A organização'} e tudo que pertence a ela: contatos, conversas, fluxos, quadros e arquivos.`
          : 'O seu login no Dialogon, em todas as organizações em que você entra com este e-mail.'
      }
    >
      {enviadoPara ? (
        <div role="status" className="flex flex-col gap-4">
          <p className="text-[13.5px] leading-6 text-ink">
            Pedido enviado. O comprovante foi para <strong>{enviadoPara}</strong>.
          </p>
          <p className="text-[12.5px] leading-5 text-muted">
            A 4YU confirma em até 2 dias úteis e conclui em até 15 dias. Até lá, tudo segue funcionando. Para
            cancelar o pedido, responda o e-mail de comprovante.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={aoFechar} className="botao-primario botao-md">
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            enviar(new FormData(evento.currentTarget))
          }}
          className="flex flex-col gap-4"
        >
          <ul className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[12.5px] leading-5 text-muted">
            <li>
              <strong className="text-ink">Nada é apagado agora.</strong> A 4YU confere o pedido e confirma por
              e-mail em até 2 dias úteis.
            </li>
            <li>A exclusão é concluída em até 15 dias e não pode ser desfeita.</li>
            {daOrganizacao ? (
              <li>Antes, exporte o que precisar e desconecte o WhatsApp e o Instagram: os números continuam sendo de vocês.</li>
            ) : (
              <li>As conversas que você atendeu continuam com as organizações, que são as donas delas.</li>
            )}
          </ul>

          <label>
            <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
              Motivo (opcional)
            </span>
            <textarea
              name="motivo"
              rows={3}
              maxLength={500}
              placeholder={daOrganizacao ? 'Exemplo: encerramos as atividades desta unidade.' : 'Exemplo: não trabalho mais na empresa.'}
              className="app-field w-full resize-y px-[13px] py-[11px] text-[13.5px]"
            />
          </label>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={ciente}
              onChange={(evento) => setCiente(evento.target.checked)}
              className="mt-0.5 caixa-de-marcar"
            />
            <span className="text-[12.5px] leading-5 text-ink">
              {daOrganizacao
                ? 'Entendo que, depois de concluída, a exclusão apaga a organização inteira e não pode ser desfeita.'
                : 'Entendo que, depois de concluída, a exclusão apaga o meu acesso e não pode ser desfeita.'}
            </span>
          </label>

          {erro && (
            <p role="alert" className="border-l-2 border-rose-400 py-0.5 pl-3 text-[12.5px] leading-5 text-perigo">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-dim transition hover:text-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!ciente || rodando}
              className="rounded-lg bg-perigo px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {rodando ? 'Enviando…' : 'Enviar pedido'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

/**
 * O fim de Dados da organização, só para o proprietário. Fica no pé da tela,
 * longe do que se usa todo dia, e o botão é contorno, não cheio: é para achar
 * quando se procura, não para clicar de passagem.
 */
export function ExclusaoDaOrganizacao({ clienteId, organizacao }: { clienteId: string; organizacao: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <section className="app-card overflow-hidden">
      <h2 className="border-b border-line px-[18px] py-3.5 text-[13px] font-bold">Excluir a organização</h2>
      <div className="flex flex-col gap-3 px-[18px] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-[12.5px] leading-5 text-muted">
          Peça à 4YU a exclusão de {organizacao} e de tudo que pertence a ela. Nada é apagado na hora: a 4YU
          confirma por e-mail antes.
        </p>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="shrink-0 rounded-lg border border-perigo/40 px-3.5 py-2 text-[12.5px] font-semibold text-perigo transition hover:bg-perigo/10"
        >
          Pedir exclusão
        </button>
      </div>
      {aberto && <ModalDePedirExclusao alvo="organizacao" clienteId={clienteId} organizacao={organizacao} aoFechar={() => setAberto(false)} />}
    </section>
  )
}
