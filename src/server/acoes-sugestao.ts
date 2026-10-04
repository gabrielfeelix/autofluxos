'use server'

import { ATO_DA_SUGESTAO, conferirSugestao, telaDaSugestao } from '@/core/sugestoes'
import { exigirCapacidade, recusou } from './permissoes'
import { registrarConfirmando } from './repos/auditoria'
import { acharCliente } from './repos/clientes'

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
  if (!gravou) return { ok: false, erro: 'não deu para enviar agora. Tente de novo em instantes.' }
  return { ok: true }
}
