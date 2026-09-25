import { after } from 'next/server'
import { z } from 'zod'
import { espiando } from '@/server/espiar'
import { acharLead, lerConversa } from '@/server/repos/leads'
import { marcarComoLida, quandoLeu } from '@/server/repos/leituras'
import { avisarQueLeu } from '@/server/recibo-de-leitura'
import { alcanceDeConversas, exigirCapacidade, recusou } from '@/server/permissoes'
import { sessaoAtual } from '@/server/sessao'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  clienteId: z.string().uuid(),
  contatoId: z.string().uuid(),
})

/**
 * As mensagens que chegaram na conversa aberta, e só elas.
 *
 * ---------------------------------------------------------------------------
 * Por que esta rota existe
 * ---------------------------------------------------------------------------
 *
 * O Inbox já sabia que tinha chegado mensagem: o `/inbox/stream` avisa em um
 * segundo. O que ele fazia com o aviso é que estava errado, `router.refresh()`,
 * ou seja, **a página inteira desenhada de novo no servidor** a cada mensagem
 * recebida ou enviada. Numa conversa viva, com as duas pontas escrevendo, isso
 * é a tela piscando o tempo todo, e era o que se via: parecia F5 automático.
 *
 * Nenhum aplicativo de conversa faz isso. O WhatsApp não redesenha a lista de
 * conversas, o cabeçalho e o histórico para mostrar uma bolha nova: ele
 * **acrescenta a bolha**. É o que esta rota permite, ela devolve as mensagens
 * mais novas que um carimbo, em JSON, e a transcrição as empilha no fim.
 *
 * ---------------------------------------------------------------------------
 * Lê a conversa inteira para devolver o pedaço
 * ---------------------------------------------------------------------------
 *
 * Parece desperdício e não é: `cita` é resolvida contra o conjunto visível
 * (`lerConversa`), então uma resposta que cita uma mensagem de ontem só sabe
 * quem citou se ontem estiver em mãos. Filtrar depois de ler custa uma consulta
 * indexada por contato; a alternativa, uma janela curta, entregaria citação sem
 * a frase citada, que é justamente o que a bolha precisa mostrar.
 *
 * Mesmo assim é uma fração do que era: a página do Inbox faz dezenas de idas ao
 * banco (fila, contagens, etiquetas, funis, agendadas, equipe), e todas elas
 * rodavam a cada mensagem.
 *
 * ---------------------------------------------------------------------------
 * A marca de lida vem junto, senão ela se perde
 * ---------------------------------------------------------------------------
 *
 * Quem marcava a conversa como lida era o desenho da página. Sem o refresh, a
 * mensagem que chega com a conversa **aberta na frente da pessoa** ficaria
 * contando como não lida, e o tique azul nunca sairia. Então quando há entrada
 * nova esta rota faz o mesmo que a página fazia, na mesma ordem: lê o relógio
 * antes de empurrá-lo, e manda o recibo pelo `after`, fora do caminho da
 * resposta.
 */
export async function GET(
  req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/inbox/conversa/[contatoId]'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'conversa inválida' }, { status: 400 })

  const { clienteId, contatoId } = params.data

  // 404 e não 403, como nas rotas vizinhas: confirmar que a conta existe já é
  // contar de um cliente para quem não é dele.
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  // O contato precisa ser **desta** conta. A URL é adivinhável, e sem esta
  // conferência o uuid de um contato de outro cliente devolveria a conversa
  // dele para quem só tem acesso a esta.
  // E precisa estar no alcance de quem pede: atendente não lê a conversa de
  // outro atendente pelo endereço, mesmo sabendo o uuid.
  const lead = await acharLead(clienteId, contatoId, await alcanceDeConversas(clienteId, acesso))
  if (!lead) return Response.json({ erro: 'não encontrado' }, { status: 404 })

  const desde = new URL(req.url).searchParams.get('desde')
  const corte = desde ? Date.parse(desde) : Number.NaN

  const conversa = await lerConversa(contatoId)
  /*
   * Comparação por instante, e não por texto.
   *
   * Os dois carimbos saem do Postgres no mesmo formato hoje, e comparar string
   * funcionaria hoje. Bastaria um deles voltar com outro deslocamento de fuso
   * para a ordem alfabética discordar da ordem do tempo, e o sintoma seria a
   * mensagem que nunca aparece.
   */
  const novas = Number.isNaN(corte)
    ? conversa.mensagens
    : conversa.mensagens.filter((mensagem) => Date.parse(mensagem.ts) > corte)

  // Espiando, nada vira lido e o cliente não recebe o visto (`server/espiar.ts`).
  if (novas.some((mensagem) => mensagem.direcao === 'entrada') && !(await espiando(clienteId))) {
    const sessao = await sessaoAtual()
    const usuarioId = sessao?.usuario.id ?? null

    // A ordem é a da página: ler quando leu **antes** de empurrar o relógio,
    // senão "chegou algo desde a última olhada?" dá sempre não e o tique azul
    // nunca sai.
    const leuAntesEm = await quandoLeu(usuarioId, contatoId)
    after(() => marcarComoLida(usuarioId, contatoId))
    if (usuarioId) after(() => avisarQueLeu(clienteId, contatoId, leuAntesEm))
  }

  return Response.json(
    { novas, cortada: conversa.cortada },
    {
      headers: {
        // Conversa em cache é conversa parada, o mesmo defeito que a rota do
        // pulso já precisava afastar.
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  )
}
