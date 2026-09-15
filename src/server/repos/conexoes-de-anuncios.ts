import 'server-only'
import { criarConexao, listarConexoes, trocarValor } from './conexoes'
import { NOME_DA_CONEXAO_DE_ADS } from '../token-de-anuncios'

/**
 * Guardar o token de anúncios, venha ele do diálogo da Meta ou colado à mão.
 *
 * Os dois caminhos gravam no **mesmo lugar** — uma Conexão `meta-ads` do tipo
 * bearer — e é isso que mantém o resto do produto sem saber de onde ele veio.
 * `tokenDeAnuncios()` lê um só, e trocar de caminho não muda nada para quem usa.
 */
export async function guardarTokenDeAnuncios(entrada: {
  clienteId: string
  token: string
  expiraEm: Date | null
}): Promise<void> {
  const existente = (await listarConexoes(entrada.clienteId)).find(
    (c) => c.nome.trim().toLowerCase() === NOME_DA_CONEXAO_DE_ADS,
  )

  if (existente) {
    /*
     * Reconectar é o caminho normal, não a exceção: o token do diálogo vence em
     * 60 dias. Trocar o valor da conexão existente mantém tudo que aponta para
     * ela — em vez de criar uma segunda e deixar a antiga apodrecendo.
     */
    await trocarValor(existente.id, entrada.clienteId, entrada.token)
    return
  }

  await criarConexao({
    clienteId: entrada.clienteId,
    nome: NOME_DA_CONEXAO_DE_ADS,
    tipo: 'bearer',
    campo: null,
    valor: entrada.token,
  })
}
