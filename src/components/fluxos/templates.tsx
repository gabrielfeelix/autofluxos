'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Modal } from '@/components/design/modal'
import { EscolherCanal } from '@/components/fluxos/escolher-canal'
import { contarEtiquetas, filtrarModelos } from '@/core/flow/filtrar-modelos'

/**
 * A galeria de templates, e o modal de criar automação que passou a usá-la.
 *
 * ---------------------------------------------------------------------------
 * Por que templates viraram tela, e não uma linha num `<select>`
 * ---------------------------------------------------------------------------
 *
 * Os modelos já existiam — escondidos num campo "Começar de" no fim do modal,
 * onde só cabe o nome. Nome sozinho não diz se o desenho serve: "Qualificar e
 * passar para alguém" e "Triagem completa" são a mesma frase para quem nunca
 * viu nenhum dos dois. O resultado prático é todo mundo criar em branco e
 * desenhar do zero um fluxo que já existia pronto.
 *
 * A galeria mostra **resumo e etiquetas**, e tem busca. Etiqueta é o que
 * responde a pergunta que a pessoa realmente tem na cabeça — "tem alguma coisa
 * de cobrança?", "e de agenda?" — sem precisar ler treze cartões.
 *
 * ---------------------------------------------------------------------------
 * As duas perguntas do modal
 * ---------------------------------------------------------------------------
 *
 * Primeiro **como** ela quer criar (do zero ou de um template), depois o resto.
 * A ordem importa: perguntar nome e canal antes obriga quem só queria olhar os
 * prontos a preencher formulário para chegar na lista.
 *
 * O modelo escolhido vai no mesmo campo `modelo` que o `acaoCriarFluxo` já
 * lia. Nada mudou no servidor — a decisão continua sendo dado de formulário, e
 * modelo desconhecido continua caindo no esqueleto em branco.
 */

export type ModeloDeGaleria = {
  id: string
  nome: string
  resumo: string
  etiquetas: readonly string[]
  /** Palavras que só a busca vê. Ver `core/flow/filtrar-modelos.ts`. */
  sinonimos?: readonly string[]
}

/**
 * O `acaoCriarFluxo` já ligado ao cliente. Devolve `void` porque termina em
 * `redirect()` — o desfecho é abrir o editor da automação nova.
 */
type Acao = (formData: FormData) => void | Promise<void>

/* ------------------------------------------------------------------ galeria */

function Busca({
  termo,
  aoDigitar,
  marcadas,
  aoMarcar,
  etiquetas,
  modelos,
}: {
  termo: string
  aoDigitar: (valor: string) => void
  marcadas: string[]
  aoMarcar: (etiqueta: string) => void
  etiquetas: readonly string[]
  modelos: readonly ModeloDeGaleria[]
}) {
  // Contagem sobre a lista **inteira**, não sobre a filtrada: chip que muda de
  // número a cada clique faz o filtro parecer instável.
  const chips = useMemo(() => contarEtiquetas(modelos, etiquetas), [modelos, etiquetas])

  return (
    <div>
      <input
        value={termo}
        onChange={(evento) => aoDigitar(evento.target.value)}
        placeholder="Buscar: agenda, cobrança, NPS, carrinho…"
        aria-label="Buscar template"
        className="app-field w-full px-[13px] py-[11px] text-[13.5px]"
      />

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {chips.map(({ etiqueta, quantos }) => {
          const ativa = marcadas.includes(etiqueta)
          return (
            <button
              key={etiqueta}
              type="button"
              onClick={() => aoMarcar(etiqueta)}
              aria-pressed={ativa}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                ativa
                  ? 'border-accent/50 bg-accent/[0.13] text-accent'
                  : 'border-white/[0.09] text-muted hover:border-white/25 hover:text-soft'
              }`}
            >
              {etiqueta}
              <span className="ml-1 text-[10px] font-normal opacity-60">{quantos}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CartaoDoTemplate({
  modelo,
  aoEscolher,
}: {
  modelo: ModeloDeGaleria
  aoEscolher: (modelo: ModeloDeGaleria) => void
}) {
  return (
    <button
      type="button"
      onClick={() => aoEscolher(modelo)}
      className="flex h-full flex-col items-start rounded-[13px] border border-white/[0.08] bg-white/[0.02] p-3.5 text-left transition hover:border-accent/45 hover:bg-accent/[0.05]"
    >
      <span className="text-[13px] font-bold text-soft">{modelo.nome}</span>
      <span className="mt-1 text-[11.5px] leading-[1.5] text-dim">{modelo.resumo}</span>
      <span className="mt-2.5 flex flex-wrap gap-1">
        {modelo.etiquetas.map((etiqueta) => (
          <span
            key={etiqueta}
            className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted"
          >
            {etiqueta}
          </span>
        ))}
      </span>
    </button>
  )
}

export function GaleriaDeTemplates({
  modelos,
  etiquetas,
  aoEscolher,
  altura,
}: {
  modelos: readonly ModeloDeGaleria[]
  etiquetas: readonly string[]
  aoEscolher: (modelo: ModeloDeGaleria) => void
  /** Altura da lista rolável, em pixels. Sem valor, cresce com o conteúdo. */
  altura?: number
}) {
  const [termo, setTermo] = useState('')
  const [marcadas, setMarcadas] = useState<string[]>([])

  const achados = useMemo(
    () => filtrarModelos(modelos, termo, marcadas),
    [modelos, termo, marcadas],
  )

  function alternar(etiqueta: string) {
    setMarcadas((atuais) =>
      atuais.includes(etiqueta) ? atuais.filter((e) => e !== etiqueta) : [...atuais, etiqueta],
    )
  }

  return (
    <div>
      <Busca
        termo={termo}
        aoDigitar={setTermo}
        marcadas={marcadas}
        aoMarcar={alternar}
        etiquetas={etiquetas}
        modelos={modelos}
      />

      {achados.length === 0 ? (
        <p className="mt-6 px-2 py-8 text-center text-[12.5px] text-dim">
          Nenhum template com isso.{' '}
          <button
            type="button"
            onClick={() => {
              setTermo('')
              setMarcadas([])
            }}
            className="font-semibold text-accent underline-offset-2 hover:underline"
          >
            Limpar a busca
          </button>
          .
        </p>
      ) : (
        <div
          className="mt-3 grid grid-cols-1 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-2"
          style={altura ? { maxHeight: altura } : undefined}
        >
          {achados.map((modelo) => (
            <CartaoDoTemplate key={modelo.id} modelo={modelo} aoEscolher={aoEscolher} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------- o formulário final */

function CamposDoFluxo({
  acao,
  modelo,
  aoTrocarTemplate,
  aoCancelar,
}: {
  acao: Acao
  /** `null` = automação em branco. */
  modelo: ModeloDeGaleria | null
  aoTrocarTemplate?: () => void
  aoCancelar: () => void
}) {
  return (
    <form action={acao} className="flex flex-col gap-4">
      {/* O campo que o `acaoCriarFluxo` já lia. Em branco manda string vazia,
          que cai no esqueleto — o mesmo caminho de sempre. */}
      <input type="hidden" name="modelo" value={modelo?.id ?? ''} />

      {modelo && (
        <div className="flex items-start justify-between gap-3 rounded-[12px] border border-accent/30 bg-accent/[0.07] px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-soft">{modelo.nome}</span>
            <span className="mt-0.5 block text-[11px] leading-[1.45] text-dim">{modelo.resumo}</span>
          </span>
          {aoTrocarTemplate && (
            <button
              type="button"
              onClick={aoTrocarTemplate}
              className="shrink-0 text-[11px] font-semibold text-accent hover:underline"
            >
              trocar
            </button>
          )}
        </div>
      )}

      <label>
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Nome da automação
        </span>
        <input
          name="nome"
          required
          autoFocus
          defaultValue={modelo?.nome ?? ''}
          placeholder="ex.: Atendimento comercial"
          className="app-field w-full px-[13px] py-[11px] text-[13.5px]"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
          Onde vai atender
        </span>
        <EscolherCanal />
      </div>

      <p className="text-[11.5px] leading-[1.5] text-dim">
        Nasce como rascunho, e nada atende ninguém antes de você publicar.
        {modelo
          ? ' O template é só o ponto de partida: daí em diante o desenho é seu, e mexer no template depois não mexe no que você criou.'
          : ''}
      </p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-[10px] border border-white/[0.09] px-3.5 py-2 text-[12.5px] font-semibold text-muted transition hover:border-white/25 hover:text-soft"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-[10px] bg-accent px-4 py-2 text-[12.5px] font-bold text-[#04202a] transition hover:brightness-110"
        >
          Criar e abrir
        </button>
      </div>
    </form>
  )
}

/* --------------------------------------------------------------- miniaturas */

/**
 * As duas escolhas são desenhadas com **o material do próprio produto**: um
 * pedaço do canvas do editor, com a mesma malha de pontos, os mesmos cartões de
 * bloco e a mesma seta.
 *
 * O primeiro desenho desta tela usava dois emojis (✏️ e ✨) e estava certo em
 * uma coisa só: era rápido. Emoji não é do produto — é do teclado —, e o
 * resultado parecia qualquer caixa de diálogo de qualquer lugar. Aqui a
 * miniatura **é a resposta da pergunta**: "em branco" mostra o canvas vazio,
 * "de um template" mostra três blocos já ligados. Quem nunca abriu o editor
 * entende o que vai receber antes de clicar.
 *
 * SVG e não imagem: acompanha o tema, não pesa, e as cores saem das mesmas
 * variáveis do resto da tela.
 */

const PONTOS = 'malha-de-pontos'

function Canvas({ children, id }: { children: ReactNode; id: string }) {
  return (
    <svg
      viewBox="0 0 248 116"
      aria-hidden
      className="block w-full rounded-[10px] border border-white/[0.05]"
    >
      <defs>
        <pattern id={`${PONTOS}-${id}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1" fill="rgba(255,255,255,0.085)" />
        </pattern>
      </defs>
      <rect width="248" height="116" fill="#070b11" />
      <rect width="248" height="116" fill={`url(#${PONTOS}-${id})`} />
      {children}
    </svg>
  )
}

/** Um cartão de bloco como o do desenho: faixa de cabeçalho e duas linhas. */
function BlocoMini({
  x,
  y,
  cor,
}: {
  x: number
  y: number
  /** A cor da faixa de cima, como no editor: cada tipo de bloco tem a sua. */
  cor: string
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="62" height="34" rx="6" fill="#0b1018" stroke="rgba(255,255,255,0.11)" />
      <rect width="62" height="9" rx="6" fill={cor} opacity="0.85" />
      <rect y="6" width="62" height="3" fill={cor} opacity="0.85" />
      <rect x="8" y="16" width="34" height="3" rx="1.5" fill="rgba(255,255,255,0.22)" />
      <rect x="8" y="23" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.13)" />
    </g>
  )
}

function MiniaturaEmBranco() {
  return (
    <Canvas id="branco">
      <rect
        x="93"
        y="41"
        width="62"
        height="34"
        rx="6"
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.2"
        strokeDasharray="5 4"
      />
      <path
        d="M124 52v12M118 58h12"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Canvas>
  )
}

function MiniaturaDeTemplate() {
  return (
    <Canvas id="template">
      {/* As setas primeiro, para os cartões cobrirem as pontas — é o que o
          editor faz, e é o que faz a ligação parecer entrar no bloco. */}
      <path
        d="M72 34C86 34 84 58 98 58"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        opacity="0.75"
      />
      <path
        d="M160 58C174 58 170 82 184 82"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        opacity="0.75"
      />
      <BlocoMini x={10} y={17} cor="#56d0f5" />
      <BlocoMini x={98} y={41} cor="#a78bfa" />
      <BlocoMini x={176} y={65} cor="#34d399" />
    </Canvas>
  )
}

/* ------------------------------------------------------------------- modais */

type Passo = 'como' | 'templates' | 'formulario'

/**
 * Um dos dois caminhos da primeira pergunta.
 *
 * O cartão inteiro é o botão — alvo grande, e nada de "clique aqui" dentro de
 * uma caixa que já é clicável. A miniatura ocupa o topo porque é ela que
 * responde primeiro; o texto confirma o que a imagem já disse.
 */
function EscolhaDeComeco({
  titulo,
  rodape,
  miniatura,
  aoClicar,
  children,
}: {
  titulo: string
  /** A linha miúda de baixo: o que vem junto, em vez de mais uma frase. */
  rodape: string
  miniatura: ReactNode
  aoClicar: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="group flex flex-col rounded-[14px] border border-white/[0.09] bg-white/[0.015] p-3 text-left transition hover:border-accent/45 hover:bg-accent/[0.045] focus-visible:border-accent/60 focus-visible:outline-none"
    >
      <span className="block overflow-hidden rounded-[10px] opacity-90 transition group-hover:opacity-100">
        {miniatura}
      </span>

      <span className="mt-3 block text-[14px] font-bold text-soft">{titulo}</span>
      {/* Altura reservada: sem ela, uma descrição de duas linhas e outra de três
          desalinham os rodapés, e dois cartões lado a lado com linhas em
          alturas diferentes parecem dois componentes distintos. */}
      <span className="mt-1 block min-h-[52px] text-[11.5px] leading-[1.55] text-dim">
        {children}
      </span>

      <span className="mt-2.5 block border-t border-white/[0.06] pt-2 text-[10.5px] tracking-[0.02em] text-muted">
        {rodape}
      </span>
    </button>
  )
}

/**
 * O botão "+ Criar automação" e o modal de duas perguntas.
 *
 * O passo `como` existe para a pessoa **ver que existem prontos** antes de
 * começar a preencher. Quem já sabe o que quer perde um clique; quem não sabe
 * ganha treze desenhos que não conhecia.
 */
export function NovaAutomacao({
  acao,
  modelos,
  etiquetas,
}: {
  acao: Acao
  modelos: readonly ModeloDeGaleria[]
  etiquetas: readonly string[]
}) {
  const [aberto, setAberto] = useState(false)
  const [passo, setPasso] = useState<Passo>('como')
  const [escolhido, setEscolhido] = useState<ModeloDeGaleria | null>(null)

  function abrir() {
    setPasso('como')
    setEscolhido(null)
    setAberto(true)
  }

  const titulo =
    passo === 'como'
      ? 'Nova automação'
      : passo === 'templates'
        ? 'Escolha um template'
        : escolhido
          ? 'Quase lá'
          : 'Nova automação em branco'

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded-[10px] bg-accent px-3.5 py-2 text-[12.5px] font-bold text-[#04202a] transition hover:brightness-110"
      >
        + Criar automação
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={titulo}
        descricao={
          passo === 'como'
            ? 'Como você quer começar?'
            : passo === 'templates'
              ? 'Desenhos prontos e válidos. Depois de criar, tudo é editável.'
              : 'Falta só o nome e onde ela vai atender.'
        }
        largura={passo === 'templates' ? 760 : passo === 'como' ? 620 : 440}
      >
        {passo === 'como' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EscolhaDeComeco
              titulo="Em branco"
              rodape="a tela vazia do editor"
              aoClicar={() => {
                setEscolhido(null)
                setPasso('formulario')
              }}
              miniatura={<MiniaturaEmBranco />}
            >
              Você põe os blocos na ordem que quiser, do primeiro “oi” até a saída para uma pessoa.
            </EscolhaDeComeco>

            <EscolhaDeComeco
              titulo="De um template"
              rodape={`${modelos.length} prontos, todos conferidos`}
              aoClicar={() => setPasso('templates')}
              miniatura={<MiniaturaDeTemplate />}
            >
              Um desenho que já funciona: você troca os textos pelos seus e publica.
            </EscolhaDeComeco>
          </div>
        )}

        {passo === 'templates' && (
          <>
            <GaleriaDeTemplates
              modelos={modelos}
              etiquetas={etiquetas}
              altura={340}
              aoEscolher={(modelo) => {
                setEscolhido(modelo)
                setPasso('formulario')
              }}
            />
            <button
              type="button"
              onClick={() => setPasso('como')}
              className="mt-3 text-[11.5px] font-semibold text-muted hover:text-soft"
            >
              ← voltar
            </button>
          </>
        )}

        {passo === 'formulario' && (
          <CamposDoFluxo
            acao={acao}
            modelo={escolhido}
            aoTrocarTemplate={() => setPasso('templates')}
            aoCancelar={() => setAberto(false)}
          />
        )}
      </Modal>
    </>
  )
}

/**
 * A aba Templates: a mesma galeria, sem modal na frente.
 *
 * Escolher abre só o passo final — quem entrou nesta aba já respondeu "quero um
 * template" ao clicar nela.
 */
export function AbaDeTemplates({
  acao,
  modelos,
  etiquetas,
}: {
  acao: Acao
  modelos: readonly ModeloDeGaleria[]
  etiquetas: readonly string[]
}) {
  const [escolhido, setEscolhido] = useState<ModeloDeGaleria | null>(null)

  return (
    <>
      <GaleriaDeTemplates modelos={modelos} etiquetas={etiquetas} aoEscolher={setEscolhido} />

      <Modal
        aberto={escolhido !== null}
        aoFechar={() => setEscolhido(null)}
        titulo="Quase lá"
        descricao="Falta só o nome e onde ela vai atender."
        largura={440}
      >
        {escolhido && (
          <CamposDoFluxo acao={acao} modelo={escolhido} aoCancelar={() => setEscolhido(null)} />
        )}
      </Modal>
    </>
  )
}
