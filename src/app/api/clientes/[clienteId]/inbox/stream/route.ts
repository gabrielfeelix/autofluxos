import { z } from 'zod'
import { pulsoDaConta } from '@/server/repos/leads'
import { conferirAcessoAoCliente } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * A conexão fica aberta quase até o teto da função. O cliente reconecta
 * sozinho — é o comportamento nativo do `EventSource`, não código nosso.
 */
export const maxDuration = 60

const paramsSchema = z.object({ clienteId: z.string().uuid() })

/**
 * De quanto em quanto tempo o **servidor** olha o banco.
 *
 * O navegador não pergunta nada: quem pergunta é esta função, e ela pergunta um
 * `select` de uma linha só. Era 5 segundos do lado do navegador; agora é 1 do
 * lado de cá, e quem atende vê a mensagem chegar praticamente junto.
 */
const INTERVALO_MS = 1_000

/**
 * Quando encerrar de propósito, para reconectar limpo.
 *
 * Abaixo do `maxDuration` com folga: ser morto pelo teto da plataforma no meio
 * de um `write` é a diferença entre "reconectou" e "a tela travou". 50s deixa
 * 10 para a saída acontecer com calma.
 */
const DURACAO_MS = 50_000

/** Comentário SSE só para a conexão não ser considerada morta no caminho. */
const BATIDA_MS = 15_000

/**
 * O Inbox em tempo real.
 *
 * ---------------------------------------------------------------------------
 * Por que SSE, e não WebSocket direto no Supabase Realtime
 * ---------------------------------------------------------------------------
 *
 * A pergunta certa foi feita: se o banco é Supabase, por que não abrir um
 * WebSocket do navegador até ele? Três coisas fecham esse caminho, e nenhuma é
 * preferência.
 *
 * 1. **A chave que assina o JWT do projeto é ES256, e a metade privada dela
 *    fica dentro do Supabase.** Canal privado do Realtime exige um token que o
 *    servidor deles aceite, e nós não temos como emitir um. O produto autentica
 *    com Better Auth, não com Supabase Auth, então não existe sessão do
 *    Supabase no navegador para aproveitar. Fazer funcionar exigiria rotacionar
 *    a chave de assinatura do projeto para HS256 — mudança **global**, num
 *    projeto de produção compartilhado com a Verandi e sem backup. Ver
 *    docs/BANCO-COMPARTILHADO.md §4.
 * 2. **Canal público resolveria a autenticação e criaria um vazamento.** Quem
 *    soubesse o uuid de um cliente — que anda na URL do painel — passaria a
 *    saber *quando* aquele negócio recebe mensagem. É pouco, e é de graça para
 *    quem quiser.
 * 3. **`.env.example` diz, em letras, que nada neste produto fala com o
 *    Supabase pelo navegador.** Abrir essa porta significa a chave publicável no
 *    bundle e política de RLS num schema global. É uma decisão de arquitetura,
 *    não um detalhe de implementação, e ela não se paga por 4 segundos.
 *
 * O SSE mantém tudo isso de pé: o navegador continua falando só com a gente, a
 * chave secreta continua só no servidor, e nenhuma linha de configuração global
 * do Supabase muda.
 *
 * ---------------------------------------------------------------------------
 * O que viaja: uma data, e nada mais
 * ---------------------------------------------------------------------------
 *
 * Mesma postura da rota `/pulso`, que esta aqui substitui no caminho feliz e
 * **não aposenta**: telefone, texto e nome não passam por aqui. Só o carimbo da
 * mensagem mais recente da conta. Quem recebe compara com o que tem na tela e
 * chama `router.refresh()` se estiver velha. Perguntar é barato; recarregar é
 * que custa, e só acontece quando há motivo.
 */
export async function GET(
  req: Request,
  contexto: RouteContext<'/api/clientes/[clienteId]/inbox/stream'>,
) {
  const params = paramsSchema.safeParse(await contexto.params)
  if (!params.success) return Response.json({ erro: 'cliente inválido' }, { status: 400 })

  // 404 e não 403, como nas rotas vizinhas: confirmar que a conta existe já é
  // contar de um cliente para quem não é dele.
  if (!(await conferirAcessoAoCliente(params.data.clienteId))) {
    return Response.json({ erro: 'não encontrado' }, { status: 404 })
  }

  const clienteId = params.data.clienteId
  const codificador = new TextEncoder()

  const fluxo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      let vivo = true
      let ultimoEnviado: string | null | undefined

      const encerrar = () => {
        if (!vivo) return
        vivo = false
        clearInterval(relogio)
        clearInterval(batida)
        clearTimeout(prazo)
        try {
          controlador.close()
        } catch {
          // Já fechado pelo outro lado. Fechar duas vezes estoura, e não há
          // nada a fazer com esse estouro.
        }
      }

      const mandar = (texto: string) => {
        if (!vivo) return
        try {
          controlador.enqueue(codificador.encode(texto))
        } catch {
          // O navegador foi embora entre o `if` e o `enqueue`. Não é erro: é o
          // caso normal de alguém fechar a aba.
          encerrar()
        }
      }

      /*
       * O primeiro evento sai antes de qualquer espera.
       *
       * Entre o servidor desenhar a página e o navegador abrir esta conexão já
       * passou tempo — e é justamente aí que chega a mensagem que a pessoa está
       * esperando. Sem isto, o primeiro sinal só viria depois do intervalo.
       */
      async function conferir() {
        if (!vivo) return
        try {
          const pulso = await pulsoDaConta(clienteId)
          if (pulso === ultimoEnviado) return
          ultimoEnviado = pulso
          mandar(`data: ${JSON.stringify({ pulso })}\n\n`)
        } catch {
          /*
           * Uma oscilação no banco não pode derrubar a conexão: derrubar
           * obrigaria o navegador a reconectar, refazer a autorização e
           * recomeçar — muito barulho para um `select` que falhou uma vez. Na
           * próxima volta ele tenta de novo.
           */
        }
      }

      const relogio = setInterval(() => void conferir(), INTERVALO_MS)
      // Comentário SSE: linha que começa com `:` é ignorada pelo `EventSource`
      // e serve só para provar a proxies e balanceadores que a conexão vive.
      const batida = setInterval(() => mandar(': batida\n\n'), BATIDA_MS)
      const prazo = setTimeout(encerrar, DURACAO_MS)

      req.signal.addEventListener('abort', encerrar)

      // `retry` diz ao navegador quanto esperar antes de reconectar. O padrão
      // dele é 3s, e depois do encerramento programado a reconexão precisa ser
      // rápida — senão a cada 50 segundos existiria uma janela cega.
      mandar('retry: 1000\n\n')
      await conferir()
    },
  })

  return new Response(fluxo, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      // Um stream em cache é um Inbox que não atualiza — o mesmo defeito que a
      // rota `/pulso` já precisava afastar.
      'cache-control': 'private, no-store, no-transform',
      connection: 'keep-alive',
      // Alguns proxies só param de bufferizar com isto, e um SSE bufferizado
      // entrega tudo junto no fim: o pior dos dois mundos.
      'x-accel-buffering': 'no',
    },
  })
}
