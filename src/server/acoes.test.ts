import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * A trava que não é código de produção: **nenhuma Server Action pode esquecer
 * de perguntar quem é.**
 *
 * O arquivo `acoes.ts` tem trinta e sete ações, e trinta e cinco delas começam
 * com a mesma linha. Repetição desse tamanho não se mantém por disciplina — a
 * trigésima oitava vai ser escrita com pressa, e o esquecimento não aparece em
 * nenhum teste funcional, porque a ação continua funcionando: ela só passa a
 * funcionar para quem não devia.
 *
 * Então o teste lê o **texto** do arquivo. É grosseiro de propósito: ele não
 * prova que a conferência está certa (isso é `sessao.ts` e os testes de
 * `proxy.ts`), prova que ela **existe** em toda ação que recebe um cliente. As
 * duas coisas juntas é que fecham.
 *
 * **A T2.1 passou a exigir a segunda pergunta.** Antes bastava
 * `exigirAcessoAoCliente`, que responde "esta pessoa alcança esta empresa?".
 * Agora a ação precisa dizer também **o que** ela exige, por
 * `exigirCapacidade` — que faz a primeira conferência por dentro, então
 * chamá-la cobre as duas. Aceitar as duas formas é o que permite a varredura
 * acontecer em partes sem deixar o arquivo destravado no meio do caminho.
 */
const CAMINHO = fileURLToPath(new URL('./acoes.ts', import.meta.url))
const CODIGO = readFileSync(CAMINHO, 'utf8')

type Acao = { nome: string; parametros: string; corpo: string }

/**
 * Recorta as ações exportadas.
 *
 * A contagem de parênteses acha o fim dos parâmetros, e a de `<>` pula o tipo
 * de retorno — `Promise<{ ok: boolean }>` traz uma chave antes do corpo, e
 * procurar a primeira `{` acharia essa.
 */
function lerAcoes(codigo: string): Acao[] {
  const acoes: Acao[] = []

  for (const achado of codigo.matchAll(/export async function (\w+)\(/g)) {
    const inicio = achado.index! + achado[0].length
    let i = inicio - 1
    let parenteses = 0
    for (;; i++) {
      if (codigo[i] === '(') parenteses++
      else if (codigo[i] === ')' && --parenteses === 0) break
    }
    const parametros = codigo.slice(inicio, i)

    let angulos = 0
    for (i += 1; ; i++) {
      if (codigo[i] === '<') angulos++
      else if (codigo[i] === '>') angulos--
      else if (codigo[i] === '{' && angulos === 0) break
    }

    const proxima = codigo.indexOf('\nexport async function ', i)
    acoes.push({
      nome: achado[1]!,
      parametros,
      corpo: codigo.slice(i, proxima === -1 ? codigo.length : proxima),
    })
  }

  return acoes
}

const ACOES = lerAcoes(CODIGO)

describe('toda ação pergunta quem é antes de agir', () => {
  it('encontra as ações do arquivo — se isto zerar, o resto não prova nada', () => {
    // Uma mudança de formatação que quebrasse o recorte faria todos os testes
    // abaixo passarem por vacuidade. Este é o teste do teste.
    expect(ACOES.length).toBeGreaterThan(25)
  })

  it.each(ACOES.filter((acao) => acao.parametros.includes('clienteId')).map((a) => a.nome))(
    '%s confere o acesso ao cliente',
    (nome) => {
      const acao = ACOES.find((a) => a.nome === nome)!
      // `exigirCapacidade` chama `exigirAcessoAoCliente` por dentro: quem usa
      // a primeira tem as duas fronteiras cobertas.
      const confere =
        acao.corpo.includes('await exigirAcessoAoCliente(clienteId)') ||
        acao.corpo.includes('await exigirCapacidade(clienteId')
      expect(confere, `${nome}: não pergunta quem é`).toBe(true)
    },
  )

  /**
   * **A que diz o que exige, e a que só diz quem é.**
   *
   * Passar `exigirAcessoAoCliente` prova que a empresa foi conferida, e não
   * que a capacidade foi. Esta lista é o que ainda falta varrer: ela encolhe
   * conforme a T2.1 avança, e o teste imprime os nomes para que "falta
   * varrer" seja uma lista concreta em vez de uma intenção.
   *
   * O número é um **teto que só desce**. Ele existe para que uma ação nova
   * escrita com a fronteira antiga apareça aqui, em vez de entrar quieta na
   * conta dos pendentes.
   */
  it('as que ainda não declaram capacidade são uma lista que só encolhe', () => {
    const semCapacidade = ACOES.filter(
      (acao) =>
        acao.parametros.includes('clienteId') &&
        !acao.corpo.includes('await exigirCapacidade(clienteId'),
    ).map((a) => a.nome)

    // As três restantes são as da equipe (`acaoCadastrarPessoaNaConta`,
    // `acaoDefinirPapelNaConta`, `acaoRemoverDaConta`), e elas já conferem
    // `podeAdministrarConta` — a capacidade `configurar_empresa` é a mesma
    // pergunta com outro nome, e trocá-la é da T2.2, junto da tela de acesso.
    expect(semCapacidade.length, `ainda sem capacidade: ${semCapacidade.join(', ')}`)
      .toBeLessThanOrEqual(3)
  })

  it('as que não recebem cliente exigem ser operador da 4YU', () => {
    // Criar cliente não tem id para conferir — o cliente ainda não existe. A
    // pergunta certa é quem pode criar.
    const semCliente = ACOES.filter((acao) => !acao.parametros.includes('clienteId'))
    expect(semCliente.map((a) => a.nome)).toEqual(['acaoCriarCliente', 'acaoCriarExemplo'])

    for (const acao of semCliente) {
      expect(acao.corpo).toContain('await exigirOperadorDa4YU()')
    }
  })

  it('a conferência vem antes de qualquer escrita', () => {
    // Conferir depois de gravar é não conferir: o dado já mudou quando o
    // `redirect` acontece.
    for (const acao of ACOES) {
      const guarda = acao.corpo.search(/await exigir(AcessoAoCliente|OperadorDa4YU|Capacidade)\(/)
      const escrita = acao.corpo.search(/\bawait (criar|salvar|publicar|apagar|atualizar|guardar|trocar|definir|encerrar|alterar|desconectar|aplicar|corrigir)/)
      if (escrita === -1) continue
      expect(guarda, `${acao.nome}: confere depois de escrever`).toBeLessThan(escrita)
    }
  })
})
