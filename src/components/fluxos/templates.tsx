'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ImportarJson } from '@/components/fluxos/importar-json'
import { acaoDuplicarFluxo } from '@/server/acoes'
import { Modal } from '@/components/design/modal'
import { EscolherCanal } from '@/components/fluxos/escolher-canal'
import { contarEtiquetas, filtrarModelos } from '@/core/flow/filtrar-modelos'
import {
  DesenhoDoTemplate,
  MiniaturaDeArquivo,
  MiniaturaDeCopia,
  MiniaturaDeTemplate,
  MiniaturaEmBranco,
} from '@/components/fluxos/desenhos'

/**
 * A galeria de templates, e o modal de criar automação que passou a usá-la.
 *
 * ---------------------------------------------------------------------------
 * Por que templates viraram tela, e não uma linha num `<select>`
 * ---------------------------------------------------------------------------
 *
 * Os modelos já existiam, escondidos num campo "Começar de" no fim do modal,
 * onde só cabe o nome. Nome sozinho não diz se o desenho serve: "Qualificar e
 * passar para alguém" e "Triagem completa" são a mesma frase para quem nunca
 * viu nenhum dos dois. O resultado prático é todo mundo criar em branco e
 * desenhar do zero um fluxo que já existia pronto.
 *
 * A galeria mostra **resumo e etiquetas**, e tem busca. Etiqueta é o que
 * responde a pergunta que a pessoa realmente tem na cabeça, "tem alguma coisa
 * de cobrança?", "e de agenda?", sem precisar ler treze cartões.
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
 * lia. Nada mudou no servidor, a decisão continua sendo dado de formulário, e
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
 * `redirect()`, o desfecho é abrir o editor da automação nova.
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
                  ? 'border-primary/50 bg-primary/[0.13] text-primary'
                  : 'border-line text-muted hover:border-strong hover:text-soft'
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

/**
 * O cartão de um template.
 *
 * O desenho vem antes do nome porque é ele que responde primeiro: a forma do
 * fluxo, leque, funil, laço, duas pistas, diz o que o template faz antes de
 * qualquer palavra. Ver `desenhos.tsx` para a regra que mantém os doze como um
 * sistema, e não como doze ícones sorteados.
 */
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
      className="group flex h-full flex-col items-start rounded-[13px] border border-line bg-panel p-3 text-left transition hover:border-primary/45 hover:bg-primary/[0.05]"
    >
      <span className="block w-full overflow-hidden rounded-[10px] opacity-90 transition group-hover:opacity-100">
        <DesenhoDoTemplate id={modelo.id} />
      </span>
      <span className="mt-2.5 text-[13px] font-bold text-soft">{modelo.nome}</span>
      <span className="mt-1 text-[11.5px] leading-[1.5] text-dim">{modelo.resumo}</span>
      <span className="mt-2.5 flex flex-wrap gap-1">
        {modelo.etiquetas.map((etiqueta) => (
          <span
            key={etiqueta}
            className="rounded-full bg-surface-strong px-2 py-0.5 text-[10px] text-muted"
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
  colunas = 2,
}: {
  modelos: readonly ModeloDeGaleria[]
  etiquetas: readonly string[]
  aoEscolher: (modelo: ModeloDeGaleria) => void
  /** Altura da lista rolável, em pixels. Sem valor, cresce com o conteúdo. */
  altura?: number
  /**
   * Quantas colunas na largura grande. Duas dentro do modal, três na aba ,
   * ponto de quebra do Tailwind é da janela, não do contentor, e três colunas
   * dentro de um modal de 820px deixariam o desenho ilegível.
   */
  colunas?: 2 | 3
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
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Limpar a busca
          </button>
          .
        </p>
      ) : (
        <div
          className={`mt-3 grid grid-cols-1 gap-2.5 overflow-y-auto pr-0.5 sm:grid-cols-2 ${
            colunas === 3 ? 'xl:grid-cols-3' : ''
          }`}
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
          que cai no esqueleto, o mesmo caminho de sempre. */}
      <input type="hidden" name="modelo" value={modelo?.id ?? ''} />

      {modelo && (
        <div className="flex items-start justify-between gap-3 rounded-[12px] border border-primary/30 bg-primary/[0.07] px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold text-soft">{modelo.nome}</span>
            <span className="mt-0.5 block text-[11px] leading-[1.45] text-dim">{modelo.resumo}</span>
          </span>
          {aoTrocarTemplate && (
            <button
              type="button"
              onClick={aoTrocarTemplate}
              className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
            >
              Trocar
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
          className="rounded-[10px] border border-line px-3.5 py-2 text-[12.5px] font-semibold text-muted transition hover:border-strong hover:text-soft"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-[10px] bg-primary px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-primary-strong"
        >
          Criar e abrir
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------- modais */

type Passo = 'como' | 'templates' | 'formulario' | 'duplicar'

/**
 * Um dos dois caminhos da primeira pergunta.
 *
 * O cartão inteiro é o botão, alvo grande, e nada de "clique aqui" dentro de
 * uma caixa que já é clicável. A miniatura ocupa o topo porque é ela que
 * responde primeiro; o texto confirma o que a imagem já disse.
 */
function EscolhaDeComeco({
  titulo,
  rodape,
  miniatura,
  aoClicar,
  children,
  desabilitado = false,
}: {
  titulo: string
  /** A linha miúda de baixo: o que vem junto, em vez de mais uma frase. */
  rodape: string
  miniatura: ReactNode
  aoClicar: () => void
  children: ReactNode
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      className="group flex flex-col rounded-[14px] border border-line bg-panel p-3 text-left transition hover:border-primary/45 hover:bg-primary/[0.045] focus-visible:border-primary/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="hidden overflow-hidden rounded-[10px] opacity-90 transition group-hover:opacity-100 sm:block">
        {miniatura}
      </span>

      <span className="block text-[14px] font-bold text-soft sm:mt-3">{titulo}</span>
      {/* Altura reservada: sem ela, uma descrição de duas linhas e outra de três
          desalinham os rodapés, e dois cartões lado a lado com linhas em
          alturas diferentes parecem dois componentes distintos. */}
      <span className="mt-1 block min-h-[52px] text-[11.5px] leading-[1.55] text-dim">
        {children}
      </span>

      <span className="mt-2.5 block border-t border-line pt-2 text-[10.5px] tracking-[0.02em] text-muted">
        {rodape}
      </span>
    </button>
  )
}

/**
 * O botão "+ Criar automação" e o diálogo com as quatro origens (A04): em
 * branco, de um modelo, de um arquivo, ou cópia de uma que já existe.
 *
 * Um caminho só para criar. O "Importar JSON" solto no cabeçalho e a aba
 * "Modelos de chatbot" eram duas portas a mais para a mesma coisa; `?aba=
 * templates` agora abre este diálogo já na galeria (`abrirEmModelos`).
 *
 * O passo `como` existe para a pessoa **ver que existem prontos** antes de
 * começar a preencher.
 */
export function NovaAutomacao({
  acao,
  modelos,
  etiquetas,
  clienteId,
  existentes,
  abrirEmModelos = false,
}: {
  acao: Acao
  modelos: readonly ModeloDeGaleria[]
  etiquetas: readonly string[]
  clienteId: string
  /** As automações da conta, para "Duplicar existente". */
  existentes: readonly { id: string; nome: string }[]
  abrirEmModelos?: boolean
}) {
  const [aberto, setAberto] = useState(abrirEmModelos)
  const [passo, setPasso] = useState<Passo>(abrirEmModelos ? 'templates' : 'como')
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
        ? 'Escolha um modelo'
        : passo === 'duplicar'
          ? 'Duplicar uma automação'
          : escolhido
          ? 'Quase lá'
          : 'Nova automação em branco'

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded-[10px] bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-primary-strong"
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
              : passo === 'duplicar'
                ? 'A cópia nasce como rascunho, desligada, e abre no editor.'
                : 'Falta só o nome e onde ela vai atender.'
        }
        largura={passo === 'templates' ? 820 : passo === 'como' ? 640 : 440}
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
              Você põe os blocos na ordem que quiser. Nasce como rascunho: só atende depois de publicar.
            </EscolhaDeComeco>

            <EscolhaDeComeco
              titulo="Usar modelo"
              rodape={`${modelos.length} prontos, todos conferidos`}
              aoClicar={() => setPasso('templates')}
              miniatura={<MiniaturaDeTemplate />}
            >
              Um desenho que já funciona: você troca os textos pelos seus. Nasce como rascunho.
            </EscolhaDeComeco>

            <ImportarJson
              clienteId={clienteId}
              renderizar={(abrirArquivo, rodando) => (
                <EscolhaDeComeco
                  titulo={rodando ? 'Importando…' : 'Importar arquivo'}
                  rodape="um .json exportado do editor"
                  aoClicar={abrirArquivo}
                  miniatura={<MiniaturaDeArquivo />}
                >
                  Traz uma automação exportada daqui. Nasce como rascunho, sem IA e sem credenciais.
                </EscolhaDeComeco>
              )}
            />

            <EscolhaDeComeco
              titulo="Duplicar existente"
              rodape={existentes.length === 1 ? '1 automação nesta conta' : `${existentes.length} automações nesta conta`}
              aoClicar={() => setPasso('duplicar')}
              miniatura={<MiniaturaDeCopia />}
              desabilitado={existentes.length === 0}
            >
              Uma cópia de uma automação sua. Nasce como rascunho, desligada.
            </EscolhaDeComeco>
          </div>
        )}

        {passo === 'duplicar' && (
          <DuplicarExistente clienteId={clienteId} existentes={existentes} aoVoltar={() => setPasso('como')} />
        )}

        {passo === 'templates' && (
          <>
            <GaleriaDeTemplates
              modelos={modelos}
              etiquetas={etiquetas}
              altura={420}
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

const semAcento = (texto: string) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * "Duplicar existente": a lista das automações da conta, com busca.
 *
 * Clicar duplica na hora e abre a cópia no editor: a cópia nasce desligada e
 * sem publicar (`acaoDuplicarFluxo`), então abrir é o próximo passo natural.
 */
function DuplicarExistente({
  clienteId,
  existentes,
  aoVoltar,
}: {
  clienteId: string
  existentes: readonly { id: string; nome: string }[]
  aoVoltar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  const [qual, setQual] = useState<string | null>(null)
  const router = useRouter()
  const termo = semAcento(busca.trim())
  const visiveis = termo ? existentes.filter((f) => semAcento(f.nome).includes(termo)) : existentes

  function duplicar(id: string) {
    setErro(null)
    setQual(id)
    comecar(async () => {
      const r = await acaoDuplicarFluxo(clienteId, id)
      if (!r.ok || !r.id) {
        setErro(r.erro ?? 'não deu para duplicar')
        return
      }
      router.push(`/clientes/${clienteId}/fluxos/${r.id}?origem=duplicado`)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busca}
        onChange={(evento) => setBusca(evento.target.value)}
        placeholder="Buscar automação pelo nome"
        aria-label="Buscar automação pelo nome"
        autoFocus
        className="app-field w-full px-[13px] py-[10px] text-[13px]"
      />
      <ul className="max-h-[300px] overflow-y-auto rounded-[10px] border border-line">
        {visiveis.length === 0 && (
          <li className="px-3 py-4 text-center text-[12px] text-dim">Nenhuma automação com esse nome</li>
        )}
        {visiveis.map((fluxo) => (
          <li key={fluxo.id} className="border-b border-line last:border-0">
            <button
              type="button"
              disabled={rodando}
              onClick={() => duplicar(fluxo.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] transition hover:bg-surface-strong disabled:opacity-60"
            >
              <span className="min-w-0 flex-1 truncate font-semibold text-soft">{fluxo.nome}</span>
              <span className="text-[11px] text-dim">
                {rodando && qual === fluxo.id ? 'duplicando…' : 'Duplicar'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {erro && (
        <p role="alert" className="text-[12px] text-perigo">
          {erro}
        </p>
      )}
      <button type="button" onClick={aoVoltar} className="self-start text-[11.5px] font-semibold text-muted hover:text-soft">
        ← voltar
      </button>
    </div>
  )
}
