import fs from 'node:fs'
import { fluxoSchema } from '../../src/core/flow/schema'
import { validar } from '../../src/core/flow/validar'
import { validarPublicacao } from '../../src/core/validar-publicacao'

const S = process.env.S!
const linhas = JSON.parse(fs.readFileSync(`${S}/mgm.json`, 'utf8'))
const conexoes = ['a9f8ce40-4a00-4f82-af1b-ee0811afa2db']

for (const l of linhas) {
  for (const [rotulo, grafo] of [['RASCUNHO', l.rascunho], [`PUBLICADO v${l.versao}`, l.publicado]] as const) {
    if (!grafo) continue
    console.log(`\n===== ${l.nome} — ${rotulo}`)
    const p = fluxoSchema.safeParse(grafo)
    if (!p.success) {
      console.log('SCHEMA INVALIDO:', JSON.stringify(p.error.issues.slice(0, 10), null, 1))
      continue
    }
    const nomes = new Map(p.data.nodes.map((n: any) => [n.id, n.data?.titulo ?? n.type]))
    const v = validar(p.data, { iaHabilitada: true, conexoes, temContextoDeNegocio: true })
    const vp = validarPublicacao(p.data, { temEntrada: true })
    for (const e of [...v.erros, ...vp.erros]) console.log(`  ERRO  [${e.codigo}] ${e.mensagem} ${e.noId ? `<${nomes.get(e.noId) ?? e.noId}>` : ''}`)
    for (const a of [...v.avisos, ...vp.avisos]) console.log(`  aviso [${a.codigo}] ${a.mensagem} ${a.noId ? `<${nomes.get(a.noId) ?? a.noId}>` : ''}`)
    if (!v.erros.length && !vp.erros.length && !v.avisos.length && !vp.avisos.length) console.log('  limpo')
  }
}
