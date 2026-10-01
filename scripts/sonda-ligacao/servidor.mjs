/**
 * Sonda da fase 0 da ligação pelo WhatsApp.
 *
 *   SONDA_TOKEN=<token temporário do painel> SONDA_PHONE_ID=<id do número de teste> \
 *     node scripts/sonda-ligacao/servidor.mjs
 *
 * Abre http://localhost:4747 e responde uma pergunta só: a Meta aceita o SDP
 * gerado direto no navegador, sem servidor de mídia? Ver
 * `docs/HANDOFF-01-OUT-LIGACAO-WHATSAPP.md`.
 *
 * O caminho:
 *  1. alguém liga pelo WhatsApp para o número de teste;
 *  2. a Meta manda o webhook `calls` para produção, e `src/server/sonda-ligacao.ts`
 *     grava a oferta em `alertas`;
 *  3. esta página lê a oferta (via este servidor), o navegador gera a resposta,
 *     e este servidor chama `pre_accept` e `accept` na Graph API.
 *
 * Roda só em localhost: o token temporário fica neste processo e nunca vai
 * para a Vercel. Lê `SUPABASE_URL` e `SUPABASE_SECRET_KEY` do `.env` do repo.
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '../..')
const PORTA = 4747
const VERSAO = 'v23.0'
const TITULO = 'sonda: ligação do WhatsApp'

for (const linha of readFileSync(path.join(RAIZ, '.env'), 'utf8').split('\n')) {
  const achado = linha.match(/^([A-Z0-9_]+)=(.*)$/)
  if (achado && !(achado[1] in process.env)) process.env[achado[1]] = achado[2].replace(/^["']|["']$/g, '')
}

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SONDA_TOKEN, SONDA_PHONE_ID } = process.env
for (const [nome, valor] of Object.entries({ SUPABASE_URL, SUPABASE_SECRET_KEY, SONDA_TOKEN, SONDA_PHONE_ID })) {
  if (!valor) {
    console.error(`falta ${nome}`)
    process.exit(1)
  }
}

async function lerCorpo(req) {
  let texto = ''
  for await (const pedaco of req) texto += pedaco
  return texto ? JSON.parse(texto) : {}
}

function json(res, status, dado) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(dado))
}

async function eventos(desde) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/alertas`)
  url.searchParams.set('select', 'criado_em,detalhe,contexto')
  url.searchParams.set('titulo', `eq.${TITULO}`)
  url.searchParams.set('criado_em', `gt.${desde}`)
  url.searchParams.set('contexto->>phone_number_id', `eq.${SONDA_PHONE_ID}`)
  url.searchParams.set('order', 'criado_em.asc')
  const resposta = await fetch(url, {
    headers: { apikey: SUPABASE_SECRET_KEY, authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  })
  return resposta.json()
}

async function meta(caminho, corpo) {
  const resposta = await fetch(`https://graph.facebook.com/${VERSAO}/${SONDA_PHONE_ID}/${caminho}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${SONDA_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  return { status: resposta.status, corpo: await resposta.json().catch(() => null) }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORTA}`)
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(readFileSync(path.join(AQUI, 'pagina.html')))
    }
    if (req.method === 'GET' && url.pathname === '/eventos') {
      return json(res, 200, await eventos(url.searchParams.get('desde') ?? new Date().toISOString()))
    }
    if (req.method === 'POST' && url.pathname === '/chamada') {
      const corpo = await lerCorpo(req)
      const resultado = await meta('calls', { messaging_product: 'whatsapp', ...corpo })
      console.log(corpo.action, corpo.call_id ?? corpo.to ?? '', '->', resultado.status, JSON.stringify(resultado.corpo))
      return json(res, 200, resultado)
    }
    json(res, 404, { erro: 'não existe' })
  } catch (erro) {
    console.error(erro)
    json(res, 500, { erro: String(erro) })
  }
}).listen(PORTA, '127.0.0.1', () => console.log(`sonda em http://localhost:${PORTA}`))
