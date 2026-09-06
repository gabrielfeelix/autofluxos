import { VARIAVEIS_DE_DATA } from '../datas'

/**
 * O nome que uma pessoa lê, no lugar do nome que o fluxo usa.
 *
 * **A queixa é literal:** *"muita informação técnica na direita, código, número
 * esquisito, e eu nunca vou usar aquilo"*. A causa é que o painel do Inbox, a
 * ficha do lead e as colunas da lista renderizam a **chave da variável** — em
 * `font-mono`, ainda por cima. `objetivo_aluno` é identificador de desenho de
 * fluxo; quem atende nunca o escolheu e não devia precisar decifrá-lo.
 *
 * **Por que não guardar o rótulo junto do valor.** Foi o primeiro caminho
 * considerado, e ele não fecha: nem todo campo nasce de uma pergunta com texto.
 * `salvar_campo` é emitido também pela resposta de um `http` (a chave vem do
 * JSON de outro sistema), pela legenda de uma mídia, pelo `salvarPadraoEm` de
 * uma data e pelo `salvarValorEm` de uma escolha pareada — quatro origens sem
 * pergunta nenhuma para copiar. Guardar rótulo mudaria a forma da ação no
 * motor, a coluna no banco e cinco pontos de escrita, para continuar sem
 * resposta em metade dos casos. Formatar a chave responde a todos.
 *
 * Puro, sem banco e sem `server-only`: os três lugares que precisam dele são
 * componentes de tela.
 */

/**
 * As que têm nome próprio, porque a formatação mecânica erraria.
 *
 * `waid` viraria "Waid" e `nome_real` viraria "Nome real", que é pior do que
 * "Nome corrigido" — o ponto do campo é ser a correção de quem atende.
 */
const NOMES_PROPRIOS: Record<string, string> = {
  nome: 'Nome',
  nome_real: 'Nome corrigido',
  telefone: 'Telefone',
  waid: 'Número do WhatsApp',
  email: 'E-mail',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  cep: 'CEP',
  ddd: 'DDD',
  url: 'Link',
}

/**
 * As variáveis de data são nativas e sempre existem, então sair como
 * "Data hoje" seria ruído numa tela que já é a queixa. Elas não aparecem entre
 * os campos coletados hoje, mas passar por aqui um dia é questão de tempo.
 */
const DATAS = new Set<string>(VARIAVEIS_DE_DATA)

/**
 * `objetivo_aluno` → `Objetivo aluno`. `valorTotal` → `Valor total`.
 *
 * Aceita as duas convenções porque as duas chegam: a chave do desenho de fluxo
 * costuma vir com `_`, e a que vem do JSON de um `http` costuma vir em camelo.
 */
export function rotuloDoCampo(chave: string): string {
  const limpa = chave.trim()
  if (limpa === '') return ''

  const proprio = NOMES_PROPRIOS[limpa.toLowerCase()]
  if (proprio) return proprio

  if (DATAS.has(limpa)) return limpa.replace(/_/g, ' ')

  const palavras = limpa
    // `valorTotal` → `valor Total`, antes de baixar tudo: sem isto o camelo
    // vira uma palavra só e o rótulo continua ilegível.
    .replace(/([a-zà-ÿ0-9])([A-ZÀ-Þ])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra) => palavra.toLowerCase())

  if (palavras.length === 0) return limpa

  /*
   * Caixa de frase, não de título.
   *
   * "Objetivo Do Aluno" é o erro clássico de aplicar title case ao português —
   * e mesmo sem preposição, "Valor Total" lido numa coluna estreita parece
   * outro identificador técnico, que é justo o que esta função existe para
   * tirar da tela. Uma frase começa com maiúscula e segue minúscula.
   */
  const frase = palavras.join(' ')
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}
