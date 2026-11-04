// Manda o `pedido_pendente_cupom` pelo mesmo caminho da API pública
// (contato, histórico, SAIR, teto do dia), sem chave de API.
// Uso: npx tsx --conditions=react-server --env-file=.env scripts/carrinho/enviar-pendente-cupom.mts <clienteId> <envio.json> [--valer]
// envio.json: { "<pedido>": { primeiro_nome, tel, produto_curto, url_key, imagem: [url] } }
import { readFileSync } from 'node:fs'
import { enviarModeloPelaApi } from '@/server/api/templates'

const [clienteId, arquivo, valer] = process.argv.slice(2)
if (!clienteId || !arquivo) throw new Error('uso: <clienteId> <envio.json> [--valer]')
const lista = JSON.parse(readFileSync(arquivo, 'utf8')) as Record<string, { primeiro_nome: string; tel: string; produto_curto: string; url_key: string; imagem: string[] }>

const capitalizar = (s: string) => s.trim().toLowerCase().replace(/^\p{L}/u, (l) => l.toUpperCase())
for (const [pedido, p] of Object.entries(lista)) {
  const digitos = p.tel.replace(/\D/g, '')
  const telefone = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  const envio = {
    telefone,
    template: 'pedido_pendente_cupom',
    valores: { corpo: [capitalizar(p.primeiro_nome), p.produto_curto] },
    link: p.url_key,
    imagem: p.imagem[0],
  }
  if (valer !== '--valer') {
    console.log(pedido, 'SIMULAÇÃO', JSON.stringify({ ...envio, telefone: `${telefone.slice(0, 4)}…${telefone.slice(-2)}` }))
    continue
  }
  const r = await enviarModeloPelaApi(clienteId, envio)
  console.log(pedido, r.ok ? `${r.corpo.status} contato ${r.corpo.contato_criado ? 'novo' : 'existente'}` : `RECUSA ${r.status} ${r.codigo}: ${r.mensagem}`)
}
