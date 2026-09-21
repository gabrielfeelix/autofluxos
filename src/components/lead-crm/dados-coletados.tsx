import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'
import { ehCampoTecnico } from '@/core/contatos/valor-do-campo'
import { AjudaDoCampo } from '@/components/design/ajuda-do-campo'
import { IconeDaSecao, iconeFormulario } from './icones'
import { ValorDoCampo } from './valor-do-campo'

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
 *
 * **Duas listas, não uma.** O que a pessoa respondeu fica à vista; o que o
 * fluxo guardou para se reencontrar depois (UUID de horário, de sessão, de
 * pessoa) fica atrás de "Dados técnicos", fechado. Misturados, os segundos
 * eram a maior parte da altura da seção e não diziam nada a quem lê. Ver
 * `ehCampoTecnico`.
 */
export function DadosColetados({ campos }: { campos: [string, string][] }) {
  const daPessoa = campos.filter(([chave, valor]) => !ehCampoTecnico(chave, valor))
  const tecnicos = campos.filter(([chave, valor]) => ehCampoTecnico(chave, valor))

  return (
    <section className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao>{iconeFormulario}</IconeDaSecao>
        O que o fluxo coletou
        <AjudaDoCampo
          titulo="Dados coletados"
          secao="variaveis"
          texto="As respostas que a pessoa deu ao bot durante a conversa."
          detalhes={
            <>
              <p>
                É o que os blocos de Pergunta guardaram: cada linha é uma variável do fluxo com o
                que a pessoa respondeu.
              </p>
              <p>
                São <strong>dados dela</strong>, não campos que a equipe edita. Ficam no contato e
                continuam disponíveis na conversa seguinte, inclusive para outras automações.
              </p>
            </>
          }
        />
      </h2>

      {campos.length === 0 ? (
        <p className="px-[18px] py-[22px] text-xs leading-5 text-dim">
          Nada coletado: a conversa não chegou a preencher nenhuma variável.
        </p>
      ) : (
        <>
          {daPessoa.length > 0 && <Lista campos={daPessoa} />}

          {tecnicos.length === 0 ? null : (
            <details className="border-t border-line">
              <summary className="cursor-pointer px-[18px] py-3 text-[11.5px] font-semibold text-dim transition hover:text-muted">
                Dados técnicos ({tecnicos.length})
              </summary>
              <p className="px-[18px] pb-2 text-[11px] leading-5 text-dim">
                Códigos que o fluxo guarda para reencontrar o registro no outro sistema. Não são
                respostas da pessoa.
              </p>
              <Lista campos={tecnicos} />
            </details>
          )}
        </>
      )}
    </section>
  )
}

/** A grade de campos. Uma célula por campo, com o valor desenhado pelo tipo. */
function Lista({ campos }: { campos: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
      {campos.map(([chave, valor]) => (
        <div key={chave} className="bg-panel px-[18px] py-3">
          <dt className="text-[10.5px] font-semibold text-dim">{rotuloDoCampo(chave) || chave}</dt>
          <dd className="mt-1">
            <ValorDoCampo valor={valor} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
