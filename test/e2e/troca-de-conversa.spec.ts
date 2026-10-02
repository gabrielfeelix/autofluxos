import { expect, test } from '@playwright/test'
import { rest } from './banco-local'
import { cadastrar, identidade } from './cadastro'

/**
 * Trocar de conversa no Inbox sem navegar (`aberta-local.ts`), e a mensagem
 * nova chegando pelo Broadcast do Supabase (0119).
 *
 * Prova o que o módulo puro não alcança: o clique não pede página ao roteador
 * (nenhum pedido RSC), o número de não lidas some no clique, uma mensagem
 * gravada direto no banco aparece na conversa aberta, o voltar do navegador
 * volta a conversa, e no celular o clique leva para a coluna da conversa.
 * Os prints em 1440 e 390 ficam em `PRINTS`.
 */
const PRINTS = process.env.PRINTS ?? 'test-results/prints'

test('troca de conversa sem navegar, número some no clique, mensagem chega ao vivo', async ({ page }) => {
  test.setTimeout(240_000)
  const painel = await cadastrar(page, identidade())
  const clienteId = painel.split('/').pop()!

  const agora = Date.now()
  const nomes = ['Ana Souza', 'Bruno Lima', 'Carla Dias']
  const contatos: string[] = []
  for (const [i, nome] of nomes.entries()) {
    const [contato] = await rest('contacts', {
      method: 'POST',
      body: { client_id: clienteId, wa_id: `554499990000${i}`, nome },
    })
    contatos.push(contato!.id)
    await rest('messages', {
      method: 'POST',
      body: [
        { contact_id: contato!.id, direcao: 'entrada', texto: `Oi, aqui é ${nome}`, ts: new Date(agora - (i + 2) * 60_000).toISOString() },
        { contact_id: contato!.id, direcao: 'entrada', texto: 'Queria saber o preço', ts: new Date(agora - (i + 1) * 60_000).toISOString() },
      ],
    })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${painel}/inbox`)
  const fila = page.getByRole('navigation', { name: 'Conversas' })
  await expect(fila.getByText('Carla Dias')).toBeVisible({ timeout: 60_000 })
  await page.screenshot({ path: `${PRINTS}/1440-inicio.png` })

  // Nenhuma navegação do roteador (RSC) no clique: a conversa vem da API.
  const rsc: string[] = []
  page.on('request', (pedido) => {
    if (pedido.headers()['rsc'] === '1') rsc.push(pedido.url())
  })

  // Aquece as rotas (o `next dev` compila na primeira chamada) antes de medir.
  await fila.getByRole('link', { name: /Carla Dias/ }).click()
  await expect(page.locator('p.bolha-deles', { hasText: 'Oi, aqui é Carla Dias' })).toBeVisible({ timeout: 90_000 })
  await page.waitForTimeout(3000)

  const linhaBruno = fila.getByRole('link', { name: /Bruno Lima/ })
  await linhaBruno.hover()
  await page.waitForTimeout(800)
  const t0 = Date.now()
  await linhaBruno.click()
  await expect(page.locator('p.bolha-deles', { hasText: 'Oi, aqui é Bruno Lima' })).toBeVisible()
  const msClique = Date.now() - t0
  await expect(page).toHaveURL(new RegExp(`conversa=${contatos[1]}`))
  // O número de não lidas da linha aberta some no clique.
  await expect(linhaBruno.getByText(/^\d+$/)).toHaveCount(0)
  await page.screenshot({ path: `${PRINTS}/1440-bruno.png` })

  // Mensagem nova na conversa aberta, gravada direto no banco.
  const t1 = Date.now()
  await rest('messages', {
    method: 'POST',
    body: { contact_id: contatos[1], direcao: 'entrada', texto: 'Mensagem ao vivo agora', ts: new Date().toISOString() },
  })
  await expect(page.locator('p.bolha-deles', { hasText: 'Mensagem ao vivo agora' })).toBeVisible({ timeout: 40_000 })
  const msAoVivo = Date.now() - t1

  // Voltar do navegador volta a conversa.
  await fila.getByRole('link', { name: /Ana Souza/ }).click()
  await expect(page.getByRole('heading', { level: 2, name: /Ana Souza/ }).first()).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 2, name: /Bruno Lima/ }).first()).toBeVisible()

  // Os tempos variam com a máquina e com o `next dev` compilando; o que se
  // afirma é a ausência de navegação, e os números vão para o relatório.
  expect(rsc).toEqual([])
  test.info().annotations.push({ type: 'tempos', description: JSON.stringify({ msClique, msAoVivo }) })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${painel}/inbox`)
  await expect(page.getByRole('navigation', { name: 'Conversas' }).getByText('Carla Dias')).toBeVisible({ timeout: 60_000 })
  await page.screenshot({ path: `${PRINTS}/390-lista.png` })
  await page.getByRole('navigation', { name: 'Conversas' }).getByRole('link', { name: /Bruno Lima/ }).click()
  // Sem compilar nada, mas a primeira chamada desta página ainda é de `next dev`.
  await expect(page.locator('p.bolha-deles', { hasText: 'Mensagem ao vivo agora' })).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${PRINTS}/390-conversa.png` })
})
