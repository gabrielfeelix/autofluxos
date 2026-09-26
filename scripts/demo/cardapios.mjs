// Os cardápios da demonstração em PDF, um por ramo, com as fotos de cada item.
//
// Uso: node scripts/demo/cardapios.mjs <produtos.json> <pasta-das-fotos> <pasta-de-saida>
//
// `produtos.json` é a lista de produtos da conta demo (categoria, nome, preco,
// descricao, foto). As fotos são os `demo-*.jpg` já reduzidos. Sai um
// `<ramo>.pdf` e um `<ramo>.png` (a primeira página, que o bot manda como
// imagem antes do PDF). Os nomes batem com `demo-cardapio-<ramo>.*` em
// scripts/demo/fluxos.mts, então subir os arquivos basta: nenhum fluxo muda.
//
// Cada ramo tem desenho próprio, feito como peça gráfica e não como página
// de sistema: tipografia, cor e composição de cardápio impresso.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const [, , ARQ_PRODUTOS, PASTA_FOTOS, SAIDA] = process.argv
if (!ARQ_PRODUTOS || !PASTA_FOTOS || !SAIDA) throw new Error('uso: cardapios.mjs <produtos.json> <fotos> <saida>')
mkdirSync(SAIDA, { recursive: true })

const produtos = JSON.parse(readFileSync(ARQ_PRODUTOS, 'utf8'))
const foto = (p) => `data:image/jpeg;base64,${readFileSync(join(PASTA_FOTOS, p.foto.split('/').pop())).toString('base64')}`
const de = (categoria) => produtos.filter((p) => p.categoria === categoria)
const reais = (v) => Number(v).toFixed(2).replace('.', ',')
const inteiro = (v) => (Number(v) % 1 === 0 ? String(Number(v)) : reais(v))
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
// Tira "Pizza " do começo: no cardápio da pizzaria a palavra é o título da seção.
const semPrefixo = (nome, prefixo) => (nome.startsWith(prefixo) ? nome.slice(prefixo.length) : nome)

const fontes = (familias) =>
  `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${familias}&display=swap" rel="stylesheet">`

// Grão de papel: ruído fractal em SVG, bem leve. Tira o chapado de tela.
const GRAO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.25 0 0 0 0 0.18 0 0 0 0 0.1 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const BASE = `
@page { size: A4; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
.pagina { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always }
.pagina:last-child { page-break-after: auto }
img { display: block }
`

/* ------------------------------------------------------------ pizzaria */
function pizzaria() {
  const salgadas = de('Pizzas salgadas')
  const doces = de('Pizzas doces')
  const item = (p, prefixo) => `
    <div class="pz">
      <div class="aro"><img src="${foto(p)}"></div>
      <div class="pz-t">
        <div class="linha"><h3>${esc(semPrefixo(p.nome, prefixo))}</h3><span class="pontos"></span><span class="preco">${reais(p.preco)}</span></div>
        <p>${esc(p.descricao)}</p>
      </div>
    </div>`
  const lista = (itens) =>
    itens.map((p) => `<div class="li"><span>${esc(p.nome)}</span><span class="pontos"></span><span class="preco">${reais(p.preco)}</span></div>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8">${fontes('family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,600&family=Libre+Franklin:wght@400;500;600')}
<style>${BASE}
:root { --papel:#f2e8d6; --tinta:#2a1c13; --tomate:#b3301d; --manjericao:#3d5a36; --suave:#7a6653 }
body { background: var(--papel); color: var(--tinta); font-family: 'Libre Franklin', sans-serif }
.pagina { background: var(--papel) ${GRAO}; padding: 16mm 15mm 14mm }
.moldura { position:absolute; inset:7mm; border:1.2px solid var(--tomate); pointer-events:none }
.moldura::after { content:''; position:absolute; inset:1.6mm; border:.5px solid var(--tomate) }
.topo { text-align:center; margin-bottom:7mm }
.sobre { font-size:8pt; letter-spacing:.32em; text-transform:uppercase; color:var(--tomate); font-weight:600 }
h1 { font-family:'Fraunces',serif; font-style:italic; font-weight:400; font-size:54pt; line-height:.95; letter-spacing:-.02em; margin:3mm 0 2mm; font-variation-settings:'opsz' 144 }
h1 b { font-weight:600; color:var(--tomate) }
.orn { display:flex; align-items:center; justify-content:center; gap:3mm; color:var(--tomate); font-family:'Fraunces',serif; font-style:italic; font-size:11pt }
.orn::before, .orn::after { content:''; width:28mm; height:.6px; background:var(--tomate) }
.secao { display:flex; align-items:baseline; gap:4mm; margin:5mm 0 3.5mm }
.secao h2 { font-family:'Fraunces',serif; font-weight:600; font-size:20pt; letter-spacing:-.01em }
.secao span { flex:1; height:.6px; background:var(--tinta); opacity:.35; transform:translateY(-1.5mm) }
.secao em { font-family:'Fraunces',serif; font-size:9.5pt; color:var(--suave) }
.grade { display:grid; grid-template-columns:1fr 1fr; column-gap:9mm; row-gap:4.2mm }
.pz { display:flex; gap:4mm; align-items:center }
.aro { width:24mm; height:24mm; border-radius:50%; flex:none; padding:1mm; border:.8px solid var(--tomate); background:#fff8ec }
.aro img { width:100%; height:100%; border-radius:50%; object-fit:cover }
.pz-t { flex:1; min-width:0 }
.linha { display:flex; align-items:baseline; gap:2mm }
.linha h3 { font-family:'Fraunces',serif; font-weight:600; font-size:12.5pt; white-space:nowrap }
.pontos { flex:1; border-bottom:1.2px dotted var(--suave); opacity:.6; transform:translateY(-1mm) }
.preco { font-family:'Fraunces',serif; font-weight:600; font-size:12.5pt; color:var(--tomate); white-space:nowrap }
.pz p { font-size:8.3pt; line-height:1.4; color:var(--suave); margin-top:.8mm }
.tamanhos { display:flex; justify-content:center; gap:0; margin:0 auto; width:fit-content; border:.8px solid var(--tinta) }
.tamanhos div { padding:2mm 5mm; text-align:center; font-size:8pt; border-right:.8px solid var(--tinta) }
.tamanhos div:last-child { border-right:0 }
.tamanhos b { display:block; font-family:'Fraunces',serif; font-size:11pt; font-weight:600 }
.doces { display:grid; grid-template-columns:repeat(4,1fr); gap:5mm; margin-top:1mm }
.doce img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:50%; border:1mm solid #fff8ec; box-shadow:0 0 0 .8px var(--tomate) }
.doce h3 { font-family:'Fraunces',serif; font-weight:600; font-size:11pt; text-align:center; margin-top:2.5mm; line-height:1.15 }
.doce p { font-size:7.8pt; color:var(--suave); text-align:center; margin-top:1mm; line-height:1.35 }
.doce .preco { display:block; text-align:center; margin-top:1.2mm }
.duas { display:grid; grid-template-columns:1fr 1fr; gap:10mm }
.li { display:flex; align-items:baseline; gap:2mm; font-size:10pt; padding:1.6mm 0 }
.li span:first-child { font-family:'Fraunces',serif; font-size:11.5pt }
.li .preco { font-size:11pt }
.rodape { position:absolute; left:15mm; right:15mm; bottom:14mm; display:grid; grid-template-columns:1fr 1fr 1fr; gap:6mm; border-top:1.2px solid var(--tinta); padding-top:4mm; font-size:8.3pt; line-height:1.5 }
.rodape b { display:block; font-family:'Fraunces',serif; font-style:italic; font-size:11pt; color:var(--tomate); font-weight:400 }
.selo { position:absolute; right:14mm; top:14mm; width:22mm; height:22mm; border-radius:50%; background:var(--manjericao); color:var(--papel); display:grid; place-items:center; text-align:center; font-family:'Fraunces',serif; font-style:italic; font-size:8.5pt; line-height:1.1; transform:rotate(-10deg) }
.demo { position:absolute; left:0; right:0; bottom:8.5mm; text-align:center; font-size:6.5pt; letter-spacing:.25em; text-transform:uppercase; color:var(--suave) }
</style></head><body>
<section class="pagina">
  <div class="moldura"></div>
  <div class="selo">forno<br>a lenha</div>
  <header class="topo">
    <div class="sobre">Massa de fermentação natural · 48 horas</div>
    <h1>Pizzaria <b>Exemplo</b></h1>
    <div class="orn">cardápio</div>
  </header>
  <div class="tamanhos">
    <div><b>Grande</b>8 fatias · preço da carta</div>
    <div><b>Média</b>6 fatias · R$ 8 a menos</div>
    <div><b>Broto</b>4 fatias · R$ 18 a menos</div>
    <div><b>Meio a meio</b>vale o sabor mais caro</div>
  </div>
  <div class="secao"><h2>Pizzas salgadas</h2><span></span><em>em reais</em></div>
  <div class="grade">${salgadas.map((p) => item(p, 'Pizza ')).join('')}</div>
</section>
<section class="pagina">
  <div class="moldura"></div>
  <div class="secao" style="margin-top:2mm"><h2>Pizzas doces</h2><span></span><em>para fechar a noite</em></div>
  <div class="doces">${doces.map((p) => `<div class="doce"><img src="${foto(p)}"><h3>${esc(semPrefixo(p.nome, 'Pizza '))}</h3><p>${esc(p.descricao)}</p><span class="preco">${reais(p.preco)}</span></div>`).join('')}</div>
  <div class="duas" style="margin-top:9mm">
    <div><div class="secao" style="margin-top:0"><h2>Bebidas</h2><span></span></div>${lista(de('Bebidas'))}</div>
    <div><div class="secao" style="margin-top:0"><h2>Sobremesas</h2><span></span></div>${lista(de('Sobremesas'))}</div>
  </div>
  <div class="doces" style="grid-template-columns:repeat(3,1fr); margin-top:7mm; padding:0 16mm">${de('Sobremesas').map((p) => `<div class="doce"><img src="${foto(p)}"></div>`).join('')}</div>
  <footer class="rodape">
    <div><b>Horário</b>Terça a domingo<br>das 18h às 23h30</div>
    <div><b>Entrega</b>Em até 45 minutos<br>taxa de R$ 6,00</div>
    <div><b>Peça pelo WhatsApp</b>Retirada no balcão<br>pronta em 25 minutos</div>
  </footer>
  <div class="demo">Cardápio de demonstração · 4YU</div>
</section>
</body></html>`
}

/* --------------------------------------------------------- hamburgueria */
function hamburgueria() {
  const burgers = de('Hambúrgueres')
  const card = (p, grande) => `
    <div class="bg ${grande ? 'grande' : ''}">
      <div class="img"><img src="${foto(p)}"><span class="etiqueta">R$ ${inteiro(p.preco)}</span></div>
      <h3>${esc(p.nome)}</h3>
      <p>${esc(p.descricao)}</p>
    </div>`
  const mini = (p) => `<div class="mini"><img src="${foto(p)}"><div><h4>${esc(p.nome)}</h4><p>${esc(p.descricao)}</p></div><span>${reais(p.preco)}</span></div>`
  return `<!doctype html><html><head><meta charset="utf-8">${fontes('family=Anton&family=Archivo:wght@400;500;700;800')}
<style>${BASE}
:root { --fundo:#15120f; --creme:#f3ede2; --mostarda:#f2b705; --ketchup:#d8432a; --cinza:#9d948a }
body { background:var(--fundo); color:var(--creme); font-family:'Archivo',sans-serif }
.pagina { background:var(--fundo); padding:13mm 13mm 12mm }
.faixa { position:absolute; left:0; right:0; top:0; height:4mm; background:repeating-linear-gradient(90deg,var(--mostarda) 0 14mm,var(--ketchup) 14mm 28mm) }
header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid var(--creme); padding-bottom:4mm; margin-top:3mm }
h1 { font-family:'Anton',sans-serif; font-size:66pt; line-height:.86; text-transform:uppercase; letter-spacing:.005em }
h1 span { color:var(--mostarda) }
.lado { text-align:right; font-size:8.5pt; line-height:1.5; color:var(--cinza); text-transform:uppercase; letter-spacing:.14em; font-weight:700 }
.lado b { display:block; font-family:'Anton'; font-size:20pt; letter-spacing:.02em; color:var(--ketchup) }
h2 { font-family:'Anton',sans-serif; font-size:26pt; text-transform:uppercase; margin:6mm 0 3.5mm; display:flex; align-items:center; gap:4mm }
h2::after { content:''; flex:1; height:3px; background:var(--mostarda) }
.burgers { display:grid; grid-template-columns:repeat(6,1fr); gap:5mm }
.bg { grid-column:span 2 }
.bg.grande { grid-column:span 3 }
.img { position:relative }
.img img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:2mm }
.grande .img img { aspect-ratio:4/3 }
.etiqueta { position:absolute; right:-2mm; top:-2mm; background:var(--mostarda); color:var(--fundo); font-family:'Anton'; font-size:15pt; padding:1.2mm 3mm; transform:rotate(4deg); box-shadow:1.2mm 1.2mm 0 var(--ketchup) }
.bg h3 { font-family:'Anton',sans-serif; font-size:17pt; text-transform:uppercase; margin-top:3mm; letter-spacing:.01em }
.grande h3 { font-size:22pt }
.bg p { font-size:8.8pt; line-height:1.4; color:var(--cinza); margin-top:1mm }
.minis { display:grid; grid-template-columns:1fr 1fr; gap:3.5mm 8mm }
.mini { display:flex; gap:3.5mm; align-items:center; border-top:1px solid #3a342e; padding-top:3mm }
.mini img { width:19mm; height:19mm; object-fit:cover; border-radius:50% }
.mini div { flex:1 }
.mini h4 { font-family:'Anton'; font-size:13pt; text-transform:uppercase; letter-spacing:.02em }
.mini p { font-size:8pt; color:var(--cinza); line-height:1.35; margin-top:.5mm }
.mini > span { font-family:'Anton'; font-size:14pt; color:var(--mostarda) }
.pe { position:absolute; left:13mm; right:13mm; bottom:11mm; display:flex; justify-content:space-between; align-items:center; border-top:3px solid var(--creme); padding-top:3.5mm; font-size:8.5pt; text-transform:uppercase; letter-spacing:.14em; font-weight:700; color:var(--cinza) }
.pe b { color:var(--creme) }
</style></head><body>
<section class="pagina">
  <div class="faixa"></div>
  <header>
    <h1>Hamburgueria<br><span>Exemplo</span></h1>
    <div class="lado"><b>Smash na chapa</b>blend da casa · pão brioche<br>todos os dias, 18h à meia-noite</div>
  </header>
  <h2>Os lanches</h2>
  <div class="burgers">${burgers.map((p, i) => card(p, i < 2)).join('')}</div>
</section>
<section class="pagina">
  <div class="faixa"></div>
  <h2 style="margin-top:4mm">Porções</h2>
  <div class="minis">${de('Porções').map(mini).join('')}</div>
  <h2>Milk-shakes</h2>
  <div class="minis">${de('Milk-shakes').map(mini).join('')}</div>
  <h2>Bebidas</h2>
  <div class="minis">${de('Bebidas').map(mini).join('')}</div>
  <div class="pe"><span><b>Entrega</b> em até 40 min · R$ 5,00</span><span><b>Retirada</b> no balcão, sem taxa</span><span>Demonstração 4YU</span></div>
</section>
</body></html>`
}

/* ---------------------------------------------------------- restaurante */
function restaurante() {
  const prato = (p) => `
    <article class="prato">
      <img src="${foto(p)}">
      <div>
        <div class="cab"><h3>${esc(p.nome)}</h3><span>${reais(p.preco)}</span></div>
        <p>${esc(p.descricao)}</p>
      </div>
    </article>`
  const linha = (p) => `<div class="li"><span>${esc(p.nome)}</span><i></i><span>${reais(p.preco)}</span></div>`
  return `<!doctype html><html><head><meta charset="utf-8">${fontes('family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500')}
<style>${BASE}
:root { --papel:#faf8f3; --verde:#1f3a2c; --terra:#bf6a3d; --suave:#6f7a70 }
body { background:var(--papel); color:var(--verde); font-family:'Jost',sans-serif }
.pagina { background:var(--papel) ${GRAO}; padding:15mm 17mm }
.borda { position:absolute; inset:9mm; border:.6px solid var(--verde) }
header { text-align:center; padding:4mm 0 5mm }
.ant { font-size:7.5pt; letter-spacing:.4em; text-transform:uppercase; color:var(--terra) }
h1 { font-family:'Cormorant Garamond',serif; font-weight:500; font-size:46pt; letter-spacing:.02em; line-height:1; margin:2.5mm 0 }
h1 em { font-style:italic; color:var(--terra) }
.sub { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:13pt; color:var(--suave) }
h2 { text-align:center; font-family:'Cormorant Garamond',serif; font-weight:600; font-size:17pt; letter-spacing:.28em; text-transform:uppercase; margin:6mm 0 4.5mm; display:flex; align-items:center; gap:5mm }
h2::before, h2::after { content:''; flex:1; height:.6px; background:var(--verde); opacity:.5 }
.prato { display:grid; grid-template-columns:50mm 1fr; gap:7mm; align-items:center; padding:3.2mm 0; border-bottom:.5px solid rgba(31,58,44,.2) }
.prato:last-child { border-bottom:0 }
.prato img { width:50mm; height:33mm; object-fit:cover; border-radius:1mm }
.cab { display:flex; justify-content:space-between; align-items:baseline; gap:4mm }
.cab h3 { font-family:'Cormorant Garamond',serif; font-weight:600; font-size:17pt }
.cab span { font-family:'Cormorant Garamond',serif; font-weight:600; font-size:15pt; color:var(--terra) }
.prato p { font-size:9.5pt; line-height:1.55; color:var(--suave); margin-top:1.5mm; max-width:95mm }
.selo { display:inline-block; margin-left:2.5mm; font-family:'Jost',sans-serif; font-weight:500; font-size:7pt; line-height:1; letter-spacing:.14em; text-transform:uppercase; color:var(--terra); border:.7px solid var(--terra); padding:1mm 2mm; border-radius:3mm; vertical-align:middle }
.saladas { display:grid; grid-template-columns:1fr 1fr; gap:7mm }
.saladas .sl img { width:100%; height:38mm; object-fit:cover; border-radius:1mm }
.saladas h3 { font-family:'Cormorant Garamond',serif; font-weight:600; font-size:15pt; margin-top:2.5mm; display:flex; justify-content:space-between }
.saladas h3 span { color:var(--terra) }
.saladas p { font-size:8.8pt; color:var(--suave); line-height:1.45; margin-top:.6mm }
.duas { display:grid; grid-template-columns:1fr 1fr; gap:10mm }
.li { display:flex; align-items:baseline; gap:2mm; padding:1.5mm 0; font-size:10pt }
.li span:first-child { font-family:'Cormorant Garamond',serif; font-size:13pt }
.li i { flex:1; border-bottom:.6px dotted var(--verde); opacity:.5 }
.li span:last-child { font-family:'Cormorant Garamond',serif; font-weight:600; font-size:12.5pt; color:var(--terra) }
.pe { position:absolute; left:17mm; right:17mm; bottom:15mm; text-align:center; font-family:'Cormorant Garamond',serif; font-style:italic; font-size:11.5pt; color:var(--suave); line-height:1.5 }
.pe small { display:block; font-family:'Jost'; font-style:normal; font-size:6.5pt; letter-spacing:.3em; text-transform:uppercase; margin-top:2mm }
</style></head><body>
<section class="pagina">
  <div class="borda"></div>
  <header>
    <div class="ant">Almoço · segunda a sábado</div>
    <h1>Restaurante <em>Exemplo</em></h1>
    <div class="sub">comida de verdade, feita no dia</div>
  </header>
  <h2>Pratos executivos</h2>
  ${de('Pratos executivos').map((p) => prato(p).replace(esc(p.nome) + '</h3>', esc(p.nome) + (p.nome.startsWith('Feijoada') ? '<span class="selo">sábado</span>' : '') + '</h3>')).join('')}
</section>
<section class="pagina">
  <div class="borda"></div>
  <h2 style="margin-top:4mm">Saladas</h2>
  <div class="saladas">${de('Saladas').map((p) => `<div class="sl"><img src="${foto(p)}"><h3>${esc(p.nome)}<span>${reais(p.preco)}</span></h3><p>${esc(p.descricao)}</p></div>`).join('')}</div>
  <h2>Sobremesas</h2>
  <div class="saladas" style="grid-template-columns:repeat(3,1fr)">${de('Sobremesas').map((p) => `<div class="sl"><img src="${foto(p)}" style="height:32mm"><h3>${esc(p.nome)}<span>${reais(p.preco)}</span></h3></div>`).join('')}</div>
  <h2>Bebidas</h2>
  <div class="duas"><div>${de('Bebidas').slice(0, 2).map(linha).join('')}</div><div>${de('Bebidas').slice(2).map(linha).join('')}</div></div>
  <div class="pe">Segunda a sábado, das 11h às 15h · entrega em até 40 minutos, R$ 4,00<small>Cardápio de demonstração · 4YU</small></div>
</section>
</body></html>`
}

/* ----------------------------------------------------------------- moda */
function moda() {
  const peca = (p) => `
    <figure>
      <div class="img"><img src="${foto(p)}"></div>
      <figcaption><h3>${esc(p.nome)}</h3><span>R$ ${reais(p.preco)}</span></figcaption>
      <p>${esc(p.descricao)}</p>
    </figure>`
  const todas = [...de('Roupas'), ...de('Calçados'), ...de('Acessórios')]
  return `<!doctype html><html><head><meta charset="utf-8">${fontes('family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400&family=Karla:wght@400;500;700')}
<style>${BASE}
:root { --fundo:#f7f5f1; --preto:#141414; --cinza:#7c7872; --areia:#e8e1d5 }
body { background:var(--fundo); color:var(--preto); font-family:'Karla',sans-serif }
.pagina { background:var(--fundo); padding:14mm 14mm 12mm }
header { display:grid; grid-template-columns:1fr auto; align-items:end; border-bottom:.8px solid var(--preto); padding-bottom:5mm; margin-bottom:6mm }
h1 { font-family:'Bodoni Moda',serif; font-weight:400; font-size:58pt; line-height:.9; letter-spacing:-.02em; font-variation-settings:'opsz' 96 }
h1 i { font-style:italic }
.col { text-align:right; font-size:7.5pt; letter-spacing:.3em; text-transform:uppercase; line-height:2 }
.col b { font-family:'Bodoni Moda'; font-size:26pt; letter-spacing:0; font-weight:400; display:block; line-height:1 }
.grade { display:grid; grid-template-columns:repeat(3,1fr); gap:7mm 6mm }
figure .img { background:var(--areia); aspect-ratio:3/4; overflow:hidden }
figure img { width:100%; height:100%; object-fit:cover }
figcaption { display:flex; justify-content:space-between; align-items:baseline; margin-top:2.5mm; gap:2mm }
figcaption h3 { font-family:'Bodoni Moda',serif; font-weight:400; font-size:12.5pt; line-height:1.15 }
figcaption span { font-size:9pt; font-weight:700; white-space:nowrap }
figure p { font-size:7.8pt; color:var(--cinza); line-height:1.4; margin-top:1mm }
.pe { position:absolute; left:14mm; right:14mm; bottom:11mm; display:flex; justify-content:space-between; font-size:7pt; letter-spacing:.28em; text-transform:uppercase; border-top:.8px solid var(--preto); padding-top:3mm }
.num { position:absolute; right:14mm; top:6mm; font-size:7pt; letter-spacing:.3em; color:var(--cinza) }
</style></head><body>
<section class="pagina">
  <div class="num">COLEÇÃO · 01</div>
  <header>
    <h1>Moda <i>Exemplo</i></h1>
    <div class="col"><b>Primavera</b>catálogo · peças à pronta entrega</div>
  </header>
  <div class="grade">${todas.slice(0, 6).map(peca).join('')}</div>
  <div class="pe"><span>Tamanhos P ao GG</span><span>Entrega na cidade · R$ 10,00</span><span>Demonstração 4YU</span></div>
</section>
<section class="pagina">
  <div class="num">COLEÇÃO · 02</div>
  <div class="grade" style="margin-top:4mm">${todas.slice(6).map(peca).join('')}</div>
  <div class="pe"><span>Segunda a sexta, 9h às 19h · sábado, 9h às 14h</span><span>Retire na loja</span><span>Demonstração 4YU</span></div>
</section>
</body></html>`
}

/* ---------------------------------------------------------------- salão */
function salao() {
  const servico = (p) => {
    const [desc, duracao] = String(p.descricao).split(/\.\s*(?=Cerca)/)
    return `
    <div class="sv">
      <div class="arco"><img src="${foto(p)}"></div>
      <h3>${esc(p.nome)}</h3>
      <p>${esc(desc.replace(/\.$/, ''))}</p>
      <div class="rod"><span>${esc((duracao ?? '').replace(/^Cerca de /, '').replace(/\.$/, ''))}</span><b>R$ ${inteiro(p.preco)}</b></div>
    </div>`
  }
  const grupo = (titulo, itens) => `<h2>${titulo}</h2><div class="svs">${itens.map(servico).join('')}</div>`
  return `<!doctype html><html><head><meta charset="utf-8">${fontes('family=Italiana&family=Mulish:wght@400;600;700')}
<style>${BASE}
:root { --rosa:#f4e6df; --ameixa:#482a37; --ouro:#a98553; --suave:#8b6f78 }
body { background:var(--rosa); color:var(--ameixa); font-family:'Mulish',sans-serif }
.pagina { background:var(--rosa) ${GRAO}; padding:15mm 16mm }
header { text-align:center; margin-bottom:4mm }
.fio { width:34mm; height:.8px; background:var(--ouro); margin:0 auto }
h1 { font-family:'Italiana',serif; font-size:52pt; font-weight:400; letter-spacing:.06em; line-height:1; margin:4mm 0 2mm }
.tag { font-size:7.8pt; letter-spacing:.42em; text-transform:uppercase; color:var(--ouro); font-weight:700 }
h2 { font-family:'Italiana',serif; font-weight:400; font-size:22pt; letter-spacing:.12em; text-align:center; margin:6mm 0 4mm; color:var(--ameixa) }
h2::after { content:'✦'; display:block; font-size:8pt; color:var(--ouro); margin-top:1mm }
.svs { display:flex; justify-content:center; gap:7mm }
.sv { width:52mm; text-align:center }
.arco { width:100%; height:44mm; border-radius:26mm 26mm 1.5mm 1.5mm; overflow:hidden; border:.8px solid var(--ouro); padding:1.2mm; background:#fbf4f0 }
.arco img { width:100%; height:100%; object-fit:cover; border-radius:25mm 25mm 1mm 1mm }
.sv h3 { font-family:'Italiana',serif; font-weight:400; font-size:16pt; margin-top:3mm; letter-spacing:.03em }
.sv p { font-size:8pt; line-height:1.45; color:var(--suave); margin-top:1mm; min-height:8mm }
.rod { display:flex; justify-content:space-between; align-items:center; border-top:.6px solid var(--ouro); margin-top:2mm; padding-top:1.8mm; font-size:7.8pt; letter-spacing:.12em; text-transform:uppercase; color:var(--suave) }
.rod b { font-family:'Italiana'; font-size:15pt; letter-spacing:.02em; color:var(--ameixa); font-weight:400 }
.pe { position:absolute; left:16mm; right:16mm; bottom:13mm; text-align:center; font-size:8pt; letter-spacing:.2em; text-transform:uppercase; color:var(--suave); line-height:1.9 }
.pe b { color:var(--ameixa) }
</style></head><body>
<section class="pagina">
  <header>
    <div class="fio"></div>
    <h1>Salão Exemplo</h1>
    <div class="tag">cabelo · barba · unhas</div>
  </header>
  ${grupo('Cabelo', de('Cabelo'))}
  ${grupo('Barba e unhas', [...de('Barba'), ...de('Unhas')])}
  <div class="pe"><b>Terça a sábado, das 9h às 20h</b><br>agende pelo WhatsApp · pagamento no local · demonstração 4YU</div>
</section>
</body></html>`
}

/* ---------------------------------------------------------------- aulas */
function aulas() {
  const planos = de('Planos')
  const exp = de('Aula experimental')[0]
  const plano = (p, destaque) => `
    <div class="pl ${destaque ? 'dest' : ''}">
      <img src="${foto(p)}">
      <div class="corpo">
        ${destaque ? '<span class="fita">mais escolhido</span>' : ''}
        <h3>${esc(p.nome)}</h3>
        <p>${esc(p.descricao)}</p>
        <div class="val"><small>R$</small>${inteiro(p.preco)}<small>${/Plano mensal/.test(p.descricao) ? '/mês' : '/aula'}</small></div>
      </div>
    </div>`
  return `<!doctype html><html><head><meta charset="utf-8">${fontes('family=Young+Serif&family=Figtree:wght@400;500;600;700')}
<style>${BASE}
:root { --salvia:#e4e9e0; --verde:#2c3f33; --musgo:#6d7f67; --argila:#c98b6b; --claro:#f5f7f2 }
body { background:var(--salvia); color:var(--verde); font-family:'Figtree',sans-serif }
.pagina { background:var(--salvia) ${GRAO}; padding:15mm 15mm }
header { display:grid; grid-template-columns:1.1fr 1fr; gap:8mm; align-items:center }
h1 { font-family:'Young Serif',serif; font-weight:400; font-size:46pt; line-height:.98; letter-spacing:-.01em }
h1 span { color:var(--argila) }
.intro { font-size:10pt; line-height:1.6; color:var(--musgo); margin-top:4mm; max-width:85mm }
.capa { width:100%; height:62mm; object-fit:cover; border-radius:30mm 3mm 30mm 3mm }
h2 { font-family:'Young Serif',serif; font-weight:400; font-size:20pt; margin:9mm 0 4mm }
.pls { display:grid; grid-template-columns:repeat(3,1fr); gap:5mm }
.pl { background:var(--claro); border-radius:3mm; overflow:hidden; display:flex; flex-direction:column }
.pl img { width:100%; height:36mm; object-fit:cover }
.corpo { padding:4mm 4mm 4.5mm; position:relative; flex:1; display:flex; flex-direction:column }
.pl h3 { font-family:'Young Serif',serif; font-weight:400; font-size:14pt; line-height:1.15 }
.pl p { font-size:8.3pt; line-height:1.5; color:var(--musgo); margin-top:1.5mm; flex:1 }
.val { font-family:'Young Serif',serif; font-size:24pt; margin-top:3mm; display:flex; align-items:baseline; gap:1mm }
.val small { font-family:'Figtree'; font-size:8.5pt; color:var(--musgo); font-weight:600 }
.dest { background:var(--verde); color:var(--claro) }
.dest p, .dest .val small { color:#bccab7 }
.fita { position:absolute; top:-3.2mm; right:4mm; background:var(--argila); color:var(--claro); font-size:7pt; font-weight:700; letter-spacing:.14em; text-transform:uppercase; padding:1mm 2.4mm; border-radius:5mm }
.exp { margin-top:8mm; display:grid; grid-template-columns:62mm 1fr; background:var(--argila); color:var(--claro); border-radius:3mm; overflow:hidden }
.exp img { width:100%; height:100%; object-fit:cover }
.exp div { padding:7mm 8mm }
.exp small { font-size:7.5pt; letter-spacing:.24em; text-transform:uppercase; font-weight:700; opacity:.9 }
.exp h3 { font-family:'Young Serif',serif; font-weight:400; font-size:22pt; margin:2mm 0 }
.exp p { font-size:9.5pt; line-height:1.55 }
.exp b { display:inline-block; margin-top:3mm; background:var(--claro); color:var(--argila); font-weight:700; font-size:9pt; padding:1.5mm 4mm; border-radius:5mm; letter-spacing:.04em }
.pe { position:absolute; left:15mm; right:15mm; bottom:12mm; display:flex; justify-content:space-between; font-size:8pt; color:var(--musgo); border-top:.8px solid var(--musgo); padding-top:3mm }
</style></head><body>
<section class="pagina">
  <header>
    <div><h1>Estúdio<br><span>Exemplo</span></h1><p class="intro">Pilates em aparelho, em turmas de até 4 alunos. Postura, força e menos dor, no seu ritmo.</p></div>
    <img class="capa" src="${foto(planos[1] ?? planos[0])}">
  </header>
  <h2>Planos</h2>
  <div class="pls">${planos.map((p, i) => plano(p, i === 1)).join('')}</div>
  ${exp ? `<div class="exp"><img src="${foto(exp)}"><div><small>primeira vez aqui?</small><h3>Aula experimental</h3><p>${esc(exp.descricao)}</p><b>Grátis · agende pelo WhatsApp</b></div></div>` : ''}
  <div class="pe"><span>Segunda a sexta, das 6h às 21h · sábado, das 8h às 12h</span><span>Demonstração 4YU</span></div>
</section>
</body></html>`
}

const RAMOS = { pizzaria, hamburgueria, restaurante, comercio: moda, servicos: salao, aulas }

const navegador = await chromium.launch()
for (const [ramo, montar] of Object.entries(RAMOS)) {
  const html = montar()
  writeFileSync(join(SAIDA, `${ramo}.html`), html)
  const pagina = await navegador.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.6 })
  await pagina.setContent(html, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.pdf({ path: join(SAIDA, `${ramo}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true })
  await pagina.emulateMedia({ media: 'print' })
  await pagina.screenshot({ path: join(SAIDA, `${ramo}.png`), clip: { x: 0, y: 0, width: 794, height: 1123 } })
  await pagina.close()
  console.log('ok', ramo)
}
await navegador.close()
