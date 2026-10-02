'use client'

import { usePathname } from 'next/navigation'
import { Alternador } from '@/components/design/alternador'
import { ABAS_DA_ORGANIZACAO } from './abas'

/**
 * As abas do detalhe da organização, no `Alternador` como toda troca de seção
 * da casa (eram sublinhadas, desenho que o app aposentou em 02/out/2026).
 * Moram no layout, então trocar de aba não redesenha o cabeçalho: só o miolo
 * carrega.
 */
export function AbasDaOrganizacao({ base }: { base: string }) {
  const caminho = usePathname().replace(/\/$/, '')
  const acesa = [...ABAS_DA_ORGANIZACAO].reverse().find((aba) => (aba.caminho === '' ? caminho === base : caminho.startsWith(`${base}${aba.caminho}`)))

  return (
    <Alternador
      rotulo="Seções da organização"
      className="mb-5 max-w-full overflow-x-auto [scrollbar-width:none]"
      ativa={acesa?.chave ?? 'resumo'}
      opcoes={ABAS_DA_ORGANIZACAO.map((aba) => ({ chave: aba.chave, rotulo: aba.rotulo, href: `${base}${aba.caminho}` }))}
    />
  )
}
