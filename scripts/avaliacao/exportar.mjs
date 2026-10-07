/**
 * Exporta o que a avaliação de IA precisa de uma conta: o "sobre a empresa",
 * o bloco de IA publicado e a loja. Só leitura, pela Management API.
 *
 * O arquivo sai em `scripts/avaliacao/.dados/`, que o git ignora: este
 * repositório é público, e instrução e contexto são do cliente.
 *
 *   set -a && . <cofre>/4yu.env && set +a
 *   node scripts/avaliacao/exportar.mjs <flow_id> <no_id> <nome>
 *
 * PCYES: node scripts/avaliacao/exportar.mjs baff0b15-36ce-4740-a805-f049f0ab39b1 vendedor-ia pcyes
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const REF = 'xxxynoshwirupkdzwxbj'
const [fluxoId, noId, nome] = process.argv.slice(2)
if (!fluxoId || !noId || !nome) throw new Error('uso: exportar.mjs <flow_id> <no_id> <nome>')
if (!/^[0-9a-f-]{36}$/.test(fluxoId) || !/^[\w-]+$/.test(noId) || !/^[\w-]+$/.test(nome)) throw new Error('argumento inválido')

const query = `select c.contexto_negocio, fv.grafo, fv.versao, l.endereco, l.codigo_da_loja, l.sufixo_da_url
  from flows f join clients c on c.id = f.client_id
  join flow_versions fv on fv.id = f.versao_publicada_id
  left join lojas_integradas l on l.client_id = f.client_id and l.ativa
  where f.id = '${fluxoId}'`

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query/read-only`, {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query }),
})
const [linha] = await r.json()
if (!linha) throw new Error('fluxo não encontrado')
const no = linha.grafo.nodes.find((n) => n.id === noId)
if (!no) throw new Error(`nó ${noId} não existe na versão ${linha.versao}`)

mkdirSync(new URL('.dados/', import.meta.url), { recursive: true })
writeFileSync(
  new URL(`.dados/${nome}.json`, import.meta.url),
  JSON.stringify(
    {
      versao: linha.versao,
      contextoNegocio: linha.contexto_negocio,
      no,
      loja: linha.endereco
        ? { endereco: linha.endereco, codigoDaLoja: linha.codigo_da_loja, sufixo: linha.sufixo_da_url ?? '' }
        : null,
    },
    null,
    2,
  ),
)
console.log(`${nome}: versão ${linha.versao}, nó ${noId}`)
