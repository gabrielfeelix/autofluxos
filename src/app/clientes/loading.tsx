import type { ComponentType } from 'react'
import { headers } from 'next/headers'
import { EsqueletoDoCliente } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeCartoes } from '@/components/design/esqueleto'
import type { ChaveDaSecao } from '@/components/design/secoes-do-cliente'
import { barraRecolhida } from '@/server/preferencias'
import AjustesCarregando from './[clienteId]/ajustes/loading'
import AtividadesCarregando from './[clienteId]/atividades/loading'
import ConversasCarregando from './[clienteId]/conversas/loading'
import FavoritasCarregando from './[clienteId]/favoritas/loading'
import FluxosCarregando from './[clienteId]/fluxos/loading'
import InboxCarregando from './[clienteId]/inbox/loading'
import LeadsCarregando from './[clienteId]/leads/loading'
import LojaCarregando from './[clienteId]/loja/loading'
import QuadrosCarregando from './[clienteId]/quadros/loading'
import RelatoriosCarregando from './[clienteId]/relatorios/loading'
import TransmissoesCarregando from './[clienteId]/transmissoes/loading'

/**
 * A conta inteira enquanto vem, com a barra.
 *
 * **É o esqueleto de quem chega de fora**: da lista de clientes, de um link
 * salvo, de outra conta, e de quem **recarrega a página**. Ele fica acima do
 * `layout.tsx` da conta, então é o único que desenha a barra lateral; dentro da
 * conta a barra já está montada e os `loading.tsx` das seções trocam só o miolo.
 *
 * Por ficar acima do layout, ele não sabe a rota: no recarregar do Inbox
 * aparecia a grade de cartões do Início (29/out). O `proxy.ts` manda o caminho
 * em `x-caminho`, e daqui sai o miolo da própria seção, o mesmo `loading.tsx`
 * que a navegação por clique mostra, com a seção certa acesa na barra.
 */
const SECOES: Record<string, { ativa: ChaveDaSecao; Miolo: ComponentType }> = {
  inbox: { ativa: 'conversas', Miolo: InboxCarregando },
  conversas: { ativa: 'conversas', Miolo: ConversasCarregando },
  favoritas: { ativa: 'conversas', Miolo: FavoritasCarregando },
  leads: { ativa: 'crm', Miolo: LeadsCarregando },
  quadros: { ativa: 'crm', Miolo: QuadrosCarregando },
  negocios: { ativa: 'crm', Miolo: QuadrosCarregando },
  atividades: { ativa: 'crm', Miolo: AtividadesCarregando },
  fluxos: { ativa: 'automacoes', Miolo: FluxosCarregando },
  transmissoes: { ativa: 'automacoes', Miolo: TransmissoesCarregando },
  loja: { ativa: 'loja', Miolo: LojaCarregando },
  relatorios: { ativa: 'analise', Miolo: RelatoriosCarregando },
  ajustes: { ativa: 'ajustes', Miolo: AjustesCarregando },
}

export default async function Carregando() {
  // `/clientes/<id>/<seção>/...`: a terceira parte diz a tela.
  const secao = SECOES[(await headers()).get('x-caminho')?.split('/')[3] ?? '']
  const recolhida = await barraRecolhida()
  if (secao) {
    const { ativa, Miolo } = secao
    return (
      <EsqueletoDoCliente ativa={ativa} recolhida={recolhida}>
        <Miolo />
      </EsqueletoDoCliente>
    )
  }
  return (
    <EsqueletoDoCliente ativa="inicio" recolhida={recolhida}>
      <main className="flex min-h-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <EsqueletoDeCartoes />
      </main>
    </EsqueletoDoCliente>
  )
}
