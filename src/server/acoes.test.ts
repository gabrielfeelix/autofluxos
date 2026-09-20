import { readdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
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
/**
 * **A varredura cobre todos os `acoes-*.ts`, e não só `acoes.ts`.**
 *
 * Ela lia um arquivo só, e isso era um buraco do tamanho de dezessete arquivos:
 * uma ação escrita em `acoes-crm.ts` ou num arquivo novo não passava por trava
 * nenhuma. A lista sai do diretório, e não de um `const`, porque um arquivo
 * novo tem que entrar sozinho: uma lista escrita à mão é exatamente o lugar
 * onde alguém esquece de acrescentar o arquivo que acabou de criar.
 */
const PASTA = dirname(fileURLToPath(import.meta.url))
const ARQUIVOS = readdirSync(PASTA)
  .filter((nome) => (nome === 'acoes.ts' || nome.startsWith('acoes-')) && nome.endsWith('.ts'))
  .filter((nome) => !nome.endsWith('.test.ts'))
  .sort()

const CODIGO = ARQUIVOS.map((nome) => readFileSync(`${PASTA}/${nome}`, 'utf8')).join('\n')

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
  it('encontra as ações dos arquivos — se isto zerar, o resto não prova nada', () => {
    // Uma mudança de formatação que quebrasse o recorte faria todos os testes
    // abaixo passarem por vacuidade. Este é o teste do teste.
    expect(ACOES.length).toBeGreaterThan(25)
    // E o varredor precisa estar achando os arquivos: um `filter` errado
    // deixaria a lista com um arquivo só e a trava voltaria a ser a de antes.
    expect(ARQUIVOS.length).toBeGreaterThan(10)
    expect(ARQUIVOS).toContain('acoes.ts')
  })

  it.each(ACOES.filter((acao) => acao.parametros.includes('clienteId')).map((a) => a.nome))(
    '%s confere o acesso ao cliente',
    (nome) => {
      const acao = ACOES.find((a) => a.nome === nome)!
      /*
       * `exigirCapacidade` chama `exigirAcessoAoCliente` por dentro: quem usa
       * a primeira tem as duas fronteiras cobertas.
       *
       * As duas últimas formas apareceram quando a varredura passou a ler
       * todos os `acoes-*.ts`. Elas **são** conferência de acesso, por outro
       * caminho: `exigirAdministracao` pergunta o papel na conta, e
       * `papelNaConta` devolve `null` para quem não é da conta, o que a ação
       * trata como recusa. Aceitá-las aqui é reconhecer o que o código faz;
       * não aceitá-las faria a trava pedir uma reescrita que não muda
       * comportamento nenhum.
       */
      const confere =
        acao.corpo.includes('await exigirAcessoAoCliente(clienteId)') ||
        acao.corpo.includes('await exigirCapacidade(clienteId') ||
        acao.corpo.includes('await exigirAdministracao(clienteId)') ||
        acao.corpo.includes('await papelNaConta(clienteId')
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

    /*
     * **O número subiu de 3 para 27, e não é regressão: é a medida certa
     * aparecendo pela primeira vez.**
     *
     * Até a T4.1 a varredura lia só `acoes.ts`, e as ações dos outros
     * dezessete arquivos não passavam por trava nenhuma. O 3 media um arquivo;
     * o 27 mede os dezoito. Nenhuma ação perdeu conferência de acesso — o
     * teste acima prova isso para todas —, o que elas não declaram é **qual**
     * capacidade exigem.
     *
     * Continua sendo um teto que só desce. Uma ação nova escrita com a
     * fronteira antiga aparece aqui, em vez de entrar quieta na conta.
     */
    expect(semCapacidade.length, `ainda sem capacidade: ${semCapacidade.join(', ')}`)
      .toBeLessThanOrEqual(27)
  })

  /**
   * As de `acoes.ts` que não recebem cliente: criar cliente não tem id para
   * conferir, então a pergunta certa é quem pode criar.
   *
   * Limitado a `acoes.ts` de propósito. Os outros arquivos têm ações sem
   * `clienteId` que não são criação de conta — elas recebem o id do contato, da
   * mensagem ou do alerta, e resolvem a conta a partir dele. Exigir
   * `exigirOperadorDa4YU` nelas trancaria o produto inteiro para os clientes.
   * Cobri-las é outra varredura, com outra pergunta, e está anotada no handoff.
   */
  it('as de acoes.ts que não recebem cliente exigem ser operador da 4YU', () => {
    const daAcoes = lerAcoes(readFileSync(`${PASTA}/acoes.ts`, 'utf8'))
    const semCliente = daAcoes.filter((acao) => !acao.parametros.includes('clienteId'))
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
