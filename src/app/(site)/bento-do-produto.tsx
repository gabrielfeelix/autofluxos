import type { CSSProperties, ReactNode } from 'react'
import { FilaPorSetor } from './fila-por-setor'
import b from './bento.module.css'
import { FotoDaPessoa, MiniFoto } from './pessoas-do-site'

/*
 * O bento "O que ele faz": as seis partes mais fortes do produto. Cada peça
 * tem um tratamento próprio, como nos bentos premiados (Framer, Dev.Hire,
 * Bolt, Gumroad): fundo claro, escuro, tingido ou da cor da marca; interface
 * que sai pela borda em vez de janela centralizada; número gigante no lugar de
 * tela; texto em cima ou embaixo. Toda a animação é CSS e para com movimento
 * reduzido. Fatos: `docs/FUNCIONALIDADES.md`, `a743d066` (fila por setor) e
 * `79aa74f4` (IA do atendente); 74% é o número medido da home.
 */
export function BentoDoProduto({ cabeca }: { cabeca: ReactNode }) {
  return (
    <>
      <div className={b.cabeca}>{cabeca}</div>
      <div className={b.bento}>
        <PecaFluxo />
        <PecaIA />
        <PecaInbox />
        <PecaPagamento />
        <PecaRelatorio />
        <PecaFunil />
      </div>
    </>
  )
}

function Texto({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <div className={b.texto}>
      <small className={b.indice}>{String(n).padStart(2, '0')}</small>
      <h3>{titulo}</h3>
      <p>{texto}</p>
    </div>
  )
}

function Peca({ forma, tom, atraso, children }: { forma: string; tom: string; atraso: number; children: ReactNode }) {
  return (
    <article className={b.peca} data-forma={forma} data-tom={tom} data-revela data-como="escala" data-atraso={atraso}>
      {children}
    </article>
  )
}

/* 01 · Fluxos: branco com a trama do editor; os blocos soltos, saindo pela borda. */
function PecaFluxo() {
  return (
    <Peca forma="larga" tom="claro" atraso={0}>
      <Texto n={1} titulo="Fluxos e chatbot" texto="Monte o atendimento arrastando blocos. Teste na hora e publique sem programar." />
      <CenaFluxo />
    </Peca>
  )
}

export function CenaFluxo() {
  return (
    <div className={b.canvas} aria-hidden>
      <svg className={b.fluxoFios} viewBox="0 0 640 220" preserveAspectRatio="none">
        <path d="M150 110H200" />
        <path d="M330 110H380" />
        <path d="M510 110C540 110 540 50 570 50" />
        <path d="M510 110C540 110 540 170 570 170" />
      </svg>
      <span className={b.bloco} style={{ '--n': 0, left: '2%', top: '40%' } as CSSProperties}>
        <small>Gatilho</small>
        Palavra &quot;oi&quot;
      </span>
      <span className={b.bloco} style={{ '--n': 1, left: '31%', top: '40%' } as CSSProperties}>
        <small>Mensagem</small>
        Olá, {'{nome}'}!
      </span>
      <span className={b.bloco} style={{ '--n': 2, left: '59%', top: '28%' } as CSSProperties}>
        <small>Pergunta</small>
        <span className={b.opcoes}>
          <i>Ver produtos</i>
          <i>Falar com alguém</i>
        </span>
      </span>
      <span className={b.bloco} style={{ '--n': 3, left: '89%', top: '12%' } as CSSProperties}>
        <small>IA</small>
        Catálogo
      </span>
      <span className={b.bloco} style={{ '--n': 3, left: '89%', top: '66%' } as CSSProperties}>
        <small>Equipe</small>
        Vendas
      </span>
    </div>
  )
}

/* 02 · IA: escuro, a conversa flutuando, sem janela. */
function PecaIA() {
  return (
    <Peca forma="normal" tom="escuro" atraso={70}>
      <Texto n={2} titulo="IA que conhece o seu negócio" texto="Responde pelo catálogo e pelas suas regras. Quando não sabe, chama a equipe." />
      <CenaIA />
    </Peca>
  )
}

export function CenaIA() {
  return (
    <div className={b.conversaSolta} aria-hidden>
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
  )
}

/* 03 · Inbox: tingido, a fila saindo pela borda de baixo, a aba do setor deslizando. */
function PecaInbox() {
  return (
    <Peca forma="alta" tom="tingido" atraso={140}>
      <Texto n={3} titulo="Inbox com fila por setor" texto="Vendas, suporte e financeiro no mesmo número, cada um com a sua fila." />
      <CenaInbox />
    </Peca>
  )
}

export function CenaInbox() {
  const filas = [
    [
      ['MC', 'Marina Costa', 'Dá para parcelar?', 'Ana'],
      ['JP', 'Júlia Pereira', 'Tem na cor preta?', 'espera 1 min'],
      ['TS', 'Tiago Souza', 'Entregam em Maringá?', 'Diego'],
      ['LR', 'Lucas Rocha', 'Quero o modelo maior', 'chatbot'],
      ['NB', 'Nina Barros', 'Chega até sexta?', 'Ana'],
      ['OF', 'Otávio Faria', 'Tem desconto à vista?', 'espera 4 min'],
      ['HS', 'Helena Sá', 'Qual o prazo de troca?', 'Diego'],
    ],
    [
      ['AL', 'André Lima', 'Parou de esquentar', 'Bruno'],
      ['TS', 'Tânia Silva', 'Como troco a peça?', 'espera 3 min'],
      ['PM', 'Paulo Melo', 'Manual em português?', 'chatbot'],
      ['FN', 'Fábio Nunes', 'A garantia cobre?', 'Bruno'],
      ['GR', 'Gil Ramos', 'Veio sem o cabo', 'Bruno'],
      ['DM', 'Davi Matos', 'Não liga mais', 'espera 6 min'],
      ['RC', 'Rita Cunha', 'Precisa de assistência?', 'chatbot'],
    ],
    [
      ['RS', 'Rafael Souza', 'Segue o comprovante', 'Carla'],
      ['CB', 'Carla Brito', 'Preciso da nota', 'espera 2 min'],
      ['VM', 'Vera Moura', 'Boleto venceu', 'chatbot'],
      ['EO', 'Edu Oliveira', 'Dá para dividir?', 'Carla'],
      ['IS', 'Iara Santos', 'Paguei duas vezes', 'Carla'],
      ['MP', 'Mauro Pinto', 'Quero estornar', 'espera 1 min'],
      ['LS', 'Luna Serra', 'Mudou o CNPJ', 'chatbot'],
    ],
  ]
  return <FilaPorSetor filas={filas} />
}

/* 04 · Pagamento: a cor da marca inteira, o valor em tipografia gigante e o selo que vira pago. */
function PecaPagamento() {
  return (
    <Peca forma="normal" tom="marca" atraso={210}>
      <div className={b.pagamento} aria-hidden>
        <div className={b.cobranca}>
          <small>Link de pagamento · enviado na conversa</small>
          <span className={b.cobrancaTopo}>
            <b>Pedido #1042</b>
            <span className={b.status}>
              <span className={b.aguardando}>Aguardando</span>
              <span className={b.pago}>✓ Pago</span>
            </span>
          </span>
          <span className={b.itens}>Fone Over-ear preto · entrega no sábado</span>
          <strong>R$ 268,80</strong>
          <em>Pagar com Pix ou cartão</em>
        </div>
        <div className={b.aviso}>
          <i>✓</i>
          <span>
            <b>Pagamento aprovado</b>
            Pix confirmado pelo banco · 10:45
          </span>
        </div>
      </div>
      <Texto n={4} titulo="Pagamento no chat" texto="Link ou Pix na conversa, e a confirmação do banco chega sozinha." />
    </Peca>
  )
}

/* 05 · Relatórios: branco, o número medido enorme e as barras embaixo. */
function PecaRelatorio() {
  return (
    <Peca forma="normal" tom="claro" atraso={280}>
      <CenaRelatorio />
      <Texto n={5} titulo="Relatórios" texto="Quanto o chatbot resolveu, quanto a equipe demorou e quanto vendeu pelo chat." />
    </Peca>
  )
}

export function CenaRelatorio() {
  const barras = [22, 34, 50, 70, 86, 64, 58, 78, 92, 66, 44, 28]
  return (
    <>
      <div className={b.numero} aria-hidden>
        <strong>74%</strong>
        <span>das conversas terminam sem precisar da equipe</span>
      </div>
      <div className={b.grafico} aria-hidden>
        {barras.map((h, i) => (
          <i key={i} style={{ '--h': `${h}%`, '--n': i } as CSSProperties} />
        ))}
      </div>
    </>
  )
}

/* 06 · CRM: índigo com fios, o funil saindo pela borda da direita e o cartão atravessando. */
function PecaFunil() {
  return (
    <Peca forma="larga" tom="indigo" atraso={350}>
      <Texto n={6} titulo="CRM e funil de vendas" texto="Cada negociação com etapa, valor e responsável. O cartão anda junto com a conversa." />
      <CenaFunil />
    </Peca>
  )
}

export function CenaFunil() {
  const colunas: [string, string, string[]][] = [
    ['Novo lead', 'R$ 3.120', ['André · R$ 480', 'Bia · R$ 210']],
    ['Proposta', 'R$ 5.940', ['Tiago · R$ 1.290']],
    ['Ganho', 'R$ 3.420', ['Rafael · R$ 890', 'Lia · R$ 640']],
    ['Pós-venda', 'R$ 1.980', ['Caio · R$ 320']],
  ]
  return (
    <div className={b.funil} aria-hidden>
      {colunas.map(([coluna, total, cartoes]) => (
        <div key={coluna} className={b.coluna}>
          <small>
            {coluna}
            <b>{total}</b>
          </small>
          {cartoes.map((c) => (
            <span key={c} className={b.cartaoParado}>
              <MiniFoto nome={c.split(' · ')[0]!} />
              {c}
            </span>
          ))}
        </div>
      ))}
      <span className={b.cartaoAnda}>
        <i>
          <FotoDaPessoa nome="Marina Costa" />
        </i>
        <span>
          <b>Marina Costa</b>
          R$ 268,80
        </span>
      </span>
    </div>
  )
}
