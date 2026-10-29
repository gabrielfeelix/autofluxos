import type { CSSProperties, ReactNode } from 'react'
import { TituloComCanal } from './titulo-com-canal'
import { GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import type { NichoDoSite } from './nichos-do-site'
import m from './modulos.module.css'
import s from './pagina-inicial.module.css'

/*
 * O que só um ramo tem. Cada página de ramo divide a base (capa, dores, IA,
 * modelos, menu, FAQ, preço, integrações), e aqui mora a personalidade: um
 * módulo próprio, com layout próprio, e a janela da capa trocada por uma do
 * ramo. Fatos: agenda via Verandi; pedido com etapas novo, pago, em preparo,
 * saiu e entregue e aviso a cada uma (`core/modelos-do-pedido.ts`); relatório
 * de aulas (presença, experimental, reposições, mensalidades); loja com
 * estoque, frete e carrinho abandonado; catálogo por planilha e áudio
 * transcrito. Os números nas telas são exemplo, como em toda ilustração.
 */

const Zap = ({ tamanho = 12 }: { tamanho?: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="#25d366" aria-hidden>
    <path d={GLIFO_WHATSAPP} />
  </svg>
)

function Cabeca({ olho, titulo, texto }: { olho: string; titulo: string; texto: string }) {
  return (
    <div className={s.cabecaSecao}>
      <span className={s.olho} data-revela>
        {olho}
      </span>
      <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
        {titulo}
      </h2>
      <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
        {texto}
      </p>
    </div>
  )
}

function Janela({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={`${m.janela} ${className ?? ''}`}>
      <div className={m.barra}>
        <i />
        <i />
        <i />
        <span>
          <TituloComCanal texto={titulo} />
        </span>
      </div>
      {children}
    </div>
  )
}

/* ═══════════ a janela da capa, uma por ramo ═══════════ */

export function JanelaDaCapa({ nicho }: { nicho: NichoDoSite }) {
  if (nicho.slug === 'aulas-e-horarios')
    return (
      <Janela titulo="Agenda · hoje">
        <ul className={m.lista}>
          {[
            ['07:00', 'Pilates solo', '8/8', true],
            ['12:15', 'Funcional', '5/10', false],
            ['19:00', 'Pilates aparelho', '6/6', true],
          ].map(([hora, aula, vagas, cheia]) => (
            <li key={hora as string}>
              <b>{hora}</b>
              <span>{aula}</span>
              <em data-cheia={cheia || undefined}>{vagas}</em>
            </li>
          ))}
        </ul>
      </Janela>
    )
  if (nicho.slug === 'loja-virtual')
    return (
      <Janela titulo="Loja · Magento">
        <div className={m.estoque}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fotos-do-site/fone.webp" alt="" width={56} height={56} />
          <span>
            <b>Fone Over-ear preto</b>
            R$ 249,90
          </span>
          <em>
            <i className={m.contador}>
              <span>7</span>
              <span>6</span>
            </i>{' '}
            em estoque
          </em>
        </div>
      </Janela>
    )
  if (nicho.slug === 'restaurantes-e-delivery')
    return (
      <Janela titulo="Pedidos · cozinha">
        <div className={m.ticketCapa}>
          <span className={m.ticketTopo}>
            <b>#128</b> Marina · entrega
            <em>Em preparo</em>
          </span>
          <span>1x Pizza margherita</span>
          <span>1x Refrigerante 2L</span>
          <span className={m.ticketTotal}>
            Total <b>R$ 66,00</b>
          </span>
        </div>
      </Janela>
    )
  return (
    <Janela titulo="Separados para retirar">
      <ul className={m.lista}>
        {[
          ['Ração Golden 15 kg', 'Pago', true],
          ['Coleira M azul', 'Aguardando', false],
          ['Petisco dental', 'Pago', true],
        ].map(([item, situacao, pago]) => (
          <li key={item as string}>
            <span>{item}</span>
            <em data-pago={pago || undefined}>{situacao}</em>
          </li>
        ))}
      </ul>
    </Janela>
  )
}

/* ═══════════ o módulo próprio de cada ramo ═══════════ */

export function ModuloDoRamo({ nicho }: { nicho: NichoDoSite }) {
  if (nicho.slug === 'aulas-e-horarios') return <ModuloAulas />
  if (nicho.slug === 'loja-virtual') return <ModuloLoja />
  if (nicho.slug === 'restaurantes-e-delivery') return <ModuloRestaurante />
  return <ModuloComercio />
}

/* ── aulas: a semana do estúdio ── */

function ModuloAulas() {
  const dias = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
  const horas = ['07:00', '12:15', '18:00', '19:00']
  // Lotação de exemplo: [ocupadas, total]; as marcadas com * acabaram de chegar pelo WhatsApp.
  const grade: [number, number, boolean][][] = [
    [[8, 8, false], [5, 8, true], [8, 8, false], [6, 8, false], [7, 8, true]],
    [[4, 10, false], [6, 10, false], [3, 10, true], [5, 10, false], [2, 10, false]],
    [[6, 6, false], [6, 6, false], [5, 6, true], [6, 6, false], [4, 6, false]],
    [[6, 6, false], [5, 6, false], [6, 6, false], [4, 6, true], [6, 6, false]],
  ]
  return (
    <section className={s.secao}>
      <div className={`${s.faixa} ${s.faixaLarga}`}>
        <Cabeca
          olho="Só para quem dá aula"
          titulo="A semana do estúdio, preenchida pelo WhatsApp"
          texto="Cada reserva, remarcação e reposição feita na conversa cai direto na agenda. A turma lotada aparece na hora."
        />
        <div className={m.aulas}>
          <Janela titulo="Agenda · semana" className={m.janelaAgenda}>
            <div className={m.agenda}>
              <span />
              {dias.map((d) => (
                <b key={d}>{d}</b>
              ))}
              {horas.map((h, l) => (
                <div key={h} className={m.agendaLinha}>
                  <small>{h}</small>
                  {grade[l]!.map(([ocupadas, total, nova], c) => (
                    <span
                      key={c}
                      className={m.vaga}
                      data-cheia={ocupadas === total || undefined}
                      data-nova={nova || undefined}
                      style={{ '--o': ocupadas / total, '--n': l * 5 + c } as CSSProperties}
                    >
                      <i />
                      {ocupadas}/{total}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className={m.legenda}>
              <span data-nova /> Reserva que acabou de chegar pelo WhatsApp
              <span data-cheia /> Turma lotada
            </p>
          </Janela>

          <div className={m.coluna}>
            <Janela titulo="WhatsApp · reposição">
              <div className={m.conversa}>
                <span className={m.ela}>Faltei ontem, consigo repor?</span>
                <span className={m.nos}>
                  Consegue! Tenho estas vagas de reposição:
                  <span className={m.botoes}>
                    <i>Qua 18:00</i>
                    <i>Qui 19:00</i>
                  </span>
                </span>
                <span className={m.ela}>Qua 18:00</span>
                <span className={m.nos}>Reposição marcada ✓</span>
              </div>
            </Janela>
            <div className={m.mensalidades}>
              <small>Mensalidades · este mês</small>
              <div>
                <span>
                  <b>42</b>em dia
                </span>
                <span>
                  <b>5</b>novas
                </span>
                <span data-alerta>
                  <b>3</b>atrasadas
                </span>
              </div>
              <i className={m.barraMensal}>
                <i style={{ width: '84%' }} />
              </i>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── loja: a loja dentro do WhatsApp ── */

function ModuloLoja() {
  return (
    <section className={s.secao}>
      <div className={`${s.faixa} ${s.faixaLarga}`}>
        <Cabeca
          olho="Só para loja virtual"
          titulo="A sua loja dentro do WhatsApp, sincronizada"
          texto="O chatbot lê a loja de verdade: estoque, preço e frete do CEP do cliente. E chama de volta quem deixou o carrinho."
        />
        <div className={m.loja}>
          <article className={m.etapaLoja}>
            <small>01 · Conecta</small>
            <h3>A loja entra pelo menu Loja</h3>
            <div className={m.lojas}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marcas-de-loja/magento.svg" alt="Magento" width={40} height={40} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marcas-de-loja/nuvemshop.png" alt="Nuvemshop" width={40} height={40} />
            </div>
            <ul className={m.sincroniza}>
              <li>Produtos com foto e preço</li>
              <li>Estoque por variação</li>
              <li>Pedidos, cupons e rastreio no Magento</li>
            </ul>
          </article>

          <article className={m.etapaLoja}>
            <small>02 · Mostra e calcula</small>
            <h3>Estoque real e frete do CEP</h3>
            <div className={m.frete}>
              <span className={m.cep}>
                CEP <b>87020-000</b>
              </span>
              <span className={m.opcaoFrete}>
                Transportadora <b>R$ 18,90</b>
                <small>chega quinta</small>
              </span>
              <span className={m.opcaoFrete}>
                Expresso <b>R$ 29,90</b>
                <small>chega amanhã</small>
              </span>
            </div>
            <p>No Magento, o frete sai da própria loja, com transportadora e prazo.</p>
          </article>

          <article className={m.etapaLoja}>
            <small>03 · Recupera</small>
            <h3>O carrinho que voltou</h3>
            <ol className={m.linhaDoTempo}>
              <li>
                <b>14:02</b> Deixou o fone no carrinho
              </li>
              <li>
                <b>15:02</b> <Zap /> Lembrete com o produto
              </li>
              <li data-ok>
                <b>15:20</b> Comprou ✓
              </li>
            </ol>
            <p>O modelo de carrinho abandonado chama o cliente de volta com o produto.</p>
          </article>
        </div>
      </div>
    </section>
  )
}

/* ── restaurante: o quadro da cozinha ── */

function ModuloRestaurante() {
  const colunas = ['Novo', 'Pago', 'Em preparo', 'Saiu', 'Entregue']
  const tickets = [
    { n: '#131', quem: 'Rafael', itens: '2x Burger da casa', total: 'R$ 76,00', col: 0, origem: 'WhatsApp' },
    { n: '#130', quem: 'Júlia', itens: '1x Pizza calabresa', total: 'R$ 58,00', col: 1, origem: 'Goomer' },
    { n: '#127', quem: 'Tiago', itens: '1x Marmita fit', total: 'R$ 32,00', col: 3, origem: 'WhatsApp' },
    { n: '#125', quem: 'Lia', itens: '3x Esfiha', total: 'R$ 27,00', col: 4, origem: 'WhatsApp' },
  ]
  // Mapa de calor ilustrativo: pedidos por hora no fim de semana.
  const pico = [1, 1, 2, 3, 5, 8, 10, 9, 6, 3]
  return (
    <section className={`${s.secao} ${m.secaoCozinha}`}>
      <div className={`${s.faixa} ${s.faixaLarga}`}>
        <Cabeca
          olho="Só para restaurante e delivery"
          titulo="O quadro da cozinha, e o cliente avisado a cada etapa"
          texto="Pedido do WhatsApp, do Goomer, do Cardápio Web ou do OlaClick no mesmo quadro. Arrastou o cartão, o cliente recebe o aviso."
        />
        <div className={m.cozinha}>
          {colunas.map((c, i) => (
            <div key={c} className={m.colunaCozinha} data-coluna={i}>
              <small>{c}</small>
              {tickets
                .filter((t) => t.col === i)
                .map((t) => (
                  <span key={t.n} className={m.ticket}>
                    <span className={m.ticketTopo}>
                      <b>{t.n}</b> {t.quem}
                      <em>{t.origem === 'WhatsApp' ? <Zap /> : t.origem}</em>
                    </span>
                    <span>{t.itens}</span>
                    <span className={m.ticketTotal}>
                      <b>{t.total}</b>
                    </span>
                  </span>
                ))}
            </div>
          ))}
          {/* O pedido da Marina atravessando o quadro, com o aviso que sai a cada etapa. */}
          <span className={m.ticketAnda}>
            <span className={m.ticketTopo}>
              <b>#128</b> Marina
              <em>
                <Zap />
              </em>
            </span>
            <span>1x Pizza margherita</span>
            <span className={m.ticketTotal}>
              <b>R$ 66,00</b>
            </span>
            <span className={m.avisoAnda}>
              <Zap tamanho={10} /> aviso enviado
            </span>
          </span>
        </div>

        <div className={m.cozinhaPe}>
          <div className={m.entregador}>
            <small>Link do entregador</small>
            <b>#127 · Tiago</b>
            <span>Rua das Palmeiras, 410 · ap 32</span>
            <span className={m.botoesEntregador}>
              <i>Saí para entregar</i>
              <i data-ok>Entreguei</i>
            </span>
            <p>O motoboy abre no celular, sem conta, e o cliente recebe cada etapa.</p>
          </div>
          <div className={m.pico}>
            <small>Quando chegam os pedidos · sábado</small>
            <div className={m.picoBarras}>
              {pico.map((v, i) => (
                <i key={i} style={{ '--v': v / 10 } as CSSProperties}>
                  <span>{`${18 + Math.floor(i / 2)}h${i % 2 ? '30' : ''}`}</span>
                </i>
              ))}
            </div>
            <p>O relatório mostra o dia e a hora de cada pedido, para reforçar a cozinha no pico.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── comércio: do caderno ao catálogo ── */

function ModuloComercio() {
  const linhas = [
    ['Ração Golden 15 kg', 'R$ 189,90', '4'],
    ['Coleira M azul', 'R$ 39,90', '12'],
    ['Petisco dental', 'R$ 24,90', '30'],
    ['Cama pet G', 'R$ 159,00', '2'],
  ]
  return (
    <section className={s.secao}>
      <div className={`${s.faixa} ${s.faixaLarga}`}>
        <Cabeca
          olho="Só para comércio e serviços"
          titulo="Do caderno ao catálogo, e do áudio ao orçamento"
          texto="A lista de produtos vira catálogo por planilha, o chatbot responde 'vocês têm?' com foto e preço, e o áudio do cliente vira texto."
        />
        <div className={m.comercio}>
          <div className={m.planilhaCatalogo}>
            <Janela titulo="produtos.xlsx">
              <div className={m.planilha}>
                <b>Produto</b>
                <b>Preço</b>
                <b>Estoque</b>
                {linhas.map(([p, preco, qtd], i) => (
                  <div key={p} className={m.planilhaLinha} style={{ '--n': i } as CSSProperties}>
                    <span>{p}</span>
                    <span>{preco}</span>
                    <span>{qtd}</span>
                  </div>
                ))}
              </div>
            </Janela>
            <span className={m.seta} aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
            <div className={m.catalogo}>
              {linhas.slice(0, 3).map(([p, preco], i) => (
                <span key={p} className={m.produto} style={{ '--n': i } as CSSProperties}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i === 0 && <img src="/fotos-do-site/racao.webp" alt="" width={120} height={70} />}
                  {i > 0 && (
                    <i className={m.fotoVazia}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
                        <circle cx="8" cy="8" r="1.5" />
                      </svg>
                    </i>
                  )}
                  <b>{p}</b>
                  {preco}
                </span>
              ))}
            </div>
          </div>

          <div className={m.audioOrcamento}>
            <Janela titulo="WhatsApp · orçamento">
              <div className={m.conversa}>
                <span className={m.audio}>
                  <i className={m.play} />
                  <span className={m.onda}>
                    {[30, 60, 85, 45, 95, 60, 35, 70, 90, 50, 30, 65, 80, 40, 25].map((h, i) => (
                      <i key={i} style={{ height: `${h}%` }} />
                    ))}
                  </span>
                  0:12
                </span>
                <span className={m.transcricao}>
                  <small>Transcrição</small>
                  Queria saber quanto fica a ração de 15 kg e se tem a coleira M azul pra retirar hoje.
                </span>
                <span className={m.nos}>
                  Ração Golden 15 kg: R$ 189,90. Coleira M azul: R$ 39,90. Separo as duas para você retirar hoje?
                  <span className={m.botoes}>
                    <i>Separar para hoje</i>
                  </span>
                </span>
              </div>
            </Janela>
          </div>
        </div>
      </div>
    </section>
  )
}
