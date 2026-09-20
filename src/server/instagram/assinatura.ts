import { createHmac, timingSafeEqual } from 'node:crypto'

export function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  if (!cabecalho?.startsWith('sha256=')) return false

  // O do Instagram primeiro: é o que assina o Direct quando o produto é o
  // Instagram Login, que é o nosso caso.
  const segredos = [process.env.INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET].filter(
    (valor): valor is string => Boolean(valor),
  )
  if (segredos.length === 0) return false

  const recebida = Buffer.from(cabecalho.slice('sha256='.length), 'hex')

  // Todos os segredos são conferidos mesmo depois de um acerto: sair no primeiro
  // que bate faz o tempo da resposta contar quantos segredos existem.
  let confere = false
  for (const segredo of segredos) {
    const esperada = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'), 'hex')

    // `timingSafeEqual` estoura se os tamanhos diferem, e comparar tamanho antes
    // não vaza nada: ele é público na própria forma do cabeçalho.
    if (esperada.length !== recebida.length) continue
    if (timingSafeEqual(esperada, recebida)) confere = true
  }

  return confere
}
