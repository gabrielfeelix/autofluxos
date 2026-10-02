import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, EsqueletoDeLinhas } from '@/components/design/esqueleto'

/**
 * O Início enquanto vem: saudação, a faixa de estado, os quatro atalhos, a
 * fila e a coluna da direita. Também é o que aparece numa rota da conta que
 * não tem esqueleto próprio, então ele é de propósito o mais neutro deles.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="larga">
        <CabecalhoDaTela
          titulo={<Esqueleto className="my-1 h-[26px] w-44 rounded-lg" />}
          descricao={<Esqueleto className="mt-1.5 h-3 w-64" />}
        />
        <Esqueleto className="h-[52px] w-full rounded-xl" />
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="app-card flex h-[92px] flex-col gap-2.5 p-4">
                  <Esqueleto className="size-6 rounded-md" />
                  <Esqueleto className="h-3 w-20" />
                  <Esqueleto className="h-2.5 w-full" />
                </div>
              ))}
            </div>
            <EsqueletoDeLinhas linhas={4} rotulo="Carregando o início…" />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="app-card flex h-[120px] flex-col gap-3 p-5">
                <Esqueleto className="h-3.5 w-32" />
                <Esqueleto className="h-2.5 w-full" />
                <Esqueleto className="h-2.5 w-[70%]" />
              </div>
            ))}
          </div>
        </div>
      </Miolo>
    </MioloCarregando>
  )
}
