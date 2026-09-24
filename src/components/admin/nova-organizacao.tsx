import { Dropdown } from '@/components/design/dropdown'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { PLANO_DE_ENTRADA } from '@/core/planos'
import { acaoAdminCriarOrganizacao } from '@/server/acoes-admin'

const CAMPO = 'app-field px-[13px] py-[11px] text-[13.5px]'

/**
 * Nova organização pela administração (A10): nome, plano e o Proprietário por
 * e-mail. Na Visão geral e na lista de Organizações.
 */
export function NovaOrganizacao({ planos }: { planos: { id: string; nome: string; preco: number; ativo: boolean }[] }) {
  return (
    <ModalFormulario
      botao={
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-lg leading-none">+</span>
          Nova organização
        </span>
      }
      titulo="Nova organização"
      descricao="Nasce vazia, no plano escolhido, com o Proprietário já dentro. O primeiro fluxo e o número de WhatsApp vêm depois."
      action={acaoAdminCriarOrganizacao}
    >
      <label>
        <RotuloCampo>Nome da organização</RotuloCampo>
        <input name="nome" required autoFocus placeholder="Exemplo: Vega Filmes" className={CAMPO} />
      </label>
      <div>
        <RotuloCampo>Plano</RotuloCampo>
        <Dropdown
          nome="plano"
          rotuloAcessivel="Plano"
          valorInicial={PLANO_DE_ENTRADA}
          opcoes={planos.filter((plano) => plano.ativo).map((plano) => ({ valor: plano.id, rotulo: plano.nome, detalhe: `R$ ${plano.preco.toLocaleString('pt-BR')}` }))}
        />
      </div>
      <label>
        <RotuloCampo>E-mail do Proprietário</RotuloCampo>
        <input name="email" type="email" required placeholder="Exemplo: dono@vegafilmes.com.br" className={CAMPO} />
      </label>
      <fieldset className="rounded-[12px] border border-line px-3.5 py-3">
        <legend className="px-1 text-[11.5px] text-dim">Só se o e-mail ainda não tem login</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <RotuloCampo>Nome do Proprietário</RotuloCampo>
            <input name="nomeDono" placeholder="Exemplo: Ana Souza" className={CAMPO} />
          </label>
          <label>
            <RotuloCampo>Senha provisória</RotuloCampo>
            <input name="senha" type="text" minLength={10} autoComplete="new-password" placeholder="Exemplo: 10 caracteres" className={`${CAMPO} font-mono`} />
          </label>
        </div>
      </fieldset>
    </ModalFormulario>
  )
}
