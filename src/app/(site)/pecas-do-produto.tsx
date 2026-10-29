'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useMovimentoReduzido } from './pecas-interativas'
import p from './produto.module.css'

/*
 * As peças interativas das partes que ainda não tinham uma (`/produto/[slug]`):
 * contatos e funil, e relatórios. Mesmo combinado da jornada da home: anda
 * sozinha 1 s depois de aparecer, o clique numa etapa para o automático, e
 * com movimento reduzido fica parada no fim, com tudo preenchido.
 */

const PRIMEIRA_TROCA = 1000

function useAvanco(total: number, tempo: number) {
  const [ativa, setAtiva] = useState(0)
  const [parado, setParado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const primeira = useRef(true)
  const calmo = useMovimentoReduzido()

  useEffect(() => {
    const el = raiz.current
    if (!el || calmo) return
    const o = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.35 })
    o.observe(el)
    return () => o.disconnect()
  }, [calmo])

  useEffect(() => {
    if (!visivel || parado) return
    const r = window.setTimeout(
      () => {
        primeira.current = false
        setAtiva((a) => (a + 1) % total)
      },
      primeira.current ? PRIMEIRA_TROCA : tempo,
    )
    return () => window.clearTimeout(r)
  }, [ativa, visivel, parado, total, tempo])

  const escolher = (i: number) => {
    setParado(true)
    setAtiva(i)
  }
  // Sem movimento, fica no fim, com tudo preenchido, até alguém escolher uma etapa.
  return { ativa: calmo && !parado ? total - 1 : ativa, escolher, raiz }
}

/* ───────────── contatos e funil: a conversa preenche a ficha ───────────── */

/*
 * Cada etapa é uma troca da conversa, o campo que ela preenche na ficha e a
 * etapa do funil onde o cartão fica. O fluxo é o de qualificação dos modelos
 * prontos; o cliente e os valores são de exemplo.
 */
type Passo = {
  rotulo: string
  falas: { de: 'cliente' | 'bot' | 'equipe'; texto: string }[]
  campo?: [string, string]
  etapa: number
  valor?: string
}

const PASSOS: Passo[] = [
  {
    rotulo: 'Chegou do anúncio',
    falas: [{ de: 'cliente', texto: 'Oi! Vi o anúncio do sofá retrátil' }],
    campo: ['Origem', 'Anúncio · Sofá retrátil'],
    etapa: 0,
  },
  {
    rotulo: 'Nome',
    falas: [
      { de: 'bot', texto: 'Que bom! Como posso te chamar?' },
      { de: 'cliente', texto: 'Marina Costa' },
    ],
    campo: ['Nome', 'Marina Costa'],
    etapa: 0,
  },
  {
    rotulo: 'Cidade',
    falas: [
      { de: 'bot', texto: 'Para qual cidade é a entrega?' },
      { de: 'cliente', texto: 'Curitiba' },
    ],
    campo: ['Cidade', 'Curitiba'],
    etapa: 1,
  },
  {
    rotulo: 'Interesse',
    falas: [
      { de: 'bot', texto: 'Qual tamanho você procura?' },
      { de: 'cliente', texto: 'O de 3 lugares, cinza' },
    ],
    campo: ['Interesse', 'Retrátil 3 lugares, cinza'],
    etapa: 1,
  },
  {
    rotulo: 'Equipe assume',
    falas: [{ de: 'equipe', texto: 'Oi, Marina! Aqui é a Ana. Separei o cinza para você, R$ 2.390 à vista.' }],
    campo: ['Responsável', 'Ana'],
    etapa: 2,
    valor: 'R$ 2.390',
  },
  {
    rotulo: 'Venda ganha',
    falas: [{ de: 'cliente', texto: 'Fechado! Já paguei o Pix' }],
    campo: ['Comprou', 'R$ 2.390 · Pix'],
    etapa: 3,
    valor: 'R$ 2.390',
  },
]

const ETAPAS_DO_FUNIL = ['Novo lead', 'Qualificado', 'Proposta', 'Ganho']
const CAMPOS = ['Origem', 'Nome', 'Cidade', 'Interesse', 'Responsável', 'Comprou']

export function ConversaQuePreencheAFicha() {
  const { ativa, escolher, raiz } = useAvanco(PASSOS.length, 2600)
  const feitos = PASSOS.slice(0, ativa + 1)
  const preenchidos = new Map(feitos.flatMap((passo) => (passo.campo ? [passo.campo] : [])))
  const atual = PASSOS[ativa]!
  const valor = [...feitos].reverse().find((passo) => passo.valor)?.valor

  return (
    <div ref={raiz} className={p.preenche}>
      <div className={p.preencheConversa} aria-hidden>
        <div className={p.preencheTopo}>
          <i>{preenchidos.has('Nome') ? 'MC' : '?'}</i>
          <span>
            <b>{preenchidos.get('Nome') ?? '+55 41 9····-2208'}</b>
            WhatsApp
          </span>
        </div>
        <div className={p.preencheFalas}>
          {feitos.flatMap((passo, i) =>
            passo.falas.map((f, j) => (
              <span key={`${i}-${j}`} className={p.fala} data-de={f.de} data-nova={i === ativa || undefined}>
                {f.de === 'equipe' && <small>Ana · equipe</small>}
                {f.texto}
              </span>
            )),
          )}
        </div>
      </div>

      <div className={p.preencheLado}>
        <div className={p.fichaContato}>
          <div className={p.fichaContatoTopo}>
            <strong>Ficha do contato</strong>
            <small>preenchida pela conversa</small>
          </div>
          <dl>
            {CAMPOS.map((campo) => {
              const v = preenchidos.get(campo)
              return (
                <div key={campo} data-novo={atual.campo?.[0] === campo || undefined}>
                  <dt>{campo}</dt>
                  <dd>{v ?? <span className={p.vazio} />}</dd>
                </div>
              )
            })}
          </dl>
        </div>

        <div className={p.funilMini} style={{ '--etapa': atual.etapa } as CSSProperties}>
          {ETAPAS_DO_FUNIL.map((e, i) => (
            <span key={e} data-atual={i === atual.etapa || undefined}>
              {e}
            </span>
          ))}
          <b className={p.funilCartao} data-ganho={atual.etapa === 3 || undefined}>
            Marina
            {valor && <small>{valor}</small>}
          </b>
        </div>
      </div>

      <Etapas rotulos={PASSOS.map((passo) => passo.rotulo)} ativa={ativa} escolher={escolher} />
    </div>
  )
}

function Etapas({ rotulos, ativa, escolher }: { rotulos: string[]; ativa: number; escolher: (i: number) => void }) {
  return (
    <div className={p.etapas} role="tablist" aria-label="Etapas">
      {rotulos.map((r, i) => (
        <button key={r} type="button" role="tab" aria-selected={i === ativa} data-feito={i < ativa || undefined} onClick={() => escolher(i)}>
          {r}
        </button>
      ))}
    </div>
  )
}

/* ───────────── relatórios: as três telas ───────────── */

/*
 * A aba Atendimento usa os números medidos da home (comentário de
 * `SecaoNumeros`: todas as contas, 90 dias até 28/out/2026). Vendas e
 * horários são de uma loja de exemplo, e a tela diz isso.
 */
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const HORAS = [8, 10, 12, 14, 16, 18, 20, 22]
// Movimento de uma loja de exemplo: pico no almoço e à noite, sábado forte, domingo calmo.
const CALOR = [
  [2, 3, 5, 3, 3, 5, 6, 3],
  [2, 3, 5, 3, 3, 5, 6, 2],
  [2, 3, 4, 3, 4, 6, 7, 3],
  [3, 3, 5, 4, 4, 6, 7, 3],
  [3, 4, 6, 4, 5, 7, 8, 4],
  [4, 6, 7, 5, 5, 6, 6, 3],
  [1, 2, 3, 2, 2, 4, 5, 2],
]

const ABAS: { rotulo: string; nota: string; tela: () => ReactNode }[] = [
  { rotulo: 'Atendimento', nota: 'Todas as contas, 90 dias', tela: () => <TelaAtendimento /> },
  { rotulo: 'Vendas', nota: 'Loja de exemplo, 30 dias', tela: () => <TelaVendas /> },
  { rotulo: 'Horários', nota: 'Loja de exemplo, 30 dias', tela: () => <TelaHorarios /> },
]

export function RelatoriosEmAbas() {
  const { ativa, escolher, raiz } = useAvanco(ABAS.length, 4200)
  const aba = ABAS[ativa]!
  return (
    <div ref={raiz} className={p.relatorio}>
      <div className={p.relatorioBarra}>
        <div role="tablist" aria-label="Relatórios">
          {ABAS.map((a, i) => (
            <button key={a.rotulo} type="button" role="tab" aria-selected={i === ativa} onClick={() => escolher(i)}>
              {a.rotulo}
            </button>
          ))}
        </div>
        <small>{aba.nota}</small>
      </div>
      <div key={ativa} className={p.relatorioTela}>
        {aba.tela()}
      </div>
    </div>
  )
}

function TelaAtendimento() {
  return (
    <div className={p.telaAtendimento}>
      <div className={p.rosca} style={{ '--parte': 74 } as CSSProperties}>
        <strong>74%</strong>
        <span>terminaram sem a equipe</span>
      </div>
      <dl className={p.indicadores}>
        <div>
          <dt>Resposta do chatbot</dt>
          <dd>4 s</dd>
          <small>na mediana</small>
        </div>
        <div>
          <dt>Resposta da equipe</dt>
          <dd>1 min 46 s</dd>
          <small>da ida para a equipe até a primeira resposta</small>
        </div>
        <div>
          <dt>Fora do horário comercial</dt>
          <dd>1 em 6</dd>
          <small>mensagens, respondidas pelo chatbot</small>
        </div>
      </dl>
    </div>
  )
}

function TelaVendas() {
  const produtos: [string, number][] = [
    ['Fone Over-ear', 92],
    ['Caixa de som mini', 68],
    ['Carregador rápido', 51],
    ['Capa de silicone', 34],
  ]
  return (
    <div className={p.telaVendas}>
      <dl className={p.indicadores} data-linha>
        <div>
          <dt>Ganho nos negócios</dt>
          <dd>R$ 18.420</dd>
        </div>
        <div>
          <dt>Recebido pelo chat</dt>
          <dd>R$ 9.870</dd>
        </div>
        <div>
          <dt>Ticket médio</dt>
          <dd>R$ 236</dd>
        </div>
      </dl>
      <div className={p.maisVendidos}>
        <small>Mais vendidos</small>
        {produtos.map(([nome, n], i) => (
          <span key={nome} style={{ '--n': i, '--w': `${n}%` } as CSSProperties}>
            {nome}
            <i />
            <b>{Math.round(n / 2)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function TelaHorarios() {
  return (
    <div className={p.telaHorarios}>
      <small>Quando as conversas chegam</small>
      <div className={p.calor}>
        <span />
        {HORAS.map((h) => (
          <span key={h} className={p.calorHora}>
            {h}h
          </span>
        ))}
        {CALOR.map((linha, d) => (
          <Linha key={d} dia={DIAS[d]!} linha={linha} d={d} />
        ))}
      </div>
    </div>
  )
}

function Linha({ dia, linha, d }: { dia: string; linha: number[]; d: number }) {
  return (
    <>
      <span className={p.calorDia}>{dia}</span>
      {linha.map((v, h) => (
        <i key={h} style={{ '--v': v / 8, '--n': d + h } as CSSProperties} />
      ))}
    </>
  )
}
