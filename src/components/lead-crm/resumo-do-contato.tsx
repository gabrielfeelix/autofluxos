import { comoDinheiro } from '@/core/crm'
import {
  CLASSE_DO_NIVEL,
  oQueFazer,
  ROTULO_DA_RECENCIA,
  ROTULO_DO_NIVEL,
  type Relacionamento,
} from '@/core/relacionamento'

/**
 * Quanto essa pessoa já rendeu, quantas vezes comprou e quando foi a última.
 *
 * As três perguntas do pós-venda, e elas abrem a coluna porque mudam o tom da
 * conversa antes de qualquer outra coisa: atender quem já comprou duas vezes
 * não é o mesmo trabalho que atender quem nunca comprou, e quem abre a ficha
 * precisa saber disso antes de digitar.
 *
 * Sem compra nenhuma o cartão **não aparece**: três zeros não informam nada e
 * empurram para baixo o que informa.
 *
 * O nível e a recência entram aqui (0070) porque é a mesma pergunta em outra
 * escala: os três números dizem o que já aconteceu, e o par nível+recência diz o
 * que isso significa hoje. A frase embaixo é o que fecha — a tela só vira
 * ferramenta quando responde "e agora?".
 */
export function ResumoDoContato({
  resumo,
  relacionamento,
}: {
  resumo: { total: number; compras: number; ultimaEm: string | null }
  relacionamento?: Relacionamento | null
}) {
  if (resumo.compras === 0) return null

  const fazer = relacionamento ? oQueFazer(relacionamento) : null

  return (
    <section className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        Já rendeu
        {relacionamento && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold">
            <span
              aria-hidden
              className={`size-2 shrink-0 rounded-full ${CLASSE_DO_NIVEL[relacionamento.nivel]}`}
            />
            {ROTULO_DO_NIVEL[relacionamento.nivel]}
            <span
              className={
                relacionamento.recencia === 'sumido' || relacionamento.recencia === 'perdido'
                  ? 'text-aviso'
                  : 'text-dim'
              }
            >
              · {ROTULO_DA_RECENCIA[relacionamento.recencia]}
            </span>
          </span>
        )}
      </h2>
      <div className="grid grid-cols-3 gap-2 px-[18px] py-4">
        <Numero titulo="Total" valor={comoDinheiro(resumo.total) || 'R$ 0,00'} />
        <Numero titulo="Compras" valor={String(resumo.compras)} />
        <Numero
          titulo="Última"
          valor={resumo.ultimaEm ? new Date(resumo.ultimaEm).toLocaleDateString('pt-BR') : '—'}
        />
      </div>

      {/* A frase só aparece quando há o que fazer. Um cartão que sempre diz
          alguma coisa vira decoração, e para de ser lido justamente no dia em
          que tem um recado de verdade. */}
      {fazer && (
        <p className="border-t border-line bg-surface px-[18px] py-3 text-[11.5px] leading-5 text-soft">
          {fazer}
        </p>
      )}
    </section>
  )
}

function Numero({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <span className="rounded-lg border border-line bg-surface px-2 py-2 text-center">
      <span className="block truncate text-[13px] font-bold">{valor}</span>
      <span className="block text-[10px] text-dim">{titulo}</span>
    </span>
  )
}
