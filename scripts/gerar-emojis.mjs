// Gera src/core/emojis-completos.json a partir do emojibase-data em português.
//
// Uso: node scripts/gerar-emojis.mjs
//
// Fica de fora o que a Noto Color Emoji (a fonte do painel) ainda não desenha:
// emoji de versão acima de VERSAO_MAXIMA sairia na fonte do sistema, com
// outro traço e outra proporção no meio da grade.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const VERSAO_MAXIMA = 16

const dados = JSON.parse(readFileSync(require.resolve('emojibase-data/pt/data.json'), 'utf8'))

// A ordem e os nomes do WhatsApp; "pessoas" entra junto com "smileys".
const CATEGORIAS = [
  { chave: 'rostos', nome: 'Smileys e pessoas', grupos: [0, 1] },
  { chave: 'natureza', nome: 'Animais e natureza', grupos: [3] },
  { chave: 'comida', nome: 'Comidas e bebidas', grupos: [4] },
  { chave: 'atividades', nome: 'Atividades', grupos: [6] },
  { chave: 'viagens', nome: 'Viagens e lugares', grupos: [5] },
  { chave: 'objetos', nome: 'Objetos', grupos: [7] },
  { chave: 'simbolos', nome: 'Símbolos', grupos: [8] },
  { chave: 'bandeiras', nome: 'Bandeiras', grupos: [9] },
]

const saida = CATEGORIAS.map((categoria) => ({
  chave: categoria.chave,
  nome: categoria.nome,
  // [emoji, "nome e palavras-chave"], o texto da busca já junto.
  itens: dados
    .filter((e) => categoria.grupos.includes(e.group) && e.version <= VERSAO_MAXIMA)
    .sort((a, b) => a.order - b.order)
    .map((e) => [e.emoji, [e.label, ...(e.tags ?? [])].join(' ')]),
}))

writeFileSync('src/core/emojis-completos.json', JSON.stringify(saida))
console.log(saida.map((c) => `${c.nome}: ${c.itens.length}`).join('\n'))
