import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, TopoCarregando } from '@/components/design/esqueleto'

/**
 * As respostas rápidas enquanto vêm: topo com contagem e "+ Nova resposta",
 * e as linhas de atalho e texto no cartão, sem cabeçalho dentro dele.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <span role="status" className="sr-only">
          Carregando as respostas rápidas…
        </span>
        <TopoCarregando
          titulo="Respostas rápidas"
          contagem
          descricao="Frases prontas para quem atende. Elas pertencem a este cliente e aparecem na caixa de resposta do Inbox, não vão para o fluxo nem alteram o que o bot diz sozinho."
          acoes={['w-36']}
        />
        <section aria-hidden className="app-card overflow-hidden">
          {[
            ['w-[72px]', 'w-[56%]'],
            ['w-[96px]', 'w-[44%]'],
            ['w-[60px]', 'w-[62%]'],
            ['w-[84px]', 'w-[38%]'],
            ['w-[70px]', 'w-[50%]'],
          ].map(([atalho, linha], i) => (
            <div key={i} className="flex items-center gap-4 border-t border-line-soft px-5 py-3.5 first:border-t-0">
              <Esqueleto className={`h-6 shrink-0 rounded-lg ${atalho}`} />
              <Esqueleto className={`h-3 ${linha}`} />
              <Esqueleto className="ml-auto size-7 rounded-lg" />
            </div>
          ))}
        </section>
      </Miolo>
    </MioloCarregando>
  )
}
