import { telefoneLegivel } from '@/core/contatos/telefone'
import { diaPorExtenso, reais } from '@/core/contrato-do-plano'
import {
  emReais,
  FRANQUIA_DE_SERVICO,
  INICIO_DA_COBRANCA,
  TARIFA_DE_SERVICO_BR,
  TARIFA_DO_MODELO_BR,
  type FranquiaDoNumero,
  type GastoDoPeriodo,
} from '@/core/franquia-da-meta'

// Três casas: `reais()` arredondaria R$ 0,035 para R$ 0,04.
const TARIFA = `R$ ${TARIFA_DE_SERVICO_BR.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}`

/**
 * As 1.000 mensagens de serviço grátis por número, que a Meta passa a contar
 * em 1º/out/2026 (ver `core/franquia-da-meta.ts`).
 *
 * Mora dentro do cartão de consumo, abaixo das conversas, porque é consumo do
 * mesmo mês, e a pessoa não precisa saber que a fonte é outra. A diferença que
 * importa está dita: esta conta é da Meta, não do plano.
 */
export function FranquiaDaMeta({ numeros, mes, gasto = null }: { numeros: FranquiaDoNumero[]; mes: string; gasto?: GastoDoPeriodo | null }) {
  const valendo = mes >= INICIO_DA_COBRANCA
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[12.5px] font-semibold text-soft">Gasto na conta da Meta</p>
        <span className="text-[11.5px] text-dim">atualiza uma vez por dia</span>
      </div>

      {gasto && <GastoPorTipo gasto={gasto} />}

      <p className="mt-4 text-[12px] font-semibold text-soft">Respostas grátis, por número</p>

      {numeros.length === 0 ? (
        <p className="mt-1 text-[12px] leading-6 text-dim">
          Nenhuma resposta deste mês na última leitura. A Meta fecha a contagem
          com atraso e lemos de madrugada: o que foi enviado hoje aparece amanhã.
          Cada número tem {FRANQUIA_DE_SERVICO.toLocaleString('pt-BR')} respostas
          grátis por mês.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {numeros.map((n) => (
            <Numero key={n.telefone} numero={n} />
          ))}
        </ul>
      )}

      <p className="mt-2 text-[12px] leading-6 text-dim">
        Cada tipo tem preço próprio: marketing {emReais(TARIFA_DO_MODELO_BR.MARKETING)} por mensagem desde a primeira,
        utilidade e autenticação {emReais(TARIFA_DO_MODELO_BR.UTILITY)}.{' '}
        {!valendo
          ? `A partir de ${diaPorExtenso(INICIO_DA_COBRANCA)}, responder dentro de 24h passa a contar: ${FRANQUIA_DE_SERVICO.toLocaleString('pt-BR')} grátis por número no mês, e ${TARIFA} por resposta depois disso, cobrados pela Meta.`
          : `Responder dentro de 24h conta ${FRANQUIA_DE_SERVICO.toLocaleString('pt-BR')} grátis por número no mês. Depois, a Meta cobra ${TARIFA} por resposta.`}
      </p>
    </div>
  )
}

function Numero({ numero }: { numero: FranquiaDoNumero }) {
  const { usadas, restantes, excedentes, custoEstimado, nivel, valendo } = numero
  const cor = nivel === 'estourou' ? 'bg-perigo' : nivel === 'perto' ? 'bg-aviso' : 'bg-primary'
  const corDoTexto = nivel === 'estourou' ? 'text-perigo' : nivel === 'perto' ? 'text-aviso' : 'text-dim'

  let frase: string
  if (!valendo)
    frase =
      nivel === 'folga'
        ? 'Ainda grátis neste mês.'
        : `Ainda grátis neste mês, mas a partir de outubro este volume encosta nas ${FRANQUIA_DE_SERVICO.toLocaleString('pt-BR')} grátis.`
  else if (excedentes > 0)
    frase = `${excedentes.toLocaleString('pt-BR')} acima das grátis: cerca de ${reais(custoEstimado)} na conta da Meta.`
  else frase = `Restam ${restantes.toLocaleString('pt-BR')} grátis neste mês.`

  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[12.5px] text-soft">{telefoneLegivel(numero.telefone)}</span>
        <span className="text-[12px] tabular-nums text-muted">
          {usadas.toLocaleString('pt-BR')} de {FRANQUIA_DE_SERVICO.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${cor}`}
          style={{ width: `${Math.min(100, Math.round((usadas / FRANQUIA_DE_SERVICO) * 100))}%` }}
        />
      </div>
      <p className={`mt-1 text-[11.5px] leading-5 ${corDoTexto}`}>{frase}</p>
    </li>
  )
}

const NOME_DO_TIPO: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilidade',
  AUTHENTICATION: 'Autenticação',
  SERVICE: 'Respostas acima das grátis',
}

const ORDEM = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE']

/**
 * O gasto do mês por tipo de mensagem (`gastoDoPeriodo`). A barra das grátis
 * só conta respostas; campanha e modelo pagam por tipo, e é aqui que aparecem.
 */
function GastoPorTipo({ gasto }: { gasto: GastoDoPeriodo }) {
  const linhas = [...gasto.porTipo].sort((a, b) => ORDEM.indexOf(a.categoria) - ORDEM.indexOf(b.categoria))
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[22px] font-bold tracking-[-0.02em] tabular-nums text-ink">{emReais(gasto.total)}</span>
        <span className="text-[11.5px] text-dim">{gasto.estimado ? 'neste mês, estimado pela tarifa' : 'neste mês'}</span>
      </div>
      {linhas.length === 0 ? (
        <p className="mt-1 text-[12px] leading-6 text-dim">Nada cobrado neste mês até a última leitura.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {linhas.map((linha) => (
            <li key={linha.categoria} className="flex items-baseline justify-between gap-3 px-3 py-2 text-[12.5px]">
              <span className="text-soft">
                {NOME_DO_TIPO[linha.categoria] ?? linha.categoria}
                <span className="ml-2 text-[11.5px] text-dim tabular-nums">
                  {linha.cobradas.toLocaleString('pt-BR')} {linha.cobradas === 1 ? 'mensagem' : 'mensagens'}
                </span>
              </span>
              <span className="font-semibold tabular-nums text-ink">{emReais(linha.custo)}</span>
            </li>
          ))}
        </ul>
      )}
      {gasto.servicoGratis > 0 && (
        <p className="mt-1.5 text-[11.5px] text-dim">
          Mais {gasto.servicoGratis.toLocaleString('pt-BR')} respostas dentro das grátis, sem custo.
        </p>
      )}
    </div>
  )
}
