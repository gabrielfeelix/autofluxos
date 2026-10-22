import 'server-only'
import { db, ehIdInvalido } from '../db'

/** O formulário nativo do WhatsApp publicado num número (0143). */

export type StatusDoFormulario = 'rascunho' | 'publicado' | 'erro'
export type ModeloDeFormulario = 'agendamento'

export type FormularioDoWhatsapp = {
  id: string
  clienteId: string
  canalId: string
  modelo: ModeloDeFormulario
  flowId: string | null
  status: StatusDoFormulario
  erro: string | null
  chavePrivadaRef: string
  atualizadoEm: string
}

type Linha = {
  id: string
  cliente_id: string
  canal_id: string
  modelo: ModeloDeFormulario
  flow_id: string | null
  status: StatusDoFormulario
  erro: string | null
  chave_privada_ref: string
  atualizado_em: string
}

const COLUNAS = 'id, cliente_id, canal_id, modelo, flow_id, status, erro, chave_privada_ref, atualizado_em'

function paraFormulario(l: Linha): FormularioDoWhatsapp {
  return {
    id: l.id,
    clienteId: l.cliente_id,
    canalId: l.canal_id,
    modelo: l.modelo,
    flowId: l.flow_id,
    status: l.status,
    erro: l.erro,
    chavePrivadaRef: l.chave_privada_ref,
    atualizadoEm: l.atualizado_em,
  }
}

/** Código no ar antes da 0143 lê "nenhum formulário", como `repos/cobrancas.ts`. */
function tabelaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function acharFormulario(id: string): Promise<FormularioDoWhatsapp | null> {
  const { data, error } = await db().from('formularios_do_whatsapp').select(COLUNAS).eq('id', id).maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler o formulário: ${error.message}`)
  return data ? paraFormulario(data as Linha) : null
}

export async function formulariosDaConta(clienteId: string): Promise<FormularioDoWhatsapp[]> {
  const { data, error } = await db()
    .from('formularios_do_whatsapp')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: true })
  if (ehIdInvalido(error) || tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível listar os formulários: ${error.message}`)
  return (data as Linha[]).map(paraFormulario)
}

/**
 * O formulário que o bloco manda num número: o que já existe na Meta
 * (`flow_id`), publicado ou não. Sem publicar, vai em modo rascunho, que a
 * Meta aceita para teste; quem envia olha o `status`.
 */
export async function formularioDoCanal(
  clienteId: string,
  canalId: string,
  modelo: ModeloDeFormulario = 'agendamento',
): Promise<FormularioDoWhatsapp | null> {
  const { data, error } = await db()
    .from('formularios_do_whatsapp')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .eq('canal_id', canalId)
    .eq('modelo', modelo)
    .not('flow_id', 'is', null)
    .maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler o formulário do número: ${error.message}`)
  return data ? paraFormulario(data as Linha) : null
}

export async function criarFormulario(entrada: {
  clienteId: string
  canalId: string
  chavePrivadaRef: string
  modelo?: ModeloDeFormulario
}): Promise<FormularioDoWhatsapp> {
  const { data, error } = await db()
    .from('formularios_do_whatsapp')
    .insert({
      cliente_id: entrada.clienteId,
      canal_id: entrada.canalId,
      modelo: entrada.modelo ?? 'agendamento',
      chave_privada_ref: entrada.chavePrivadaRef,
    })
    .select(COLUNAS)
    .single()
  if (error) throw new Error(`não foi possível criar o formulário: ${error.message}`)
  return paraFormulario(data as Linha)
}

export async function atualizarFormulario(
  id: string,
  mudanca: { flowId?: string; status?: StatusDoFormulario; erro?: string | null },
): Promise<void> {
  const { error } = await db()
    .from('formularios_do_whatsapp')
    .update({
      ...(mudanca.flowId !== undefined ? { flow_id: mudanca.flowId } : {}),
      ...(mudanca.status !== undefined ? { status: mudanca.status } : {}),
      ...(mudanca.erro !== undefined ? { erro: mudanca.erro } : {}),
    })
    .eq('id', id)
  if (error) throw new Error(`não foi possível atualizar o formulário: ${error.message}`)
}

/** Apaga a linha; o gatilho da 0143 apaga a chave privada do Vault junto. */
export async function apagarFormulario(clienteId: string, id: string): Promise<void> {
  const { error } = await db().from('formularios_do_whatsapp').delete().eq('cliente_id', clienteId).eq('id', id)
  if (error && !tabelaAusente(error)) throw new Error(`não foi possível apagar o formulário: ${error.message}`)
}
