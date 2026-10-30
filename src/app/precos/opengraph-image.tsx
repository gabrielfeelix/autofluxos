import { imagemDeCompartilhamento, TAMANHO, TIPO } from '../(site)/imagem-de-compartilhamento'

export const size = TAMANHO
export const contentType = TIPO
export const alt = 'Dialogon: Preços'

export default function Imagem() {
  return imagemDeCompartilhamento({ olho: 'Preços', titulo: 'Um preço que cabe antes de dar resultado' })
}
