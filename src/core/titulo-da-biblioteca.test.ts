import { describe, expect, it } from 'vitest'
import { tituloDaBiblioteca, tituloDoModelo } from './titulo-da-biblioteca'

describe('tituloDaBiblioteca', () => {
  it('usa a tabela e ignora o número no fim', () => {
    expect(tituloDaBiblioteca('appointment_cancellation_2')).toBe('Cancelamento de consulta')
    expect(tituloDaBiblioteca('account_creation_confirmation')).toBe('Confirmação de conta criada')
  })

  it('traduz na ordem do português o que não está na tabela', () => {
    expect(tituloDaBiblioteca('invoice_reminder')).toBe('Lembrete de fatura')
    expect(tituloDaBiblioteca('subscription_updated')).toBe('Assinatura atualizada')
    expect(tituloDaBiblioteca('ticket_confirmed')).toBe('Ingresso confirmado')
  })

  it('mantém o original quando sobra palavra desconhecida', () => {
    expect(tituloDaBiblioteca('loyalty_points_update')).toBe('Loyalty points update')
  })
})

describe('tituloDoModelo', () => {
  it('tira o carimbo e a versão e traduz', () => {
    expect(tituloDoModelo('account_creation_confirmation_3_202610051827')).toBe('Confirmação de conta criada')
  })
  it('modelo nosso em português só perde os sublinhados', () => {
    expect(tituloDoModelo('lembrete_de_consulta_202610051827')).toBe('Lembrete de consulta')
  })
})
