import type { CSSProperties, ReactNode } from 'react'
import b from './bento.module.css'

/*
 * O bento "O que ele faz": as seis partes mais fortes do produto, cada uma
 * num cartão com palco de cor e uma tela animada em loop. Largos e estreitos
 * se alternam em zigue-zague. Toda a animação é CSS e para com movimento
 * reduzido. Fatos: `docs/FUNCIONALIDADES.md` e as features de `a743d066`
 * (fila por setor) e `79aa74f4` (IA do atendente).
 */

type Peca = { titulo: string; texto: string; cor: string; largo?: boolean; tela: ReactNode }

export function BentoDoProduto() {
  const pecas: Peca[] = [
    {
      titulo: 'Fluxos e chatbot',
      texto: 'Monte o atendimento arrastando blocos. Teste na hora e publique sem programar.',
      cor: '#1d4ed8',
      largo: true,
      tela: <TelaFluxo />,
    },
    {
      titulo: 'IA que conhece o seu negócio',
      texto: 'Responde pelo catálogo e pelas suas regras. Quando não sabe, chama a equipe.',
      cor: '#e8743b',
      tela: <TelaIA />,
    },
    {
      titulo: 'Inbox com fila por setor',
      texto: 'Vendas, suporte e financeiro no mesmo número, cada um com a sua fila.',
      cor: '#0e7490',
      tela: <TelaInbox />,
    },
    {
      titulo: 'CRM e funil de vendas',
      texto: 'Cada negociação com etapa, valor e responsável. O cartão anda junto com a conversa.',
      cor: '#2f4a8a',
      largo: true,
      tela: <TelaFunil />,
    },
    {
      titulo: 'Relatórios',
      texto: 'Quanto o chatbot resolveu, quanto a equipe demorou para responder e quanto vendeu pelo chat.',
      cor: '#334155',
      largo: true,
      tela: <TelaRelatorio />,
    },
    {
      titulo: 'Pagamento no chat',
      texto: 'Link ou Pix na conversa, e a confirmação do banco chega sozinha.',
      cor: '#0f8f6b',
      tela: <TelaPagamento />,
    },
  ]
  return (
    <div className={b.bento}>
      {pecas.map((p, i) => (
        <article
          key={p.titulo}
          className={b.peca}
          data-largo={p.largo || undefined}
          style={{ '--cor': p.cor, '--fios-x': `${-i * 230}px`, '--fios-y': `${-(i % 3) * 160}px` } as CSSProperties}
          data-revela
          data-como="escala"
          data-atraso={i * 70}
        >
          <div className={b.palco} aria-hidden>
            {p.tela}
          </div>
          <div className={b.pe}>
            <h3>{p.titulo}</h3>
            <p>{p.texto}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

/* ───────────── as telas ───────────── */

function Janela({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`${b.janela} ${className ?? ''}`}>
      <div className={b.barra}>
        <i />
        <i />
        <i />
        <span>{titulo}</span>
      </div>
      {children}
    </div>
  )
}

/** O editor: gatilho, mensagem e pergunta que abre em dois caminhos; os blocos acendem em sequência e os fios correm. */
function TelaFluxo() {
  return (
    <Janela titulo="Fluxos · Boas-vindas" className={b.janelaLarga}>
      <div className={b.fluxo}>
        <svg className={b.fluxoFios} viewBox="0 0 560 170" preserveAspectRatio="none">
          <path d="M120 85H160" />
          <path d="M280 85H320" />
          <path d="M440 85C460 85 460 40 480 40" />
          <path d="M440 85C460 85 460 130 480 130" />
        </svg>
        <span className={b.bloco} style={{ '--n': 0, left: '0%', top: '34%' } as CSSProperties}>
          <small>Gatilho</small>
          Mensagem &quot;oi&quot;
        </span>
        <span className={b.bloco} style={{ '--n': 1, left: '28.5%', top: '34%' } as CSSProperties}>
          <small>Mensagem</small>
          Olá, {'{nome}'}!
        </span>
        <span className={b.bloco} style={{ '--n': 2, left: '57%', top: '22%' } as CSSProperties}>
          <small>Pergunta</small>
          <span className={b.opcoes}>
            <i>Ver produtos</i>
            <i>Falar com alguém</i>
          </span>
        </span>
        <span className={`${b.bloco} ${b.blocoFim}`} style={{ '--n': 3, right: '0%', top: '8%' } as CSSProperties}>
          <small>IA</small>
          Catálogo
        </span>
        <span className={`${b.bloco} ${b.blocoFim}`} style={{ '--n': 3, right: '0%', top: '62%' } as CSSProperties}>
          <small>Equipe</small>
          Vendas
        </span>
      </div>
    </Janela>
  )
}

/** A IA: o cliente pergunta, ela consulta o catálogo (pontinhos) e responde com o produto. */
function TelaIA() {
  return (
    <Janela titulo="WhatsApp · Pet Amigo">
      <div className={b.conversa}>
        <span className={b.balaoCliente}>Tem ração para filhote de porte médio?</span>
        <span className={b.consultando}>
          <i />
          <i />
          <i />
          consultando o catálogo
        </span>
        <span className={b.balaoIA}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fotos-do-site/racao.webp" alt="" width={200} height={80} />
          <b>Ração Filhote Médio 10 kg</b>
          R$ 189,90 · 4 na prateleira
        </span>
      </div>
    </Janela>
  )
}

/** O Inbox: a aba do setor desliza entre Vendas, Suporte e Financeiro, e a fila troca junto. */
function TelaInbox() {
  const filas = [
    [
      ['MC', 'Marina Costa', 'Dá para parcelar?'],
      ['JP', 'Júlia Pereira', 'Tem na cor preta?'],
    ],
    [
      ['AL', 'André Lima', 'Parou de esquentar'],
      ['TS', 'Tiago Souza', 'Como troco a peça?'],
    ],
    [
      ['RS', 'Rafael Souza', 'Segue o comprovante'],
      ['CB', 'Carla Brito', 'Preciso da nota'],
    ],
  ]
  return (
    <Janela titulo="Inbox">
      <div className={b.setores}>
        <span className={b.setorAtivo} />
        <span>Vendas</span>
        <span>Suporte</span>
        <span>Financeiro</span>
      </div>
      <div className={b.filas}>
        {filas.map((fila, f) => (
          <div key={f} className={b.fila} style={{ '--f': f } as CSSProperties}>
            {fila.map(([sigla, nome, texto]) => (
              <span key={sigla} className={b.linha}>
                <i>{sigla}</i>
                <span>
                  <b>{nome}</b>
                  {texto}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </Janela>
  )
}

/** O funil: o cartão da Marina atravessa as etapas, e o total do ganho sobe quando ele chega. */
function TelaFunil() {
  return (
    <Janela titulo="Negociações · Funil comercial" className={b.janelaLarga}>
      <div className={b.funil}>
        {['Novo lead', 'Qualificado', 'Proposta', 'Ganho'].map((c, i) => (
          <div key={c} className={b.coluna}>
            <small>{c}</small>
            {i === 0 && <span className={b.cartaoParado}>André Lima · R$ 480</span>}
            {i === 2 && <span className={b.cartaoParado}>Tiago Souza · R$ 1.290</span>}
            {i === 3 && <span className={b.cartaoParado}>Rafael Souza · R$ 890</span>}
          </div>
        ))}
        <span className={b.cartaoAnda}>
          <i>MC</i>
          <span>
            <b>Marina Costa</b>
            R$ 268,80 · Ana
          </span>
        </span>
      </div>
    </Janela>
  )
}

/** Os relatórios: os números medidos e as barras de conversas por hora crescendo. */
function TelaRelatorio() {
  // Números medidos da home (comentário de `SecaoNumeros`); as barras são ilustrativas.
  const barras = [18, 30, 52, 74, 88, 70, 62, 80, 94, 66, 40, 26]
  return (
    <Janela titulo="Análise · Atendimento" className={b.janelaLarga}>
      <div className={b.relatorio}>
        <div className={b.kpis}>
          <span>
            <b>74%</b>
            sem precisar da equipe
          </span>
          <span>
            <b>4 s</b>
            resposta do chatbot
          </span>
          <span>
            <b>1 em 6</b>
            fora do horário
          </span>
        </div>
        <div className={b.grafico}>
          {barras.map((h, i) => (
            <i key={i} style={{ '--h': `${h}%`, '--n': i } as CSSProperties} />
          ))}
        </div>
      </div>
    </Janela>
  )
}

/** O pagamento: o link na conversa e o selo que vira "Pago" com a confirmação do banco. */
function TelaPagamento() {
  return (
    <Janela titulo="WhatsApp · Marina Costa">
      <div className={b.conversa}>
        <span className={b.link}>
          <small>autofluxos.4yu.com.br/pagar</small>
          <b>Pedido #1042 · R$ 268,80</b>
          Pix ou cartão em até 6x
        </span>
        <span className={b.situacao}>
          <span className={b.aguardando}>Aguardando pagamento</span>
          <span className={b.pago}>✓ Pago no Pix às 10:45</span>
        </span>
      </div>
    </Janela>
  )
}
