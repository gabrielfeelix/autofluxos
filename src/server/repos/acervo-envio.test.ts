import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../db'
import { criarCliente } from './clientes'
import { apagarDoAcervo, listarAcervo, pedirEnvioAssinado } from './acervo'

/**
 * O envio direto para o Storage (a correção do 413).
 *
 * **O caso que precisa passar é o de mais de 1 MB.** Era exatamente ele que
 * quebrava: o arquivo ia dentro de uma Server Action, o Next devolvia 413 antes
 * de qualquer código nosso rodar, e a tela mostrava a página de erro genérica.
 * Um teste com arquivo pequeno passaria mesmo com o defeito no lugar — por isso
 * o daqui tem 2 MB.
 */
const temCredencial = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)
const marca = `zz-env-${Math.random().toString(36).slice(2, 8)}`

/** Acima do teto de 1 MB da Server Action, e abaixo do teto de 16 MB do bucket. */
const DOIS_MEGAS = 2 * 1024 * 1024

let clienteId = ''
const paraLimpar: string[] = []

beforeAll(async () => {
  if (!temCredencial) return
  const cliente = await criarCliente(`${marca} cliente`)
  clienteId = cliente.id
})

afterAll(async () => {
  if (!temCredencial || !clienteId) return
  for (const caminho of paraLimpar) {
    await apagarDoAcervo(clienteId, caminho).catch(() => {})
  }
  await db().from('clients').delete().eq('id', clienteId)
})

describe.skipIf(!temCredencial)('envio assinado', () => {
  it('sobe um PDF de 2 MB — o tamanho que a Server Action recusava', async () => {
    const preparo = await pedirEnvioAssinado(clienteId, {
      nome: 'Plano Trimestral.pdf',
      tipo: 'application/pdf',
      bytes: DOIS_MEGAS,
    })
    expect(preparo.ok).toBe(true)
    if (!preparo.ok) return

    paraLimpar.push(preparo.envio.caminho)

    // O nome vira endereço: acento e espaço viram %20 e o WhatsApp mostra isso
    // no nome do documento que a pessoa baixa.
    expect(preparo.envio.nome).toMatch(/^plano-trimestral-[a-z0-9]{6}\.pdf$/)
    expect(preparo.envio.midia).toBe('documento')
    expect(preparo.envio.caminho.startsWith(`${clienteId}/`)).toBe(true)

    const corpo = new Uint8Array(DOIS_MEGAS)
    corpo.set(new TextEncoder().encode('%PDF-1.4\n'))

    const resposta = await fetch(preparo.envio.url, {
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      body: corpo,
    })
    expect(resposta.status, await resposta.text().catch(() => '')).toBeLessThan(300)

    const acervo = await listarAcervo(clienteId)
    const subido = acervo.find((a) => a.nome === preparo.envio.nome)
    expect(subido?.bytes).toBe(DOIS_MEGAS)
    expect(subido?.url).toBe(preparo.envio.urlPublica)
  })

  it('a URL pública que o fluxo guarda é a que a Meta consegue baixar', async () => {
    // O bloco de mídia grava esta URL no grafo, e quem busca o arquivo depois é
    // a Cloud API, sem credencial nossa. Se ela não for pública de verdade, a
    // foto simplesmente não chega — e o erro aparece na conversa de um cliente.
    const acervo = await listarAcervo(clienteId)
    expect(acervo.length).toBeGreaterThan(0)

    const resposta = await fetch(acervo[0]!.url, { method: 'HEAD' })
    expect(resposta.ok).toBe(true)
  })

  it('recusa o que o WhatsApp não envia, sem assinar nada', async () => {
    expect(
      await pedirEnvioAssinado(clienteId, { nome: 'planilha.xlsx', tipo: 'application/zip', bytes: 100 }),
    ).toEqual({
      ok: false,
      motivo: 'O WhatsApp não envia este tipo. Use imagem, MP4, MP3, OGG ou PDF.',
    })
  })

  it('recusa acima de 16 MB antes de assinar — não adianta subir o que a Meta recusa', async () => {
    const r = await pedirEnvioAssinado(clienteId, {
      nome: 'video.mp4',
      tipo: 'video/mp4',
      bytes: 20 * 1024 * 1024,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('16 MB')
  })

  it('a assinatura vale só para o caminho do cliente dela', async () => {
    const preparo = await pedirEnvioAssinado(clienteId, {
      nome: 'foto.png',
      tipo: 'image/png',
      bytes: 1000,
    })
    expect(preparo.ok).toBe(true)
    if (!preparo.ok) return

    // O caminho é escolhido no servidor, depois de conferir o dono. O navegador
    // recebe uma URL que só escreve ali — ele não escolhe onde gravar.
    expect(preparo.envio.url).toContain(encodeURIComponent(clienteId).replace(/%2F/g, '/'))
    expect(preparo.envio.url).toContain('token=')
  })
})
