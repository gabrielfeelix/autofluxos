import { estadoDaConexao } from './conexoes'

/**
 * O que o bloco "Precisa de você" do Início lista, e em que ordem.
 *
 * **Tudo que pede uma pessoa hoje, num lugar só.** O bloco mostrava só a fila
 * de conversas e dizia "Ninguém esperando" com 67 atividades vencidas na
 * agenda (N04): quem abria o painel lia que o dia estava em ordem justamente
 * no dia em que não estava.
 *
 * A ordem é a do estrago:
 *
 * 1. **Conexão com falha conhecida.** Com o WhatsApp desembarcado, toda
 *    resposta da lista abaixo falha na Meta; resolver isso primeiro é o que
 *    faz o resto andar.
 * 2. **Conversa que pediu uma pessoa.** O bot já disse que não dá conta.
 * 3. **Conversa esperando resposta.**
 * 4. **Atividade vencida**, depois **atividade de hoje.**
 *
 * **Falha é só o que se sabe que quebra**, nunca ausência de tráfego: canal
 * quieto há três dias pode ser só um negócio pequeno numa semana fraca, e
 * chamar isso de falha ensina a ignorar o aviso (regra do H05). A regra de
 * "falha conhecida" é a de `estadoDaConexao` (`core/conexoes.ts`), a mesma das
 * telas de conexão: número desembarcado e token do Instagram vencido.
 *
 * Cada linha é link para a lista **já filtrada** com a mesma regra que contou
 * o número, para quem clica em "12 atividades vencidas" achar 12 do outro lado.
 */

export type TomDaPendencia = 'falha' | 'alerta' | 'normal'

export type Pendencia = {
  chave: string
  texto: string
  /** Relativo à conta: `/atividades?recorte=vencidas`. */
  href: string
  tom: TomDaPendencia
}

export type CanalParaPendencia = {
  provider: string
  displayPhoneNumber: string | null
  igUsername: string | null
  tokenExpiraEm: string | null
  desembarcadoEm: string | null
}

export type EntradaDasPendencias = {
  /** `null` = a pessoa não atende conversa nenhuma; a fila não entra. */
  conversas: { pedindoPessoa: number; esperando: number } | null
  /** `null` = a pessoa não tem agenda; atividades não entram. */
  agenda: { vencidas: number; hoje: number } | null
  /** Com a agenda da equipe à vista, o link abre a equipe, como o menu. */
  agendaDaEquipe: boolean
  /** `null` = a pessoa não configura a conta; conexão não é com ela. */
  canais: CanalParaPendencia[] | null
  agora: number
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

export function pendenciasDoInicio(entrada: EntradaDasPendencias): Pendencia[] {
  const lista: Pendencia[] = []

  for (const canal of entrada.canais ?? []) {
    const falha = falhaDoCanal(canal, entrada.agora)
    if (falha) lista.push(falha)
  }

  const conversas = entrada.conversas
  if (conversas && conversas.pedindoPessoa > 0) {
    lista.push({
      chave: 'pediram-pessoa',
      texto: `${plural(conversas.pedindoPessoa, 'conversa pediu', 'conversas pediram')} uma pessoa`,
      href: '/inbox',
      tom: 'alerta',
    })
  }
  if (conversas && conversas.esperando > 0) {
    lista.push({
      chave: 'esperando',
      texto: `${plural(conversas.esperando, 'conversa esperando', 'conversas esperando')} resposta`,
      href: '/inbox',
      tom: 'normal',
    })
  }

  const agenda = entrada.agenda
  const alcance = entrada.agendaDaEquipe ? '&alcance=equipe' : ''
  if (agenda && agenda.vencidas > 0) {
    lista.push({
      chave: 'vencidas',
      texto: plural(agenda.vencidas, 'atividade vencida', 'atividades vencidas'),
      href: `/atividades?recorte=vencidas${alcance}`,
      tom: 'alerta',
    })
  }
  if (agenda && agenda.hoje > 0) {
    lista.push({
      chave: 'hoje',
      texto: `${plural(agenda.hoje, 'atividade', 'atividades')} para hoje`,
      href: `/atividades?recorte=hoje${alcance}`,
      tom: 'normal',
    })
  }

  return lista
}

function falhaDoCanal(canal: CanalParaPendencia, agora: number): Pendencia | null {
  // O chat do site não tem conexão que caia: não há token nem número.
  if (canal.provider === 'site') return null
  const instagram = canal.provider === 'instagram'
  const estado = estadoDaConexao(
    instagram
      ? {
          tipo: 'instagram',
          conta: { igUsername: canal.igUsername, tokenExpiraEm: canal.tokenExpiraEm },
          ultimoEvento: null,
        }
      : {
          tipo: 'whatsapp',
          numeros: [{ displayPhoneNumber: canal.displayPhoneNumber, desembarcadoEm: canal.desembarcadoEm }],
          ultimoEvento: null,
        },
    new Date(agora),
  )
  if (!estado.falha) return null
  return {
    chave: instagram ? `instagram-${canal.igUsername ?? ''}` : `whatsapp-${canal.displayPhoneNumber ?? ''}`,
    texto: estado.falha.replace(/\.$/, ''),
    href: estado.proximaAcao?.href ?? (instagram ? '/conversas/canais/instagram' : '/conversas/canais/whatsapp'),
    tom: 'falha',
  }
}
