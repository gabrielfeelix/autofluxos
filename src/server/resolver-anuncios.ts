import 'server-only'
import { lerNomesDoAnuncio } from '@/channels/marketing-api'
import { idsParaResolver, type AnuncioEmCache } from '@/core/anuncios'
import { alertar } from './alertar'
import { guardarNomes, nomesGuardados } from './repos/anuncios'

/**
 * De `ad_id` a nome de campanha, com cache e sem nunca derrubar a tela.
 *
 * ---------------------------------------------------------------------------
 * A ordem das três decisões
 * ---------------------------------------------------------------------------
 *
 * 1. **O que já temos** sai do banco, numa consulta, para todos os ids da fila.
 * 2. **O que está velho ou falta** vira pergunta à Meta, sem repetição, que é
 *    o serviço de `idsParaResolver`.
 * 3. **O que a Meta responder** é gravado e devolvido junto do resto.
 *
 * O passo 2 é o único caro, e é o que o cache existe para encurtar. Numa fila
 * de 200 conversas da mesma campanha, ele faz **uma** chamada no primeiro dia
 * e **nenhuma** nas 24 horas seguintes.
 *
 * ---------------------------------------------------------------------------
 * Por que nada aqui pode falhar para fora
 * ---------------------------------------------------------------------------
 *
 * Quem chama isto está montando o Inbox, a tela que a equipe usa para
 * trabalhar. Token vencido, permissão revogada no Business Manager, limite da
 * Meta estourado, Graph fora do ar: nenhuma dessas coisas pode fazer a fila
 * deixar de abrir. Todas viram "sem nome", e a linha da conversa volta a
 * mostrar o `headline`, que está no contato desde a primeira mensagem.
 *
 * Isso é o oposto da escolha que quebra em produção no mercado: a queixa
 * documentada em vários concorrentes é o sync que morre **em silêncio** quando
 * o token vence. Aqui a degradação é visível de propósito, o nome desaparece
 * da tela e o alerta vai para a auditoria, em vez de tudo continuar parecendo
 * certo enquanto o dado apodrece.
 */

/**
 * Um alerta por cliente e por motivo, não um por conversa.
 *
 * Sem isto, uma fila de 200 conversas com token vencido geraria 200 alertas
 * iguais, e um canal de alerta que grita 200 vezes é um canal que ninguém lê
 * na próxima vez. O `Set` vive no módulo, então dura o que durar a instância
 * serverless: é amortecimento, não memória de verdade, e é o suficiente para o
 * caso que importa (uma tela sendo aberta várias vezes seguidas).
 */
const jaAvisado = new Set<string>()

async function avisarUmaVez(chave: string, titulo: string, detalhe: string): Promise<void> {
  if (jaAvisado.has(chave)) return
  jaAvisado.add(chave)
  await alertar(titulo, detalhe, {})
}

/**
 * Os nomes dos anúncios desta fila, resolvendo o que faltar.
 *
 * `token` nulo = a conta não conectou o Ads. Devolve só o que está em cache
 * (que pode ser vazio) e **não** avisa nada: não conectar é uma escolha
 * legítima, não um defeito.
 */
export async function resolverAnuncios(entrada: {
  clienteId: string
  adIds: string[]
  token: string | null
}): Promise<Map<string, AnuncioEmCache>> {
  const { clienteId, adIds, token } = entrada

  let cache: Map<string, AnuncioEmCache>
  try {
    cache = await nomesGuardados(clienteId, adIds)
  } catch (erro) {
    /*
     * Nem o cache respondeu. Ainda assim a tela abre: devolver vazio faz cada
     * linha cair para o `headline`, que é o degrau de ontem, pior que o ideal,
     * melhor que uma fila que não carrega.
     */
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await avisarUmaVez(
      `${clienteId}:cache`,
      'não deu para ler os nomes de anúncio guardados',
      detalhe,
    )
    return new Map()
  }

  if (!token) return cache

  const pedir = idsParaResolver(adIds, cache)
  if (pedir.length === 0) return cache

  for (const adId of pedir) {
    const resposta = await lerNomesDoAnuncio({ adId, token })

    if (!resposta.ok) {
      /*
       * O código da Meta decide a mensagem, porque as causas pedem ações
       * opostas e erram parecido na tela:
       *
       * - 190: o token venceu ou foi revogado. Alguém precisa reconectar.
       * - 4 / 17 / 80004: limite de chamadas. Ninguém precisa fazer nada, o
       *   cache vai cobrir e amanhã resolve.
       *
       * Sem essa distinção, "o nome não aparece" manda o dono investigar
       * permissão quando o problema era esperar, e esperar quando o problema
       * era reconectar.
       */
      const codigo = resposta.erro.codigo
      const precisaReconectar = codigo === 190
      const ehLimite = codigo === 4 || codigo === 17 || codigo === 80004

      if (precisaReconectar) {
        await avisarUmaVez(
          `${clienteId}:190`,
          'o acesso aos anúncios venceu; reconecte para voltar a ver o nome das campanhas',
          resposta.erro.mensagem,
        )
      } else if (!ehLimite) {
        await avisarUmaVez(
          `${clienteId}:${codigo ?? 'rede'}`,
          'não deu para ler o nome do anúncio na Meta',
          `${resposta.erro.mensagem} (anúncio ${adId})`,
        )
      }

      /*
       * Para de tentar os outros ids quando o token está inválido: os 199
       * seguintes vão falhar igual, e insistir só gasta o limite da Página.
       * Num erro pontual (um id apagado na Meta) segue para o próximo.
       */
      if (precisaReconectar || ehLimite) break
      continue
    }

    try {
      await guardarNomes(clienteId, adId, resposta.nomes)
    } catch (erro) {
      /*
       * A Meta respondeu e o banco não aceitou. O nome ainda serve **nesta**
       * tela, só não sobrevive ao recarregamento. Melhor mostrar agora e
       * perguntar de novo depois do que descartar o que já foi pago em chamada.
       */
      const detalhe = erro instanceof Error ? erro.message : String(erro)
      await avisarUmaVez(`${clienteId}:gravar`, 'não deu para guardar o nome do anúncio', detalhe)
    }

    cache.set(adId, {
      adId,
      ...resposta.nomes,
      resolvidoEm: new Date().toISOString(),
    })
  }

  return cache
}
