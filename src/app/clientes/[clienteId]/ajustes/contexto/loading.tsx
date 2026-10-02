import { EsqueletoDeAjuste, Esqueleto } from '@/components/design/esqueleto'

/** Conhecimento da IA enquanto vem: o caminho, o título de verdade (a frase muda com o ramo e espera em osso), e o texto. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Conhecimento da IA"
    >
      <div className="app-card p-5">
        <Esqueleto className="h-4 w-56 rounded" />
        <Esqueleto className="mt-2 mb-5 h-3 w-80 max-w-full rounded" />
        <Esqueleto className="h-[320px] w-full rounded-[10px]" />
      </div>
    </EsqueletoDeAjuste>
  )
}
