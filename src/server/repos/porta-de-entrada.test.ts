import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dentroDaJanela, dentroDaPortaDeEntrada } from '@/channels/janela'
import { db } from '../db'
import { criarCliente } from './clientes'
import { acharOuCriarContato } from './conversas'
import { registrarPassagem } from './passagens'

/**
 * De onde sai a janela de 72h, e quem não deveria abri-la.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo está provando
 * ---------------------------------------------------------------------------
 *
 * A Meta abre a janela gratuita de 72h para quem **clica num anúncio Click to
 * WhatsApp** ou no botão da Página: o clique manda a pessoa para a conversa, e
 * é a conversa que a janela autoriza. Um lead de **formulário** (Lead Ads) não
 * faz nada disso — ele entrega um telefone preenchido num formulário dentro do
 * Facebook, sem que a pessoa tenha escrito para o número nem aberto conversa
 * nenhuma.
 *
 * Só que os dois caminhos gravam a mesma linha em `passagens`, e a view da
 * 0065 lê **qualquer** linha de lá como `porta_de_entrada_em`. Quer dizer: um
 * formulário concede 72h de texto livre que a Meta não concedeu. Quem responder
 * confiando nisso escreve, envia e recebe `(#131047) Re-engagement message`.
 *
 * É a RB-09 da proposta de 19/set: "formulário não é conversa... não abre
 * janela de conversa do WhatsApp por si só".
 *
 * O teste está no nível do banco, e não em `channels/janela.test.ts`, porque a
 * conta em TypeScript está certa: ela recebe `portaDeEntradaEm` e confia. O
 * defeito é a **procedência** desse campo, e isso só aparece contra a view.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-porta-${Math.random().toString(36).slice(2, 8)}`
const seed = Math.floor(Math.random() * 1e7).toString().padStart(7, '0')

let clienteId = ''
let doAnuncio = ''
let doFormulario = ''

/** O que a view devolve como porta de entrada para este contato. */
async function portaDaView(contatoId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('leads')
    .select('porta_de_entrada_em')
    .eq('contact_id', contatoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as { porta_de_entrada_em: string | null } | null)?.porta_de_entrada_em ?? null
}

beforeAll(async () => {
  if (!temCredencial) return

  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id

  const ana = await acharOuCriarContato(clienteId, `55119${seed}`, 'Ana do anúncio')
  const bruno = await acharOuCriarContato(clienteId, `55219${seed}`, 'Bruno do formulário')
  doAnuncio = ana.id
  doFormulario = bruno.id

  // A chegada por clique em anúncio: é esta que a Meta credita com as 72h.
  await registrarPassagem({
    clienteId,
    contatoId: doAnuncio,
    adId: '1200000000001',
    titulo: 'Anúncio — Plano XYZ',
  })

  // A chegada por formulário, como `receber-lead-do-formulario.ts` grava hoje.
  await registrarPassagem({
    clienteId,
    contatoId: doFormulario,
    adId: '1200000000002',
    titulo: 'Formulário — Bruno',
  })
})

afterAll(async () => {
  if (!temCredencial || clienteId === '') return
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('a porta de entrada das 72h', () => {
  it('o clique em anúncio abre a janela gratuita', async () => {
    const porta = await portaDaView(doAnuncio)
    expect(porta).not.toBeNull()
    expect(dentroDaPortaDeEntrada({ ultimaEntradaEm: null, portaDeEntradaEm: porta })).toBe(true)
  })

  /**
   * O defeito. Enquanto `passagens` não distinguir o tipo da entrada, a view
   * entrega ao formulário a mesma porta do anúncio, e a janela de 72h abre para
   * quem nunca escreveu.
   *
   * Quando a F3 separar os tipos, este teste passa a exigir `toBeNull()` — a
   * mudança do `expect` é justamente a prova de que o comportamento mudou.
   */
  it('hoje o formulário também abre, e não deveria (RB-09)', async () => {
    const porta = await portaDaView(doFormulario)

    // O que acontece hoje, registrado para que a correção fique visível:
    expect(porta).not.toBeNull()

    // E a consequência: janela de texto livre para quem nunca mandou mensagem.
    expect(dentroDaJanela({ ultimaEntradaEm: null, portaDeEntradaEm: porta })).toBe(true)
  })

  /**
   * Nenhuma passagem, nenhuma janela. É o caso da maioria dos contatos, e é o
   * comportamento que precisa continuar valendo depois da correção.
   */
  it('quem não chegou por lugar nenhum não tem janela', async () => {
    const semPassagem = await acharOuCriarContato(clienteId, `55319${seed}`, 'Sem origem')
    expect(await portaDaView(semPassagem.id)).toBeNull()
    expect(dentroDaJanela({ ultimaEntradaEm: null, portaDeEntradaEm: null })).toBe(false)
  })
})
