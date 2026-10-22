import 'server-only'
import { modeloDoEvento, valoresDoModelo } from '@/core/eventos-da-verandi'
import { adaptadorDoCanal } from './adaptador-do-canal'
import type { FabricaDeCanal } from './receber-mensagem'
import { acharContato, confirmarEntrega, contextoDeResposta, registrarSaida } from './repos/conversas'
import { listarTemplatesAprovados } from './repos/templates'

/**
 * O aviso da Verandi fora das 24 horas, pelo modelo aprovado do evento
 * (`verandi_aula_cancelada` e os outros de `MODELOS_DA_VERANDI`). É o mesmo
 * caminho do `lembrete_de_cobranca` em `mandar-cobranca.ts`.
 *
 * `sem_modelo` quando o evento não tem modelo, a conta não criou ou a Meta não
 * aprovou, o aviso veio sem dia ou hora, o canal não manda modelo, ou o bot
 * está pausado para a pessoa: quem chama segue com a nota na ficha.
 */
export async function mandarAvisoPorModelo(
  clienteId: string,
  contatoId: string,
  evento: string,
  variaveis: Record<string, string>,
  fabricaDeCanal?: FabricaDeCanal,
): Promise<'ok' | 'sem_modelo' | 'erro'> {
  const modelo = modeloDoEvento(evento)
  const valores = valoresDoModelo(variaveis)
  if (!modelo || !valores) return 'sem_modelo'
  const aprovado = (await listarTemplatesAprovados(clienteId)).find((t) => t.nome === modelo.nome)
  if (!aprovado) return 'sem_modelo'

  // Bot pausado vale para modelo também: quem pausou pediu silêncio.
  const [contexto, contato] = await Promise.all([contextoDeResposta(clienteId, contatoId), acharContato(contatoId)])
  if (!contexto || !contato?.automacaoAtiva) return 'sem_modelo'
  const canal = fabricaDeCanal ? fabricaDeCanal(contexto.canal) : await adaptadorDoCanal(contexto.canal)
  if (!canal.enviarTemplate) return 'sem_modelo'

  const texto = valores.reduce((t, v, i) => t.replace(`{{${i + 1}}}`, v), modelo.corpo)
  const saida = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto,
    payload: { evento, modelo: aprovado.nome },
    autor: null,
  })
  try {
    const envio = await canal.enviarTemplate(contexto.waId, {
      nome: aprovado.nome,
      idioma: aprovado.idioma,
      valores: { corpo: valores },
    })
    if (envio.situacao === 'falhou') return 'erro'
    await confirmarEntrega(saida, envio.wamid)
    return 'ok'
  } catch (erro) {
    console.error('[verandi] o aviso por modelo não saiu', erro)
    return 'erro'
  }
}
