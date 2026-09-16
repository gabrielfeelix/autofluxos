import 'server-only'
import { escolherAtendente, type Candidato } from '@/core/rodizio'
import { atribuirContato } from './repos/conversas'
import { ajustesDaConta, atendentesDaConta } from './repos/distribuicao'
import { contarAbertasPorAtendente, donoDoContato } from './repos/leads'
import { membrosDaConta } from './repos/usuarios'

/**
 * Dá dono à conversa que acabou de pedir uma pessoa.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui, e não quando a mensagem chega
 * ---------------------------------------------------------------------------
 *
 * O gancho fica onde o handoff é registrado. Conversa que o fluxo está
 * atendendo sozinho não precisa de dono, e distribuir a cada entrada encheria a
 * fila de todo mundo com conversas que ninguém vai abrir. O momento em que
 * alguém passa a esperar uma pessoa é o momento em que faz sentido dizer qual
 * pessoa é.
 *
 * ---------------------------------------------------------------------------
 * A carteira ganha do rodízio, e por isso a primeira pergunta é "já tem dono?"
 * ---------------------------------------------------------------------------
 *
 * Quem já foi atendido por alguém volta para essa pessoa, mesmo que a conversa
 * anterior tenha sido resolvida meses atrás. Sem isso, o cliente é atendido por
 * um estranho a cada contato, e o vendedor perde a relação que construiu.
 *
 * Não custou tabela nenhuma: `atribuido_a` mora no contato e não na sessão, e
 * "quem tem dono não entra na distribuição" é a carteira inteira em uma linha.
 *
 * ---------------------------------------------------------------------------
 * Nunca derruba o webhook
 * ---------------------------------------------------------------------------
 *
 * Quem chama está no meio de receber uma mensagem do WhatsApp. Toda falha aqui
 * é engolida com log: a conversa fica sem dono, que é o estado de hoje e o que
 * a fila "Sem dono" existe para cobrir. Perder a distribuição é um incômodo;
 * perder a mensagem é perder o cliente.
 */
export async function distribuirSeSemDono(
  clienteId: string,
  contatoId: string,
): Promise<string | null> {
  try {
    const ajustes = await ajustesDaConta(clienteId)
    if (ajustes.distribuicao !== 'balanceado') return null

    const dono = await donoDoContato(clienteId, contatoId)
    // `undefined` = o contato não é desta conta. `string` = a carteira decide.
    if (dono !== null) return null

    const [equipe, configurados, abertas] = await Promise.all([
      membrosDaConta(clienteId),
      atendentesDaConta(clienteId),
      contarAbertasPorAtendente(clienteId),
    ])

    const candidatos: Candidato[] = equipe.map((membro) => {
      const ajuste = configurados.get(membro.id)
      return {
        usuarioId: membro.id,
        papel: membro.papel,
        presenca: membro.presenca,
        abertas: abertas.get(membro.id) ?? 0,
        entraNoRodizio: ajuste?.entraNoRodizio ?? null,
        tetoSimultaneo: ajuste?.tetoSimultaneo ?? null,
      }
    })

    const escolhido = escolherAtendente(candidatos)
    /*
     * Ninguém apto é resposta comum e legítima: equipe inteira ausente de
     * madrugada, todo mundo no teto numa terça de campanha. A conversa fica sem
     * dono e aparece no rail "Sem dono", que é a rede de segurança que já
     * existia antes de qualquer distribuição.
     */
    if (!escolhido) return null

    const deu = await atribuirContato(clienteId, contatoId, escolhido)
    return deu ? escolhido : null
  } catch (erro) {
    console.error(
      '[distribuicao] não deu para distribuir a conversa',
      erro instanceof Error ? erro.message : erro,
    )
    return null
  }
}

/**
 * Esta pessoa pode responder esta conversa agora?
 *
 * ---------------------------------------------------------------------------
 * Ver e responder são coisas diferentes
 * ---------------------------------------------------------------------------
 *
 * Todo mundo continua **vendo** tudo: quem cobre férias precisa ler o
 * histórico, e esconder conversa de colega cria o problema que a pessoa resolve
 * pedindo o celular do outro. O que esta função controla é só o responder, que
 * é onde dois vendedores digitando ao mesmo tempo viram uma conversa
 * constrangedora com o cliente.
 *
 * ---------------------------------------------------------------------------
 * As três portas que continuam abertas, e por que cada uma
 * ---------------------------------------------------------------------------
 *
 * - **Conta com a trava desligada** (o padrão): nada muda. Ligar sozinho
 *   mudaria o comportamento de quem já usa o produto hoje.
 * - **Sessão sem usuário** (a senha única do painel): não há de quem dizer que
 *   é. Bloquear aqui deixaria a conta sem conseguir responder nada.
 * - **Conversa sem dono**: responder **é** assumir, e a atribuição acontece
 *   junto. Obrigar a clicar em assumir antes de escrever seria um passo a mais
 *   para chegar ao mesmo lugar.
 */
export async function podeResponderAgora(
  clienteId: string,
  contatoId: string,
  usuarioId: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const ajustes = await ajustesDaConta(clienteId)
    if (!ajustes.exigeAssumir) return { ok: true }
    if (!usuarioId) return { ok: true }

    const dono = await donoDoContato(clienteId, contatoId)
    if (dono === undefined) return { ok: true }

    if (dono === null) {
      // Responder assume. Falhar a atribuição não impede a resposta: a mensagem
      // é o que a pessoa do outro lado está esperando, e o dono a tela conserta.
      await atribuirContato(clienteId, contatoId, usuarioId)
      return { ok: true }
    }

    if (dono === usuarioId) return { ok: true }

    const equipe = await membrosDaConta(clienteId)
    const nome = equipe.find((membro) => membro.id === dono)?.nome.split(' ')[0]

    return {
      ok: false,
      erro: nome
        ? `esta conversa é de ${nome}. Clique em assumir antes de responder.`
        : 'esta conversa já tem outro dono. Clique em assumir antes de responder.',
    }
  } catch (erro) {
    /*
     * Falha de leitura **libera**, e não bloqueia.
     *
     * Uma trava que fecha quando o banco tosse impede a equipe de trabalhar por
     * um motivo que ninguém consegue ver na tela. O custo do erro para o outro
     * lado é uma resposta duplicada; o custo de errar fechado é a conta parada.
     */
    console.error(
      '[distribuicao] não deu para conferir o dono da conversa',
      erro instanceof Error ? erro.message : erro,
    )
    return { ok: true }
  }
}
