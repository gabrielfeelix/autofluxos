import { expect, test, type BrowserContext } from '@playwright/test'
import { rest } from './banco-local'
import { cadastrar, identidade } from './cadastro'

/**
 * A barra de Contatos (plano de UX de 23/09, tarefa 2.3).
 *
 * O que importa aqui é o contrato dos filtros: eles somam, tirar um não apaga
 * os outros nem a busca, e a URL reproduz a tela inteira ao recarregar.
 */

let painelDaConta = ''
let sessaoSalva: Awaited<ReturnType<BrowserContext['storageState']>> | null = null

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  painelDaConta = await cadastrar(page, identidade())
  sessaoSalva = await contexto.storageState()
  await contexto.close()
})

test.beforeEach(async ({ context }) => {
  if (sessaoSalva) await context.addCookies(sessaoSalva.cookies)
})

const clienteDaConta = () => painelDaConta.split('/').pop()!

test('conta sem ninguém cadastra o primeiro contato pelo cabeçalho', async ({ page }) => {
  await page.goto(`${painelDaConta}/leads`)
  await page.getByRole('button', { name: '+ Novo contato' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Márcia Primeira')
  await page.getByRole('textbox', { name: 'Telefone com DDD' }).fill('(44) 99123-4501')
  await page.getByRole('dialog').getByRole('button', { name: 'Criar e abrir' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.goto(`${painelDaConta}/leads`)
  await expect(page.getByRole('link', { name: 'Márcia Primeira' })).toBeVisible()
})

test('dois filtros e uma busca: tirar um preserva o resto, e a URL reproduz a tela', async ({ page }) => {
  const cliente = clienteDaConta()
  const sufixo = Date.now().toString().slice(-5)
  const contatos = await rest('contacts', {
    method: 'POST',
    body: [
      { client_id: cliente, wa_id: `55449921${sufixo}`, nome: 'Márcia Filtro' },
      { client_id: cliente, wa_id: `55449922${sufixo}`, nome: 'Marcio Filtro' },
      { client_id: cliente, wa_id: `55449923${sufixo}`, nome: 'Márcia Sem Etiqueta' },
    ],
  })
  const [etiqueta] = await rest('etiquetas', {
    method: 'POST',
    body: { client_id: cliente, nome: 'Plano anual', cor: 'verde' },
  })
  await rest('contato_etiquetas', {
    method: 'POST',
    body: [
      { contato_id: contatos[0]!.id, etiqueta_id: etiqueta!.id },
      { contato_id: contatos[1]!.id, etiqueta_id: etiqueta!.id },
    ],
  })

  await page.goto(`${painelDaConta}/leads`)
  const linhas = page.locator('#tabela-de-contatos tbody tr')

  // Filtro 1: etiqueta manual. Filtro 2: cliente que ainda não comprou.
  await page.getByRole('button', { name: 'Filtros dos contatos' }).click()
  await page.getByRole('button', { name: /Plano anual/ }).click()
  await expect(page).toHaveURL(/marca=/)
  await page.getByRole('button', { name: 'Filtros dos contatos' }).click()
  await page.getByRole('button', { name: 'Ainda não comprou' }).click()
  await expect(page).toHaveURL(/nivel=sem_compra/)

  // Busca sem acento, pela barra (Enter).
  await page.getByRole('searchbox', { name: 'Buscar contato por nome ou telefone' }).fill('marcia')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/busca=marcia/)
  await expect(linhas).toHaveCount(1)
  await expect(linhas.first()).toContainText('Márcia Filtro')

  // Tira o filtro de cliente: etiqueta e busca continuam valendo.
  await page.getByRole('button', { name: 'Remover filtro Cliente: Ainda não comprou' }).click()
  await expect(page).not.toHaveURL(/nivel=/)
  await expect(page).toHaveURL(/busca=marcia/)
  await expect(page).toHaveURL(/marca=/)
  await expect(page.getByRole('button', { name: 'Remover filtro Etiqueta: Plano anual' })).toBeVisible()
  await expect(linhas).toHaveCount(1)
  await expect(linhas.first()).toContainText('Márcia Filtro')

  // Recarregar a URL dá a mesma tela.
  await page.reload()
  await expect(page.getByRole('searchbox', { name: 'Buscar contato por nome ou telefone' })).toHaveValue('marcia')
  await expect(page.getByRole('button', { name: 'Remover filtro Busca: marcia' })).toBeVisible()
  await expect(linhas).toHaveCount(1)
  await expect(linhas.first()).toContainText('Márcia Filtro')

  // Limpar tudo volta para a base inteira.
  await page.getByRole('button', { name: 'Limpar tudo' }).click()
  await expect(page).toHaveURL(/\/leads$/)
  await expect(linhas).toHaveCount(4)
})
