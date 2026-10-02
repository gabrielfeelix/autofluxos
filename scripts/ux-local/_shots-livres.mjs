import { chromium } from 'playwright'
const [saida, larg, alt, ...rotas] = process.argv.slice(2)
const b = await chromium.launch()
const ctx = await b.newContext({ baseURL: 'http://localhost:3100', viewport: { width: +larg, height: +alt }, reducedMotion: 'reduce', ...(process.env.SESSAO ? { storageState: '.ux-local/sessao.json' } : {}) })
const p = await ctx.newPage()
for (const r of rotas) { const [nome, caminho] = r.split('|'); await p.goto(caminho, { timeout: 180000 }).catch(e=>console.log('erro',nome)); await p.waitForTimeout(900); await p.screenshot({ path: `${saida}/${nome}.png` }) }
await b.close()
