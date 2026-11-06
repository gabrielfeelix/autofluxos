/**
 * Avisa Bing, Yandex, Naver e Seznam (protocolo IndexNow) que as páginas do
 * sitemap mudaram. O índice do Bing é o que o ChatGPT consulta quando pesquisa
 * na web, e sem aviso um domínio novo espera semanas para ser rastreado.
 *
 * A chave é pública por definição: o arquivo `public/8cf1073e2e0eb4d0fcaadfefa489e97c.txt` existe só
 * para provar que o domínio é nosso. Rodar depois de um deploy que mude páginas:
 *
 *     node scripts/avisar-buscadores.mjs
 *
 * O Google não usa IndexNow; lá o caminho é o Search Console.
 */
const HOST = 'dialogon.com.br'
const CHAVE = '8cf1073e2e0eb4d0fcaadfefa489e97c'

const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text()
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
for (const extra of ['/llms.txt', '/llms-full.txt', '/precos.md', '/integracoes.md', '/duvidas.md', '/api.md']) urls.push(`https://${HOST}${extra}`)

const resposta = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: CHAVE, keyLocation: `https://${HOST}/${CHAVE}.txt`, urlList: urls }),
})
console.log(resposta.status, resposta.statusText, `(${urls.length} endereços)`)
