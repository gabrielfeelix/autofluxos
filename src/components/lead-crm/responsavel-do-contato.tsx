'use client'

import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { Dropdown } from '@/components/design/dropdown'
import { Avatar } from '@/components/inbox/avatar'
import { acaoAtribuirContato } from '@/server/acoes-crm'

/**
 * Quem cuida desta pessoa.
 *
 * Fica ao lado do estágio porque as duas perguntas vêm juntas: em que pé está,
 * e com quem. **Sem dono é estado visível** — o avatar cinza com "?" ocupa o
 * mesmo lugar do avatar de alguém, em vez de deixar um buraco que se lê como
 * "ainda não carregou".
 *
 * Diferente do "Assumir" do Inbox, que é sobre si mesmo: aqui a lista é a
 * equipe inteira, porque na ficha a pergunta costuma ser "quem *deveria*
 * cuidar", e a resposta costuma ser outra pessoa.
 */
export function ResponsavelDoContato({
  clienteId,
  contatoId,
  equipe,
  responsavelId,
}: {
  clienteId: string
  contatoId: string
  equipe: { id: string; nome: string }[]
  /** `null` = ninguém pegou. */
  responsavelId: string | null
}) {
  /* String vazia é "ninguém": o `Dropdown` trabalha com valores de texto, e
     `null` não sobrevive à ida e volta pelo `<input type="hidden">`. */
  const otimista = useAcaoOtimista<string>(responsavelId ?? '')
  const nome = equipe.find((pessoa) => pessoa.id === otimista.valor)?.nome ?? null

  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-2">
        <Avatar nome={nome} tamanho={28} />
        {/* Largura no invólucro, pelo mesmo motivo do estágio. */}
        <span className="w-[186px] shrink-0">
          <Dropdown
            rotuloAcessivel="Quem cuida deste contato"
            valor={otimista.valor}
            aoMudar={(novo) =>
              otimista.agir(novo, () => acaoAtribuirContato(clienteId, contatoId, novo || null))
            }
            className="w-full text-[12.5px]"
            opcoes={[
              { valor: '', rotulo: 'sem responsável' },
              ...equipe.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome })),
            ]}
          />
        </span>
      </span>
      {otimista.erro && (
        <span role="alert" className="mt-1 text-[10.5px] text-perigo">
          {otimista.erro}
        </span>
      )}
    </span>
  )
}
