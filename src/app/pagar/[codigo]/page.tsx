import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { NOME_DO_GATEWAY } from '@/channels/pagamento'
import { lerCodigoDePagar } from '@/server/link-de-pagar'
import { cobrancaParaPagar } from '@/server/repos/cobrancas'
import { CopiarPix } from './copiar-pix'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pagamento',
  // Página de cobrança de alguém não é conteúdo para busca.
  robots: { index: false, follow: false },
}

const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * A página de pagar uma cobrança (0145): o destino do botão Pagar do
 * lembrete que sai fora das 24 horas, quando o WhatsApp não deixa mandar o Pix
 * como mensagem comum.
 *
 * Mostra o que a pessoa precisa e nada mais: de quem é, o quê, quanto, até
 * quando, o QR e o copia e cola, e o link do gateway para cartão ou boleto.
 * Sem login: a chave é o código assinado no endereço. Código que não bate é
 * 404, igual a cobrança que não existe, para não confirmar que um id existe.
 */
export default async function PaginaDePagar({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const id = lerCodigoDePagar(decodeURIComponent(codigo))
  if (!id) notFound()
  const lida = await cobrancaParaPagar(id)
  if (!lida) notFound()
  const { cobranca, empresa } = lida

  const aberta = cobranca.status === 'pendente'
  const qr = aberta && cobranca.pixCopiaCola ? await QRCode.toDataURL(cobranca.pixCopiaCola, { margin: 1, width: 440 }) : null

  return (
    <main className="flex min-h-dvh items-start justify-center bg-surface px-4 py-10 sm:items-center">
      <div className="w-full max-w-[400px] rounded-[16px] border border-line bg-panel p-5 shadow-[0_10px_30px_rgba(19,25,34,0.08)] sm:p-6">
        {empresa && <p className="text-[12.5px] font-semibold text-soft">{empresa}</p>}
        <h1 className="mt-1 text-[17px] leading-snug font-bold text-ink">{cobranca.descricao}</h1>
        <p className="mt-3 text-[30px] leading-none font-bold tabular-nums text-ink">{reais(cobranca.valorCentavos)}</p>

        {cobranca.status === 'paga' ? (
          <p className="mt-4 rounded-[10px] bg-emerald-400/[0.1] px-3 py-2.5 text-[13.5px] font-semibold text-ok">
            Pagamento confirmado{cobranca.pagaEm ? ` em ${DATA.format(new Date(cobranca.pagaEm))}` : ''}. Obrigado!
          </p>
        ) : !aberta ? (
          <p className="mt-4 rounded-[10px] bg-surface-strong px-3 py-2.5 text-[13.5px] leading-5 text-soft">
            Esta cobrança não está mais aberta. Fale com {empresa || 'a empresa'} para receber uma nova.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-soft">Vence em {DATA.format(new Date(cobranca.venceEm))}</p>

            {qr && cobranca.pixCopiaCola && (
              <div className="mt-5 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code do Pix" width={220} height={220} className="rounded-[10px] border border-line bg-white p-2" />
                <p className="text-center text-[12.5px] leading-5 text-soft">
                  Abra o app do seu banco, escolha Pix e leia o QR code, ou copie o código abaixo.
                </p>
                <p className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 font-mono text-[11px] leading-4 break-all text-soft">
                  {cobranca.pixCopiaCola}
                </p>
                <CopiarPix codigo={cobranca.pixCopiaCola} />
              </div>
            )}

            {cobranca.link && (
              <a
                href={cobranca.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`${qr ? 'botao-secundario' : 'botao-primario'} botao-md mt-3 w-full`}
              >
                {qr ? 'Pagar com cartão ou boleto' : 'Pagar'}
              </a>
            )}
          </>
        )}

        <p className="mt-5 border-t border-line pt-3 text-[11.5px] leading-4 text-dim">
          Pagamento processado pelo {NOME_DO_GATEWAY[cobranca.gateway]}. O valor vai direto para {empresa || 'a empresa'}.
        </p>
      </div>
    </main>
  )
}
