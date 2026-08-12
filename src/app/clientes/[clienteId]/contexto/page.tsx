import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormularioSalvar } from '@/components/design/formulario-salvar'
import { acaoSalvarContexto } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/**
 * O que a IA pode dizer sobre este negócio.
 *
 * Esta tela não é acessório do bloco de IA — ela **é** o bloco de IA. O prompt
 * manda responder `não sei` para tudo que não estiver escrito aqui, então com
 * ela vazia a IA responde "não sei" a toda pergunta e a conversa vai para uma
 * pessoa sempre. Falha fechado, que é o certo, mas o efeito é um bot que parece
 * pronto e nunca responde nada.
 *
 * É também o que mantém o número do cliente vivo: a política da Meta proíbe
 * assistente de propósito geral na Business API desde 15/jan/2026, e é o escopo
 * escrito aqui que faz o nosso bot ser task-oriented (ARQUITETURA §6).
 */

const EXEMPLO = `Somos a Prelúdio, produtora de vídeo em São Paulo (Barra Funda).

O que fazemos: vídeo institucional, comercial e promocional, cobertura de
eventos, edição e pós-produção, e casamento.

Preço: institucional costuma ficar entre R$ X e R$ Y, dependendo de diária,
equipe e entregáveis. Casamento é orçamento à parte.

Horário de atendimento: de segunda a sexta, das 9h às 18h.

O que NÃO responder: prazo fechado, desconto, e disponibilidade de data — isso
depende de agenda e quem confirma é uma pessoa.`

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const vazio = cliente.contextoNegocio.trim() === ''

  return (
    <main className="max-w-[820px] px-[42px] pt-[26px] pb-[42px]">
      <Link
        href={`/clientes/${clienteId}/ajustes`}
        className="mb-3.5 inline-block text-[12.5px] text-muted transition hover:text-accent"
      >
        ← Ajustes
      </Link>

      <h1 className="text-[25px] font-bold tracking-[-0.02em]">Contexto do negócio</h1>
      <p className="mt-1.5 mb-6 max-w-[620px] text-[13px] leading-6 text-dim">
        É a <strong className="text-soft">única fonte de verdade</strong> do bloco de IA. Ela
        responde só com o que estiver escrito aqui; para qualquer outra coisa, passa a conversa
        para uma pessoa. Escreva como você explicaria o negócio para alguém no primeiro dia de
        trabalho — incluindo o que ela <em>não</em> deve responder.
      </p>

      {vazio && (
        <p className="mb-5 rounded-[11px] border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-[12.5px] leading-5 text-amber-200">
          Está vazio. Enquanto ficar assim, um fluxo com bloco de IA não publica — ele responderia
          &quot;não sei&quot; a tudo.
        </p>
      )}

      <FormularioSalvar
        action={acaoSalvarContexto.bind(null, clienteId)}
        dica="Vale na próxima conversa. Não precisa republicar fluxo nenhum."
      >
        <textarea
          name="contexto"
          rows={18}
          defaultValue={cliente.contextoNegocio}
          placeholder={EXEMPLO}
          className="app-field resize-y px-4 py-3.5 text-[13px] leading-6"
        />
      </FormularioSalvar>
    </main>
  )
}
