import 'server-only'
import { gemini } from './gemini'
import type { Modelo } from './types'

/**
 * Qual modelo atende esta automação — e com a chave de quem.
 *
 * Hoje existe **uma chave só, da 4YU** (`GEMINI_API_KEY`). É o que faz a
 * demonstração ao vivo funcionar: fluxo criado na frente do cliente, na
 * reunião, já respondendo. Sem isso, mostrar IA exigiria o cliente ter conta,
 * chave e faturamento antes da primeira conversa — ninguém fecha assim.
 *
 * **Onde está a linha.** O free tier do Gemini treina modelo com o que passa
 * por ele, inclusive com revisão humana. Enquanto quem conversa é a 4YU e o
 * cliente na reunião, isso é problema de ninguém: o dado é nosso e é
 * demonstração. Quando entrar conversa de gente de verdade — o cliente **do**
 * cliente, com nome, telefone e o que quer comprar — a chave tem que ser paga e
 * do cliente, senão é dado pessoal de terceiro indo para treino de modelo sem
 * o titular ter consentido. Esse é o momento de `clients.ia_chave_ref` sair do
 * papel e apontar para o Vault.
 *
 * Por isso a função devolve também **de quem é a chave**: quem chama consegue
 * mostrar isso na tela, e a regra vira coisa visível em vez de promessa
 * guardada num documento.
 */

export type ModeloEscolhido = {
  modelo: Modelo | null
  /** `4yu` = nossa chave, para demonstração. `cliente` = chave paga do cliente. */
  dono: '4yu' | 'cliente' | null
  /** Por que não há modelo, quando não há. Serve de mensagem na tela. */
  motivo?: string
}

export function escolherModelo({ iaHabilitada }: { iaHabilitada: boolean }): ModeloEscolhido {
  if (!iaHabilitada) {
    return { modelo: null, dono: null, motivo: 'esta automação não tem IA contratada' }
  }

  // Aqui entra, no futuro, a chave do cliente vinda do Vault. Ela tem
  // precedência sobre a nossa quando existir.
  const chave = process.env.GEMINI_API_KEY
  if (!chave) {
    return { modelo: null, dono: null, motivo: 'falta GEMINI_API_KEY no ambiente' }
  }

  return { modelo: gemini({ chave }), dono: '4yu' }
}
