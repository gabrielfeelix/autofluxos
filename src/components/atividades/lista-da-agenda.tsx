'use client'

import { useEffect, useRef, useState } from 'react'
import { prazoDoDia } from '@/core/atividades'
import { depoisDaTela } from '@/components/inbox/conversa-local'
import { ajustarContagem, atrasada } from '@/components/design/contagens-local'
import type { ItemDaAgenda } from '@/server/repos/atividades'
import {
  acaoAtribuirAtividade,
  acaoReabrirAtividade,
  acaoReagendarAtividade,
  acaoResolverAtividade,
  type RespostaDaAtividade,
} from '@/server/acoes-atividades'
import { AcoesDaLinha, type PedidoDaLinha } from './acoes-da-linha'
import { DialogoDeCancelar } from './cancelar-atividade'
import { CartaoDaAgenda, LinhaDaAgenda } from './linha-da-agenda'

/** Quanto tempo o "Desfazer" fica na tela depois de concluir ou cancelar. */
const TEMPO_DO_DESFAZER = 6000


type Anuncio = { texto: string; atividadeId: string | null }

function semItem(conjunto: Set<string>, chave: string): Set<string> {
  const copia = new Set(conjunto)
  copia.delete(chave)
  return copia
}

function semChave(registro: Record<string, string>, chave: string): Record<string, string> {
  const copia = { ...registro }
  delete copia[chave]
  return copia
}

/**
 * As ações de cada atividade da agenda, para a lista e para o calendário.
 *
 * **Ação que falha não some com a linha.** A linha só sai depois que o
 * servidor responde `ok`; com erro ela fica, e a mensagem do servidor aparece
 * embaixo dela. Sumir antes e voltar depois ensinaria a pessoa a desconfiar do
 * botão.
 *
 * Quem tira a linha de verdade é o servidor: a ação revalida a página e a
 * lista nova chega sem ela. `saindo` só cobre o intervalo até isso chegar.
 */
export function useAcoesDaAgenda({
  clienteId,
  equipe,
  podeAtribuir,
  aoSair,
  volta,
}: {
  clienteId: string
  equipe: { id: string; nome: string }[]
  podeAtribuir: boolean
  /** O endereço da agenda, para o "Abrir contato" do menu voltar para cá. */
  volta?: string
  /** Avisado quando uma atividade sai da tela (concluída, cancelada, reaberta). */
  aoSair?: (atividadeId: string) => void
}) {
  /** O que esta aba mudou em cada linha (prazo, responsável), por cima do servidor. */
  const [remendos, setRemendos] = useState<Record<string, Partial<ItemDaAgenda>>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [saindo, setSaindo] = useState<Set<string>>(new Set())
  const [cancelando, setCancelando] = useState<ItemDaAgenda | null>(null)
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null)
  const relogio = useRef<number | null>(null)

  useEffect(() => () => {
    if (relogio.current) window.clearTimeout(relogio.current)
  }, [])

  function anunciar(novo: Anuncio) {
    if (relogio.current) window.clearTimeout(relogio.current)
    setAnuncio(novo)
    relogio.current = window.setTimeout(() => setAnuncio(null), TEMPO_DO_DESFAZER)
  }

  /**
   * Otimista desde 25/set. Era: "Concluindo…" no botão até o servidor
   * responder, e só então a linha saía; e o servidor ainda redesenhava o
   * layout inteiro. Agora a linha sai (ou muda) no clique, o anúncio com
   * "Desfazer" aparece junto, e se o servidor recusar a linha volta com o erro.
   */
  function rodar(
    item: Pick<ItemDaAgenda, 'id'> & Partial<ItemDaAgenda>,
    acao: () => Promise<RespostaDaAtividade>,
    depois: { sai?: boolean; volta?: boolean; anuncio?: Anuncio; remendo?: Partial<ItemDaAgenda> } = {},
  ) {
    setErros((atual) => semChave(atual, item.id))
    const remendoAntes = remendos[item.id]
    if (depois.sai) {
      setSaindo((atual) => new Set(atual).add(item.id))
      aoSair?.(item.id)
    }
    if (depois.volta) setSaindo((atual) => semItem(atual, item.id))
    if (depois.remendo) setRemendos((atual) => ({ ...atual, [item.id]: { ...atual[item.id], ...depois.remendo } }))
    if (depois.anuncio) anunciar(depois.anuncio)

    // O número de atrasadas do menu lateral muda junto.
    const vivo = { situacao: 'aberta', prazo: null, ...item, ...remendoAntes }
    const eraAtrasada = item.situacao !== undefined && atrasada(vivo)
    const ficaAtrasada =
      item.situacao !== undefined && !depois.sai && atrasada({ ...vivo, ...depois.remendo })
    const delta = (ficaAtrasada ? 1 : 0) - (eraAtrasada ? 1 : 0)
    ajustarContagem('atrasadas', delta)

    const desfazer = (erro: string) => {
      ajustarContagem('atrasadas', -delta)
      if (depois.sai) setSaindo((atual) => semItem(atual, item.id))
      if (depois.volta) setSaindo((atual) => new Set(atual).add(item.id))
      if (depois.remendo) {
        setRemendos((atual) => {
          const novo = { ...atual }
          if (remendoAntes) novo[item.id] = remendoAntes
          else delete novo[item.id]
          return novo
        })
      }
      if (depois.anuncio) setAnuncio(null)
      setErros((atual) => ({ ...atual, [item.id]: erro }))
    }

    depoisDaTela(acao).then(
      (r) => {
        if (!r.ok) desfazer(r.erro ?? 'não deu certo')
      },
      () => desfazer('não deu para falar com o servidor, tente de novo'),
    )
  }

  function pedir(item: ItemDaAgenda, pedido: PedidoDaLinha) {
    switch (pedido.tipo) {
      case 'concluir':
        return rodar(item, () => acaoResolverAtividade(clienteId, item.id, 'concluida'), {
          sai: true,
          anuncio: { texto: 'Atividade concluída.', atividadeId: item.id },
        })
      case 'reabrir':
        return rodar(item, () => acaoReabrirAtividade(clienteId, item.id), {
          sai: true,
          anuncio: { texto: 'Atividade reaberta.', atividadeId: null },
        })
      case 'cancelar':
        return setCancelando(item)
      case 'reagendar':
        return rodar(item, () => acaoReagendarAtividade(clienteId, item.id, pedido.dia, pedido.hora), {
          anuncio: { texto: 'Prazo atualizado.', atividadeId: null },
          remendo: {
            prazo: prazoDoDia(pedido.dia, pedido.hora),
            horaMarcada: pedido.dia.trim() !== '' && pedido.hora.trim() !== '',
          },
        })
      case 'atribuir':
        return rodar(item, () => acaoAtribuirAtividade(clienteId, item.id, pedido.responsavelId), {
          anuncio: { texto: 'Responsável atualizado.', atividadeId: null },
          remendo: {
            responsavelId: pedido.responsavelId || null,
            responsavelNome: equipe.find((pessoa) => pessoa.id === pedido.responsavelId)?.nome ?? null,
          },
        })
    }
  }

  function desfazer(atividadeId: string) {
    setAnuncio(null)
    rodar({ id: atividadeId }, () => acaoReabrirAtividade(clienteId, atividadeId), {
      volta: true,
      anuncio: { texto: 'Atividade reaberta.', atividadeId: null },
    })
  }

  const acoes = (item: ItemDaAgenda) => (
    <AcoesDaLinha
      item={item}
      clienteId={clienteId}
      equipe={equipe}
      podeAtribuir={podeAtribuir}
      pendente={null}
      aoPedir={(pedido) => pedir(item, pedido)}
      volta={volta}
    />
  )

  const extras = (
    <>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        {anuncio && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-ink px-4 py-2.5 text-[12.5px] text-white shadow-lg">
            <span>{anuncio.texto}</span>
            {anuncio.atividadeId && (
              <button
                type="button"
                onClick={() => desfazer(anuncio.atividadeId!)}
                className="font-bold text-primary-weak underline underline-offset-2"
              >
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>

      {cancelando && (
        <DialogoDeCancelar
          titulo={cancelando.titulo}
          aoFechar={() => setCancelando(null)}
          aoConfirmar={(motivo) =>
            rodar(cancelando, () => acaoResolverAtividade(clienteId, cancelando.id, 'cancelada', motivo), {
              sai: true,
              anuncio: { texto: 'Atividade cancelada.', atividadeId: cancelando.id },
            })
          }
        />
      )}
    </>
  )

  /** As linhas como a tela deve mostrar: sem as que saíram, com o que mudou. */
  const vivos = <T extends ItemDaAgenda>(itens: T[]): T[] =>
    itens.filter((item) => !saindo.has(item.id)).map((item) => (remendos[item.id] ? { ...item, ...remendos[item.id] } : item))

  return { acoes, erros, saindo, extras, vivos }
}

/** A lista da agenda com as ações de cada linha. */
export function ListaDaAgenda({
  itens,
  agora,
  clienteId,
  volta,
  equipe,
  podeAtribuir,
}: {
  itens: ItemDaAgenda[]
  agora: number
  clienteId: string
  volta: string
  equipe: { id: string; nome: string }[]
  podeAtribuir: boolean
}) {
  const { acoes, erros, extras, vivos } = useAcoesDaAgenda({ clienteId, equipe, podeAtribuir, volta })
  const visiveis = vivos(itens)

  return (
    <>
      <div className="app-card hidden shrink-0 md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {['Prazo', 'Atividade', 'Contato', 'Responsável'].map((coluna) => (
                <th key={coluna} scope="col" className="px-4 py-3 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase">
                  {coluna}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((item) => (
              <LinhaDaAgenda
                key={item.id}
                item={item}
                agora={agora}
                clienteId={clienteId}
                volta={volta}
                acoes={acoes(item)}
                erro={erros[item.id] ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="app-card shrink-0 md:hidden">
        {visiveis.map((item) => (
          <CartaoDaAgenda
            key={item.id}
            item={item}
            agora={agora}
            clienteId={clienteId}
            volta={volta}
            acoes={acoes(item)}
            erro={erros[item.id] ?? null}
          />
        ))}
      </ul>

      {extras}
    </>
  )
}
