/**
 * Gera as tramas de fios de fundo (`public/fundos/fios-*.svg`), usadas pelas
 * variáveis `--casca-fios`, `--casca-fios-2` e `--casca-fios-3` de
 * `src/app/globals.css`: a capa do site, os palcos coloridos, as chamadas e a
 * casca do app.
 *
 * Antes era um desenho só de 240x150 repetido, e a repetição saltava aos
 * olhos. Agora cada trama tem 4x4 células, e cada célula sorteia um dos
 * motivos abaixo (alguns espelhados). Três sementes, três tramas: cada lugar
 * usa uma, e a repetição só volta a cada 960x600.
 *
 * Rodar de novo depois de mudar um motivo:  node scripts/fundos/gerar-fios.mjs
 */
import { writeFileSync } from 'node:fs'

const L = 240 // largura da célula
const A = 150 // altura da célula
const COLUNAS = 4
const LINHAS = 4

const no = (x, y, w = 52) => `<rect x="${x}" y="${y}" width="${w}" height="24" rx="7"/>`
const ponta = (x, y) => `<circle cx="${x}" cy="${y}" r="6"/>`
const fio = (d) => `<path d="${d}"/>`
const ligacao = (x, y) => `<circle class="p" cx="${x}" cy="${y}" r="2.5"/>`

/** Cada motivo devolve o traço e as ligações (pontos cheios), em coordenadas da célula. */
const MOTIVOS = [
  // O fluxo original: dois blocos, duas pontas, fios cruzando.
  () => [
    no(20, 18) + no(140, 80) + ponta(212, 30) + ponta(46, 118) +
      fio('M72 30c40 0 30 62 68 62M192 92c26 0 20-46 20-56M46 42v70M52 118c40 0 60-14 88-14'),
    ligacao(72, 30) + ligacao(140, 92) + ligacao(192, 92),
  ],
  // Bifurcação: um bloco abre em dois.
  () => [
    no(24, 62) + no(140, 18) + no(140, 106) + ponta(216, 30) +
      fio('M76 74c30 0 30-44 64-44M76 74c30 0 30 44 64 44M192 30h18'),
    ligacao(76, 74) + ligacao(140, 30) + ligacao(140, 118),
  ],
  // Fila de três blocos.
  () => [
    no(14, 63, 44) + no(98, 63, 44) + no(182, 63, 44) + fio('M58 75h40M142 75h40'),
    ligacao(58, 75) + ligacao(98, 75) + ligacao(142, 75) + ligacao(182, 75),
  ],
  // Condição em losango, com dois caminhos.
  () => [
    no(18, 63) + '<path d="M122 58l17 17-17 17-17-17z"/>' + no(178, 23, 46) + no(178, 103, 46) +
      fio('M70 75h35M139 75c20 0 20-40 39-40M139 75c20 0 20 40 39 40'),
    ligacao(70, 75) + ligacao(178, 35) + ligacao(178, 115),
  ],
  // Vertical: um bloco embaixo do outro, com uma ponta ao lado.
  () => [
    no(94, 14) + no(94, 112) + ponta(206, 78) + fio('M120 38v74M146 26c40 0 60 22 60 46'),
    ligacao(120, 38) + ligacao(120, 112) + ligacao(146, 26),
  ],
  // Laço: o segundo bloco volta para o primeiro.
  () => [
    no(30, 40) + no(156, 40) + fio('M82 52h74M182 64c0 54-126 54-126 0'),
    ligacao(82, 52) + ligacao(156, 52) + ligacao(182, 64) + ligacao(56, 64),
  ],
  // Menu: um bloco com três saídas.
  () => [
    no(24, 63) + ponta(150, 33) + ponta(150, 75) + ponta(150, 117) + no(176, 63, 44) +
      fio('M76 75c30 0 30-42 68-42M76 75h68M76 75c30 0 30 42 68 42M156 75h20'),
    ligacao(76, 75),
  ],
  // Fio solto entre duas pontas.
  () => [ponta(30, 40) + ponta(210, 112) + fio('M36 40c80 0 90 72 168 72'), ''],
  // Respiro: quase vazio, só pontos.
  () => ['', ligacao(60, 40) + ligacao(170, 96) + ligacao(118, 128)],
  // Junção: dois blocos entram num só.
  () => [
    no(18, 20, 48) + no(18, 106, 48) + no(132, 63) + ponta(216, 75) +
      fio('M66 32c34 0 34 43 66 43M66 118c34 0 34-43 66-43M184 75h26'),
    ligacao(66, 32) + ligacao(66, 118) + ligacao(132, 75),
  ],
]

// Peso de cada motivo: o respiro e o fio solto aparecem menos.
const PESOS = [3, 3, 2, 3, 2, 2, 3, 1, 1, 3]

function sorteador(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function escolher(sorte) {
  const total = PESOS.reduce((a, b) => a + b, 0)
  let r = sorte() * total
  for (let i = 0; i < PESOS.length; i++) {
    r -= PESOS[i]
    if (r < 0) return i
  }
  return 0
}

function trama(semente) {
  const sorte = sorteador(semente)
  let ultimo = -1
  const celulas = []
  for (let l = 0; l < LINHAS; l++) {
    for (let c = 0; c < COLUNAS; c++) {
      let i = escolher(sorte)
      if (i === ultimo) i = (i + 1) % MOTIVOS.length // dois iguais lado a lado, não
      ultimo = i
      const [traco, pontos] = MOTIVOS[i]()
      const espelha = sorte() < 0.5
      // Um deslocamento pequeno por célula tira a cara de grade.
      const x = c * L + Math.round((sorte() - 0.5) * 28)
      const y = l * A + Math.round((sorte() - 0.5) * 22)
      const transformacao = espelha ? `translate(${x + L} ${y}) scale(-1 1)` : `translate(${x} ${y})`
      celulas.push(`<g transform="${transformacao}">${traco}${pontos}</g>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L * COLUNAS}" height="${A * LINHAS}"><style>g{fill:none;stroke:#fff;stroke-opacity:.1;stroke-width:1.4}.p{fill:#fff;fill-opacity:.1;stroke:none}</style>${celulas.join('')}</svg>\n`
}

const SEMENTES = [4, 17, 29]
SEMENTES.forEach((semente, i) => {
  writeFileSync(new URL(`../../public/fundos/fios-${i + 1}.svg`, import.meta.url), trama(semente))
})
console.log(`${SEMENTES.length} tramas em public/fundos/`)
