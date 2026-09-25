'use server'

import { type ConfigDoSite, lerConfigDoSite, lerListaDeDominios } from '@/core/chat-do-site'
import { exigirCapacidade, recusou } from './permissoes'
import { ligarChatDoSite, pausarChatDoSite, salvarConfigDoSite } from './repos/canais-site'

/**
 * As ações da tela do chat do site. Todas devolvem o resultado em vez de
 * recarregar a página: a tela já mudou na hora, e só volta atrás se o servidor
 * recusar.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string }

export async function acaoLigarChatDoSite(clienteId: string): Promise<Resultado<{ chave: string }>> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso
  const canal = await ligarChatDoSite(clienteId)
  return { ok: true, chave: canal.chave }
}

export async function acaoPausarChatDoSite(clienteId: string): Promise<Resultado> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso
  await pausarChatDoSite(clienteId)
  return { ok: true }
}

export async function acaoSalvarChatDoSite(
  clienteId: string,
  dados: { dominios: string; cor: string; titulo: string; saudacao: string; pedirContato: boolean },
): Promise<Resultado<{ config: ConfigDoSite; recusados: string[] }>> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const { validos, recusados } = lerListaDeDominios(dados.dominios)
  // Passa pelo mesmo leitor do banco: cor inválida, título vazio e texto longo
  // caem no padrão ou no teto aqui, e não num segundo conjunto de regras.
  const config = lerConfigDoSite({ ...dados, dominios: validos })
  await salvarConfigDoSite(clienteId, config)
  return { ok: true, config, recusados }
}
