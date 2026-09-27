'use client'

import { useState } from 'react'
import { NUMERO_DA_DEMO, reaisDito } from '@/core/pagamento-demo'

/*
 * Cores fixas de propósito: é a "loja" de mentira, não uma tela do
 * AutoFluxos, e precisa ler igual em qualquer celular, claro ou escuro.
 */
const VERDE = '#1F9D55'

export function Checkout({ valor, nome }: { valor: number; nome: string }) {
  const [parcelas, setParcelas] = useState(1)
  const [estado, setEstado] = useState<'aberto' | 'processando' | 'aprovado'>('aberto')
  const voltar = `https://wa.me/${NUMERO_DA_DEMO}?text=${encodeURIComponent('Já paguei')}`

  const pagar = () => {
    setEstado('processando')
    setTimeout(() => setEstado('aprovado'), 1600)
  }

  const campo = (rotulo: string, valorDoCampo: string, largura = '100%') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: largura }}>
      <span style={{ fontSize: 13, color: '#5B6770' }}>{rotulo}</span>
      <input
        readOnly
        value={valorDoCampo}
        style={{ fontSize: 16, padding: '12px 14px', border: '1px solid #D9DEE2', borderRadius: 10, background: '#F6F8F9', color: '#1B2126' }}
      />
    </label>
  )

  return (
    <main style={{ minHeight: '100dvh', background: '#EEF1F3', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#1B2126', padding: '24px 16px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: '#FFF7E0', border: '1px solid #F1D98B', color: '#6B5200', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
          Demonstração da 4YU Tech: nada é cobrado. O cartão de teste já vem preenchido.
        </div>

        <section style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: '#5B6770' }}>Pagamento para</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{nome}</div>
          <div style={{ fontSize: 34, fontWeight: 800, marginTop: 12 }}>{reaisDito(valor)}</div>
          {parcelas > 1 && (
            <div style={{ fontSize: 14, color: '#5B6770', marginTop: 2 }}>
              {parcelas}x de {reaisDito(Math.round((valor / parcelas) * 100) / 100)} sem juros
            </div>
          )}
        </section>

        {estado === 'aprovado' ? (
          <section style={{ background: 'white', borderRadius: 16, padding: 24, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: VERDE, color: 'white', fontSize: 36, lineHeight: '64px', margin: '0 auto' }}>✓</div>
            <h1 style={{ fontSize: 22, margin: '16px 0 6px' }}>Pagamento aprovado</h1>
            <p style={{ color: '#5B6770', margin: 0 }}>
              {reaisDito(valor)} no cartão final 4242{parcelas > 1 ? `, em ${parcelas}x` : ''}. O comprovante chega no WhatsApp.
            </p>
            <a
              href={voltar}
              style={{ display: 'block', marginTop: 20, background: '#25D366', color: 'white', fontWeight: 700, fontSize: 17, padding: '14px 16px', borderRadius: 12, textDecoration: 'none' }}
            >
              Voltar ao WhatsApp
            </a>
          </section>
        ) : (
          <section style={{ background: 'white', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>💳 Cartão de crédito</div>
            {campo('Número do cartão', '4242 4242 4242 4242')}
            {campo('Nome no cartão', 'CLIENTE TESTE')}
            <div style={{ display: 'flex', gap: 12 }}>
              {campo('Validade', '12/30', '50%')}
              {campo('CVV', '123', '50%')}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: '#5B6770' }}>Parcelas</span>
              <select
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                style={{ fontSize: 16, padding: '12px 14px', border: '1px solid #D9DEE2', borderRadius: 10, background: 'white', color: '#1B2126' }}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}x de {reaisDito(Math.round((valor / n) * 100) / 100)} sem juros
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={pagar}
              disabled={estado === 'processando'}
              style={{ marginTop: 4, background: VERDE, color: 'white', border: 0, fontWeight: 700, fontSize: 17, padding: '15px 16px', borderRadius: 12, opacity: estado === 'processando' ? 0.7 : 1 }}
            >
              {estado === 'processando' ? 'Processando…' : `Pagar ${reaisDito(valor)}`}
            </button>
            <div style={{ fontSize: 12, color: '#8A949B', textAlign: 'center' }}>🔒 Ambiente seguro de exemplo</div>
          </section>
        )}
      </div>
    </main>
  )
}
