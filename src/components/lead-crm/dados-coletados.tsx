import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'

/**
 * O que o fluxo coletou.
 *
 * Estava escrito direto na página, dentro da coluna de 280px, onde todo valor
 * de mais de vinte caracteres virava `truncate` e a resposta ficava ilegível
 * justamente na tela feita para lê-la. Aqui os valores quebram linha.
 *
 * Fica em "Dados e origem", e não na visão geral: é o que o bot perguntou, não
 * o que a equipe precisa decidir. Quem abre a ficha para saber em que pé está a
 * negociação não deveria passar por dez variáveis de formulário antes.
 */
export function DadosColetados({ campos }: { campos: [string, string][] }) {
  return (
    <section className="app-card overflow-hidden">
      <h2 className="border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        O que o fluxo coletou
      </h2>
      {campos.length === 0 ? (
        <p className="px-[18px] py-[22px] text-xs leading-5 text-dim">
          Nada coletado: a conversa não chegou a preencher nenhuma variável.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {campos.map(([chave, valor]) => (
            <div key={chave} className="bg-panel px-[18px] py-3">
              <dt className="text-[10.5px] font-semibold text-dim">
                {rotuloDoCampo(chave) || chave}
              </dt>
              <dd className="mt-1 text-[13px] font-semibold break-words">{valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
