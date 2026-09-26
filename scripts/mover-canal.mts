/**
 * Move um número (canal) de uma conta para outra.
 *
 *   npx tsx --conditions=react-server scripts/mover-canal.mts --canal <id> --para <clienteId>
 *       [--principal <fluxoId>] [--boas-vindas <fluxoId>] [--gravar]
 *
 * **Dry-run é o padrão**: mostra o que vai mudar e não escreve nada. Só com
 * `--gravar` ele escreve.
 *
 * O que faz, nesta ordem:
 *  1. encerra as sessões abertas do canal (qualquer status que não seja
 *     `encerrada`), para nenhuma conversa da conta antiga continuar rodando um
 *     fluxo dela pelo número que agora é de outra conta;
 *  2. troca `channels.client_id` e zera os quatro fluxos do número
 *     (`flow_id`, `flow_boas_vindas_id`, `flow_midia_id`,
 *     `flow_pos_atendimento_id`), que eram fluxos da conta antiga;
 *  3. se pedido, liga os fluxos da conta nova (principal e boas-vindas) pelo
 *     mesmo `definirFluxosDoNumero` da tela, que confere que são da conta;
 *  4. registra na auditoria, com os ids antigos, para dar para voltar.
 *
 * O que **não** faz, de propósito: não move contato, conversa, handoff nem
 * histórico. Tudo isso é da conta antiga e fica nela. Quem escrever de novo
 * pelo número vira contato novo na conta nova.
 *
 * Voltar: rode de novo com `--para <conta antiga>` e os fluxos antigos, que o
 * dry-run imprime.
 */
import path from 'node:path'
import { parseArgs } from 'node:util'

process.loadEnvFile(path.resolve(import.meta.dirname, '../.env'))

const { db } = await import('@/server/db')
const { acharCliente } = await import('@/server/repos/clientes')
const { definirFluxosDoNumero } = await import('@/server/repos/conversas')
const { registrar } = await import('@/server/repos/auditoria')

const { values } = parseArgs({
  options: {
    canal: { type: 'string' },
    para: { type: 'string' },
    principal: { type: 'string' },
    'boas-vindas': { type: 'string' },
    gravar: { type: 'boolean', default: false },
  },
})
const GRAVAR = values.gravar === true
if (!values.canal || !values.para) throw new Error('use --canal <id> --para <clienteId>')

const { data: canal, error } = await db()
  .from('channels')
  .select('id, client_id, provider, display_phone_number, flow_id, flow_boas_vindas_id, flow_midia_id, flow_pos_atendimento_id')
  .eq('id', values.canal)
  .maybeSingle()
if (error) throw new Error(error.message)
if (!canal) throw new Error('esse canal não existe')

const origem = await acharCliente(canal.client_id)
const destino = await acharCliente(values.para)
if (!destino) throw new Error('a conta de destino não existe')
if (canal.client_id === destino.id) throw new Error('o canal já é dessa conta')

const { data: abertas, error: erroDasSessoes } = await db()
  .from('sessions')
  .select('id, status')
  .eq('channel_id', canal.id)
  .neq('status', 'encerrada')
if (erroDasSessoes) throw new Error(erroDasSessoes.message)

const antes = {
  client_id: canal.client_id,
  flow_id: canal.flow_id,
  flow_boas_vindas_id: canal.flow_boas_vindas_id,
  flow_midia_id: canal.flow_midia_id,
  flow_pos_atendimento_id: canal.flow_pos_atendimento_id,
}

console.log(`canal ${canal.id} (${canal.provider}, ${canal.display_phone_number ?? 'sem número'})`)
console.log(`de:   ${origem?.nome ?? '?'} (${canal.client_id})`)
console.log(`para: ${destino.nome} (${destino.id})`)
console.log(`antes: ${JSON.stringify(antes)}`)
console.log(`sessões abertas a encerrar: ${abertas?.length ?? 0} ${JSON.stringify(abertas ?? [])}`)
console.log(`fluxos novos: principal=${values.principal ?? '(nenhum)'} boas-vindas=${values['boas-vindas'] ?? '(nenhum)'}`)
console.log(`para voltar: --canal ${canal.id} --para ${canal.client_id} --principal ${canal.flow_id ?? ''} --boas-vindas ${canal.flow_boas_vindas_id ?? ''}`)

if (!GRAVAR) {
  console.log('dry-run: nada foi escrito. Rode com --gravar.')
  process.exit(0)
}

if ((abertas?.length ?? 0) > 0) {
  const { error: e } = await db()
    .from('sessions')
    .update({ status: 'encerrada', atualizado_em: new Date().toISOString() })
    .eq('channel_id', canal.id)
    .neq('status', 'encerrada')
  if (e) throw new Error(`não deu para encerrar as sessões: ${e.message}`)
}

// O `eq('client_id', ...)` é a trava contra corrida: se alguém mexeu no canal
// entre a leitura e aqui, nada muda e o script para.
const { data: movido, error: erroDoMover } = await db()
  .from('channels')
  .update({
    client_id: destino.id,
    flow_id: null,
    flow_boas_vindas_id: null,
    flow_midia_id: null,
    flow_pos_atendimento_id: null,
  })
  .eq('id', canal.id)
  .eq('client_id', canal.client_id)
  .select('id')
if (erroDoMover) throw new Error(`não deu para mover: ${erroDoMover.message}`)
if ((movido?.length ?? 0) !== 1) throw new Error('o canal mudou entre a leitura e a escrita; nada foi movido')

if (values.principal || values['boas-vindas']) {
  const r = await definirFluxosDoNumero(destino.id, canal.id, {
    ...(values.principal ? { principal: values.principal } : {}),
    ...(values['boas-vindas'] ? { boasVindas: values['boas-vindas'] } : {}),
  })
  if (!r.ok) throw new Error(`o canal foi movido, mas os fluxos não: ${r.motivo}`)
}

await registrar({
  acao: 'moveu_canal',
  contaId: destino.id,
  contaNome: destino.nome,
  alvoTipo: 'channel',
  alvoId: canal.id,
  alvoNome: canal.display_phone_number ?? canal.id,
  detalhes: {
    antes,
    depois: { client_id: destino.id, flow_id: values.principal ?? null, flow_boas_vindas_id: values['boas-vindas'] ?? null },
    sessoesEncerradas: (abertas ?? []).map((s) => s.id),
    origem: 'scripts/mover-canal.mts',
  },
})

const { data: depois } = await db()
  .from('channels')
  .select('client_id, flow_id, flow_boas_vindas_id, flow_midia_id, flow_pos_atendimento_id')
  .eq('id', canal.id)
  .single()
console.log(`depois: ${JSON.stringify(depois)}`)
