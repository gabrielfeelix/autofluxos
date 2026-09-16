'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/design/modal'
import {
  CAMPOS,
  MODELOS_PRONTOS,
  camposUsados,
  previa,
  type ModeloPronto,
} from '@/core/modelos-prontos'
import { acaoCriarModelo } from '@/server/acoes-transmissoes'

/**
 * Criar um modelo: escolher, ajustar, mandar.
 *
 * ---------------------------------------------------------------------------
 * Por que é galeria e não formulário em branco
 * ---------------------------------------------------------------------------
 *
 * A primeira versão desta tela abria um formulário vazio pedindo **nome**,
 * **categoria** e **mensagem com `{{1}}`** — nessa ordem. Três perguntas que
 * quem quer avisar de uma consulta não sabe responder, e a mais importante por
 * último.
 *
 * Aqui a pessoa escolhe um caso pronto e lê a mensagem inteira antes de
 * decidir. O nome sumiu (é identificador de API, a gente gera) e a categoria
 * vem com o modelo — ela muda o **preço** da mensagem na Meta, e transferir
 * essa decisão para quem não tem como tomá-la é como a conta vem errada.
 *
 * ---------------------------------------------------------------------------
 * O `{{1}}` não aparece em lugar nenhum
 * ---------------------------------------------------------------------------
 *
 * Quem escreve vê `{nome}` e insere clicando num botão; a prévia mostra "Oi
 * Maria" com um nome de gente. A tradução para o formato da Meta acontece no
 * servidor — ver `paraFormatoDaMeta`.
 */

type Etapa = { tipo: 'galeria' } | { tipo: 'ajuste'; modelo: ModeloPronto }

export function NovoModelo({ clienteId }: { clienteId: string }) {
  const [aberto, setAberto] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'galeria' })

  function fechar() {
    setAberto(false)
    // Volta para a galeria só depois de fechar, para a troca não piscar na tela.
    setTimeout(() => setEtapa({ tipo: 'galeria' }), 200)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="app-primary-button shrink-0 px-[18px] py-2.5 text-[13px]"
      >
        Novo modelo
      </button>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={etapa.tipo === 'galeria' ? 'O que você quer mandar?' : etapa.modelo.titulo}
        descricao={
          etapa.tipo === 'galeria'
            ? 'Escolha um caso pronto. Você ajusta o texto antes de enviar.'
            : 'Ajuste o texto se quiser. A Meta revisa antes de liberar.'
        }
        largura={etapa.tipo === 'galeria' ? 620 : 480}
      >
        {etapa.tipo === 'galeria' ? (
          <Galeria aoEscolher={(modelo) => setEtapa({ tipo: 'ajuste', modelo })} />
        ) : (
          <Ajuste
            clienteId={clienteId}
            modelo={etapa.modelo}
            aoVoltar={() => setEtapa({ tipo: 'galeria' })}
            aoTerminar={fechar}
          />
        )}
      </Modal>
    </>
  )
}

/** Os casos prontos, com a mensagem visível antes da escolha. */
function Galeria({ aoEscolher }: { aoEscolher: (modelo: ModeloPronto) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MODELOS_PRONTOS.map((modelo) => (
        <button
          key={modelo.id}
          type="button"
          onClick={() => aoEscolher(modelo)}
          className="rounded-[12px] border border-line bg-panel px-3.5 py-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.04]"
        >
          <strong className="block text-[13px] font-semibold">{modelo.titulo}</strong>
          <span className="mt-0.5 block text-[11.5px] leading-4 text-dim">{modelo.resumo}</span>
          {/*
            A mensagem inteira aparece no cartão, já preenchida. Escolher sem
            ver o texto seria escolher no escuro — e o texto É o produto.
          */}
          <span className="mt-2 block rounded-[8px] bg-surface px-2.5 py-2 text-[11.5px] leading-[1.5] text-muted">
            {previa(modelo.corpo)}
          </span>
        </button>
      ))}
    </div>
  )
}

/** O passo final: ver o texto, ajustar, mandar. */
function Ajuste({
  clienteId,
  modelo,
  aoVoltar,
  aoTerminar,
}: {
  clienteId: string
  modelo: ModeloPronto
  aoVoltar: () => void
  aoTerminar: () => void
}) {
  const router = useRouter()
  const [corpo, setCorpo] = useState(modelo.corpo)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, comecar] = useTransition()

  const usados = camposUsados(corpo)

  function inserir(id: string) {
    setCorpo((atual) => `${atual}{${id}}`)
  }

  function enviar() {
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarModelo(clienteId, {
        titulo: modelo.titulo,
        corpo,
        categoria: modelo.categoria,
      })
      if (!r.ok) {
        setErro(r.erro ?? 'Não deu para criar.')
        return
      }
      router.refresh()
      aoTerminar()
    })
  }

  return (
    <div className="space-y-3.5">
      <div>
        <span className="mb-1 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Mensagem
        </span>
        <textarea
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          className="app-field min-h-[96px] px-[13px] py-[11px] text-[13.5px]"
        />
      </div>

      {/*
        Inserir campo por botão, e não digitando chave.

        `{nome}` já é mais legível que `{{1}}`, mas ainda é sintaxe. O botão
        tira a necessidade de saber que existe sintaxe nenhuma.
      */}
      <div>
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Inserir no texto
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CAMPOS.map((campo) => (
            <button
              key={campo.id}
              type="button"
              onClick={() => inserir(campo.id)}
              disabled={usados.includes(campo.id)}
              className="rounded-full border border-line px-2.5 py-1 text-[11.5px] transition hover:border-strong disabled:opacity-40"
            >
              + {campo.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/*
        A prévia com um nome de gente.

        "Oi {nome}" não responde "o que a pessoa recebe?". Ver "Oi Maria" é o
        que faz alguém perceber que faltou vírgula, ou que o texto ficou seco.
      */}
      <div>
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Como o cliente recebe
        </span>
        <p className="rounded-[12px] bg-[#dcf8c6] px-3 py-2.5 text-[13px] leading-[1.5] whitespace-pre-wrap text-[#111b21]">
          {previa(corpo) || ' '}
        </p>
      </div>

      {erro && <p className="text-[12.5px] leading-5 text-perigo">{erro}</p>}

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={aoVoltar}
          className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={enviar}
          disabled={salvando || corpo.trim() === ''}
          className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:opacity-50"
        >
          {salvando ? 'Enviando…' : 'Enviar para a Meta'}
        </button>
      </div>
    </div>
  )
}
