import { reaisDeCentavos } from '@/core/mensalidade-da-4yu'
import { assinaturaDaConta, faturaVencida } from '@/server/repos/faturas-da-conta'
import type { ContaDoUsuario } from '@/server/sessao'

/**
 * A porta de saída de quem foi suspenso pela mensalidade.
 *
 * Suspensa, a organização some do painel e a pessoa cai em `/contas`; sem
 * isto, o único link de pagar estaria no e-mail. Aparece só para quem
 * administra (dono e administrador): atendente não paga, e não precisa saber.
 * Leitura que falha não mostra nada: esta tela não pode quebrar por isso.
 */
export async function AvisosDeMensalidade({ contas }: { contas: ContaDoUsuario[] }) {
  const gestoras = contas.filter((conta) => conta.papel === 'owner' || conta.papel === 'admin')
  const lidos = await Promise.all(
    gestoras.map(async (conta) => {
      const assinatura = await assinaturaDaConta(conta.id).catch(() => null)
      const estado = assinatura?.estado ?? ''
      if (!['suspensa', 'pausada', 'cancelada_por_atraso'].includes(estado)) return null
      return { conta, estado, fatura: await faturaVencida(conta.id) }
    }),
  )
  const avisos = lidos.filter((aviso) => aviso !== null)
  if (avisos.length === 0) return null

  return (
    <section aria-label="Mensalidade em atraso" className="mb-8 flex flex-col gap-2">
      {avisos.map(({ conta, estado, fatura }) => (
        <div
          key={conta.id}
          role="alert"
          className="app-card flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-perigo/25 px-5 py-4"
        >
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-perigo">
              {estado === 'cancelada_por_atraso' ? `A assinatura de ${conta.nome} foi cancelada` : `${conta.nome} está suspensa`}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-5 text-muted">
              {estado === 'cancelada_por_atraso'
                ? 'Depois de 60 dias sem pagamento. Nada foi apagado: escreva para contato@4yu.com.br para retomar.'
                : `A mensalidade${fatura ? ` de ${reaisDeCentavos(fatura.valorCentavos)}` : ''} está em atraso. Os robôs continuam atendendo; o painel volta assim que o pagamento for confirmado.`}
            </p>
          </div>
          {estado !== 'cancelada_por_atraso' && fatura?.link && (
            <a href={fatura.link} target="_blank" rel="noreferrer" className="botao-primario botao-md shrink-0">
              Pagar a mensalidade
            </a>
          )}
        </div>
      ))}
    </section>
  )
}
