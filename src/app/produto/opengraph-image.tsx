import { imagemDeCompartilhamento, TAMANHO, TIPO } from '../(site)/imagem-de-compartilhamento'

export const size = TAMANHO
export const contentType = TIPO
export const alt = 'Dialogon: O produto'

export default function Imagem() {
  return imagemDeCompartilhamento({ olho: 'O produto', titulo: 'Tudo o que acontece numa conversa, num lugar só' })
}
