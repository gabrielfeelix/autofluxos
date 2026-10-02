// node fatias.mjs <saida> <caminho> [prefixo]  W/H env; fatias da página inteira
import { chromium } from 'playwright'
const [saida, caminho, pref = 'f'] = process.argv.slice(2)
const larg = Number(process.env.W ?? 1440), alt = Number(process.env.H ?? 900)
const b = await chromium.launch()
const ctx = await b.newContext({ baseURL: 'http://localhost:3100', viewport: { width: larg, height: alt }, reducedMotion: 'reduce', ...(process.env.SESSAO ? { storageState: '.ux-local/sessao.json' } : {}) })
const p = await ctx.newPage()
await p.goto(caminho, { timeout: 180000 })
await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(800)
const total = await p.evaluate(() => document.documentElement.scrollHeight)
const n = Math.ceil(total / alt)
for (let i = 0; i < n; i++) {
  await p.evaluate((y) => window.scrollTo(0, y), i * alt)
  await p.waitForTimeout(350)
  await p.screenshot({ path: `${saida}/${pref}${String(i).padStart(2, '0')}.png` })
}
console.log('altura', total, 'fatias', n)
await b.close()
