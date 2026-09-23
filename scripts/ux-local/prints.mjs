// Tira print das telas da conta de revisão, desktop (1440) e celular (390).
//
// Uso: node scripts/ux-local/prints.mjs <pasta-de-saida> [tela ...]
// Sem telas, tira todas. Ex.: node scripts/ux-local/prints.mjs .ux-local/depois atividades contatos
// A regra do plano: print ANTES e DEPOIS de toda tarefa que mexe em tela.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const saida = process.argv[2] ?? '.ux-local/prints'
const pedidas = process.argv.slice(3)
const psql = (sql) => execFileSync('docker', ['exec', 'supabase_db_autofluxos', 'psql', '-U', 'postgres', '-At', '-c', sql], { encoding: 'utf8' }).trim()
const C = psql("select id from clients where nome = 'Studio Pilates Revisão' limit 1")
const CT = psql(`select id from contacts where client_id = '${C}' order by nome limit 1`)
const FL = psql(`select id from flows where client_id = '${C}' and nome = 'Agendar aula experimental'`)
const B = `/clientes/${C}`

const TELAS = {
  inicio: '', atividades: '/atividades', 'agenda-semana': '/atividades?vista=agenda', 'agenda-mes': '/atividades?vista=agenda&escala=mes', contatos: '/leads', 'contatos-filtros': '/leads?nivel=sem_compra&busca=lucas', funil: '/quadros', inbox: '/inbox', ficha: `/leads/${CT}`,
  fluxos: '/fluxos', 'fluxos-palavras': '/fluxos?aba=palavras', 'fluxos-gatilhos': '/fluxos?aba=gatilhos&tipo=eventos', 'fluxos-sequencias': '/fluxos?aba=sequencias', editor: `/fluxos/${FL}`,
  transmissoes: '/transmissoes?aba=transmissoes', ajustes: '/ajustes', equipe: '/ajustes/equipe', integracoes: '/ajustes/integracoes', relatorios: '/relatorios',
}
const nomes = pedidas.length ? pedidas : Object.keys(TELAS)
mkdirSync(saida, { recursive: true })
const b = await chromium.launch()
for (const [largura, altura, sufixo] of [[1440, 900, ''], [390, 844, '-celular']]) {
  const ctx = await b.newContext({ baseURL: `http://localhost:${process.env.PORTA ?? 3100}`, storageState: '.ux-local/sessao.json', viewport: { width: largura, height: altura } })
  const p = await ctx.newPage()
  for (const n of nomes) {
    if (!(n in TELAS)) { console.log('tela desconhecida', n); continue }
    await p.goto(B + TELAS[n], { timeout: 120000 })
    await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await p.waitForTimeout(400)
    await p.screenshot({ path: `${saida}/${n}${sufixo}.png` })
    console.log('ok', n + sufixo)
  }
  await ctx.close()
}
await b.close()
