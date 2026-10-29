'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Badge, teto } from '@/components/design/pilula'

/**
 * O número de alertas não vistos no menu da administração.
 *
 * Cliente, e não o `Badge` direto do layout, porque o layout não roda de novo
 * quando se navega entre telas: o número que ele desenhou ficava no menu até
 * um F5, mesmo depois de abrir Alertas (que marca tudo como visto). Aqui ele
 * some na hora em que a tela abre, e fica sumido até o servidor mandar outro
 * número (o `key` no layout recomeça este estado quando a contagem muda).
 */
export function ContadorDeAlertas({ total }: { total: number }) {
  const caminho = usePathname()
  const naTela = caminho === '/admin/alertas' || caminho.startsWith('/admin/alertas/')
  const [zerou, setZerou] = useState(false)
  if (naTela && !zerou) setZerou(true)
  if (zerou || naTela || total <= 0) return null
  return (
    <Badge tom="alerta" rotulo={`${total} alertas não vistos`}>
      {teto(total)}
    </Badge>
  )
}
