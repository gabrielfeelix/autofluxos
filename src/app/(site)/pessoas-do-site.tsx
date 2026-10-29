/*
 * As fotos das pessoas de exemplo do site (Marina Costa, Rafael Souza...), no
 * lugar das siglas nos avatares (pedido do Gabriel, 29/out). São 14 retratos
 * gerados para o site, 7 mulheres e 7 homens, em `public/fotos-do-site/pessoas`.
 *
 * A foto sai do nome, sempre a mesma: a Marina tem o mesmo rosto no Inbox, no
 * funil e na jornada, e o servidor e o navegador escolhem igual (sorteio de
 * verdade daria um rosto na primeira pintura e outro depois da hidratação).
 */

const MULHERES = new Set([
  'ana', 'bia', 'carla', 'helena', 'iara', 'julia', 'júlia', 'lia', 'luna', 'marina', 'maria', 'nina', 'rita', 'tânia', 'tania', 'vera', 'beatriz', 'camila', 'larissa', 'paula',
])

const POR_GENERO = 7

function indice(nome: string, quantos: number): number {
  let h = 0
  for (const letra of nome.toLowerCase()) h = (h * 31 + letra.charCodeAt(0)) >>> 0
  return h % quantos
}

export function fotoDaPessoa(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0]!.toLowerCase()
  const genero = MULHERES.has(primeiro) ? 'mulher' : 'homem'
  return `/fotos-do-site/pessoas/${genero}-${String(indice(nome, POR_GENERO) + 1).padStart(2, '0')}.webp`
}

/** O retrato preenchendo o avatar redondo em volta (que já tem tamanho e raio). */
export function FotoDaPessoa({ nome }: { nome: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fotoDaPessoa(nome)}
      alt=""
      width={96}
      height={96}
      loading="lazy"
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
    />
  )
}

/** A foto pequena ao lado de um nome solto (cartão do funil, ticket da cozinha). */
export function MiniFoto({ nome, tamanho = 20 }: { nome: string; tamanho?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fotoDaPessoa(nome)}
      alt=""
      width={tamanho}
      height={tamanho}
      loading="lazy"
      style={{ display: 'inline-block', width: tamanho, height: tamanho, marginRight: 6, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', flex: 'none' }}
    />
  )
}
