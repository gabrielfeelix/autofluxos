import { Simulador } from '@/components/simulador'
import { validar } from '@/core/flow/validar'
import { triagem } from '@/exemplos/triagem'

export default function Pagina() {
  // A mesma validação que vai bloquear o botão "Publicar" mais para a frente.
  const validacao = validar(triagem)

  return <Simulador fluxo={triagem} validacao={validacao} />
}
