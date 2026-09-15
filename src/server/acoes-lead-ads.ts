'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { urlDeAutorizacao } from './anuncios/conexao'
import { criarEstado } from './instagram/estado'
import { importarLeadsAntigos } from './importar-leads-antigos'
import { tokenDeAnuncios } from './token-de-anuncios'
import { lerNomesDoAnuncio } from '@/channels/marketing-api'
import { exigirAcessoAoCliente } from './sessao'
import { criarConexao, listarConexoes, trocarValor } from './repos/conexoes'
import { desligarPagina, ligarPagina } from './repos/paginas-de-lead'
import { NOME_DA_CONEXAO_DE_ADS } from './token-de-anuncios'

/**
 * Ligar e desligar a conta da Meta para receber leads de anúncio.
 *
 * ---------------------------------------------------------------------------
 * Por que não é OAuth
 * ---------------------------------------------------------------------------
 *
 * Porque o token que este produto precisa é de **usuário do sistema** — o que
 * não expira. O de OAuth comum vence em 60 dias e quebra em silêncio: a
 * integração simplesmente para de trazer lead, sem erro na tela. É a falha que
 * o mercado inteiro documenta (a RD Station perdeu 18 dias de leads assim em
 * jul/2024) e que nenhum cliente perdoa duas vezes.
 *
 * O preço é o cliente colar um token uma vez. Vale: é meia dúzia de cliques a
 * mais no primeiro dia contra uma quebra silenciosa a cada dois meses.
 */

/**
 * Guarda o token e confere se ele vale — nesta ordem, e a conferência primeiro.
 *
 * **Token recusado não vira credencial.** É a mesma regra da agenda: guardar
 * chave que não funciona cria o pior estado possível, o de parecer ligado. A
 * tela diria "conectado" e nenhum lead entraria, e a pessoa iria procurar o
 * defeito em todo lugar menos na chave que ela acabou de colar.
 */
export async function acaoLigarAds(
  clienteId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const token = String(formData.get('token') ?? '').trim()
  if (token === '') return { ok: false, erro: 'cole o token gerado no Business Manager' }

  /*
   * A prova é uma chamada real à Meta, e não um teste de formato.
   *
   * Pedimos um anúncio que quase certamente não existe: o que interessa não é o
   * anúncio, é **qual erro volta**. Token inválido responde 190; token válido
   * sem esse anúncio responde 100 ou 803. Os dois dizem "a Meta entendeu quem
   * você é" — e é só isso que precisamos saber antes de guardar.
   */
  const prova = await lerNomesDoAnuncio({ adId: '0', token })
  if (!prova.ok && prova.erro.codigo === 190) {
    return { ok: false, erro: 'a Meta recusou este token; gere outro e cole de novo' }
  }

  const existente = (await listarConexoes(clienteId)).find(
    (c) => c.nome.trim().toLowerCase() === NOME_DA_CONEXAO_DE_ADS,
  )

  if (existente) {
    await trocarValor(existente.id, clienteId, token)
  } else {
    try {
      await criarConexao({
        clienteId,
        nome: NOME_DA_CONEXAO_DE_ADS,
        tipo: 'bearer',
        campo: null,
        valor: token,
      })
    } catch (erro) {
      /*
       * Deixar estourar daria o digest opaco do Next e a pessoa perderia o
       * token que acabou de colar. Vira frase, como nas outras ações.
       */
      return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) }
    }
  }

  revalidatePath(`/clientes/${clienteId}/ajustes/anuncios`)
  return { ok: true }
}

/** Liga uma Página do Facebook a esta conta, para os leads dela entrarem aqui. */
export async function acaoLigarPagina(
  clienteId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const pageId = String(formData.get('pageId') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()

  if (!/^\d{5,}$/.test(pageId)) {
    return { ok: false, erro: 'o id da página é só números — copie do Gerenciador de Anúncios' }
  }

  const r = await ligarPagina({ clienteId, pageId, nome })
  if (!r.ok) return { ok: false, erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}/ajustes/anuncios`)
  return { ok: true }
}

/**
 * Desliga a Página. Os leads dela param de entrar; os que já entraram ficam.
 *
 * Apagar contato junto seria destruir o trabalho da equipe por causa de uma
 * mudança de configuração — e a pessoa que desliga está pensando em "parar de
 * receber", não em "apagar quem já chegou".
 */
export async function acaoDesligarPagina(
  clienteId: string,
  pageId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const saiu = await desligarPagina(clienteId, pageId)
  if (!saiu) return { ok: false, erro: 'esta página não está ligada a esta conta' }

  revalidatePath(`/clientes/${clienteId}/ajustes/anuncios`)
  return { ok: true }
}

/**
 * Manda a pessoa para o diálogo da Meta.
 *
 * **A origem vem do cabeçalho, e não de uma variável.** O `redirect_uri`
 * precisa bater byte a byte com o que a rota de retorno atende e com o que está
 * cadastrado no painel da Meta — ler da requisição faz produção e preview
 * funcionarem sem cada uma ter a sua variável. Mesmo padrão do WhatsApp.
 */
export async function acaoConectarComFacebook(clienteId: string): Promise<void> {
  await exigirAcessoAoCliente(clienteId)

  const cabecalhos = await headers()
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  const origem = `${protocolo}://${host}`

  redirect(urlDeAutorizacao({ origem, state: criarEstado(clienteId) }))
}

/**
 * Traz os leads que já existiam antes de a conta ser ligada.
 *
 * Noventa dias porque é tudo o que a Meta ainda guarda — passado isso o lead
 * não existe mais nem na API dela. Pedir menos deixaria dado recuperável para
 * trás; pedir mais não traria nada.
 */
export async function acaoImportarLeadsAntigos(
  clienteId: string,
  pageId: string,
): Promise<{ ok: boolean; erro?: string; resumo?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const token = await tokenDeAnuncios(clienteId)
  if (!token) return { ok: false, erro: 'ligue a conta de anúncios antes de importar' }

  try {
    const r = await importarLeadsAntigos({
      clienteId,
      pageId,
      token,
      desde: new Date(Date.now() - 90 * 24 * 3_600_000),
    })

    revalidatePath(`/clientes/${clienteId}/ajustes/anuncios`)
    revalidatePath(`/clientes/${clienteId}/leads`)

    /*
     * O resumo conta os três, e não só os criados. "Nenhum lead novo" sozinho
     * parece falha; "40 já estavam aqui" explica — e quem importa duas vezes
     * precisa entender que a segunda não fez nada porque não tinha o que fazer.
     */
    const partes = [`${r.criados} novo(s)`]
    if (r.repetidos > 0) partes.push(`${r.repetidos} já estavam aqui`)
    if (r.recusados > 0) partes.push(`${r.recusados} sem telefone`)

    return { ok: true, resumo: partes.join(' · ') }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) }
  }
}
