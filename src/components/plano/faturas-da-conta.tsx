import type { EstadoDaFatura } from '@/channels/asaas-da-4yu'
import { reaisDeCentavos } from '@/core/mensalidade-da-4yu'
import type { FaturaDaConta } from '@/server/repos/faturas-da-conta'

/**
 * As faturas da mensalidade (0147), espelho do Asaas da 4YU.
 *
 * Pagar e ver o recibo abrem a página do Asaas, que é a mesma para os dois:
 * em aberto ela cobra, paga ela mostra o comprovante. Nada de cartão passa
 * por aqui.
 */

const ESTADO: Record<EstadoDaFatura, { rotulo: string; cor: string }> = {
  pendente: { rotulo: 'Em aberto', cor: 'bg-info/10 text-info' },
  vencida: { rotulo: 'Vencida', cor: 'bg-perigo/10 text-perigo' },
  paga: { rotulo: 'Paga', cor: 'bg-ok/10 text-ok' },
  estornada: { rotulo: 'Estornada', cor: 'bg-surface text-muted' },
  cancelada: { rotulo: 'Cancelada', cor: 'bg-surface text-dim' },
}

const data = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

export function FaturasDaConta({ faturas }: { faturas: FaturaDaConta[] }) {
  return (
    <section className="app-card p-5" aria-labelledby="titulo-faturas">
      <h2 id="titulo-faturas" className="text-[15px] font-bold tracking-[-0.01em]">
        Faturas
      </h2>
      {faturas.length === 0 ? (
        <p className="mt-2 text-[12.5px] leading-6 text-dim">
          A primeira fatura aparece aqui assim que a assinatura for criada.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {faturas.map((fatura) => {
            const estado = ESTADO[fatura.estado]
            const emAberto = fatura.estado === 'pendente' || fatura.estado === 'vencida'
            return (
              <li
                key={fatura.id}
                /*
                  Colunas fixas no desktop, para valor e selo ficarem um embaixo
                  do outro. No celular, duas linhas: o que é e quanto; o estado
                  e o que fazer.
                */
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_96px_84px_184px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-soft">
                    {fatura.tipo === 'excedente' ? 'Conversas acima da faixa' : 'Mensalidade'}
                  </p>
                  <p className="text-[11.5px] text-dim">
                    {fatura.estado === 'paga' && fatura.pagaEm
                      ? `Paga em ${new Date(fatura.pagaEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                      : `Vence em ${data(fatura.vencimento)}`}
                  </p>
                </div>
                <span className="text-right text-[13px] font-semibold tabular-nums text-soft">{reaisDeCentavos(fatura.valorCentavos)}</span>
                <span className={`justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold sm:justify-self-center ${estado.cor}`}>{estado.rotulo}</span>
                <span className="flex justify-end gap-2">
                  {fatura.notaFiscalUrl && (
                    <a href={fatura.notaFiscalUrl} target="_blank" rel="noreferrer" className="botao-secundario botao-sm">
                      Nota fiscal
                    </a>
                  )}
                  {fatura.link && (
                    <a
                      href={fatura.link}
                      target="_blank"
                      rel="noreferrer"
                      className={`${emAberto ? 'botao-primario' : 'botao-secundario'} botao-sm`}
                    >
                      {emAberto ? 'Pagar' : 'Recibo'}
                    </a>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
