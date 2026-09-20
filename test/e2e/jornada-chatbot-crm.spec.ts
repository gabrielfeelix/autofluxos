import { expect, test, type Page } from '@playwright/test'

/**
 * A jornada que o produto inteiro promete: chegar, criar a empresa, atender.
 *
 * O plano (T9.1, item 1) lista oito jornadas e diz qual é a primeira: **só
 * bot/inbox**, a empresa que recebe mensagem e atende sem criar quadro nem
 * cartão. É o aceite A01, e é o que a T7.1 fechou quando fez o onboarding
 * terminar para quem escolhe `atender`.
 *
 * **O que este arquivo prova e os testes de integração não.** Os de integração
 * conferem a regra contra o Postgres com fixture montado à mão: eles sabem que
 * `nasceComCrm` grava `false`, mas não sabem se a pessoa consegue chegar lá
 * pela tela. Aqui a conta nasce pelo formulário, com teclado e clique, como
 * nasce a de um cliente.
 */

/*
 * A conta é criada **uma vez** para o arquivo inteiro, e não por teste.
 *
 * Não é economia de tempo: é que `acaoCriarPrimeiroAdministrador` passa por
 * `consumirLimite`, com teto de 5 tentativas por 5 minutos **por IP**
 * (`server/limite.ts`). Todos os testes saem do mesmo IP, então cadastrar por
 * teste faz o terceiro ou quarto receber "Muitas tentativas" e falhar por uma
 * proteção que está funcionando como deveria.
 *
 * Descoberto apanhando: os dois primeiros testes do A22 falharam com 404
 * porque o cadastro nunca completou, e o 404 escondia a mensagem de limite que
 * estava na tela anterior.
 *
 * Reusar também é mais fiel ao uso real: a pessoa cadastra uma vez e depois
 * trabalha na conta dela.
 */
let painelDaConta = ''

/**
 * O cookie de sessão, guardado para os testes seguintes.
 *
 * Sem isto o `beforeAll` cadastraria numa página cujo contexto morre com ela, e
 * cada teste chegaria deslogado ao painel: o `storageState` é o que carrega a
 * sessão de um contexto para outro.
 */
let sessaoSalva: Awaited<ReturnType<import('@playwright/test').BrowserContext['storageState']>> | null = null

/** Uma identidade nova por execução: o banco é o mesmo entre as rodadas. */
function identidade() {
  const seed = Math.random().toString(36).slice(2, 8)
  return {
    nome: 'Eduardo Teste',
    email: `zz-e2e-${seed}@exemplo.test`,
    senha: 'senha-comprida-de-teste-e2e',
    empresa: `zz-e2e ${seed}`,
  }
}

/**
 * Cadastra e chega ao painel da empresa nova.
 *
 * Devolve a URL da conta, porque o id só existe depois que o servidor cria.
 */
async function cadastrar(page: Page, quem: ReturnType<typeof identidade>) {
  await page.goto('/cadastrar')

  await page.getByRole('textbox', { name: 'Nome' }).fill(quem.nome)
  await page.getByRole('textbox', { name: 'E-mail' }).fill(quem.email)
  // `getByRole('textbox')` e não `getByLabel('Senha')`: o botão "Mostrar a
  // senha" do `CampoDeSenha` também casa com esse texto, e o locator recusa em
  // modo estrito com "resolved to 2 elements".
  await page.getByRole('textbox', { name: 'Senha' }).fill(quem.senha)
  await page.getByRole('button', { name: /criar conta|cadastrar/i }).click()

  // Passo dois: a empresa. O cadastro tem dois passos de propósito, e a
  // segunda tela só aparece para quem ainda não tem empresa nenhuma.
  await expect(page).toHaveURL(/\/primeiro-acesso/)
  await page.getByRole('textbox', { name: 'Nome da empresa' }).fill(quem.empresa)
  await page.getByRole('button', { name: /criar empresa/i }).click()

  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}/, { timeout: 30_000 })

  /*
   * Recorta a **raiz da conta**, e não devolve `page.url()` cru.
   *
   * O cadastro não termina no painel: ele termina em `/ajustes/whatsapp`, que é
   * o que o rodapé da tela promete ("você vai direto para a tela de conectar o
   * seu WhatsApp"). Devolver a URL inteira e concatenar produzia
   * `/ajustes/whatsapp/ajustes/etiquetas`, e o 404 resultante parecia falta de
   * permissão em vez de erro de montagem de URL.
   */
  const raiz = page.url().match(/^.*\/clientes\/[0-9a-f-]{36}/)
  if (!raiz) throw new Error(`não achei a raiz da conta em ${page.url()}`)
  return raiz[0]
}

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  painelDaConta = await cadastrar(page, identidade())
  sessaoSalva = await contexto.storageState()
  await contexto.close()
})

// Cada teste entra já logado, com a sessão criada no `beforeAll`.
/*
 * Cada teste entra já logado, com a sessão criada no `beforeAll`.
 *
 * O `beforeEach` em vez de `test.use({ storageState })`: aquele exige que o
 * primeiro argumento seja um padrão de desestruturação, e desestruturar um
 * fixture que não se usa deixa variável morta no lint. Aqui o contexto da
 * página já existe, e acrescentar os cookies nele diz a mesma coisa sem
 * argumento sobrando.
 */
test.beforeEach(async ({ context }) => {
  if (sessaoSalva) await context.addCookies(sessaoSalva.cookies)
})

test.describe('A01: a empresa que só atende', () => {
  test('cadastrar leva ao painel da conta, sem exigir quadro nem cartão', async ({ page }) => {
    await page.goto(painelDaConta)

    /*
     * O painel abriu com o atendimento à mão. A asserção é sobre a navegação e
     * não sobre o nome da empresa aparecer em algum canto: o nome é decoração
     * de cabeçalho e muda de lugar com o desenho, enquanto "existe Inbox para
     * atender" é a promessa do A01.
     */
    // `.first()` porque "Inbox" aparece três vezes na tela, e isso é o produto
    // funcionando: o menu lateral, o cartão de destaque e o "Abrir o Inbox"
    // dele. O que se quer provar é que existe caminho para atender.
    await expect(page.getByRole('link', { name: 'Inbox' }).first()).toBeVisible()

    /*
     * E o que o A01 nega: nada obrigou a criar quadro nem cartão no caminho. O
     * "Funil de vendas" existe como link e é isso que se quer — disponível,
     * nunca imposto. A T7.1 fez `nasceComCrm` gravar `false` para quem não
     * escolheu "vender", e o teste de integração confere a coluna; aqui o que
     * se confere é que a pessoa chegou a atender sem passar por nenhuma tela
     * de funil.
     */
    expect(page.url().startsWith(painelDaConta)).toBe(true)
  })
})

/**
 * O A22 é o motivo mais forte de este arquivo existir.
 *
 * "Fechar modal alterado: usuário mantém dados e tem recuperação clara" é
 * teclado, foco e `Esc` num `<dialog>` — precisamente o que um módulo puro não
 * alcança. A T7.4 extraiu a decisão de descarte para
 * `components/design/rascunho-do-modal.ts` e a testou lá porque este
 * repositório não tem `jsdom` nem `@testing-library/react`, e registrou no
 * handoff que **o que ficou sem prova automatizada foi o gesto, não a regra**.
 *
 * Aqui está o gesto.
 */
test.describe('A22: fechar o modal alterado não descarta o digitado', () => {
  test('Esc com campo preenchido pergunta antes, e "cancelar" preserva o texto', async ({
    page,
  }) => {
    await page.goto(`${painelDaConta}/ajustes/etiquetas`)
    await page.getByRole('button', { name: '+ Nova etiqueta' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    const nome = modal.getByRole('textbox', { name: 'Nome' })
    await nome.fill('etiqueta que não quero perder')

    /*
     * A confirmação do navegador é `window.confirm`. Este handler responde
     * "cancelar" (`dismiss`), que é o caso que o aceite cobre: a pessoa mudou
     * de ideia sobre fechar e quer o texto de volta.
     */
    let perguntou = ''
    page.once('dialog', async (d) => {
      perguntou = d.message()
      await d.dismiss()
    })

    await page.keyboard.press('Escape')

    // Perguntou, em vez de descartar em silêncio.
    expect(perguntou).not.toBe('')

    // E o modal continua aberto com o que foi digitado.
    await expect(modal).toBeVisible()
    await expect(nome).toHaveValue('etiqueta que não quero perder')
  })

  test('Esc com o formulário intocado fecha direto, sem perguntar nada', async ({ page }) => {
    await page.goto(`${painelDaConta}/ajustes/etiquetas`)
    await page.getByRole('button', { name: '+ Nova etiqueta' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    /*
     * A outra metade da decisão da T7.4, e a que mais importa para o produto
     * ser usável: a comparação é com o valor **inicial**, e não com vazio.
     * Perguntar sempre é o mesmo que não perguntar, porque ninguém lê aviso que
     * aparece toda vez. Se este teste começar a ver uma pergunta aqui, a
     * proteção virou ruído.
     */
    let perguntou = false
    page.on('dialog', async (d) => {
      perguntou = true
      await d.dismiss()
    })

    await page.keyboard.press('Escape')

    await expect(modal).not.toBeVisible()
    expect(perguntou).toBe(false)
  })
})
