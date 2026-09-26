'use client'

import { useActionState } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import type { Ficha, ListaDaFicha, PerguntaDaFicha } from '@/core/ficha-do-assistente'
import type { EstadoDoTeste } from '@/server/acoes-ficha'

/**
 * A ficha do assistente na tela (PLANO-NICHOS 1.7).
 *
 * Mesma interface para todo ramo: mesma ordem, mesmos componentes. Muda a
 * pergunta e o exemplo, que vêm do pacote. O placar e o Testar ficam em cima,
 * porque "o assistente responde 6 de 10" é o que faz o dono preencher o resto.
 */
export function FichaDoAssistente({
  perguntas,
  listas,
  ficha,
  marcadas,
  placar,
  salvar,
  testar,
}: {
  perguntas: PerguntaDaFicha[]
  listas: ListaDaFicha[]
  ficha: Ficha
  /** O que está marcado em cada lista, já com o padrão e as travadas. */
  marcadas: Record<ListaDaFicha['id'], string[]>
  placar: { respondidas: number; total: number; faltam: string[] }
  salvar: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
  testar: (estado: EstadoDoTeste) => Promise<EstadoDoTeste>
}) {
  const [teste, rodarTeste, testando] = useActionState(testar, {})
  const completo = placar.respondidas === placar.total

  return (
    <div className="flex flex-col gap-5">
      <section className="app-card max-w-[860px] px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold">
              O assistente responde {placar.respondidas} de {placar.total} perguntas comuns
            </p>
            <p className="mt-0.5 text-[12px] text-dim">
              {completo
                ? 'Todas as perguntas do seu ramo têm resposta.'
                : `Faltam: ${placar.faltam.join(', ')}. Sem resposta, o assistente passa para uma pessoa.`}
            </p>
          </div>
          <form action={rodarTeste}>
            <button disabled={testando} className="app-secondary-button px-4 py-2 text-[12.5px] disabled:opacity-60">
              {testando ? 'Testando…' : 'Testar o assistente'}
            </button>
          </form>
        </div>
        {teste.erro && <p className="mt-3 text-[12.5px] text-aviso">{teste.erro}</p>}
        {teste.respostas && (
          <ul className="mt-4 flex flex-col gap-2.5 border-t border-line pt-3.5">
            {teste.respostas.map((r) => (
              <li key={r.pergunta} className="text-[12.5px] leading-5">
                <p className="font-semibold text-soft">{r.pergunta}</p>
                <p className={r.passou ? 'text-aviso' : 'text-dim'}>{r.resposta}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11.5px] text-muted">O teste usa a ficha salva. Salve antes de testar o que mudou.</p>
      </section>

      <section className="app-card max-w-[860px] overflow-hidden">
        <header className="border-b border-line px-[18px] py-3.5">
          <h2 className="text-[13px] font-bold">Ficha do assistente</h2>
          <p className="mt-0.5 text-[12px] text-dim">
            O que o seu cliente sempre pergunta. O assistente responde só com o que estiver aqui. Não
            escreva chave nem senha: este texto vai para o provedor da IA.
          </p>
        </header>
        <div className="px-[18px] py-4">
          <FormularioSalvar action={salvar} rotulo="Salvar ficha" dica="Vale na próxima conversa. Não precisa republicar fluxo nenhum.">
            <div className="flex flex-col gap-4">
              <Campo rotulo="Em uma frase: o que é o seu negócio?" nome="abertura" valor={ficha.abertura} exemplo="Somos a Loja Exemplo, papelaria no centro de Maringá." linhas={2} />

              {perguntas.map((p) => (
                <div key={p.id}>
                  <input type="hidden" name={`titulo:${p.id}`} value={ficha.respostas[p.id]?.titulo ?? p.titulo} />
                  <Campo rotulo={p.pergunta} nome={`resposta:${p.id}`} valor={ficha.respostas[p.id]?.texto ?? ''} exemplo={p.exemplo} />
                </div>
              ))}

              {listas.map((lista) => (
                <fieldset key={lista.id} className="rounded-[11px] border border-line px-3.5 py-3">
                  <legend className="px-1 text-[12.5px] font-bold">{lista.rotulo}</legend>
                  <div className="flex flex-col gap-1.5">
                    {lista.opcoes.map((opcao) => (
                      <label key={opcao.texto} className="flex items-center gap-2 text-[12.5px]">
                        <input
                          type="checkbox"
                          name={`lista:${lista.id}`}
                          value={opcao.texto}
                          defaultChecked={opcao.travada || marcadas[lista.id].includes(opcao.texto)}
                          disabled={opcao.travada}
                        />
                        <span>{opcao.texto}</span>
                        {opcao.travada && <span className="text-[11px] text-muted">(sempre, por segurança)</span>}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <Campo
                rotulo="Mais alguma coisa que o assistente precisa saber"
                nome="mais"
                valor={ficha.mais}
                exemplo="Promoções da semana, o que não responder, recados para a equipe..."
                linhas={8}
              />
            </div>
          </FormularioSalvar>
        </div>
      </section>
    </div>
  )
}

function Campo({ rotulo, nome, valor, exemplo, linhas = 3 }: { rotulo: string; nome: string; valor: string; exemplo: string; linhas?: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-soft">{rotulo}</span>
      <textarea name={nome} rows={linhas} defaultValue={valor} placeholder={exemplo} className="app-field resize-y px-3.5 py-2.5 text-[13px] leading-6" />
    </label>
  )
}
