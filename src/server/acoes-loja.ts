'use server'

import { revalidatePath } from 'next/cache'
import { normalizarEndereco, type ProdutoDaLoja } from '@/core/loja'
import { lojaMagento } from '@/loja/magento'
import { lojaAdmin } from '@/loja/magento-admin'
import { exigirCapacidade, recusou } from './permissoes'
import { apagarConexao, criarConexao } from './repos/conexoes'
import { ehPlataformaDeLoja } from '@/core/plataformas-de-loja'
import {
  desligarEstoqueExato,
  ligarEstoqueExato,
  ligarLoja,
  lojaDaConta,
  registrarPedidoDeLoja,
  salvarLoja,
} from './repos/lojas'

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

/**
 * Conecta o token de administrador: foto real e estoque exato.
 *
 * **O token é conferido na loja antes de tocar o cofre.** Se a loja recusar,
 * nada é gravado e o valor morre com esta requisição. O token nunca volta em
 * retorno nenhum desta ação, nem em mensagem de erro.
 *
 * O SKU de teste é o primeiro produto da amostra que a tela mostrou: provar o
 * token num produto que existe é o que distingue "token ruim" de "SKU errado".
 */
export async function acaoConectarToken(
  clienteId: string,
  tokenDigitado: string,
  skuDeTeste: string,
): Promise<{ ok: true; via: 'msi' | 'legado' } | { ok: false; motivo: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }

  const token = tokenDigitado.trim()
  if (token.length < 20) return { ok: false, motivo: 'cole o Token de acesso inteiro, como o Magento mostrou' }
  if (skuDeTeste.trim() === '') return { ok: false, motivo: 'teste a loja antes, para termos um produto de prova' }

  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa) return { ok: false, motivo: 'ligue a loja antes de conectar o token' }
  if (loja.conexaoId) return { ok: false, motivo: 'já há um token conectado; desconecte antes de trocar' }

  const admin = lojaAdmin({ endereco: loja.endereco, credencial: { tipo: 'bearer', campo: null, valor: token } })
  const descoberta = await admin.descobrir(skuDeTeste.trim())
  if (!descoberta.ok) {
    return {
      ok: false,
      motivo:
        descoberta.motivo === 'o token foi recusado pela loja'
          ? 'a loja recusou o token. Confira se copiou o Token de acesso (não o Consumer Key) e se a opção de usar como Bearer está ligada.'
          : descoberta.motivo,
    }
  }

  const conexao = await criarConexao({
    clienteId,
    nome: 'Magento (somente leitura)',
    tipo: 'bearer',
    valor: token,
  })
  await ligarEstoqueExato(clienteId, {
    conexaoId: conexao.id,
    via: descoberta.valor.via,
    estoqueId: descoberta.valor.estoqueId,
  })

  revalidatePath(`/clientes/${clienteId}/loja/magento`)
  return { ok: true, via: descoberta.valor.via }
}

/**
 * Desconecta o token. Nessa ordem, e a ordem é a regra da 0092: primeiro zera
 * o estoque exato, depois apaga a Conexão (e o gatilho da 0006 apaga o segredo
 * no Vault). A inversa esbarra no check `lojas_estoque_exige_token`.
 *
 * Não toca a loja: revogar do lado de lá é o lojista, em Sistema > Integrações.
 */
export async function acaoDesconectarToken(clienteId: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }

  const { conexaoId } = await desligarEstoqueExato(clienteId)
  if (conexaoId) await apagarConexao(conexaoId, clienteId)

  revalidatePath(`/clientes/${clienteId}/loja/magento`)
  return { ok: true }
}

/**
 * "Quero esta" num cartão "Em breve" de Loja > Conectar loja.
 *
 * Mesma porta das outras ações da loja: quem pede integração para a conta é
 * quem configura a operação. **Não revalida nada**: a tela marca o cartão na
 * hora (otimista) e desfaz se isto voltar erro.
 */
export async function acaoQueroEstaPlataforma(
  clienteId: string,
  plataforma: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }

  // A lista fechada é conferida aqui e no check da 0103: sem esta linha o banco
  // recusaria com 23514 e a tela mostraria um erro de Postgres.
  if (!ehPlataformaDeLoja(plataforma)) return { ok: false, motivo: 'essa plataforma não está na lista' }
  return registrarPedidoDeLoja(clienteId, plataforma)
}
