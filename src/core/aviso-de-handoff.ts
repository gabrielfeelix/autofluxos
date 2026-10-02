import { atendimentoAberto, type HorarioDeAtendimento } from './horario'

/**
 * Quem é avisado quando o bot passa uma conversa para uma pessoa.
 *
 * **O elo mais fraco do produto**, nas palavras do `PLANO-SISTEMA` §3.10.1, e
 * ele continua verdade até esta rodada: `NotificacoesDaFila` consulta a cada
 * 30s e avisa **quem está com o painel aberto**. Fora disso o bot transfere,
 * ninguém percebe, e o cliente descobre pelo lead reclamando.
 *
 * Este módulo é só a decisão, puro, sem banco e sem rede. O envio mora em
 * `server/avisar-handoff.ts`. Estão separados porque a decisão é a parte que
 * erra caro e em silêncio: avisar às 3h da manhã é a forma mais rápida de
 * fazer alguém desligar o aviso para sempre, e aí o produto volta a ter o
 * buraco que esta rodada fecha, só que agora sem ninguém saber.
 */

/** Um membro da conta, do ponto de vista de quem decide o aviso. */
export type CandidatoAoAviso = {
  usuarioId: string
  email: string
  nome: string | null
  /** `dono`, `admin`, `atendente`... Ver `repos/usuarios`. */
  papel: string | null
  /** `disponivel` ou `ausente`. `null` = nunca marcou. */
  presenca: string | null
}

/**
 * Os papéis que atendem, que hoje são **todos** os que existem.
 *
 * Os três valores vêm do plugin de organização do Better Auth e são em inglês:
 * `owner`, `admin`, `member` (ver `acoes-conta.ts:403`). Escrevê-los em
 * português aqui teria filtrado a conta inteira: em produção, os quatro
 * membros existentes são `owner`, e nenhum deles receberia aviso nenhum. O
 * defeito passaria nos testes e apareceria como conversa sem resposta.
 *
 * A lista existe mesmo assim, e não um `return true`, porque um papel que
 * não atende (só leitura, faturamento) é o tipo de coisa que nasce depois, e
 * quando nascer o lugar de decidir isto já está escrito.
 *
 * `null` entra pelo mesmo motivo: papel desconhecido avisa. Errar avisando
 * alguém a mais é ruído; errar calando é a conversa que ninguém atendeu.
 */
const PAPEIS_QUE_ATENDEM = new Set(['owner', 'admin', 'member'])

export type DecisaoDoAviso =
  | { avisar: false; motivo: 'fora-do-horario' | 'ninguem-disponivel' | 'conta-sem-membro' }
  | { avisar: true; destinatarios: CandidatoAoAviso[] }

export function quemAvisar(
  candidatos: CandidatoAoAviso[],
  horario: HorarioDeAtendimento,
  agora: Date = new Date(),
): DecisaoDoAviso {
  /*
   * O horário vem primeiro, e é uma decisão sobre a conta inteira.
   *
   * Alguém que esqueceu o navegador aberto marcado como `disponivel` às 3h da
   * manhã não é motivo para o telefone dele tocar: o horário de atendimento é
   * o que a conta declarou sobre quando existe gente para atender, e é mais
   * confiável do que um estado de presença que ninguém lembrou de trocar.
   */
  if (!atendimentoAberto(horario, agora)) return { avisar: false, motivo: 'fora-do-horario' }

  const daEquipe = candidatos.filter((c) => c.papel === null || PAPEIS_QUE_ATENDEM.has(c.papel))
  if (daEquipe.length === 0) return { avisar: false, motivo: 'conta-sem-membro' }

  /*
   * Presença: `ausente` é escolha explícita e vale. `null` **não** é ausência.
   *
   * Quem nunca abriu o seletor de presença tem `null`, que é a maioria das
   * contas hoje. Tratar isso como ausente entregaria a rodada inteira sem
   * avisar ninguém, e o teste passaria: é o tipo de bug que só aparece em
   * produção, como conversa que ninguém atendeu.
   */
  const disponiveis = daEquipe.filter((c) => c.presenca !== 'ausente')
  if (disponiveis.length === 0) return { avisar: false, motivo: 'ninguem-disponivel' }

  return { avisar: true, destinatarios: disponiveis }
}

/**
 * O porquê do handoff em linguagem de quem atende.
 *
 * O motivo gravado é para diagnóstico e pode trazer o erro cru de uma
 * ferramenta ("em \"loja_detalhes\": \"produtoId\" não é um identificador...").
 * Isso não serve a quem recebe o aviso: ele quer saber o que fazer, não qual
 * parâmetro falhou. Os motivos que o sistema escreve viram uma frase curta; o
 * que o cliente escreveu no bloco de handoff ("Lead qualificado - pilates")
 * passa como está, porque é a palavra dele.
 *
 * O motivo completo continua no banco e na dica do Inbox, para quem investiga.
 */
export function resumoDoMotivo(motivo: string): string {
  const m = motivo.trim()
  if (!m) return 'O bot passou a conversa para a equipe'
  if (/^a IA não soube responder/i.test(m)) return 'A IA não encontrou a resposta e passou para a equipe'
  if (/respostas de IA/i.test(m)) return 'A IA chegou ao limite de respostas e passou para a equipe'
  if (/não há modelo disponível/i.test(m)) return 'A IA está indisponível e passou para a equipe'
  if (/^a (integração|consulta)\b|chamadas externas/i.test(m)) {
    return 'Uma consulta automática falhou e o bot passou para a equipe'
  }
  if (/ciclo no desenho|automação de destino/i.test(m)) {
    return 'A automação não conseguiu continuar e passou para a equipe'
  }
  if (/prazo da pergunta/i.test(m)) return 'O contato não respondeu a pergunta do bot a tempo'
  return m.charAt(0).toUpperCase() + m.slice(1)
}

const NOME_DO_CANAL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  telegram: 'Telegram',
  site: 'Chat do site',
}

const LIMITE_DA_MENSAGEM = 90

/**
 * O texto do aviso.
 *
 * Lido numa tira de notificação de celular, onde o sistema corta o resto, e
 * por alguém que pode estar em mais de uma conta. Então, nesta ordem:
 *
 * - **Título:** quem espera. O nome, ou o telefone quando não há nome. É o que
 *   decide se a pessoa larga o que está fazendo.
 * - **Primeira linha:** em qual conta e por qual canal. Sem isso, quem atende
 *   duas empresas não sabe de qual é o aviso.
 * - **Segunda linha:** o porquê, em frase de gente (`resumoDoMotivo`).
 * - **Terceira linha:** o que o contato escreveu por último, cortado.
 *
 * **A última mensagem pode ir no aviso.** A carga do Web Push é cifrada de
 * ponta a ponta (RFC 8291): o servidor de push do fabricante entrega sem
 * conseguir ler. É o mesmo que o WhatsApp mostra na notificação dele.
 */
export function textoDoAviso(dados: {
  nome: string | null
  /** Telefone já legível, para quando não há nome. */
  telefone?: string | null
  conta?: string | null
  canal?: string | null
  motivo: string
  ultimaMensagem?: string | null
}) {
  const nome = (dados.nome ?? '').trim()
  const telefone = (dados.telefone ?? '').trim()
  const quem = nome || (telefone ? telefone.charAt(0).toUpperCase() + telefone.slice(1) : '') || 'Um contato'

  const onde = [dados.conta?.trim(), dados.canal ? (NOME_DO_CANAL[dados.canal] ?? dados.canal) : null]
    .filter(Boolean)
    .join(' · ')

  const ultima = (dados.ultimaMensagem ?? '').replace(/\s+/g, ' ').trim()
  const citacao = ultima
    ? `“${ultima.length > LIMITE_DA_MENSAGEM ? `${ultima.slice(0, LIMITE_DA_MENSAGEM - 1).trimEnd()}…` : ultima}”`
    : ''

  return {
    titulo: `${quem} está esperando atendimento`,
    corpo: [onde, resumoDoMotivo(dados.motivo), citacao].filter(Boolean).join('\n'),
  }
}
