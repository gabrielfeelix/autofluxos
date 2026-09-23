// Compara o esqueleto de cada tela com a tela pronta, do jeito que a pessoa vê.
//
// Uso: node scripts/ux-local/esqueletos.mjs <pasta-de-saida> [tela ...]
//
// Como: abre uma tela de partida, liga o cookie `revisao-atraso-ms` (o miolo da
// página demora, só no `next dev`, ver `src/server/atraso-de-revisao.ts`) e
// navega pelo roteador do Next. Enquanto o miolo não chega, o que aparece é o
// `loading.tsx` real, dentro da barra real: print. Depois espera a tela e tira
// o segundo print. Gera também
// `<tela>-comparar.png`: esqueleto | pronta | os dois sobrepostos a 50%.
//
// Esqueleto bom: na sobreposição os blocos grandes caem no mesmo lugar e nada
// muda de altura quando a tela chega.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const saida = process.argv[2] ?? '.ux-local/esqueletos'
const pedidas = process.argv.slice(3)
const psql = (sql) => execFileSync('docker', ['exec', 'supabase_db_autofluxos', 'psql', '-U', 'postgres', '-At', '-c', sql], { encoding: 'utf8' }).trim()
const C = psql(`select id from clients where nome = '${process.env.CONTA ?? 'Studio Pilates Revisão'}' limit 1`)
const CT = psql(`select id from contacts where client_id = '${C}' order by nome limit 1`)
const FL = psql(`select id from flows where client_id = '${C}' and nome = 'Agendar aula experimental'`)
const B = `/clientes/${C}`

const TELAS = {
  inicio: '', inbox: '/inbox', atividades: '/atividades', agenda: '/atividades?vista=agenda', contatos: '/leads', ficha: `/leads/${CT}`,
  funil: '/quadros', fluxos: '/fluxos', editor: `/fluxos/${FL}`, transmissoes: '/transmissoes', relatorios: '/relatorios',
  respostas: '/respostas', favoritas: '/favoritas', ajustes: '/ajustes', whatsapp: '/ajustes/whatsapp', equipe: '/ajustes/equipe',
  negocio: '/ajustes/negocio', integracoes: '/ajustes/integracoes', plano: '/ajustes/plano', etiquetas: '/ajustes/etiquetas',
}
// Parte de uma tela diferente da de destino, para o Next navegar de verdade.
const partida = (n) => (n === 'relatorios' ? '/leads' : '/relatorios')

const nomes = pedidas.length ? pedidas : Object.keys(TELAS)
mkdirSync(saida, { recursive: true })
const b = await chromium.launch()
for (const [largura, altura, sufixo] of (process.env.LARGURAS ? JSON.parse(process.env.LARGURAS) : [[1440, 900, ''], [390, 844, '-celular']])) {
  const ctx = await b.newContext({ baseURL: `http://localhost:${process.env.PORTA ?? 3100}`, storageState: '.ux-local/sessao.json', viewport: { width: largura, height: altura } })
  const p = await ctx.newPage()
  for (const n of nomes) {
    if (!(n in TELAS)) { console.log('tela desconhecida', n); continue }
    const destino = B + TELAS[n]
    const caminho = destino.split('?')[0]
    await p.goto(B + partida(n), { timeout: 180000 })
    await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

    await ctx.addCookies([{ name: 'revisao-atraso-ms', value: '6000', url: p.url() }])
    await p.evaluate((u) => window.next.router.push(u), destino)
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${saida}/${n}${sufixo}-esqueleto.png` })
    await ctx.clearCookies({ name: 'revisao-atraso-ms' })
    await p.waitForURL((u) => u.pathname === caminho, { timeout: 180000, waitUntil: 'commit' })
    await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await p.waitForTimeout(800)
    await p.screenshot({ path: `${saida}/${n}${sufixo}-pronta.png` })

    const img = (f) => `data:image/png;base64,${readFileSync(`${saida}/${n}${sufixo}-${f}.png`).toString('base64')}`
    const comp = await b.newPage({ viewport: { width: largura * 3 + 40, height: altura + 30 } })
    await comp.setContent(`<body style="margin:0;display:flex;gap:20px;font:12px sans-serif;background:#888">
      <div><div>esqueleto</div><img src="${img('esqueleto')}"></div>
      <div><div>pronta</div><img src="${img('pronta')}"></div>
      <div><div>sobreposição</div><div style="position:relative"><img src="${img('pronta')}"><img src="${img('esqueleto')}" style="position:absolute;inset:0;opacity:.5"></div></div></body>`)
    await comp.screenshot({ path: `${saida}/${n}${sufixo}-comparar.png` })
    await comp.close()
    console.log('ok', n + sufixo)
  }
  await ctx.close()
}
await b.close()
