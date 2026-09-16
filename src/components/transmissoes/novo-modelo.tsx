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
import {
  acaoCriarDaBiblioteca,
  acaoCriarModelo,
  acaoListarBiblioteca,
} from '@/server/acoes-transmissoes'
import type { ModeloDaBiblioteca } from '@/channels/templates-api'
import type { Categoria } from '@/core/templates'

/**
 * Criar um modelo: escolher, ajustar, mandar.
 *
 * ---------------------------------------------------------------------------
 * Por que é galeria e não formulário em branco
 * ---------------------------------------------------------------------------
 *
 * A primeira versão desta tela abria um formulário vazio pedindo **nome**,
 * **categoria** e **mensagem com `{{1}}`**, nessa ordem. Três perguntas que
 * quem quer avisar de uma consulta não sabe responder, e a mais importante por
 * último.
 *
 * Aqui a pessoa escolhe um caso pronto e lê a mensagem inteira antes de
 * decidir. O nome sumiu (é identificador de API, a gente gera) e a categoria
 * vem com o modelo, ela muda o **preço** da mensagem na Meta, e transferir
 * essa decisão para quem não tem como tomá-la é como a conta vem errada.
 *
 * ---------------------------------------------------------------------------
 * O `{{1}}` não aparece em lugar nenhum
 * ---------------------------------------------------------------------------
 *
 * Quem escreve vê `{nome}` e insere clicando num botão; a prévia mostra "Oi
 * Maria" com um nome de gente. A tradução para o formato da Meta acontece no
 * servidor, ver `paraFormatoDaMeta`.
 */

type Etapa =
  | { tipo: 'galeria' }
  | { tipo: 'ajuste'; modelo: ModeloPronto }
  /**
   * O da Meta tem passo próprio porque **não dá para editar o texto**: alterar
   * devolve o template para a fila comum de 24h e perde a única vantagem dele.
   */
  | { tipo: 'confirmar'; modelo: ModeloDaBiblioteca }

export function NovoModelo({ clienteId }: { clienteId: string }) {
  const [aberto, setAberto] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'galeria' })
  const [daMeta, setDaMeta] = useState<ModeloDaBiblioteca[]>([])
  const [buscando, setBuscando] = useState(false)

  /*
   * A biblioteca é buscada ao ABRIR, e não ao montar a página.
   *
   * Ela é uma chamada à Graph, e a maioria das visitas a esta tela não vai
   * criar modelo nenhum, buscar antes gastaria cota da Meta em toda abertura
   * da lista de modelos.
   *
   * Falhar aqui não bloqueia nada: os nossos modelos aparecem do mesmo jeito.
   * Ver `acaoListarBiblioteca`.
   */
  function abrir() {
    setAberto(true)
    if (daMeta.length > 0 || buscando) return

    setBuscando(true)
    void acaoListarBiblioteca(clienteId)
      .then((r) => setDaMeta(r.modelos))
      .catch(() => setDaMeta([]))
      .finally(() => setBuscando(false))
  }

  function fechar() {
    setAberto(false)
    // Volta para a galeria só depois de fechar, para a troca não piscar na tela.
    setTimeout(() => setEtapa({ tipo: 'galeria' }), 200)
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="app-primary-button shrink-0 px-[18px] py-2.5 text-[13px]"
      >
        Novo modelo
      </button>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={
          etapa.tipo === 'galeria'
            ? 'O que você quer mandar?'
            : etapa.tipo === 'ajuste'
              ? etapa.modelo.titulo
              : 'Aprovação imediata'
        }
        descricao={
          etapa.tipo === 'galeria'
            ? 'Escolha um caso pronto. Você ajusta o texto antes de enviar.'
            : etapa.tipo === 'ajuste'
              ? 'Ajuste o texto se quiser. A Meta revisa antes de liberar.'
              : 'Este texto é da Meta e não pode ser alterado. É o que faz ele ser aprovado na hora.'
        }
        largura={etapa.tipo === 'galeria' ? 620 : 480}
      >
        {etapa.tipo === 'galeria' && (
          <Galeria
            daMeta={daMeta}
            buscando={buscando}
            aoEscolher={(modelo) => setEtapa({ tipo: 'ajuste', modelo })}
            aoEscolherDaMeta={(modelo) => setEtapa({ tipo: 'confirmar', modelo })}
          />
        )}
        {etapa.tipo === 'ajuste' && (
          <Ajuste
            clienteId={clienteId}
            modelo={etapa.modelo}
            aoVoltar={() => setEtapa({ tipo: 'galeria' })}
            aoTerminar={fechar}
          />
        )}
        {etapa.tipo === 'confirmar' && (
          <ConfirmarDaMeta
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

/**
 * O selo que separa o que aprova na hora do que espera revisão.
 *
 * **Não é pill arredondada.** O balão da mensagem logo abaixo já é um retângulo
 * de cantos redondos, e duas formas parecidas empilhadas no mesmo cartão fazem
 * o olho ler o selo como parte do texto. Aqui é um check com a palavra ao lado:
 * forma diferente, leitura imediata.
 */
function SeloImediato() {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold tracking-[0.02em] text-emerald-600">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2.5 6.3l2.3 2.3 4.7-5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Aprovação imediata
    </span>
  )
}

/** A marca da Meta, no lugar da palavra. */
function LogoDaMeta() {
  return (
    <svg
      width="46"
      height="11"
      viewBox="0 0 287 60"
      fill="currentColor"
      role="img"
      aria-label="Meta"
    >
      <path d="M20.3 0C9.1 0 0 14.6 0 32.1 0 49.6 6.6 60 17 60c7.5 0 12.9-3.5 22.5-20.3l5.6-9.9c.4-.7.8-1.4 1.2-2l3.7 6.2C60.3 50.6 65 60 74.4 60c10.1 0 15.7-10.3 15.7-27.6C90.1 13.9 80.8 0 69.8 0c-5.8 0-10.9 4.4-16.5 12.4C47.2 4.1 41.2 0 34.1 0h-.2zm-.2 10.3c4.2 0 8.1 3.2 12.3 9.4-3.2 4.9-6.3 10.2-9.7 16.3l-3.2 5.7c-3.5 6.1-5.4 7.7-8 7.7-3.9 0-6.7-5.1-6.7-16 0-13.5 5.1-23.1 15.3-23.1zm49.1 0c5.2 0 9.9 8.1 9.9 22.6 0 11.3-2.3 16.5-6.5 16.5-2.8 0-5.2-2.5-9.6-9.8l-5.4-9.1c-1.4-2.3-2.7-4.5-4-6.5 5.6-8.7 10.6-13.7 15.6-13.7z" />
      <path d="M108.2 14.4h-8.4v31.9c0 4.9 2.2 7.6 6.9 7.6 3 0 5.2-1 7.9-3.3V33.9c0-3.5 1.6-5 4.2-5 2.4 0 3.8 1.6 3.8 4.6v20.9h8.4V33.9c0-3.5 1.7-5 4.2-5 2.4 0 3.8 1.6 3.8 4.6v20.9h8.4V31.5c0-6.6-3.6-10.6-9.5-10.6-4 0-7.2 1.9-9.5 5.1-1.5-3.3-4.4-5.1-8.4-5.1-3.7 0-6.7 1.7-8.9 4.7h-.2l-.6-4h-2.1v-7.2zM176.4 38c0-9.9-5.3-17.1-14.6-17.1-9.4 0-15.3 7.2-15.3 17.2 0 10.2 6 17 15.9 17 5 0 9.2-1.6 12.4-4.4l-3.5-5.6c-2.4 1.9-5 2.9-8.1 2.9-4.5 0-7.4-2.4-8.1-6.9h21c.2-1 .3-2.1.3-3.1zm-21.4-3.5c.6-4.3 3-6.8 6.6-6.8 3.7 0 6 2.5 6.3 6.8h-12.9zM197.8 46.8c-1.2.5-2.3.7-3.4.7-2.6 0-3.8-1.4-3.8-4.6V28.4h7.4v-6.9h-7.4v-8.8l-8.4 1v7.8h-4.7v6.9h4.7v15.3c0 7.1 3.6 10.9 10.3 10.9 2.5 0 4.7-.5 6.7-1.4l-1.4-6.4zM230.5 54.4V32.8c0-7.8-4.9-11.9-13.4-11.9-5 0-9.3 1.3-12.6 3.3l2.8 6c2.6-1.4 5.5-2.3 8.3-2.3 4.1 0 6.5 1.8 6.5 5.3v1.6l-6.8.4c-8.2.5-12.6 4-12.6 10 0 5.9 4.2 9.8 10.6 9.8 4 0 7.3-1.6 9.5-4.4h.2l.6 3.8h6.9zm-8.4-11.6c-1.5 2.7-4 4.3-6.9 4.3-2.6 0-4.3-1.4-4.3-3.7 0-2.6 1.9-4 5.9-4.3l5.3-.4v4.1z" />
    </svg>
  )
}

/** Um cartão da galeria. Os dois tipos de modelo usam o mesmo desenho. */
function Cartao({
  titulo,
  resumo,
  texto,
  selo,
  aoClicar,
}: {
  titulo: string
  resumo?: string
  texto: string
  selo?: boolean
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="rounded-[12px] border border-line bg-panel px-3.5 py-3 text-left transition hover:border-primary/50 hover:bg-primary/[0.04]"
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <strong className="text-[13px] font-semibold">{titulo}</strong>
        {selo && <SeloImediato />}
      </span>
      {resumo && <span className="mt-0.5 block text-[11.5px] leading-4 text-dim">{resumo}</span>}
      {/*
        A mensagem inteira aparece no cartão, já preenchida. Escolher sem ver o
        texto seria escolher no escuro, e o texto É o produto.
      */}
      <span className="mt-2 block rounded-[8px] bg-surface px-2.5 py-2 text-[11.5px] leading-[1.5] text-muted">
        {texto}
      </span>
    </button>
  )
}

/**
 * Os casos prontos: os da Meta primeiro, depois os nossos.
 *
 * **A ordem não é vaidade.** O da Meta é aprovado quase na hora; o nosso entra
 * na fila de revisão, que pode levar 24h. Quem está criando o primeiro modelo
 * para mandar mensagem hoje quer o de cima, e só desce se nenhum servir.
 *
 * Os nossos existem porque a biblioteca dela é global e escrita para o mercado
 * americano: "your appointment is confirmed" não é como um consultório
 * brasileiro fala.
 */
function Galeria({
  daMeta,
  buscando,
  aoEscolher,
  aoEscolherDaMeta,
}: {
  daMeta: ModeloDaBiblioteca[]
  buscando: boolean
  aoEscolher: (modelo: ModeloPronto) => void
  aoEscolherDaMeta: (modelo: ModeloDaBiblioteca) => void
}) {
  return (
    <div className="space-y-4">
      {(buscando || daMeta.length > 0) && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Prontos da <LogoDaMeta />
          </p>
          {buscando ? (
            <p className="text-[12px] text-dim">Buscando…</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {daMeta.slice(0, 6).map((modelo) => (
                <Cartao
                  key={modelo.nome}
                  titulo={tituloLegivel(modelo.nome)}
                  texto={modelo.corpo}
                  selo
                  aoClicar={() => aoEscolherDaMeta(modelo)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        {/*
          O rótulo só aparece quando há os dois grupos. Sozinho, ele nomearia
          uma divisão que não existe na tela.
        */}
        {(buscando || daMeta.length > 0) && (
          <p className="mb-2 text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Escritos por nós
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {MODELOS_PRONTOS.map((modelo) => (
            <Cartao
              key={modelo.id}
              titulo={modelo.titulo}
              resumo={modelo.resumo}
              texto={previa(modelo.corpo)}
              aoClicar={() => aoEscolher(modelo)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * O nome da Meta vira título de tela.
 *
 * Ela nomeia em `snake_case` e em inglês (`appointment_reminder_2`). Mostrar o
 * cru faria a galeria parecer um dump de API ao lado dos nossos, que têm nome
 * de gente.
 */
function tituloLegivel(nome: string): string {
  const limpo = nome.replace(/_\d+$/, '').replaceAll('_', ' ').trim()
  return limpo.charAt(0).toUpperCase() + limpo.slice(1)
}

/**
 * O passo final de um modelo da Meta: confirmar, sem editar.
 *
 * Não há caixa de texto aqui de propósito. Alterar o conteúdo devolve o
 * template para a fila comum de 24h, e a pessoa que escolheu "aprovação
 * imediata" esperaria um dia sem entender por quê.
 */
function ConfirmarDaMeta({
  clienteId,
  modelo,
  aoVoltar,
  aoTerminar,
}: {
  clienteId: string
  modelo: ModeloDaBiblioteca
  aoVoltar: () => void
  aoTerminar: () => void
}) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, comecar] = useTransition()

  function criar() {
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarDaBiblioteca(clienteId, {
        nomeNaBiblioteca: modelo.nome,
        idioma: modelo.idioma,
        categoria: (modelo.categoria as Categoria) ?? 'UTILITY',
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
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Como o cliente recebe
        </span>
        <p className="rounded-[12px] bg-[#dcf8c6] px-3 py-2.5 text-[13px] leading-[1.5] whitespace-pre-wrap text-[#111b21]">
          {modelo.corpo}
        </p>
      </div>

      {modelo.botoes.length > 0 && (
        <p className="text-[11.5px] leading-5 text-muted">
          Com {modelo.botoes.length === 1 ? 'o botão' : 'os botões'}:{' '}
          {modelo.botoes.join(', ')}.
        </p>
      )}

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
          onClick={criar}
          disabled={salvando}
          className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:opacity-50"
        >
          {salvando ? 'Criando…' : 'Usar este modelo'}
        </button>
      </div>
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
