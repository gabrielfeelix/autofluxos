import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * A mesma trava de `acoes.test.ts`, do outro lado: **nenhuma rota de API que
 * recebe `clienteId` pode esquecer de perguntar o que quem chama pode fazer.**
 *
 * Por que uma trava separada, e não confiar na revisão: rota é o caminho que
 * não tem botão. Esconder o link não esconde a URL, e o `fetch` que a tela faz
 * sozinha — stream, contador, notificação — é exatamente o que ninguém pensa
 * em conferir. Até a T2.2 as quatro rotas conferiam só a empresa, então quem
 * perdesse `atender` pela tela de acesso continuava recebendo por elas.
 *
 * O teste lê o **texto** dos arquivos. É grosseiro de propósito: ele não prova
 * que a capacidade escolhida está certa (isso é `core/permissoes.test.ts`),
 * prova que **existe uma**.
 */
const RAIZ = fileURLToPath(new URL('./clientes', import.meta.url))

function rotas(pasta: string): string[] {
  const achadas: string[] = []
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome)
    if (statSync(caminho).isDirectory()) achadas.push(...rotas(caminho))
    else if (nome === 'route.ts') achadas.push(caminho)
  }
  return achadas
}

const ROTAS = rotas(RAIZ).map((caminho) => ({
  caminho,
  nome: caminho.slice(RAIZ.length + 1),
  codigo: readFileSync(caminho, 'utf8'),
}))

describe('toda rota de cliente confere a capacidade', () => {
  it('encontra as rotas — se isto zerar, o resto não prova nada', () => {
    // Uma mudança de estrutura que quebrasse a varredura faria os testes
    // abaixo passarem por vacuidade. Este é o teste do teste.
    expect(ROTAS.length).toBeGreaterThan(0)
  })

  it.each(ROTAS.map((r) => r.nome))('%s exige uma capacidade', (nome) => {
    const rota = ROTAS.find((r) => r.nome === nome)!
    expect(rota.codigo, `${nome}: confere só a empresa, ou nada`).toContain(
      'await exigirCapacidade(',
    )
  })

  /**
   * **Conferir depois de ler é não conferir.**
   *
   * Uma rota que busca e só então pergunta já pagou a consulta e já tem o dado
   * em memória — e um erro no meio pode devolvê-lo na mensagem.
   */
  it.each(ROTAS.map((r) => r.nome))('%s confere antes de buscar', (nome) => {
    const rota = ROTAS.find((r) => r.nome === nome)!
    const guarda = rota.codigo.indexOf('await exigirCapacidade(')
    const leitura = rota.codigo.search(
      /\bawait (listar|ler|buscar|contar|pulso|acharCliente)/,
    )
    if (leitura === -1) return
    expect(guarda, `${nome}: busca antes de conferir`).toBeLessThan(leitura)
  })

  /**
   * **A recusa é 404, e não 403** (RB-42).
   *
   * Confirmar que o endpoint existe para quem não o alcança já é informação:
   * um 403 diz "existe e você não entra", que é metade do mapa.
   */
  it.each(ROTAS.map((r) => r.nome))('%s recusa com 404, não 403', (nome) => {
    const rota = ROTAS.find((r) => r.nome === nome)!
    expect(rota.codigo).not.toContain('status: 403')
  })
})
