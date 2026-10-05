'use client'

import { useState, type ReactNode } from 'react'
import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'
import { ehCampoTecnico } from '@/core/contatos/valor-do-campo'
import { CHAVES_DE_ORIGEM, NOME_SEM_ANUNCIO, type OrigemDoContato } from '@/core/contatos/origem'
import { acaoCorrigirNome } from '@/server/acoes'
import { acaoPreencherCampos } from '@/server/acoes-campos'
import { useAoSalvar, useEdicao } from './modo-de-edicao'

/*
 * As partes da ficha que o modo de edição abre no lugar (`modo-de-edicao.tsx`).
 * Fora dele, cada uma mostra o mesmo de antes.
 */

/** O nome no topo: o título vira campo. */
export function NomeEditavel({
  clienteId,
  contatoId,
  nome,
  children,
}: {
  clienteId: string
  contatoId: string
  nome: string | null
  children: ReactNode
}) {
  const { editando, versao } = useEdicao()
  if (!editando) return <>{children}</>
  return <CampoDoNome key={versao} clienteId={clienteId} contatoId={contatoId} nome={nome} />
}

function CampoDoNome({ clienteId, contatoId, nome }: { clienteId: string; contatoId: string; nome: string | null }) {
  const [texto, setTexto] = useState(nome ?? '')
  useAoSalvar('nome', async () => {
    if (texto.trim() === (nome ?? '').trim()) return null
    if (texto.trim() === '') return 'o nome não pode ficar vazio'
    const dados = new FormData()
    dados.set('nome', texto.trim())
    const r = await acaoCorrigirNome(clienteId, contatoId, {}, dados)
    return r.erro ?? null
  })
  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      maxLength={120}
      aria-label="Nome do contato"
      placeholder="Exemplo: Maria Souza"
      className="app-field w-full max-w-[420px] px-3 py-1.5 text-[17px] font-bold"
    />
  )
}

/**
 * As origens que a equipe escolhe à mão, para quem chegou sem anúncio. Quem
 * veio de anúncio fica travado: a origem foi medida, e trocá-la à mão
 * apagaria de qual campanha a pessoa veio.
 */
const ORIGENS_MANUAIS = ['Indicação', 'Instagram', 'Facebook', 'Google', 'Site', 'Passou na loja', 'Evento', 'Outro']

/** A linha "Origem" do cartão Informações. Mesmo desenho da `Linha` de lá. */
export function LinhaDeOrigem({
  clienteId,
  contatoId,
  origem,
}: {
  clienteId: string
  contatoId: string
  origem: OrigemDoContato | null
}) {
  const { editando, versao } = useEdicao()
  if (!editando && !origem) return null
  return (
    <div className="bg-panel px-[18px] py-[11px] sm:last:odd:col-span-2">
      <dt className="text-[10.5px] font-semibold text-dim">Origem</dt>
      <dd className="mt-1 text-[12.5px] font-semibold">
        {editando && !origem?.deAnuncio ? (
          <EscolhaDeOrigem key={versao} clienteId={clienteId} contatoId={contatoId} atual={origem} />
        ) : (
          <>
            <span className="font-semibold">{origem?.nome}</span>
            {origem?.titulo && (
              <span className="mt-0.5 block text-[11.5px] font-normal text-dim">{origem.titulo}</span>
            )}
            {editando && (
              <span className="mt-0.5 block text-[11px] font-normal text-dim">
                Medida pelo anúncio, não muda à mão.
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  )
}

function EscolhaDeOrigem({
  clienteId,
  contatoId,
  atual,
}: {
  clienteId: string
  contatoId: string
  atual: OrigemDoContato | null
}) {
  // "Direto" é como o sistema grava quem veio sem anúncio; na tela é "Por conta própria".
  const inicial = atual ? (atual.rotulo.toLowerCase() === 'direto' ? 'Direto' : atual.rotulo) : ''
  const [valor, setValor] = useState(inicial)
  const opcoes = [...new Set([...(inicial ? [inicial] : []), 'Direto', ...ORIGENS_MANUAIS])]
  useAoSalvar('origem', async () => {
    if (valor === inicial || valor === '') return null
    const r = await acaoPreencherCampos(clienteId, contatoId, { origem: valor })
    return r.ok ? null : (r.erro ?? 'não deu para salvar a origem')
  })
  return (
    <select
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      aria-label="Origem do contato"
      className="app-field w-full px-2.5 py-1.5 text-[12.5px] font-semibold"
    >
      {inicial === '' && <option value="">Escolha de onde veio</option>}
      {opcoes.map((opcao) => (
        <option key={opcao} value={opcao}>
          {opcao === 'Direto' ? NOME_SEM_ANUNCIO : opcao}
        </option>
      ))}
    </select>
  )
}

/** O que dá para editar dos dados: sem os técnicos e sem os de origem (medição). */
const DE_ORIGEM = new Set<string>(CHAVES_DE_ORIGEM)

type Linha = { chave: string; rotulo: string; valor: string; nova: boolean }

/** "Cor favorita" vira `cor_favorita`: a chave que um fluxo também escreveria. */
function chaveDe(rotulo: string): string {
  return rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Os dados da pessoa, em edição: mudar o valor, apagar (esvaziar) e adicionar.
 * **Apagar é esvaziar**: o banco mescla os campos (`gravar_campos`, `||`) e
 * não tira chave; valor vazio some da ficha.
 */
export function DadosEditaveis({
  clienteId,
  contatoId,
  campos,
  children,
}: {
  clienteId: string
  contatoId: string
  campos: [string, string][]
  children: ReactNode
}) {
  const { editando, versao } = useEdicao()
  if (!editando) return <>{children}</>
  return <EditorDeDados key={versao} clienteId={clienteId} contatoId={contatoId} campos={campos} />
}

function EditorDeDados({ clienteId, contatoId, campos }: { clienteId: string; contatoId: string; campos: [string, string][] }) {
  const originais = Object.fromEntries(campos)
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    campos
      .filter(([chave, valor]) => valor.trim() !== '' && !DE_ORIGEM.has(chave) && !ehCampoTecnico(chave, valor))
      .map(([chave, valor]) => ({ chave, rotulo: rotuloDoCampo(chave) || chave, valor, nova: false })),
  )

  useAoSalvar('dados', async () => {
    const valores: Record<string, string> = {}
    for (const linha of linhas) {
      const chave = linha.nova ? chaveDe(linha.rotulo) : linha.chave
      if (linha.nova && (chave === '' || linha.valor.trim() === '')) continue
      if (linha.nova && (chave in originais || chave in valores)) {
        return `já existe um dado chamado "${linha.rotulo.trim()}"`
      }
      if (!linha.nova && linha.valor === originais[linha.chave]) continue
      valores[chave] = linha.valor.trim()
    }
    if (Object.keys(valores).length === 0) return null
    const r = await acaoPreencherCampos(clienteId, contatoId, valores)
    if (!r.ok) return r.erro ?? 'não deu para salvar os dados'
    if (r.recusados && r.recusados.length > 0) {
      return `não entrou: ${r.recusados.map((x) => `${rotuloDoCampo(x.chave) || x.chave} (${x.motivo})`).join('; ')}`
    }
    return null
  })

  const mudar = (indice: number, mudanca: Partial<Linha>) =>
    setLinhas((atuais) => atuais.map((linha, i) => (i === indice ? { ...linha, ...mudanca } : linha)))

  return (
    <div className="flex flex-col gap-2 px-[18px] py-4">
      {linhas.length === 0 && (
        <p className="text-[12px] text-dim">Nenhum dado ainda. O fluxo preenche ao conversar, ou adicione abaixo.</p>
      )}
      {linhas.map((linha, i) => (
        <div key={linha.nova ? `nova-${i}` : linha.chave} className="flex items-center gap-2">
          {linha.nova ? (
            <input
              value={linha.rotulo}
              onChange={(e) => mudar(i, { rotulo: e.target.value })}
              aria-label="Nome do dado"
              placeholder="Exemplo: Cidade"
              maxLength={40}
              className="app-field w-[38%] shrink-0 px-3 py-2 text-[12.5px]"
            />
          ) : (
            <span className="w-[38%] shrink-0 truncate text-[12.5px] font-semibold text-muted" title={linha.rotulo}>
              {linha.rotulo}
            </span>
          )}
          <input
            value={linha.valor}
            onChange={(e) => mudar(i, { valor: e.target.value })}
            aria-label={linha.nova ? 'Valor do dado' : linha.rotulo}
            placeholder={linha.nova ? 'Exemplo: Londrina' : 'Vazio, sai da ficha'}
            maxLength={500}
            className="app-field min-w-0 flex-1 px-3 py-2 text-[12.5px]"
          />
          <button
            type="button"
            onClick={() => (linha.nova ? setLinhas((atuais) => atuais.filter((_, j) => j !== i)) : mudar(i, { valor: '' }))}
            title={linha.nova ? 'Tirar esta linha' : 'Apagar este dado'}
            aria-label={linha.nova ? 'Tirar esta linha' : `Apagar ${linha.rotulo}`}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-dim transition hover:bg-surface hover:text-perigo"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 7h14M10 7V5.2h4V7" />
              <path d="m7 7 .8 12h8.4L17 7" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLinhas((atuais) => [...atuais, { chave: '', rotulo: '', valor: '', nova: true }])}
        className="mt-1 w-full rounded-[8px] border border-dashed border-strong px-2.5 py-2 text-[12px] text-dim transition hover:border-primary/40 hover:text-primary"
      >
        + Adicionar dado
      </button>
    </div>
  )
}

/**
 * O que a equipe acrescenta sobre a pessoa além do que o canal diz: quem
 * indicou, e-mail, empresa, cidade. O canal segue travado (é por onde a
 * conversa chegou); "veio pelo WhatsApp e foi indicado pela Ana" vira
 * `indicado_por` ao lado dele.
 */
const INFORMACOES_EXTRAS: { chave: string; rotulo: string; exemplo: string }[] = [
  { chave: 'indicado_por', rotulo: 'Indicado por', exemplo: 'Exemplo: Ana Souza' },
  { chave: 'email', rotulo: 'E-mail', exemplo: 'Exemplo: maria@empresa.com.br' },
  { chave: 'empresa', rotulo: 'Empresa', exemplo: 'Exemplo: Padaria Central' },
  { chave: 'cidade', rotulo: 'Cidade', exemplo: 'Exemplo: Londrina' },
]

/** As linhas extras na grade do cartão Informações, fora da edição. */
export function InformacoesExtras({
  clienteId,
  contatoId,
  campos,
}: {
  clienteId: string
  contatoId: string
  campos: Record<string, string>
}) {
  const { editando } = useEdicao()
  if (editando) return null
  return (
    <>
      {INFORMACOES_EXTRAS.filter((extra) => (campos[extra.chave] ?? '').trim() !== '').map((extra) => (
        <div key={extra.chave} className="bg-panel px-[18px] py-[11px] sm:last:odd:col-span-2">
          <dt className="text-[10.5px] font-semibold text-dim">{extra.rotulo}</dt>
          <dd className="mt-1 break-words text-[12.5px] font-semibold">{campos[extra.chave]}</dd>
        </div>
      ))}
    </>
  )
}

/**
 * Os mesmos extras em edição, embaixo da grade: dentro dela o editor ocupava
 * a linha inteira e deixava uma célula vazia ao lado da Origem.
 */
export function ExtrasEditaveis({
  clienteId,
  contatoId,
  campos,
}: {
  clienteId: string
  contatoId: string
  campos: Record<string, string>
}) {
  const { editando, versao } = useEdicao()
  if (!editando) return null
  return <EditorDeExtras key={versao} clienteId={clienteId} contatoId={contatoId} campos={campos} />
}

function EditorDeExtras({
  clienteId,
  contatoId,
  campos,
}: {
  clienteId: string
  contatoId: string
  campos: Record<string, string>
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      INFORMACOES_EXTRAS.filter((extra) => (campos[extra.chave] ?? '').trim() !== '').map((extra) => [
        extra.chave,
        campos[extra.chave] ?? '',
      ]),
    ),
  )

  useAoSalvar('informacoes', async () => {
    const mudou: Record<string, string> = {}
    for (const [chave, valor] of Object.entries(valores)) {
      if (valor.trim() !== (campos[chave] ?? '').trim()) mudou[chave] = valor.trim()
    }
    if (Object.keys(mudou).length === 0) return null
    const r = await acaoPreencherCampos(clienteId, contatoId, mudou)
    if (!r.ok) return r.erro ?? 'não deu para salvar as informações'
    if (r.recusados && r.recusados.length > 0) {
      return `não entrou: ${r.recusados.map((x) => `${rotuloDoCampo(x.chave) || x.chave} (${x.motivo})`).join('; ')}`
    }
    return null
  })

  const abertas = INFORMACOES_EXTRAS.filter((extra) => extra.chave in valores)
  const faltam = INFORMACOES_EXTRAS.filter((extra) => !(extra.chave in valores))

  return (
    <div className="flex flex-col gap-2.5 border-t border-line px-[18px] py-[13px]">
      {abertas.map((extra) => (
        <label key={extra.chave} className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold text-dim">{extra.rotulo}</span>
          <input
            value={valores[extra.chave]}
            onChange={(e) => setValores((atuais) => ({ ...atuais, [extra.chave]: e.target.value }))}
            placeholder={extra.exemplo}
            maxLength={200}
            className="app-field w-full px-2.5 py-1.5 text-[12.5px] font-semibold"
          />
        </label>
      ))}
      {faltam.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold text-dim">Adicionar:</span>
          {faltam.map((extra) => (
            <button
              key={extra.chave}
              type="button"
              onClick={() => setValores((atuais) => ({ ...atuais, [extra.chave]: '' }))}
              className="rounded-full border border-dashed border-strong px-2.5 py-1 text-[11.5px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
            >
              + {extra.rotulo}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-dim">Outros dados, com o nome que quiser, na aba Dados e origem.</p>
    </div>
  )
}
