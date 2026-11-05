/**
 * Grava os trechos de `extrair_pdf.py` na base de conhecimento de uma conta (0168).
 *
 *   npx tsx --conditions=react-server scripts/conhecimento/importar.mts <conta> <trechos.json> [--gravar]
 *
 * Troca a fonte inteira: apaga os trechos da mesma fonte na conta e grava os
 * novos, para reimportar uma versão nova do manual sem sobrar o antigo.
 * Sem `--gravar`, só conta e mostra.
 */
import fs from 'node:fs'
import path from 'node:path'

process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'))

const { db } = await import('@/server/db')
const { paraBusca } = await import('@/core/conhecimento')

const [conta, arquivo] = process.argv.slice(2)
const GRAVAR = process.argv.includes('--gravar')
if (!conta || !arquivo) throw new Error('uso: importar.mts <conta> <trechos.json> [--gravar]')

type Trecho = { fonte: string; secao: string; pagina: number | null; ordem: number; texto: string }
const trechos: Trecho[] = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
const fontes = [...new Set(trechos.map((t) => t.fonte))]
console.log(`${trechos.length} trechos de ${fontes.join(', ')}`)
if (!GRAVAR) {
  console.log('dry-run: nada foi escrito. Rode com --gravar.')
  process.exit(0)
}

for (const fonte of fontes) {
  const { error } = await db().from('conhecimento_trechos').delete().eq('client_id', conta).eq('fonte', fonte)
  if (error) throw new Error(error.message)
}
const linhas = trechos.map((t) => ({
  client_id: conta,
  fonte: t.fonte,
  secao: t.secao,
  pagina: t.pagina,
  ordem: t.ordem,
  texto: t.texto.slice(0, 4000),
  busca: paraBusca(`${t.secao} ${t.texto}`).slice(0, 4400),
}))
for (let i = 0; i < linhas.length; i += 200) {
  const { error } = await db().from('conhecimento_trechos').insert(linhas.slice(i, i + 200))
  if (error) throw new Error(error.message)
}
const { count } = await db().from('conhecimento_trechos').select('id', { count: 'exact', head: true }).eq('client_id', conta)
console.log(`gravado. A conta tem ${count} trechos.`)
