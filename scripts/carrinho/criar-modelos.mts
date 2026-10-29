// Cria os modelos do carrinho abandonado de uma organização, pelo mesmo
// caminho do botão em Comércio › Integrações › Magento, sem a sessão do painel.
// Uso: npx tsx --conditions=react-server --env-file=.env scripts/carrinho/criar-modelos.mts <clienteId> [carrinho_N]
import { readFileSync } from 'node:fs'
import { modelosDoCarrinho } from '@/core/carrinho'
import { normalizarNome, temErro, validarTemplate } from '@/core/templates'
import { criarTemplateNaMeta, subirExemploDeMidia } from '@/channels/templates-api'
import { guardarNoAcervo } from '@/server/repos/acervo'
import { acharCliente } from '@/server/repos/clientes'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { lerTokenDoCanal, listarCanais } from '@/server/repos/conversas'
import { lojaDaConta } from '@/server/repos/lojas'
import { criarRascunho, listarTemplates, marcarSubmetido } from '@/server/repos/templates'

const [clienteId, so] = process.argv.slice(2)
if (!clienteId) throw new Error('informe o clienteId')

const [cliente, loja, existentes, canais] = await Promise.all([acharCliente(clienteId), lojaDaConta(clienteId), listarTemplates(clienteId), listarCanais(clienteId)])
if (!cliente || !loja?.endereco) throw new Error('organização ou loja não encontrada')
const canal = canais.find((c) => c.provider === 'cloud-api' && c.status === 'ativo')
if (!canal) throw new Error('sem WhatsApp conectado')
const wabaId = (await coexistenciaDoCliente(clienteId))[canal.id]?.wabaId
if (!wabaId) throw new Error('sem WABA')
const token = await lerTokenDoCanal(canal)

const bytes = readFileSync('public/exemplos/carrinho-produto.jpg')
const exemplo = (await guardarNoAcervo(clienteId, new File([bytes], 'carrinho-produto.jpg', { type: 'image/jpeg' }))).url
const subida = await subirExemploDeMidia({ token, bytes: new Uint8Array(bytes), mime: 'image/jpeg' })
if (!subida.ok) throw new Error(`upload do exemplo: ${subida.erro}`)

const nomes = new Set(existentes.map((t) => t.nome))
for (const modelo of modelosDoCarrinho({ nome: cliente.nome, endereco: loja.endereco, exemplo })) {
  if (so && modelo.nome !== so) continue
  if (nomes.has(modelo.nome)) { console.log(modelo.nome, 'já existe'); continue }
  const reparos = validarTemplate(modelo.nome, modelo.componentes, 'MARKETING')
  if (temErro(reparos)) { console.log(modelo.nome, 'inválido', reparos); continue }
  const rascunho = await criarRascunho({ clienteId, nome: normalizarNome(modelo.nome), idioma: 'pt_BR', categoria: 'MARKETING', componentes: modelo.componentes })
  const r = await criarTemplateNaMeta({
    wabaId, token, nome: modelo.nome, idioma: 'pt_BR', categoria: 'MARKETING', componentes: modelo.componentes,
    exemplos: {
      corpo: modelo.exemplos,
      ...(modelo.componentes.carrossel ? { cartaoMidia: subida.handle, cartaoCorpo: modelo.exemplosDoCartao } : { cabecalhoMidia: subida.handle }),
    },
  })
  if (!r.ok) { console.log(modelo.nome, 'META RECUSOU:', r.erro.codigo, r.erro.mensagem); continue }
  await marcarSubmetido(rascunho.id, { wabaTemplateId: r.template.wabaTemplateId, status: r.template.status === 'desconhecido' ? 'pendente' : r.template.status, categoria: r.template.categoria })
  console.log(modelo.nome, 'enviado:', r.template.status, r.template.categoria)
}
