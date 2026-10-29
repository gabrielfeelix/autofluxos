'use client'

import { useState } from 'react'
import { FotoDaPessoa } from './pessoas-do-site'
import { TituloComCanal } from './titulo-com-canal'
import s from './pagina-inicial.module.css'

/*
 * O Inbox da seção "Isto é o que a sua equipe vê": cada conversa da lista abre
 * a dela, com a ficha da pessoa ao lado (pedido do Gabriel, 29/out: "quero
 * poder clicar em outros chats"). As conversas mostram situações diferentes da
 * fila: a passagem para a equipe, o pós-venda, o agendamento pelo chatbot, o
 * orçamento esperando e a dúvida rápida resolvida sozinha.
 */

type Fala =
  | { quem: 'cliente'; texto: string }
  | { quem: 'bot' | 'pessoa'; autor: string; texto: string }
  | { quem: 'marco'; texto: string }

type Conversa = {
  nome: string
  telefone: string
  previa: string
  hora: string
  espera?: boolean
  bot?: boolean
  acao: string
  desde: string
  etiquetas: string[]
  historico: [string, string][]
  falas: Fala[]
}

const CONVERSAS: Conversa[] = [
  {
    nome: 'Marina Costa',
    telefone: '+55 44 9•••-4412',
    previa: 'Quero. Mas antes: dá pra parcelar?',
    hora: '09:42',
    espera: true,
    acao: 'Ana assumiu',
    desde: 'mar/2026',
    etiquetas: ['quer sábado', 'parcelamento', 'volta sempre'],
    historico: [
      ['Conversas', '7'],
      ['Último atendimento', '12/ago'],
      ['Atendida por', 'Ana'],
    ],
    falas: [
      { quem: 'cliente', texto: 'Oi! Vocês atendem sábado de manhã?' },
      { quem: 'bot', autor: 'AutoFluxos', texto: 'Oi, Marina! Sábado das 8h às 12h. Quer que eu veja um horário para você?' },
      { quem: 'cliente', texto: 'Quero. Mas antes: dá pra parcelar? Meu caso é meio específico…' },
      { quem: 'marco', texto: 'Passou para uma pessoa' },
      { quem: 'pessoa', autor: 'Ana · equipe', texto: 'Oi Marina, aqui é a Ana. Vi que você quer sábado. Me conta o seu caso.' },
    ],
  },
  {
    nome: 'Rafael Souza',
    telefone: '+55 41 9•••-2290',
    previa: 'Perfeito, obrigado!',
    hora: '09:31',
    acao: 'Pós-venda',
    desde: 'jun/2026',
    etiquetas: ['comprou', 'pós-venda'],
    historico: [
      ['Conversas', '3'],
      ['Último pedido', '#1038'],
      ['Atendido por', 'Diego'],
    ],
    falas: [
      { quem: 'bot', autor: 'AutoFluxos', texto: '📦 Seu pedido #1038 foi entregue hoje às 10h12. Chegou tudo certo?' },
      { quem: 'cliente', texto: 'Chegou sim, bem embalado' },
      { quem: 'bot', autor: 'AutoFluxos', texto: 'Que bom! De 0 a 10, quanto você indicaria a loja para um amigo?' },
      { quem: 'cliente', texto: '10' },
      { quem: 'bot', autor: 'AutoFluxos', texto: 'Obrigado, Rafael! Seu cupom VOLTA15 vale 15% na próxima compra.' },
      { quem: 'cliente', texto: 'Perfeito, obrigado!' },
    ],
  },
  {
    nome: 'Julia Pereira',
    telefone: '+55 11 9•••-7731',
    previa: 'Bot: confirmado para quinta às 15h',
    hora: '09:28',
    bot: true,
    acao: 'Chatbot atendendo',
    desde: 'out/2026',
    etiquetas: ['agendou', 'primeira vez'],
    historico: [
      ['Conversas', '1'],
      ['Origem', 'Anúncio'],
      ['Atendida por', 'Chatbot'],
    ],
    falas: [
      { quem: 'cliente', texto: 'Oi, vi o anúncio. Consigo marcar uma avaliação quinta à tarde?' },
      { quem: 'bot', autor: 'AutoFluxos', texto: 'Consegue sim! Tenho quinta às 15h ou às 16h30. Qual prefere?' },
      { quem: 'cliente', texto: '15h' },
      { quem: 'bot', autor: 'AutoFluxos', texto: 'Confirmado para quinta às 15h. Te mando um lembrete na véspera.' },
    ],
  },
  {
    nome: 'André Lima',
    telefone: '+55 44 9•••-1187',
    previa: 'Vocês fazem orçamento?',
    hora: '09:15',
    espera: true,
    acao: 'Esperando a equipe',
    desde: 'hoje',
    etiquetas: ['empresa', 'orçamento'],
    historico: [
      ['Conversas', '1'],
      ['Setor', 'Vendas'],
      ['Esperando há', '6 min'],
    ],
    falas: [
      { quem: 'cliente', texto: 'Bom dia. Vocês fazem orçamento para empresa?' },
      { quem: 'bot', autor: 'AutoFluxos', texto: 'Fazemos! Quantas unidades e para quando?' },
      { quem: 'cliente', texto: 'Umas 40, com nota fiscal, para o fim do mês' },
      { quem: 'marco', texto: 'Na fila de Vendas' },
    ],
  },
  {
    nome: 'Carla Ferreira',
    telefone: '+55 21 9•••-6402',
    previa: 'Bot: endereço enviado',
    hora: '08:57',
    bot: true,
    acao: 'Resolvida pelo chatbot',
    desde: 'jan/2026',
    etiquetas: ['retirada'],
    historico: [
      ['Conversas', '4'],
      ['Último pedido', '#1012'],
      ['Atendida por', 'Chatbot'],
    ],
    falas: [
      { quem: 'cliente', texto: 'Qual o endereço da loja? Quero retirar hoje' },
      { quem: 'bot', autor: 'AutoFluxos', texto: 'Rua das Palmeiras, 210, Centro. Aberto até as 19h. O seu pedido já está separado no balcão.' },
      { quem: 'cliente', texto: 'Obrigada!' },
    ],
  },
]

function IconeEnviar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function InboxClicavel() {
  const [ativa, setAtiva] = useState(0)
  const c = CONVERSAS[ativa]!
  const primeiro = c.nome.split(' ')[0]

  return (
    <div className={s.desktopCorpo}>
      <div className={s.colunaLista}>
        <div className={s.tituloColuna}>
          Conversas
          <span className={s.contadorEspera}>2 esperando</span>
        </div>

        {CONVERSAS.map((conversa, i) => (
          <div
            key={conversa.nome}
            role="button"
            tabIndex={0}
            aria-pressed={i === ativa}
            className={`${s.itemLista} ${i === ativa ? s.itemListaAtivo : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => setAtiva(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setAtiva(i)
              }
            }}
          >
            <span className={`${s.avatarLista} ${conversa.bot ? s.avatarListaBot : ''}`} aria-hidden>
              <FotoDaPessoa nome={conversa.nome} />
            </span>
            <span className={s.corpoLista}>
              <span className={s.nomeLista}>{conversa.nome}</span>
              <span className={s.previaLista}>{conversa.previa}</span>
            </span>
            {conversa.espera ? <span className={s.marcaLista} aria-hidden /> : <span className={s.horaLista}>{conversa.hora}</span>}
          </div>
        ))}
      </div>

      <div className={s.colunaThread}>
        <div className={s.threadTopo}>
          <span className={s.avatarLista} aria-hidden>
            <FotoDaPessoa nome={c.nome} />
          </span>
          <span>
            <span className={s.threadNome}>{c.nome}</span>
            <span className={s.threadSub}>
              <TituloComCanal texto={`WhatsApp · ${c.telefone}`} tamanho={12} />
            </span>
          </span>
          <span className={s.threadAcao}>{c.acao}</span>
        </div>

        {/* A chave troca com a conversa: os balões entram de novo em cascata. */}
        <div key={ativa} className={s.threadCorpo}>
          {c.falas.map((fala, i) => {
            const estilo = { animationDelay: `${150 + i * 300}ms` }
            if (fala.quem === 'marco')
              return (
                <span key={i} className={s.marcoHandoff} style={estilo}>
                  <span className={s.pontoVivo} aria-hidden />
                  {fala.texto}
                </span>
              )
            const classe = fala.quem === 'cliente' ? s.balaoCliente : fala.quem === 'bot' ? s.balaoBot : s.balaoPessoa
            return (
              <div key={i} className={`${s.balao} ${classe}`} style={estilo}>
                {fala.quem !== 'cliente' && (
                  <span className={`${s.autor} ${fala.quem === 'bot' ? s.autorBot : s.autorPessoa}`}>{fala.autor}</span>
                )}
                {fala.texto}
              </div>
            )
          })}
        </div>

        <div className={s.threadRodape} aria-hidden>
          <span className={s.campoFalso}>Escreva para {primeiro}…</span>
          <span className={s.botaoEnviar}>
            <IconeEnviar />
          </span>
        </div>
      </div>

      <div className={s.colunaFicha}>
        <div className={s.fichaCabeca}>
          <span className={s.fichaAvatarGrande} aria-hidden>
            <FotoDaPessoa nome={c.nome} />
          </span>
          <span>
            <span className={s.threadNome}>{c.nome}</span>
            <span className={s.threadSub}>cliente desde {c.desde}</span>
          </span>
        </div>

        <div className={s.blocoFicha}>
          <span className={s.rotuloFicha}>Etiquetas</span>
          <div className={s.fichaEtiquetas}>
            {c.etiquetas.map((e) => (
              <span key={e} className={s.etiqueta}>
                {e}
              </span>
            ))}
          </div>
        </div>

        <div className={s.blocoFicha}>
          <span className={s.rotuloFicha}>Histórico</span>
          {c.historico.map(([rotulo, valor]) => (
            <span key={rotulo} className={s.linhaFicha}>
              <span>{rotulo}</span>
              <span>{valor}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
