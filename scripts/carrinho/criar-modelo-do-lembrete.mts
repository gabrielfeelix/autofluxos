// Cria um modelo do lembrete de pagamento pendente (core/lembrete-de-pagamento.ts)
// pelo mesmo caminho de scripts/carrinho/criar-modelos.mts, sem a sessão do painel.
// Uso: npx tsx --conditions=react-server --env-file=.env scripts/carrinho/criar-modelo-do-lembrete.mts <clienteId> <foto.png> [pagamento_pendente_cupom|pagamento_pendente]
import { readFileSync } from 'node:fs'
import { MODELO_COM_CUPOM, modelosDoLembrete } from '@/core/lembrete-de-pagamento'
import { normalizarNome, temErro, validarTemplate } from '@/core/templates'
import { criarTemplateNaMeta, subirExemploDeMidia } from '@/channels/templates-api'
import { guardarNoAcervo } from '@/server/repos/acervo'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { lerTokenDoCanal, listarCanais } from '@/server/repos/conversas'
import { lojaDaConta } from '@/server/repos/lojas'
import { criarRascunho, listarTemplates, marcarSubmetido } from '@/server/repos/templates'

const [clienteId, foto, nome = MODELO_COM_CUPOM] = process.argv.slice(2)
if (!clienteId || !foto) throw new Error('uso: <clienteId> <foto.png> [nome]')

const [loja, existentes, canais] = await Promise.all([lojaDaConta(clienteId), listarTemplates(clienteId), listarCanais(clienteId)])
if (!loja?.endereco) throw new Error('loja não encontrada')
if (existentes.some((t) => t.nome === nome)) throw new Error(`${nome} já existe`)
const canal = canais.find((c) => c.provider === 'cloud-api' && c.status === 'ativo')
if (!canal) throw new Error('sem WhatsApp conectado')
const wabaId = (await coexistenciaDoCliente(clienteId))[canal.id]?.wabaId
if (!wabaId) throw new Error('sem WABA')
const token = await lerTokenDoCanal(canal)

const bytes = readFileSync(foto)
const mime = foto.endsWith('.png') ? 'image/png' : 'image/jpeg'
const url = (await guardarNoAcervo(clienteId, new File([bytes], foto.split('/').pop() ?? 'foto', { type: mime }))).url
const subida = await subirExemploDeMidia({ token, bytes: new Uint8Array(bytes), mime })
if (!subida.ok) throw new Error(`upload do exemplo: ${subida.erro}`)

const modelo = modelosDoLembrete({ endereco: loja.endereco, foto: url }).find((m) => m.nome === nome)
if (!modelo) throw new Error(`modelo desconhecido: ${nome}`)
const reparos = validarTemplate(modelo.nome, modelo.componentes, modelo.categoria)
if (temErro(reparos)) throw new Error(`inválido: ${JSON.stringify(reparos)}`)
const rascunho = await criarRascunho({ clienteId, nome: normalizarNome(modelo.nome), idioma: 'pt_BR', categoria: modelo.categoria, componentes: modelo.componentes })
const r = await criarTemplateNaMeta({
  wabaId, token, nome: modelo.nome, idioma: 'pt_BR', categoria: modelo.categoria, componentes: modelo.componentes,
  exemplos: { corpo: modelo.exemplos, cabecalhoMidia: subida.handle },
})
if (!r.ok) throw new Error(`META RECUSOU: ${r.erro.codigo} ${r.erro.mensagem}`)
await marcarSubmetido(rascunho.id, { wabaTemplateId: r.template.wabaTemplateId, status: r.template.status === 'desconhecido' ? 'pendente' : r.template.status, categoria: r.template.categoria })
console.log(modelo.nome, 'enviado:', r.template.status, r.template.categoria)
