import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeTexto } from '@/components/design/esqueleto'

/**
 * A tela de Etiquetas enquanto vem. A barra mora no layout e continua na tela; aqui só troca o miolo.
 * Sem `params`: loading não recebe parâmetro nenhum (ver `ajustes/loading.tsx`).
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <EsqueletoDeTexto linhas={6} />
      </main>
    </MioloCarregando>
  )
}
