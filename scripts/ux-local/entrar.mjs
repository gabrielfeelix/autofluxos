// Renova a sessão da pessoa de revisão (quando o cadastro já foi feito).
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

mkdirSync('.ux-local', { recursive: true })
const b = await chromium.launch()
const ctx = await b.newContext({ baseURL: `http://localhost:${process.env.PORTA ?? 3100}` })
const page = await ctx.newPage()
await page.goto('/entrar')
await page.getByRole('textbox', { name: 'E-mail' }).fill('revisao@local.test')
await page.getByRole('textbox', { name: 'Senha' }).fill('senha-local-123456')
await page.getByRole('button', { name: /entrar/i }).click()
await page.waitForURL(/\/clientes\/|\/contas/, { timeout: 120000 })
await ctx.storageState({ path: '.ux-local/sessao.json' })
console.log(page.url())
await b.close()
