import QRCode from 'qrcode'
import { ITENS_DE_INTEGRACAO } from './integracoes-do-site'
import { TituloComCanal } from './titulo-com-canal'
import v from './venda-no-chat.module.css'
import s from './pagina-inicial.module.css'

/*
 * A venda fechada dentro do WhatsApp (pedido do Gabriel, 29/out: "uma das
 * coisas mais importantes"). Três passos que existem no produto: a cobrança
 * gerada no Inbox (`components/lead/botao-de-cobrar.tsx`), o link com Pix,
 * cartão ou boleto do gateway, e a confirmação do banco que muda a cobrança
 * para "Paga" sozinha (`components/inbox/cartao-da-cobranca.tsx`). Embaixo,
 * os gateways prontos, com a logo oficial de cada um. A animação é só CSS:
 * os passos acendem um depois do outro, num ciclo.
 */

const GATEWAYS = ITENS_DE_INTEGRACAO.filter((i) => i.grupo === 'pagamentos' && !i.emBreve)

export function SecaoVendaNoChat() {
  return (
    <section className={s.secao} id="venda-no-chat">
      <div className={`${s.faixa} ${s.cabecaSecao}`}>
        <span className={s.olho} data-revela>
          Venda no chat
        </span>
        <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
          A venda fecha dentro do WhatsApp
        </h2>
        <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
          A equipe gera a cobrança no Inbox, a pessoa paga pelo link sem sair da conversa, e a confirmação do banco chega
          sozinha. Pelo gateway que você já usa.
        </p>
      </div>

      <div className={v.palco} data-revela data-como="escala">
        <ol className={v.passos}>
          <li className={v.passo} style={{ '--n': 0 } as React.CSSProperties}>
            <span className={v.rotulo}>
              <i>1</i> Cobrança na conversa
            </span>
            <div className={v.cartao} aria-hidden>
              <span className={v.cartaoTopo}>
                <span>Cobrança</span>
                <span className={v.selo}>
                  <span data-estado="aguardando">Aguardando</span>
                  <span data-estado="paga">Paga</span>
                </span>
              </span>
              <b>Fone Over-ear Bluetooth</b>
              <span className={v.linha}>
                <span>1× Fone Over-ear preto</span> R$ 249,90
              </span>
              <span className={v.total}>
                <span>Total</span> R$ 249,90
              </span>
              <span className={v.acoes}>
                <span>Copiar Pix</span>
                <span>Abrir link</span>
              </span>
            </div>
          </li>

          <li className={v.passo} style={{ '--n': 1 } as React.CSSProperties}>
            <span className={v.rotulo}>
              <i>2</i> Pix, cartão ou boleto no link
            </span>
            <div className={v.celular} aria-hidden>
              <span className={v.celularTopo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos-de-exemplo/ponto-som.webp" alt="" width={22} height={22} />
                <TituloComCanal texto="WhatsApp · Ponto Som" tamanho={12} />
              </span>
              <span className={v.checkout}>
                <small>Pagamento seguro</small>
                <b>R$ 249,90</b>
                <span className={v.formas}>
                  <span data-ativa>Pix</span>
                  <span>Cartão</span>
                  <span>Boleto</span>
                </span>
                <QrDoPix />
                <span className={v.copiar}>Copiar código Pix</span>
              </span>
            </div>
          </li>

          <li className={v.passo} style={{ '--n': 2 } as React.CSSProperties}>
            <span className={v.rotulo}>
              <i>3</i> Aprovado sozinho
            </span>
            <div className={v.aprovado} aria-hidden>
              <span className={v.aviso}>
                <i>✓</i>
                <span>
                  <b>Pagamento aprovado</b>
                  Pix confirmado pelo banco · 10:45
                </span>
              </span>
              <span className={v.fala}>Pronto, paguei no Pix 🙌</span>
              <span className={v.resultado}>
                A cobrança vira <b>Paga</b> no Inbox, sem ninguém conferir extrato.
              </span>
            </div>
          </li>
        </ol>
      </div>

      <div className={`${s.faixa} ${v.gateways}`} data-revela>
        <small>Recebe pelo gateway que você já usa</small>
        <ul>
          {GATEWAYS.map((g) => (
            <li key={g.nome} title={`${g.nome}: ${g.detalhe}`}>
              {g.marca}
              {g.nome}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/*
 * Um QR de verdade, gerado no servidor com a mesma lib do app. Aponta para a
 * página de preços: quem escanear da tela cai no site, não num Pix de mentira.
 */
function QrDoPix() {
  const { modules } = QRCode.create('https://autofluxos.4yu.com.br/precos', { errorCorrectionLevel: 'M' })
  const n = modules.size
  let d = ''
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`
  return (
    <svg className={v.qr} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" aria-hidden>
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#ffffff" />
      <path d={d} fill="#0c1838" />
    </svg>
  )
}
