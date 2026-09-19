import {
  CLASSE_DO_NIVEL,
  ROTULO_DA_RECENCIA,
  ROTULO_DO_NIVEL,
  type Relacionamento,
} from '@/core/relacionamento'
import { comoDinheiro } from '@/core/crm'

/**
 * Quanto essa pessoa vale, e se ela ainda está aqui — numa célula de tabela.
 *
 * **As duas coisas juntas, e nunca só o nível.** "Ouro" sozinho é um troféu que
 * não pede nada de ninguém; "Ouro · sumido há 4 meses" é uma tarefa. O par é o
 * ponto inteiro da coluna, e foi por isso que ela não virou um score único
 * (555, 321): 5 em valor e 1 em presença vira "médio" e some no meio da lista,
 * que é exatamente o cliente que não pode sumir da tela.
 *
 * Quem nunca comprou aparece apagado em vez de não aparecer: a coluna precisa
 * ter a mesma altura em toda linha, senão a tabela ganha buracos e quem lê
 * acha que faltou dado.
 */
export function SeloDoCliente({ r }: { r: Relacionamento }) {
  const semCompra = r.nivel === 'sem_compra'

  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${CLASSE_DO_NIVEL[r.nivel]}`}
        />
        <span
          className={`text-[11.5px] font-bold whitespace-nowrap ${semCompra ? 'text-dim' : ''}`}
        >
          {ROTULO_DO_NIVEL[r.nivel]}
        </span>
      </span>

      {/* O valor só aparece para quem tem valor. "R$ 0,00" embaixo de "Ainda
          não comprou" é a mesma informação escrita duas vezes. */}
      {!semCompra && (
        <span className="text-[10.5px] whitespace-nowrap text-dim">
          {comoDinheiro(r.total)}
          {r.compras > 1 && ` · ${r.compras}×`}
        </span>
      )}

      <span
        className={`text-[10.5px] whitespace-nowrap ${
          r.recencia === 'sumido' || r.recencia === 'perdido' ? 'text-aviso' : 'text-dim'
        }`}
      >
        {ROTULO_DA_RECENCIA[r.recencia]}
        {r.diasDaUltimaConversa !== null && r.recencia !== 'ativo' && (
          <> · {emTempo(r.diasDaUltimaConversa)}</>
        )}
      </span>
    </span>
  )
}

/** "4 meses", "20 dias". Ninguém decide nada com "há 127 dias". */
function emTempo(dias: number): string {
  if (dias < 45) return `${dias}d`
  const meses = Math.round(dias / 30)
  return `${meses}m`
}
