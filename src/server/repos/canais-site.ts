import 'server-only'
import { randomBytes } from 'node:crypto'
import { type ConfigDoSite, lerConfigDoSite } from '@/core/chat-do-site'
import type { CanalId } from '@/core/canais'
import { PREFIXO_DO_SITE } from '@/core/contatos/visitante-do-site'
import { db } from '../db'
import { type CanalSalvo, COLUNAS_DO_CANAL, paraCanal } from './conversas'

/**
 * O chat do site de uma conta: a linha de `channels` com `provider = 'site'`.
 *
 * Um por conta. O lojista cola o mesmo trecho em quantas páginas quiser, e os
 * domínios moram na configuração; dois canais de site na mesma conta seriam
 * duas chaves para a mesma coisa, e a tela não teria como dizer qual é a certa.
 */
export type CanalDoSite = CanalSalvo & {
  chave: string
  config: ConfigDoSite
}

const COLUNAS = `${COLUNAS_DO_CANAL}, site_chave, site_config`

function paraCanalDoSite(linha: Record<string, unknown>): CanalDoSite {
  return {
    ...paraCanal(linha),
    chave: linha.site_chave as string,
    config: lerConfigDoSite(linha.site_config),
  }
}

export async function chatDoSite(clienteId: string): Promise<CanalDoSite | null> {
  const { data, error } = await db()
    .from('channels')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('provider', 'site')
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`não deu para achar o chat do site: ${error.message}`)
  return data ? paraCanalDoSite(data as Record<string, unknown>) : null
}

/**
 * O canal de uma chave pública, a porta da API do balão.
 *
 * Chave com forma errada nem vai ao banco: ela chega de qualquer navegador do
 * mundo, e a consulta é o que um robô martelaria.
 */
export async function acharChatPorChave(chave: string): Promise<CanalDoSite | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(chave)) return null

  const { data, error } = await db()
    .from('channels')
    .select(COLUNAS)
    .eq('site_chave', chave)
    .eq('provider', 'site')
    .maybeSingle()

  if (error) throw new Error(`não deu para achar o chat do site: ${error.message}`)
  return data ? paraCanalDoSite(data as Record<string, unknown>) : null
}

/**
 * Liga o chat do site, ou religa o que estava pausado.
 *
 * **Nasce com os fluxos do WhatsApp da conta.** O site roda as mesmas
 * automações (ver `fluxoProprio` em `core/canais.ts`), e copiar os quatro
 * papéis do primeiro número ativo é o que faz o balão responder no primeiro
 * teste, sem uma segunda tela de configuração para o lojista descobrir.
 * Copiar, e não apontar: se um dia o site quiser um principal diferente, a
 * tela troca aqui sem mexer no WhatsApp.
 */
export async function ligarChatDoSite(clienteId: string): Promise<CanalDoSite> {
  const canal = await garantirChatDoSite(clienteId, 'ativo')
  if (canal.status !== 'ativo') {
    const { error } = await db().from('channels').update({ status: 'ativo' }).eq('id', canal.id)
    if (error) throw new Error(`não deu para religar o chat do site: ${error.message}`)
  }
  return { ...canal, status: 'ativo' }
}

/**
 * O canal da conta, criando se ainda não existe.
 *
 * Salvar a aparência antes de ligar é caminho normal (a pessoa arruma tudo e
 * só então liga), e sem a linha o `update` não achava nada e a tela dizia
 * "salvo" com nada gravado. Quem salva sem ligar ganha o canal **pausado**:
 * configurar não é publicar.
 */
export async function garantirChatDoSite(
  clienteId: string,
  status: 'ativo' | 'pausado',
): Promise<CanalDoSite> {
  const existente = await chatDoSite(clienteId)
  if (existente) return existente

  const { data: numero } = await db()
    .from('channels')
    .select('flow_id, flow_boas_vindas_id, flow_midia_id, flow_pos_atendimento_id')
    .eq('client_id', clienteId)
    .eq('provider', 'cloud-api')
    .eq('status', 'ativo')
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data, error } = await db()
    .from('channels')
    .insert({
      client_id: clienteId,
      provider: 'site',
      // 18 bytes viram 24 caracteres: curto para caber no trecho, longo para
      // não ser adivinhado. Não é segredo (vai no HTML), mas também não precisa
      // ser uma lista que alguém percorre.
      site_chave: randomBytes(18).toString('base64url'),
      site_config: {},
      status,
      flow_id: numero?.flow_id ?? null,
      flow_boas_vindas_id: numero?.flow_boas_vindas_id ?? null,
      flow_midia_id: numero?.flow_midia_id ?? null,
      flow_pos_atendimento_id: numero?.flow_pos_atendimento_id ?? null,
    })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para ligar o chat do site: ${error.message}`)
  return paraCanalDoSite(data as Record<string, unknown>)
}

/** Pausa o balão sem apagar nada: as conversas continuam no Inbox. */
export async function pausarChatDoSite(clienteId: string): Promise<void> {
  const { error } = await db()
    .from('channels')
    .update({ status: 'pausado' })
    .eq('client_id', clienteId)
    .eq('provider', 'site')
  if (error) throw new Error(`não deu para pausar o chat do site: ${error.message}`)
}

export async function salvarConfigDoSite(clienteId: string, config: ConfigDoSite): Promise<void> {
  const { error } = await db()
    .from('channels')
    .update({ site_config: config })
    .eq('client_id', clienteId)
    .eq('provider', 'site')
  if (error) throw new Error(`não deu para salvar o chat do site: ${error.message}`)
}

/**
 * Por qual canal cada contato fala, para o selo da fila.
 *
 * Só os canais que **não** são WhatsApp entram no mapa: o caso comum é a conta
 * só ter WhatsApp, e aí a consulta nem acontece e todo contato fora do mapa é
 * WhatsApp. Substitui o conjunto que só sabia de Instagram, pelo mesmo caminho
 * (a sessão sabe o canal, o contato não).
 *
 * Pagina de mil em mil porque é o teto que o PostgREST devolve por chamada, e
 * cortar em silêncio pintaria de WhatsApp quem veio pelo site.
 */
export async function canaisDosContatos(clienteId: string): Promise<Map<string, CanalId>> {
  const mapa = new Map<string, CanalId>()

  const { data: canais, error } = await db()
    .from('channels')
    .select('id, provider')
    .eq('client_id', clienteId)
    .in('provider', ['instagram', 'site'])
  if (error) throw new Error(`não deu para listar os canais: ${error.message}`)
  if (!canais || canais.length === 0) return mapa

  const canalDoId = new Map(
    canais.map((c) => [c.id as string, (c.provider === 'site' ? 'site' : 'instagram') as CanalId]),
  )

  const PAGINA = 1000
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error: erro } = await db()
      .from('sessions')
      .select('contact_id, channel_id')
      .in('channel_id', [...canalDoId.keys()])
      .order('id')
      .range(inicio, inicio + PAGINA - 1)

    if (erro) throw new Error(`não deu para achar o canal dos contatos: ${erro.message}`)
    for (const linha of data ?? []) {
      const canal = canalDoId.get(linha.channel_id as string)
      if (canal) mapa.set(linha.contact_id as string, canal)
    }
    if (!data || data.length < PAGINA) break
  }

  /*
   * Visitante do site que ainda não tem sessão (a conta sem fluxo publicado,
   * ou o bot pausado para ele) não aparece na consulta acima. O endereço dele
   * já diz o canal, então ele entra pelo prefixo.
   */
  if ([...canalDoId.values()].includes('site')) {
    for (let inicio = 0; ; inicio += PAGINA) {
      const { data, error: erro } = await db()
        .from('contacts')
        .select('id')
        .eq('client_id', clienteId)
        .like('wa_id', `${PREFIXO_DO_SITE}%`)
        .order('id')
        .range(inicio, inicio + PAGINA - 1)

      if (erro) throw new Error(`não deu para achar os visitantes do site: ${erro.message}`)
      for (const linha of data ?? []) mapa.set(linha.id as string, 'site')
      if (!data || data.length < PAGINA) break
    }
  }

  return mapa
}
