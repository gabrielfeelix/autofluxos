/*
 * As logos dos negócios de exemplo do site (Ponto Som, Studio Movimento...),
 * fictícias, geradas para o site e em `public/logos-de-exemplo` (29/out). O
 * arquivo sai do nome do negócio sem acento; sem logo, quem usa cai na inicial.
 */
const COM_LOGO = new Set([
  'ponto-som',
  'clinica-bem-viver',
  'studio-movimento',
  'forno-da-vila',
  'clima-instalacoes',
  'casa-bela-decor',
  'pet-amigo',
])

export function logoDoNegocio(negocio: string): string | null {
  const slug = negocio
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return COM_LOGO.has(slug) ? `/logos-de-exemplo/${slug}.webp` : null
}
