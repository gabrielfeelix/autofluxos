import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'

/**
 * As mensagens guardadas enquanto vêm: título e frase de verdade, e o cartão
 * com o botão do Inbox no cabeçalho e as linhas de quem falou e do texto.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <span role="status" className="sr-only">
          Carregando as mensagens guardadas…
        </span>
        <CabecalhoDaTela
          titulo="Mensagens guardadas"
          descricao="O que você marcou com a estrela. Só você vê esta lista."
          acoes={<Esqueleto className="h-9 w-[118px] rounded-[10px]" />}
        />
        <section aria-hidden className="app-card overflow-hidden">
          {[
            ['w-[140px]', 'w-[80%]', 'w-[46%]'],
            ['w-[110px]', 'w-[62%]', null],
            ['w-[160px]', 'w-[88%]', 'w-[70%]'],
          ].map(([nome, linha1, linha2], i) => (
            <div key={i} className="border-t border-line px-5 py-3.5 first:border-t-0">
              <span className="flex items-center gap-2">
                <Esqueleto className={`h-3 ${nome}`} />
                <span className="flex-1" />
                <Esqueleto className="h-2.5 w-[90px]" />
              </span>
              <Esqueleto className={`mt-2.5 h-2.5 ${linha1}`} />
              {linha2 && <Esqueleto className={`mt-1.5 h-2.5 ${linha2}`} />}
            </div>
          ))}
        </section>
      </Miolo>
    </MioloCarregando>
  )
}
