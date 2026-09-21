import { fluxoSchema, type Fluxo } from './flow/schema'
import { limparParaCompartilhar } from './compartilhar'

/**
 * O fluxo como **arquivo**: o que sai no "Exportar JSON" e o que entra no
 * "Importar JSON".
 *
 * Existe ao lado do link compartilhado, e não no lugar dele, porque as duas
 * coisas respondem a perguntas diferentes. O link é vivo: tem prazo, conta
 * abertura e morre quando alguém revoga. O arquivo é morto: vai para o Drive,
 * para o anexo do e-mail, para o backup de antes da reunião, e continua abrindo
 * daqui a um ano sem depender de nada nosso estar no ar.
 *
 * O que sai daqui passa por `limparParaCompartilhar`, exatamente como o link:
 * **`conexaoId` não viaja**. Um arquivo é ainda mais fácil de repassar do que
 * um link, então a regra não pode ser mais frouxa aqui do que lá.
 */

/**
 * O que identifica o arquivo como nosso.
 *
 * Não é enfeite: sem isso, arrastar um JSON qualquer para a tela de importar
 * daria erro de schema no meio do grafo, e a mensagem seria sobre um campo
 * `nodes` ausente em vez de "este arquivo não é de uma automação".
 */
export const MARCA_DO_ARQUIVO = 'autofluxos.fluxo'

/**
 * A versão do **formato do arquivo**, que não é a versão publicada do fluxo.
 *
 * Sobe quando o envelope mudar de forma, nunca quando o grafo ganhar um bloco:
 * bloco novo é assunto do `fluxoSchema`, que já recusa o que não conhece.
 */
export const FORMATO_ATUAL = 1

export type ArquivoDeFluxo = {
  formato: typeof MARCA_DO_ARQUIVO
  versaoDoFormato: number
  /** O nome que o fluxo tinha na origem. Só sugestão: quem importa renomeia. */
  nome: string
  /** A versão publicada de onde o arquivo saiu. Informativo. */
  versaoPublicada?: number
  /** Quando foi exportado, em ISO. Informativo, e é o que data um backup. */
  exportadoEm: string
  grafo: Fluxo
}

/** Monta o arquivo, já sem credencial. */
export function montarArquivoDeFluxo({
  nome,
  grafo,
  versaoPublicada,
  agora = new Date(),
}: {
  nome: string
  grafo: Fluxo
  versaoPublicada?: number
  agora?: Date
}): ArquivoDeFluxo {
  return {
    formato: MARCA_DO_ARQUIVO,
    versaoDoFormato: FORMATO_ATUAL,
    nome,
    ...(versaoPublicada === undefined ? {} : { versaoPublicada }),
    exportadoEm: agora.toISOString(),
    grafo: limparParaCompartilhar(grafo),
  }
}

/**
 * O nome do arquivo que o navegador baixa.
 *
 * Minúsculas, sem acento e sem espaço: ele vai para pastas compartilhadas,
 * anexos e sistemas de arquivo que tratam "Triagem Inicial v3.json" de três
 * maneiras diferentes.
 */
export function nomeDoArquivoDeFluxo(nome: string, versaoPublicada?: number): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  const base = limpo === '' ? 'automacao' : limpo
  return versaoPublicada === undefined ? `${base}.json` : `${base}-v${versaoPublicada}.json`
}

export type LeituraDoArquivo =
  | { ok: true; nome: string; grafo: Fluxo }
  | { ok: false; erro: string }

/**
 * Lê o que alguém escolheu no seletor de arquivos.
 *
 * **Aceita o envelope e também o grafo cru**, e a segunda forma não é descuido:
 * quem exportou antes deste formato existir, quem copiou o `grafo` de dentro do
 * arquivo, ou quem recebeu o JSON por outro caminho tem um desenho válido na
 * mão, e recusá-lo por falta de embalagem seria burocracia sem ganho nenhum de
 * segurança, o `fluxoSchema` é a mesma trava nos dois casos.
 *
 * Erro sempre em uma frase de gente: esta função é lida por quem arrastou o
 * arquivo errado, não por quem escreveu o schema.
 */
export function lerArquivoDeFluxo(texto: string): LeituraDoArquivo {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, erro: 'este arquivo não é um JSON válido' }
  }

  if (bruto === null || typeof bruto !== 'object') {
    return { ok: false, erro: 'este arquivo não tem uma automação dentro' }
  }

  const objeto = bruto as Record<string, unknown>
  const temEnvelope = objeto.formato === MARCA_DO_ARQUIVO

  if (typeof objeto.formato === 'string' && !temEnvelope) {
    return { ok: false, erro: 'este arquivo é de outro sistema, não do AutoFluxos' }
  }

  const candidato = temEnvelope ? objeto.grafo : objeto
  const lido = fluxoSchema.safeParse(candidato)
  if (!lido.success) {
    return { ok: false, erro: 'o desenho deste arquivo está incompleto ou corrompido' }
  }

  const nome = temEnvelope && typeof objeto.nome === 'string' ? objeto.nome.trim() : ''

  return { ok: true, nome, grafo: limparParaCompartilhar(lido.data) }
}
