// Cria o modelo `pedido_pendente_cupom` (pedido com pagamento pendente + cupom),
// pelo mesmo caminho de scripts/carrinho/criar-modelos.mts.
// Uso: npx tsx --conditions=react-server --env-file=.env scripts/carrinho/criar-pendente-cupom.mts <clienteId> <foto-exemplo.png>
import { readFileSync } from 'node:fs'
import { normalizarNome, temErro, validarTemplate, type Componentes } from '@/core/templates'
import { criarTemplateNaMeta, subirExemploDeMidia } from '@/channels/templates-api'
import { guardarNoAcervo } from '@/server/repos/acervo'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { lerTokenDoCanal, listarCanais } from '@/server/repos/conversas'
import { criarRascunho, listarTemplates, marcarSubmetido } from '@/server/repos/templates'

const [clienteId, foto] = process.argv.slice(2)
if (!clienteId || !foto) throw new Error('uso: <clienteId> <foto.png>')
const NOME = 'pedido_pendente_cupom'

const [existentes, canais] = await Promise.all([listarTemplates(clienteId), listarCanais(clienteId)])
if (existentes.some((t) => t.nome === NOME)) throw new Error(`${NOME} já existe`)
const canal = canais.find((c) => c.provider === 'cloud-api' && c.status === 'ativo')
if (!canal) throw new Error('sem WhatsApp conectado')
const wabaId = (await coexistenciaDoCliente(clienteId))[canal.id]?.wabaId
if (!wabaId) throw new Error('sem WABA')
const token = await lerTokenDoCanal(canal)

const bytes = readFileSync(foto)
const exemplo = (await guardarNoAcervo(clienteId, new File([bytes], 'pedido-pendente.png', { type: 'image/png' }))).url
const subida = await subirExemploDeMidia({ token, bytes: new Uint8Array(bytes), mime: 'image/png' })
if (!subida.ok) throw new Error(`upload do exemplo: ${subida.erro}`)

const componentes: Componentes = {
  cabecalho: { tipo: 'imagem', url: exemplo },
  corpo:
    'Fala, {{1}}! 🎮\n\nSeu *{{2}}* ficou esperando o pagamento. Ainda dá tempo de completar o setup! 🕹️\n\n' +
    'Liberamos *10% OFF* pra você: refaça o pedido no site e aplique o cupom *CHAT10* no carrinho.\n\n' +
    'Ficou alguma dúvida? Chama aqui que a gente responde. 💬',
  rodape: 'Para não receber promoções, responda SAIR.',
  botoes: [
    { tipo: 'COPY_CODE', texto: 'Copiar código', valor: 'CHAT10' },
    { tipo: 'URL', texto: 'Ver produto', valor: 'https://www.pcyes.com.br/{{1}}' },
  ],
}
const reparos = validarTemplate(NOME, componentes, 'MARKETING')
if (temErro(reparos)) throw new Error(`inválido: ${JSON.stringify(reparos)}`)
const rascunho = await criarRascunho({ clienteId, nome: normalizarNome(NOME), idioma: 'pt_BR', categoria: 'MARKETING', componentes })
const r = await criarTemplateNaMeta({
  wabaId, token, nome: NOME, idioma: 'pt_BR', categoria: 'MARKETING', componentes,
  exemplos: { corpo: ['Maria', 'Monitor Gamer Z-Max Z34C 34"'], cabecalhoMidia: subida.handle },
})
if (!r.ok) throw new Error(`META RECUSOU: ${r.erro.codigo} ${r.erro.mensagem}`)
await marcarSubmetido(rascunho.id, { wabaTemplateId: r.template.wabaTemplateId, status: r.template.status === 'desconhecido' ? 'pendente' : r.template.status, categoria: r.template.categoria })
console.log(NOME, 'enviado:', r.template.status, r.template.categoria)
