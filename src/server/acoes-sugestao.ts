'use server'

import { ATO_DA_SUGESTAO, ATO_DA_TRIAGEM, conferirSugestao, ehSituacaoDaSugestao, ROTULO_DA_SITUACAO, telaDaSugestao } from '@/core/sugestoes'
import { exigirCapacidade, recusou } from './permissoes'
import { registrarConfirmando } from './repos/auditoria'
import { acharCliente } from './repos/clientes'
import { acharSugestao } from './repos/sugestoes'
import { exigirAdminDaPlataforma } from './sessao'

/**
 * "Sentiu falta de algo?": guarda o pedido de melhoria para a 4YU ler em
 * Administração > Sugestões.
 *
 * **Qualquer membro da conta pode mandar**, e é isso que o `'nenhum'` declara:
 * a ideia de quem atende no Inbox vale tanto quanto a do dono, e muitas vezes
 * mais, porque é quem usa a tela o dia inteiro. A fronteira que importa é a da
 * empresa, e `exigirCapacidade` a confere antes de qualquer coisa.
 *
 * Responde `ok` só se a linha foi gravada (`registrarConfirmando`): a tela diz
 * "recebemos", e isso tem que ser verdade.
 */
export async function acaoSugerirMelhoria(
  clienteId: string,
  texto: string,
  caminho: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'nenhum')
  if (recusou(acesso)) return acesso

  const conferida = conferirSugestao(String(texto ?? ''))
  if (!conferida.ok) return { ok: false, erro: conferida.motivo }

  const tela = telaDaSugestao(String(caminho ?? ''))
  const cliente = await acharCliente(clienteId)
  const gravou = await registrarConfirmando({
    acao: ATO_DA_SUGESTAO,
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    contaNome: cliente?.nome ?? '',
    alvoTipo: 'sugestao',
    alvoNome: tela,
    detalhes: { texto: conferida.texto, tela, nome: acesso.sessao.usuario.nome },
  })
  if (!gravou) return { ok: false, erro: 'não foi possível enviar agora. Tente de novo em instantes.' }
  return { ok: true }
}

/**
 * A triagem da 4YU: nova, planejada, feita ou descartada. Só a administração
 * da plataforma marca; o cliente nunca vê esta situação.
 *
 * Grava um ato novo em vez de editar a sugestão (a auditoria é append-only):
 * a situação de agora é a do ato mais novo, e o caminho até ela fica guardado.
 * Sem `revalidatePath`: a tela já mudou na hora (`useAcaoOtimista`).
 */
export async function acaoTriarSugestao(
  sugestaoId: string,
  situacao: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sessao = await exigirAdminDaPlataforma()
  if (!ehSituacaoDaSugestao(situacao)) return { ok: false, erro: 'situação desconhecida' }

  const sugestao = await acharSugestao(String(sugestaoId ?? ''))
  if (!sugestao) return { ok: false, erro: 'esta sugestão não existe mais' }

  const gravou = await registrarConfirmando({
    acao: ATO_DA_TRIAGEM,
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: sugestao.contaId,
    contaNome: sugestao.contaNome,
    alvoTipo: 'sugestao',
    alvoId: sugestao.id,
    alvoNome: ROTULO_DA_SITUACAO[situacao],
    detalhes: { situacao },
    impersonadoPor: sessao.impersonadoPor,
  })
  if (!gravou) return { ok: false, erro: 'não foi possível salvar agora. Tente de novo em instantes.' }
  return { ok: true }
}
