import { Miolo } from '@/components/design/miolo'
import { Esqueleto, EsqueletoDeAlternador, TopoCarregando } from '@/components/design/esqueleto'

/**
 * Integrações enquanto vem: o topo escrito, o alternador e a grade de cartões
 * de plataforma, cada um com logo, selo, nome e a ação no pé. Sem isto, a tela
 * herdava o formulário genérico de Configurações, que não se parece com ela.
 */
export default function Carregando() {
  return (
    <Miolo largura="leitura">
      <TopoCarregando
        titulo="Todas as conexões"
        descricao="Tudo com que esta conta fala, os canais por onde a conversa passa e os sistemas que entregam e recebem dado. Cada cartão leva para onde se liga e se confere."
      />
      <EsqueletoDeAlternador opcoes={['Conectadas', 'Disponíveis']} className="mb-5" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="app-card flex h-[188px] flex-col p-4">
            <span className="mb-3 flex items-start justify-between">
              <Esqueleto className="size-9 rounded-[10px]" />
              <Esqueleto className="h-6 w-20 rounded-full" />
            </span>
            <Esqueleto className="h-3.5 w-28" />
            <Esqueleto className="mt-2 h-2.5 w-14" />
            <Esqueleto className="mt-3 h-2.5 w-full" />
            <Esqueleto className="mt-2 h-2.5 w-[70%]" />
            <span className="flex-1" />
            <Esqueleto className="h-3 w-20" />
          </div>
        ))}
      </div>
    </Miolo>
  )
}
