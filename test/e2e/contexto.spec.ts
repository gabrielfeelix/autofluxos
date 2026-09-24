import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { rest } from './banco-local'
import { cadastrar, identidade } from './cadastro'

/**
 * Ficha e Inbox dizendo a mesma coisa sem F5 (plano de UX de 23/09, 8.5).
 *
 * O que muda numa tela aparece na outra ao voltar pelo link, e a página nunca
 * recarrega: o contador de `load` fica em 1 do começo ao fim. É o que prova que
 * a navegação foi do cliente e que o dado novo veio de `recarregarContato`, e
 * não de um recarregamento que esconderia o defeito.
 */

let painelDaConta = ''
let nomeDoDono = ''
let sessaoSalva: Awaited<ReturnType<BrowserContext['storageState']>> | null = null

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  const quem = identidade()
  nomeDoDono = quem.nome
  painelDaConta = await cadastrar(page, quem)
  sessaoSalva = await contexto.storageState()
  await contexto.close()
})

test.beforeEach(async ({ context }) => {
  if (sessaoSalva) await context.addCookies(sessaoSalva.cookies)
})

const clienteDaConta = () => painelDaConta.split('/').pop()!

async function criarContato(nome: string) {
  const [contato] = await rest('contacts', {
    method: 'POST',
    body: { client_id: clienteDaConta(), wa_id: `55449913${Date.now().toString().slice(-5)}`, nome },
  })
  return contato!.id as string
}

function contarCargas(page: Page) {
  const cargas = { total: 0 }
  page.on('load', () => {
    cargas.total += 1
  })
  return cargas
}

test('resolver no Inbox aparece na ficha, e o responsável da ficha aparece no Inbox', async ({ page }) => {
  const contatoId = await criarContato('Rita Contexto')
  const cargas = contarCargas(page)

  await page.goto(`${painelDaConta}/inbox?conversa=${contatoId}`)
  await page.getByRole('button', { name: 'Marcar como resolvida' }).click()
  await expect(page.getByRole('button', { name: 'Reabrir conversa' })).toBeVisible()

  // Para a ficha pelo link: ela sabe de onde veio e já mostra o estado novo.
  await page.getByRole('link', { name: 'Ver ficha completa' }).click()
  await expect(page).toHaveURL(new RegExp(`/leads/${contatoId}\\?volta=`))
  await expect(page.getByRole('link', { name: '← Inbox' })).toBeVisible()
  await expect(page.getByText('Atendimento encerrado').first()).toBeVisible()

  // Na ficha, a pessoa passa a ser a responsável.
  await page.getByRole('button', { name: /Quem cuida deste contato/ }).click()
  await page.getByRole('option', { name: nomeDoDono }).click()

  // De volta ao Inbox pelo link, e a conversa já diz quem cuida dela. Ela
  // está resolvida, então a fila de abertas não a mostra, e o aviso diz isso.
  await page.getByRole('link', { name: '← Inbox' }).click()
  await expect(page).toHaveURL(new RegExp(`/inbox\\?conversa=${contatoId}`))
  await expect(page.getByText(`Responsável: ${nomeDoDono}`).first()).toBeVisible()
  await expect(page.getByText('está fora do filtro atual')).toBeVisible()

  expect(cargas.total).toBe(1)
})

test('ficha abre na aba pedida, e volta estranha cai em Contatos', async ({ page }) => {
  const contatoId = await criarContato('Rita Aba')
  await page.goto(`${painelDaConta}/leads/${contatoId}?aba=historico&volta=https://outro.site`)
  await expect(page.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: /Histórico/ })).toBeFocused()
  await expect(page.getByRole('link', { name: '← Contatos' })).toHaveAttribute(
    'href',
    `/clientes/${clienteDaConta()}/leads`,
  )
})
