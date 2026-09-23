import { EsqueletoDeTexto } from '@/components/design/esqueleto'

/**
 * Uma tela de Configurações enquanto vem.
 *
 * As duas barras (a da conta e a de Configurações) moram em layout e continuam
 * na tela; este arquivo só troca o miolo.
 *
 * **Sem `params`.** A documentação do Next é literal: *"Loading UI components
 * do not accept any parameters"*. Uma versão antiga fazia `await params` aqui e
 * derrubava Configurações inteira em produção (React #441).
 */
export default function Carregando() {
  return (
    <div className="px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <EsqueletoDeTexto linhas={6} />
    </div>
  )
}
