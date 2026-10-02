import { Aviso, EsqueletoDaFicha } from '@/components/design/esqueleto'

export default function Carregando() {
  return (
    <div className="max-w-[1100px]">
      <EsqueletoDaFicha observacoes />
      <Aviso>Carregando os dados…</Aviso>
    </div>
  )
}
