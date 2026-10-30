/*
 * Todo "fale conosco" do site cai no WhatsApp da 4YU (decisão do Gabriel,
 * 30/out/2026): é o canal que o cliente já usa, e no celular um `mailto:` abre
 * um app de e-mail que muita gente nem configurou. O número é o mesmo do
 * rodapé e do balão, o da conta "4YU Tech Demonstração".
 */
const NUMERO_DA_4YU = '554474007438'

export function whatsappDa4yu(texto: string): string {
  return `https://wa.me/${NUMERO_DA_4YU}?text=${encodeURIComponent(texto)}`
}

export const FALE_CONOSCO = whatsappDa4yu('Olá! Quero conhecer o AutoFluxos.')
