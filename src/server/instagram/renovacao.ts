import 'server-only'
import { alertar } from '../alertar'
import {
  canaisDoInstagramQueVencemAte,
  trocarTokenDoCanal,
} from '../repos/canais-instagram'
import { lerTokenDoCanal, type CanalSalvo } from '../repos/conversas'
import { renovarToken } from './conexao'

/**
 * A renovação automática do token do Instagram.
 *
 * **O problema que ela resolve, e por que ele é silencioso.** O token longo do
 * Instagram vale 60 dias. Ele se renova enquanto está **vivo**; depois de
 * vencido não há renovação nenhuma — é refazer o OAuth, com o dono do perfil
 * na frente da tela. Sem esta rotina, `renovarToken()` existia e ninguém a
 * chamava: a conta respondia normalmente por dois meses e parava no dia 61,
 * sem nenhuma mudança tendo sido feita e sem nada na tela explicando.
 *
 * **Renovar cedo não custa nada e chegar tarde custa tudo**, e é isso que
 * define a folga: a partir de `DIAS_DE_FOLGA` antes do vencimento, toda passada
 * diária tenta de novo. São dez tentativas antes da morte do token — a Meta
 * pode estar fora do ar em um dia, e um dia não pode ser o último.
 *
 * **Uma conta que falha não pode derrubar as outras**, pela mesma razão do
 * executor da fila: são clientes diferentes, e um perfil com problema não pode
 * impedir a renovação do vizinho. Por isso o `try` é por canal.
 *
 * O que sobra para o humano — token já vencido — vira alerta, e alerta hoje é
 * linha em `public.alertas` e cartão em `/admin/alertas`, não webhook opcional.
 */

/** A partir de quantos dias do fim vale a pena começar a tentar. */
export const DIAS_DE_FOLGA = 10

export type ResumoDaRenovacao = {
  /** Quantos canais estavam dentro da folga nesta passada. */
  olhados: number
  renovados: number
  /**
   * Já venceram: não há o que renovar, e só o dono do perfil resolve. Contados
   * à parte das falhas de propósito — não é erro nosso, é trabalho de humano.
   */
  vencidos: number
  falhas: number
}

/**
 * As idas ao mundo, injetáveis — a rotina é testada sem banco e sem a Meta.
 *
 * Mesma escolha do `fabricaDeCanal` do executor de tarefas: o que precisa de
 * teste aqui é a decisão (quem renovar, quem pular, o que fazer quando falha),
 * e teste que depende da rede não prova decisão nenhuma.
 */
export type MundoDaRenovacao = {
  listar: (limite: Date) => Promise<CanalSalvo[]>
  lerToken: (canal: CanalSalvo) => Promise<string>
  renovar: (token: string) => Promise<{ token: string; expiraEm: Date }>
  guardar: (canal: CanalSalvo, novo: { token: string; expiraEm: Date }) => Promise<void>
  avisar: (mensagem: string, erro?: unknown) => Promise<void>
}

const MUNDO: MundoDaRenovacao = {
  listar: canaisDoInstagramQueVencemAte,
  lerToken: lerTokenDoCanal,
  renovar: renovarToken,
  guardar: trocarTokenDoCanal,
  avisar: alertar,
}

export function limiteDaRenovacao(agora: Date, dias: number = DIAS_DE_FOLGA): Date {
  const limite = new Date(agora)
  limite.setUTCDate(limite.getUTCDate() + dias)
  return limite
}

export async function renovarTokensDoInstagram(
  opcoes: { agora?: Date; dias?: number } = {},
  mundo: MundoDaRenovacao = MUNDO,
): Promise<ResumoDaRenovacao> {
  const agora = opcoes.agora ?? new Date()
  const canais = await mundo.listar(limiteDaRenovacao(agora, opcoes.dias ?? DIAS_DE_FOLGA))

  const resumo: ResumoDaRenovacao = {
    olhados: canais.length,
    renovados: 0,
    vencidos: 0,
    falhas: 0,
  }

  for (const canal of canais) {
    // Vencido não se renova: a Meta recusa, e insistir todo dia trocaria um
    // aviso claro por uma falha diária que ninguém sabe interpretar.
    if (canal.tokenExpiraEm && new Date(canal.tokenExpiraEm) <= agora) {
      resumo.vencidos += 1
      await mundo.avisar(
        `o token do Instagram de ${canal.igUsername ?? canal.igUserId ?? canal.clienteId} venceu; só reconectando a conta`,
      )
      continue
    }

    try {
      const token = await mundo.lerToken(canal)
      const novo = await mundo.renovar(token)
      await mundo.guardar(canal, novo)
      resumo.renovados += 1
    } catch (erro) {
      resumo.falhas += 1
      // Falhar hoje é normal — sobram dias de folga e a próxima passada tenta
      // de novo. O alerta existe para o caso de sobrar falha até o fim: sem
      // ele, a conta simplesmente para de responder um dia desses.
      await mundo.avisar(
        `não deu para renovar o token do Instagram de ${canal.igUsername ?? canal.igUserId ?? canal.clienteId}`,
        erro,
      )
    }
  }

  return resumo
}
