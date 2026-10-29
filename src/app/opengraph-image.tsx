import { imagemDeCompartilhamento, TAMANHO, TIPO } from './(site)/imagem-de-compartilhamento'

export const size = TAMANHO
export const contentType = TIPO
export const alt = 'AutoFluxos: atendimento, vendas e pós-venda no WhatsApp'

export default function Imagem() {
  return imagemDeCompartilhamento({
    olho: 'Atendimento, vendas e pós-venda no WhatsApp',
    titulo: 'A equipe inteira no mesmo número, do primeiro contato à recompra',
  })
}
