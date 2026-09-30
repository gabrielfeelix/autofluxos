import 'server-only'
import { emCadeia } from './cadeia'
import { compativelOpenai, enderecoDo, PROVEDORES } from './compativel-openai'
import { gemini } from './gemini'
import { lerChave } from '../repos/chave-de-ia'
import { recusaDoPlano } from '../recursos-do-plano'
import type { Modelo } from './types'

/**
 * Qual modelo atende esta automação, e com a chave de quem.
 *
 * Hoje existe **uma chave só, da 4YU** (`GEMINI_API_KEY`). É o que faz a
 * demonstração ao vivo funcionar: fluxo criado na frente do cliente, na
 * reunião, já respondendo. Sem isso, mostrar IA exigiria o cliente ter conta,
 * chave e faturamento antes da primeira conversa, ninguém fecha assim.
 *
 * **Onde está a linha.** O free tier do Gemini treina modelo com o que passa
 * por ele, inclusive com revisão humana. Enquanto quem conversa é a 4YU e o
 * cliente na reunião, isso é problema de ninguém: o dado é nosso e é
 * demonstração. Quando entrar conversa de gente de verdade, o cliente **do**
 * cliente, com nome, telefone e o que quer comprar, a chave tem que ser paga e
 * do cliente, senão é dado pessoal de terceiro indo para treino de modelo sem
 * o titular ter consentido. Esse é o momento de `clients.ia_chave_ref` sair do
 * papel e apontar para o Vault.
 *
 * Por isso a função devolve também **de quem é a chave**: quem chama consegue
 * mostrar isso na tela, e a regra vira coisa visível em vez de promessa
 * guardada num documento.
 *
 * **A chave do cliente tem precedência, e é por isso que a função virou
 * assíncrona**: descobrir de quem é a chave passou a exigir uma ida ao cofre. A
 * nossa continua existindo como rede, conta sem chave própria segue respondendo
 * como respondia, que é o que mantém a demonstração de pé.
 */

export type ModeloEscolhido = {
  modelo: Modelo | null
  /** `4yu` = nossa chave, para demonstração. `cliente` = chave paga do cliente. */
  dono: '4yu' | 'cliente' | null
  /** Por que não há modelo, quando não há. Serve de mensagem na tela. */
  motivo?: string
}

export async function escolherModelo({
  iaHabilitada,
  clienteId,
}: {
  iaHabilitada: boolean
  /** Sem conta não há chave própria a procurar: sobra a nossa. */
  clienteId?: string | null
}): Promise<ModeloEscolhido> {
  if (!iaHabilitada) {
    return { modelo: null, dono: null, motivo: 'esta automação não tem IA contratada' }
  }

  /*
   * O plano vigente precisa incluir IA (seção 8 do plano da administração). O
   * fluxo guarda `ia_habilitada`: subir de plano religa sem ninguém mexer.
   */
  if (clienteId) {
    const recusa = await recusaDoPlano(clienteId, 'ia')
    if (recusa) return { modelo: null, dono: null, motivo: recusa }
  }

  if (clienteId) {
    /*
     * Falha ao ler o cofre **não** derruba a conversa: cai na nossa chave, que é
     * o comportamento de antes desta função existir. Ficar mudo porque o Vault
     * não respondeu seria trocar um problema de privacidade por um de
     * atendimento parado, e o log conta o que houve.
     */
    try {
      const doCliente = await lerChave(clienteId)
      if (doCliente) return { modelo: gemini({ chave: doCliente }), dono: 'cliente' }
    } catch (erro) {
      console.error('[ia] não deu para ler a chave do cliente:', erro)
    }
  }

  const nossa = modeloDa4yu()
  if (!nossa) {
    return { modelo: null, dono: null, motivo: 'nenhuma chave de IA no ambiente' }
  }

  return { modelo: nossa, dono: '4yu' }
}

/**
 * A nossa chave, que desde 25/set/2026 é uma cadeia de free tiers.
 *
 * A cota grátis do Gemini acabava no meio da tarde e a conversa ia para gente.
 * Cada provedor tem o seu balde, então enfileirar os que têm chave no ambiente
 * soma as cotas.
 *
 * **A ordem é pelo tamanho do balde por minuto, não pela velocidade.** Até
 * 30/set o Groq vinha primeiro por ser o mais rápido, mas o grátis dele dá
 * 8.000 tokens por minuto (medido: duas chamadas de 3.678 deixaram 213), e um
 * turno de venda faz três chamadas de 4 a 6 mil (lista de produtos, regras,
 * histórico). Estourava na segunda, caía no Gemini já atrasado, e a soma dos
 * prazos passava de 50 s; no fim a conversa ia para uma pessoa por um "Oi".
 * O Cerebras roda o mesmo modelo do Groq com balde maior; o Gemini
 * flash-lite aguentou 10 mil tokens em 4,4 s no mesmo teste. O Groq fica de
 * reserva para quando os dois caírem.
 *
 * `IA_PROVEDOR` prende um só, para comparar como cada um se comporta.
 */
function modeloDa4yu(): Modelo | null {
  const elos: { nome: string; modelo: Modelo }[] = []
  const compativel = (nome: 'groq' | 'cerebras' | 'cloudflare' | 'mistral') => {
    const chave = process.env[PROVEDORES[nome].variavel]
    if (chave && enderecoDo(nome)) elos.push({ nome, modelo: compativelOpenai({ provedor: nome, chave }) })
  }

  compativel('cerebras')
  const chaveGemini = process.env.GEMINI_API_KEY
  if (chaveGemini) elos.push({ nome: 'gemini', modelo: gemini({ chave: chaveGemini }) })
  compativel('groq')
  compativel('cloudflare')
  compativel('mistral')

  const preso = process.env.IA_PROVEDOR
  const usados = preso ? elos.filter((e) => e.nome === preso) : elos

  const [unico, ...resto] = usados
  if (!unico) return null
  return resto.length === 0 ? unico.modelo : emCadeia(usados)
}
