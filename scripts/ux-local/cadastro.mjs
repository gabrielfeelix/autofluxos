// Cria a pessoa e a empresa de revisão pelo navegador e guarda a sessão.
// Uso: node scripts/ux-local/cadastro.mjs   (com o dev.sh rodando)
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

mkdirSync('.ux-local', { recursive: true })
const b = await chromium.launch()
const ctx = await b.newContext({ baseURL: `http://localhost:${process.env.PORTA ?? 3100}` })
const page = await ctx.newPage()
await page.goto('/cadastrar')
await page.getByRole('textbox', { name: 'Nome' }).fill('Gabriel Teste')
await page.getByRole('textbox', { name: 'E-mail' }).fill('revisao@local.test')
await page.getByRole('textbox', { name: 'Senha' }).fill('senha-local-123456')
await page.getByRole('button', { name: /criar conta|cadastrar/i }).click()
await page.getByRole('textbox', { name: 'Nome da empresa' }).fill('Studio Pilates Revisão')
await page.getByRole('button', { name: /criar empresa/i }).click()
await page.waitForURL(/\/clientes\/[^/]+/, { timeout: 120000 })
console.log(page.url())
await ctx.storageState({ path: '.ux-local/sessao.json' })
await b.close()
