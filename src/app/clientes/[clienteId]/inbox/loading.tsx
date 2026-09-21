import { EsqueletoDoCliente } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeInbox } from '@/components/design/esqueleto'

/**
 * O Inbox enquanto ele vem.
 *
 * A página já tinha um `<Suspense>` com este mesmo esqueleto dentro, e o
 * comentário dela descrevia o sintoma certo: *sair de qualquer outra tela e
 * cair aqui era meio segundo de tela idêntica, e a impressão não é "está
 * carregando", é "não clicou"*.
 *
 * O que faltava é que aquela fronteira mora **dentro** da `ClienteShell`, que
 * faz três consultas antes de desenhar. O esqueleto só aparecia depois delas.
 * Este arquivo vem antes de tudo: é pré-carregado com o prefetch do link e
 * aparece no quadro do clique.
 */
export default function Carregando() {
  return (
    <EsqueletoDoCliente ativa="inbox">
      <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
        <EsqueletoDeInbox />
      </div>
    </EsqueletoDoCliente>
  )
}
