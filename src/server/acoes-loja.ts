'use server'

import { revalidatePath } from 'next/cache'
import { normalizarEndereco, type ProdutoDaLoja } from '@/core/loja'
import { lojaMagento } from '@/loja/magento'
import { exigirCapacidade, recusou } from './permissoes'
import { ligarLoja, salvarLoja } from './repos/lojas'

/**
 * A tela da loja Magento: testar, ligar, desligar.
 *
 * **Salvar refaz o teste no servidor.** O resultado que a tela mostrou veio do
 * navegador e poderia ter sido montado à mão; o que vale é o teste que o
 * servidor acabou de fazer, e é ele que decide o sufixo e o código da loja.
 *
 * Nada aqui apaga coisa nenhuma. Desligar é `ativa = false`.
 */

export type ResultadoDoTeste =
  | {
      ok: true
      endereco: string
      codigoDaLoja: string | null
      sufixo: string
      moeda: string
      amostra: ProdutoDaLoja[]
      /** A loja ainda não marcou "combina com" no produto testado. */
      semComplementos: boolean
    }
  | { ok: false; motivo: string }

async function testar(enderecoDigitado: string, termoDigitado: string): Promise<ResultadoDoTeste> {
  const endereco = normalizarEndereco(enderecoDigitado)
  if (!endereco.ok) return endereco

  // A busca do Magento ignora termo curto: pedir um produto de verdade é o
  // que prova que a busca responde, e não só que o servidor está de pé.
  const termo = termoDigitado.trim()
  if (termo.length < 3) return { ok: false, motivo: 'escreva o nome de um produto que a loja vende, com 3 letras ou mais' }

  const config = await lojaMagento({ endereco: endereco.endereco, codigoDaLoja: null, sufixo: '' }).lerConfig()
  if (!config.ok) {
    return {
      ok: false,
      motivo: `${config.motivo}. Confira se o endereço é o da loja Magento, e se o firewall da loja (Cloudflare, por exemplo) libera acesso ao /graphql.`,
    }
  }

  const loja = lojaMagento({
    endereco: endereco.endereco,
    codigoDaLoja: config.valor.codigoDaLoja,
    sufixo: config.valor.sufixo,
  })
  const busca = await loja.buscar(termo)
  if (!busca.ok) return busca
  if (busca.valor.length === 0) {
    return { ok: false, motivo: `a loja respondeu, mas não achou nada para "${termo}". Tente o nome de um produto que aparece no site.` }
  }

  const complementos = await loja.combinaCom(busca.valor[0]!.produtoId)

  return {
    ok: true,
    endereco: endereco.endereco,
    codigoDaLoja: config.valor.codigoDaLoja,
    sufixo: config.valor.sufixo,
    moeda: config.valor.moeda,
    amostra: busca.valor.slice(0, 3),
    semComplementos: !complementos.ok || complementos.valor.length === 0,
  }
}

export async function acaoTestarLoja(
  clienteId: string,
  endereco: string,
  termo: string,
): Promise<ResultadoDoTeste> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }
  return testar(endereco, termo)
}

export async function acaoLigarLoja(
  clienteId: string,
  endereco: string,
  termo: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }

  const teste = await testar(endereco, termo)
  if (!teste.ok) return teste

  await salvarLoja(clienteId, { endereco: teste.endereco, codigoDaLoja: teste.codigoDaLoja, sufixo: teste.sufixo })
  const ligada = await ligarLoja(clienteId, true)
  if (!ligada.ok) return ligada

  revalidatePath(`/clientes/${clienteId}/ajustes/integracoes`)
  return { ok: true }
}

export async function acaoDesligarLoja(clienteId: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }

  const r = await ligarLoja(clienteId, false)
  revalidatePath(`/clientes/${clienteId}/ajustes/integracoes`)
  return r
}
