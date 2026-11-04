import 'server-only'
import { agendasDaConta, salvarAgenda } from '../repos/agendas'
import { criarConexao, listarConexoes, trocarValor } from '../repos/conexoes'

const NOME_DA_CONEXAO = 'Google Agenda (agenda)'

/**
 * Guarda o refresh token no cofre e liga o Google Agenda como a agenda da IA.
 *
 * Mesmo desenho de `acaoConectarAgenda`: credencial em `connections`, uma
 * agenda ativa por vez (as outras desligam, sem perder a chave).
 */
export async function ligarGoogleAgenda(entrada: { clienteId: string; refreshToken: string; email: string | null }): Promise<void> {
  const { clienteId } = entrada
  const valor = JSON.stringify({ refreshToken: entrada.refreshToken })
  const existente = (await listarConexoes(clienteId)).find((c) => c.nome === NOME_DA_CONEXAO)
  const conexaoId = existente
    ? (await trocarValor(existente.id, clienteId, valor), existente.id)
    : (await criarConexao({ clienteId, nome: NOME_DA_CONEXAO, tipo: 'bearer', valor })).id

  const agendas = await agendasDaConta(clienteId)
  for (const outra of agendas) {
    if (outra.plataforma !== 'google_agenda' && outra.ativo) {
      await salvarAgenda({ clienteId, plataforma: outra.plataforma, conexaoId: outra.conexaoId, ajustes: outra.ajustes, ativo: false })
    }
  }
  const anterior = agendas.find((a) => a.plataforma === 'google_agenda')
  await salvarAgenda({
    clienteId,
    plataforma: 'google_agenda',
    conexaoId,
    ajustes: { ...(anterior?.ajustes ?? {}), ...(entrada.email ? { conta: entrada.email } : {}) },
    ativo: true,
    conferidoEm: new Date(),
  })
}
