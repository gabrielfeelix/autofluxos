import { createHmac } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { rest } from './banco-local'
import { identidade } from './cadastro'

/**
 * Verificação em duas etapas, pela tela.
 *
 * O que se prova: o administrador da plataforma sem 2FA não entra na
 * administração e é levado a ativar; ligar exige um código de verdade do
 * aplicativo; depois disso o login pede o código, e sem ele não há sessão.
 */

function base32(texto: string): Buffer {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of texto.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function totp(segredo: string, agora = Date.now()): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(agora / 30_000)))
  const h = createHmac('sha1', base32(segredo)).update(contador).digest()
  const o = h[h.length - 1] & 0xf
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, '0')
}

test('admin é obrigado a ligar o 2FA, e depois o login pede o código', async ({ page }) => {
  const quem = identidade()
  // Só o primeiro passo do cadastro: a sessão já existe, e admin não precisa
  // de organização.
  await page.goto('/cadastrar')
  await page.getByRole('textbox', { name: 'Nome' }).fill(quem.nome)
  await page.getByRole('textbox', { name: 'E-mail' }).fill(quem.email)
  await page.getByRole('textbox', { name: 'Senha' }).fill(quem.senha)
  await page.getByRole('button', { name: /criar acesso|cadastrar/i }).click()
  await expect(page).toHaveURL(/\/primeiro-acesso/)
  await rest(`af_usuarios?email=eq.${encodeURIComponent(quem.email)}`, { method: 'PATCH', body: { role: 'admin' } })

  // Sem 2FA, a administração não abre: vai para a ativação.
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/ativar-duas-etapas/)

  await page.getByRole('textbox', { name: /senha/i }).fill(quem.senha)
  await page.getByRole('button', { name: 'Continuar' }).click()
  const chave = (await page.locator('code').first().textContent())?.trim() ?? ''
  expect(chave.length).toBeGreaterThan(10)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: 'test-results/duas-etapas-1440.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/duas-etapas-390.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })

  // Código errado não liga.
  await page.getByPlaceholder('Exemplo: 123456').fill('000000')
  await page.getByRole('button', { name: 'Ligar' }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  await page.getByPlaceholder('Exemplo: 123456').fill(totp(chave))
  await page.getByRole('button', { name: 'Ligar' }).click()
  // Ligou: a própria página vê o 2FA e segue para a administração.
  await expect(page).toHaveURL(/\/admin$/)

  // Sai e entra: a senha certa leva ao código, e não à sessão.
  await page.context().clearCookies()
  await page.goto('/entrar')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(quem.email)
  await page.getByRole('textbox', { name: 'Senha' }).fill(quem.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/entrar\/codigo/)
  await page.screenshot({ path: 'test-results/codigo-1440.png', fullPage: true })

  // Pular a etapa não abre nada.
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/entrar/)

  // O código ainda vale na janela seguinte; o anterior já foi usado, então
  // espera virar o intervalo de 30 s para não repetir o mesmo.
  await page.goto('/entrar')
  await page.getByRole('textbox', { name: 'E-mail' }).fill(quem.email)
  await page.getByRole('textbox', { name: 'Senha' }).fill(quem.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/entrar\/codigo/)
  const espera = 30_000 - (Date.now() % 30_000) + 500
  await page.waitForTimeout(espera)
  await page.getByPlaceholder('Exemplo: 123456').fill(totp(chave))
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 })
})
