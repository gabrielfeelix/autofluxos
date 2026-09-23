import { FRASE_DA_SAIDA, podeRetomar, porQueNaoRetoma } from '@/core/politica-de-acompanhamento'
import type { AcompanhamentoDoContato } from '@/server/repos/sequencias'
import { CabecalhoDoTipo } from './tipo-do-passo'

/**
 * Os acompanhamentos deste contato (UI-23/UI-24, T7.3).
 *
 * ---------------------------------------------------------------------------
 * A pergunta que esta tela passa a responder
 * ---------------------------------------------------------------------------
 *
 * "Por que essa pessoa recebeu essa mensagem?" A ficha não mostrava sequência
 * nenhuma, então a resposta não existia na tela: quem atendia via uma mensagem
 * automática no histórico e não tinha como saber de onde ela veio, nem se outras
 * ainda estavam para chegar.
 *
 * O item 4 da T7.3 pede "cancelamento, conclusão e falha visíveis na ficha", e as
 * três palavras são diferentes de propósito:
 *
 *   - **concluída**: entregou tudo. É sucesso;
 *   - **saiu**: uma regra encerrou (respondeu, vendeu, foi atendida). Também é
 *     sucesso, e é o desfecho mais comum de uma sequência de prospecção;
 *   - **bloqueada**: a sequência **não entregou**, porque a janela de 24h fechou
 *     antes do passo. É a única que é falha, e é o número que diz ao cliente que
 *     os prazos dele estão longos demais.
 *
 * Misturar as três num "encerrado" cinza esconderia justamente a que pede ação.
 *
 * Componente de servidor: só desenha. Retomar é ação, e mora no botão.
 */

const TOM: Record<AcompanhamentoDoContato['estado'], string> = {
  ativa: 'border-emerald-400/50 text-emerald-700',
  concluida: 'border-line text-dim',
  saiu: 'border-line text-dim',
  // A única que merece cor de atenção: é a que não entregou.
  bloqueada: 'border-amber-400/50 text-amber-700',
}

const ROTULO: Record<AcompanhamentoDoContato['estado'], string> = {
  ativa: 'em andamento',
  concluida: 'concluído',
  saiu: 'encerrado',
  bloqueada: 'não entregou',
}

export function Acompanhamentos({
  acompanhamentos,
}: {
  acompanhamentos: AcompanhamentoDoContato[]
}) {
  const ativos = acompanhamentos.filter((item) => item.estado === 'ativa').length

  return (
    <section className="app-card overflow-hidden">
      <CabecalhoDoTipo
        titulo="Acompanhamentos automáticos"
        quemFaz="uma sequência automática"
        contagem={ativos}
        descricao="As sequências por que esta pessoa passou, e por que cada uma parou. É daqui que vem a mensagem automática que aparece no histórico."
      />
      {acompanhamentos.length === 0 && (
        <p className="px-5 py-4 text-[12px] leading-5 text-dim">
          Esta pessoa não entrou em nenhuma sequência.
        </p>
      )}

      <ul>
        {acompanhamentos.map((item) => (
          <li key={item.id} className="border-b border-line px-5 py-3.5 last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold">{item.nome}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${TOM[item.estado]}`}
              >
                {ROTULO[item.estado]}
              </span>
              {/*
                De qual negociação. Nulo é "do contato", e a tela escreve isso em
                vez de deixar em branco: branco parece dado que faltou, e aqui é
                informação (RB-06).
              */}
              <span className="text-[11px] text-dim">
                {item.cartaoId ? 'de uma negociação' : 'do contato'}
              </span>
            </div>

            <p className="mt-1 text-[11.5px] leading-5 text-muted">
              {/*
                "2 de 4" e não "passo 2": o total é o que transforma o número em
                informação. Sem ele, ninguém sabe se falta um passo ou dez.
              */}
              {item.totalDePassos > 0
                ? `Passo ${Math.min(item.passoAtual + 1, item.totalDePassos)} de ${item.totalDePassos}. `
                : ''}
              {item.estado === 'ativa'
                ? 'O próximo passo sai no prazo configurado.'
                : frase(item)}
            </p>

            {item.estado === 'bloqueada' && (
              <p className="mt-1 text-[11.5px] leading-5 text-amber-700">
                {/*
                  A única que oferece retomada, e a frase diz o que a retomada faz
                  com o prazo: a RB-48 manda recalcular a partir de agora, e quem
                  retoma esperando a cadência original merece saber antes.
                */}
                {podeRetomar(item.estado)
                  ? 'Dá para retomar: o prazo do próximo passo passa a contar de agora, e os passos vencidos não saem todos de uma vez.'
                  : (porQueNaoRetoma(item.estado) ?? '')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Por que parou, em português.
 *
 * `FRASE_DA_SAIDA` cobre os motivos da RB-47; os outros vêm de `MOTIVOS_DE_SAIDA`
 * (0031) e já são frases. O `motivo` cru aparece só quando não é nenhum dos dois,
 * e aí mostrá-lo é melhor do que esconder: é o que alguém vai copiar num chamado.
 */
function frase(item: AcompanhamentoDoContato): string {
  if (item.estado === 'concluida') return 'Entregou todos os passos.'
  if (!item.motivo) return 'Encerrado.'

  const conhecida = FRASE_DA_SAIDA[item.motivo as keyof typeof FRASE_DA_SAIDA]
  if (conhecida) return `${conhecida[0]!.toUpperCase()}${conhecida.slice(1)}.`
  return `${item.motivo}.`
}
