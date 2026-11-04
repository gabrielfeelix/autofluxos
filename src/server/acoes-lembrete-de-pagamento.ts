'use server'

import { headers } from 'next/headers'
import { modeloDoLembrete, modelosDoLembrete, validarLembrete } from '@/core/lembrete-de-pagamento'
import type { CupomDaLoja } from '@/loja/magento-cupons'
import { acaoCriarTemplate } from './acoes-transmissoes'
import { cuponsDaConta } from './adaptador-da-loja'
import { exigirCapacidade, recusou } from './permissoes'
import { guardarNoAcervo } from './repos/acervo'
import { lojaDaConta, salvarLembrete } from './repos/lojas'
import { listarTemplates } from './repos/templates'

type Resultado = { ok: true } | { ok: false; motivo: string }

/**
 * Salva o lembrete de pagamento pendente (0162). Ligar exige a loja com token
 * e o modelo escolhido aprovado: ligado sem modelo seria um interruptor que
 * diz que manda e não manda nada.
 */
export async function acaoSalvarLembrete(clienteId: string, bruto: unknown): Promise<Resultado> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }

  const config = validarLembrete(bruto)
  if (!config.ok) return config
  if (config.valor.ativo) {
    const loja = await lojaDaConta(clienteId)
    if (!loja?.ativa) return { ok: false, motivo: 'Ligue a loja antes.' }
    if (!loja.conexaoId) return { ok: false, motivo: 'Conecte o token da loja antes: é com ele que os pedidos são lidos.' }
    const nome = modeloDoLembrete(config.valor)
    const modelo = (await listarTemplates(clienteId)).find((t) => t.nome === nome)
    if (modelo?.status !== 'aprovado') {
      return { ok: false, motivo: modelo ? 'O modelo ainda não foi aprovado pela Meta.' : 'Crie o modelo da mensagem antes de ligar.' }
    }
  }
  try {
    return (await salvarLembrete(clienteId, config.valor)) ? { ok: true } : { ok: false, motivo: 'A loja desta conta não está configurada.' }
  } catch {
    return { ok: false, motivo: 'Não foi possível salvar agora. Tente de novo em instantes.' }
  }
}

/** Cria e manda para a Meta o modelo do lembrete (com ou sem cupom), com o texto que a tela mostra. */
export async function acaoCriarModeloDoLembrete(clienteId: string, comCupom: boolean): Promise<Resultado> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }

  const loja = await lojaDaConta(clienteId)
  if (!loja?.endereco) return { ok: false, motivo: 'Conecte a loja Magento antes: o botão leva para a página do produto.' }
  const nome = modeloDoLembrete({ cupom: comCupom ? 'x' : null })
  if ((await listarTemplates(clienteId)).some((t) => t.nome === nome)) return { ok: true }

  let foto: string
  try {
    const cabecalhos = await headers()
    const origem = `${cabecalhos.get('x-forwarded-proto') ?? 'https'}://${cabecalhos.get('host')}`
    const resposta = await fetch(`${origem}/exemplos/carrinho-produto.jpg`)
    if (!resposta.ok) throw new Error(`a foto de exemplo respondeu ${resposta.status}`)
    const arquivo = new File([await resposta.arrayBuffer()], 'carrinho-produto.jpg', { type: 'image/jpeg' })
    foto = (await guardarNoAcervo(clienteId, arquivo)).url
  } catch (erro) {
    return { ok: false, motivo: `Não foi possível preparar a foto de exemplo: ${erro instanceof Error ? erro.message : String(erro)}` }
  }

  const modelo = modelosDoLembrete({ endereco: loja.endereco, foto }).find((m) => m.nome === nome)
  if (!modelo) return { ok: false, motivo: 'Modelo desconhecido.' }
  const r = await acaoCriarTemplate(clienteId, {
    nome: modelo.nome,
    categoria: modelo.categoria,
    componentes: modelo.componentes,
    exemplos: modelo.exemplos,
  })
  return r.ok ? { ok: true } : { ok: false, motivo: r.erro ?? 'A Meta recusou o modelo.' }
}

/** Os cupons ativos da loja, para escolher qual vai no lembrete. */
export async function acaoCuponsDoLembrete(clienteId: string): Promise<{ ok: true; cupons: CupomDaLoja[] } | { ok: false; motivo: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }
  const r = await cuponsDaConta(clienteId)
  return r.ok ? { ok: true, cupons: r.valor } : { ok: false, motivo: r.motivo }
}
