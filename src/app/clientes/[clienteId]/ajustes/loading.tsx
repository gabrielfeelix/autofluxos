import { EsqueletoDoCliente } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeTexto } from '@/components/design/esqueleto'
import { MenuDeAjustes } from '@/components/design/menu-de-ajustes'

/**
 * As Configurações enquanto vêm, com as duas barras já desenhadas.
 *
 * Este `loading.tsx` cobre as telas de `ajustes/*`, e é por isso que o
 * `MenuDeAjustes` entra aqui de verdade e não em cinza: trocar entre elas é o
 * caminho mais percorrido da seção, e a barra da seção é justamente o que a
 * pessoa acabou de clicar.
 *
 * **Sem `params`, e isso não é economia.** A documentação do Next é literal:
 * *"Loading UI components do not accept any parameters"*. A versão anterior
 * declarava `params` e fazia `await params`, que em produção virava
 * `await undefined` e estourava na desestruturação. O resultado era a tela
 * inteira de Configurações caindo em "Alguma coisa quebrou aqui", com o React
 * mostrando só o erro #441, porque a mensagem real fica escondida em build de
 * produção. Quem for mexer aqui: este arquivo não pode ler a rota.
 *
 * Por isso o menu vai sem id e desenha os itens sem link. Ele está aqui para
 * ocupar a mesma largura e a barra não piscar, e para isso não precisa navegar.
 *
 * `ativa="inicio"` porque daqui não dá para saber qual das telas está vindo. O
 * item certo acende quando ela chega.
 */
export default function Carregando() {
  return (
    <EsqueletoDoCliente ativa="ajustes">
      <div className="flex min-h-full flex-col md:flex-row">
        <MenuDeAjustes ativa="inicio" />
        <div className="min-w-0 flex-1 px-4 pt-[26px] pb-[42px] md:px-[42px]">
          <EsqueletoDeTexto linhas={6} />
        </div>
      </div>
    </EsqueletoDoCliente>
  )
}
