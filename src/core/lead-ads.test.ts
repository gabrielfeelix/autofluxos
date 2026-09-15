import { describe, expect, it } from 'vitest'
import { avisosDoWebhook, lerLeadDoFormulario } from './lead-ads'

describe('lerLeadDoFormulario', () => {
  it('lê o formulário padrão da Meta', () => {
    const r = lerLeadDoFormulario({
      leadId: '123',
      fieldData: [
        { name: 'full_name', values: ['Joana Silva'] },
        { name: 'email', values: ['joana@exemplo.com'] },
        { name: 'phone_number', values: ['+55 11 98765-4321'] },
      ],
    })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.lead.telefone).toBe('5511987654321')
      expect(r.lead.nome).toBe('Joana Silva')
      expect(r.lead.email).toBe('joana@exemplo.com')
    }
  })

  /*
   * O caso brasileiro de verdade: formulário feito à mão, com as chaves que o
   * anunciante digitou. Cobrir só as chaves oficiais deixaria de fora a maioria.
   */
  it('acha telefone em campo customizado, em português', () => {
    const r = lerLeadDoFormulario({
      leadId: '124',
      fieldData: [
        { name: 'nome_completo', values: ['Carlos'] },
        { name: 'qual_seu_whatsapp', values: ['11987654321'] },
      ],
    })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.lead.telefone).toBe('5511987654321')
      expect(r.lead.nome).toBe('Carlos')
    }
  })

  /*
   * A restrição do modelo: sem telefone não há onde encaixar, porque o contato
   * é chaveado por `wa_id`. A recusa tem de dizer o que consertar.
   */
  it('recusa formulário sem telefone, dizendo o que fazer', () => {
    const r = lerLeadDoFormulario({
      leadId: '125',
      fieldData: [{ name: 'email', values: ['so@email.com'] }],
    })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.recusa.motivo).toContain('telefone')
  })

  it('telefone impossível é recusado, não normalizado na marra', () => {
    const r = lerLeadDoFormulario({
      leadId: '126',
      fieldData: [{ name: 'phone_number', values: ['123'] }],
    })
    expect(r.ok).toBe(false)
  })

  it('guarda tudo que veio, inclusive o que não reconhecemos', () => {
    const r = lerLeadDoFormulario({
      leadId: '127',
      fieldData: [
        { name: 'phone_number', values: ['11987654321'] },
        { name: 'qual_seu_orcamento', values: ['ate 5 mil'] },
      ],
    })

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lead.respostas.qual_seu_orcamento).toBe('ate 5 mil')
  })

  it('não confunde nome da empresa com nome da pessoa', () => {
    const r = lerLeadDoFormulario({
      leadId: '128',
      fieldData: [
        { name: 'nome_da_empresa', values: ['Padaria do Zé'] },
        { name: 'nome', values: ['Zé'] },
        { name: 'telefone', values: ['11987654321'] },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lead.nome).toBe('Zé')
  })

  it('field_data que não é lista não derruba', () => {
    expect(lerLeadDoFormulario({ leadId: '129', fieldData: null }).ok).toBe(false)
  })
})

describe('avisosDoWebhook', () => {
  /* O exemplo oficial da Meta traz DOIS leads no mesmo POST. */
  it('lê todos os leads do lote, e não só o primeiro', () => {
    const avisos = avisosDoWebhook({
      object: 'page',
      entry: [
        {
          id: '153125381133',
          changes: [
            { field: 'leadgen', value: { leadgen_id: '1', form_id: 'f1', ad_id: 'a1', page_id: 'p' } },
            { field: 'leadgen', value: { leadgen_id: '2', form_id: 'f1', ad_id: 'a1', page_id: 'p' } },
          ],
        },
      ],
    })

    expect(avisos.map((a) => a.leadgenId)).toEqual(['1', '2'])
  })

  it('lead orgânico vem sem ad_id, e ainda assim entra', () => {
    const avisos = avisosDoWebhook({
      object: 'page',
      entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: '3', form_id: 'f1' } }] }],
    })

    expect(avisos).toHaveLength(1)
    expect(avisos[0]?.adId).toBe('')
  })

  it('ignora o que não é leadgen', () => {
    const avisos = avisosDoWebhook({
      object: 'page',
      entry: [{ changes: [{ field: 'feed', value: { post_id: 'x' } }] }],
    })
    expect(avisos).toEqual([])
  })

  it('corpo de outro objeto não vira lead', () => {
    expect(avisosDoWebhook({ object: 'whatsapp_business_account', entry: [] })).toEqual([])
    expect(avisosDoWebhook(null)).toEqual([])
  })
})
