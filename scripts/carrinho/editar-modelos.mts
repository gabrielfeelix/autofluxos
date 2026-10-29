// Reescreve na Meta os modelos do carrinho já criados com o texto atual de
// `core/carrinho.ts`, mantendo nome e id (voltam para revisão).
// Uso: npx tsx --conditions=react-server --env-file=.env scripts/carrinho/editar-modelos.mts <clienteId> [carrinho_N]
import { readFileSync } from 'node:fs'
import { modelosDoCarrinho } from '@/core/carrinho'
import { temErro, validarTemplate } from '@/core/templates'
import { editarTemplateNaMeta, subirExemploDeMidia } from '@/channels/templates-api'
import { acharCliente } from '@/server/repos/clientes'
import { lerTokenDoCanal, listarCanais } from '@/server/repos/conversas'
import { lojaDaConta } from '@/server/repos/lojas'
import { gravarComponentes, listarTemplates, marcarSubmetido } from '@/server/repos/templates'

const [clienteId, so] = process.argv.slice(2)
if (!clienteId) throw new Error('informe o clienteId')

const [cliente, loja, existentes, canais] = await Promise.all([acharCliente(clienteId), lojaDaConta(clienteId), listarTemplates(clienteId), listarCanais(clienteId)])
if (!cliente || !loja?.endereco) throw new Error('organização ou loja não encontrada')
const canal = canais.find((c) => c.provider === 'cloud-api' && c.status === 'ativo')
if (!canal) throw new Error('sem WhatsApp conectado')
const token = await lerTokenDoCanal(canal)

const bytes = readFileSync('public/exemplos/carrinho-produto.jpg')
const subida = await subirExemploDeMidia({ token, bytes: new Uint8Array(bytes), mime: 'image/jpeg' })
if (!subida.ok) throw new Error(`upload do exemplo: ${subida.erro}`)

for (const modelo of modelosDoCarrinho({ nome: cliente.nome, endereco: loja.endereco, exemplo: '' })) {
  if (so && modelo.nome !== so) continue
  const atual = existentes.find((t) => t.nome === modelo.nome)
  if (!atual?.wabaTemplateId) { console.log(modelo.nome, 'não existe na Meta'); continue }
  // A foto guardada no modelo continua a de antes (acervo); só o texto muda.
  const componentes = modelo.componentes.carrossel
    ? { ...modelo.componentes, carrossel: { ...modelo.componentes.carrossel, exemplo: atual.componentes.carrossel?.exemplo } }
    : { ...modelo.componentes, cabecalho: atual.componentes.cabecalho ?? modelo.componentes.cabecalho }
  if (temErro(validarTemplate(modelo.nome, componentes, 'MARKETING'))) { console.log(modelo.nome, 'inválido'); continue }
  const r = await editarTemplateNaMeta({
    token,
    wabaTemplateId: atual.wabaTemplateId,
    componentes,
    exemplos: {
      corpo: modelo.exemplos,
      ...(componentes.carrossel ? { cartaoMidia: subida.handle, cartaoCorpo: modelo.exemplosDoCartao } : { cabecalhoMidia: subida.handle }),
    },
  })
  if (!r.ok) { console.log(modelo.nome, 'META RECUSOU:', r.erro.codigo, r.erro.mensagem); continue }
  await gravarComponentes(atual.id, componentes)
  await marcarSubmetido(atual.id, { wabaTemplateId: atual.wabaTemplateId, status: 'pendente' })
  console.log(modelo.nome, 'editado, em revisão')
}
