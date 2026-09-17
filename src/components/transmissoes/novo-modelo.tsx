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
import type { EntradaDeBotao, ModeloDaBiblioteca } from '@/channels/templates-api'
import {
  botoesIncompletos,
  pedidosDeBotao,
  telefoneParaAMeta,
  type Categoria,
} from '@/core/templates'

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
          {/*
            **A palavra, e não a marca desenhada à mão.**

            Aqui havia um SVG com a wordmark da Meta traçada por nós, e ela
            ficava torta ao lado de um rótulo em caixa alta de 11px. Copiar o
            arquivo oficial resolveria o traço e traria outro problema: marca de
            terceiro tem regra de uso, e a nossa não é um caso em que valha a
            pena carregar essa regra para dizer de onde vem um modelo.

            "Prontos da Meta", escrito, diz a mesma coisa e não tem como sair
            torto.
          */}
          <p className="mb-2 text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
            Prontos da Meta
          </p>
          {/*
            **Cartões cinzas enquanto busca, e não a palavra "Buscando…".**

            O bloco já nascia no lugar certo (o estado muda junto com o abrir, no
            mesmo lote do React), mas ele nascia com **uma linha de texto** e
            virava uma grade de até seis cartões quando a Graph respondia. Era
            isso que o dono via: *"o modal vai esticando do nada"*, segundos
            depois de abrir, com quem estava lendo o primeiro cartão perdendo o
            lugar.

            Seis retângulos do tamanho do cartão seguram a altura desde o
            primeiro quadro. Se a Meta devolver menos, o modal encolhe uma vez,
            que é bem menos incômodo do que ele crescer embaixo da mão.
          */}
          {buscando ? (
            <div className="grid gap-2 sm:grid-cols-2" aria-busy>
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="h-[74px] animate-pulse rounded-[12px] border border-line bg-surface"
                />
              ))}
            </div>
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

  /*
    Um valor por botão, na ordem da biblioteca, que é a ordem que a Meta cobra.
    Guardar por índice e não por rótulo porque dois botões podem ter o mesmo
    texto, e aí um sobrescreveria o outro em silêncio.
  */
  const pedidos = pedidosDeBotao(modelo.botoes)
  const [valores, setValores] = useState<string[]>(() => pedidos.map(() => ''))
  const faltando = botoesIncompletos(pedidos, valores)

  function criar() {
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarDaBiblioteca(clienteId, {
        nomeNaBiblioteca: modelo.nome,
        idioma: modelo.idioma,
        categoria: (modelo.categoria as Categoria) ?? 'UTILITY',
        /*
          **Sem isto a Meta recusa todo modelo da biblioteca que tenha botão**,
          com "give the same number of button inputs to match the library
          buttons". A lista vai inteira, inclusive os `QUICK_REPLY`, porque o
          que a Meta conta é um item por botão.
        */
        ...(pedidos.length > 0
          ? {
              botoes: pedidos.map((pedido, indice): EntradaDeBotao => {
                const valor = (valores[indice] ?? '').trim()

                if (pedido.tipo === 'URL') {
                  return {
                    type: 'URL',
                    url: { base_url: valor, url_suffix_example: valor },
                  }
                }

                if (pedido.tipo === 'PHONE_NUMBER') {
                  return { type: 'PHONE_NUMBER', phone_number: telefoneParaAMeta(valor) }
                }

                return { type: 'QUICK_REPLY' }
              }),
            }
          : {}),
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

      {/*
        `modelo.botoes` é objeto, não texto. O `.join()` que estava aqui
        imprimia "[object Object]" na tela para o cliente ler.
      */}
      {pedidos.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11.5px] leading-5 text-muted">
            Com {pedidos.length === 1 ? 'o botão' : 'os botões'}:{' '}
            {pedidos.map((p) => p.rotulo).join(', ')}.
          </p>

          {pedidos.map((pedido, indice) =>
            pedido.precisaDeValor ? (
              <label key={`${pedido.rotulo}-${indice}`} className="block">
                <span className="mb-1 block text-[12px] text-soft">
                  {pedido.rotulo}: {pedido.pergunta}
                </span>
                <input
                  type={pedido.tipo === 'URL' ? 'url' : 'tel'}
                  value={valores[indice] ?? ''}
                  placeholder={pedido.exemplo}
                  onChange={(e) => {
                    const proximos = [...valores]
                    proximos[indice] = e.target.value
                    setValores(proximos)
                  }}
                  className="app-field w-full text-[13px]"
                />
              </label>
            ) : null,
          )}
        </div>
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
        {/*
          Trancado enquanto falta valor de botão: mandar assim leva recusa certa
          da Meta, e gastar a viagem para descobrir o que já dava para saber aqui
          é o que fazia "aprovação imediata" virar erro em vermelho.
        */}
        <button
          type="button"
          onClick={criar}
          disabled={salvando || faltando.length > 0}
          title={
            faltando.length > 0
              ? 'Preencha o que cada botão precisa antes de criar.'
              : undefined
          }
          className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
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
