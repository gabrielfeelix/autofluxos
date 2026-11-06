import { DEFINICAO_DO_CANAL, type CanalId } from '../canais'
import { regrasDaCondicao, type NoCondicao, type NoEspera, type Operador, type RegraDaCondicao } from './schema'

/**
 * Como a condição e a espera se leem em português, num lugar só (06/nov/2026).
 *
 * O desenho, a lista de problemas, a página compartilhada e a Ajuda dizem a
 * mesma frase. Com quatro cópias, a primeira regra nova faria cada tela
 * descrever um bloco diferente.
 */

export const OPERADOR_EM_PALAVRAS: Record<Operador, string> = {
  igual: 'é igual a',
  diferente: 'é diferente de',
  contem: 'contém',
  vazio: 'está vazia',
  preenchido: 'está preenchida',
  maior: 'é maior que',
  menor: 'é menor que',
}

/** Os nomes que só a conta conhece. Sem eles, a frase diz "uma etiqueta". */
export type NomesDaConta = {
  etiquetas?: Record<string, string>
  colunas?: Record<string, string>
}

export function fraseDaRegra(regra: RegraDaCondicao, nomes: NomesDaConta = {}): string {
  switch (regra.tipo) {
    case 'variavel': {
      const variavel = regra.variavel ? `{{${regra.variavel}}}` : 'a informação'
      if (regra.operador === 'vazio' || regra.operador === 'preenchido') {
        return `${variavel} ${OPERADOR_EM_PALAVRAS[regra.operador]}`
      }
      return `${variavel} ${OPERADOR_EM_PALAVRAS[regra.operador]} "${regra.valor}"`
    }
    case 'etiqueta': {
      const nome = nomes.etiquetas?.[regra.etiquetaId] ?? (regra.etiquetaId ? 'escolhida' : 'a escolher')
      return regra.tem ? `tem a etiqueta ${nome}` : `não tem a etiqueta ${nome}`
    }
    case 'etapa': {
      const nome = nomes.colunas?.[regra.colunaId] ?? (regra.colunaId ? 'escolhida' : 'a escolher')
      return regra.esta ? `está na etapa ${nome}` : `não está na etapa ${nome}`
    }
    case 'horario':
      return regra.aberto ? 'dentro do horário de atendimento' : 'fora do horário de atendimento'
    case 'canal':
      return `conversa pelo ${DEFINICAO_DO_CANAL[regra.canal as CanalId]?.nome ?? regra.canal}`
  }
}

/** "assunto é igual a preço e tem a etiqueta VIP". */
export function fraseDaCondicao(no: Pick<NoCondicao, 'data'>, nomes: NomesDaConta = {}): string {
  const juntar = no.data.modo === 'qualquer' ? ' ou ' : ' e '
  return regrasDaCondicao(no.data)
    .map((r) => fraseDaRegra(r, nomes))
    .join(juntar)
}

/** "5 minutos", "1 hora", "2 dias". */
export function fraseDaEspera(no: Pick<NoEspera, 'data'>): string {
  const { quantidade, unidade } = no.data
  const singular = { minutos: 'minuto', horas: 'hora', dias: 'dia' }[unidade]
  return `${quantidade} ${quantidade === 1 ? singular : unidade}`
}
