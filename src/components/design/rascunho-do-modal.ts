/**
 * A decisão que o modal toma ao fechar: pode descartar, ou precisa perguntar?
 *
 * ---------------------------------------------------------------------------
 * Por que isto é um módulo à parte, e não um `if` dentro do componente
 * ---------------------------------------------------------------------------
 *
 * O defeito medido na T7.4: `ModalFormulario` fechava por `Esc`, por clique no
 * fundo e pelo "Cancelar" chamando `close()` direto, **sem perguntar nada**.
 * Quem digitou meia tela de anúncio e encostou no fundo perdia tudo, em
 * silêncio, e o silêncio é o problema: um formulário que some sem aviso ensina
 * a não confiar no formulário, e a partir daí a pessoa copia o texto para fora
 * antes de digitar dentro.
 *
 * A regra não é "sempre perguntar". Modal aberto e fechado sem toque nenhum é o
 * caso mais comum de todos: quem abriu por engano não merece uma pergunta. Por
 * isso a decisão olha o que foi digitado, e não o gesto de fechar.
 *
 * Vive fora do `.tsx` porque este repositório não tem `jsdom` nem
 * `@testing-library/react`: o jeito da casa é extrair a decisão para um módulo
 * puro e testá-la ali, como `secoes-do-cliente.ts` e `acao-otimista.ts` fazem.
 */

/**
 * O que um campo do formulário vale, para efeito de "isto foi digitado?".
 *
 * `FormData` não serve como entrada porque o modal precisa da resposta **antes**
 * de enviar, com o formulário ainda na tela.
 */
export type ValorDeCampo = string | File | null | undefined

/**
 * Houve rascunho? Ou seja: fechar agora perderia alguma coisa?
 *
 * Um campo conta como digitado quando o valor **atual** difere do valor com que
 * ele nasceu. Comparar com o inicial, e não com vazio, é o que faz o modal de
 * edição funcionar: ali todo campo já vem preenchido, e "diferente de vazio"
 * perguntaria sempre, inclusive para quem só abriu e desistiu.
 *
 * Espaço em branco não conta. Quem encostou na barra de espaço não digitou
 * nada, e perguntar ali é a mesma pergunta que ninguém lê.
 */
export function houveRascunho(
  atual: ReadonlyMap<string, ValorDeCampo>,
  inicial: ReadonlyMap<string, ValorDeCampo>,
): boolean {
  for (const [nome, valor] of atual) {
    if (!saoIguais(valor, inicial.get(nome))) return true
  }
  // Campo que existia no inicial e sumiu do atual: o formulário mudou de forma
  // (um `select` que trocou os campos visíveis, por exemplo). Não é digitação
  // da pessoa, e tratar como rascunho perguntaria em tela que ninguém tocou.
  return false
}

function saoIguais(a: ValorDeCampo, b: ValorDeCampo): boolean {
  if (a instanceof File || b instanceof File) {
    // Arquivo escolhido é digitação, e arquivo nenhum é o estado inicial de todo
    // `input type=file`: um `File` de tamanho zero não existe como escolha.
    return tamanhoDoArquivo(a) === tamanhoDoArquivo(b)
  }
  return normalizar(a) === normalizar(b)
}

function tamanhoDoArquivo(v: ValorDeCampo): number {
  return v instanceof File ? v.size : -1
}

function normalizar(v: ValorDeCampo): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * A pergunta, num lugar só.
 *
 * Fica aqui e não no componente para que o teste prove o texto: "descartar" é a
 * palavra que diz o que se perde, e um "Tem certeza?" genérico não diz.
 */
export const PERGUNTA_DESCARTAR =
  'Você digitou alguma coisa que ainda não foi salva. Fechar agora descarta o que está escrito. Fechar mesmo assim?'

/**
 * Lê os campos de um `<form>` como o mapa que `houveRascunho` compara.
 *
 * `FormData` já sabe percorrer o formulário inteiro, inclusive os campos que o
 * navegador desenha sozinho: usar o DOM à mão erraria em `select` múltiplo e em
 * `input type=file`.
 *
 * Campo repetido (uma lista de caixas com o mesmo `name`) entra pelo último
 * valor, e isso basta para a pergunta que este módulo responde: qualquer
 * diferença já manda perguntar, e o que interessa é haver diferença, não qual.
 */
export function camposDoFormulario(formulario: HTMLFormElement): Map<string, ValorDeCampo> {
  const mapa = new Map<string, ValorDeCampo>()
  for (const [nome, valor] of new FormData(formulario)) {
    mapa.set(nome, valor)
  }
  return mapa
}
