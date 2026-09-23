'use client'

import { useState, useTransition } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import type { EstadoDaChave } from '@/server/repos/chave-de-ia'

type Guardar = (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
type Apagar = () => Promise<{ ok: boolean; erro?: string }>

/**
 * De quem é a chave que atende esta conta.
 *
 * ---------------------------------------------------------------------------
 * Por que isto está na tela, e não só num documento
 * ---------------------------------------------------------------------------
 *
 * A conta free do Gemini **treina modelo com o que passa por ela**. Enquanto a
 * conversa é demonstração, o dado é nosso. Quando é o cliente do cliente, com
 * nome e telefone, aquilo é dado pessoal de terceiro indo para treino sem
 * ninguém ter consentido.
 *
 * Quem decide isso é o dono da conta, e ninguém decide o que não vê. Por isso o
 * estado aparece em palavras, e não como um campo vazio que só quem já sabe
 * entenderia.
 *
 * O valor **entra e não sai**, como no cofre de chaves: o tipo que o servidor
 * devolve não tem a chave, só os quatro últimos caracteres, o bastante para
 * reconhecer qual está lá.
 */
export function ChaveDeIa({
  estado,
  guardar,
  apagar,
}: {
  estado: EstadoDaChave
  guardar: Guardar
  apagar: Apagar
}) {
  const [trocando, setTrocando] = useState(false)
  const [erro, setErro] = useState('')
  // O resultado mora no cartão, e não no formulário: salvar fecha o formulário,
  // e um "Salvo" dentro dele sumiria junto (S03).
  const [feito, setFeito] = useState('')
  const [pendente, comecar] = useTransition()

  return (
    <section className="app-card overflow-hidden">
      <header className="border-b border-line px-[18px] py-3.5">
        <h2 className="text-[13px] font-bold">Credencial do provedor</h2>
        <p className="mt-0.5 text-[12px] text-dim">
          A chave do Gemini que o bloco de IA usa para escrever as respostas. Nunca aparece
          inteira depois de salva.
        </p>
      </header>

      <div className="px-[18px] py-4">
        {estado.propria ? (
          <p className="text-[12.5px] leading-5 text-soft">
            Esta conta usa <strong>a chave dela</strong>, terminada em{' '}
            <span className="tabular-nums">{estado.fim}</span>. As conversas vão para a conta paga
            do cliente e não entram em treino de modelo.
          </p>
        ) : (
          <p className="text-[12.5px] leading-5 text-soft">
            Esta conta usa <strong>a chave da 4YU</strong>, que é de demonstração. O Google pode
            usar essas conversas para treinar modelo. Para atender gente de verdade, cadastre a
            chave paga do cliente.
          </p>
        )}

        {trocando || !estado.propria ? (
          <div className="mt-3.5">
            <FormularioSalvar
              action={async (anterior, formData) => {
                const r = await guardar(anterior, formData)
                if (r.ok) {
                  setTrocando(false)
                  setFeito('Chave salva. Vale na próxima conversa.')
                }
                return r
              }}
              rotulo={estado.propria ? 'Trocar a chave' : 'Salvar a chave'}
              dica="Vale na próxima conversa. Depois de salva, ela não volta para a tela."
            >
              <input
                name="chave"
                type="password"
                autoComplete="off"
                placeholder="AIza..."
                className="app-field px-3 py-2.5 text-[12.5px]"
              />
            </FormularioSalvar>
            {trocando && (
              <button
                type="button"
                onClick={() => setTrocando(false)}
                className="mt-1.5 text-[11.5px] text-muted transition hover:text-primary"
              >
                Cancelar
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFeito('')
                setTrocando(true)
              }}
              className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
            >
              Trocar
            </button>
            <button
              type="button"
              disabled={pendente}
              onClick={() =>
                comecar(async () => {
                  setErro('')
                  setFeito('')
                  const r = await apagar()
                  if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
                  else setFeito('Chave do cliente apagada. A conta voltou para a chave da 4YU.')
                })
              }
              className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-muted transition hover:border-perigo/40 hover:text-perigo disabled:opacity-50"
            >
              usar a chave da 4YU
            </button>
          </div>
        )}

        {erro !== '' && (
          <p role="alert" className="mt-2 text-[11.5px] text-perigo">
            {erro}
          </p>
        )}
        {feito !== '' && erro === '' && (
          <p role="status" className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {feito}
          </p>
        )}
      </div>
    </section>
  )
}
