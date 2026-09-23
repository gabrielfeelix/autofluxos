'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
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

const PENDENTE: Record<PedidoDaLinha['tipo'], string> = {
  concluir: 'Concluindo…',
  reabrir: 'Reabrindo…',
  cancelar: 'Cancelando…',
  reagendar: 'Salvando…',
  atribuir: 'Salvando…',
}

type Anuncio = { texto: string; atividadeId: string | null }

function semChave(registro: Record<string, string>, chave: string): Record<string, string> {
  const copia = { ...registro }
  delete copia[chave]
  return copia
}

/**
 * A lista da agenda com as ações de cada linha.
 *
 * **Ação que falha não some com a linha.** A linha só sai depois que o
 * servidor responde `ok`; com erro ela fica, e a mensagem do servidor aparece
 * embaixo dela. Sumir antes e voltar depois ensinaria a pessoa a desconfiar do
 * botão.
 *
 * Quem tira a linha de verdade é o servidor: a ação revalida a página e a
 * lista nova chega sem ela. `saindo` só cobre o intervalo até isso chegar.
 */
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
  const [, comecar] = useTransition()
  const [pendentes, setPendentes] = useState<Record<string, string>>({})
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

  function rodar(
    item: Pick<ItemDaAgenda, 'id'>,
    tipo: PedidoDaLinha['tipo'],
    acao: () => Promise<RespostaDaAtividade>,
    depois: { sai?: boolean; anuncio?: Anuncio } = {},
  ) {
    setErros((atual) => semChave(atual, item.id))
    setPendentes((atual) => ({ ...atual, [item.id]: PENDENTE[tipo] }))
    comecar(async () => {
      let r: RespostaDaAtividade
      try {
        r = await acao()
      } catch {
        r = { ok: false, erro: 'não deu para falar com o servidor, tente de novo' }
      }
      setPendentes((atual) => semChave(atual, item.id))
      if (!r.ok) {
        setErros((atual) => ({ ...atual, [item.id]: r.erro ?? 'não deu certo' }))
        return
      }
      if (depois.sai) setSaindo((atual) => new Set(atual).add(item.id))
      if (depois.anuncio) anunciar(depois.anuncio)
    })
  }

  function pedir(item: ItemDaAgenda, pedido: PedidoDaLinha) {
    switch (pedido.tipo) {
      case 'concluir':
        return rodar(item, 'concluir', () => acaoResolverAtividade(clienteId, item.id, 'concluida'), {
          sai: true,
          anuncio: { texto: 'Atividade concluída.', atividadeId: item.id },
        })
      case 'reabrir':
        return rodar(item, 'reabrir', () => acaoReabrirAtividade(clienteId, item.id), {
          sai: true,
          anuncio: { texto: 'Atividade reaberta.', atividadeId: null },
        })
      case 'cancelar':
        return setCancelando(item)
      case 'reagendar':
        return rodar(item, 'reagendar', () => acaoReagendarAtividade(clienteId, item.id, pedido.dia, pedido.hora), {
          anuncio: { texto: 'Prazo atualizado.', atividadeId: null },
        })
      case 'atribuir':
        return rodar(item, 'atribuir', () => acaoAtribuirAtividade(clienteId, item.id, pedido.responsavelId), {
          anuncio: { texto: 'Responsável atualizado.', atividadeId: null },
        })
    }
  }

  function desfazer(atividadeId: string) {
    setAnuncio(null)
    rodar({ id: atividadeId }, 'reabrir', () => acaoReabrirAtividade(clienteId, atividadeId), {
      anuncio: { texto: 'Atividade reaberta.', atividadeId: null },
    })
    setSaindo((atual) => {
      const novo = new Set(atual)
      novo.delete(atividadeId)
      return novo
    })
  }

  const visiveis = itens.filter((item) => !saindo.has(item.id))

  const acoes = (item: ItemDaAgenda) => (
    <AcoesDaLinha
      item={item}
      clienteId={clienteId}
      equipe={equipe}
      podeAtribuir={podeAtribuir}
      pendente={pendentes[item.id] ?? null}
      aoPedir={(pedido) => pedir(item, pedido)}
    />
  )

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
            rodar(cancelando, 'cancelar', () => acaoResolverAtividade(clienteId, cancelando.id, 'cancelada', motivo), {
              sai: true,
              anuncio: { texto: 'Atividade cancelada.', atividadeId: cancelando.id },
            })
          }
        />
      )}
    </>
  )
}
