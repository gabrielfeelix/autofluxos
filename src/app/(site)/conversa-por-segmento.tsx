'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LogoDoCanal } from '@/components/design/selo-do-canal'
import type { CanalId } from '@/core/canais'
import s from './conversa-por-segmento.module.css'

/*
 * "Seu cliente pergunta antes de comprar", por segmento (pedido do Gabriel,
 * 28/out/2026, a partir do zipchat.ai). Cada aba é uma conversa encenada:
 * a pergunta chega, o bot digita e responde, e a conversa fecha com o
 * resultado. Os casos vêm de contas reais (loja, estúdio, delivery, clínica,
 * pós-compra), sem nome de cliente.
 */

type Passo =
  | { de: 'cliente'; texto: string }
  | { de: 'bot'; texto: string }
  | { de: 'produto'; nome: string; detalhe: string }
  | { de: 'opcoes'; opcoes: string[]; escolhida: string }
  | { de: 'toque'; texto: string }
  | { de: 'selo'; selo: string; texto: string }

type Roteiro = {
  id: string
  aba: string
  canal: CanalId
  tema: string
  legenda: string
  passos: Passo[]
}

const ROTEIROS: Roteiro[] = [
  {
    id: 'loja',
    aba: 'Loja virtual',
    canal: 'site',
    tema: 'Compatibilidade',
    legenda: 'Dúvida resolvida antes do checkout, sem fila de atendimento.',
    passos: [
      { de: 'cliente', texto: 'Esse headset funciona no PS5 e no celular?' },
      { de: 'bot', texto: 'Funciona nos dois, pelo cabo P2. No PC, use o adaptador que já vem na caixa.' },
      { de: 'produto', nome: 'Headset Gamer 7.1', detalhe: 'Em estoque · R$ 249,90' },
      { de: 'selo', selo: 'Adicionado ao carrinho', texto: 'Link do carrinho enviado. O frete calcula com o seu CEP.' },
    ],
  },
  {
    id: 'estudio',
    aba: 'Academia',
    canal: 'whatsapp',
    tema: 'Reagendamento',
    legenda: 'A vaga das 7h volta na hora para a lista de espera.',
    passos: [
      { de: 'cliente', texto: 'Não consigo ir na aula de amanhã às 7h. Dá para trocar?' },
      { de: 'bot', texto: 'Claro! Estes horários de amanhã ainda têm vaga:' },
      { de: 'opcoes', opcoes: ['12h', '18h', '19h'], escolhida: '18h' },
      { de: 'toque', texto: '18h' },
      { de: 'selo', selo: 'Aula remarcada', texto: 'Amanhã às 18h. Você recebe um lembrete duas horas antes.' },
    ],
  },
  {
    id: 'delivery',
    aba: 'Delivery',
    canal: 'instagram',
    tema: 'Pedido',
    legenda: 'Do cardápio ao pagamento sem sair da conversa.',
    passos: [
      { de: 'cliente', texto: 'Vocês entregam no Centro? Queria duas pizzas grandes.' },
      { de: 'bot', texto: 'Entregamos, sim: taxa de R$ 6 e cerca de 40 minutos. A mais pedida da casa:' },
      { de: 'produto', nome: 'Pizza grande de calabresa', detalhe: '8 fatias · R$ 54,90' },
      { de: 'selo', selo: 'Pedido montado', texto: 'Resumo e link de pagamento enviados. Pagou, vai para a cozinha.' },
    ],
  },
  {
    id: 'clinica',
    aba: 'Clínica',
    canal: 'whatsapp',
    tema: 'Agendamento',
    legenda: 'Menos faltas: a confirmação chega sozinha na véspera.',
    passos: [
      { de: 'cliente', texto: 'Ainda tem horário com a dermatologista esta semana?' },
      { de: 'bot', texto: 'Tem, sim. Estes são os próximos:' },
      { de: 'opcoes', opcoes: ['Qui, 14h30', 'Sex, 16h'], escolhida: 'Sex, 16h' },
      { de: 'toque', texto: 'Sex, 16h' },
      { de: 'selo', selo: 'Consulta marcada', texto: 'Sexta às 16h. Na véspera, chega um lembrete para confirmar presença.' },
    ],
  },
  {
    id: 'pos-compra',
    aba: 'Pós-compra',
    canal: 'whatsapp',
    tema: 'Pesquisa',
    legenda: 'Avaliação e fidelidade no mesmo toque.',
    passos: [
      { de: 'bot', texto: 'Seu pedido #10482 foi confirmado! Como foi a sua experiência de compra?' },
      { de: 'opcoes', opcoes: ['Foi ótima', 'Foi ok', 'Tive um problema'], escolhida: 'Foi ótima' },
      { de: 'toque', texto: 'Foi ótima' },
      { de: 'selo', selo: '250 pontos na conta', texto: 'Que ótimo! Seus pontos já caíram e estão prontos para a próxima compra!' },
    ],
  },
]

const NOME_DO_CANAL: Record<CanalId, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  telegram: 'Telegram',
  site: 'Chat do site',
}

/** Quanto o bot "digita" antes de cada resposta, e o respiro entre os passos. */
const DIGITANDO_MS = 950
const RESPIRO_MS = 620
/** Depois de a conversa fechar, quanto ela fica na tela antes da próxima aba. */
const LEITURA_MS = 3600

export function ConversaPorSegmento() {
  const [atual, setAtual] = useState(0)
  // Presos ao roteiro em que foram contados: trocar de aba zera os dois sem
  // precisar apagar nada.
  const [progresso, setProgresso] = useState({ id: '', mostrados: 0, digitando: false })
  const [visivel, setVisivel] = useState(false)
  // Quem clicou numa aba escolheu o que quer ler: a troca sozinha para.
  const [escolheu, setEscolheu] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const roteiro = ROTEIROS[atual]!
  const calmo = useMovimentoReduzido()

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const observador = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.35 })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    if (!visivel || calmo) return

    const relogios: number[] = []
    const em = (ms: number, fazer: () => void) => relogios.push(window.setTimeout(fazer, ms))
    const id = roteiro.id

    let t = 300
    roteiro.passos.forEach((passo, i) => {
      if (passo.de === 'bot' || passo.de === 'selo') {
        const ate = i
        em(t, () => setProgresso({ id, mostrados: ate, digitando: true }))
        t += DIGITANDO_MS
      } else if (i > 0) {
        t += passo.de === 'toque' ? RESPIRO_MS + 300 : RESPIRO_MS
      }
      em(t, () => setProgresso({ id, mostrados: i + 1, digitando: false }))
    })
    if (!escolheu) em(t + LEITURA_MS, () => setAtual((a) => (a + 1) % ROTEIROS.length))

    return () => relogios.forEach((r) => window.clearTimeout(r))
  }, [roteiro, visivel, escolheu, calmo])

  const deste = progresso.id === roteiro.id
  const mostrados = calmo ? roteiro.passos.length : deste ? progresso.mostrados : 0
  const digitando = !calmo && deste && progresso.digitando
  const passos = roteiro.passos.slice(0, mostrados)
  const tocou = passos.some((p) => p.de === 'toque')

  return (
    <div ref={raiz} className={s.demo}>
      <div className={s.abas} role="tablist" aria-label="Segmentos">
        {ROTEIROS.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={i === atual}
            aria-controls="conversa-do-segmento"
            className={s.aba}
            onClick={() => {
              setEscolheu(true)
              setAtual(i)
            }}
          >
            {r.aba}
          </button>
        ))}
      </div>

      <div id="conversa-do-segmento" role="tabpanel" aria-label={roteiro.aba} className={s.janela}>
        <div className={s.topo}>
          <span className={s.canal} data-canal={roteiro.canal}>
            <LogoDoCanal canal={roteiro.canal} tamanho={15} />
            {NOME_DO_CANAL[roteiro.canal]}
          </span>
          <span className={s.tema}>{roteiro.tema}</span>
        </div>

        <div className={s.conversa} aria-live="polite">
          {passos.map((passo, i) => (
            <Linha key={`${roteiro.id}-${i}`} passo={passo} comAvatar={comAvatar(passos, i)} tocou={tocou} />
          ))}
          {digitando && (
            <div className={`${s.linha} ${s.linhaBot}`}>
              <Avatar />
              <span className={s.digitando} aria-label="Digitando">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
        </div>

        <p className={s.legenda}>{roteiro.legenda}</p>
      </div>
    </div>
  )
}

function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia('(prefers-reduced-motion: reduce)')
      consulta.addEventListener('change', avisar)
      return () => consulta.removeEventListener('change', avisar)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

/** O avatar do bot só na primeira de uma sequência de falas dele. */
function comAvatar(passos: Passo[], i: number): boolean {
  const doBot = (p: Passo | undefined) => !!p && p.de !== 'cliente' && p.de !== 'toque'
  return doBot(passos[i]) && !doBot(passos[i - 1])
}

function Linha({ passo, comAvatar, tocou }: { passo: Passo; comAvatar: boolean; tocou: boolean }) {
  if (passo.de === 'cliente' || passo.de === 'toque') {
    return (
      <div className={`${s.linha} ${s.linhaCliente}`}>
        <p className={`${s.bolha} ${s.bolhaCliente}`}>{passo.texto}</p>
      </div>
    )
  }

  return (
    <div className={`${s.linha} ${s.linhaBot}`}>
      {comAvatar ? <Avatar /> : <span className={s.semAvatar} aria-hidden />}
      {passo.de === 'bot' && <p className={`${s.bolha} ${s.bolhaBot}`}>{passo.texto}</p>}
      {passo.de === 'produto' && (
        <div className={s.produto}>
          <span className={s.produtoFoto} aria-hidden>
            <IconeCaixa />
          </span>
          <span className={s.produtoTexto}>
            <strong>{passo.nome}</strong>
            <span>{passo.detalhe}</span>
          </span>
          <span className={s.produtoAcao} aria-hidden>
            <IconeCarrinho />
          </span>
        </div>
      )}
      {passo.de === 'opcoes' && (
        <div className={s.opcoes}>
          {passo.opcoes.map((opcao) => (
            <span key={opcao} className={s.opcao} data-escolhida={tocou && opcao === passo.escolhida ? '' : undefined}>
              {opcao}
            </span>
          ))}
        </div>
      )}
      {passo.de === 'selo' && (
        <p className={`${s.bolha} ${s.bolhaBot}`}>
          <span className={s.selo}>
            <IconeCerto />
            {passo.selo}
          </span>
          {passo.texto}
        </p>
      )}
    </div>
  )
}

function Avatar() {
  return (
    <span className={s.avatar} aria-hidden>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="12" r="2.5" />
        <path d="M8.5 7 15.5 11M8.5 17 15.5 13" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function IconeCaixa() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </svg>
  )
}

function IconeCarrinho() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </svg>
  )
}

function IconeCerto() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}
