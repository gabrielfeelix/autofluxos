import { imagemDeCompartilhamento, TAMANHO, TIPO } from '../(site)/imagem-de-compartilhamento'

export const size = TAMANHO
export const contentType = TIPO
export const alt = 'AutoFluxos: Integrações'

export default function Imagem() {
  return imagemDeCompartilhamento({ olho: 'Integrações', titulo: 'Liga no que você já usa' })
}
