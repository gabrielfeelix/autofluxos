import 'server-only'
import { comoFalta, restaDaJanela } from '@/channels/janela'
import type { AnuncioEmCache, Passagem } from '@/core/anuncios'
import type { Anotacao } from '@/core/anotacoes'
import { canalPeloContato, type CanalId } from '@/core/canais'
import { estadoDoAtendimento, type Atendimento } from '@/core/estado-do-atendimento'
import type { FunilDoContato } from '@/components/inbox/funil-da-conversa'
import { anotacoesDoContato } from './repos/eventos'
import { canaisDosContatos } from './repos/canais-site'
import { contextoDeResposta, sessaoComPessoa } from './repos/conversas'
import { ajustesDaConta } from './repos/distribuicao'
import { lerConversa, type Lead, type MensagemDoLead } from './repos/leads'
import { lojaDaConta } from './repos/lojas'
import { favoritasEntre } from './repos/marcadores'
import { agendadasDoContato, type MensagemAgendada } from './repos/mensagens-agendadas'
import { passagensDoContato } from './repos/passagens'
import { listarQuadros, quadrosDoContato } from './repos/quadros'
import { resolverAnuncios } from './resolver-anuncios'
import { tokenDeAnuncios } from './token-de-anuncios'

/**
 * Tudo o que a coluna da conversa aberta precisa, em JSON puro.
 *
 * ---------------------------------------------------------------------------
 * Por que isto saiu da página
 * ---------------------------------------------------------------------------
 *
 * Trocar de conversa era navegar: o Inbox inteiro de novo no servidor, a fila,
 * as contagens, as fixadas, as não lidas, perto de vinte consultas, para mudar
 * só a coluna do meio. É o que fazia o clique parecer lento por melhor que o
 * resto estivesse. O WhatsApp Web não refaz a lista para abrir uma conversa, e
 * agora nós também não: a página desenha a primeira, e as próximas vêm daqui
 * pela rota `inbox/aberta`, guardadas no navegador (`aberta-local.ts`).
 *
 * Por isso nada de `Map`, `Set` ou `Date`: o mesmo objeto viaja como prop de
 * Server Component e como corpo de `Response.json`.
 */
export type ConversaAberta = {
  lead: Lead
  canal: CanalId
  mensagens: MensagemDoLead[]
  cortada: boolean
  comPessoa: boolean
  atendimento: Atendimento
  /** Quanto falta da janela de 24h, já escrito (`22h18`). `null` = fora dela. */
  janela: string | null
  /** Menos de duas horas, a contagem muda de cor. */
  janelaApertada: boolean
  /** O instante em que a janela fecha, para o agendamento comparar. */
  fimDaJanela: string | null
  funis: FunilDoContato[]
  agendadas: MensagemAgendada[]
  anotacoes: Anotacao[]
  /** Os ids que **eu** guardei, para a estrela nascer cheia. Ver a 0063. */
  favoritas: string[]
  exigeAssumir: boolean
  temPedidos: boolean
  passagens: Passagem[]
  nomesDosAnuncios: [string, AnuncioEmCache][]
  /** Quando o servidor leu, para o navegador saber qual cópia é a mais nova. */
  lidaEm: number
}

/**
 * Lê a conversa aberta.
 *
 * `lead` já vem conferido por quem chama (`paginarLeads`, `acharLead`, ambos
 * com o cliente e o alcance): só depois desse vínculo cliente–contato é seguro
 * ler as mensagens pelo id do contato.
 */
export async function lerConversaAberta({
  clienteId,
  lead,
  usuarioId,
  temAutomacao,
  canal,
}: {
  clienteId: string
  lead: Lead
  usuarioId: string | null
  temAutomacao: boolean
  /** Quem já sabe o canal (a página) passa; a rota pergunta. */
  canal?: CanalId
}): Promise<ConversaAberta> {
  /*
   * Tudo que não depende de outra resposta vai junto. A trava de assumir, a
   * loja e as passagens eram três idas em série depois desta, numa coluna que
   * se abre a cada clique.
   */
  const [
    conversa,
    contexto,
    posicoes,
    quadros,
    agendadas,
    anotacoes,
    comPessoa,
    ajustes,
    loja,
    historico,
    canalLido,
  ] = await Promise.all([
    lerConversa(lead.contatoId),
    contextoDeResposta(clienteId, lead.contatoId),
    /*
     * Onde este contato está no funil, e as etapas de cada quadro para o menu
     * de mover. As duas juntas porque uma sem a outra não desenha nada.
     */
    quadrosDoContato(clienteId, lead.contatoId),
    listarQuadros(clienteId),
    // O que já está marcado para esta conversa: a barra de ações mostra o
    // ícone aceso, e o painel lista com o botão de cancelar.
    agendadasDoContato(clienteId, lead.contatoId),
    anotacoesDoContato(clienteId, lead.contatoId),
    // A terceira fonte do estado do atendimento (8.1): a sessão com uma pessoa.
    sessaoComPessoa(lead.contatoId),
    /*
     * A trava de "só quem assumiu responde", se a conta a ligou. A recusa
     * também existe no servidor (`podeResponderAgora`): a de lá impede o
     * envio, esta impede a pessoa de escrever três parágrafos antes de
     * descobrir que não podia.
     */
    ajustesDaConta(clienteId),
    // O botão de status do pedido só existe onde há loja on-line para consultar.
    lojaDaConta(clienteId).catch(() => null),
    historicoDoContato(clienteId, lead.contatoId),
    canal
      ? Promise.resolve(canal)
      : canaisDosContatos(clienteId).then((mapa) => canalPeloContato(lead.waId, mapa.get(lead.contatoId))),
  ])

  /*
   * Quais destas bolhas **eu** guardei. Depois do resto porque a pergunta é
   * sobre os ids que a conversa devolveu.
   */
  const favoritas = await favoritasEntre(
    usuarioId,
    conversa.mensagens.map((mensagem) => mensagem.id),
  )

  const atendimento = estadoDoAtendimento({
    automacaoAtiva: lead.automacaoAtiva,
    aguardando: lead.aguardando,
    atribuidoA: lead.atribuidoA,
    sessaoComPessoa: comPessoa,
    estado: lead.estadoEfetivo,
    temAutomacao,
    usuarioId,
  })

  /*
   * Junta a posição do contato com as etapas do quadro dela. Quadro que sumiu
   * entre uma consulta e outra é descartado em vez de virar um menu vazio.
   */
  const funis: FunilDoContato[] = posicoes.flatMap((posicao) => {
    const quadro = quadros.find((q) => q.id === posicao.quadroId)
    if (!quadro) return []
    return [{ ...posicao, etapas: quadro.etapas.map((e) => ({ id: e.id, nome: e.nome })) }]
  })

  // Uma leitura do relógio para as contas abaixo: duas dariam dois instantes,
  // e o fim da janela ficaria fora do que a pílula diz que falta.
  const agora = Date.now()
  const restante = restaDaJanela(contexto ?? { ultimaEntradaEm: null }, agora)
  // Chat do site: sem janela. O texto só diz ao compositor que está livre.
  const semJanela = contexto?.semJanela ?? false
  const janela = semJanela ? 'sem prazo' : restante && restante > 0 ? comoFalta(restante) : null
  /*
   * Abaixo de duas horas a contagem muda de cor: "22h18" e "1h04" são a mesma
   * frase e significam coisas opostas, e quem olha de relance lê a cor.
   */
  const janelaApertada = restante !== null && restante > 0 && restante < 2 * 60 * 60 * 1000
  /*
   * O instante em que a janela fecha, e não quanto falta: o agendamento compara
   * com o horário escolhido. As 72h do anúncio **não** entram aqui, elas são
   * gratuidade, não autorização de texto livre (ver `channels/janela`).
   */
  const fimDaJanela = semJanela
    ? new Date(agora + 365 * 24 * 60 * 60 * 1000).toISOString()
    : restante !== null && restante > 0
      ? new Date(agora + restante).toISOString()
      : null

  return {
    lead,
    canal: canalLido,
    mensagens: conversa.mensagens,
    cortada: conversa.cortada,
    comPessoa,
    atendimento,
    janela,
    janelaApertada,
    fimDaJanela,
    funis,
    agendadas,
    anotacoes,
    favoritas: [...favoritas],
    exigeAssumir: ajustes.exigeAssumir,
    temPedidos: Boolean(loja?.ativa && loja.conexaoId),
    passagens: historico.passagens,
    nomesDosAnuncios: [...historico.nomesDosAnuncios],
    lidaEm: agora,
  }
}

/**
 * O histórico de chegadas do contato aberto, com o nome de cada anúncio.
 *
 * Três saídas sem rede, na ordem em que cortam mais: contato que nunca chegou
 * por anúncio, e conta que não conectou o Ads, que é a esmagadora maioria. Só o
 * que sobra chega em `resolverAnuncios`, e mesmo ali o cache costuma responder
 * sem falar com a Meta. **Um id, e não a fila inteira**: a origem aparece na
 * coluna do contato, que mostra uma pessoa por vez.
 *
 * Sem token, as passagens voltam mesmo assim: cada uma tem o título que a
 * pessoa leu no dia. Conectar o Ads melhora o rótulo; não conectar não esconde
 * o histórico.
 */
async function historicoDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{ passagens: Passagem[]; nomesDosAnuncios: Map<string, AnuncioEmCache> }> {
  const passagens = await passagensDoContato(contatoId)
  if (passagens.length === 0) return { passagens: [], nomesDosAnuncios: new Map() }

  const token = await tokenDeAnuncios(clienteId)
  if (!token) return { passagens, nomesDosAnuncios: new Map() }

  const nomesDosAnuncios = await resolverAnuncios({
    clienteId,
    adIds: passagens.map((p) => p.adId),
    token,
  })
  return { passagens, nomesDosAnuncios }
}
