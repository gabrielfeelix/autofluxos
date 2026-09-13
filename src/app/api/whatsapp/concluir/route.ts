import { after } from 'next/server'
import { alertar } from '@/server/alertar'
import { salvarNumeroDoOnboarding } from '@/server/repos/coexistencia'
import { conferirAcessoAoCliente } from '@/server/sessao'
import { numerosDaWaba, trocarCodigoPorToken, wabasDoToken } from '@/server/whatsapp/conexao'
import { terminarOnboarding } from '@/server/whatsapp/onboarding'

export const dynamic = 'force-dynamic'

/**
 * Um minuto: a sequência que isto dispara fala cinco vezes com a Meta.
 * Ver o cabeçalho de `onboarding.ts` — morrer no meio custa um sync, e cada um
 * só pode ser disparado uma vez na vida do número.
 */
export const maxDuration = 60

/**
 * Onde o Embedded Signup **pelo SDK** entrega o `code`.
 *
 * ---------------------------------------------------------------------------
 * Por que esta rota existe, sendo que já havia `/api/whatsapp/retorno`
 * ---------------------------------------------------------------------------
 *
 * Aquela é do fluxo **hospedado**, e o hospedado não serve para o que a gente
 * precisa: a doc da Meta diz, com todas as letras, que ele *"can only be used
 * to onboard business customers to Cloud API, and the flow cannot be
 * customized"*. Sem customização não há `featureType`, e sem `featureType` não
 * há coexistência — o cliente perderia o WhatsApp do celular, que é justamente
 * o que o produto promete não acontecer.
 *
 * Ele também **não redireciona de volta**. Foi o que fez duas conexões reais
 * terminarem com o cliente vendo "pronto" na tela da Meta e o nosso banco
 * vazio: ninguém tinha percebido que o retorno por navegador não existe ali.
 *
 * No SDK o caminho é outro: `FB.login` devolve o `code` **em JavaScript**, na
 * própria página, e o navegador o manda para cá por `POST`. Não há redirect, e
 * por isso não há `state` — a sessão do cliente acompanha a chamada, porque
 * quem chama é a nossa própria página, na nossa própria origem.
 *
 * ---------------------------------------------------------------------------
 * A conferência é a sessão, e aqui ela é suficiente
 * ---------------------------------------------------------------------------
 *
 * `/retorno` precisava do `state` assinado porque era chamada pelo navegador
 * **vindo do facebook.com**, sem cookie garantido. Esta não: é `fetch` de uma
 * página nossa para a nossa API, mesma origem, cookie incluído. Então a
 * pergunta "quem está pedindo" tem resposta direta, e `conferirAcessoAoCliente`
 * responde as duas de uma vez — quem é, e se pode mexer neste cliente.
 *
 * **O `code` vive 30 segundos** (doc da Meta). Trocá-lo é a primeira coisa que
 * acontece aqui, e no servidor: a troca exige o `client_secret`, que assina o
 * webhook de todos os clientes.
 */
export async function POST(req: Request) {
  let corpo: { clienteId?: unknown; code?: unknown; phoneNumberId?: unknown; wabaId?: unknown }
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ erro: 'corpo inválido' }, { status: 400 })
  }

  const clienteId = typeof corpo.clienteId === 'string' ? corpo.clienteId : ''
  const codigo = typeof corpo.code === 'string' ? corpo.code : ''
  let phoneNumberId = typeof corpo.phoneNumberId === 'string' ? corpo.phoneNumberId : ''
  let wabaId = typeof corpo.wabaId === 'string' ? corpo.wabaId : null

  if (!clienteId || !codigo) {
    return Response.json({ erro: 'faltou cliente ou código' }, { status: 400 })
  }

  // Rota de API responde status, não redireciona — ver `sessao.ts`.
  if (!(await conferirAcessoAoCliente(clienteId))) {
    return Response.json({ erro: 'sem acesso a este cliente' }, { status: 403 })
  }

  let canalId: string
  try {
    /*
     * **A troca vem antes de tudo, inclusive de desistir por falta de número.**
     *
     * O `code` vive 30 segundos, e a primeira versão desta rota o descartava
     * quando o `phoneNumberId` faltava: alertava e devolvia 422 sem nunca
     * trocá-lo. Isso jogava fora exatamente a peça que respondia a pergunta —
     * o token carrega quais WABAs foram compartilhadas agora.
     *
     * Aconteceu de verdade em 13/set: o cliente foi até o fim e viu *"a Meta
     * não disse qual número foi conectado"*, com o `code` válido na mão.
     */
    const { token, expiraEm } = await trocarCodigoPorToken(codigo)

    if (!phoneNumberId) {
      /*
       * O `message` de session logging não veio. Em vez de desistir, pergunta
       * à Meta: `debug_token` devolve as WABAs do token (mais recente
       * primeiro), e cada WABA lista seus números.
       *
       * Uma WABA nascida de coexistência tem **um** número — o do celular do
       * cliente. Com mais de um, não dá para saber qual é o da conexão, e
       * chutar grava o número errado: aí sim é caso de alertar e parar.
       */
      const wabas = await wabasDoToken(token)
      const descoberta = wabas[0]

      if (descoberta) {
        const numeros = await numerosDaWaba(descoberta, token)
        const unico = numeros.length === 1 ? numeros[0] : undefined

        if (unico) {
          phoneNumberId = unico.id
          wabaId = wabaId ?? descoberta
          await alertar(
            'o número não veio pelo navegador, mas foi descoberto na Meta',
            new Error(
              `session logging sem phone_number_id; recuperado ${unico.telefone ?? unico.id} pela WABA ${descoberta}`,
            ),
            { cliente: clienteId },
          )
        } else {
          await alertar(
            'o Embedded Signup terminou sem phone_number_id',
            new Error(
              `a WABA ${descoberta} tem ${numeros.length} números; escolher seria chutar qual é o da conexão`,
            ),
            { cliente: clienteId },
          )
        }
      } else {
        await alertar(
          'o Embedded Signup terminou sem phone_number_id',
          new Error('o token não trouxe nenhuma WABA em granular_scopes'),
          { cliente: clienteId },
        )
      }
    }

    if (!phoneNumberId) {
      return Response.json({ erro: 'a Meta não disse qual número foi conectado' }, { status: 422 })
    }

    const salvo = await salvarNumeroDoOnboarding({
      clienteId,
      phoneNumberId,
      wabaId,
      token,
      expiraEm,
    })
    canalId = salvo.canalId

    /*
     * **A resposta sai antes dos syncs, e eles correm no `after()`.**
     *
     * O canal já está gravado — a conexão valeu. O que falta é a sequência
     * longa (ler o número, inscrever na WABA, dois disparos), e segurar a tela
     * do cliente durante ela só aumenta a chance de ele fechar a aba no meio.
     * `after()` roda depois da resposta e dentro do mesmo orçamento de 60s.
     */
    const paraDepois = { canalId, clienteId, phoneNumberId, wabaId, token }
    after(async () => {
      try {
        await terminarOnboarding(paraDepois)
      } catch (erro) {
        // `terminarOnboarding` já alerta por dentro; isto é a rede de baixo.
        await alertar('o onboarding do WhatsApp falhou depois de gravar o número', erro, {
          cliente: clienteId,
          numero: phoneNumberId,
        })
      }
    })
  } catch (erro) {
    await alertar('não deu para concluir o onboarding do WhatsApp', erro, { cliente: clienteId })
    return Response.json({ erro: 'não deu para concluir a conexão' }, { status: 500 })
  }

  return Response.json({ ok: true, canalId })
}
